import { beforeEach, describe, expect, it } from 'vitest';
import { neuesProjekt } from '../daten/standardProjekt';
import { rechteck } from '../logik/polygon';
import { usePlanStore } from './planStore';

/**
 * Die Stärke, mit der neue Wände entstehen.
 *
 * Wer einen Grundriss von einer Vorlage abzeichnet, zieht zwanzig Wände
 * hintereinander, und die haben fast immer dasselbe Maß. Wäre die Stärke
 * fest eingebaut, müsste jede einzeln nachgestellt werden – zwanzigmal
 * dieselbe Zahl. Deshalb ist sie ein Wert, den man vorher einstellt und der
 * sich merkt, was zuletzt gewollt war.
 */

const store = () => usePlanStore.getState();
const punkt = (x: number, y: number) => ({ x: x * 100, y: y * 100 });

describe('Stärke neuer Wände', () => {
  beforeEach(() => {
    usePlanStore.setState({ wandstaerkeNeu: 24 });
    store().setzeProjekt(neuesProjekt());
  });

  it('gibt jeder neuen Wand die eingestellte Stärke', () => {
    store().setzeWandstaerkeNeu(30);
    const id = store().fuegeWandHinzu(punkt(1, 1), punkt(6, 1));
    expect(store().projekt.waende.find((w) => w.id === id)?.staerke).toBe(30);
  });

  it('gilt auch für die Trennwände abgetrennter Räume', () => {
    store().setzeWandstaerkeNeu(11);
    const id = store().fuegeRaumHinzu(rechteck(0, 0, 500, 400));
    expect(store().projekt.raeume.find((r) => r.id === id)?.wandstaerke).toBe(11);
  });

  it('merkt sich, was an einer fertigen Wand eingestellt wurde', () => {
    const erste = store().fuegeWandHinzu(punkt(1, 1), punkt(6, 1));
    store().aendereWand(erste, { staerke: 36 });

    // Die nächste Wand kommt gleich in 36 – ohne dass man es zweimal sagt.
    const zweite = store().fuegeWandHinzu(punkt(1, 3), punkt(6, 3));
    expect(store().projekt.waende.find((w) => w.id === zweite)?.staerke).toBe(36);
  });

  it('merkt sich auch die Stärke eines geänderten Raumes', () => {
    const raum = store().fuegeRaumHinzu(rechteck(0, 0, 500, 400));
    store().aendereRaum(raum, { wandstaerke: 17 });
    const wand = store().fuegeWandHinzu(punkt(1, 1), punkt(6, 1));
    expect(store().projekt.waende.find((w) => w.id === wand)?.staerke).toBe(17);
  });

  it('nimmt eine ausdrücklich übergebene Stärke vor die Voreinstellung', () => {
    store().setzeWandstaerkeNeu(24);
    const id = store().fuegeWandHinzu(punkt(1, 1), punkt(6, 1), 8);
    expect(store().projekt.waende.find((w) => w.id === id)?.staerke).toBe(8);
    // Und die Voreinstellung bleibt, wo sie war.
    expect(store().wandstaerkeNeu).toBe(24);
  });

  it('zieht ein Rechteck als vier Wände', () => {
    store().setzeWandstaerkeNeu(24);
    const ids = store().fuegeWandrechteckHinzu(rechteck(0, 0, 1000, 600));
    expect(ids).toHaveLength(4);

    const vier = store().projekt.waende.filter((w) => ids.includes(w.id));
    expect(vier.every((w) => w.staerke === 24)).toBe(true);

    // Geschlossen: Jede Wand endet, wo die nächste anfängt.
    for (let i = 0; i < vier.length; i++) {
      expect(vier[i].bis).toEqual(vier[(i + 1) % vier.length].von);
    }
  });

  it('nimmt das Rechteck mit einem Strg+Z zurück, nicht in Vierteln', () => {
    const vorher = store().projekt.waende.length;
    store().fuegeWandrechteckHinzu(rechteck(0, 0, 1000, 600));
    expect(store().projekt.waende).toHaveLength(vorher + 4);
    store().rueckgaengig();
    expect(store().projekt.waende).toHaveLength(vorher);
  });

  it('lässt keine unsinnig dünnen Wände zu', () => {
    store().setzeWandstaerkeNeu(0);
    expect(store().wandstaerkeNeu).toBeGreaterThanOrEqual(2);
    store().setzeWandstaerkeNeu(-40);
    expect(store().wandstaerkeNeu).toBeGreaterThanOrEqual(2);
  });
});
