import { describe, expect, it } from 'vitest';
import { bandVon, bandlage, gleicheElemente, mitZugeordnetem, namenVon, ohneElemente } from './warengruppenband';
import type { PlanElement, Warengruppenband } from '../typen/modell';

/**
 * Prüfungen für die Warengruppen-Bänder.
 *
 * Zwei Zusagen hängen daran, und beide sieht man erst im gedruckten Plan:
 * Vier Meter Eier tragen **einen** Namen und nicht viermal denselben. Und die
 * Beschriftung steht unter der ganzen Strecke, nicht neben ihr.
 */

const el = (id: string, x: number, werte: Partial<PlanElement> = {}): PlanElement =>
  ({
    id,
    vorlageId: 'wt-zug',
    ebeneId: 'einrichtung',
    name: 'Regal',
    kategorie: 'regale',
    x,
    y: 1000,
    breite: 100,
    tiefe: 67,
    hoehe: 180,
    drehung: 0,
    form: 'wt100',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
    beidseitig: false,
    achsmass: 100,
    ...werte,
  }) as PlanElement;

/** Vier Meter nebeneinander: Mitten bei 1050, 1150, 1250, 1350. */
const vier = [el('a', 1050), el('b', 1150), el('c', 1250), el('d', 1350)];

describe('Zuordnen', () => {
  it('legt für eine Auswahl ein Band an', () => {
    const baender = mitZugeordnetem([], ['a', 'b'], 'Eier');
    expect(baender).toHaveLength(1);
    expect(baender[0].elemente).toEqual(['a', 'b']);
    expect(baender[0].text).toBe('Eier');
  });

  it('hängt einen zweiten Namen mit Komma an dieselbe Strecke', () => {
    // Nicht zwei Beschriftungen übereinander, sondern eine mit zwei Namen.
    const eins = mitZugeordnetem([], ['a', 'b'], 'Eier');
    const zwei = mitZugeordnetem(eins, ['b', 'a'], 'Butter');
    expect(zwei).toHaveLength(1);
    expect(zwei[0].text).toBe('Eier, Butter');
    expect(namenVon(zwei[0])).toEqual(['Eier', 'Butter']);
  });

  it('hängt denselben Namen nicht zweimal an', () => {
    const eins = mitZugeordnetem([], ['a'], 'Eier');
    expect(mitZugeordnetem(eins, ['a'], 'eier')[0].text).toBe('Eier');
  });

  it('nimmt die Elemente aus anderen Bändern heraus', () => {
    // Ein Möbel trägt eine Beschriftung, nicht zwei übereinander.
    const eins = mitZugeordnetem([], ['a', 'b', 'c'], 'Eier');
    const zwei = mitZugeordnetem(eins, ['b'], 'Butter');
    expect(zwei).toHaveLength(2);
    expect(zwei.find((b) => b.text === 'Eier')!.elemente).toEqual(['a', 'c']);
    expect(zwei.find((b) => b.text === 'Butter')!.elemente).toEqual(['b']);
  });

  it('lässt ein leer gewordenes Band wegfallen', () => {
    const eins = mitZugeordnetem([], ['a'], 'Eier');
    expect(mitZugeordnetem(eins, ['a', 'b'], 'Butter')).toHaveLength(1);
  });

  it('tut ohne Auswahl oder ohne Namen nichts', () => {
    expect(mitZugeordnetem([], [], 'Eier')).toEqual([]);
    expect(mitZugeordnetem([], ['a'], '   ')).toEqual([]);
  });

  it('erkennt dieselbe Auswahl in anderer Reihenfolge', () => {
    expect(gleicheElemente(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(gleicheElemente(['a'], ['a', 'b'])).toBe(false);
  });

  it('nimmt gelöschte Möbel aus den Bändern', () => {
    const eins = mitZugeordnetem([], ['a', 'b'], 'Eier');
    expect(ohneElemente(eins, ['a'])[0].elemente).toEqual(['b']);
    expect(ohneElemente(eins, ['a', 'b'])).toEqual([]);
  });

  it('findet das Band eines Möbels', () => {
    const eins = mitZugeordnetem([], ['a', 'b'], 'Eier');
    expect(bandVon(eins, 'b')?.text).toBe('Eier');
    expect(bandVon(eins, 'z')).toBeUndefined();
  });
});

describe('Wo das Band liegt', () => {
  const band = (elemente: string[]): Warengruppenband => ({ id: 'x', elemente, text: 'Eier' });

  it('spannt über die ganze Strecke', () => {
    // Vier Meter von 1000 bis 1400: vier Meter breit, Mitte bei 1200.
    const lage = bandlage(band(['a', 'b', 'c', 'd']), vier, 7)!;
    expect(lage.breite).toBeCloseTo(400, 3);
    expect(lage.x).toBeCloseTo(1200, 3);
  });

  it('steht vor dem Möbel und nicht darin', () => {
    // Die Front liegt bei y = 1000 + 67/2; darunter kommt der Abstand.
    const lage = bandlage(band(['a']), vier, 7)!;
    expect(lage.y).toBeCloseTo(1000 + 67 / 2 + 7, 3);
  });

  it('richtet sich nach dem tiefsten Möbel der Strecke', () => {
    // Sonst stünde die Schrift auf dem tieferen statt darunter.
    const tief = [el('a', 1050), el('b', 1150, { tiefe: 127 })];
    const lage = bandlage(band(['a', 'b']), tief, 7)!;
    expect(lage.y).toBeCloseTo(1000 + 127 / 2 + 7, 3);
  });

  it('dreht sich mit dem Möbel', () => {
    const hochkant = [el('a', 1000, { drehung: 90 }), el('b', 1000, { drehung: 90, y: 1100 })];
    const lage = bandlage(band(['a', 'b']), hochkant, 7)!;
    expect(lage.drehung).toBe(90);
    expect(lage.breite).toBeCloseTo(200, 3);
    // Die eigene y-Achse zeigt bei 90° nach links: davor heißt kleineres x.
    expect(lage.x).toBeLessThan(1000);
  });

  it('wendet die Schrift, wenn die Strecke andersherum läuft', () => {
    const unten = [el('a', 1050, { drehung: 180 })];
    expect(bandlage(band(['a']), unten, 7)!.kopfueber).toBe(true);
  });

  it('zählt ein quer stehendes Möbel mit seiner Tiefe', () => {
    // Eine Kopfgondel am Ende eines Zugs steht quer: Längs der Strecke ist
    // sie so lang wie tief, nicht wie breit.
    const mitKopf = [el('a', 1050), el('k', 1150, { drehung: 90, breite: 125, tiefe: 67 })];
    const lage = bandlage(band(['a', 'k']), mitKopf, 7)!;
    // 1000 bis 1100 plus der Kopf von 1116,5 bis 1183,5.
    expect(lage.breite).toBeCloseTo(183.5, 1);
  });

  it('gibt nichts zurück, wenn kein Möbel mehr da ist', () => {
    expect(bandlage(band(['weg']), vier, 7)).toBeNull();
  });
});
