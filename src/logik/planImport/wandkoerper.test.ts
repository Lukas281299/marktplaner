import { describe, expect, it } from 'vitest';
import {
  farbeGleich,
  findeWandfarbe,
  mittelpunkt,
  nurImGebaeude,
  polygonflaeche,
  teileEin,
  rahmenAlsUmriss,
  zentrierterUmriss,
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

  it('nimmt jeden Block, der dünner als 350 mm ist, als Mauerwerk', () => {
    // Die verlässlichste Regel der ganzen Einteilung: In diesem Plan sind
    // Wände und Pfeiler 240 bis 300 mm stark, und ein Regal gibt es in
    // dieser Tiefe nicht.
    for (const [b, h] of [[300, 929], [255, 690], [801, 300], [300, 800]]) {
      const [k] = teileEin([block(0, 0, b, h)], JE_PUNKT);
      expect(k.art).toBe('stuetze');
      expect(k.sicherheit).toBe('sicher');
    }
  });

  it('hält ein 820 × 473 großes Kopfregal für kein Bauteil', () => {
    // Vier davon stehen im Plan an den Gondelenden. Sie sind massiv wie eine
    // Stütze, aber mit 473 mm zu dick für Mauerwerk – und sie wiederholen
    // sich.
    const koerper = teileEin(
      [block(0, 0, 820, 473), block(3000, 0, 820, 480), block(6000, 0, 820, 473)],
      JE_PUNKT,
    );
    expect(koerper.every((k) => k.art === 'fremd')).toBe(true);
    expect(koerper[0].begruendung).toContain('Serie');
  });

  it('lässt eine einzelne große Stütze durch', () => {
    // 925 × 960 mm, kreuzförmig, kommt genau einmal vor – das ist eine
    // echte Stütze und darf nicht als Möbel durchfallen.
    const [k] = teileEin([block(0, 0, 925, 960)], JE_PUNKT);
    expect(k.art).toBe('stuetze');
  });

  it('zählt zwei gleich große Pfeiler nicht als Serie', () => {
    // Zwei 300 × 300er Pfeiler sind zwei Pfeiler. Die Serienregel greift
    // erst oberhalb der Mauerstärke.
    const koerper = teileEin([block(0, 0, 300, 300), block(5000, 0, 300, 300)], JE_PUNKT);
    expect(koerper.every((k) => k.art === 'stuetze')).toBe(true);
  });

  it('hält die Reihe der Obst-und-Gemüse-Tische für kein Bauteil', () => {
    // Im echten Plan steht dieser Tisch neunmal. Genau die Wiederholung
    // verrät ihn – einzeln wäre er von einer Stütze nicht zu trennen.
    const tische = Array.from({ length: 9 }, (_, i) => block(i * 3000, 0, 1244, 790));
    const koerper = teileEin(tische, JE_PUNKT);
    expect(koerper.every((k) => k.art === 'fremd')).toBe(true);
    expect(koerper[0].begruendung).toContain('Serie');
  });

  it('gibt zu, wenn ein einzelner Block nicht zu deuten ist', () => {
    // Ein Tisch von 1244 × 790 mm und eine Stütze von 975 × 1400 mm sind
    // beide massiv und in derselben Farbe gezeichnet. Steht der Tisch nur
    // einmal im Plan, hilft auch die Wiederholung nicht mehr. Dann wird er
    // zur Stütze erklärt – aber ausdrücklich nur als Vermutung.
    const [k] = teileEin([block(0, 0, 1244, 790)], JE_PUNKT);
    expect(k.art).toBe('stuetze');
    expect(k.sicherheit).toBe('wahrscheinlich');
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
        block(9000, 3000, 1244, 790),
        block(30000, 20000, 1429, 1429),
        block(34000, 20000, 1429, 1429),
        block(60000, 60000, 103, 125),
      ],
      JE_PUNKT,
    );
    const zaehle = (art: string) => koerper.filter((k) => k.art === art).length;
    expect(zaehle('wand')).toBe(2);
    expect(zaehle('stuetze')).toBe(2);
    // Vier Möbel in Serie und ein Bruchstück aus der Legende.
    expect(zaehle('fremd')).toBe(5);
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
      [
        ring(0, 0, 40000, 25000, 300),
        block(50000, 30000, 300, 300),
        block(3000, 3000, 1244, 790),
        block(9000, 3000, 1244, 790),
      ],
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
    // Zwei gleiche Tische: eine Serie, also Möbel – und damit bleibt für
    // den Umriss nichts übrig.
    const moebel = [block(0, 0, 1244, 790), block(3000, 0, 1244, 790)];
    expect(rahmenAlsUmriss(teileEin(moebel, JE_PUNKT), JE_PUNKT)).toEqual([]);
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

describe('Zentrierter Umriss', () => {
  it('legt den Umriss um den Nullpunkt', () => {
    const p = zentrierterUmriss(
      [mm(1000, 2000), mm(1300, 2000), mm(1300, 2400), mm(1000, 2400)],
      JE_PUNKT,
    );
    const xs = p.map((q) => q.x);
    const ys = p.map((q) => q.y);
    expect(Math.min(...xs)).toBeCloseTo(-15, 6);
    expect(Math.max(...xs)).toBeCloseTo(15, 6);
    expect(Math.min(...ys)).toBeCloseTo(-20, 6);
    expect(Math.max(...ys)).toBeCloseTo(20, 6);
  });

  it('behält die Form eines kreuzförmigen Querschnitts', () => {
    // Ein Kreuz mit 300 mm Stegbreite in einer Bounding-Box von 900 × 900.
    // Als Rechteck gesetzt wäre die Stütze neunmal so groß.
    const kreuz = [
      mm(300, 0), mm(600, 0), mm(600, 300), mm(900, 300), mm(900, 600),
      mm(600, 600), mm(600, 900), mm(300, 900), mm(300, 600), mm(0, 600),
      mm(0, 300), mm(300, 300),
    ];
    const p = zentrierterUmriss(kreuz, JE_PUNKT);
    expect(p).toHaveLength(12);
    // Die Fläche bleibt die des Kreuzes, nicht die der Bounding-Box.
    // Fünf Felder zu 30 × 30 cm ergeben 4500 cm², die Bounding-Box hätte
    // 8100 cm².
    expect(polygonflaeche(p)).toBeCloseTo(4500, 0);
  });
});

describe('Mittelpunkt', () => {
  it('liegt in der Mitte der Bounding-Box', () => {
    const p = mittelpunkt([mm(1000, 2000), mm(1300, 2000), mm(1300, 2400), mm(1000, 2400)]);
    expect(p.x * JE_PUNKT).toBeCloseTo(1150, 6);
    expect(p.y * JE_PUNKT).toBeCloseTo(2200, 6);
  });
});
