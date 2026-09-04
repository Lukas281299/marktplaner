import { describe, expect, it } from 'vitest';
import {
  abteilungsstand,
  abteilungVon,
  gefiltert,
  gruppenstand,
  kenntNamen,
  leseSortimentsliste,
  mitAbteilung,
  mitAufgenommenem,
  mitZuordnung,
  mitSortiment,
  mitWarengruppe,
  ohneAbteilung,
  zuordnungVon,
  ohneSortiment,
  mitStand,
  naechsterStand,
  ohneWarengruppe,
  pfadVon,
  pfadeUnter,
  standVon,
  umbenannteAbteilung,
  umbenannteWarengruppe,
  umbenanntesSortiment,
  umfang,
  vereinigt,
} from './sortiment';
import type { Sortimentsliste } from '../daten/warengruppen';

/**
 * Prüfungen für den Abgleich zwischen Sortimentsliste und Plan.
 *
 * Der Zweck der Liste ist die Frage „habe ich etwas vergessen?" – und die
 * beantwortet sie nur, wenn sie beides richtig zählt. Zu viel Grün wiegt in
 * Sicherheit, zu viel Rot schickt einen auf die Suche nach etwas, das längst
 * dasteht.
 */

const liste: Sortimentsliste = {
  abteilungen: [
    {
      name: 'Drogerie',
      warengruppen: [
        { name: 'Babyartikel', sortimente: ['Babypflege', 'Windeln', 'Babynahrung Glas'] },
        { name: 'Waschmittel', sortimente: ['Vollwaschmittel', 'Weichspüler'] },
      ],
    },
    {
      name: 'Backwaren',
      warengruppen: [{ name: 'Bake Off', sortimente: ['Croissants', 'Snacks'] }],
    },
  ],
};

const drogerie = liste.abteilungen[0];
const baby = drogerie.warengruppen[0];

/** Der Pfad eines Sortiments in der Beispielliste. */
const sPfad = (name: string) => pfadVon(drogerie.name, baby.name, name);
const gPfad = pfadVon(drogerie.name, baby.name);

describe('Abhaken von Hand', () => {
  it('ist ohne Zutun offen', () => {
    expect(standVon(undefined, sPfad('Windeln'))).toBe('rot');
  });

  it('schaltet rot → grün → grau → rot', () => {
    expect(naechsterStand('rot')).toBe('gruen');
    expect(naechsterStand('gruen')).toBe('grau');
    expect(naechsterStand('grau')).toBe('rot');
  });

  it('merkt sich grün und grau, rot aber nicht', () => {
    // Rot ist der Grundzustand. Ihn zu speichern hieße, jede Planung mit
    // dreihundert Einträgen zu füllen, die nichts aussagen.
    const gruen = mitStand({}, [sPfad('Windeln')], 'gruen');
    expect(gruen[sPfad('Windeln')]).toBe('gruen');
    expect(mitStand(gruen, [sPfad('Windeln')], 'rot')).toEqual({});
  });

  it('nimmt beim Abhaken alles darunter mit', () => {
    // Wer eine Warengruppe abhakt, hakt ihre Sortimente mit ab – alles
    // andere wäre Klickarbeit.
    const pfade = pfadeUnter(liste, gPfad);
    expect(pfade).toContain(gPfad);
    expect(pfade).toContain(sPfad('Windeln'));
    expect(pfade).toHaveLength(1 + baby.sortimente.length);
  });

  it('nimmt bei einer Abteilung alles darin mit', () => {
    const pfade = pfadeUnter(liste, pfadVon(drogerie.name));
    expect(pfade[0]).toBe(pfadVon(drogerie.name));
    // Zwei Warengruppen mit drei und zwei Sortimenten, dazu die Abteilung.
    expect(pfade).toHaveLength(1 + 2 + 3 + 2);
  });
});

