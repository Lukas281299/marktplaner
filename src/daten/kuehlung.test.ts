import { describe, expect, it } from 'vitest';
import { BIBLIOTHEK } from './bibliothek';
import { modulsatzFuer } from './module';

/**
 * Prüfungen für die Normalkühlung, WSL-Katalog 2026 Seiten 6 und 7.
 *
 * Die Zahlen stehen im Katalog und nirgends sonst. Ein Zahlendreher fällt
 * auf dem Plan nicht auf – das Möbel sieht richtig aus und ist es nicht.
 * Deshalb steht hier jede Größe einzeln.
 */

const kuehlung = BIBLIOTHEK.filter((v) => v.kategorie === 'kuehlung');
const orion = kuehlung.filter((v) => v.id.startsWith('kuehl-orion-'));
const tueren = orion.filter((v) => v.form === 'kuehlSchrank');
const offen = orion.filter((v) => v.form === 'kuehlOffen');

/** Die verschiedenen Werte einer Eigenschaft, aufsteigend. */
const werte = (liste: typeof orion, feld: 'tiefe' | 'hoehe' | 'breite' | 'grundboden') =>
  [...new Set(liste.map((v) => v[feld]))].sort((a, b) => (a ?? 0) - (b ?? 0));

describe('Orion Remote', () => {
  it('hat acht Ausführungen je Bauart', () => {
    // Vier Tiefen mal zwei Höhen – so benennt der Katalog sie auch:
    // „Orion Doors Remote 804x2090".
    const bauformen = (liste: typeof orion) =>
      new Set(liste.map((v) => `${v.tiefe}x${v.hoehe}`)).size;
    expect(bauformen(tueren)).toBe(8);
    expect(bauformen(offen)).toBe(8);
  });

  it('nimmt die vier Tiefen des Katalogs', () => {
    // Außenmaß mit Stoßschutz, so wie das Möbel im Katalog heißt.
    expect(werte(tueren, 'tiefe')).toEqual([80.4, 92.5, 102.5, 112.5]);
    expect(werte(offen, 'tiefe')).toEqual([80.4, 92.5, 102.5, 112.5]);
  });

  it('nimmt die beiden Höhen des Katalogs', () => {
    expect(werte(tueren, 'hoehe')).toEqual([209, 229]);
    expect(werte(offen, 'hoehe')).toEqual([209, 229]);
  });

  it('führt alle fünf Längen in jeder Tiefe', () => {
    // Hier hatte ich mich beim ersten Lesen der Tabelle vertan: Der Strich
    // in der Zeile 1070 steht in der Spalte „HP L 2000", nicht bei der
    // Länge 937. Alle fünf Längen gibt es in allen vier Tiefen.
    for (const tiefe of [80.4, 92.5, 102.5, 112.5]) {
      const laengen = werte(tueren.filter((v) => v.tiefe === tiefe), 'breite');
      expect(laengen).toEqual([93.7, 125, 187.5, 250, 375]);
    }
  });

  it('gibt jedem Möbel die Tiefe seines untersten Bodens', () => {
    expect(werte(tueren, 'grundboden')).toEqual([48, 60, 70, 80]);
    // Und zwar der Tiefe zugeordnet, nicht wahllos.
    const zuordnung = new Map(tueren.map((v) => [v.tiefe, v.grundboden]));
    expect([...zuordnung.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [80.4, 48],
      [92.5, 60],
      [102.5, 70],
      [112.5, 80],
    ]);
  });

  it('nennt Modell und Maße im Hinweis', () => {
    const eines = tueren.find((v) => v.tiefe === 80.4 && v.hoehe === 209)!;
    expect(eines.hinweis).toContain('Orion Doors Remote 804x2090');
    expect(eines.hinweis).toContain('unterster Boden 480 mm');
    expect(eines.hinweis).toContain('Korpus 750 × 2005 mm');
  });

  it('kennt kein Orion FV', () => {
    // Bewusst weggelassen.
    expect(kuehlung.some((v) => /FV/i.test(v.hinweis ?? ''))).toBe(false);
  });
});

describe('Was von der alten Kühlung bleibt', () => {
  it('behält das Stufenmöbel', () => {
    const stufen = kuehlung.filter((v) => v.form === 'kuehlStufen');
    expect(stufen).toHaveLength(5);
    expect(stufen[0].hinweis).toContain('Cloud Remote');
  });

  it('hat die alten Titan-Größen abgelöst', () => {
    expect(kuehlung.some((v) => v.id.includes('titan'))).toBe(false);
    expect(kuehlung.some((v) => v.tiefe === 104 || v.tiefe === 121.5)).toBe(false);
  });

  it('lässt den Modulsatz der Kühlung unangetastet', () => {
    // Die Längen haben sich nicht geändert – Anhängen geht weiter.
    expect(modulsatzFuer('kuehlSchrank')!.laengen).toEqual([93.7, 125, 187.5, 250, 375]);
  });
});
