import { describe, expect, it } from 'vitest';
import { achsmassZeichen } from './achsmass';

/**
 * Prüfungen für die Achsmaß-Zeichen.
 *
 * Die Regel gilt in allen Abteilungen gleich, deshalb liegt sie an einer
 * Stelle – und deshalb ist sie hier festgehalten. Ein falsches Zeichen im
 * Plan heißt: falsches Regal bestellt.
 */

describe('Achsmaß-Zeichen', () => {
  it('lässt ein 1000er-Feld leer', () => {
    expect(achsmassZeichen(100)).toBe('keins');
  });

  it('gibt dem 1250er-Feld eine Diagonale', () => {
    expect(achsmassZeichen(125)).toBe('diagonale');
  });

  it('gibt dem 1333er-Feld ein Kreuz', () => {
    expect(achsmassZeichen(133.3)).toBe('kreuz');
  });

  it('gibt dem 625er-Feld ebenfalls ein Kreuz', () => {
    // Verwechseln kann man die beiden nicht: 625 ist halb so breit wie 1250.
    expect(achsmassZeichen(62.5)).toBe('kreuz');
  });

  it('verträgt kleine Abweichungen', () => {
    // 1333 mm gehen nicht rund in Zentimeter auf, und beim Ziehen wird gerundet.
    expect(achsmassZeichen(133)).toBe('kreuz');
    expect(achsmassZeichen(133.5)).toBe('kreuz');
    expect(achsmassZeichen(124.6)).toBe('diagonale');
  });

  it('lässt ein Sondermaß leer', () => {
    // Ein falsches Zeichen wäre schlimmer als keines.
    expect(achsmassZeichen(90)).toBe('keins');
    expect(achsmassZeichen(200)).toBe('keins');
    expect(achsmassZeichen(0)).toBe('keins');
  });

  it('hält 1250 und 1333 auseinander', () => {
    expect(achsmassZeichen(125)).not.toBe(achsmassZeichen(133.3));
  });
});