describe('Grün, rot und grau', () => {
  const mit = (paare: [string, 'gruen' | 'grau'][]) =>
    paare.reduce<Record<string, 'gruen' | 'grau'>>((stand, [pfad, wert]) => mitStand(stand, [pfad], wert), {});

  it('lässt eine Warengruppe rot, solange ein Sortiment offen ist', () => {
    // Genau der Fehler von vorher: „Kaffee" galt als gesetzt, weil irgendwo
    // „Filterkaffee" stand. Jetzt zählt nur, was abgehakt ist.
    const stand = mit([[sPfad('Windeln'), 'gruen']]);
    expect(gruppenstand(stand, drogerie.name, baby).wert).toBe('rot');
  });

  it('macht sie grün, wenn alles darunter steht', () => {
    const stand = mit(baby.sortimente.map((n) => [sPfad(n), 'gruen'] as [string, 'gruen']));
    expect(gruppenstand(stand, drogerie.name, baby).wert).toBe('gruen');
  });

  it('zählt Graues nicht als Lücke', () => {
    // Was es hier nicht gibt, fehlt auch nicht.
    const stand = mit([
      [sPfad('Windeln'), 'gruen'],
      [sPfad('Babypflege'), 'grau'],
      [sPfad('Babynahrung Glas'), 'grau'],
    ]);
    const ergebnis = gruppenstand(stand, drogerie.name, baby);
    expect(ergebnis.wert).toBe('gruen');
    expect(ergebnis.zahlen).toEqual({ gruen: 1, offen: 0, grau: 2 });
  });

  it('macht sie grau, wenn alles darunter grau ist', () => {
    const stand = mit(baby.sortimente.map((n) => [sPfad(n), 'grau'] as [string, 'grau']));
    expect(gruppenstand(stand, drogerie.name, baby).wert).toBe('grau');
  });

  it('lässt eine Warengruppe ohne Sortimente ihren eigenen Haken tragen', () => {
    const leer = { name: 'Restaurant', sortimente: [] };
    expect(gruppenstand({}, 'Centeria', leer).wert).toBe('rot');
    expect(
      gruppenstand({ [pfadVon('Centeria', 'Restaurant')]: 'gruen' }, 'Centeria', leer).wert,
    ).toBe('gruen');
  });

  it('rechnet die Abteilung aus ihren Warengruppen', () => {
    const stand = mit(baby.sortimente.map((n) => [sPfad(n), 'gruen'] as [string, 'gruen']));
    const ergebnis = abteilungsstand(stand, drogerie);
    expect(ergebnis.wert).toBe('rot');
    expect(ergebnis.zahlen).toEqual({ gruen: 1, offen: 1, grau: 0 });
  });
});

describe('Suchen und Aufnehmen', () => {
  it('findet auf allen drei Stufen', () => {
    expect(gefiltert(liste, 'drogerie').abteilungen[0].warengruppen).toHaveLength(2);
    expect(gefiltert(liste, 'bake').abteilungen[0].name).toBe('Backwaren');
    expect(gefiltert(liste, 'windel').abteilungen[0].warengruppen[0].sortimente).toEqual([
      'Windeln',
    ]);
  });

  it('lässt eine Abteilung ohne Treffer weg', () => {
    expect(gefiltert(liste, 'windel').abteilungen).toHaveLength(1);
  });

  it('nimmt einen neuen Namen unter „Eigene" auf', () => {
    const neu = mitAufgenommenem(liste, 'Grillkohle')!;
    expect(kenntNamen(neu, 'Grillkohle')).toBe(true);
    expect(neu.abteilungen[neu.abteilungen.length - 1].name).toBe('Eigene');
  });

  it('nimmt nichts zweimal auf', () => {
    expect(mitAufgenommenem(liste, 'Windeln')).toBeNull();
    expect(mitAufgenommenem(liste, '   ')).toBeNull();
  });
});

describe('Eine Liste einlesen', () => {
  it('liest die JSON-Form', () => {
    const roh = JSON.stringify(liste);
    expect(umfang(leseSortimentsliste(roh))).toEqual({
      abteilungen: 2,
      warengruppen: 3,
      sortimente: 7,
    });
  });

  it('liest eine Tabelle mit drei Spalten', () => {
    const roh = [
      'Abteilung;Warengruppe;Sortiment',
      'Drogerie;Babyartikel;Babypflege',
      ';;Windeln',
      ';Waschmittel;Vollwaschmittel',
      'Backwaren;Bake Off;Croissants',
    ].join('\n');
    const gelesen = leseSortimentsliste(roh);
    expect(umfang(gelesen)).toEqual({ abteilungen: 2, warengruppen: 3, sortimente: 4 });
    expect(gelesen.abteilungen[0].warengruppen[0].sortimente).toEqual(['Babypflege', 'Windeln']);
  });

  it('sagt Bescheid, statt still eine leere Liste zu liefern', () => {
    // Eine leere Liste färbte alles rot, und niemand wüsste warum.
    expect(() => leseSortimentsliste('')).toThrow();
    expect(() => leseSortimentsliste('{ kaputt')).toThrow();
    expect(() => leseSortimentsliste('{"abteilungen":[]}')).toThrow();
  });
});

