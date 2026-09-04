import { describe, expect, it } from 'vitest';
import type { PlanElement } from '../typen/modell';
import { bauart, bezeichnungFuer, felderKurz, nachgezogeneBezeichnung } from './regalbezeichnung';

/**
 * Die Bezeichnung folgt den Maßen.
 *
 * Sie kommt beim Einsetzen aus der Bibliothek und blieb dann stehen: Ein
 * Regal, das von 1 m auf 1,25 m umgebaut wurde, hieß weiter „A1000“. Im
 * Plan stand damit eine Angabe, die man beim Bestellen abschreibt und die
 * falsch ist.
 */

const regal = (breiten: number[], zusatz: Partial<PlanElement> = {}): PlanElement =>
  ({
    id: 'el1',
    vorlageId: 'wt100',
    name: 'Wandregal A1000 · T700 · H2200',
    beschriftung: 'Wandregal A1000 · T700 · H2200',
    kategorie: 'regale',
    form: 'wt100',
    x: 0,
    y: 0,
    breite: breiten.reduce((s, b) => s + b, 0),
    // Boden 700 mm + 70 mm tote Zone – so steht es in der Bibliothek.
    tiefe: 77,
    hoehe: 220,
    drehung: 0,
    farbe: '#787878',
    ebeneId: 'einrichtung',
    gesperrt: false,
    reihenfolge: 1,
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    felderUnten: breiten.map((b) => ({ breite: b })),
    ...zusatz,
  }) as PlanElement;

describe('Felder als Kurzschrift', () => {
  it('schreibt ein einzelnes Feld ohne Anzahl', () => {
    expect(felderKurz([100])).toBe('A1000');
  });

  it('fasst gleiche Maße zusammen', () => {
    expect(felderKurz([100, 100, 100])).toBe('3× A1000');
  });

  it('nennt gemischte Züge in ihrer Reihenfolge', () => {
    expect(felderKurz([100, 100, 100, 125, 125, 125])).toBe('3× A1000 · 3× A1250');
  });

  it('trennt gleiche Maße, die nicht nebeneinander liegen', () => {
    // So steht es auch am Möbel: erst zwei, dann eins anderes, dann wieder zwei.
    expect(felderKurz([125, 125, 100, 125, 125])).toBe('2× A1250 · 1× A1000 · 2× A1250');
  });
});

describe('Bauart aus der bisherigen Bezeichnung', () => {
  it('behält den Namen vor den Maßen', () => {
    expect(bauart('Wandregal A1000 · T700 · H2200')).toBe('Wandregal');
    expect(bauart('Gondel A1250 · T2×700 · H1800')).toBe('Gondel');
    expect(bauart('Gondelzug 3× A1250 · T2×700')).toBe('Gondelzug');
  });

  it('lässt eine Bezeichnung ohne Maße unangetastet', () => {
    expect(bauart('Aktionsfläche Ostern')).toBe('Aktionsfläche Ostern');
  });
});

describe('Vollständige Bezeichnung', () => {
  it('zieht mit, wenn das Feldmaß sich ändert', () => {
    expect(bezeichnungFuer(regal([125]))).toBe('Wandregal A1250 · T700 · H2200');
  });

  it('nennt einen gemischten Zug genau so, wie er gebaut ist', () => {
    expect(bezeichnungFuer(regal([100, 100, 100, 125, 125, 125]))).toBe(
      'Wandregal 3× A1000 · 3× A1250 · T700 · H2200',
    );
  });

  it('schreibt bei beidseitigen Möbeln die Tiefe je Seite', () => {
    const gondel = regal([125, 125], {
      beidseitig: true,
      // 2 × 700 mm Boden + 70 mm tote Zone dazwischen.
      tiefe: 147,
      beschriftung: 'Gondel A1250 · T2×700 · H1800',
      hoehe: 180,
    });
    expect(bezeichnungFuer(gondel)).toBe('Gondel 2× A1250 · T2×700 · H1800');
  });

  it('nennt die Bodentiefe und nicht das halbe Stellmaß', () => {
    // Eine Gondel aus zwei 700er Böden steht 1470 mm tief – 70 mm davon sind
    // die tote Zone dazwischen. Die Hälfte des Stellmaßes wären 735, und die
    // gibt es nicht zu bestellen.
    const gondel = {
      ...regal([125, 125]),
      beidseitig: true,
      tiefe: 147,
      hoehe: 180,
      beschriftung: 'Gondel A1250 · T2×999 · H1800',
    } as PlanElement;
    expect(bezeichnungFuer(gondel)).toContain('T2×700');
  });

  it('lässt ein Möbel ohne Felder in Ruhe', () => {
    const palette = regal([], { felderUnten: undefined, form: 'palette' });
    expect(bezeichnungFuer(palette)).toBeUndefined();
  });
});

