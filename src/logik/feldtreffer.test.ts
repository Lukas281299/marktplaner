import { describe, expect, it } from 'vitest';
import { feldUnterPunkt, inElementkoordinaten } from './feldtreffer';
import type { PlanElement } from '../typen/modell';

/**
 * Prüfungen für den Klick auf einen Meter.
 *
 * Beim Zuordnen einer Warengruppe klickt man auf einen Meter im Plan, nicht
 * auf ein Möbel. Trifft die Rechnung daneben, landet der Name im Nachbarfeld
 * oder auf der falschen Gondelseite – und das sieht man erst, wenn der Plan
 * gedruckt ist.
 */

const zug = (werte: Partial<PlanElement> = {}): PlanElement =>
  ({
    id: 'z',
    vorlageId: 'wt-zug',
    ebeneId: 'einrichtung',
    name: 'Zug',
    kategorie: 'regale',
    // Mitte bei (1000, 1000), fünf Felder à 1 m, 67 tief.
    x: 1000,
    y: 1000,
    breite: 500,
    tiefe: 67,
    drehung: 0,
    form: 'wt100',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
    beidseitig: false,
    achsmass: 100,
    ...werte,
  }) as PlanElement;

describe('Punkt in die Koordinaten des Möbels', () => {
  it('legt die Mitte auf die halbe Größe', () => {
    const p = inElementkoordinaten(zug(), { x: 1000, y: 1000 });
    expect(p.x).toBeCloseTo(250, 6);
    expect(p.y).toBeCloseTo(33.5, 6);
  });

  it('dreht mit', () => {
    // Bei 90° zeigt die eigene x-Achse nach unten: Ein Punkt unterhalb der
    // Mitte liegt auf der eigenen Achse weiter hinten.
    const p = inElementkoordinaten(zug({ drehung: 90 }), { x: 1000, y: 1100 });
    expect(p.x).toBeCloseTo(350, 6);
  });
});

describe('Feld unter dem Punkt', () => {
  const treffer = (x: number, y = 1000, el = zug()) => feldUnterPunkt(el, { x, y });

  it('findet das erste und das letzte Feld', () => {
    // Der Zug reicht von 750 bis 1250.
    expect(treffer(760)?.feld).toBe(0);
    expect(treffer(1240)?.feld).toBe(4);
  });

  it('findet die Felder dazwischen', () => {
    expect(treffer(860)?.feld).toBe(1);
    expect(treffer(960)?.feld).toBe(2);
    expect(treffer(1060)?.feld).toBe(3);
  });

  it('gibt nichts zurück, wenn der Punkt daneben liegt', () => {
    expect(treffer(700)).toBeNull();
    expect(treffer(1300)).toBeNull();
    expect(treffer(1000, 1200)).toBeNull();
  });

  it('lässt am Rand etwas Luft', () => {
    // Getroffen wird mit der Maus, nicht mit dem Lineal.
    const el = zug();
    expect(feldUnterPunkt(el, { x: 747, y: 1000 }, 5)?.feld).toBe(0);
    expect(feldUnterPunkt(el, { x: 747, y: 1000 }, 0)).toBeNull();
  });

  it('unterscheidet bei einer Gondel die beiden Seiten', () => {
    // Oben liegt die Rückseite, unten die Vorderseite – dieselbe Aufteilung
    // wie beim Zeichnen.
    const gondel = zug({ beidseitig: true, tiefe: 127 });
    expect(feldUnterPunkt(gondel, { x: 800, y: 960 })?.seite).toBe('oben');
    expect(feldUnterPunkt(gondel, { x: 800, y: 1040 })?.seite).toBe('unten');
  });

  it('zählt auf jeder Seite deren eigene Felder', () => {
    // Vorn fünf Meter, hinten zwei Felder à 2,50 m: Bei 1240 ist vorn das
    // fünfte Feld und hinten das zweite.
    const gondel = zug({
      beidseitig: true,
      tiefe: 127,
      felderUnten: [100, 100, 100, 100, 100].map((breite) => ({ breite })),
      felderOben: [{ breite: 250 }, { breite: 250 }],
    });
    expect(feldUnterPunkt(gondel, { x: 1240, y: 1040 })).toEqual({ seite: 'unten', feld: 4 });
    expect(feldUnterPunkt(gondel, { x: 1240, y: 960 })).toEqual({ seite: 'oben', feld: 1 });
  });

  it('folgt der Drehung des Möbels', () => {
    // Derselbe Zug hochkant: Das erste Feld liegt jetzt oben.
    const hochkant = zug({ drehung: 90 });
    expect(feldUnterPunkt(hochkant, { x: 1000, y: 760 })?.feld).toBe(0);
    expect(feldUnterPunkt(hochkant, { x: 1000, y: 1240 })?.feld).toBe(4);
  });

  it('gibt einem Möbel ohne Felder das eine Feld', () => {
    // Eine Palette, ein runder Kopf: Dort gibt es nur eine Stelle.
    const palette = zug({ form: 'palette', achsmass: undefined, breite: 120, tiefe: 80 });
    expect(feldUnterPunkt(palette, { x: 1000, y: 1000 })).toEqual({ seite: 'unten', feld: 0 });
  });
});
