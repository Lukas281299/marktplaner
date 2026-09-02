import { describe, expect, it } from 'vitest';
import { neuesProjekt } from '../daten/standardProjekt';
import type { Projekt, Punkt, Wand } from '../typen/modell';
import {
  aufWinkelraster,
  fangeAufEcke,
  fangeNeueWand,
  fangeWand,
  fangeWandende,
  grundrissEcken,
  rasteGrad,
} from './wandfang';

/**
 * Wände sollen aneinander einrasten – aber nur da, wo es der Planer erwartet.
 *
 * Ein zu gieriger Fang ist schlimmer als gar keiner: Wenn eine Wand
 * unaufgefordert drei Meter weit springt, weiß niemand mehr, wo sie wirklich
 * steht. Deshalb prüfen diese Tests beides – dass es fängt und dass es
 * loslässt.
 */

function wand(id: string, von: Punkt, bis: Punkt): Wand {
  return { id, von, bis, staerke: 24, art: 'trennwand', gesperrt: false };
}

function projektMit(waende: Wand[]): Projekt {
  return { ...neuesProjekt('Probe', 2000, 1000), waende };
}

describe('Grundrissecken', () => {
  it('nimmt die Gebäudeecken und die Wandenden mit', () => {
    const ecken = grundrissEcken(projektMit([wand('a', { x: 300, y: 0 }, { x: 300, y: 600 })]));
    expect(ecken).toContainEqual({ x: 0, y: 0 });
    expect(ecken).toContainEqual({ x: 2000, y: 1000 });
    expect(ecken).toContainEqual({ x: 300, y: 600 });
  });

  it('lässt die gezogene Wand selbst aus', () => {
    // Sonst rastete sie an ihren eigenen Enden ein und stünde still.
    const projekt = projektMit([wand('a', { x: 300, y: 0 }, { x: 300, y: 600 })]);
    const ecken = grundrissEcken(projekt, 'a');
    expect(ecken).not.toContainEqual({ x: 300, y: 600 });
  });
});

describe('Wand einrasten', () => {
  const ecken = [
    { x: 500, y: 200 },
    { x: 500, y: 900 },
  ];

  it('zieht ein Wandende auf eine Ecke – beide Achsen zugleich', () => {
    // Die Wand läge nach dem rohen Zug bei 494/196, sieben Zentimeter daneben.
    const ergebnis = fangeWand(
      { von: { x: 0, y: 0 }, bis: { x: 400, y: 0 } },
      { dx: 94, dy: 196 },
      ecken,
      20,
    );
    expect(ergebnis.dx).toBe(100);
    expect(ergebnis.dy).toBe(200);
    expect(ergebnis.gefangenX).toBe(true);
    expect(ergebnis.gefangenY).toBe(true);
  });

  it('richtet an einer Flucht aus, ohne die andere Achse anzufassen', () => {
    // Nur x liegt in Reichweite: y bleibt roh, das Raster übernimmt es.
    const ergebnis = fangeWand(
      { von: { x: 0, y: 0 }, bis: { x: 0, y: 300 } },
      { dx: 494, dy: 37 },
      ecken,
      20,
    );
    expect(ergebnis.dx).toBe(500);
    expect(ergebnis.gefangenX).toBe(true);
    expect(ergebnis.dy).toBe(37);
    expect(ergebnis.gefangenY).toBe(false);
  });

  it('lässt los, wenn nichts in Reichweite ist', () => {
    const ergebnis = fangeWand(
      { von: { x: 0, y: 0 }, bis: { x: 400, y: 0 } },
      { dx: 12, dy: 13 },
      ecken,
      20,
    );
    expect(ergebnis).toMatchObject({ dx: 12, dy: 13, gefangenX: false, gefangenY: false });
    expect(ergebnis.hilfslinien).toEqual([]);
  });

  it('nimmt die nächste Ecke, nicht die erstbeste', () => {
    const nah = [
      { x: 500, y: 200 },
      { x: 508, y: 200 },
    ];
    const ergebnis = fangeWand(
      { von: { x: 0, y: 0 }, bis: { x: 400, y: 0 } },
      { dx: 507, dy: 200 },
      nah,
      20,
    );
    expect(ergebnis.dx).toBe(508);
  });

  it('darf auch mit dem hinteren Ende einrasten', () => {
    const ergebnis = fangeWand(
      { von: { x: 0, y: 200 }, bis: { x: 400, y: 200 } },
      { dx: 96, dy: 0 },
      ecken,
      20,
    );
    // 400 + 96 = 496 → auf 500 gezogen, das Ende trifft die Ecke.
    expect(ergebnis.dx).toBe(100);
  });

  it('blendet zu jedem Fang eine Hilfslinie ein', () => {
    const ergebnis = fangeWand(
      { von: { x: 0, y: 0 }, bis: { x: 0, y: 300 } },
      { dx: 494, dy: 37 },
      ecken,
      20,
    );
    expect(ergebnis.hilfslinien).toHaveLength(1);
    expect(ergebnis.hilfslinien[0]).toMatchObject({ richtung: 'senkrecht', position: 500 });
  });
});

describe('Punkt auf eine Ecke ziehen', () => {
  const ecken = [{ x: 500, y: 200 }];

  it('fängt, was nah genug dran ist', () => {
    expect(fangeAufEcke({ x: 506, y: 197 }, ecken, 20)).toEqual({ x: 500, y: 200 });
  });

  it('lässt in Ruhe, was zu weit weg ist', () => {
    expect(fangeAufEcke({ x: 560, y: 197 }, ecken, 20)).toEqual({ x: 560, y: 197 });
  });
});

