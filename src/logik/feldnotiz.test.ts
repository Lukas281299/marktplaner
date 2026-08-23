import { describe, expect, it } from 'vitest';
import { bodentiefeMm, masszeilen, notizZeilen, passeNotizenAn } from './feldnotiz';
import type { Feldnotiz } from '../typen/modell';

/**
 * Prüfungen für die Notizen in den Regalfeldern.
 *
 * Zwei Dinge müssen stimmen, weil beides still schiefgeht: Die Tiefe rechts
 * im Feld muss die **Bodentiefe** sein und nicht das Stellmaß — sonst steht
 * an einer Gondel T1270, wo T600 bestellt wird. Und die Notizen müssen ihren
 * Platz behalten, wenn ein Zug wächst oder schrumpft; wandern sie ein Feld
 * weiter, merkt es niemand, bis im Markt das falsche Regal steht.
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
    expect(masszeilen({ hoehe: 180, tiefe: 127, beidseitig: true })).toEqual(['H 1800', 'T 600']);
  });

  it('lässt die Höhe weg, wenn keine bekannt ist', () => {
    // Eine Null wäre eine Behauptung.
    expect(masszeilen({ hoehe: undefined, tiefe: 67, beidseitig: false })).toEqual(['T 600']);
    expect(masszeilen({ hoehe: 0, tiefe: 67, beidseitig: false })).toEqual(['T 600']);
  });

  it('erfindet bei unsinniger Tiefe nichts', () => {
    expect(masszeilen({ hoehe: 180, tiefe: 3, beidseitig: true })).toEqual(['H 1800']);
  });
});

describe('Notizen an die Feldzahl anpassen', () => {
  const n = (oben?: string, unten?: string): Feldnotiz => ({ oben, unten });

  it('lässt jede Notiz an ihrem Platz, wenn der Zug wächst', () => {
    // Der Kern: Wer im dritten Feld etwas stehen hat, findet es hinterher
    // dort wieder und nicht im zweiten.
    const alt = [n(undefined, 'A'), n(undefined, 'B'), n(undefined, 'C')];
    const neu = passeNotizenAn(alt, 5)!;
    expect(neu).toHaveLength(5);
    expect(neu[2].unten).toBe('C');
    expect(neu[3]).toEqual({});
  });

  it('schneidet ab, wenn der Zug kürzer wird', () => {
    const neu = passeNotizenAn([n(undefined, 'A'), n(undefined, 'B'), n(undefined, 'C')], 2)!;
    expect(neu).toHaveLength(2);
    expect(neu.map((e) => e.unten)).toEqual(['A', 'B']);
  });

  it('schleppt keine leere Liste mit', () => {
    // Ein Zug ohne Notizen soll auch keine Notizenliste speichern.
    expect(passeNotizenAn([{}, {}, {}], 4)).toBeUndefined();
    expect(passeNotizenAn(undefined, 6)).toBeUndefined();
  });

  it('behält die Liste, solange irgendwo etwas steht', () => {
    expect(passeNotizenAn([{}, n('5+'), {}], 3)).toHaveLength(3);
  });

  it('lässt eine passende Liste unangetastet', () => {
    const alt = [n(undefined, 'A'), n(undefined, 'B')];
    expect(passeNotizenAn(alt, 2)).toBe(alt);
  });
});
