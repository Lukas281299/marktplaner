import { describe, expect, it } from 'vitest';
import {
  enthaelt,
  feldlage,
  mitZugeordnetenFeldern,
  namenIm,
  ohneZugeordneteFelder,
  umgeschaltet,
} from './warengruppenzuordnung';
import { felderVon } from './regalseiten';
import type { Feldbezug, PlanElement } from '../typen/modell';

/**
 * Prüfungen fürs Zuordnen einer Warengruppe an markierte Meter.
 *
 * Der Kern: Geschrieben wird in **dieselben Felder**, die man in der
 * Gondelübersicht von Hand füllt. Es gibt nur eine Sorte Beschriftung – sonst
 * findet man beim Nachbessern zwei Stellen und ändert die falsche.
 *
 * Dazu zwei Zusagen, die man erst im gedruckten Plan sieht: Vier Meter Eier
 * tragen **einen** Namen und nicht viermal denselben. Und der Text hängt am
 * ersten Meter der Strecke **im Bild** – bei einem Zug an der unteren Wand
 * ist das der mit der höchsten Nummer.
 */

/** Eine Gondel: ein Element, sechs Meter, beide Seiten. */
const gondel = (werte: Partial<PlanElement> = {}): PlanElement =>
  ({
    id: 'zug',
    vorlageId: 'wt-zug',
    ebeneId: 'einrichtung',
    name: 'Gondel',
    kategorie: 'regale',
    x: 1300,
    y: 1000,
    breite: 600,
    tiefe: 127,
    hoehe: 180,
    drehung: 0,
    form: 'wt100',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
    beidseitig: true,
    achsmass: 100,
    ...werte,
  }) as PlanElement;

const f = (feld: number, seite: 'oben' | 'unten' = 'unten'): Feldbezug => ({
  element: 'zug',
  seite,
  feld,
});

/** Die Warengruppen einer Seite, kurz aufgeschrieben. */
const gruppen = (elemente: PlanElement[], seite: 'oben' | 'unten' = 'unten') =>
  felderVon(elemente[0], seite).map((feld) =>
    feld.warengruppe ? `${feld.warengruppe.text}/${feld.warengruppe.felder}` : '—',
  );

describe('Markieren', () => {
  it('nimmt einen Meter auf und wieder heraus', () => {
    const eins = umgeschaltet([], f(0));
    expect(enthaelt(eins, f(0))).toBe(true);
    expect(umgeschaltet(eins, f(0))).toEqual([]);
  });

  it('hält die beiden Seiten auseinander', () => {
    // Vorder- und Rückseite einer Gondel sind verschiedene Meter.
    expect(umgeschaltet(umgeschaltet([], f(2, 'unten')), f(2, 'oben'))).toHaveLength(2);
  });
});