describe('Die Liste pflegen', () => {
  /**
   * Ein Sortiment ändert sich – das Programm soll dem nicht im Weg stehen.
   * Wichtig ist nur, dass jede Änderung eine **neue** Liste ergibt: Sonst
   * schlüge sie an einer Stelle durch, an der niemand sie erwartet.
   */
  it('lässt die alte Liste in Ruhe', () => {
    const vorher = JSON.stringify(liste);
    mitAbteilung(liste, 'Neu');
    ohneWarengruppe(liste, 'Drogerie', 'Babyartikel');
    umbenanntesSortiment(liste, 'Drogerie', 'Babyartikel', 'Windeln', 'Höschen');
    expect(JSON.stringify(liste)).toBe(vorher);
  });

  it('legt eine Abteilung an und entfernt sie wieder', () => {
    const mit = mitAbteilung(liste, 'Getränke');
    expect(mit.abteilungen.map((a) => a.name)).toContain('Getränke');
    expect(ohneAbteilung(mit, 'Getränke').abteilungen).toHaveLength(liste.abteilungen.length);
  });

  it('legt keine Abteilung doppelt an', () => {
    expect(mitAbteilung(liste, 'Drogerie').abteilungen).toHaveLength(2);
  });

  it('benennt auf allen drei Stufen um', () => {
    expect(umbenannteAbteilung(liste, 'Drogerie', 'Drogerie & Tier').abteilungen[0].name).toBe(
      'Drogerie & Tier',
    );
    expect(
      umbenannteWarengruppe(liste, 'Drogerie', 'Babyartikel', 'Baby').abteilungen[0]
        .warengruppen[0].name,
    ).toBe('Baby');
    expect(
      umbenanntesSortiment(liste, 'Drogerie', 'Babyartikel', 'Windeln', 'Höschen').abteilungen[0]
        .warengruppen[0].sortimente,
    ).toContain('Höschen');
  });

  it('legt Warengruppe und Sortiment an', () => {
    const mit = mitWarengruppe(liste, 'Backwaren', 'Brot SB');
    expect(mit.abteilungen[1].warengruppen.map((w) => w.name)).toContain('Brot SB');
    const mitS = mitSortiment(mit, 'Backwaren', 'Brot SB', 'Toast');
    expect(mitS.abteilungen[1].warengruppen[1].sortimente).toEqual(['Toast']);
  });

  it('entfernt ein Sortiment, ohne die Nachbarn anzufassen', () => {
    const ohne = ohneSortiment(liste, 'Drogerie', 'Babyartikel', 'Windeln');
    expect(ohne.abteilungen[0].warengruppen[0].sortimente).toEqual([
      'Babypflege',
      'Babynahrung Glas',
    ]);
    expect(ohne.abteilungen[0].warengruppen[1].sortimente).toHaveLength(2);
  });

  it('fasst nichts an, was es nicht gibt', () => {
    // Ein stillschweigend neu angelegter Eintrag wäre schlimmer als nichts:
    // Man sucht ihn dann an der falschen Stelle.
    expect(mitSortiment(liste, 'Gibtsnicht', 'Auch nicht', 'X')).toEqual(liste);
    expect(umbenannteWarengruppe(liste, 'Gibtsnicht', 'A', 'B')).toEqual(liste);
  });
});

