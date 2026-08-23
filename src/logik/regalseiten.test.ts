import { describe, expect, it } from 'vitest';
import {
  breiteAusSeiten,
  felderVon,
  gleicheEinteilung,
  grundfelder,
  ohneLuecke,
  seitenTrennbar,
  seitenbreite,
  uebernehmeBreiten,
  vollStuecke,
} from './regalseiten';
import type { PlanElement, Regalfeld } from '../typen/modell';

/**
 * Prüfungen für die zwei Seiten eines Regals.
 *
 * Der Kern ist die Rückwärtsverträglichkeit: Eine Planung ohne Seitenlisten
 * muss genau so gedeutet werden wie bisher. Sonst sähe jeder bestehende Plan
 * nach dem Öffnen anders aus, ohne dass jemand etwas umgebaut hätte – der
 * Fehler, den man erst im Markt bemerkt.
 *
 * Dazu die zwei Regeln, an denen die getrennten Seiten hängen: Die Breite ist
 * die **längere** Seite, und ein leeres Feld belegt trotzdem Platz.
 */

const zug = (werte: Partial<PlanElement> = {}): PlanElement =>
  ({
    id: 'z1',
    vorlageId: 'wt-zug-1000-6-600',
    name: 'Zug',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 600,
    tiefe: 127,
    hoehe: 180,
    drehung: 0,
    farbe: '#ccc',
    form: 'wt100',
    achsmass: 100,
    beidseitig: true,
    reihenfolge: 1,
    ...werte,
  }) as PlanElement;

const f = (...breiten: number[]): Regalfeld[] => breiten.map((breite) => ({ breite }));

describe('Einteilung ohne Seitenlisten', () => {
  it('teilt einen Regalzug nach seinem Achsmaß', () => {
    expect(grundfelder(zug())).toEqual([100, 100, 100, 100, 100, 100]);
  });

  it('nimmt die gespeicherte Liste, wenn es eine gibt', () => {
    expect(grundfelder(zug({ felder: [125, 100], breite: 225 }))).toEqual([125, 100]);
  });

  it('zerlegt ein Möbel ohne Achsmaß in die Einheiten seiner Abteilung', () => {
    // Eine Tiefkühlinsel von 2,50 m sind vier Module à 625 mm und kein Klotz.
    const truhe = zug({ form: 'tkTruhe', achsmass: undefined, breite: 250 });
    expect(seitenbreite(f(...grundfelder(truhe)))).toBeCloseTo(250, 1);
    expect(grundfelder(truhe).length).toBeGreaterThan(1);
  });

  it('gibt beiden Seiten dieselbe Einteilung', () => {
    const el = zug({ felder: [125, 100] });
    expect(felderVon(el, 'oben')).toEqual(felderVon(el, 'unten'));
  });
});

describe('Getrennte Seiten', () => {
  it('nimmt die eigene Liste einer Seite, wenn es eine gibt', () => {
    const el = zug({ felderUnten: f(125, 125), felderOben: f(250) });
    expect(felderVon(el, 'unten')).toHaveLength(2);
    expect(felderVon(el, 'oben')).toHaveLength(1);
  });

  it('macht die längere Seite zur Breite des Möbels', () => {
    // Die kürzere endet früher, und man sieht die Stufe im Plan. Ein Möbel,
    // das nur so breit wäre wie seine kurze Seite, stünde im Plan zu klein
    // da – die Ware der langen Seite läge im Gang.
    const el = zug();
    expect(breiteAusSeiten(el, f(100, 100), f(100, 100, 100))).toBe(300);
  });

  it('behält die bisherige Breite, wenn beide Seiten leer sind', () => {
    expect(breiteAusSeiten(zug({ breite: 425 }), [], [])).toBe(425);
  });

  it('trennt nur beim Regalzug', () => {
    expect(seitenTrennbar(zug())).toBe(true);
    expect(seitenTrennbar(zug({ beidseitig: false }))).toBe(false);
    // Eine Doppeltruhe hat zwei Seiten, aber einen Körper.
    expect(seitenTrennbar(zug({ form: 'tkTruhe' }))).toBe(false);
  });
});

