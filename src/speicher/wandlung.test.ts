import { describe, expect, it } from 'vitest';
import { WT_GRAU } from '../daten/bibliothek';
import { feldzeilen, notizZeilen } from '../logik/feldnotiz';
import { flaeche, rahmen } from '../logik/polygon';
import { STANDARD_EBENEN } from '../daten/standardProjekt';
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
    // Fassung 16 nimmt Räumen die eigene Wand – siehe unten.
    expect(raum.wandstaerke).toBe(0);
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
  it('rührt an einer bereits aktuellen Planung nichts an', () => {
    const aktuell = {
      ...alteFassung(),
      version: SCHEMA_VERSION,
      ebenen: STANDARD_EBENEN.map((e) => ({ ...e })),
      grundflaeche: {
        umriss: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
        wandstaerke: 25,
      },
    };
    // Inhaltlich gleich, nicht dasselbe Objekt: Der Satz Ebenen wird auch
    // hier durchgesehen, damit eine Datei mit erfundenen Kennungen nicht
    // die halbe Planung unsichtbar macht.
    const gewandelt = wandleProjekt(aktuell);
    for (const [schluessel, wert] of Object.entries(aktuell)) {
      expect(gewandelt[schluessel as keyof typeof gewandelt], schluessel).toEqual(wert);
    }
    // Was die Datei nicht mitbrachte, wird als leere Liste ergänzt statt
    // wegzulassen: Eine fehlende Liste wirft beim ersten `.map`, und zwar
    // irgendwo tief in der Anwendung statt hier beim Öffnen.
    for (const liste of ['waende', 'oeffnungen', 'gruppen', 'masslinien', 'verkaufsflaechen']) {
      expect(Array.isArray(gewandelt[liste as keyof typeof gewandelt]), liste).toBe(true);
    }
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
    // Gegen WT_GRAU geprüft und nicht gegen einen Hexwert: Sonst bricht die
    // Prüfung jedes Mal, wenn sich der Ton ändert – und sagt dabei nichts
    // über das, was sie eigentlich sichert.
    const neu = wandleProjekt(alteFassung({
      elemente: [regal('#c9c5bd'), regal('#b7b2a8'), regal('#d8d4cc')],
    }));
    expect([...new Set(neu.elemente.map((el) => el.farbe))]).toEqual([WT_GRAU]);
  });

  it('nimmt das freie Regal und die freie Gondel mit', () => {
    // Sie hatten ihr eigenes Beige. Im Plan tragen sie dieselbe Ware wie der
    // Systemzug daneben und sollen nicht anders aussehen.
    const neu = wandleProjekt(alteFassung({
      elemente: [regal('#d9d0c1', 'regal'), regal('#cfc3ad', 'regal')],
    }));
    expect(neu.elemente.map((el) => el.farbe)).toEqual([WT_GRAU, WT_GRAU]);
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
    // Die reinen Bodenzahlen zieht Fassung 19 weiter in `boeden` – im Feld
    // steht danach dasselbe, nur nicht mehr als Text.
    expect(el.felderUnten?.map((f) => f.boeden)).toEqual([5, undefined]);
    expect(el.felderUnten?.map((f) => f.notiz)).toEqual([undefined, '1K']);
    expect(el.felderOben?.map((f) => f.boeden)).toEqual([undefined, 4]);
    expect(el.felderOben?.map((f) => f.notiz)).toEqual([undefined, undefined]);
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

describe('Räume ohne eigene Wand', () => {
  /**
   * Ein abgetrennter Raum brachte eine eigene Wandstärke mit und zeichnete
   * damit eine zweite Wand neben die selbst gezogene – im Plan nicht zu
   * unterscheiden, in der Rechnung doppelt.
   */
  it('nimmt vorhandenen Räumen die Wandstärke', () => {
    const alt = {
      ...alteFassung(),
      raeume: [
        { id: 'r1', name: 'Lager', umriss: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 400 }], art: 'lager', wandstaerke: 15, farbe: '#eee', beschriftungSichtbar: true, gesperrt: false },
        { id: 'r2', name: 'WC', umriss: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }], art: 'sozial', wandstaerke: 24, farbe: '#eee', beschriftungSichtbar: true, gesperrt: false },
      ],
    };
    const neu = wandleProjekt(alt);
    expect(neu.raeume.map((r) => r.wandstaerke)).toEqual([0, 0]);
    // Alles andere bleibt, wie es war.
    expect(neu.raeume.map((r) => r.name)).toEqual(['Lager', 'WC']);
  });
});

