import { describe, expect, it } from 'vitest';
import type { PlanElement } from '../typen/modell';
import { bauart, bezeichnungFuer, felderKurz } from './regalbezeichnung';

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
    tiefe: 70,
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
      tiefe: 140,
      beschriftung: 'Gondel A1250 · T2×700 · H1800',
      hoehe: 180,
    });
    expect(bezeichnungFuer(gondel)).toBe('Gondel 2× A1250 · T2×700 · H1800');
  });

  it('lässt ein Möbel ohne Felder in Ruhe', () => {
    const palette = regal([], { felderUnten: undefined, form: 'palette' });
    expect(bezeichnungFuer(palette)).toBeUndefined();
  });
});
