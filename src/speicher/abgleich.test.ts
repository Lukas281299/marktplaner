import { describe, expect, it } from 'vitest';
import {
  graeberAufraeumen,
  planeAbgleich,
  type LokalerStand,
  type SyncPaket,
  type Verzeichniseintrag,
} from './abgleich';

/**
 * Prüfungen für die Zusammenführ-Logik.
 *
 * Hier entscheidet sich, ob eine Marktplanung überlebt. Ein Fehler an dieser
 * Stelle fällt nicht auf – er löscht still etwas, das man erst Wochen später
 * vermisst. Deshalb ist jeder Fall einzeln festgehalten, auch die
 * langweiligen.
 */

// Feste Zeitpunkte, damit die Prüfungen unabhängig von der Uhr sind.
const FRUEH = 1_000_000;
const MITTE = 2_000_000;
const SPAET = 3_000_000;

function eintrag(id: string, geaendertAm: number, name = id): Verzeichniseintrag {
  return { id, name, erstelltAm: FRUEH, geaendertAm, anzahlElemente: 5 };
}

function lokal(teil: Partial<LokalerStand> = {}): LokalerStand {
  return {
    verzeichnis: [],
    graeber: [],
    abgeglichen: {},
    eigeneVorlagen: [],
    ...teil,
  };
}

function fern(teil: Partial<SyncPaket> = {}): SyncPaket {
  return {
    format: 'marktplaner-sync',
    version: 1,
    verzeichnis: [],
    graeber: [],
    geraete: ['anderer Rechner'],
    ...teil,
  };
}

describe('planeAbgleich – erste Verbindung', () => {
  it('schickt alles hoch, wenn auf dem Server noch nichts liegt', () => {
    const plan = planeAbgleich(lokal({ verzeichnis: [eintrag('a', MITTE)] }), undefined);

    expect(plan.schicken).toEqual(['a']);
    expect(plan.holen).toEqual([]);
    expect(plan.verzeichnis).toHaveLength(1);
  });

  it('holt alles herunter, wenn dieser Rechner noch leer ist', () => {
    const plan = planeAbgleich(lokal(), fern({ verzeichnis: [eintrag('a', MITTE)] }));

    expect(plan.holen).toEqual(['a']);
    expect(plan.schicken).toEqual([]);
  });
});

describe('planeAbgleich – eine Seite hat gearbeitet', () => {
  it('schickt die hiesige Fassung, wenn nur hier geändert wurde', () => {
    const plan = planeAbgleich(
      lokal({
        verzeichnis: [eintrag('a', SPAET)],
        // Beim letzten Abgleich stand die Planung auf MITTE – so wie noch immer
        // auf dem Server. Also hat sich seither nur hier etwas getan.
        abgeglichen: { a: MITTE },
      }),
      fern({ verzeichnis: [eintrag('a', MITTE)] }),
    );

    expect(plan.schicken).toEqual(['a']);
    expect(plan.gabelungen).toEqual([]);
    expect(plan.verzeichnis[0].geaendertAm).toBe(SPAET);
  });

  it('holt die ferne Fassung, wenn nur dort geändert wurde', () => {
    const plan = planeAbgleich(
      lokal({ verzeichnis: [eintrag('a', MITTE)], abgeglichen: { a: MITTE } }),
      fern({ verzeichnis: [eintrag('a', SPAET)] }),
    );

    expect(plan.holen).toEqual(['a']);
    expect(plan.gabelungen).toEqual([]);
    expect(plan.verzeichnis[0].geaendertAm).toBe(SPAET);
  });

  it('tut nichts, wenn beide Seiten denselben Stand haben', () => {
    const plan = planeAbgleich(
      lokal({ verzeichnis: [eintrag('a', MITTE)], abgeglichen: { a: MITTE } }),
      fern({ verzeichnis: [eintrag('a', MITTE)] }),
    );

    expect(plan.holen).toEqual([]);
    expect(plan.schicken).toEqual([]);
    expect(plan.gabelungen).toEqual([]);
  });
});

