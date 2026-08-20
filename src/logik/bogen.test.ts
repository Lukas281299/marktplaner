import { describe, expect, it } from 'vitest';
import { bogenPunkte, entdoppele, kreismittelpunkt, taugtAlsUmriss } from './bogen';
import type { Punkt } from '../typen/modell';

/** Abstand eines Punktes vom Mittelpunkt. */
function radius(p: Punkt, mitte: Punkt): number {
  return Math.hypot(p.x - mitte.x, p.y - mitte.y);
}

describe('Kreismittelpunkt', () => {
  it('findet die Mitte eines Halbkreises', () => {
    // Durch (-100,0), (0,100) und (100,0) geht der Kreis um den Ursprung.
    const mitte = kreismittelpunkt({ x: -100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 0 })!;
    expect(mitte.x).toBeCloseTo(0, 6);
    expect(mitte.y).toBeCloseTo(0, 6);
  });

  it('gibt bei drei Punkten auf einer Geraden nichts zurück', () => {
    expect(kreismittelpunkt({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 })).toBeUndefined();
  });

  it('behandelt einen riesigen Radius wie eine Gerade', () => {
    // Eine Ausbuchtung von einem Zehntelmillimeter auf zehn Metern.
    const fastGerade = kreismittelpunkt({ x: 0, y: 0 }, { x: 500, y: 0.01 }, { x: 1000, y: 0 });
    expect(fastGerade).toBeUndefined();
  });
});

describe('Bogen als Polygonzug', () => {
  it('läuft von Anfang zu Ende und trifft das Ende genau', () => {
    const punkte = bogenPunkte({ x: -100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 0 });
    expect(punkte.length).toBeGreaterThan(4);
    const letzter = punkte[punkte.length - 1];
    expect(letzter.x).toBeCloseTo(100, 9);
    expect(letzter.y).toBeCloseTo(0, 9);
  });

  it('gibt den Anfangspunkt nicht mit zurück', () => {
    const punkte = bogenPunkte({ x: -100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 0 });
    expect(punkte[0].x).not.toBeCloseTo(-100, 3);
  });

  it('hält alle Punkte auf dem Kreis', () => {
    const von = { x: -100, y: 0 };
    const durch = { x: 0, y: 100 };
    const bis = { x: 100, y: 0 };
    const mitte = kreismittelpunkt(von, durch, bis)!;
    const soll = radius(von, mitte);
    for (const p of bogenPunkte(von, durch, bis).slice(0, -1)) {
      expect(radius(p, mitte)).toBeCloseTo(soll, 6);
    }
  });

  it('bleibt auf der Seite, zu der gezogen wurde', () => {
    // Nach oben gezogen: Der Bogen muss oberhalb der Verbindungslinie liegen.
    const nachOben = bogenPunkte({ x: -100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 0 });
    expect(Math.max(...nachOben.map((p) => p.y))).toBeGreaterThan(50);

    // Nach unten gezogen: spiegelbildlich.
    const nachUnten = bogenPunkte({ x: -100, y: 0 }, { x: 0, y: -100 }, { x: 100, y: 0 });
    expect(Math.min(...nachUnten.map((p) => p.y))).toBeLessThan(-50);
  });

  it('wird bei einer geraden Ziehbewegung zur Strecke', () => {
    expect(bogenPunkte({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 })).toEqual([
      { x: 100, y: 0 },
    ]);
  });

  it('gibt einem flachen Bogen weniger Punkte als einem runden', () => {
    const flach = bogenPunkte({ x: 0, y: 0 }, { x: 500, y: 20 }, { x: 1000, y: 0 });
    const rund = bogenPunkte({ x: -100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 0 });
    expect(flach.length).toBeLessThan(rund.length);
  });
});

describe('Zug aufräumen', () => {
  it('wirft doppelte Punkte weg', () => {
    const zug = entdoppele([
      { x: 0, y: 0 },
      { x: 0, y: 0.1 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(zug).toHaveLength(3);
  });

  it('entfernt einen Schlusspunkt, der auf dem Anfang liegt', () => {
    const zug = entdoppele([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 0.2 },
    ]);
    expect(zug).toHaveLength(3);
  });

  it('lässt einen sauberen Zug in Ruhe', () => {
    const zug = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(entdoppele(zug)).toEqual(zug);
  });
});

describe('Taugt als Umriss', () => {
  it('braucht mindestens drei Punkte', () => {
    expect(taugtAlsUmriss([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(false);
    expect(
      taugtAlsUmriss([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ]),
    ).toBe(true);
  });

  it('lehnt einen Zug ab, dessen Punkte alle aufeinanderliegen', () => {
    expect(
      taugtAlsUmriss([
        { x: 5, y: 5 },
        { x: 5.2, y: 5 },
        { x: 5, y: 5.3 },
      ]),
    ).toBe(false);
  });
});
