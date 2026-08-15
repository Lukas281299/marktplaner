import { describe, expect, it } from 'vitest';
import { neuesProjekt } from '../daten/standardProjekt';
import type { Masslinie, PlanElement, Projekt } from '../typen/modell';
import { fangePunkt, fangpunkte, masslaenge, massWinkel, versetzteLinie } from './messen';

function regal(id: string, x: number, y: number, zusatz: Partial<PlanElement> = {}): PlanElement {
  return {
    id,
    vorlageId: 'regal-trocken',
    ebeneId: 'einrichtung',
    name: 'Regal',
    kategorie: 'regale',
    x,
    y,
    breite: 100,
    tiefe: 60,
    drehung: 0,
    form: 'rechteck',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
    ...zusatz,
  };
}

function projektMit(elemente: PlanElement[]): Projekt {
  return { ...neuesProjekt('Probe', 1000, 800), elemente };
}

describe('Fangpunkte', () => {
  it('nimmt die Ecken des Gebäudes mit', () => {
    const punkte = fangpunkte(projektMit([]));
    expect(punkte).toContainEqual({ x: 0, y: 0 });
    expect(punkte).toContainEqual({ x: 1000, y: 800 });
  });

  it('nimmt Ecken und Mitte eines Regals mit', () => {
    const punkte = fangpunkte(projektMit([regal('a', 500, 400)]));
    // Mitte
    expect(punkte).toContainEqual({ x: 500, y: 400 });
    // vier Ecken bei 100 x 60
    expect(punkte).toContainEqual({ x: 450, y: 370 });
    expect(punkte).toContainEqual({ x: 550, y: 430 });
  });

  it('nimmt die Enden einer Innenwand mit', () => {
    const projekt = {
      ...projektMit([]),
      waende: [
        {
          id: 'w',
          von: { x: 100, y: 100 },
          bis: { x: 100, y: 700 },
          staerke: 12,
          art: 'trennwand' as const,
          gesperrt: false,
        },
      ],
    };
    const punkte = fangpunkte(projekt);
    expect(punkte).toContainEqual({ x: 100, y: 100 });
    expect(punkte).toContainEqual({ x: 100, y: 700 });
  });
});

describe('Einrasten', () => {
  const kandidaten = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('zieht auf den nächsten Punkt', () => {
    expect(fangePunkt({ x: 96, y: 3 }, kandidaten, 20)).toEqual({ x: 100, y: 0 });
  });

  it('lässt den Punkt in Ruhe, wenn keiner nah genug ist', () => {
    expect(fangePunkt({ x: 50, y: 50 }, kandidaten, 20)).toEqual({ x: 50, y: 50 });
  });

  it('nimmt bei zwei Kandidaten den näheren', () => {
    expect(fangePunkt({ x: 100, y: 60 }, kandidaten, 100)).toEqual({ x: 100, y: 100 });
  });

  it('gibt eine Kopie zurück und nicht den Kandidaten selbst', () => {
    // Sonst würde ein späteres Verschieben der Maßlinie das Regal mitziehen.
    const ergebnis = fangePunkt({ x: 0, y: 0 }, kandidaten, 20);
    expect(ergebnis).not.toBe(kandidaten[0]);
  });
});

describe('Maß', () => {
  const mass: Masslinie = {
    id: 'm',
    von: { x: 0, y: 0 },
    bis: { x: 300, y: 400 },
    text: '',
    versatz: 0,
    gesperrt: false,
  };

  it('rechnet die Länge aus', () => {
    expect(masslaenge(mass)).toBe(500);
  });

  it('verschiebt die Linie senkrecht zur Messrichtung', () => {
    const versetzt = versetzteLinie({ ...mass, von: { x: 0, y: 0 }, bis: { x: 100, y: 0 }, versatz: 50 });
    expect(versetzt.von).toEqual({ x: 0, y: 50 });
    expect(versetzt.bis).toEqual({ x: 100, y: 50 });
  });

  it('lässt die Linie bei Versatz null unverändert', () => {
    const versetzt = versetzteLinie(mass);
    expect(versetzt.von).toEqual(mass.von);
    expect(versetzt.bis).toEqual(mass.bis);
  });

  it('stellt die Maßzahl nie auf den Kopf', () => {
    expect(massWinkel({ von: { x: 100, y: 0 }, bis: { x: 0, y: 0 } })).toBe(0);
    expect(massWinkel({ von: { x: 0, y: 100 }, bis: { x: 0, y: 0 } })).toBe(90);
  });
});