describe('planeAbgleich – beide Seiten haben gearbeitet', () => {
  it('sichert die ältere Fassung als Kopie und übernimmt die neuere', () => {
    const plan = planeAbgleich(
      lokal({ verzeichnis: [eintrag('a', MITTE, 'Markt Nord')], abgeglichen: { a: FRUEH } }),
      fern({ verzeichnis: [eintrag('a', SPAET, 'Markt Nord')] }),
    );

    // Die neuere kommt vom Server und behält die Kennung.
    expect(plan.holen).toEqual(['a']);
    expect(plan.gabelungen).toHaveLength(1);

    const gabel = plan.gabelungen[0];
    expect(gabel.id).toBe('a');
    // Die unterlegene Fassung liegt hier – sie wandert in die Kopie.
    expect(gabel.verlierer).toBe('lokal');
    expect(gabel.kopieName).toContain('Markt Nord');
    // Die Kopie muss ebenfalls hochgeladen werden.
    expect(plan.schicken).toContain(gabel.kopieId);

    // Im Verzeichnis stehen danach beide: Sieger und Sicherungskopie.
    expect(plan.verzeichnis.map((e) => e.id).sort()).toEqual([gabel.kopieId, 'a'].sort());
  });

  it('sichert die ferne Fassung, wenn die hiesige neuer ist', () => {
    const plan = planeAbgleich(
      lokal({ verzeichnis: [eintrag('a', SPAET)], abgeglichen: { a: FRUEH } }),
      fern({ verzeichnis: [eintrag('a', MITTE)] }),
    );

    expect(plan.schicken).toContain('a');
    expect(plan.gabelungen[0].verlierer).toBe('fern');
  });

  it('vergibt auf beiden Rechnern dieselbe Kennung für die Kopie', () => {
    // Sonst legte jeder Rechner seine eigene Sicherung an und man hätte die
    // unterlegene Fassung hinterher doppelt.
    const rechnerA = planeAbgleich(
      lokal({ verzeichnis: [eintrag('a', MITTE)], abgeglichen: { a: FRUEH } }),
      fern({ verzeichnis: [eintrag('a', SPAET)] }),
    );
    const rechnerB = planeAbgleich(
      lokal({ verzeichnis: [eintrag('a', SPAET)], abgeglichen: { a: FRUEH } }),
      fern({ verzeichnis: [eintrag('a', MITTE)] }),
    );

    expect(rechnerA.gabelungen[0].kopieId).toBe(rechnerB.gabelungen[0].kopieId);
  });

  it('legt die Kopie kein zweites Mal an, wenn es sie schon gibt', () => {
    const kopieId = `a-gabel-${MITTE}`;
    const plan = planeAbgleich(
      lokal({
        verzeichnis: [eintrag('a', MITTE), eintrag(kopieId, MITTE)],
        abgeglichen: { a: FRUEH },
      }),
      fern({ verzeichnis: [eintrag('a', SPAET), eintrag(kopieId, MITTE)] }),
    );

    expect(plan.gabelungen).toEqual([]);
    expect(plan.holen).toEqual(['a']);
  });

  it('geht von einer Gabelung aus, wenn es keinen Bezugspunkt gibt', () => {
    // Ohne früheren Abgleich ist nicht feststellbar, wer was wusste. Dann
    // lieber einmal zu viel sichern als einmal zu wenig.
    const plan = planeAbgleich(
      lokal({ verzeichnis: [eintrag('a', MITTE)] }),
      fern({ verzeichnis: [eintrag('a', SPAET)] }),
    );

    expect(plan.gabelungen).toHaveLength(1);
  });
});

