import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { zeichneForm } from './ElementSymbol';
import { BIBLIOTHEK } from '../../daten/bibliothek';
import type { Grundform } from '../../typen/modell';

/**
 * Prüfungen für die Zeichenfunktion der Symbole.
 *
 * Gezeichnet wird auf einer Leinwand, und die verschluckt jeden Fehler
 * stillschweigend: Eine Linie nach NaN erscheint einfach nicht, ein falscher
 * Radius zieht einen Strich quer über den Plan. Deshalb wird hier statt einer
 * echten Leinwand ein Mitschreiber untergeschoben, der jeden Punkt festhält.
 *
 * Ein zweiter Fehler wäre schlimmer als eine fehlende Linie: eine Schleife,
 * deren Schrittweite bei einem sehr kleinen Element auf null fällt. Die
 * Anwendung würde einfrieren. Deshalb wird jede Form auch in winzig geprüft.
 */

/** Sammelt alle Koordinaten, die eine Zeichnung anfährt. */
function mitschreiber() {
  const punkte: number[] = [];
  const aufrufe: string[] = [];

  function merke(name: string, ...werte: number[]) {
    aufrufe.push(name);
    punkte.push(...werte);
  }

  const ctx = {
    rect: (x: number, y: number, b: number, t: number) => merke('rect', x, y, b, t),
    moveTo: (x: number, y: number) => merke('moveTo', x, y),
    lineTo: (x: number, y: number) => merke('lineTo', x, y),
    closePath: () => merke('closePath'),
    arc: (x: number, y: number, r: number, a1: number, a2: number) =>
      merke('arc', x, y, r, a1, a2),
    arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) =>
      merke('arcTo', x1, y1, x2, y2, r),
    ellipse: (x: number, y: number, rx: number, ry: number) => merke('ellipse', x, y, rx, ry),
  };

  return { ctx: ctx as unknown as Konva.Context, punkte, aufrufe };
}

/** Jede Form, die in der Bibliothek wirklich vorkommt. */
const FORMEN: Grundform[] = [...new Set(BIBLIOTHEK.map((e) => e.form))];

describe('Symbole zeichnen', () => {
  it('deckt mit der Bibliothek fast alle Formen ab', () => {
    // Wenn jemand eine Form ergänzt, aber keinen Eintrag dazu, fällt sie hier
    // durchs Raster – dann sagt diese Zahl, dass etwas fehlt.
    expect(FORMEN.length).toBeGreaterThanOrEqual(25);
  });

  for (const form of FORMEN) {
    it(`zeichnet ${form} ohne ungültige Koordinaten`, () => {
      const { ctx, punkte, aufrufe } = mitschreiber();
      zeichneForm(ctx, form, 250, 120, false);

      expect(aufrufe.length).toBeGreaterThan(0);
      const kaputt = punkte.filter((wert) => !Number.isFinite(wert));
      expect(kaputt).toEqual([]);
    });

    it(`zeichnet ${form} auch beidseitig`, () => {
      const { ctx, punkte } = mitschreiber();
      zeichneForm(ctx, form, 250, 120, true);
      expect(punkte.every((wert) => Number.isFinite(wert))).toBe(true);
    });

    it(`bleibt bei ${form} auch in winzig stehen`, () => {
      // Ein Element lässt sich mit den Anfassern beliebig klein ziehen.
      // Bleibt eine Schleife dabei hängen, friert die Anwendung ein – der
      // Test würde hier in die Zeitbegrenzung von vitest laufen.
      const { ctx, punkte } = mitschreiber();
      zeichneForm(ctx, form, 0.4, 0.2, false);
      expect(punkte.every((wert) => Number.isFinite(wert))).toBe(true);
    });
  }

  it('gibt der Treppe so viele Kanten, wie Stufen hineinpassen', () => {
    // 300 cm Lauf bei 28 cm Auftritt sind elf Stufen, also zehn Kanten
    // dazwischen. Dazu kommen Umriss und Pfeil.
    const { ctx, aufrufe } = mitschreiber();
    zeichneForm(ctx, 'treppe', 300, 120);
    const linien = aufrufe.filter((a) => a === 'lineTo').length;
    expect(linien).toBe(10 + 1 + 2);
  });

  it('unterscheidet Gondel und Wandregal', () => {
    const wand = mitschreiber();
    zeichneForm(wand.ctx, 'regal', 125, 60, false);
    const gondel = mitschreiber();
    zeichneForm(gondel.ctx, 'regal', 125, 120, true);

    // Die Gondel hat den Mittelsteg, also eine Linie mehr als die Rückwand.
    const striche = (a: string[]) => a.filter((n) => n === 'lineTo').length;
    expect(striche(wand.aufrufe)).toBe(1);
    expect(striche(gondel.aufrufe)).toBe(2);
  });
});
