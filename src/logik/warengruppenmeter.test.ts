import { describe, expect, it } from 'vitest';
import {
  metersumme,
  namenImPlan,
  OHNE_WARENGRUPPE,
  strecken,
  unbeschriftet,
  warengruppenmeter,
  type Streckenmeter,
} from './warengruppenmeter';
import { berechneRegalmeter } from './flaechen';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Die Meter je Warengruppe.
 *
 * Das Entscheidende ist nicht, dass gerechnet wird, sondern **woran**: an den
 * Strecken, die im Plan eingezeichnet sind, und nicht am Warengruppenfeld des
 * ganzen Möbels. Ein Zug trägt fünf Sortimente nebeneinander, und die Grenzen
 * laufen mitten durch die Felder.
 */

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'v1',
    ebeneId: 'einrichtung',
    name: 'Wandregal',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 250,
    tiefe: 60,
    drehung: 0,
    form: 'wt100',
    farbe: '#888',
    achsmass: 125,
    beschriftung: '',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
    felderUnten: [{ breite: 125 }, { breite: 125 }],
    ...teil,
  } as PlanElement;
}

function projekt(elemente: PlanElement[], ebenen?: Projekt['ebenen']): Projekt {
  return {
    id: 'p1',
    name: 'Testmarkt',
    version: 19,
    erstelltAm: 0,
    geaendertAm: 0,
    grundflaeche: { umriss: [], wandstaerke: 30 },
    einstellungen: { anzeigeEinheit: 'm' },
    ebenen: ebenen ?? [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
    raeume: [],
    verkaufsflaechen: [],
    waende: [],
    oeffnungen: [],
    elemente,
    gruppen: [],
    masslinien: [],
  } as unknown as Projekt;
}

describe('Strecken einsammeln', () => {
  it('nimmt jede beschriftete Strecke, nicht das Möbel', () => {
    const el = element({
      warengruppenUnten: [
        { von: 0, bis: 150, text: 'Kaffee' },
        { von: 150, bis: 250, text: 'Tee' },
      ],
    });
    expect(strecken(projekt([el])).map((s) => [s.name, s.laenge])).toEqual([
      ['Kaffee', 150],
      ['Tee', 100],
    ]);
  });

  it('lässt namenlose Abschnitte weg', () => {
    // Im Modell sind sie ein Zwischenzustand beim Tippen.
    const el = element({
      warengruppenUnten: [
        { von: 0, bis: 100, text: '  ' },
        { von: 100, bis: 250, text: 'Kaffee' },
      ],
    });
    expect(strecken(projekt([el]))).toHaveLength(1);
  });

  it('beschneidet Abschnitte auf die Feldkette der Seite', () => {
    // Wer die Breite von Hand eintippt, kann Abschnitte hinterlassen, die
    // über das Möbel hinausragen. Sie dürfen nicht mitzählen.
    const el = element({
      breite: 400,
      felderUnten: [{ breite: 125 }, { breite: 125 }],
      warengruppenUnten: [{ von: 0, bis: 400, text: 'Kaffee' }],
    });
    expect(strecken(projekt([el]))[0].laenge).toBe(250);
  });

  it('zählt beide Seiten einer Gondel einzeln', () => {
    // Verdoppelt wird nirgends – das Doppelte entsteht dadurch, dass beide
    // Seiten beschriftet sind.
    const gondel = element({
      beidseitig: true,
      tiefe: 120,
      felderUnten: [{ breite: 125 }, { breite: 125 }],
      felderOben: [{ breite: 125 }, { breite: 125 }],
      warengruppenUnten: [{ von: 0, bis: 250, text: 'Nudeln' }],
      warengruppenOben: [{ von: 0, bis: 250, text: 'Konserven' }],
    });
    const s = strecken(projekt([gondel]));
    expect(s).toHaveLength(2);
    expect(s.map((x) => x.seite).sort()).toEqual(['oben', 'unten']);
  });

  it('zählt bei einer Gondel mit nur einer beschrifteten Seite auch nur eine', () => {
    const gondel = element({
      beidseitig: true,
      felderUnten: [{ breite: 125 }, { breite: 125 }],
      felderOben: [{ breite: 125 }, { breite: 125 }],
      warengruppenUnten: [{ von: 0, bis: 250, text: 'Nudeln' }],
    });
    const zeilen = warengruppenmeter(projekt([gondel]));
    expect(zeilen.find((z) => z.name === 'Nudeln')?.laufend).toBe(2.5);
    // Die andere Seite steht trotzdem im Markt – als unbeschriftete Meter.
    expect(zeilen.find((z) => z.name === OHNE_WARENGRUPPE)?.laufend).toBe(2.5);
  });

  it('übergeht Möbel auf ausgeblendeten Ebenen', () => {
    const el = element({
      ebeneId: 'versteckt',
      warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }],
    });
    const p = projekt(
      [el],
      [
        { id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false },
        { id: 'versteckt', name: 'Aus', sichtbar: false, gesperrt: false },
      ],
    );
    expect(strecken(p)).toEqual([]);
    expect(warengruppenmeter(p)).toEqual([]);
  });
});

