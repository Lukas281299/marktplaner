import { describe, expect, it } from 'vitest';
import { flaeche, rahmen } from '../logik/polygon';
import { SCHEMA_VERSION } from '../typen/modell';
import { wandleProjekt } from './wandlung';

/**
 * Prüfungen für die Umwandlung älterer Planungen.
 *
 * Der Ernstfall: Jemand hat vor Wochen eine Planung angelegt, das Modell hat
 * sich seither geändert, und beim Öffnen muss trotzdem genau das dastehen, was
 * er damals gezeichnet hat. Was hier durchrutscht, merkt niemand sofort – nur
 * dass irgendwann etwas fehlt.
 */

/** Eine Planung, wie sie Fassung 1 abgelegt hat. */
function alteFassung(zusatz: Record<string, unknown> = {}) {
  return {
    id: 'projekt-alt',
    name: 'Markt Nord',
    version: 1,
    erstelltAm: 1000,
    geaendertAm: 2000,
    grundflaeche: { breite: 4000, laenge: 2500, wandstaerke: 30 },
    einstellungen: {
      anzeigeEinheit: 'm',
      rasterSichtbar: true,
      rasterWeite: 50,
      amRasterEinrasten: true,
      hilfslinienAktiv: true,
      masseAnzeigen: true,
    },
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
    raeume: [],
    elemente: [],
    ...zusatz,
  };
}

describe('Grundfläche', () => {
  it('macht aus Breite und Länge ein Rechteck', () => {
    const neu = wandleProjekt(alteFassung());

    expect(neu.version).toBe(SCHEMA_VERSION);
    expect(neu.grundflaeche.umriss).toHaveLength(4);
    expect(rahmen(neu.grundflaeche.umriss)).toEqual({
      links: 0,
      oben: 0,
      rechts: 4000,
      unten: 2500,
    });
    expect(neu.grundflaeche.wandstaerke).toBe(30);
  });

  it('behält die Fläche bei', () => {
    const neu = wandleProjekt(alteFassung());
    expect(flaeche(neu.grundflaeche.umriss)).toBe(4000 * 2500);
  });

  it('lässt alles andere unangetastet', () => {
    const alt = alteFassung({
      elemente: [{ id: 'el-1', name: 'Regal', x: 100, y: 200 }],
    });
    const neu = wandleProjekt(alt);

    expect(neu.name).toBe('Markt Nord');
    expect(neu.erstelltAm).toBe(1000);
    expect(neu.elemente).toHaveLength(1);
    // Die eine vorhandene Ebene bleibt – die fehlenden kommen dazu, siehe
    // „Fassung 7".
    expect(neu.ebenen.map((e) => e.id)).toContain('einrichtung');
  });
});

describe('Fassung 7: fehlende Standardebenen', () => {
  it('trägt jede fehlende Standardebene nach', () => {
    // Ohne diesen Schritt hätte eine ältere Planung keine Ebene
    // „Verkaufsfläche" – was darauf liegt, wäre unsichtbar, und es gäbe
    // keinen Schalter, um es zurückzuholen.
    const neu = wandleProjekt(alteFassung());
    expect(neu.ebenen.map((e) => e.id)).toEqual([
      'gebaeude',
      'raeume',
      'verkaufsflaeche',
      'einrichtung',
      'beschriftung',
      'laufwege',
    ]);
  });

  it('lässt die Einstellungen vorhandener Ebenen in Ruhe', () => {
    // Wer „Räume" ausgeblendet hatte, bekommt sie nicht durchs Öffnen
    // wieder eingeblendet.
    const neu = wandleProjekt(
      alteFassung({
        ebenen: [
          { id: 'raeume', name: 'Meine Räume', sichtbar: false, gesperrt: true },
          { id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false },
        ],
      }),
    );
    const raeume = neu.ebenen.find((e) => e.id === 'raeume')!;
    expect(raeume).toEqual({ id: 'raeume', name: 'Meine Räume', sichtbar: false, gesperrt: true });
  });

  it('wirft eine unbekannte Ebene nicht weg', () => {
    const neu = wandleProjekt(
      alteFassung({
        ebenen: [{ id: 'eigene-1', name: 'Bauabschnitt 2', sichtbar: true, gesperrt: false }],
      }),
    );
    expect(neu.ebenen.map((e) => e.id)).toContain('eigene-1');
    expect(neu.ebenen.map((e) => e.id)).toContain('verkaufsflaeche');
  });
});

