import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { zeichneForm, zeichneStriche } from './ElementSymbol';
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

describe('Türen an Kühlmöbeln', () => {
  /**
   * Die Radien aller Schwenkbögen vor der Front.
   *
   * Ein eigener Mitschreiber statt des großen oben: Der wirft alle Werte in
   * einen Topf, und aus dem den Radius wieder herauszurechnen hieße, die
   * Argumentzahl jedes Zeichenbefehls nachzuhalten – eine Fehlerquelle, die
   * mit dem Geprüften nichts zu tun hat.
   */
  function boegen(form: Grundform, breite: number, tiefe = 90) {
    const radien: number[] = [];
    const ctx = {
      rect: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      arcTo: () => {},
      ellipse: () => {},
      arc: (_x: number, _y: number, r: number) => radien.push(r),
    };
    zeichneStriche(ctx as unknown as Konva.Context, form, breite, tiefe);
    return radien;
  }

  it('setzt alle 62,5 cm eine Tür', () => {
    // Die Regel aus dem Markt: 2,50 m sind vier Türen.
    expect(boegen('kuehlSchrank', 250)).toHaveLength(4);
  });

  it('macht jede Tür genau 62,5 cm breit', () => {
    // Der Schwenkradius ist die Türbreite – daran hängt, wie viel Gang eine
    // offene Tür braucht. Stimmt die Zahl der Türen, muss auch der Radius
    // stimmen, sonst teilt die Zeichnung die Front falsch auf.
    for (const radius of boegen('tkSchrank', 375)) expect(radius).toBeCloseTo(62.5, 6);
  });

  it('führt die Katalogmaße auf ganze Türen', () => {
    // 937, 1250, 1875, 2500 und 3750 mm – die Längen aus der Bibliothek.
    const erwartet: [number, number][] = [
      [93.7, 1],
      [125, 2],
      [187.5, 3],
      [250, 4],
      [375, 6],
    ];
    for (const [breite, anzahl] of erwartet) {
      expect(boegen('kuehlStufen', breite)).toHaveLength(anzahl);
    }
  });

  it('lässt das offene Kühlregal ohne Türen', () => {
    // Der Unterschied zum kuehlSchrank ist genau die Tür – sonst wären die
    // beiden blauen Möbel im Plan nicht zu unterscheiden.
    expect(boegen('kuehlOffen', 250)).toHaveLength(0);
  });

  it('gibt der Truhe keine Türen', () => {
    // Eine Tiefkühlinsel hat Schiebedeckel, keine Schwenktüren.
    expect(boegen('tkTruhe', 250)).toHaveLength(0);
  });

  it('gibt dem Türblatt genau ein Blatt, egal wie breit es ist', () => {
    expect(boegen('tuerBlatt', 100, 12)).toHaveLength(1);
    expect(boegen('tuerBlatt', 250, 12)).toHaveLength(1);
  });
});

describe('Gemischter Regalzug', () => {
  /** Die x-Stellen, an denen der Zug senkrecht geteilt wird. */
  function trennlinien(breite: number, felder?: number[], achsmass = 100) {
    const { ctx, aufrufe, punkte } = mitschreiber();
    zeichneForm(ctx, 'wt100', breite, 127, true, achsmass, felder);
    const stellen: number[] = [];
    let zeiger = 0;
    for (let i = 0; i < aufrufe.length; i++) {
      const name = aufrufe[i];
      if (name === 'moveTo' && aufrufe[i + 1] === 'lineTo') {
        const [x1, y1] = [punkte[zeiger], punkte[zeiger + 1]];
        const [x2, y2] = [punkte[zeiger + 2], punkte[zeiger + 3]];
        // Senkrecht und über die ganze Tiefe: das ist eine Feldgrenze.
        if (Math.abs(x1 - x2) < 0.01 && Math.abs(y1) < 0.01 && Math.abs(y2 - 127) < 0.01) {
          stellen.push(Math.round(x1 * 100) / 100);
        }
      }
      zeiger += { arc: 6, arcTo: 5, rect: 4, ellipse: 4, moveTo: 2, lineTo: 2, closePath: 0 }[
        name as 'arc'
      ];
    }
    return stellen;
  }

  it('setzt die Feldgrenzen dorthin, wo die Säule steht', () => {
    // Fünf Felder A1000 und eines A1250: Die Grenzen liegen bei 100, 200,
    // 300, 400 und 500 – nicht bei gleichmäßigen Sechsteln von 6,25 m.
    expect(trennlinien(625, [100, 100, 100, 100, 100, 125])).toEqual([100, 200, 300, 400, 500]);
  });

  it('setzt das breite Feld dorthin, wo es in der Liste steht', () => {
    // Genau darum geht es bei der Position: Steht das A1250 vorn, sitzt die
    // erste Grenze bei 125 und nicht bei 100.
    expect(trennlinien(625, [125, 100, 100, 100, 100, 100])).toEqual([125, 225, 325, 425, 525]);
  });

  it('teilt ohne Feldliste weiter gleichmäßig', () => {
    // So wurde bis dahin jeder Zug gezeichnet – eine ältere Planung darf
    // sich durch das Öffnen nicht verändern.
    expect(trennlinien(600, undefined, 100)).toEqual([100, 200, 300, 400, 500]);
  });
});