describe('Die Tabelle des Marktes', () => {
  /**
   * Die Sortimentsliste kommt aus einer Excel-Tabelle, deren Gliederung in
   * Excels Zeilengruppierung steckt: keine Stufe = Abteilung, Stufe 1 =
   * Warengruppe, alles tiefer = Sortiment. „Alles tiefer" ist wichtig – bei
   * einer Warengruppe sitzen die Sortimente eine Stufe zu tief gruppiert, und
   * ohne diese Regel fielen sie weg.
   */
  const ausGliederung = (zeilen: [string, number][]) => {
    const roh = zeilen
      .map(([name, stufe]) =>
        stufe === 0 ? `${name};;` : stufe === 1 ? `;${name};` : `;;${name}`,
      )
      .join('\n');
    return leseSortimentsliste(roh);
  };

  it('ordnet drei Stufen richtig ein', () => {
    const gelesen = ausGliederung([
      ['Backwaren', 0],
      ['Bake Off', 1],
      ['Croissants', 2],
      ['Snacks', 3],
      ['Centeria', 0],
      ['Restaurant', 1],
    ]);
    expect(gelesen.abteilungen.map((a) => a.name)).toEqual(['Backwaren', 'Centeria']);
    expect(gelesen.abteilungen[0].warengruppen[0].sortimente).toEqual(['Croissants', 'Snacks']);
    expect(gelesen.abteilungen[1].warengruppen[0]).toEqual({ name: 'Restaurant', sortimente: [] });
  });
});

describe('Eine überarbeitete Liste ergänzen', () => {
  /**
   * Der übliche Fall: Die Sortimentsliste des Marktes wurde überarbeitet, ein
   * paar Sortimente sind dazugekommen. Ersetzen wäre dort falsch — es würfe
   * weg, was von Hand aufgenommen wurde, und jeder Haken hinge an einem
   * Eintrag, den es so nicht mehr gibt.
   */
  const neuere: Sortimentsliste = {
    abteilungen: [
      {
        name: 'Drogerie',
        warengruppen: [
          // Ein neues Sortiment in einer bekannten Warengruppe …
          { name: 'Babyartikel', sortimente: ['Windeln', 'Feuchttücher'] },
          // … und eine ganz neue Warengruppe.
          { name: 'Zahnpflege', sortimente: ['Zahnpasta'] },
        ],
      },
      // Eine ganz neue Abteilung.
      { name: 'Getränke', warengruppen: [{ name: 'Wasser', sortimente: ['Still', 'Sprudel'] }] },
    ],
  };

  it('zählt, was dazugekommen ist', () => {
    const { zuwachs } = vereinigt(liste, neuere);
    expect(zuwachs).toEqual({ abteilungen: 1, warengruppen: 2, sortimente: 4 });
  });

  it('hängt Neues an, ohne Vorhandenes anzufassen', () => {
    const { liste: ergaenzt } = vereinigt(liste, neuere);
    const drogerieNeu = ergaenzt.abteilungen[0];
    expect(drogerieNeu.warengruppen[0].sortimente).toEqual([
      'Babypflege',
      'Windeln',
      'Babynahrung Glas',
      'Feuchttücher',
    ]);
    expect(drogerieNeu.warengruppen.map((w) => w.name)).toEqual([
      'Babyartikel',
      'Waschmittel',
      'Zahnpflege',
    ]);
    expect(ergaenzt.abteilungen.map((a) => a.name)).toEqual([
      'Drogerie',
      'Backwaren',
      'Getränke',
    ]);
  });

  it('lässt stehen, was in der neuen Liste fehlt', () => {
    // „Backwaren" kommt dort gar nicht vor. Ein Eintrag, den das Programm
    // still entfernt, nimmt einen Haken mit, den jemand gesetzt hat.
    const { liste: ergaenzt } = vereinigt(liste, neuere);
    expect(ergaenzt.abteilungen.find((a) => a.name === 'Backwaren')).toBeTruthy();
    expect(ergaenzt.abteilungen[0].warengruppen[1].name).toBe('Waschmittel');
  });

  it('legt nichts zweimal an, nur weil es anders geschrieben ist', () => {
    const anders: Sortimentsliste = {
      abteilungen: [
        { name: 'DROGERIE', warengruppen: [{ name: 'babyartikel', sortimente: ['windeln'] }] },
      ],
    };
    expect(vereinigt(liste, anders).zuwachs).toEqual({
      abteilungen: 0,
      warengruppen: 0,
      sortimente: 0,
    });
  });

  it('meldet null, wenn dieselbe Datei noch einmal kommt', () => {
    expect(vereinigt(liste, liste).zuwachs).toEqual({
      abteilungen: 0,
      warengruppen: 0,
      sortimente: 0,
    });
    expect(vereinigt(liste, liste).liste).toEqual(liste);
  });
});