describe('Zuordnen schreibt in die Felder', () => {
  it('macht aus vier Metern eine Strecke mit einem Namen', () => {
    const neu = mitZugeordnetenFeldern([gondel()], [f(0), f(1), f(2), f(3)], 'Eier');
    expect(gruppen(neu)).toEqual(['Eier/4', '—', '—', '—', '—', '—']);
  });

  it('schreibt auch bei einem einzelnen Meter', () => {
    expect(gruppen(mitZugeordnetenFeldern([gondel()], [f(2)], 'Eier'))[2]).toBe('Eier/1');
  });

  it('hängt einen zweiten Namen mit Komma an', () => {
    const eins = mitZugeordnetenFeldern([gondel()], [f(0), f(1)], 'Eier');
    const zwei = mitZugeordnetenFeldern(eins, [f(1), f(0)], 'Butter');
    expect(gruppen(zwei)[0]).toBe('Eier, Butter/2');
    expect(namenIm('Eier, Butter')).toEqual(['Eier', 'Butter']);
  });

  it('hängt denselben Namen nicht zweimal an', () => {
    const eins = mitZugeordnetenFeldern([gondel()], [f(0)], 'Eier');
    expect(gruppen(mitZugeordnetenFeldern(eins, [f(0)], 'eier'))[0]).toBe('Eier/1');
  });

  it('macht aus Lücken mehrere Strecken', () => {
    // Zwischen zwei markierten Stücken steht etwas anderes – da gehört auch
    // eine eigene Beschriftung hin.
    const neu = mitZugeordnetenFeldern([gondel()], [f(0), f(1), f(4)], 'Eier');
    expect(gruppen(neu)).toEqual(['Eier/2', '—', '—', '—', 'Eier/1', '—']);
  });

  it('räumt weg, was auf der Strecke sonst noch stand', () => {
    // Zwei Beschriftungen auf derselben Strecke kann der Plan nicht zeigen.
    const eins = mitZugeordnetenFeldern([gondel()], [f(2)], 'Butter');
    const zwei = mitZugeordnetenFeldern(eins, [f(0), f(1), f(2)], 'Eier');
    expect(gruppen(zwei)).toEqual(['Eier/3', '—', '—', '—', '—', '—']);
  });

  it('hängt den Text bei einem gedrehten Zug ans andere Ende', () => {
    // An der unteren Wand läuft die eigene Achse von rechts nach links; der
    // erste Meter im Bild ist dort der mit der höchsten Nummer.
    const neu = mitZugeordnetenFeldern([gondel({ drehung: 180 })], [f(0), f(1)], 'Eier');
    expect(gruppen(neu)).toEqual(['—', 'Eier/2', '—', '—', '—', '—']);
  });

  it('schreibt auf der Rückseite in deren eigene Felder', () => {
    const neu = mitZugeordnetenFeldern([gondel()], [f(0, 'oben')], 'Eier');
    expect(gruppen(neu, 'oben')[0]).toBe('Eier/1');
    expect(gruppen(neu, 'unten')[0]).toBe('—');
  });

  it('tut ohne Markierung oder ohne Namen nichts', () => {
    const el = [gondel()];
    expect(mitZugeordnetenFeldern(el, [], 'Eier')).toBe(el);
    expect(mitZugeordnetenFeldern(el, [f(0)], '   ')).toBe(el);
  });
});

describe('Wieder wegnehmen', () => {
  it('leert die markierten Meter', () => {
    // Damit man einen Fehlgriff loswird, ohne sich in die Gondelübersicht
    // hineinzuklicken.
    const eins = mitZugeordnetenFeldern([gondel()], [f(0), f(1)], 'Eier');
    expect(gruppen(ohneZugeordneteFelder(eins, [f(0), f(1)]))).toEqual([
      '—',
      '—',
      '—',
      '—',
      '—',
      '—',
    ]);
  });

  it('lässt die übrigen stehen', () => {
    const eins = mitZugeordnetenFeldern([gondel()], [f(0)], 'Eier');
    const zwei = mitZugeordnetenFeldern(eins, [f(3)], 'Butter');
    expect(gruppen(ohneZugeordneteFelder(zwei, [f(0)]))[3]).toBe('Butter/1');
  });
});

describe('Wo ein Meter liegt', () => {
  it('findet die Vorderkante des ersten Meters', () => {
    // Der Zug reicht von 1000 bis 1600, sechs Meter. Der erste hat seine
    // Mitte bei 1050, die Vorderkante bei y = 1000 + 127/2.
    const lage = feldlage(gondel(), 'unten', 0)!;
    expect(lage.x).toBeCloseTo(1050, 3);
    expect(lage.y).toBeCloseTo(1063.5, 3);
    expect(lage.breite).toBeCloseTo(100, 3);
  });

  it('legt die Rückseite an die andere Kante', () => {
    const lage = feldlage(gondel(), 'oben', 0)!;
    expect(lage.y).toBeCloseTo(936.5, 3);
    expect(lage.seite).toBe('oben');
  });

  it('gibt es einen Meter nicht, kommt nichts zurück', () => {
    expect(feldlage(gondel(), 'unten', 9)).toBeNull();
  });
});
