import { describe, expect, it } from 'vitest';
import { moebelliste, moebelsumme } from './moebelliste';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Prüfungen für die Stückliste.
 *
 * Sie ist die Liste, mit der man bestellt – was hier zusammenfällt, was
 * eigentlich getrennt gehört, merkt man erst bei der Lieferung.
 */

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'wt100-a1000',
    ebeneId: 'einrichtung',
    name: 'Wandregal',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 100,
    tiefe: 60,
    drehung: 0,
    form: 'wt100',
    farbe: '#888',
    beschriftung: '',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
    ...teil,
  } as PlanElement;
}

function projekt(elemente: PlanElement[], sichtbar = true): Projekt {
  return {
    id: 'p1',
    name: 'Testmarkt',
    version: 20,
    erstelltAm: 0,
    geaendertAm: 0,
    grundflaeche: { umriss: [], wandstaerke: 30 },
    einstellungen: {} as Projekt['einstellungen'],
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar, gesperrt: false }],
    raeume: [],
    waende: [],
    oeffnungen: [],
    elemente,
    gruppen: [],
    masslinien: [],
    verkaufsflaechen: [],
  } as unknown as Projekt;
}

describe('Stückliste', () => {
  it('zählt gleiche Möbel zusammen', () => {
    const zeilen = moebelliste(
      projekt([element({ id: 'a' }), element({ id: 'b' }), element({ id: 'c' })]),
    );
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].anzahl).toBe(3);
    expect(zeilen[0].laenge).toBe(300);
    expect(zeilen[0].flaeche).toBe(1.8);
  });

  it('trennt verschiedene Längen derselben Vorlage', () => {
    // Ein von Hand verlängerter Zug ist nicht dasselbe Möbel wie der aus dem
    // Katalog – und bestellt wird er einzeln.
    const zeilen = moebelliste(
      projekt([element({ id: 'a' }), element({ id: 'b', breite: 250 })]),
    );
    expect(zeilen).toHaveLength(2);
    expect(zeilen.map((z) => z.laenge).sort((a, b) => a - b)).toEqual([100, 250]);
  });

  it('nimmt den eigenen Namen, wo es keine Vorlage gibt', () => {
    // Ein frei gezeichnetes Element oder eines aus einem eingelesenen Plan
    // hat keine Vorlage mehr. Eine leere Zeile wäre schlechter.
    const zeilen = moebelliste(projekt([element({ vorlageId: 'gibtsnicht', name: 'Stütze' })]));
    expect(zeilen[0].name).toBe('Stütze');
  });

  it('lässt eine ausgeblendete Ebene weg', () => {
    // Wer eine Ebene ausblendet, meint „die gehören gerade nicht dazu".
    expect(moebelliste(projekt([element({})], false))).toHaveLength(0);
  });

  it('stellt die häufigsten nach oben', () => {
    const zeilen = moebelliste(
      projekt([
        element({ id: 'a', vorlageId: 'x', name: 'Selten' }),
        element({ id: 'b' }),
        element({ id: 'c' }),
      ]),
    );
    expect(zeilen[0].anzahl).toBe(2);
  });

  it('zählt die Summen', () => {
    const zeilen = moebelliste(
      projekt([element({ id: 'a' }), element({ id: 'b', vorlageId: 'x', breite: 200 })]),
    );
    expect(moebelsumme(zeilen)).toEqual({ anzahl: 2, flaeche: 1.8 });
  });
});
