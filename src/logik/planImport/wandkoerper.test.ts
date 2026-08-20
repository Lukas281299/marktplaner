import { describe, expect, it } from 'vitest';
import {
  farbeGleich,
  findeWandfarbe,
  mittelpunkt,
  nurImGebaeude,
  polygonflaeche,
  teileEin,
  rahmenAlsUmriss,
  type Fuellflaeche,
} from './wandkoerper';
import { mmJePunkt } from './massstab';
import type { Punkt } from '../../typen/modell';
import type { Farbe } from './typen';

/**
 * Prüfungen für die Wandkörper.
 *
 * Gebaut werden hier Flächen so, wie ein CAD-Plan sie zeichnet: Wände als
 * dünne Ringe, Stützen als kleine massive Blöcke, Möbel als große massive
 * Blöcke. Die Zahlen sind an einem echten Plan abgelesen – dort ist die
 * Außenwand 300 mm stark, eine Stütze 300 × 300, ein Obst-und-Gemüse-Tisch
 * 1244 × 790.
 */

const JE_PUNKT = mmJePunkt(100);
const GRAU: Farbe = [0.41, 0.41, 0.41];

/** Ein Punkt aus Millimetern. */
function mm(x: number, y: number): Punkt {
  return { x: x / JE_PUNKT, y: y / JE_PUNKT };
}

/** Ein massiver Block, Maße in Millimetern. */
function block(x: number, y: number, breite: number, hoehe: number, fuellung = GRAU): Fuellflaeche {
  return {
    fuellung,
    punkte: [mm(x, y), mm(x + breite, y), mm(x + breite, y + hoehe), mm(x, y + hoehe)],
  };
}

/**
 * Ein Wandring: ein Rechteck mit einem Loch, als ein Umlauf gezeichnet.
 * Genau so liegen die Wandkörper im PDF – ein Zug, der außen herum und innen
 * wieder zurück läuft.
 */
function ring(x: number, y: number, breite: number, hoehe: number, staerke: number): Fuellflaeche {
  const i = staerke;
  return {
    fuellung: GRAU,
    punkte: [
      mm(x, y),
      mm(x + breite, y),
      mm(x + breite, y + hoehe),
      mm(x, y + hoehe),
      mm(x, y),
      mm(x + i, y + i),
      mm(x + i, y + hoehe - i),
      mm(x + breite - i, y + hoehe - i),
      mm(x + breite - i, y + i),
      mm(x + i, y + i),
    ],
  };
}

describe('Polygonfläche', () => {
  it('rechnet ein Rechteck richtig', () => {
    const q = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ];
    expect(polygonflaeche(q)).toBeCloseTo(50, 9);
  });

  it('kümmert sich nicht um den Umlaufsinn', () => {
    const q = [
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 10, y: 5 },
      { x: 10, y: 0 },
    ];
    expect(polygonflaeche(q)).toBeCloseTo(50, 9);
  });
});

describe('Einteilung der grauen Flächen', () => {
  it('erkennt einen Wandring als Wand', () => {
    const [k] = teileEin([ring(0, 0, 20000, 12000, 300)], JE_PUNKT);
    expect(k.art).toBe('wand');
    expect(k.sicherheit).toBe('sicher');
    expect(k.begruendung).toContain('Ringförmig');
    expect(Math.round(k.breiteMm)).toBe(20000);
  });

  it('erkennt eine Stütze', () => {
    const [k] = teileEin([block(5000, 5000, 300, 300)], JE_PUNKT);
    expect(k.art).toBe('stuetze');
    expect(Math.round(k.breiteMm)).toBe(300);
  });

  it('erkennt einen 240er Pfeiler', () => {
    expect(teileEin([block(0, 0, 240, 240)], JE_PUNKT)[0].art).toBe('stuetze');
  });

  it('hält einen Obst-und-Gemüse-Tisch für kein Bauteil', () => {
    // Im echten Plan sind 24 der 66 grauen Flächen solche Tische.
    const [k] = teileEin([block(0, 0, 1244, 790)], JE_PUNKT);
    expect(k.art).toBe('fremd');
    expect(k.begruendung).toContain('Möbel in der Wandfarbe');
  });

  it('wirft Bruchstücke aus der Legende weg', () => {
    const [k] = teileEin([block(0, 0, 103, 125)], JE_PUNKT);
    expect(k.art).toBe('fremd');
    expect(k.begruendung).toContain('zu klein');
  });

  it('teilt eine ganze Mischung richtig ein', () => {
    const koerper = teileEin(
      [
        ring(0, 0, 40000, 25000, 300),
        ring(5000, 5000, 12000, 8000, 240),
        block(20000, 10000, 300, 300),
        block(22000, 10000, 300, 500),
        block(3000, 3000, 1244, 790),
        block(30000, 20000, 1429, 1429),
        block(60000, 60000, 103, 125),
      ],
      JE_PUNKT,
    );
    const zaehle = (art: string) => koerper.filter((k) => k.art === art).length;
    expect(zaehle('wand')).toBe(2);
    expect(zaehle('stuetze')).toBe(2);
    expect(zaehle('fremd')).toBe(3);
  });
});

