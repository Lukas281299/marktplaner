import { beforeEach, describe, expect, it } from 'vitest';
import { neuesProjekt } from '../daten/standardProjekt';
import { usePlanStore } from './planStore';

/**
 * Das Förderband und seine Route.
 *
 * Der Verlauf liegt relativ zum Mittelpunkt des Elements. Wird das Element
 * gedehnt, muss er mit – sonst bliebe der Zug stehen, während sein Kasten
 * wächst: im Plan ein Band, das nicht mehr füllt, was es belegt, und eine
 * leere Fläche daneben.
 */

const store = () => usePlanStore.getState();
const bandVon = (id: string) => store().projekt.elemente.find((e) => e.id === id);

describe('Förderband', () => {
  beforeEach(() => {
    store().setzeProjekt(neuesProjekt());
  });

  it('legt Kasten und Verlauf aus dem geklickten Zug an', () => {
    const id = store().fuegeFoerderbandHinzu(
      [
        { x: 100, y: 100 },
        { x: 900, y: 100 },
      ],
      40,
    )!;
    const band = bandVon(id)!;
    // 800 lang plus die halbe Bandbreite an beiden Enden.
    expect(band.breite).toBe(840);
    expect(band.tiefe).toBe(40);
    expect(band.verlauf).toHaveLength(2);
  });

  it('zieht den Verlauf beim Dehnen mit', () => {
    const id = store().fuegeFoerderbandHinzu(
      [
        { x: 0, y: 0 },
        { x: 800, y: 0 },
      ],
      40,
    )!;
    const vorher = bandVon(id)!;
    const laengeVorher = Math.abs(vorher.verlauf![1].x - vorher.verlauf![0].x);

    // Auf die doppelte Breite ziehen.
    store().aendereElemente([id], { breite: vorher.breite * 2 });

    const nachher = bandVon(id)!;
    const laengeNachher = Math.abs(nachher.verlauf![1].x - nachher.verlauf![0].x);
    expect(laengeNachher).toBeCloseTo(laengeVorher * 2, 5);
  });

  it('macht das Band beim Verlängern nicht auch breiter', () => {
    const id = store().fuegeFoerderbandHinzu(
      [
        { x: 0, y: 0 },
        { x: 800, y: 0 },
      ],
      40,
    )!;
    const vorher = bandVon(id)!;
    store().aendereElemente([id], { breite: vorher.breite * 3 });
    // Die Bandbreite folgt der kleineren Richtung – hier also unverändert.
    expect(bandVon(id)!.bandbreite).toBeCloseTo(40, 5);
  });

  it('lässt den Verlauf in Ruhe, wenn sich die Maße nicht ändern', () => {
    const id = store().fuegeFoerderbandHinzu(
      [
        { x: 0, y: 0 },
        { x: 800, y: 0 },
      ],
      40,
    )!;
    const vorher = JSON.stringify(bandVon(id)!.verlauf);
    store().aendereElemente([id], { name: 'Rollenbahn Leergut' });
    expect(JSON.stringify(bandVon(id)!.verlauf)).toBe(vorher);
  });

  it('nimmt keinen Zug aus einem einzigen Punkt an', () => {
    expect(store().fuegeFoerderbandHinzu([{ x: 0, y: 0 }], 40)).toBeNull();
  });
});
