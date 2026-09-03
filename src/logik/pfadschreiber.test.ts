import { describe, expect, it } from 'vitest';
import { Pfadschreiber, pfadVon } from './pfadschreiber';
import { zeichneForm } from '../komponenten/zeichenflaeche/ElementSymbol';
import { BIBLIOTHEK } from '../daten/bibliothek';
import type { Grundform } from '../typen/modell';

/**
 * Der Mitschreiber, der aus einer Zeichnung einen SVG-Pfad macht.
 *
 * Das Entscheidende steht ganz unten: Jede Form der Bibliothek muss sich
 * mitschreiben lassen, und zwar vollständig. Geht dabei etwas verloren, sieht
 * man es im Plan nicht – erst auf dem gedruckten Blatt, und dann ist es zu
 * spät.
 */

/** Zerlegt einen Pfad in seine Befehle. */
function befehle(d: string): string[] {
  return d.match(/[MLAZ]/g) ?? [];
}

/** Alle Zahlen eines Pfades. */
function zahlen(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

describe('Pfadschreiber', () => {
  it('schreibt Strecken mit', () => {
    const s = new Pfadschreiber();
    s.moveTo(10, 20);
    s.lineTo(30, 40);
    expect(s.d).toBe('M 10 20 L 30 40');
  });

  it('macht aus einem Rechteck einen geschlossenen Teilpfad', () => {
    const s = new Pfadschreiber();
    s.rect(0, 0, 100, 50);
    expect(s.d).toBe('M 0 0 L 100 0 L 100 50 L 0 50 Z');
  });

  it('fängt am Ursprung an, wenn jemand ohne moveTo losläuft', () => {
    // So macht es die Leinwand auch – sonst sähe das PDF anders aus als der
    // Bildschirm, und zwar nur an dieser einen Stelle.
    const s = new Pfadschreiber();
    s.lineTo(30, 40);
    expect(s.d).toBe('M 0 0 L 30 40');
  });

  it('zerlegt einen vollen Kreis in zwei Bögen', () => {
    // Ein Bogen über 360 Grad hat Anfang und Ende am selben Punkt. SVG
    // zeichnet dann gar nichts – der Kreis wäre spurlos verschwunden.
    const s = new Pfadschreiber();
    s.arc(50, 50, 10, 0, Math.PI * 2);
    expect(befehle(s.d).filter((b) => b === 'A')).toHaveLength(2);
  });

  it('fängt einen Kreis ohne Ausdehnung ab', () => {
    const s = new Pfadschreiber();
    s.arc(50, 50, 0, 0, Math.PI * 2);
    s.ellipse(10, 10, NaN, 5);
    expect(s.leer).toBe(true);
  });

  it('läuft bei einem Loch in die Gegenrichtung', () => {
    // Daran hängen die hohlen Blenden und die Blumentöpfe: Ein Teilpfad in
    // Gegenrichtung schneidet nach der Füllregel ein Loch. Verlöre der
    // Mitschreiber die Richtung, wären die Töpfe im PDF ausgefüllt.
    const mit = new Pfadschreiber();
    mit.arc(50, 50, 10, 0, Math.PI * 2, false);
    const gegen = new Pfadschreiber();
    gegen.arc(50, 50, 10, 0, Math.PI * 2, true);
    // Das Kennzeichen im SVG-Bogen ist die vierte Zahl vor dem Zielpunkt.
    expect(mit.d).toContain('0 1 ');
    expect(gegen.d).toContain('0 0 ');
    expect(mit.d).not.toBe(gegen.d);
  });

  it('lässt einen Kreis gegen den Uhrzeigersinn nicht verschwinden', () => {
    // So werden die Löcher gezeichnet – die Blumentöpfe und die hohlen
    // Blenden. Vorher fiel `0 bis 2π gegen den Uhrzeigersinn` auf eine
    // Spanne von null zusammen: Auf dem Bildschirm war der Topf da, im PDF
    // nicht. Gefunden beim Vergleich Bildpunkt für Bildpunkt gegen die
    // Leinwand.
    const s = new Pfadschreiber();
    s.arc(50, 50, 10, 0, Math.PI * 2, true);
    const boegen = befehle(s.d).filter((b) => b === 'A');
    expect(boegen).toHaveLength(2);
    // Gegenrichtung heißt Kennzeichen 0, sonst wäre es kein Loch.
    expect(s.d).toContain(' 0 0 ');
  });

  it('rundet eine rechtwinklige Ecke wirklich ab', () => {
    // `Math.tan(Math.PI / 4)` ist nicht ganz 1, sondern 0,9999999999999999.
    // Ohne etwas Luft in der Prüfung fiel der Bogen deshalb bei **jeder**
    // rechtwinkligen Ecke weg – aus der runden Kopfgondel wurde ein
    // Rechteck, und zwar nur im PDF.
    const s = new Pfadschreiber();
    s.moveTo(260, 10);
    s.arcTo(260, 140, 130, 140, 130);
    expect(s.d).toContain('A 130 130');
  });

  it('rundet eine Ecke ab, statt sie spitz zu lassen', () => {
    const s = new Pfadschreiber();
    s.moveTo(0, 50);
    s.arcTo(0, 0, 50, 0, 10);
    expect(s.d).toContain('A 10 10');
  });

  it('macht aus einer Ecke ohne Platz für den Bogen eine spitze Ecke', () => {
    // Besser eine kantige Ecke als ein Bogen, der über das Möbel hinausragt.
    const s = new Pfadschreiber();
    s.moveTo(0, 5);
    s.arcTo(0, 0, 5, 0, 99);
    expect(s.d).not.toContain('A');
  });

  it('erzeugt nur endliche Zahlen', () => {
    const s = new Pfadschreiber();
    s.moveTo(0, 0);
    s.arcTo(0, 0, 0, 0, 5);
    s.ellipse(10, 10, 5, 5, 0.3, 0, Math.PI);
    expect(zahlen(s.d).every(Number.isFinite)).toBe(true);
  });
});

describe('Jede Form der Bibliothek lässt sich mitschreiben', () => {
  const FORMEN: Grundform[] = [...new Set(BIBLIOTHEK.map((e) => e.form))];

  it('kennt genug Formen, um etwas auszusagen', () => {
    expect(FORMEN.length).toBeGreaterThanOrEqual(25);
  });

  for (const form of FORMEN) {
    it(`schreibt ${form} vollständig mit`, () => {
      const d = pfadVon((ctx) => zeichneForm(ctx, form, 250, 120, false));

      // `umriss` zeichnet ihr Polygon erst im sceneFunc – hier kommt nichts.
      if (form === 'umriss') return;

      expect(d.length, `${form} hat gar nichts hinterlassen`).toBeGreaterThan(0);
      expect(zahlen(d).every(Number.isFinite), `${form} hat kaputte Zahlen`).toBe(true);
      // Ein Pfad muss mit einem Sprung anfangen, sonst hängt er am Ursprung.
      expect(d.startsWith('M'), `${form} fängt nicht mit M an`).toBe(true);
    });

    it(`schreibt ${form} auch beidseitig und in winzig mit`, () => {
      for (const [b, t, seiten] of [
        [250, 120, true],
        [0.4, 0.2, false],
      ] as const) {
        const d = pfadVon((ctx) => zeichneForm(ctx, form, b, t, seiten));
        expect(zahlen(d).every(Number.isFinite), `${form} ${b}x${t}`).toBe(true);
      }
    });
  }

  it('liefert für dasselbe Möbel zweimal dasselbe', () => {
    // Sonst unterschieden sich zwei Ausdrucke desselben Plans, und niemand
    // wüsste, welcher gilt.
    const einmal = pfadVon((ctx) => zeichneForm(ctx, 'wt100', 250, 60, false, 125));
    const zweimal = pfadVon((ctx) => zeichneForm(ctx, 'wt100', 250, 60, false, 125));
    expect(einmal).toBe(zweimal);
  });

  it('unterscheidet ein Wandregal von einer Gondel', () => {
    // Die Probe aufs Exempel: Was auf dem Bildschirm verschieden aussieht,
    // muss auch im Vektor verschieden sein.
    const wand = pfadVon((ctx) => zeichneForm(ctx, 'regal', 125, 60, false));
    const gondel = pfadVon((ctx) => zeichneForm(ctx, 'regal', 125, 120, true));
    expect(wand).not.toBe(gondel);
  });
});