describe('Ebenen vervollständigen', () => {
  /**
   * Eine Datei mit erfundenen Ebenen macht die halbe Planung unsichtbar.
   *
   * Gezeichnet wird nur, was auf einer bekannten Ebene liegt: Wände auf
   * `gebaeude`, Räume auf `raeume`, Regale auf `einrichtung`. Bringt eine
   * Datei stattdessen eigene Kennungen mit, ist die Fläche leer und niemand
   * sieht, woran es liegt – die Ebenenliste steht in keinem Fehlertext.
   *
   * Das ist genau passiert: Ein Werkzeug erfand `ebene-grund` und
   * `ebene-moebel`, und weil die Datei die aktuelle Fassung trug, lief die
   * Umwandlung gar nicht erst an, die es sonst richtiggestellt hätte.
   */
  const mitEbenen = (ebenen: unknown) => ({
    ...alteFassung(),
    version: SCHEMA_VERSION,
    ebenen,
  });

  it('ergänzt fehlende Ebenen auch in einer aktuellen Datei', () => {
    const neu = wandleProjekt(
      mitEbenen([{ id: 'ebene-grund', name: 'Grundriss', sichtbar: true, gesperrt: false }]),
    );
    const ids = neu.ebenen.map((e) => e.id);
    for (const noetig of ['gebaeude', 'raeume', 'verkaufsflaeche', 'einrichtung']) {
      expect(ids).toContain(noetig);
    }
  });

  it('behält eigene Ebenen und ihre Einstellungen', () => {
    const neu = wandleProjekt(
      mitEbenen([
        { id: 'eigene', name: 'Meine Ebene', sichtbar: false, gesperrt: false },
        { id: 'raeume', name: 'Räume', sichtbar: false, gesperrt: true },
      ]),
    );
    expect(neu.ebenen.find((e) => e.id === 'eigene')?.name).toBe('Meine Ebene');
    // Wer eine Ebene bewusst ausgeblendet hat, will sie nicht zurück.
    const raeume = neu.ebenen.find((e) => e.id === 'raeume');
    expect(raeume?.sichtbar).toBe(false);
    expect(raeume?.gesperrt).toBe(true);
  });

  it('verträgt eine Datei ganz ohne Ebenen', () => {
    const neu = wandleProjekt(mitEbenen(undefined));
    expect(neu.ebenen.map((e) => e.id)).toContain('einrichtung');
  });
});

