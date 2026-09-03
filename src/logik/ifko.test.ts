import { describe, expect, it } from 'vitest';
import { ifkoJeStufe, ifkoVorschlag } from './ifko';
import type { PlanElement } from '../typen/modell';

/**
 * Prüfungen für die grünen Kisten.
 *
 * Die Zahlen sind gemessen und nicht gerechnet – geprüft wird deshalb vor
 * allem, dass die Tabelle unverändert herauskommt. Sie in eine Formel zu
 * gießen wäre der Fehler: Eine ifko misst 600 × 400, aber wie viele auf eine
 * Auflage gehen, entscheidet auch, wie weit man sie überstehen lässt.
 */

function moebel(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'vt-wand-100-h1600-80-60',
    ebeneId: 'einrichtung',
    name: 'O&G',
    kategorie: 'obstgemuese',
    x: 0,
    y: 0,
    breite: 100,
    tiefe: 90,
    drehung: 0,
    form: 'vitable',
    farbe: '#8a8',
    beschriftung: '',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
    ...teil,
  } as PlanElement;
}

describe('Kisten auf einer Auflage', () => {
  it('gibt die gemessene Tabelle wieder', () => {
    expect(ifkoJeStufe(100, 40)).toBeCloseTo(5 / 3, 6);
    expect(ifkoJeStufe(100, 60)).toBe(3);
    expect(ifkoJeStufe(100, 80)).toBeCloseTo(10 / 3, 6);
    expect(ifkoJeStufe(100, 120)).toBe(6);
    expect(ifkoJeStufe(125, 40)).toBe(2);
    expect(ifkoJeStufe(125, 60)).toBe(3);
    expect(ifkoJeStufe(125, 80)).toBe(4);
    expect(ifkoJeStufe(125, 120)).toBe(6);
  });

  it('rechnet eine andere Breite hoch', () => {
    // Quer nebeneinander stehen die Kisten einfach weiter.
    expect(ifkoJeStufe(250, 120)).toBeCloseTo(12, 6);
    expect(ifkoJeStufe(50, 60)).toBeCloseTo(1.5, 6);
  });

  it('nimmt bei der Tiefe den nächsten gemessenen Fall', () => {
    // Die Tiefe entscheidet über Reihen, und eine halbe Reihe gibt es nicht.
    expect(ifkoJeStufe(100, 75)).toBe(ifkoJeStufe(100, 80));
    expect(ifkoJeStufe(100, 45)).toBe(ifkoJeStufe(100, 40));
    expect(ifkoJeStufe(100, 200)).toBe(ifkoJeStufe(100, 120));
  });

  it('nimmt bei genau der Mitte die kleinere Tiefe', () => {
    // 70 liegt zwischen 60 und 80. Die flachere Auflage anzunehmen sagt eine
    // Kiste weniger – und eine Kiste zu wenig steht in der Ecke, eine zu viel
    // wird bestellt und passt nicht.
    expect(ifkoJeStufe(100, 70)).toBe(ifkoJeStufe(100, 60));
  });

  it('gibt bei unsinnigen Maßen nichts zurück', () => {
    expect(ifkoJeStufe(0, 60)).toBe(0);
    expect(ifkoJeStufe(100, 0)).toBe(0);
  });
});

describe('Vorschlag für ein Möbel', () => {
  it('legt die Stufen zusammen', () => {
    // H1600 / T800 + T600 auf 1,00 m: 3 1/3 + 3 = 6 1/3, gerundet 6.
    expect(ifkoVorschlag(moebel({ breite: 100, stufen: [80, 60] }))).toBe(6);
    // Dasselbe Möbel in 1,25 m: 4 + 3 = 7.
    expect(ifkoVorschlag(moebel({ breite: 125, stufen: [80, 60] }))).toBe(7);
    // H1800 / T800 + T600 + T400 auf 1,00 m: 3 1/3 + 3 + 1 2/3 = genau 8.
    expect(ifkoVorschlag(moebel({ breite: 100, stufen: [80, 60, 40] }))).toBe(8);
  });

  it('verdoppelt bei einer Gondel', () => {
    // Sie trägt ihre Stufen auf beiden Seiten.
    const wand = moebel({ breite: 130, stufen: [120] });
    const gondel = moebel({ breite: 130, stufen: [120], beidseitig: true });
    expect(ifkoVorschlag(gondel)).toBe(ifkoVorschlag(wand)! * 2);
  });

  it('sagt nichts, wo das Möbel nichts über seine Stufen sagt', () => {
    // Jede Zahl wäre geraten – und geraten wandert sie in eine Bestellung.
    expect(ifkoVorschlag(moebel({ stufen: undefined }))).toBeUndefined();
    expect(ifkoVorschlag(moebel({ stufen: [] }))).toBeUndefined();
    expect(ifkoVorschlag(moebel({ breite: 0, stufen: [60] }))).toBeUndefined();
  });
});
