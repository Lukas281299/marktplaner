import { describe, expect, it } from 'vitest';
import {
  bandVon,
  bandlage,
  enthaelt,
  feldlage,
  gleicheFelder,
  mitZugeordnetem,
  namenVon,
  ohneElemente,
  umgeschaltet,
} from './warengruppenband';
import type { Feldbezug, PlanElement, Warengruppenband } from '../typen/modell';

/**
 * Prüfungen für die Warengruppen-Bänder.
 *
 * Drei Zusagen hängen daran, und alle drei sieht man erst im gedruckten Plan:
 * Vier Meter Eier tragen **einen** Namen und nicht viermal denselben. Die
 * Beschriftung steht unter der ganzen Strecke, nicht neben ihr. Und sie
 * greift auf **Meter** zu und nicht auf Möbel – eine Gondel ist ein einziges
 * Element mit sechs Feldern.
 */

/** Eine Gondel: ein Element, sechs Meter, beide Seiten. */
const gondel: PlanElement = {
  id: 'zug',
  vorlageId: 'wt-zug',
  ebeneId: 'einrichtung',
  name: 'Gondel',
  kategorie: 'regale',
  x: 1300,
  y: 1000,
  breite: 600,
  tiefe: 127,
  hoehe: 180,
  drehung: 0,
  form: 'wt100',
  farbe: '#ccc',
  beschriftung: '',
  beschriftungSichtbar: false,
  schriftgroesse: 12,
  gesperrt: false,
  reihenfolge: 0,
  beidseitig: true,
  achsmass: 100,
} as PlanElement;

const f = (feld: number, seite: 'oben' | 'unten' = 'unten'): Feldbezug => ({
  element: 'zug',
  seite,
  feld,
});

describe('Markieren', () => {
  it('nimmt einen Meter auf und wieder heraus', () => {
    const eins = umgeschaltet([], f(0));
    expect(eins).toHaveLength(1);
    expect(enthaelt(eins, f(0))).toBe(true);
    expect(umgeschaltet(eins, f(0))).toEqual([]);
  });

  it('hält die beiden Seiten auseinander', () => {
    // Vorder- und Rückseite einer Gondel sind verschiedene Meter.
    const beide = umgeschaltet(umgeschaltet([], f(2, 'unten')), f(2, 'oben'));
    expect(beide).toHaveLength(2);
  });

  it('erkennt dieselbe Menge in anderer Reihenfolge', () => {
    expect(gleicheFelder([f(0), f(1)], [f(1), f(0)])).toBe(true);
    expect(gleicheFelder([f(0)], [f(0), f(1)])).toBe(false);
  });
});

describe('Zuordnen', () => {
  it('legt für eine Markierung ein Band an', () => {
    const baender = mitZugeordnetem([], [f(0), f(1)], 'Eier');
    expect(baender).toHaveLength(1);
    expect(baender[0].felder).toHaveLength(2);
    expect(baender[0].text).toBe('Eier');
  });

  it('hängt einen zweiten Namen mit Komma an dieselbe Strecke', () => {
    // Nicht zwei Beschriftungen übereinander, sondern eine mit zwei Namen.
    const eins = mitZugeordnetem([], [f(0), f(1)], 'Eier');
    const zwei = mitZugeordnetem(eins, [f(1), f(0)], 'Butter');
    expect(zwei).toHaveLength(1);
    expect(zwei[0].text).toBe('Eier, Butter');
    expect(namenVon(zwei[0])).toEqual(['Eier', 'Butter']);
  });

  it('hängt denselben Namen nicht zweimal an', () => {
    const eins = mitZugeordnetem([], [f(0)], 'Eier');
    expect(mitZugeordnetem(eins, [f(0)], 'eier')[0].text).toBe('Eier');
  });

  it('nimmt die Meter aus anderen Bändern heraus', () => {
    // Ein Meter trägt eine Beschriftung, nicht zwei übereinander.
    const eins = mitZugeordnetem([], [f(0), f(1), f(2)], 'Eier');
    const zwei = mitZugeordnetem(eins, [f(1)], 'Butter');
    expect(zwei).toHaveLength(2);
    expect(zwei.find((b) => b.text === 'Eier')!.felder.map((x) => x.feld)).toEqual([0, 2]);
  });

  it('lässt ein leer gewordenes Band wegfallen', () => {
    const eins = mitZugeordnetem([], [f(0)], 'Eier');
    expect(mitZugeordnetem(eins, [f(0), f(1)], 'Butter')).toHaveLength(1);
  });

  it('tut ohne Markierung oder ohne Namen nichts', () => {
    expect(mitZugeordnetem([], [], 'Eier')).toEqual([]);
    expect(mitZugeordnetem([], [f(0)], '   ')).toEqual([]);
  });

  it('nimmt gelöschte Möbel aus den Bändern', () => {
    const eins = mitZugeordnetem([], [f(0), f(1)], 'Eier');
    expect(ohneElemente(eins, ['zug'])).toEqual([]);
  });

  it('findet das Band eines Meters', () => {
    const eins = mitZugeordnetem([], [f(0), f(1)], 'Eier');
    expect(bandVon(eins, f(1))?.text).toBe('Eier');
    expect(bandVon(eins, f(5))).toBeUndefined();
  });
});