describe('Räume', () => {
  it('macht aus einem Raum-Rechteck ein Polygon', () => {
    const neu = wandleProjekt(
      alteFassung({
        raeume: [
          {
            id: 'raum-1',
            name: 'Lager',
            x: 3000,
            y: 0,
            breite: 1000,
            laenge: 800,
            wandstaerke: 20,
            farbe: '#dddddd',
            beschriftungSichtbar: true,
          },
        ],
      }),
    );

    const raum = neu.raeume[0];
    expect(raum.id).toBe('raum-1');
    expect(raum.name).toBe('Lager');
    expect(rahmen(raum.umriss)).toEqual({ links: 3000, oben: 0, rechts: 4000, unten: 800 });
    expect(raum.wandstaerke).toBe(20);
    expect(raum.farbe).toBe('#dddddd');
  });

  it('setzt die Art auf „sonstige" statt zu raten', () => {
    // Ein falsch einsortierter Raum würde die Verkaufsfläche verfälschen.
    const neu = wandleProjekt(
      alteFassung({ raeume: [{ id: 'r', name: 'Lager', x: 0, y: 0, breite: 100, laenge: 100 }] }),
    );
    expect(neu.raeume[0].art).toBe('sonstige');
  });
});

describe('beschädigte Dateien', () => {
  it('kommt ohne Grundfläche zurecht', () => {
    const neu = wandleProjekt(alteFassung({ grundflaeche: undefined }));
    expect(flaeche(neu.grundflaeche.umriss)).toBeGreaterThan(0);
  });

  it('kommt mit unsinnigen Maßen zurecht', () => {
    const neu = wandleProjekt(alteFassung({ grundflaeche: { breite: 0, laenge: -5 } }));
    expect(flaeche(neu.grundflaeche.umriss)).toBeGreaterThan(0);
  });

  it('kommt ohne Raumliste zurecht', () => {
    const neu = wandleProjekt(alteFassung({ raeume: undefined }));
    expect(neu.raeume).toEqual([]);
  });

  it('vergibt einem Raum ohne Kennung eine neue', () => {
    const neu = wandleProjekt(alteFassung({ raeume: [{ name: 'Ohne Kennung' }] }));
    expect(neu.raeume[0].id).toMatch(/^raum-/);
  });
});

describe('Fassung 6: eingezeichnete Verkaufsflächen', () => {
  it('gibt einer alten Planung eine leere Liste', () => {
    // Leer ist die richtige Bedeutung: In einer alten Planung ist nichts
    // eingezeichnet, also bleibt es bei der gerechneten Verkaufsfläche.
    expect(wandleProjekt(alteFassung()).verkaufsflaechen).toEqual([]);
  });

  it('lässt vorhandene Flächen stehen', () => {
    const flaeche = {
      id: 'verkaufsflaeche-1',
      name: 'Vorkasse',
      umriss: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 400 },
      ],
      farbe: '#2f9e44',
      beschriftungSichtbar: true,
      gesperrt: false,
    };
    const neu = wandleProjekt(alteFassung({ verkaufsflaechen: [flaeche] }));
    expect(neu.verkaufsflaechen).toEqual([flaeche]);
  });
});

describe('neue Fassung', () => {
  it('lässt eine bereits aktuelle Planung unverändert', () => {
    const aktuell = {
      ...alteFassung(),
      version: SCHEMA_VERSION,
      grundflaeche: {
        umriss: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
        wandstaerke: 25,
      },
    };
    expect(wandleProjekt(aktuell)).toBe(aktuell);
  });

  it('wandelt nicht zweimal', () => {
    const einmal = wandleProjekt(alteFassung());
    const zweimal = wandleProjekt(einmal);
    expect(zweimal.grundflaeche.umriss).toEqual(einmal.grundflaeche.umriss);
  });
});

describe('Fassung 8: ein Grauton für das Trockensortiment', () => {
  const regal = (farbe: string, form = 'wt100') => ({
    id: 'el', vorlageId: 'v', ebeneId: 'einrichtung', name: 'R', kategorie: 'regale',
    x: 0, y: 0, breite: 125, tiefe: 67, drehung: 0, form, farbe,
    beschriftung: '', beschriftungSichtbar: true, schriftgroesse: 12,
    gesperrt: false, reihenfolge: 0, beidseitig: false,
  });

  it('färbt Wandregal und Gondel auf denselben Ton', () => {
    const neu = wandleProjekt(alteFassung({
      elemente: [regal('#c9c5bd'), regal('#b7b2a8'), regal('#d8d4cc')],
    }));
    expect([...new Set(neu.elemente.map((el) => el.farbe))]).toEqual(['#c9c5bd']);
  });

  it('lässt eine von Hand gesetzte Farbe stehen', () => {
    // Wer ein Regal eingefärbt hat, um eine Warengruppe hervorzuheben, darf
    // das nicht durchs Öffnen verlieren.
    const neu = wandleProjekt(alteFassung({ elemente: [regal('#ff0000')] }));
    expect(neu.elemente[0].farbe).toBe('#ff0000');
  });

  it('fasst nur das Trockensortiment an', () => {
    // Ein Kühlmöbel im selben Grau bleibt, wie es ist.
    const neu = wandleProjekt(alteFassung({ elemente: [regal('#b7b2a8', 'kuehlSchrank')] }));
    expect(neu.elemente[0].farbe).toBe('#b7b2a8');
  });
});