describe('Unbeschriftete Meter', () => {
  it('meldet, was zwischen den Abschnitten frei bleibt', () => {
    const el = element({ warengruppenUnten: [{ von: 0, bis: 100, text: 'Kaffee' }] });
    expect(unbeschriftet(el)).toBe(150);
  });

  it('meldet ein Möbel ohne jede Beschriftung ganz', () => {
    expect(unbeschriftet(element({}))).toBe(250);
  });

  it('meldet nichts, wenn alles belegt ist', () => {
    const el = element({ warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }] });
    expect(unbeschriftet(el)).toBe(0);
  });
});

describe('Zeilen der Auswertung', () => {
  it('fasst gleiche Namen über mehrere Möbel zusammen', () => {
    const a = element({ id: 'a', warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }] });
    const b = element({ id: 'b', warengruppenUnten: [{ von: 0, bis: 125, text: 'Kaffee' }] });
    const zeilen = warengruppenmeter(projekt([a, b]));
    const kaffee = zeilen.find((z) => z.name === 'Kaffee')!;
    expect(kaffee.laufend).toBe(3.75);
    expect(kaffee.strecken).toBe(2);
  });

  it('stellt die längste Warengruppe nach oben, die namenlosen nach unten', () => {
    const a = element({ id: 'a', warengruppenUnten: [{ von: 0, bis: 100, text: 'Tee' }] });
    const b = element({ id: 'b', warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }] });
    expect(warengruppenmeter(projekt([a, b])).map((z) => z.name)).toEqual([
      'Kaffee',
      'Tee',
      OHNE_WARENGRUPPE,
    ]);
  });

  it('rechnet tatsächliche Meter aus den Auslagen', () => {
    // Ein Meter Regal mit fünf Böden sind fünf tatsächliche Meter.
    const el = element({ warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }] });
    const zeilen = warengruppenmeter(projekt([el]), { auslagen: fest(5) });
    const kaffee = zeilen.find((z) => z.name === 'Kaffee')!;
    expect(kaffee.laufend).toBe(2.5);
    expect(kaffee.tatsaechlich).toBe(12.5);
    expect(kaffee.ohneAuslagen).toBe(0);
  });

  it('lässt die Spalte leer, wo die Auslagenzahl fehlt – statt null zu behaupten', () => {
    const el = element({ warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }] });
    const zeilen = warengruppenmeter(projekt([el]), { auslagen: () => undefined });
    const kaffee = zeilen.find((z) => z.name === 'Kaffee')!;
    expect(kaffee.tatsaechlich).toBeUndefined();
    expect(kaffee.ohneAuslagen).toBe(2.5);
  });

  it('sagt, auf wie vielen Metern die Auslagenzahl fehlt', () => {
    // Die Zeile ist dann unvollständig, und man muss es sehen.
    const gut = element({ id: 'a', warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }] });
    const offen = element({ id: 'b', warengruppenUnten: [{ von: 0, bis: 125, text: 'Kaffee' }] });
    const zeilen = warengruppenmeter(projekt([gut, offen]), {
      auslagen: (s) => (s.element.id === 'a' ? fest(4)(s) : undefined),
    });
    const kaffee = zeilen.find((z) => z.name === 'Kaffee')!;
    expect(kaffee.laufend).toBe(3.75);
    expect(kaffee.tatsaechlich).toBe(10);
    expect(kaffee.ohneAuslagen).toBe(1.25);
  });
});

describe('Zuordnung einer Warengruppe zu einer anderen', () => {
  it('bucht die Meter auf das Ziel', () => {
    // Wer vier Meter „Kuchen" einzeichnet, obwohl dort auch Waffeln liegen,
    // ordnet Waffeln dem Kuchen zu – dann fehlt in der Liste nichts.
    const el = element({
      breite: 400,
      felderUnten: [{ breite: 400 }],
      warengruppenUnten: [{ von: 0, bis: 400, text: 'Waffeln' }],
    });
    const zeilen = warengruppenmeter(projekt([el]), {
      zugeordnetZu: (name) => (name === 'Waffeln' ? 'Kuchen' : undefined),
    });
    expect(zeilen.find((z) => z.name === 'Kuchen')?.laufend).toBe(4);
    expect(zeilen.find((z) => z.name === 'Waffeln')).toBeUndefined();
  });

  it('zählt Zugeordnetes und Eigenes zusammen', () => {
    const a = element({
      id: 'a',
      felderUnten: [{ breite: 300 }],
      warengruppenUnten: [{ von: 0, bis: 300, text: 'Kuchen' }],
    });
    const b = element({
      id: 'b',
      felderUnten: [{ breite: 100 }],
      warengruppenUnten: [{ von: 0, bis: 100, text: 'Waffeln' }],
    });
    const zeilen = warengruppenmeter(projekt([a, b]), {
      zugeordnetZu: (name) => (name === 'Waffeln' ? 'Kuchen' : undefined),
    });
    expect(zeilen.find((z) => z.name === 'Kuchen')?.laufend).toBe(4);
  });

  it('folgt keiner Kette', () => {
    // Eine Zuordnung ist eine Aussage über zwei Namen, keine Vererbung.
    // Sonst liefe eine versehentliche Ringzuordnung endlos.
    const el = element({
      felderUnten: [{ breite: 100 }],
      warengruppenUnten: [{ von: 0, bis: 100, text: 'A' }],
    });
    const zeilen = warengruppenmeter(projekt([el]), {
      zugeordnetZu: (name) => ({ A: 'B', B: 'C' })[name],
    });
    expect(zeilen.map((z) => z.name)).toContain('B');
    expect(zeilen.map((z) => z.name)).not.toContain('C');
  });
});

