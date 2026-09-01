import { describe, expect, it } from 'vitest';

/**
 * Wo die Scharniere einer Doppeltür sitzen.
 *
 * `Tuerblatt` bekommt die **Mitte** des Flügels und rückt von dort um die
 * halbe Flügelbreite zum Scharnier. Übergibt man stattdessen das Scharnier,
 * landet es um eine halbe Flügelbreite daneben – bei einer Doppeltür also
 * außerhalb der Öffnung, und die Türblätter hängen neben der Wand in der
 * Luft. Genau das war der Fall.
 */

/** Dieselbe Rechnung wie in `Tuerblatt`. */
function scharnierVon(fluegelbreite: number, versatz: number, gespiegeltX: boolean): number {
  const halb = fluegelbreite / 2;
  return versatz + (gespiegeltX ? halb : -halb);
}

describe('Doppeltür', () => {
  const breite = 240;          // lichte Breite
  const halbB = breite / 2;    // ein Flügel

  it('setzt die Scharniere genau an die Ränder der Öffnung', () => {
    const links = scharnierVon(halbB, -halbB / 2, false);
    const rechts = scharnierVon(halbB, halbB / 2, true);
    expect(links).toBe(-breite / 2);
    expect(rechts).toBe(breite / 2);
  });

  it('lässt die geschlossenen Flügel in der Mitte zusammentreffen', () => {
    // Geschlossen reicht jeder Flügel vom Scharnier um seine Breite nach innen.
    const links = scharnierVon(halbB, -halbB / 2, false) + halbB;
    const rechts = scharnierVon(halbB, halbB / 2, true) - halbB;
    expect(links).toBe(0);
    expect(rechts).toBe(0);
  });

  it('hätte mit dem alten Versatz neben der Wand gehangen', () => {
    // Der Fehler, schriftlich: ±halbB als Versatz schob die Scharniere um
    // eine halbe Flügelbreite über die Öffnung hinaus.
    expect(scharnierVon(halbB, -halbB, false)).toBeLessThan(-breite / 2);
    expect(scharnierVon(halbB, halbB, true)).toBeGreaterThan(breite / 2);
  });
});