describe('Wo ein Meter liegt', () => {
  it('findet die Vorderkante des ersten Meters', () => {
    // Der Zug reicht von 1000 bis 1600, sechs Meter. Der erste hat seine
    // Mitte bei 1050, die Vorderkante bei y = 1000 + 127/2.
    const lage = feldlage(gondel, 'unten', 0)!;
    expect(lage.x).toBeCloseTo(1050, 3);
    expect(lage.y).toBeCloseTo(1063.5, 3);
    expect(lage.breite).toBeCloseTo(100, 3);
  });

  it('legt die Rückseite an die andere Kante', () => {
    const lage = feldlage(gondel, 'oben', 0)!;
    expect(lage.y).toBeCloseTo(936.5, 3);
    expect(lage.seite).toBe('oben');
  });

  it('gibt es einen Meter nicht, kommt nichts zurück', () => {
    expect(feldlage(gondel, 'unten', 9)).toBeNull();
  });
});

describe('Wo das Band liegt', () => {
  const band = (felder: Feldbezug[]): Warengruppenband => ({ id: 'x', felder, text: 'Eier' });

  it('spannt über die markierten Meter, nicht über das ganze Möbel', () => {
    // Genau der gemeldete Fehler: Über die Auswahl kam immer die ganze
    // Gondel, und der Text stand mitten darin.
    // Der Zug reicht von 1000 bis 1600; die Meter 2 und 3 von 1100 bis 1300.
    const lage = bandlage(band([f(1), f(2)]), [gondel], 7)!;
    expect(lage.breite).toBeCloseTo(200, 3);
    expect(lage.x).toBeCloseTo(1200, 3);
  });

  it('steht vor dem Möbel und nicht darin', () => {
    const lage = bandlage(band([f(0)]), [gondel], 7)!;
    expect(lage.y).toBeCloseTo(1000 + 127 / 2 + 7, 3);
  });

  it('setzt die Rückseite auf die andere Seite', () => {
    const lage = bandlage(band([f(0, 'oben')]), [gondel], 7)!;
    expect(lage.y).toBeCloseTo(1000 - 127 / 2 - 7, 3);
    expect(lage.seite).toBe('oben');
  });

  it('dreht sich mit dem Möbel', () => {
    const hochkant = { ...gondel, drehung: 90 };
    const lage = bandlage(band([f(0), f(1)]), [hochkant], 7)!;
    expect(lage.drehung).toBe(90);
    expect(lage.breite).toBeCloseTo(200, 3);
  });

  it('wendet die Schrift, wenn das Möbel andersherum läuft', () => {
    const unten = { ...gondel, drehung: 180 };
    expect(bandlage(band([f(0)]), [unten], 7)!.kopfueber).toBe(true);
  });

  it('gibt nichts zurück, wenn das Möbel weg ist', () => {
    expect(bandlage(band([f(0)]), [], 7)).toBeNull();
  });
});