/** Eine feste Auslagenzahl für die ganze Strecke – nur zum Prüfen. */
function fest(zahl: number) {
  return (s: Streckenmeter) => ({ tatsaechlich: s.laenge * zahl, ohne: 0 });
}

describe('Summen', () => {
  it('zählt zusammen, was in der Tabelle steht', () => {
    const a = element({ id: 'a', warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }] });
    const b = element({ id: 'b', warengruppenUnten: [{ von: 0, bis: 125, text: 'Tee' }] });
    const zeilen = warengruppenmeter(projekt([a, b]), { auslagen: fest(4) });
    const summe = metersumme(zeilen);
    // 2,50 + 1,25 beschriftet, dazu 1,25 unbeschriftet auf dem zweiten Möbel.
    expect(summe.laufend).toBe(5);
    expect(summe.ohneWarengruppe).toBe(1.25);
    expect(summe.tatsaechlich).toBe(15);
  });

  it('lässt weg, was gar keine Ware trägt', () => {
    // Eine Säule ist 40 cm breit, eine Kundenführung zwei Meter lang.
    // Zählte man sie mit, stünden sie unter „ohne Warengruppe" und sähen aus
    // wie vergessene Regalmeter.
    const regal = element({ id: 'a', warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }] });
    const saeule = element({ id: 'b', kategorie: 'ausstattung', form: 'saeule', breite: 40 });
    const fuehrung = element({ id: 'c', kategorie: 'kassen', form: 'kundenfuehrung', breite: 200 });
    const summe = metersumme(warengruppenmeter(projekt([regal, saeule, fuehrung])));
    expect(summe.laufend).toBe(2.5);
    expect(summe.ohneWarengruppe).toBe(0);
  });

  it('misst eine Aktionsfläche nicht in Metern', () => {
    // Sie zählt in Palettenplätzen. Ihre Breite hängt daran, wie herum man
    // sie gezogen hat – als laufende Meter wäre sie eine Zufallszahl.
    const flaeche = element({
      id: 'a',
      kategorie: 'aktion',
      form: 'aktionsflaeche',
      breite: 300,
      felderUnten: [{ breite: 300 }],
    });
    expect(metersumme(warengruppenmeter(projekt([flaeche]))).laufend).toBe(0);
  });

  it('lässt die Kassengondel aber mitzählen', () => {
    // Auf der liegt Ware, und genau darum geht es.
    const gondel = element({
      id: 'a',
      kategorie: 'kassen',
      form: 'kassengondel',
      breite: 100,
      felderUnten: [{ breite: 100 }],
      warengruppenUnten: [{ von: 0, bis: 100, text: 'Süßwaren' }],
    });
    expect(metersumme(warengruppenmeter(projekt([gondel]))).laufend).toBe(1);
  });

  it('stimmt mit den laufenden Metern des ganzen Marktes überein', () => {
    // Die Probe aufs Exempel: Die Summe der Tabelle – beschriftet plus
    // unbeschriftet – muss die Regalmeter ergeben, die heute schon
    // ausgewiesen werden. Sonst misst die neue Rechnung etwas anderes,
    // ohne dass jemand sähe was.
    const a = element({
      id: 'a',
      warengruppenUnten: [{ von: 0, bis: 150, text: 'Kaffee' }],
    });
    const gondel = element({
      id: 'b',
      beidseitig: true,
      tiefe: 120,
      felderUnten: [{ breite: 125 }, { breite: 125 }],
      felderOben: [{ breite: 125 }, { breite: 125 }],
      warengruppenUnten: [{ von: 0, bis: 250, text: 'Nudeln' }],
    });
    const p = projekt([a, gondel]);
    const summe = metersumme(warengruppenmeter(p));
    expect(summe.laufend).toBeCloseTo(berechneRegalmeter(p), 2);
  });
});

describe('Namen im Plan', () => {
  it('nennt jeden vorkommenden Namen genau einmal', () => {
    const a = element({ id: 'a', warengruppenUnten: [{ von: 0, bis: 125, text: 'Kaffee' }] });
    const b = element({ id: 'b', warengruppenUnten: [{ von: 0, bis: 125, text: 'Kaffee' }] });
    expect([...namenImPlan(projekt([a, b]))]).toEqual(['Kaffee']);
  });
});