describe('Zuordnung: welche Warengruppe zu welcher zählt', () => {
  it('gibt das Ziel zurück, unabhängig von der Schreibweise', () => {
    const z = { waffeln: 'Kuchen' };
    expect(zuordnungVon(z, 'Waffeln')).toBe('Kuchen');
    expect(zuordnungVon(z, '  WAFFELN ')).toBe('Kuchen');
    expect(zuordnungVon(z, 'Kekse')).toBeUndefined();
    expect(zuordnungVon(undefined, 'Waffeln')).toBeUndefined();
  });

  it('nimmt eine Zuordnung auf sich selbst nicht ernst', () => {
    // Das ist keine Aussage, sondern ein Versehen – und im Rechenweg wäre es
    // eine Schleife.
    expect(zuordnungVon({ waffeln: 'Waffeln' }, 'Waffeln')).toBeUndefined();
    expect(mitZuordnung(undefined, 'Waffeln', 'waffeln')).toBeUndefined();
  });

  it('setzt und löscht', () => {
    const eins = mitZuordnung(undefined, 'Waffeln', 'Kuchen');
    expect(eins).toEqual({ waffeln: 'Kuchen' });
    const zwei = mitZuordnung(eins, 'Kekse', 'Kuchen');
    expect(zwei).toEqual({ waffeln: 'Kuchen', kekse: 'Kuchen' });
    expect(mitZuordnung(zwei, 'Kekse', null)).toEqual({ waffeln: 'Kuchen' });
    // Die letzte Zuordnung weg heißt: gar kein Eintrag mehr, nicht ein
    // leeres Objekt in jeder gespeicherten Datei.
    expect(mitZuordnung(eins, 'Waffeln', '  ')).toBeUndefined();
  });
});

describe('Abteilung eines Namens', () => {
  const liste = {
    abteilungen: [
      { name: 'Backwaren', warengruppen: [{ name: 'Bake Off', sortimente: ['Croissants'] }] },
    ],
  };

  it('findet ihn auf beiden Stufen', () => {
    // Unter einen Zug schreibt man mal die Warengruppe und mal ein einzelnes
    // Sortiment – beide gehören zur gleichen Abteilung.
    expect(abteilungVon(liste, 'Bake Off')).toBe('Backwaren');
    expect(abteilungVon(liste, 'croissants')).toBe('Backwaren');
    expect(abteilungVon(liste, 'Kaffee')).toBeUndefined();
  });
});

describe('Die Liste kennt die Zuordnung', () => {
  const liste = {
    abteilungen: [
      {
        name: 'Feinbackwaren',
        warengruppen: [{ name: 'Süßes', sortimente: ['Kuchen', 'Waffeln'] }],
      },
    ],
  };
  const z = { waffeln: 'Kuchen' };

  it('zählt einen zugeordneten Namen nicht als offen', () => {
    // „In der Liste fehlt dann keine bzw. es sieht nicht so aus, als sei sie
    // vergessen worden." Waffeln laufen über Kuchen – also kein offener Punkt.
    const ohne = gruppenstand(undefined, 'Feinbackwaren', liste.abteilungen[0].warengruppen[0]);
    expect(ohne.zahlen.offen).toBe(2);

    const mit = gruppenstand(undefined, 'Feinbackwaren', liste.abteilungen[0].warengruppen[0], z);
    expect(mit.zahlen.offen).toBe(1);
    expect(mit.zahlen.grau).toBe(1);
  });

  it('gibt dem Eintrag einen eigenen Zustand', () => {
    expect(standVon(undefined, pfadVon('Feinbackwaren', 'Süßes', 'Waffeln'), z)).toBe('zugeordnet');
    expect(standVon(undefined, pfadVon('Feinbackwaren', 'Süßes', 'Kuchen'), z)).toBe('rot');
  });

  it('lässt einen gesetzten Haken vorgehen', () => {
    // Wer den Namen selbst abgehakt hat, meint das auch so.
    const stand = { [pfadVon('Feinbackwaren', 'Süßes', 'Waffeln')]: 'gruen' as const };
    expect(standVon(stand, pfadVon('Feinbackwaren', 'Süßes', 'Waffeln'), z)).toBe('gruen');
  });

});
