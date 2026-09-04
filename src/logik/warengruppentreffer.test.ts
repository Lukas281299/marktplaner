import { describe, expect, it } from 'vitest';
import { warengruppeUnterPunkt } from './warengruppentreffer';
import type { PlanElement } from '../typen/modell';

/**
 * Prüfungen für „zählt zu" per Klick in den Plan.
 *
 * Wer Waffeln dem Kuchen zuschlägt, klickt die Meter an, auf denen der Kuchen
 * schon steht. Trifft die Rechnung daneben, laufen die Meter auf den Nachbarn
 * oder auf die falsche Gondelseite – und das fällt erst in der Auswertung auf,
 * wo eine Zahl zu groß und eine zu klein ist.
 */

const zug = (werte: Partial<PlanElement> = {}): PlanElement =>
  ({
    id: 'z',
    vorlageId: 'wt-zug',
    ebeneId: 'einrichtung',
    name: 'Zug',
    kategorie: 'regale',
    // Mitte bei (1000, 1000), fünf Felder à 1 m, 67 tief: 750 bis 1250.
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
    warengruppenUnten: [
      { von: 0, bis: 200, text: 'Kuchen', pfad: 'Lebensmittel › Feinbackwaren › Kuchen' },
      { von: 300, bis: 500, text: 'Kekse' },
    ],
    ...werte,
  }) as PlanElement;

describe('Warengruppe unter dem Punkt', () => {
  it('findet die Strecke, auf die geklickt wurde', () => {
    expect(warengruppeUnterPunkt(zug(), { x: 800, y: 1000 })).toEqual({
      name: 'Kuchen',
      pfad: 'Lebensmittel › Feinbackwaren › Kuchen',
    });
    expect(warengruppeUnterPunkt(zug(), { x: 1200, y: 1000 })?.name).toBe('Kekse');
  });

  it('gibt den Pfad mit, wenn einer da ist – sonst nur den Namen', () => {
    // Der Pfad entscheidet später, welcher der beiden „Kuchen" gemeint ist.
    expect(warengruppeUnterPunkt(zug(), { x: 1200, y: 1000 })?.pfad).toBeUndefined();
  });

  it('gibt nichts zurück, wo keine Strecke liegt', () => {
    // Die Lücke zwischen 200 und 300, also 950 bis 1050 im Plan.
    expect(warengruppeUnterPunkt(zug(), { x: 1000, y: 1000 })).toBeNull();
  });

  it('gibt nichts zurück, wenn der Punkt neben dem Möbel liegt', () => {
    expect(warengruppeUnterPunkt(zug(), { x: 700, y: 1000 })).toBeNull();
    expect(warengruppeUnterPunkt(zug(), { x: 1300, y: 1000 })).toBeNull();
    expect(warengruppeUnterPunkt(zug(), { x: 800, y: 1200 })).toBeNull();
  });

  it('unterscheidet bei einer Gondel die beiden Seiten', () => {
    const gondel = zug({
      beidseitig: true,
      tiefe: 127,
      warengruppenOben: [{ von: 0, bis: 500, text: 'Konserven' }],
    });
    expect(warengruppeUnterPunkt(gondel, { x: 800, y: 1040 })?.name).toBe('Kuchen');
    expect(warengruppeUnterPunkt(gondel, { x: 800, y: 960 })?.name).toBe('Konserven');
  });

  it('folgt der Drehung des Möbels', () => {
    const hochkant = zug({ drehung: 90 });
    expect(warengruppeUnterPunkt(hochkant, { x: 1000, y: 800 })?.name).toBe('Kuchen');
    expect(warengruppeUnterPunkt(hochkant, { x: 1000, y: 1200 })?.name).toBe('Kekse');
  });

  it('rechnet die Streckung mit, wenn die Seiten verschieden lang sind', () => {
    // Vorn 5 m Felder, das Möbel aber nur 250 cm breit gezeichnet: Die
    // Strecken werden auf die halbe Breite gestaucht. Bei 690 im Plan sind
    // das 80 cm in der Feldkette – noch Kuchen.
    const gestaucht = zug({ breite: 250, felderUnten: [100, 100, 100, 100, 100].map((b) => ({ breite: b })) });
    expect(warengruppeUnterPunkt(gestaucht, { x: 915, y: 1000 })?.name).toBe('Kuchen');
    expect(warengruppeUnterPunkt(gestaucht, { x: 1060, y: 1000 })?.name).toBe('Kekse');
  });

  it('übergeht eine Strecke ohne Text', () => {
    const leer = zug({ warengruppenUnten: [{ von: 0, bis: 500, text: '   ' }] });
    expect(warengruppeUnterPunkt(leer, { x: 800, y: 1000 })).toBeNull();
  });
});