describe('Fassung 9: jede Gondelseite mit eigener Feldeinteilung', () => {
  const zug = (zusatz: Record<string, unknown> = {}) => ({
    id: 'el', vorlageId: 'wt-zug', ebeneId: 'einrichtung', name: 'Zug', kategorie: 'regale',
    x: 0, y: 0, breite: 500, tiefe: 127, drehung: 0, form: 'wt100', farbe: '#c9c5bd',
    beschriftung: '', beschriftungSichtbar: true, schriftgroesse: 12,
    gesperrt: false, reihenfolge: 0, beidseitig: true, achsmass: 100,
    ...zusatz,
  });

  const ersterZug = (zusatz: Record<string, unknown> = {}) =>
    wandleProjekt(alteFassung({ elemente: [zug(zusatz)] })).elemente[0];

  it('schreibt die vorhandene Einteilung auf beide Seiten', () => {
    // Am Bild darf sich nichts ändern: Wer die Planung öffnet, sieht denselben
    // Zug wie vorher, nur eben zweimal beschrieben.
    const el = ersterZug({ felder: [125, 100, 100] });
    expect(el.felderUnten?.map((f) => f.breite)).toEqual([125, 100, 100]);
    expect(el.felderOben?.map((f) => f.breite)).toEqual([125, 100, 100]);
  });

  it('erschließt die Felder aus dem Achsmaß, wenn keine gespeichert sind', () => {
    expect(ersterZug().felderUnten).toHaveLength(5);
  });

  it('gibt einem Wandregal keine Rückseite', () => {
    // Eine Seite, die es nicht gibt, wäre eine Liste, die nie jemand ansieht.
    expect(ersterZug({ beidseitig: false }).felderOben).toBeUndefined();
  });

  it('nimmt die Notizen ans Feld mit, je Seite getrennt', () => {
    const el = ersterZug({
      felder: [100, 100],
      feldnotizen: [{ unten: '5+' }, { oben: '4+', unten: '1K' }],
    });
    expect(el.felderUnten?.map((f) => f.notiz)).toEqual(['5+', '1K']);
    expect(el.felderOben?.map((f) => f.notiz)).toEqual([undefined, '4+']);
  });

  it('wandelt nicht zweimal', () => {
    // Sonst überschriebe der zweite Durchgang eine inzwischen von Hand
    // geänderte Seite mit der alten gemeinsamen Liste.
    const einmal = wandleProjekt(alteFassung({ elemente: [zug({ felder: [100, 100] })] }));
    const umgebaut = {
      ...einmal,
      version: 1,
      elemente: [{ ...einmal.elemente[0], felderOben: [{ breite: 250 }] }],
    };
    expect(wandleProjekt(umgebaut).elemente[0].felderOben).toEqual([{ breite: 250 }]);
  });
});