describe('Jede Abteilung in ihrer eigenen Schreibweise', () => {
  const moebel = (zusatz: Partial<PlanElement>): PlanElement =>
    regal([], { felderUnten: undefined, ...zusatz });

  it('zählt Achsmaße im Trockensortiment', () => {
    expect(bezeichnungFuer(regal([125, 125]))).toBe('Wandregal 2× A1250 · T700 · H2200');
  });

  it('zählt Kühlmöbel einzeln – 5,00 m am Stück gibt es nicht', () => {
    const kuehl = moebel({
      form: 'kuehlOffen',
      name: 'Kühlregal 2,50 m · offen',
      beschriftung: 'Kühlregal 2,50 m · offen',
      breite: 500,
      tiefe: 112.5,
      hoehe: 209,
      felderUnten: [{ breite: 250 }, { breite: 250 }],
    });
    expect(bezeichnungFuer(kuehl)).toBe('Kühlregal 2× 2,50 m · offen');
  });

  it('nennt eine Tiefkühlinsel bei ihrer Gesamtlänge, nicht in halben Metern', () => {
    // Drei Module à 625 mm sind im Katalog eine Truhe von 1,88 m.
    const truhe = moebel({
      form: 'tkTruhe',
      name: 'TK-Truhe einseitig 1,88 m',
      beschriftung: 'TK-Truhe einseitig 1,88 m',
      breite: 187.5,
      tiefe: 112.1,
      hoehe: 98.7,
      felderUnten: [{ breite: 62.5 }, { breite: 62.5 }, { breite: 62.5 }],
    });
    expect(bezeichnungFuer(truhe)).toBe('TK-Truhe einseitig 1,88 m');

    // Zwei Module länger – und die Bezeichnung zieht mit.
    const laenger = { ...truhe, breite: 312.5, felderUnten: Array(5).fill({ breite: 62.5 }) };
    expect(bezeichnungFuer(laenger)).toBe('TK-Truhe einseitig 3,13 m');
  });

  it('zählt ein wirklich gemischtes Möbel auf', () => {
    const kuehl = moebel({
      form: 'kuehlOffen',
      name: 'Kühlregal 2,50 m · offen',
      beschriftung: 'Kühlregal 2,50 m · offen',
      breite: 437.5,
      felderUnten: [{ breite: 250 }, { breite: 187.5 }],
    });
    expect(bezeichnungFuer(kuehl)).toBe('Kühlregal 1× 2,50 m · 1× 1,88 m · offen');
  });

  it('lässt die zusammengesetzte Tiefe von Obst und Gemüse stehen', () => {
    // „T1200+600“ meint hinten und vorn – das kann niemand nachrechnen.
    const og = moebel({
      form: 'vitable',
      name: 'O&G 1,00 m · H1800 · T1200+600',
      beschriftung: 'O&G 1,00 m · H1800 · T1200+600',
      breite: 225,
      hoehe: 180,
      felderUnten: [{ breite: 125 }, { breite: 100 }],
    });
    expect(bezeichnungFuer(og)).toBe('O&G 1× 1,25 m · 1× 1,00 m · H1800 · T1200+600');
  });

  it('wirft die alte Feldzahl eines Gondelzugs weg, statt sie doppelt zu nennen', () => {
    const zug = regal([100, 100, 100], {
      beidseitig: true,
      // 2 × 700 mm Boden + 70 mm tote Zone dazwischen.
      tiefe: 147,
      beschriftung: 'Gondelzug 3,00 m · 3 Felder A1000 · T2×700',
    });
    expect(bezeichnungFuer(zug)).toBe('Gondelzug 3× A1000 · T2×700');
  });

  it('fasst eine Kasse oder eine Palette nicht an', () => {
    // Sie sind aus keinen Einheiten gebaut – ein Achsmaß wäre erfunden.
    const kasse = moebel({
      form: 'kasse',
      name: 'Einzelstehkasse · Band 1500 mm',
      beschriftung: 'Einzelstehkasse · Band 1500 mm',
      felderUnten: [{ breite: 120 }],
    });
    expect(bezeichnungFuer(kasse)).toBeUndefined();
  });
});

describe('Nachziehen in vorhandenen Planungen', () => {
  it('zieht ein umgebautes Regal nach', () => {
    const umgebaut = regal([100, 100, 100, 125, 125, 125], {
      beschriftung: 'Wandregal A1000 · T700 · H2200',
    });
    expect(nachgezogeneBezeichnung(umgebaut)).toBe(
      'Wandregal 3× A1000 · 3× A1250 · T700 · H2200',
    );
  });

  it('lässt einen selbst geschriebenen Namen ohne Maß in Ruhe', () => {
    // In alten Planungen fehlt das Kennzeichen für eigene Texte. Ein Regal,
    // das „Kaffee“ heißt, darf davon nichts merken.
    const eigen = regal([125], { beschriftung: 'Kaffee', beschriftungAutomatisch: undefined });
    expect(nachgezogeneBezeichnung(eigen)).toBeUndefined();
  });

  it('achtet das Kennzeichen, wenn es gesetzt ist', () => {
    const eigen = regal([125], {
      beschriftung: 'Wandregal A1000 · T700 · H2200',
      beschriftungAutomatisch: false,
    });
    expect(nachgezogeneBezeichnung(eigen)).toBeUndefined();
  });

  it('meldet nichts, wenn schon alles stimmt', () => {
    expect(nachgezogeneBezeichnung(regal([100]))).toBeUndefined();
  });
});
