import { describe, expect, it } from 'vitest';
import { bodentiefeMm, masszeilen, notizZeilen } from './feldnotiz';

/**
 * Prüfungen für die Notizen in den Regalfeldern.
 *
 * Die Tiefe rechts im Feld muss die **Bodentiefe** sein und nicht das
 * Stellmaß — sonst steht an einer Gondel T1270, wo T600 bestellt wird. Wohin
 * die Notizen beim Umbauen wandern, prüft `regalseiten.test.ts`: Dort liegen
 * sie am Feld.
 */

describe('Zeilen einer Notiz', () => {
  it('trennt an Zeilenumbrüchen', () => {
    expect(notizZeilen('5+\n1K')).toEqual(['5+', '1K']);
  });

  it('wirft Leerzeilen und Leerraum weg', () => {
    // Wer zwischen zwei Angaben eine Leerzeile lässt, meint keinen Abstand –
    // im Feld ist der Platz zu knapp, um ihn zu verschenken.
    expect(notizZeilen('  5+  \n\n\n  1K \n')).toEqual(['5+', '1K']);
  });

  it('zeichnet höchstens drei Zeilen', () => {
    expect(notizZeilen('a\nb\nc\nd\ne')).toEqual(['a', 'b', 'c']);
  });

  it('kommt mit nichts zurecht', () => {
    expect(notizZeilen(undefined)).toEqual([]);
    expect(notizZeilen('')).toEqual([]);
    expect(notizZeilen('   ')).toEqual([]);
  });
});

/** Ein Möbel mit den paar Angaben, die für die Maßzeile zählen. */
const moebel = (werte: Partial<Parameters<typeof masszeilen>[0]>) =>
  ({ form: 'rechteck', breite: 125, tiefe: 67, hoehe: 180, beidseitig: false, ...werte }) as
    Parameters<typeof masszeilen>[0];

describe('Höhe und Tiefe rechts im Feld', () => {
  it('nennt die Bodentiefe einer Gondel, nicht das Stellmaß', () => {
    // 2 × 600 + 70 tote Zone = 1270 tief. Bestellt wird T600.
    expect(bodentiefeMm({ tiefe: 127, beidseitig: true })).toBe(600);
  });

  it('nennt beim Wandregal die Tiefe ohne tote Zone', () => {
    // 600er Boden plus 70 tote Zone = 670 Stellmaß.
    expect(bodentiefeMm({ tiefe: 67, beidseitig: false })).toBe(600);
  });

  it('schreibt beide Zeilen in Millimetern', () => {
    expect(masszeilen(moebel({ hoehe: 180, tiefe: 127, beidseitig: true }))).toEqual(['H 1800', 'T 600']);
  });

  it('lässt die Höhe weg, wenn keine bekannt ist', () => {
    // Eine Null wäre eine Behauptung.
    expect(masszeilen(moebel({ hoehe: undefined, tiefe: 67 }))).toEqual(['T 600']);
    expect(masszeilen(moebel({ hoehe: 0, tiefe: 67 }))).toEqual(['T 600']);
  });

  it('schreibt an eine Palette Länge und Breite statt Höhe und Tiefe', () => {
    // Eine Palette ist so hoch, wie gestapelt wird – die Zahl wäre erfunden.
    // Ihre beiden Grundmaße sagen dagegen sofort, welche es ist.
    expect(masszeilen(moebel({ form: 'palette', breite: 120, tiefe: 80, hoehe: 100 }))).toEqual([
      'L 1200',
      'B 800',
    ]);
  });

  it('nennt bei der hochkant stehenden Palette dieselben Maße', () => {
    // Dieselbe Palette, nur gedreht eingesetzt. Länge bleibt Länge.
    expect(masszeilen(moebel({ form: 'palette', breite: 80, tiefe: 120, hoehe: 100 }))).toEqual([
      'L 1200',
      'B 800',
    ]);
  });

  it('erfindet bei unsinniger Tiefe nichts', () => {
    expect(masszeilen(moebel({ hoehe: 180, tiefe: 3, beidseitig: true }))).toEqual(['H 1800']);
  });
});
