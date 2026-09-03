import { describe, expect, it } from 'vitest';
import {
  UNTERBAUTEN,
  freiesMass,
  stehtUeber,
  unterbauAnzahl,
  unterbaumass,
} from './unterbau';

/**
 * Was unter Regalfeldern steht.
 *
 * Im Markt üblich: Oben ein, zwei Böden für die Sichtware, darunter der
 * Nachschub – eine Palette, ein Stapel Getränkekisten oder ein Kühlmöbel.
 * Wie viele nebeneinander passen, hängt an der Feldbreite; ob sie in den
 * Gang ragen, an der Möbeltiefe.
 */

describe('Maße', () => {
  it('legt die Norm fest, nicht der Planer', () => {
    expect(UNTERBAUTEN.euro).toMatchObject({ lang: 120, kurz: 80 });
    // Genauso groß wie eine Europalette – so kommt sie in den Markt.
    expect(UNTERBAUTEN.chep).toMatchObject({ lang: 120, kurz: 80 });
    expect(UNTERBAUTEN.halb).toMatchObject({ lang: 80, kurz: 60 });
    expect(UNTERBAUTEN.viertel).toMatchObject({ lang: 60, kurz: 40 });
    // Der Bierkasten mit 20 x 0,5 l – dasselbe Maß wie vor den Gestellen.
    expect(UNTERBAUTEN.kiste).toMatchObject({ lang: 40, kurz: 30 });
  });

  it('dreht mit der Lage', () => {
    // Längs heißt: die lange Seite parallel zur Regalfront.
    expect(unterbaumass({ art: 'euro', laengs: true })).toEqual({ breite: 120, tiefe: 80 });
    expect(unterbaumass({ art: 'euro', laengs: false })).toEqual({ breite: 80, tiefe: 120 });
    expect(unterbaumass({ art: 'kiste', laengs: true })).toEqual({ breite: 40, tiefe: 30 });
  });

  it('lässt das Kühlmöbel sein eigenes Maß haben', () => {
    // Es gibt keine Norm dafür; eingetragen sticht die Voreinstellung.
    expect(freiesMass('kuehlmoebel')).toBe(true);
    expect(freiesMass('euro')).toBe(false);
    expect(unterbaumass({ art: 'kuehlmoebel' })).toEqual({ breite: 125, tiefe: 80 });
    expect(unterbaumass({ art: 'kuehlmoebel', breite: 200, tiefe: 90 })).toEqual({
      breite: 200,
      tiefe: 90,
    });
    // Und es dreht sich nicht: Ein Gerät wählt man, man legt es nicht quer.
    expect(unterbaumass({ art: 'kuehlmoebel', breite: 200, tiefe: 90, laengs: false })).toEqual({
      breite: 200,
      tiefe: 90,
    });
  });
});

describe('Wie viele nebeneinander', () => {
  it('füllt das Feld, soweit es reicht', () => {
    // Ein 2,50-m-Feld, Viertelpaletten längs (60 breit): vier passen.
    expect(unterbauAnzahl({ art: 'viertel', laengs: true }, 250)).toBe(4);
    // Dasselbe Feld mit Europaletten längs (120 breit): zwei.
    expect(unterbauAnzahl({ art: 'euro', laengs: true }, 250)).toBe(2);
  });

  it('nimmt eine ausdrückliche Zahl vor die Rechnung', () => {
    expect(unterbauAnzahl({ art: 'viertel', laengs: true, anzahl: 1 }, 250)).toBe(1);
  });

  it('zeichnet auch dann eine, wenn das Feld zu schmal ist', () => {
    // Ein 1,33-m-Wandregal, Europalette längs: rechnerisch passt eine.
    expect(unterbauAnzahl({ art: 'euro', laengs: true }, 133)).toBe(1);
    // Und selbst in einem 60er Feld bleibt es bei einer – der Planer hat sie
    // dort hingestellt; dass sie übersteht, soll man im Plan sehen.
    expect(unterbauAnzahl({ art: 'euro', laengs: true }, 60)).toBe(1);
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

describe('Kisten und Kühlmöbel', () => {
  it('füllt ein Feld mit Getränkekisten', () => {
    // Ein 1,25-m-Feld, Kisten längs (40 breit): drei passen nebeneinander.
    expect(unterbauAnzahl({ art: 'kiste', laengs: true }, 125)).toBe(3);
    // Quer gestellt (30 breit) sind es vier.
    expect(unterbauAnzahl({ art: 'kiste', laengs: false }, 125)).toBe(4);
  });

  it('stellt ein Kühlmöbel immer einzeln hin', () => {
    // Zwei Geräte in einem Feld wären zwei Möbel – die stellt man als zwei
    // Felder hin und nicht als Anzahl.
    expect(unterbauAnzahl({ art: 'kuehlmoebel', breite: 60 }, 400)).toBe(1);
    expect(unterbauAnzahl({ art: 'kuehlmoebel', breite: 60, anzahl: 3 }, 400)).toBe(1);
  });

  it('meldet auch beim Kühlmöbel den Überstand', () => {
    // Eine Vitrine von 90 cm Tiefe vor einem Regal mit 60 cm Korpus.
    expect(stehtUeber({ art: 'kuehlmoebel', breite: 125, tiefe: 90 }, 60)).toBe(30);
  });
});

describe('Kartoffelkiste', () => {
  it('misst 1,00 × 0,90 m', () => {
    expect(UNTERBAUTEN.kartoffelkiste).toMatchObject({ lang: 100, kurz: 90 });
    expect(unterbaumass({ art: 'kartoffelkiste', laengs: true })).toEqual({
      breite: 100,
      tiefe: 90,
    });
  });

  it('steht vor einem 600er Möbel heraus – und sagt, wie weit', () => {
    // Ein wt100 T600 baut 67 cm tief: 23 cm ragen in den Gang.
    expect(stehtUeber({ art: 'kartoffelkiste', laengs: true }, 67)).toBe(23);
    // Bei genau 60 cm Korpus sind es 30.
    expect(stehtUeber({ art: 'kartoffelkiste', laengs: true }, 60)).toBe(30);
  });

  it('passt zweimal nebeneinander in ein 2-m-Feld', () => {
    expect(unterbauAnzahl({ art: 'kartoffelkiste', laengs: true }, 200)).toBe(2);
  });
});