describe('Lücken in einer Seite', () => {
  it('erkennt eine Seite ohne Lücke', () => {
    expect(ohneLuecke(f(100, 100))).toBe(true);
    expect(ohneLuecke([{ breite: 100 }, { breite: 100, leer: true }])).toBe(false);
  });

  it('zerlegt die Seite an einem leeren Feld in zwei Stücke', () => {
    const felder = [{ breite: 100 }, { breite: 125, leer: true }, { breite: 100 }];
    expect(vollStuecke(felder)).toEqual([
      { von: 0, bis: 100 },
      { von: 225, bis: 325 },
    ]);
  });

  it('lässt ein leeres Feld am Rand als Lücke stehen', () => {
    // Der Platz bleibt belegt – die Säule steht ja. Das Möbel wird dadurch
    // nicht kürzer, es fängt nur später an.
    expect(vollStuecke([{ breite: 125, leer: true }, { breite: 100 }])).toEqual([
      { von: 125, bis: 225 },
    ]);
  });

  it('gibt für eine ganz leere Seite gar kein Stück zurück', () => {
    expect(vollStuecke([{ breite: 100, leer: true }])).toEqual([]);
  });

  it('macht aus einer vollen Seite ein einziges Stück', () => {
    expect(vollStuecke(f(100, 125, 100))).toEqual([{ von: 0, bis: 325 }]);
  });
});

describe('Gleiche Einteilung', () => {
  it('erkennt zwei gleich geteilte Seiten', () => {
    expect(gleicheEinteilung(f(100, 125), f(100, 125))).toBe(true);
  });

  it('unterscheidet verschiedene Reihenfolgen', () => {
    expect(gleicheEinteilung(f(100, 125), f(125, 100))).toBe(false);
  });

  it('unterscheidet verschiedene Feldzahlen', () => {
    expect(gleicheEinteilung(f(100, 100), f(200))).toBe(false);
  });

  it('zählt eine Lücke als Unterschied', () => {
    // Auch wenn die Maße gleich sind: Wo auf einer Seite nichts hängt, darf
    // die Trennlinie nicht über die ganze Tiefe laufen.
    expect(gleicheEinteilung(f(100, 100), [{ breite: 100 }, { breite: 100, leer: true }])).toBe(
      false,
    );
  });
});

describe('Neue Breiten übernehmen', () => {
  it('lässt jede Notiz an ihrem Platz, wenn der Zug wächst', () => {
    // Der Kern: Wer im dritten Feld etwas stehen hat, findet es hinterher
    // dort wieder und nicht im zweiten.
    const alt: Regalfeld[] = [
      { breite: 100, notiz: 'A' },
      { breite: 100, notiz: 'B' },
      { breite: 100, notiz: 'C' },
    ];
    const neu = uebernehmeBreiten(alt, [100, 100, 100, 100, 125]);
    expect(neu).toHaveLength(5);
    expect(neu[2].notiz).toBe('C');
    expect(neu[4]).toEqual({ breite: 125 });
  });

  it('schneidet ab, wenn der Zug kürzer wird', () => {
    const alt: Regalfeld[] = [
      { breite: 100, notiz: 'A' },
      { breite: 100, notiz: 'B' },
      { breite: 100, notiz: 'C' },
    ];
    const neu = uebernehmeBreiten(alt, [100, 100]);
    expect(neu.map((e) => e.notiz)).toEqual(['A', 'B']);
  });

  it('nimmt die Lücke mit', () => {
    const alt: Regalfeld[] = [{ breite: 100 }, { breite: 100, leer: true }];
    expect(uebernehmeBreiten(alt, [125, 125])[1]).toEqual({ breite: 125, leer: true });
  });
});
