import { describe, expect, it } from 'vitest';
import { bodentiefeMm, feldzeilen, masszeilen, notizZeilen } from './feldnotiz';

/**
 * Prüfungen für die Notizen in den Regalfeldern.
 *
 * Die Tiefe rechts im Feld muss die **Bodentiefe** sein und nicht das
 * Stellmaß — sonst steht an einer Gondel T1270, wo T600 bestellt wird. Wohin
 * die Notizen beim Umbauen wandern, prüft `regalseiten.test.ts`: Dort liegen
 * sie am Feld.
 */

describe('Zeilen im Feld', () => {
  it('setzt die Bodenzahl vor die Notiz', () => {
    expect(feldzeilen({ boeden: 5, notiz: '1K' })).toEqual(['5', '1K']);
  });

  it('schreibt die Zahl ohne Pluszeichen', () => {
    // In den Wanzl-Plänen steht dort „5+". Das Plus erklärt aber keine
    // Legende, und niemand im Markt liest daraus etwas – es war Schreibweise
    // und keine Aussage.
    expect(feldzeilen({ boeden: 5 })).toEqual(['5']);
  });

  it('lässt eine von Hand getippte Notiz unangetastet', () => {
    // „5+/6+" meint zwei Seiten und ist eine eigene Notiz – keine Zahl, die
    // dieses Feld gesetzt hätte. Solche Zeilen bleiben, wie sie getippt sind.
    expect(feldzeilen({ notiz: '5+/6+' })).toEqual(['5+/6+']);
  });

  it('lässt die Zahl weg, wenn keine da ist', () => {
    expect(feldzeilen({ notiz: '1K' })).toEqual(['1K']);
    expect(feldzeilen({ boeden: 0, notiz: '1K' })).toEqual(['1K']);
    expect(feldzeilen({})).toEqual([]);
  });

  it('zeichnet auch mit Zahl höchstens drei Zeilen', () => {
    // Sonst schöbe die Zahl die dritte Notizzeile aus dem Feld heraus und
    // niemand sähe, dass da noch etwas steht.
    expect(feldzeilen({ boeden: 5, notiz: 'a\nb\nc' })).toEqual(['5', 'a', 'b']);
  });

  it('rundet eine krumme Zahl', () => {
    // Eingetippt wird sie ganzzahlig; käme aus einer alten Datei etwas
    // anderes, stünde sonst „4.5+" im Feld.
    expect(feldzeilen({ boeden: 4.5 })).toEqual(['5']);
  });
});

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
  it('nimmt die Grundbodentiefe, wenn das Möbel eine hat', () => {
    // Beim Kühlmöbel ist sie die einzig richtige Angabe: Das Gehäuse ist
    // 925 tief, gestellt wird die Ware auf einen Boden von 600.
    expect(
      bodentiefeMm(moebel({ form: 'kuehlSchrank', tiefe: 92.5, grundboden: 60 })),
    ).toBe(600);
  });

  it('nennt bei einem gestuften Möbel die unterste Auflage', () => {
    // Ein Vitable T800 ist 955 tief und heißt trotzdem T800: Die Ware steht
    // auf der untersten Auflage, und nach der wird bestellt.
    expect(
      bodentiefeMm(moebel({ form: 'vitable', tiefe: 95.5, stufen: [80, 60, 40] })),
    ).toBe(800);
    // Auch beim runden Kopf, der beide Seiten trägt.
    expect(
      bodentiefeMm(
        moebel({ form: 'vitableAbschlussRund', tiefe: 182.9, beidseitig: true, stufen: [80, 60, 40] }),
      ),
    ).toBe(800);
  });

  it('zieht ein krummes Maß auf die nächste Katalogtiefe', () => {
    // Ein eingelesener Plan misst schon mal 680 statt 670. Bestellt wird
    // trotzdem ein 600er Boden — 610 gibt es nicht zu kaufen.
    expect(bodentiefeMm(moebel({ form: 'wt100', tiefe: 68 }))).toBe(600);
    expect(bodentiefeMm(moebel({ form: 'wt100', tiefe: 66 }))).toBe(600);
  });

  it('lässt ein Maß stehen, das zu keiner Katalogtiefe passt', () => {
    // Dann stimmt etwas anderes nicht, und das soll man sehen.
    expect(bodentiefeMm(moebel({ form: 'wt100', tiefe: 72 }))).toBe(650);
  });

  it('rundet nur beim Regalzug', () => {
    // Eine Bedientheke hat andere Maße; dort wäre das Runden geraten.
    expect(bodentiefeMm(moebel({ form: 'blinkTheke', tiefe: 68 }))).toBe(610);
  });

  it('nennt die Bodentiefe einer Gondel, nicht das Stellmaß', () => {
    // 2 × 600 + 70 tote Zone = 1270 tief. Bestellt wird T600.
    expect(bodentiefeMm(moebel({ tiefe: 127, beidseitig: true }))).toBe(600);
  });

  it('nennt beim Wandregal die Tiefe ohne tote Zone', () => {
    // 600er Boden plus 70 tote Zone = 670 Stellmaß.
    expect(bodentiefeMm(moebel({ tiefe: 67 }))).toBe(600);
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