describe('Fassung 17 · Bezeichnungen nachziehen', () => {
  /** Ein Möbel, wie es eine Planung der Fassung 16 abgelegt hat. */
  function moebel(zusatz: Record<string, unknown>) {
    return {
      id: 'el1',
      vorlageId: 'wt100',
      ebeneId: 'einrichtung',
      name: 'Wandregal A1000 · T700 · H2200',
      beschriftung: 'Wandregal A1000 · T700 · H2200',
      kategorie: 'regale',
      form: 'wt100',
      x: 500,
      y: 500,
      breite: 675,
      tiefe: 70,
      hoehe: 220,
      drehung: 0,
      farbe: WT_GRAU,
      gesperrt: false,
      reihenfolge: 1,
      beschriftungSichtbar: true,
      schriftgroesse: 12,
      ...zusatz,
    };
  }

  /** Eine Planung, die schon auf Fassung 16 war – nur die Namen sind alt. */
  const planungMit = (elemente: unknown[]) =>
    alteFassung({ version: 16, waende: [], oeffnungen: [], elemente });

  it('nennt einen umgebauten Zug so, wie er wirklich gebaut ist', () => {
    const neu = wandleProjekt(
      planungMit([
        moebel({
          felderUnten: [100, 100, 100, 125, 125, 125].map((breite) => ({ breite })),
        }),
      ]),
    );
    expect(neu.elemente[0].beschriftung).toBe('Wandregal 3× A1000 · 3× A1250 · T700 · H2200');
  });

  it('zieht auch die Kühlung nach, nicht nur das Trockensortiment', () => {
    const neu = wandleProjekt(
      planungMit([
        moebel({
          form: 'kuehlOffen',
          kategorie: 'kuehlung',
          name: 'Kühlregal 2,50 m · offen',
          beschriftung: 'Kühlregal 2,50 m · offen',
          breite: 500,
          tiefe: 112.5,
          hoehe: 209,
          felderUnten: [{ breite: 250 }, { breite: 250 }],
        }),
      ]),
    );
    expect(neu.elemente[0].beschriftung).toBe('Kühlregal 2× 2,50 m · offen');
  });

  it('lässt einen selbst geschriebenen Namen stehen', () => {
    const neu = wandleProjekt(
      planungMit([
        moebel({
          beschriftung: 'Kaffee und Tee',
          felderUnten: [{ breite: 125 }, { breite: 125 }],
        }),
      ]),
    );
    expect(neu.elemente[0].beschriftung).toBe('Kaffee und Tee');
  });

  it('fasst eine Kasse nicht an', () => {
    const neu = wandleProjekt(
      planungMit([
        moebel({
          form: 'kasse',
          kategorie: 'kassen',
          name: 'Einzelstehkasse · Band 1500 mm',
          beschriftung: 'Einzelstehkasse · Band 1500 mm',
          breite: 120,
        }),
      ]),
    );
    expect(neu.elemente[0].beschriftung).toBe('Einzelstehkasse · Band 1500 mm');
  });
});

describe('Fassung 18 · Aus der Palette wird der Unterbau', () => {
  const mitFeldern = (felder: unknown[]) =>
    alteFassung({
      version: 17,
      waende: [],
      oeffnungen: [],
      elemente: [
        {
          id: 'el1',
          vorlageId: 'wt100',
          ebeneId: 'einrichtung',
          name: 'Wandregal',
          beschriftung: 'Wandregal',
          kategorie: 'regale',
          form: 'wt100',
          x: 500,
          y: 500,
          breite: 250,
          tiefe: 70,
          hoehe: 220,
          drehung: 0,
          farbe: WT_GRAU,
          gesperrt: false,
          reihenfolge: 1,
          beschriftungSichtbar: true,
          schriftgroesse: 12,
          felderUnten: felder,
        },
      ],
    });

  it('nimmt die Palette mit unter ihren neuen Namen', () => {
    const neu = wandleProjekt(
      mitFeldern([{ breite: 125, palette: { art: 'euro', laengs: false } }, { breite: 125 }]),
    );
    const felder = neu.elemente[0].felderUnten!;
    expect(felder[0].unterbau).toEqual({ art: 'euro', laengs: false });
    expect((felder[0] as { palette?: unknown }).palette).toBeUndefined();
    // Und ein Feld ohne Palette bleibt eines ohne Unterbau.
    expect(felder[1].unterbau).toBeUndefined();
  });

  it('lässt ein Möbel ohne Paletten in Ruhe', () => {
    const neu = wandleProjekt(mitFeldern([{ breite: 125 }, { breite: 125 }]));
    expect(neu.elemente[0].felderUnten).toHaveLength(2);
    expect(neu.elemente[0].felderUnten!.every((f) => !f.unterbau)).toBe(true);
  });
});

