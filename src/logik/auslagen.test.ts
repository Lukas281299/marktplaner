import { describe, expect, it } from 'vitest';
import {
  auslagenAnteil,
  feldauslagen,
  moebelauslagen,
  TK_FACH,
  TK_TOTZONE,
  TRUHE_AUSLAGEN,
} from './auslagen';
import type { PlanElement, Regalfeld } from '../typen/modell';
import type { Streckenmeter as Strecke } from './warengruppenmeter';

/**
 * Prüfungen für die Auslagen je laufendem Meter.
 *
 * Die Zahl, mit der aus laufenden Metern tatsächliche werden. Was hier
 * danebengeht, geht in jeder Zeile der Auswertung daneben – und zwar so,
 * dass es plausibel aussieht.
 */

function element(zusatz: Partial<PlanElement> = {}): PlanElement {
  return {
    id: 'el1',
    vorlageId: 'wt100',
    ebeneId: 'einrichtung',
    name: 'Zug',
    beschriftung: 'Zug',
    kategorie: 'regale',
    form: 'wt100',
    x: 0,
    y: 0,
    breite: 250,
    tiefe: 70,
    hoehe: 220,
    drehung: 0,
    farbe: '#cccccc',
    gesperrt: false,
    reihenfolge: 1,
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    ...zusatz,
  } as PlanElement;
}

function strecke(el: PlanElement, von: number, bis: number): Strecke {
  return { name: 'Kaffee', laenge: bis - von, element: el, seite: 'unten', von, bis };
}

describe('Die Zahl am Feld', () => {
  it('nimmt die Böden, wie sie eingetragen sind', () => {
    expect(feldauslagen({ breite: 125, boeden: 5 })).toBe(5);
  });

  it('zählt den Unterbau als eine weitere Auslage', () => {
    // Egal was unten drunter steht – es trägt Ware, also ist es eine Auslage.
    expect(feldauslagen({ breite: 125, boeden: 5, unterbau: { art: 'euro' } })).toBe(6);
    expect(feldauslagen({ breite: 125, boeden: 0, unterbau: { art: 'euro' } })).toBe(1);
  });

  it('lässt ein leeres Feld bei null', () => {
    // Die Säule steht, aber es hängt nichts darin. Das ist keine fehlende
    // Angabe, sondern eine bekannte Null.
    expect(feldauslagen({ breite: 125, leer: true, boeden: 5 })).toBe(0);
  });

  it('sagt nichts, wo nichts steht', () => {
    expect(feldauslagen({ breite: 125 })).toBeUndefined();
  });

  it('greift auf die Vorgabe des Möbels zurück', () => {
    expect(feldauslagen({ breite: 125 }, 4)).toBe(4);
    // Die Zahl am Feld geht der Vorgabe vor – der Katalog kennt die Bauart,
    // aber nicht den Markt.
    expect(feldauslagen({ breite: 125, boeden: 3 }, 4)).toBe(3);
  });
});

describe('Was ein Möbel mitbringt', () => {
  it('rechnet die Truhe aus Auslage und toter Zone', () => {
    // 85 cm am Stück, gegen ein Schrankfach von 30,6 cm minus 4 cm Totzone.
    expect(TK_FACH).toBeCloseTo(30.6, 5);
    expect(TRUHE_AUSLAGEN).toBe(3.2);
    expect(85 / (TK_FACH - TK_TOTZONE)).toBeCloseTo(3.195, 2);
    expect(moebelauslagen(element({ form: 'tkTruhe', kategorie: 'tiefkuehlung' }))).toBe(3.2);
  });

  it('gibt der beidseitigen Truhe das Doppelte – über die zweite Seite', () => {
    // Verdoppelt wird nicht hier, sondern dadurch, dass die Auswertung beide
    // Seiten einzeln durchläuft. Sonst zählte eine Insel vierfach.
    const el = element({ form: 'tkTruhe', kategorie: 'tiefkuehlung', beidseitig: true });
    expect(moebelauslagen(el)).toBe(3.2);
  });

  it('unterscheidet die beiden Schrankhöhen', () => {
    const niedrig = element({ form: 'tkSchrank', kategorie: 'tiefkuehlung', hoehe: 201 });
    const hoch = element({ form: 'tkSchrank', kategorie: 'tiefkuehlung', hoehe: 221 });
    expect(moebelauslagen(niedrig)).toBe(5);
    expect(moebelauslagen(hoch)).toBe(6);
  });

  it('legt beim Kombigerät Wanne und Schrank zusammen', () => {
    const niedrig = element({ form: 'tkKombi', kategorie: 'tiefkuehlung', hoehe: 209.8 });
    const hoch = element({ form: 'tkKombi', kategorie: 'tiefkuehlung', hoehe: 229.8 });
    // Wanne wie eine Truhenseite, darüber der Schrankteil in Fächern.
    expect(moebelauslagen(niedrig)).toBe(6);
    expect(moebelauslagen(hoch)).toBe(6.6);
    // Das hohe Gerät muss mehr tragen als das niedrige – sonst wäre die
    // zusätzliche Höhe im Plan ohne Wirkung.
    expect(moebelauslagen(hoch)!).toBeGreaterThan(moebelauslagen(niedrig)!);
  });

  it('kennt die Theken und den BakeOff-Turm', () => {
    expect(moebelauslagen(element({ form: 'blinkSelf', kategorie: 'bedienung' }))).toBe(1);
    expect(moebelauslagen(element({ form: 'blinkSv', kategorie: 'bedienung' }))).toBe(3);
    expect(moebelauslagen(element({ form: 'bakeoff', kategorie: 'backwaren' }))).toBe(4);
  });

  it('nimmt beim Obstmöbel die Auslagen, die am Möbel stehen', () => {
    const el = element({ form: 'vitable', kategorie: 'obstgemuese', auslagen: 3 });
    expect(moebelauslagen(el)).toBe(3);
  });

  it('sagt beim Regal nichts – dort entscheidet der Planer', () => {
    expect(moebelauslagen(element())).toBeUndefined();
  });
});