describe('Wandfarbe finden', () => {
  it('nimmt die Farbe mit den meisten großen Ringen', () => {
    const blau: Farbe = [0.06, 0.48, 0.82];
    const flaechen = [
      ring(0, 0, 40000, 25000, 300),
      ring(5000, 5000, 12000, 8000, 300),
      ring(20000, 2000, 9000, 6000, 300),
      // Kühlmöbel in Blau, massiv – dürfen nicht gewinnen.
      block(1000, 1000, 7500, 1200, blau),
      block(9000, 1000, 7500, 1200, blau),
      block(17000, 1000, 7500, 1200, blau),
    ];
    const farbe = findeWandfarbe(flaechen)!;
    expect(farbeGleich(farbe, GRAU)).toBe(true);
  });

  it('gibt nichts zurück, wenn es gar keine Ringe gibt', () => {
    expect(findeWandfarbe([block(0, 0, 1000, 1000), block(2000, 0, 1000, 1000)])).toBeUndefined();
  });

  it('lässt sich von einem einzelnen Ring nicht überzeugen', () => {
    // Ein Ring allein ist noch kein Gebäude – das könnte auch ein
    // Rahmen um die Legende sein.
    expect(findeWandfarbe([ring(0, 0, 40000, 25000, 300)])).toBeUndefined();
  });
});

describe('Rahmen als Umriss', () => {
  it('legt ein Rechteck um alle baulichen Körper', () => {
    const koerper = teileEin(
      [ring(0, 0, 40000, 25000, 300), block(50000, 30000, 300, 300), block(3000, 3000, 1244, 790)],
      JE_PUNKT,
    );
    const umriss = rahmenAlsUmriss(koerper, JE_PUNKT);
    expect(umriss).toHaveLength(4);
    const xs = umriss.map((p) => p.x);
    const ys = umriss.map((p) => p.y);
    // Der Möbelblock zählt nicht mit, die Stütze bei 50/30 m schon.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(5030, 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(3030, 0);
  });

  it('gibt ohne bauliche Körper nichts zurück', () => {
    expect(rahmenAlsUmriss(teileEin([block(0, 0, 1244, 790)], JE_PUNKT), JE_PUNKT)).toEqual([]);
  });
});

describe('Was außerhalb liegt', () => {
  it('wirft weg, was weit neben dem Gebäude steht', () => {
    const koerper = teileEin(
      [
        ring(0, 0, 40000, 25000, 300),
        block(20000, 10000, 300, 300),
        // Die Schnittzeichnung unter dem Plan.
        block(10000, 60000, 400, 400),
      ],
      JE_PUNKT,
    );
    const drin = nurImGebaeude(koerper, 2000, JE_PUNKT);
    expect(drin).toHaveLength(2);
  });
});

describe('Mittelpunkt', () => {
  it('liegt in der Mitte der Bounding-Box', () => {
    const p = mittelpunkt([mm(1000, 2000), mm(1300, 2000), mm(1300, 2400), mm(1000, 2400)]);
    expect(p.x * JE_PUNKT).toBeCloseTo(1150, 6);
    expect(p.y * JE_PUNKT).toBeCloseTo(2200, 6);
  });
});