describe('planeAbgleich – Löschen', () => {
  it('löscht auf beiden Seiten, wenn ein Rechner die Planung gelöscht hat', () => {
    const plan = planeAbgleich(
      lokal({ verzeichnis: [eintrag('a', MITTE)] }),
      fern({ verzeichnis: [eintrag('a', MITTE)], graeber: [{ id: 'a', geloeschtAm: SPAET }] }),
    );

    expect(plan.loeschenLokal).toEqual(['a']);
    expect(plan.loeschenFern).toEqual(['a']);
    expect(plan.verzeichnis).toEqual([]);
    // Der Grabstein bleibt, sonst käme die Planung beim nächsten Mal zurück.
    expect(plan.graeber).toEqual([{ id: 'a', geloeschtAm: SPAET }]);
  });

  it('lässt eine gelöschte Planung nicht zurückkehren', () => {
    // Der andere Rechner hat sie noch, weiß aber nichts von der Löschung.
    const plan = planeAbgleich(
      lokal({ graeber: [{ id: 'a', geloeschtAm: SPAET }] }),
      fern({ verzeichnis: [eintrag('a', MITTE)] }),
    );

    expect(plan.holen).toEqual([]);
    expect(plan.loeschenFern).toEqual(['a']);
  });

  it('behält die Planung, wenn nach dem Löschen daran gearbeitet wurde', () => {
    // Am zweiten Rechner wurde weitergeplant, nachdem am ersten gelöscht
    // wurde. Die Arbeit wiegt schwerer als die Löschung.
    const plan = planeAbgleich(
      lokal({ graeber: [{ id: 'a', geloeschtAm: MITTE }] }),
      fern({ verzeichnis: [eintrag('a', SPAET)] }),
    );

    expect(plan.holen).toEqual(['a']);
    expect(plan.loeschenFern).toEqual([]);
    expect(plan.graeber).toEqual([]);
  });

  it('nimmt bei zwei Grabsteinen den späteren Zeitpunkt', () => {
    const plan = planeAbgleich(
      lokal({ graeber: [{ id: 'a', geloeschtAm: FRUEH }] }),
      fern({ graeber: [{ id: 'a', geloeschtAm: SPAET }] }),
    );

    expect(plan.graeber).toEqual([{ id: 'a', geloeschtAm: SPAET }]);
  });
});

describe('planeAbgleich – zuletzt geöffnete Planung', () => {
  it('übernimmt den Rechner, der zuletzt am Werk war', () => {
    const plan = planeAbgleich(
      lokal({
        verzeichnis: [eintrag('a', MITTE), eintrag('b', MITTE)],
        abgeglichen: { a: MITTE, b: MITTE },
        zuletztGeoeffnet: 'a',
        zuletztGeoeffnetAm: FRUEH,
      }),
      fern({
        verzeichnis: [eintrag('a', MITTE), eintrag('b', MITTE)],
        zuletztGeoeffnet: 'b',
        zuletztGeoeffnetAm: SPAET,
      }),
    );

    expect(plan.zuletztGeoeffnet).toBe('b');
  });

  it('zeigt nicht auf eine gelöschte Planung', () => {
    const plan = planeAbgleich(
      lokal({
        verzeichnis: [eintrag('a', MITTE)],
        abgeglichen: { a: MITTE },
        zuletztGeoeffnet: 'a',
        zuletztGeoeffnetAm: FRUEH,
      }),
      fern({
        verzeichnis: [eintrag('a', MITTE)],
        graeber: [{ id: 'a', geloeschtAm: SPAET }],
        zuletztGeoeffnet: 'a',
        zuletztGeoeffnetAm: SPAET,
      }),
    );

    expect(plan.zuletztGeoeffnet).toBeUndefined();
  });
});

describe('planeAbgleich – eigene Vorlagen', () => {
  it('führt die Vorlagen beider Rechner zusammen', () => {
    const meine = {
      id: 'v1',
      name: 'Meine Truhe',
      kategorie: 'eigene' as const,
      breite: 200,
      tiefe: 90,
      form: 'rechteck' as const,
      farbe: '#fff',
    };
    const fremde = { ...meine, id: 'v2', name: 'Fremde Truhe' };

    const plan = planeAbgleich(
      lokal({ eigeneVorlagen: [meine] }),
      fern({ eigeneVorlagen: [fremde] }),
    );

    expect(plan.eigeneVorlagen.map((v) => v.id).sort()).toEqual(['v1', 'v2']);
  });
});

describe('graeberAufraeumen', () => {
  it('wirft Grabsteine weg, die älter als ein Jahr sind', () => {
    const jetzt = 400 * 24 * 60 * 60 * 1000;
    const alt = { id: 'alt', geloeschtAm: 0 };
    const frisch = { id: 'frisch', geloeschtAm: jetzt - 1000 };

    expect(graeberAufraeumen([alt, frisch], jetzt)).toEqual([frisch]);
  });
});
