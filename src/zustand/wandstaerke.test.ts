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

  it('gibt einem abgetrennten Raum keine eigene Wand', () => {
    // Der Raum markiert die Fläche; die Wände zieht der Planer selbst. Zwei
    // Wände an derselben Stelle wären im Plan nicht zu unterscheiden.
    store().setzeWandstaerkeNeu(11);
    const id = store().fuegeRaumHinzu(rechteck(0, 0, 500, 400));
    expect(store().projekt.raeume.find((r) => r.id === id)?.wandstaerke).toBe(0);
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

  it('macht aus einem liegenden Rechteck eine Wand: lang mal dick', () => {
    const id = store().fuegeWandAusRechteck(rechteck(100, 200, 1000, 24));
    const wand = store().projekt.waende.find((w) => w.id === id);
    expect(wand?.staerke).toBe(24);
    // Die Achse liegt in der Mitte der kurzen Seite.
    expect(wand?.von).toEqual({ x: 100, y: 212 });
    expect(wand?.bis).toEqual({ x: 1100, y: 212 });
  });

  it('erkennt auch eine stehende Wand', () => {
    const id = store().fuegeWandAusRechteck(rechteck(500, 100, 30, 800));
    const wand = store().projekt.waende.find((w) => w.id === id);
    expect(wand?.staerke).toBe(30);
    expect(wand?.von).toEqual({ x: 515, y: 100 });
    expect(wand?.bis).toEqual({ x: 515, y: 900 });
  });

  it('merkt sich die aufgezogene Stärke für die nächste Wand', () => {
    store().fuegeWandAusRechteck(rechteck(0, 0, 1000, 36));
    expect(store().wandstaerkeNeu).toBe(36.5);
  });

  it('rastet die aufgezogene Dicke auf ein Mauerwerksmaß', () => {
    // Aufgezogen wird nie auf den Zentimeter genau – und das Raster steht
    // meist auf einem halben Meter.
    const faelle: [number, number][] = [
      [22, 24],      // knapp daneben → 24er Mauerwerk
      [13, 11.5],    // eine leichte Trennwand
      [34, 36.5],    // die Außenwand
      [50, 49],      // noch im Band
    ];
    for (const [gezogen, erwartet] of faelle) {
      const id = store().fuegeWandAusRechteck(rechteck(0, 0, 1000, gezogen));
      expect(store().projekt.waende.find((w) => w.id === id)?.staerke).toBe(erwartet);
    }
  });

  it('nimmt bei einem Strich statt eines Rechtecks die Voreinstellung', () => {
    store().setzeWandstaerkeNeu(24);
    const id = store().fuegeWandAusRechteck(rechteck(0, 0, 1000, 2));
    expect(store().projekt.waende.find((w) => w.id === id)?.staerke).toBe(24);
  });

  it('lässt eine absichtlich dicke Vormauerung stehen', () => {
    const id = store().fuegeWandAusRechteck(rechteck(0, 0, 1000, 120));
    expect(store().projekt.waende.find((w) => w.id === id)?.staerke).toBe(120);
  });

  it('macht aus einem Umriss eine Wandfläche und rechnet ihre Maße aus', () => {
    // Ein Trapez: vorn 20 dick, hinten 40 – so sieht ein Zwickel zwischen
    // zwei schräg zusammenlaufenden Wänden aus.
    const id = store().fuegeWandflaecheHinzu([
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 40 },
      { x: 0, y: 20 },
    ])!;
    const wand = store().projekt.waende.find((w) => w.id === id)!;
    expect(wand.umriss).toHaveLength(4);
    expect(Math.round(wand.staerke)).toBe(30);
    // Und sie ist gewählt – man will gleich ihre Maße sehen.
    expect(store().sonderauswahl).toEqual({ art: 'wand', id });
  });

  it('nimmt beim Verschieben den Umriss mit', () => {
    const id = store().fuegeWandflaecheHinzu(rechteck(0, 0, 500, 24))!;
    store().verschiebeWand(id, 100, 50);
    const wand = store().projekt.waende.find((w) => w.id === id)!;
    expect(wand.umriss![0]).toEqual({ x: 100, y: 50 });
    // Sonst bliebe der Körper stehen und nur die gedachte Achse zöge weiter.
    expect(wand.von.y).toBe(62);
  });

  it('rechnet Achse und Dicke neu, wenn eine Ecke wandert', () => {
    const id = store().fuegeWandflaecheHinzu(rechteck(0, 0, 500, 24))!;
    store().verschiebeWandEcke(id, 2, { x: 500, y: 60 });
    const wand = store().projekt.waende.find((w) => w.id === id)!;
    // Aus 24 gleichmäßig wird 24 vorn und 60 hinten – im Mittel 42.
    expect(Math.round(wand.staerke)).toBe(42);
  });

  it('legt nichts an, wenn der Umriss keine Fläche hat', () => {
    expect(
      store().fuegeWandflaecheHinzu([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
      ]),
    ).toBeNull();
    expect(store().projekt.waende).toHaveLength(0);
  });

  it('lässt keine unsinnig dünnen Wände zu', () => {
    store().setzeWandstaerkeNeu(0);
    expect(store().wandstaerkeNeu).toBeGreaterThanOrEqual(2);
    store().setzeWandstaerkeNeu(-40);
    expect(store().wandstaerkeNeu).toBeGreaterThanOrEqual(2);
  });
});