describe('Neue Wand einrasten', () => {
  // Eine waagerechte Wand von 16,00 m bis 27,50 m auf Höhe 5,50 m.
  const ecken = [
    { x: 1600, y: 550 },
    { x: 2750, y: 550 },
  ];

  it('hängt den Anfang an eine vorhandene Wandecke', () => {
    const { von, bis } = fangeNeueWand({ x: 1620, y: 570 }, { x: 1620, y: 900 }, ecken, 40);
    expect(von).toEqual({ x: 1600, y: 550 });
    // Und das Ende richtet sich nach dem gefangenen Anfang aus.
    expect(bis).toEqual({ x: 1600, y: 900 });
  });

  it('zieht auch das Ende auf eine Ecke und nimmt den Anfang quer mit', () => {
    // Von unten nach oben gezogen: Der Anfang hängt an nichts, das Ende zielt
    // auf die Wandecke. Damit die Wand senkrecht bleibt, wandert der Anfang
    // in x mit.
    const { von, bis } = fangeNeueWand({ x: 1620, y: 900 }, { x: 1615, y: 572 }, ecken, 40);
    expect(bis).toEqual({ x: 1600, y: 550 });
    expect(von).toEqual({ x: 1600, y: 900 });
  });

  it('lässt eine Wand im Nirgendwo in Ruhe – nur gerade wird sie', () => {
    const { von, bis } = fangeNeueWand({ x: 100, y: 100 }, { x: 105, y: 800 }, ecken, 40);
    expect(von).toEqual({ x: 100, y: 100 });
    expect(bis).toEqual({ x: 100, y: 800 });
  });
});

describe('Winkelraster', () => {
  const von = { x: 0, y: 0 };
  /** Der Winkel des Ergebnisses in Grad, gerundet. */
  const winkel = (p: { x: number; y: number }) =>
    Math.round(((Math.atan2(p.y - von.y, p.x - von.x) * 180) / Math.PI) * 10) / 10;

  it('macht aus einer fast schrägen Wand eine genaue 45°-Schräge', () => {
    // Von Hand gezogen kommt 43,6° heraus – im Plan steht dann eine Schräge,
    // die nirgends anschließt.
    const bis = aufWinkelraster(von, { x: 500, y: 476 });
    expect(winkel(bis)).toBe(45);
  });

  it('kennt auch 30 und 60 Grad', () => {
    expect(winkel(aufWinkelraster(von, { x: 500, y: 291 }))).toBe(30);
    expect(winkel(aufWinkelraster(von, { x: 291, y: 500 }))).toBe(60);
  });

  it('behält die Länge beim Ausrichten', () => {
    // Auf den hundertstel Zentimeter: Die Koordinaten werden gerundet, damit
    // im Plan keine Zahl mit zwölf Nachkommastellen steht.
    const bis = aufWinkelraster(von, { x: 500, y: 476 });
    expect(Math.hypot(bis.x, bis.y)).toBeCloseTo(Math.hypot(500, 476), 1);
  });

  it('lässt eine bewusst schiefe Wand schief', () => {
    // 38° ist zu weit von 30 und 45 entfernt – wer das zieht, meint es so.
    const roh = { x: 500, y: 390 };
    expect(aufWinkelraster(von, roh)).toBe(roh);
  });

  it('nimmt bei waagerecht und senkrecht die Koordinate statt zu rechnen', () => {
    // Sonst würden aus 5,00 m beim Drehen 4,999 m.
    expect(aufWinkelraster(von, { x: 500, y: 40 })).toEqual({ x: 500, y: 0 });
    expect(aufWinkelraster(von, { x: 40, y: 500 })).toEqual({ x: 0, y: 500 });
  });
});

describe('Wandende ziehen', () => {
  const fest = { x: 0, y: 0 };
  const raster = (p: Punkt) => ({ x: Math.round(p.x / 50) * 50, y: Math.round(p.y / 50) * 50 });

  it('lässt die Wand sich drehen, statt sie auf der Achse zu halten', () => {
    // Das war der Fehler: Eine waagerechte Wand blieb waagerecht, egal wohin
    // man ihr Ende zog.
    const ziel = fangeWandende(fest, { x: 500, y: 476 }, [], 20, raster);
    expect(Math.round((Math.atan2(ziel.y, ziel.x) * 180) / Math.PI)).toBe(45);
  });

  it('rastet weiter an einer Grundrissecke ein – die schlägt den Winkel', () => {
    const ecken = [{ x: 512, y: 137 }];
    expect(fangeWandende(fest, { x: 505, y: 140 }, ecken, 20, raster)).toEqual({ x: 512, y: 137 });
  });

  it('nimmt auf den Achsen weiter das Raster', () => {
    expect(fangeWandende(fest, { x: 487, y: 6 }, [], 20, raster)).toEqual({ x: 500, y: 0 });
  });
});

describe('Winkel am Drehregler', () => {
  it('zieht einen fast geraden Winkel auf das Raster', () => {
    expect(rasteGrad(44)).toBe(45);
    expect(rasteGrad(-2.4)).toBe(0);
    expect(rasteGrad(88)).toBe(90);
  });

  it('lässt einen Winkel zwischen zwei Rasterpunkten stehen', () => {
    // 37 ist von 30 wie von 45 zu weit weg – wer das einstellt, meint es so.
    expect(rasteGrad(36.6)).toBe(36.6);
  });

  it('hebt das Einrasten mit der freien Wahl auf', () => {
    expect(rasteGrad(44, true)).toBe(44);
    expect(rasteGrad(89.7, true)).toBe(89.7);
  });

  it('bringt jeden Winkel auf -180 bis 180', () => {
    expect(rasteGrad(190, true)).toBe(-170);
    expect(rasteGrad(-190, true)).toBe(170);
    expect(rasteGrad(720, true)).toBe(0);
  });
});