describe('Die Auslagen einer Strecke', () => {
  const felder = (...f: Regalfeld[]) => element({ felderUnten: f, breite: 250 });

  it('rechnet Feld für Feld und gewichtet mit der Breite', () => {
    // Zwei Felder à 125 cm, fünf und sechs Böden. Über beide gerechnet:
    // 125 · 5 + 125 · 6 = 1375 cm tatsächlich.
    const el = felder({ breite: 125, boeden: 5 }, { breite: 125, boeden: 6 });
    expect(auslagenAnteil(strecke(el, 0, 250))).toEqual({ tatsaechlich: 1375, ohne: 0 });
  });

  it('nimmt nur das Stück, das die Strecke wirklich abdeckt', () => {
    const el = felder({ breite: 125, boeden: 5 }, { breite: 125, boeden: 6 });
    // Von 60 bis 190: 65 cm im ersten Feld, 65 cm im zweiten.
    expect(auslagenAnteil(strecke(el, 60, 190))).toEqual({ tatsaechlich: 65 * 5 + 65 * 6, ohne: 0 });
  });

  it('meldet die Länge, auf der die Zahl fehlt – und rechnet den Rest trotzdem', () => {
    // Eine halb ausgefüllte Strecke ganz zu verlieren wäre schlimmer als
    // eine Zeile, die sagt, wie viel noch offen ist.
    const el = felder({ breite: 125, boeden: 5 }, { breite: 125 });
    expect(auslagenAnteil(strecke(el, 0, 250))).toEqual({ tatsaechlich: 625, ohne: 125 });
  });

  it('rechnet ein leeres Feld als null und nicht als unbekannt', () => {
    const el = felder({ breite: 125, boeden: 5 }, { breite: 125, leer: true });
    expect(auslagenAnteil(strecke(el, 0, 250))).toEqual({ tatsaechlich: 625, ohne: 0 });
  });

  it('füllt fehlende Felder mit der Vorgabe des Möbels', () => {
    const el = element({
      form: 'tkSchrank',
      kategorie: 'tiefkuehlung',
      hoehe: 201,
      breite: 156.2,
      felderUnten: [{ breite: 78.1 }, { breite: 78.1 }],
    });
    const a = auslagenAnteil(strecke(el, 0, 156.2));
    expect(a.ohne).toBe(0);
    expect(a.tatsaechlich).toBeCloseTo(156.2 * 5, 6);
  });

  it('rechnet ein Möbel ohne eigene Feldliste über seine Grundeinteilung', () => {
    // Eine Truhe hat keine Felder, die man einzeln bestückt – sie zählt am
    // Stück.
    const el = element({ form: 'tkTruhe', kategorie: 'tiefkuehlung', breite: 250 });
    const a = auslagenAnteil(strecke(el, 0, 250));
    expect(a.ohne).toBe(0);
    expect(a.tatsaechlich).toBeCloseTo(250 * 3.2, 6);
  });

  it('lässt einen Überhang nicht verschwinden', () => {
    // Wer die Breite von Hand eintippt, hinterlässt einen Abschnitt, der
    // über die Felder hinausragt. Diese Meter stehen im Plan.
    const el = felder({ breite: 100, boeden: 5 });
    const a = auslagenAnteil({ ...strecke(el, 0, 250), laenge: 250 });
    expect(a.tatsaechlich).toBe(500);
    expect(a.ohne).toBe(150);
  });
});
