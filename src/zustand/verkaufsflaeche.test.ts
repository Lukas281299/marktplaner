import { beforeEach, describe, expect, it } from 'vitest';
import { neuesProjekt } from '../daten/standardProjekt';
import { rechteck } from '../logik/polygon';
import { usePlanStore } from './planStore';

/**
 * Prüfungen für die eingezeichnete Verkaufsfläche im Datenspeicher.
 *
 * Zwei Dinge müssen sitzen, weil sie sonst Arbeit vernichten: Jede
 * Teilfläche muss einzeln rückgängig zu machen sein, und eine gesperrte
 * Fläche darf sich weder verschieben noch löschen lassen. Eine Sperre, die
 * nur die Hälfte hält, ist schlimmer als gar keine.
 */

const store = () => usePlanStore.getState();

/** Ein Rechteck aus Metern. */
const flaeche = (x: number, y: number, b: number, h: number) =>
  rechteck(x * 100, y * 100, b * 100, h * 100);

describe('Verkaufsflächen einzeichnen', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('legt eine Fläche an und wählt sie gleich aus', () => {
    const id = store().fuegeVerkaufsflaecheHinzu(flaeche(0, 0, 20, 15));
    const projekt = store().projekt;
    expect(projekt.verkaufsflaechen).toHaveLength(1);
    expect(projekt.verkaufsflaechen[0].id).toBe(id);
    expect(store().sonderauswahl).toEqual({ art: 'verkaufsflaeche', id });
  });

  it('nummeriert die Teilflächen durch', () => {
    store().fuegeVerkaufsflaecheHinzu(flaeche(0, 0, 10, 10));
    store().fuegeVerkaufsflaecheHinzu(flaeche(20, 0, 10, 10));
    expect(store().projekt.verkaufsflaechen.map((v) => v.name)).toEqual([
      'Verkaufsfläche 1',
      'Verkaufsfläche 2',
    ]);
  });

  it('nimmt jede Fläche einzeln wieder zurück', () => {
    store().fuegeVerkaufsflaecheHinzu(flaeche(0, 0, 10, 10));
    store().fuegeVerkaufsflaecheHinzu(flaeche(20, 0, 10, 10));
    store().rueckgaengig();
    expect(store().projekt.verkaufsflaechen).toHaveLength(1);
    store().rueckgaengig();
    expect(store().projekt.verkaufsflaechen).toHaveLength(0);
  });

  it('verschiebt eine Fläche mitsamt allen Ecken', () => {
    const id = store().fuegeVerkaufsflaecheHinzu(flaeche(0, 0, 10, 10));
    store().verschiebeVerkaufsflaeche(id, 250, 100);
    const umriss = store().projekt.verkaufsflaechen[0].umriss;
    expect(umriss[0]).toEqual({ x: 250, y: 100 });
    expect(umriss.every((p) => p.x >= 250 && p.y >= 100)).toBe(true);
  });

  it('ändert Name und Farbe', () => {
    const id = store().fuegeVerkaufsflaecheHinzu(flaeche(0, 0, 10, 10));
    store().aendereVerkaufsflaeche(id, { name: 'Vorkasse', farbe: '#123456' });
    const v = store().projekt.verkaufsflaechen[0];
    expect(v.name).toBe('Vorkasse');
    expect(v.farbe).toBe('#123456');
  });

  it('löscht die ausgewählte Fläche', () => {
    store().fuegeVerkaufsflaecheHinzu(flaeche(0, 0, 10, 10));
    store().loescheSonderauswahl();
    expect(store().projekt.verkaufsflaechen).toHaveLength(0);
    expect(store().sonderauswahl).toBeNull();
  });

  it('hält die Sperre beim Löschen und beim Verschieben', () => {
    const id = store().fuegeVerkaufsflaecheHinzu(flaeche(0, 0, 10, 10));
    store().aendereVerkaufsflaeche(id, { gesperrt: true });

    store().loescheSonderauswahl();
    expect(store().projekt.verkaufsflaechen).toHaveLength(1);

    store().verschiebeVerkaufsflaeche(id, 250, 100);
    expect(store().projekt.verkaufsflaechen[0].umriss[0]).toEqual({ x: 0, y: 0 });
  });

  it('hebt beim Auswählen einer Fläche die Elementauswahl auf', () => {
    // Das Eigenschaftenfenster zeigt immer nur eines von beiden – bliebe die
    // Elementauswahl bestehen, wäre sie unsichtbar und trotzdem wirksam.
    usePlanStore.setState({ auswahl: ['element-1'] });
    store().fuegeVerkaufsflaecheHinzu(flaeche(0, 0, 10, 10));
    expect(store().auswahl).toEqual([]);
  });
});
