import { describe, expect, it } from 'vitest';
import { fasseZusammen, findeWaende, geradenwinkel, umschliessendesRechteck } from './waende';
import { mmJePunkt } from './massstab';
import type { Strecke } from './waende';

const JE_PUNKT = mmJePunkt(100);

/** Eine waagerechte Strecke von `vonMm` bis `bisMm` auf der Höhe `yMm`. */
function waagerecht(vonMm: number, bisMm: number, yMm: number): Strecke {
  return {
    von: { x: vonMm / JE_PUNKT, y: yMm / JE_PUNKT },
    bis: { x: bisMm / JE_PUNKT, y: yMm / JE_PUNKT },
  };
}

function senkrecht(vonMm: number, bisMm: number, xMm: number): Strecke {
  return {
    von: { x: xMm / JE_PUNKT, y: vonMm / JE_PUNKT },
    bis: { x: xMm / JE_PUNKT, y: bisMm / JE_PUNKT },
  };
}

describe('Geradenwinkel', () => {
  it('behandelt Hin- und Rückrichtung gleich', () => {
    expect(geradenwinkel(waagerecht(0, 1000, 0))).toBeCloseTo(0, 5);
    expect(geradenwinkel(waagerecht(1000, 0, 0))).toBeCloseTo(0, 5);
    expect(geradenwinkel(senkrecht(0, 1000, 0))).toBeCloseTo(90, 5);
    expect(geradenwinkel(senkrecht(1000, 0, 0))).toBeCloseTo(90, 5);
  });
});

describe('Strecken zusammenfassen', () => {
  it('macht aus aneinandergrenzenden Stücken eine Wand', () => {
    // Ein CAD-Programm zerlegt eine Wand an jeder Tür. Zusammen sind es
    // zwanzig Meter, einzeln fiele jedes Stück durch das Raster.
    const stuecke = [
      waagerecht(0, 6000, 0),
      waagerecht(6000, 13000, 0),
      waagerecht(13000, 20000, 0),
    ];
    const zusammen = fasseZusammen(stuecke);
    expect(zusammen).toHaveLength(1);
    const l = Math.hypot(
      zusammen[0].bis.x - zusammen[0].von.x,
      zusammen[0].bis.y - zusammen[0].von.y,
    );
    expect(l * JE_PUNKT).toBeCloseTo(20000, 0);
  });

  it('überbrückt die Lücke einer Tür', () => {
    const mitTuer = [waagerecht(0, 5000, 0), waagerecht(5100, 12000, 0)];
    expect(fasseZusammen(mitTuer)).toHaveLength(1);
  });

  it('lässt zwei getrennte Wände getrennt', () => {
    const weit = [waagerecht(0, 5000, 0), waagerecht(14000, 20000, 0)];
    expect(fasseZusammen(weit)).toHaveLength(2);
  });

  it('wirft Strecken auf verschiedenen Höhen nicht zusammen', () => {
    const parallel = [waagerecht(0, 8000, 0), waagerecht(0, 8000, 3000)];
    expect(fasseZusammen(parallel)).toHaveLength(2);
  });
});

describe('Wände finden', () => {
  it('nimmt lange Linien und lässt kurze liegen', () => {
    const strecken = [
      waagerecht(0, 20000, 0), // Außenwand
      senkrecht(0, 12000, 0), // Außenwand
      waagerecht(0, 1250, 4000), // ein Regalfeld
      waagerecht(2000, 2600, 4000), // eine Etagenkante
    ];
    const waende = findeWaende(strecken, JE_PUNKT);
    expect(waende).toHaveLength(2);
    expect(Math.round(waende[0].laengeMm)).toBe(20000);
    expect(waende[0].sicherheit).toBe('sicher');
  });

  it('stuft mittellange Linien vorsichtiger ein', () => {
    const waende = findeWaende([waagerecht(0, 3500, 0)], JE_PUNKT);
    expect(waende[0].sicherheit).toBe('geraten');
  });

  it('begrenzt die Zahl der Vorschläge', () => {
    // Ein Plan mit tausend Wandvorschlägen wäre unbrauchbar.
    const viele = Array.from({ length: 300 }, (_, i) => waagerecht(0, 9000, i * 500));
    expect(findeWaende(viele, JE_PUNKT, 3000, 80)).toHaveLength(80);
  });

  it('gibt die längsten zuerst zurück', () => {
    const waende = findeWaende(
      [waagerecht(0, 5000, 0), waagerecht(0, 20000, 2000), waagerecht(0, 9000, 4000)],
      JE_PUNKT,
    );
    expect(waende.map((w) => Math.round(w.laengeMm))).toEqual([20000, 9000, 5000]);
  });
});

describe('Umschließendes Rechteck', () => {
  it('spannt den Rahmen über alle Wände', () => {
    const waende = findeWaende(
      [waagerecht(0, 20000, 0), senkrecht(0, 12000, 0), waagerecht(0, 20000, 12000)],
      JE_PUNKT,
    );
    const rechteck = umschliessendesRechteck(waende)!;
    expect(rechteck).toHaveLength(4);
    const breite = (rechteck[1].x - rechteck[0].x) * JE_PUNKT;
    const hoehe = (rechteck[2].y - rechteck[1].y) * JE_PUNKT;
    expect(Math.round(breite)).toBe(20000);
    expect(Math.round(hoehe)).toBe(12000);
  });

  it('gibt ohne Wände nichts zurück', () => {
    expect(umschliessendesRechteck([])).toBeUndefined();
  });
});
