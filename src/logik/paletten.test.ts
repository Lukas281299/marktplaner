import { describe, expect, it } from 'vitest';
import { PALETTEN, palettenAnzahl, palettenmass, stehtUeber } from './paletten';

/**
 * Paletten unter Regalfeldern.
 *
 * Im Markt üblich: Oben ein, zwei Böden für die Sichtware, darunter die
 * Palette, aus der nachgefüllt wird. Wie viele nebeneinander passen, hängt
 * an der Feldbreite – und ob sie in den Gang ragen, an der Möbeltiefe.
 */

describe('Palettenmaße', () => {
  it('legt die Norm fest, nicht der Planer', () => {
    expect(PALETTEN.euro).toMatchObject({ lang: 120, kurz: 80 });
    expect(PALETTEN.chep).toMatchObject({ lang: 120, kurz: 100 });
    expect(PALETTEN.halb).toMatchObject({ lang: 80, kurz: 60 });
    expect(PALETTEN.viertel).toMatchObject({ lang: 60, kurz: 40 });
  });

  it('dreht die Palette mit der Lage', () => {
    // Längs heißt: die lange Seite parallel zur Regalfront.
    expect(palettenmass('euro', true)).toEqual({ breite: 120, tiefe: 80 });
    expect(palettenmass('euro', false)).toEqual({ breite: 80, tiefe: 120 });
  });
});

describe('Wie viele nebeneinander', () => {
  it('füllt das Feld, soweit es reicht', () => {
    // Ein 2,50-m-Feld, Viertelpaletten längs (60 breit): vier passen.
    expect(palettenAnzahl({ art: 'viertel', laengs: true }, 250)).toBe(4);
    // Dasselbe Feld mit Europaletten längs (120 breit): zwei.
    expect(palettenAnzahl({ art: 'euro', laengs: true }, 250)).toBe(2);
  });

  it('nimmt eine ausdrückliche Zahl vor die Rechnung', () => {
    expect(palettenAnzahl({ art: 'viertel', laengs: true, anzahl: 1 }, 250)).toBe(1);
  });

  it('zeichnet auch dann eine, wenn das Feld zu schmal ist', () => {
    // Ein 1,33-m-Wandregal, Europalette längs: rechnerisch passt eine.
    expect(palettenAnzahl({ art: 'euro', laengs: true }, 133)).toBe(1);
    // Und selbst in einem 60er Feld bleibt es bei einer – der Planer hat sie
    // dort hingestellt; dass sie übersteht, soll man im Plan sehen.
    expect(palettenAnzahl({ art: 'euro', laengs: true }, 60)).toBe(1);
  });
});

describe('Überstand in den Gang', () => {
  it('meldet, wie weit die Palette vorsteht', () => {
    // Europalette längs ist 80 tief; ein Regal mit 60 cm Korpus lässt 20 übrig.
    expect(stehtUeber({ art: 'euro', laengs: true }, 60)).toBe(20);
  });

  it('meldet nichts, wenn sie hineinpasst', () => {
    expect(stehtUeber({ art: 'halb', laengs: true }, 70)).toBe(0);
  });

  it('rechnet mit der gedrehten Lage', () => {
    // Quer gestellt ist dieselbe Palette 120 tief – in einem 70er Regal
    // ragt sie einen halben Meter heraus.
    expect(stehtUeber({ art: 'euro', laengs: false }, 70)).toBe(50);
  });
});