describe('Fassung 19 · Aus „5+" in der Notiz wird eine Zahl', () => {
  const mitNotizen = (...notizen: (string | undefined)[]) =>
    alteFassung({
      version: 18,
      waende: [],
      oeffnungen: [],
      elemente: [
        {
          id: 'el1',
          vorlageId: 'wt100',
          ebeneId: 'einrichtung',
          name: 'Wandregal',
          beschriftung: 'Wandregal',
          kategorie: 'regale',
          form: 'wt100',
          x: 500,
          y: 500,
          breite: 100 * notizen.length,
          tiefe: 70,
          hoehe: 220,
          drehung: 0,
          farbe: WT_GRAU,
          gesperrt: false,
          reihenfolge: 1,
          beschriftungSichtbar: true,
          schriftgroesse: 12,
          felderUnten: notizen.map((notiz) => ({ breite: 100, notiz })),
        },
      ],
    });

  const felder = (...notizen: (string | undefined)[]) =>
    wandleProjekt(mitNotizen(...notizen)).elemente[0].felderUnten!;

  it('nimmt die Zahl heraus und lässt den Rest stehen', () => {
    const [feld] = felder('5+\n1K');
    expect(feld.boeden).toBe(5);
    expect(feld.notiz).toBe('1K');
  });

  it('versteht die Zahl auch ohne Pluszeichen und zweistellig', () => {
    expect(felder('5')[0].boeden).toBe(5);
    expect(felder('10+')[0].boeden).toBe(10);
  });

  it('räumt die Notiz ganz weg, wenn nur die Zahl darin stand', () => {
    const [feld] = felder('6+');
    expect(feld.boeden).toBe(6);
    // Ein leerer Text wäre eine Notiz, die es nicht gibt – die Eingabe zeigte
    // dann einen Cursor in einem Feld, in dem nichts steht.
    expect(feld.notiz).toBeUndefined();
  });

  it('lässt alles stehen, was mehr als eine Zahl ist', () => {
    // „5+/6+" meint zwei Seiten, „5+ 1K" meint Böden und Körbe in einer
    // Zeile. Wer daraus eine Zahl machte, entschiede an Stelle des Planers.
    for (const text of ['5+/6+', '5+ 1K', '1K', 'Aktion', '5+ ?']) {
      const [feld] = felder(text);
      expect(feld.boeden, text).toBeUndefined();
      expect(feld.notiz, text).toBe(text);
    }
  });

  it('greift nur in die erste Zeile', () => {
    const [feld] = felder('1K\n5+');
    expect(feld.boeden).toBeUndefined();
    expect(feld.notiz).toBe('1K\n5+');
  });

  it('wandelt nicht zweimal', () => {
    // Sonst äße der zweite Durchgang die erste echte Notizzeile mit auf.
    const einmal = wandleProjekt(mitNotizen('5+\n1K'));
    const zweimal = wandleProjekt(einmal as unknown as Record<string, unknown>);
    const feld = zweimal.elemente[0].felderUnten![0];
    expect(feld.boeden).toBe(5);
    expect(feld.notiz).toBe('1K');
  });

  it('zeichnet danach dieselben Zeilen wie vorher', () => {
    // Die eigentliche Zusage: Am Bild ändert sich nichts. Was vorher die
    // erste Textzeile war, setzt `feldzeilen` aus der Zahl wieder davor.
    for (const text of ['5+\n1K', '10+', '1K\nAktion', '5+/6+']) {
      const vorher = notizZeilen(text);
      const nachher = feldzeilen(felder(text)[0]);
      expect(nachher, text).toEqual(vorher);
    }
  });
});

describe('Die Ebene „Laufwege" fällt weg', () => {
  it('nimmt sie aus einer vorhandenen Planung heraus', () => {
    // Sie stand in jedem Projekt, ohne dass ein Werkzeug darauf zeichnen
    // konnte – eine Zeile in der Liste, die nichts konnte.
    const neu = wandleProjekt(
      alteFassung({
        version: 18,
        ebenen: [
          { id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false },
          { id: 'laufwege', name: 'Laufwege', sichtbar: true, gesperrt: false },
        ],
      }),
    );
    expect(neu.ebenen.map((e) => e.id)).not.toContain('laufwege');
  });

  it('lässt eine selbst angelegte Ebene stehen', () => {
    const neu = wandleProjekt(
      alteFassung({
        version: 18,
        ebenen: [{ id: 'eigene-laufwege', name: 'Laufwege', sichtbar: true, gesperrt: false }],
      }),
    );
    expect(neu.ebenen.map((e) => e.id)).toContain('eigene-laufwege');
  });
});
