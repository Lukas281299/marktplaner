import { describe, expect, it } from 'vitest';
import { eckenVon, hatEcken, kantenlaengen, verschiebeEcke } from './elementEcken';
import type { PlanElement } from '../typen/modell';

/**
 * Prüfungen für die Ecken eines frei geformten Elements.
 *
 * Der Umriss liegt zentriert am Element. Zieht man eine Ecke, ändert sich
 * damit auch die Mitte – und das Element muss so nachrücken, dass die Form
 * auf dem Plan stehen bleibt. Genau da schleicht sich sonst ein Wandern ein,
 * das man erst nach dem zwanzigsten Zug bemerkt.
 */

/** Ein Trapez: hinten 200 breit, vorn 120, 100 tief. */
function trapez(zusatz: Partial<PlanElement> = {}): PlanElement {
  return {
    id: 'tr', vorlageId: 'v', ebeneId: 'einrichtung', name: 'Trapez', kategorie: 'obstgemuese',
    x: 1000, y: 500, breite: 200, tiefe: 100, drehung: 0, form: 'umriss',
    farbe: '#cfe4c2', beschriftung: '', beschriftungSichtbar: false, schriftgroesse: 12,
    gesperrt: false, reihenfolge: 0,
    polygon: [
      { x: -100, y: -50 },
      { x: 100, y: -50 },
      { x: 60, y: 50 },
      { x: -60, y: 50 },
    ],
    ...zusatz,
  };
}

describe('Ecken eines freien Elements', () => {
  it('rechnet die Ecken in Weltkoordinaten', () => {
    expect(eckenVon(trapez())).toEqual([
      { x: 900, y: 450 },
      { x: 1100, y: 450 },
      { x: 1060, y: 550 },
      { x: 940, y: 550 },
    ]);
  });

  it('misst die Kantenlängen umlaufend', () => {
    const l = kantenlaengen(trapez());
    expect(l[0]).toBeCloseTo(200, 3);
    expect(l[2]).toBeCloseTo(120, 3);
    // Die Schrägen: 40 zur Seite, 100 in die Tiefe.
    expect(l[1]).toBeCloseTo(Math.hypot(40, 100), 3);
    expect(l[3]).toBeCloseTo(Math.hypot(40, 100), 3);
  });

  it('zieht eine Ecke an die gewünschte Stelle', () => {
    const werte = verschiebeEcke(trapez(), 1, { x: 1200, y: 450 })!;
    const neu = { ...trapez(), ...werte };
    expect(eckenVon(neu)[1].x).toBeCloseTo(1200, 3);
    expect(eckenVon(neu)[1].y).toBeCloseTo(450, 3);
  });

  it('lässt die übrigen Ecken stehen', () => {
    // Der Kern: Der Umriss wird neu zentriert und das Element rückt nach.
    // Rechnet man das falsch, wandert die ganze Form bei jedem Zug mit.
    const vorher = eckenVon(trapez());
    const werte = verschiebeEcke(trapez(), 1, { x: 1200, y: 450 })!;
    const nachher = eckenVon({ ...trapez(), ...werte });
    for (const i of [0, 2, 3]) {
      expect(nachher[i].x).toBeCloseTo(vorher[i].x, 3);
      expect(nachher[i].y).toBeCloseTo(vorher[i].y, 3);
    }
  });

  it('zieht Breite und Tiefe nach', () => {
    const werte = verschiebeEcke(trapez(), 1, { x: 1200, y: 450 })!;
    expect(werte.breite).toBeCloseTo(300, 3);
    expect(werte.tiefe).toBeCloseTo(100, 3);
  });

  it('hält die Form auch nach vielen Zügen an ihrem Platz', () => {
    // Ein Fehler von Bruchteilen je Zug fällt einzeln nicht auf.
    let el = trapez();
    const start = eckenVon(el)[0];
    for (let i = 0; i < 60; i++) {
      const ziel = eckenVon(el)[2];
      const werte = verschiebeEcke(el, 2, { x: ziel.x + (i % 2 ? 1 : -1), y: ziel.y })!;
      el = { ...el, ...werte };
    }
    expect(eckenVon(el)[0].x).toBeCloseTo(start.x, 3);
    expect(eckenVon(el)[0].y).toBeCloseTo(start.y, 3);
  });

  it('kommt mit einem gedrehten Element zurecht', () => {
    const gedreht = trapez({ drehung: 30 });
    const ziel = { x: 1234, y: 567 };
    const werte = verschiebeEcke(gedreht, 1, ziel)!;
    const nachher = eckenVon({ ...gedreht, ...werte });
    expect(nachher[1].x).toBeCloseTo(ziel.x, 3);
    expect(nachher[1].y).toBeCloseTo(ziel.y, 3);
  });

  it('verweigert einen Zug, der die Fläche plattdrückt', () => {
    // Alle vier Ecken auf einer Linie wären auf dem Plan nicht mehr zu
    // treffen – dann lieber nichts tun.
    const flach = trapez({ polygon: [
      { x: -100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0.4 }, { x: -100, y: 0.4 },
    ] });
    expect(verschiebeEcke(flach, 0, { x: 900, y: 500 })).toBeNull();
  });

  it('erkennt, welche Elemente Ecken haben', () => {
    expect(hatEcken(trapez())).toBe(true);
    expect(hatEcken(trapez({ form: 'vitable' }))).toBe(false);
    expect(hatEcken(trapez({ polygon: undefined }))).toBe(false);
  });
});
