import { describe, expect, it } from 'vitest';
import { kopflage, kopfmasse } from './kopfgondel';
import type { PlanElement } from '../typen/modell';

/**
 * Prüfungen für die Lage einer Kopfgondel.
 *
 * Der Kopf steht mit dem **Rücken am Zug** und schaut in den Gang. Das ist
 * keine Feinheit: Beim wire-tech-Regal liegt die tote Zone hinten und die
 * Front an der gegenüberliegenden Kante, und an der Front stehen Notiz und
 * Warengruppe. Zeigt sie zum Zug, steht die Beschriftung mitten in der
 * Gondel statt im Gang — und die Böden zeigen ins Regal.
 */

const zug = (drehung = 0): Pick<PlanElement, 'x' | 'y' | 'breite' | 'tiefe' | 'drehung'> => ({
  x: 1000,
  y: 1000,
  breite: 600,
  tiefe: 127,
  drehung,
});

/**
 * Der Punkt, an dem die Front der Kopfgondel liegt – in Weltkoordinaten.
 *
 * Vorn ist beim wire-tech-Regal die Kante bei der eigenen Tiefe; hinten, bei
 * null, sitzt die tote Zone. Gerechnet wird von der Mitte aus, deshalb die
 * halbe Tiefe.
 */
function frontpunkt(lage: { x: number; y: number; drehung: number }, tiefe: number) {
  const bogen = (lage.drehung * Math.PI) / 180;
  // Die eigene y-Achse in Weltkoordinaten.
  return {
    x: lage.x + (-Math.sin(bogen) * tiefe) / 2,
    y: lage.y + (Math.cos(bogen) * tiefe) / 2,
  };
}

const abstandZumZug = (punkt: { x: number; y: number }, mitte: { x: number; y: number }) =>
  Math.hypot(punkt.x - mitte.x, punkt.y - mitte.y);

describe('Kopfgondel schaut in den Gang', () => {
  for (const drehung of [0, 45, 90, 180, 270]) {
    for (const seite of ['anfang', 'ende'] as const) {
      it(`bei ${drehung}° am ${seite}`, () => {
        const el = zug(drehung);
        const masse = kopfmasse(el.tiefe);
        const lage = kopflage(el, seite);
        const front = frontpunkt(lage, masse.tiefe);
        const ruecken = {
          x: 2 * lage.x - front.x,
          y: 2 * lage.y - front.y,
        };

        // Der Rücken liegt näher am Zug als die Front.
        expect(abstandZumZug(ruecken, el)).toBeLessThan(abstandZumZug(front, el));
      });
    }
  }

  it('setzt die beiden Köpfe an die zwei Enden', () => {
    const el = zug(0);
    const masse = kopfmasse(el.tiefe);
    const anfang = kopflage(el, 'anfang');
    const ende = kopflage(el, 'ende');

    expect(anfang.x).toBeCloseTo(el.x - el.breite / 2 - masse.tiefe / 2, 3);
    expect(ende.x).toBeCloseTo(el.x + el.breite / 2 + masse.tiefe / 2, 3);
    expect(anfang.y).toBeCloseTo(el.y, 3);
    expect(ende.y).toBeCloseTo(el.y, 3);
  });

  it('stellt die Kopfgondel quer zum Zug', () => {
    // Ihre Breite läuft über die Tiefe des Zugs, nicht neben ihm her.
    const lage = kopflage(zug(0), 'ende');
    expect([90, 270]).toContain(lage.drehung);
  });
});