describe('Fassung 10: „Aktionsfläche" steht in der Fläche', () => {
  const flaeche = (zusatz: Record<string, unknown> = {}) => ({
    id: 'el', vorlageId: 'aktionsflaeche', ebeneId: 'einrichtung', name: 'Aktionsfläche 2 x 2 m',
    kategorie: 'aktion', x: 0, y: 0, breite: 200, tiefe: 200, drehung: 0, form: 'rechteck',
    farbe: '#ffff99', beschriftung: 'Aktionsfläche 2 x 2 m', beschriftungSichtbar: true,
    schriftgroesse: 12, gesperrt: false, reihenfolge: 0, beidseitig: false,
    ...zusatz,
  });

  const erstes = (zusatz: Record<string, unknown> = {}) =>
    wandleProjekt(alteFassung({ elemente: [flaeche(zusatz)] })).elemente[0];

  it('macht aus dem Rechteck eine Fläche', () => {
    // Fassung 12: Erst als eigene Grundform trägt sie ihre Quadratmeter und
    // ihre Kantenlängen und passt ihre Schrift der Größe an.
    expect(erstes().form).toBe('aktionsflaeche');
  });

  it('macht aus einem gewöhnlichen Rechteck keine Fläche', () => {
    expect(erstes({ vorlageId: 'display' }).form).toBe('rechteck');
  });

  it('kürzt den Vorlagennamen auf das eine Wort', () => {
    // „Aktionsfläche 2 x 2 m" wird in zwei Metern Breite abgeschnitten, und
    // die Maße stehen ohnehin am Element.
    expect(erstes().beschriftung).toBe('Aktionsfläche');
  });

  it('lässt eine selbst geschriebene Beschriftung stehen', () => {
    // Wer seine Fläche „Ostern" genannt hat, behält das.
    expect(erstes({ beschriftung: 'Ostern' }).beschriftung).toBe('Ostern');
  });

  it('macht eine leere Beschriftung sichtbar', () => {
    const neu = erstes({ beschriftung: '', beschriftungSichtbar: false });
    expect(neu.beschriftung).toBe('Aktionsfläche');
    expect(neu.beschriftungSichtbar).toBe(true);
  });

  it('lässt eine ausgeblendete Beschriftung ausgeblendet', () => {
    // Ausgeblendet hat sie jemand von Hand – das bleibt so.
    expect(erstes({ beschriftungSichtbar: false }).beschriftungSichtbar).toBe(false);
  });

  it('nennt die Saisonfläche beim eigenen Namen', () => {
    const neu = erstes({ vorlageId: 'saisonflaeche', beschriftung: 'Saisonfläche' });
    expect(neu.beschriftung).toBe('Saisonfläche');
  });

  it('fasst andere Möbel nicht an', () => {
    expect(erstes({ vorlageId: 'palette-epal-quer', beschriftung: 'EPAL quer · 1,20 x 0,80 m' })
      .beschriftung).toBe('EPAL quer · 1,20 x 0,80 m');
  });
});

describe('Fassung 11: Kopfgondeln schauen in den Gang', () => {
  const zug = {
    id: 'zug', vorlageId: 'wt-zug', ebeneId: 'einrichtung', name: 'Zug', kategorie: 'regale',
    x: 1000, y: 1000, breite: 600, tiefe: 127, hoehe: 180, drehung: 0, form: 'wt100',
    farbe: '#c9c5bd', beschriftung: '', beschriftungSichtbar: false, schriftgroesse: 12,
    gesperrt: false, reihenfolge: 0, beidseitig: true, achsmass: 100,
    kopfgondeln: { ende: 'kopf' },
  };

  /** Ein Kopf, wie ihn die alte Rechnung hingestellt hat: Front zum Zug. */
  const kopf = {
    id: 'kopf', vorlageId: 'wt-kopf', ebeneId: 'einrichtung', name: 'Kopfgondel A1250',
    kategorie: 'regale', x: 1333.5, y: 1000, breite: 125, tiefe: 67, hoehe: 180,
    drehung: 90, form: 'wt100', farbe: '#c9c5bd', beschriftung: '',
    beschriftungSichtbar: false, schriftgroesse: 12, gesperrt: false, reihenfolge: 1,
    beidseitig: false, achsmass: 125, kopfVon: 'zug',
  };

  it('dreht einen verdrehten Kopf beim Öffnen um', () => {
    // Sonst behielte ein Plan, der nur geöffnet wird, seine verdrehten Köpfe
    // für immer: Nachgerichtet wurden sie erst beim Verschieben des Zugs.
    const neu = wandleProjekt(alteFassung({ elemente: [zug, kopf] }));
    expect(neu.elemente.find((el) => el.id === 'kopf')!.drehung).toBe(270);
  });

  it('lässt seine Stelle unverändert', () => {
    // Gedreht wird er, verschoben nicht – er steht ja am richtigen Ende.
    const neu = wandleProjekt(alteFassung({ elemente: [zug, kopf] }));
    const gedreht = neu.elemente.find((el) => el.id === 'kopf')!;
    expect(gedreht.x).toBeCloseTo(kopf.x, 2);
    expect(gedreht.y).toBeCloseTo(kopf.y, 2);
  });

  it('fasst eine von Hand gesetzte Kopfgondel nicht an', () => {
    // Ohne `kopfVon` gehört sie niemandem – dort hat der Nutzer gedreht.
    const frei = { ...kopf, id: 'frei', kopfVon: undefined };
    const neu = wandleProjekt(alteFassung({ elemente: [{ ...zug, kopfgondeln: {} }, frei] }));
    expect(neu.elemente.find((el) => el.id === 'frei')!.drehung).toBe(90);
  });
});
