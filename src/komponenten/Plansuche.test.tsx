// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plansuche } from './Plansuche';
import { buehneSteuerung } from '../logik/buehne';
import { usePlanStore } from '../zustand/planStore';
import type { PlanElement } from '../typen/modell';

/**
 * Die Suche im Plan, von der Tastatur aus.
 *
 * Der erste Test in diesem Programm, der eine Bedienoberfläche wirklich
 * bedient statt sie nur zu berechnen. Das ist hier den Aufwand wert: Die
 * Suche ist reine Tastaturarbeit – tippen, Pfeiltasten, Enter, Escape –, und
 * genau daran merkt niemand etwas, wenn es kaputtgeht. Ein falsch gezeichnetes
 * Regal sieht man; eine Pfeiltaste, die den falschen Treffer wählt, nicht.
 *
 * Die Zeichenfläche bleibt außen vor. Sie ist eine Leinwand und lässt sich
 * ohne Browser nicht sinnvoll anklicken; ihre Logik wird weiterhin als
 * Geometrie geprüft.
 */

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'v1',
    ebeneId: 'einrichtung',
    name: 'Wandregal',
    kategorie: 'regale',
    x: 100,
    y: 200,
    breite: 100,
    tiefe: 60,
    drehung: 0,
    form: 'rechteck',
    farbe: '#888',
    beschriftung: '',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
    ...teil,
  } as PlanElement;
}

/** Setzt den Datenspeicher auf einen kleinen Plan mit drei Kaffeeregalen. */
function bauePlan(elemente: PlanElement[]) {
  const store = usePlanStore.getState();
  usePlanStore.setState({
    projekt: { ...store.projekt, elemente },
    auswahl: [],
    sonderauswahl: null,
    sucheOffen: true,
  });
}

const DREI = [
  element({ id: 'a', beschriftung: 'Kaffee Bohnen', x: 10, y: 20 }),
  element({ id: 'b', beschriftung: 'Kaffee Filter', x: 30, y: 40 }),
  element({ id: 'c', beschriftung: 'Konserven', notiz: 'neben Kaffee', x: 50, y: 60 }),
];

describe('Plansuche', () => {
  beforeEach(() => {
    bauePlan(DREI);
    buehneSteuerung.zeigeAuf = vi.fn();
  });

  afterEach(() => {
    cleanup();
    buehneSteuerung.zeigeAuf = null;
    usePlanStore.setState({ sucheOffen: false, auswahl: [] });
  });

  it('zeigt nichts, solange sie zu ist', () => {
    usePlanStore.setState({ sucheOffen: false });
    render(<Plansuche />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('schweigt bei einem einzelnen Buchstaben', async () => {
    const nutzer = userEvent.setup();
    render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'k');
    expect(screen.queryAllByRole('button', { name: /Kaffee/ })).toHaveLength(0);
  });

  it('findet ab zwei Buchstaben und zählt die Treffer', async () => {
    const nutzer = userEvent.setup();
    render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'Kaffee');
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Kaffee Bohnen')).toBeTruthy();
    expect(screen.getByText('Kaffee Filter')).toBeTruthy();
  });

  it('wählt den ersten Treffer vor, damit Enter sofort greift', async () => {
    const nutzer = userEvent.setup();
    const { container } = render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'Kaffee');
    const zeilen = [...container.querySelectorAll('.plansuche-zeile')];
    expect(zeilen[0].className).toContain('aktiv');
  });

  it('geht mit den Pfeiltasten durch und läuft am Ende um', async () => {
    const nutzer = userEvent.setup();
    const { container } = render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'Kaffee');
    const aktiv = () =>
      [...container.querySelectorAll('.plansuche-zeile')].findIndex((z) =>
        z.className.includes('aktiv'),
      );

    await nutzer.keyboard('{ArrowDown}');
    expect(aktiv()).toBe(1);
    await nutzer.keyboard('{ArrowDown}{ArrowDown}');
    // Nach dem letzten wieder der erste – sonst bliebe man am Ende hängen.
    expect(aktiv()).toBe(0);
    await nutzer.keyboard('{ArrowUp}');
    expect(aktiv()).toBe(2);
  });

  it('wählt mit Enter aus, fährt hin und geht weiter zum nächsten', async () => {
    const nutzer = userEvent.setup();
    render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'Kaffee');
    await nutzer.keyboard('{Enter}');

    expect(usePlanStore.getState().auswahl).toEqual(['a']);
    expect(buehneSteuerung.zeigeAuf).toHaveBeenCalledWith({ x: 10, y: 20 }, expect.any(Number));

    // Noch einmal Enter nimmt den nächsten – so klappert man alle ab.
    await nutzer.keyboard('{Enter}');
    expect(usePlanStore.getState().auswahl).toEqual(['b']);
  });

  it('wählt einen angeklickten Treffer aus', async () => {
    const nutzer = userEvent.setup();
    render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'Kaffee');
    await nutzer.click(screen.getByText('Kaffee Filter'));
    expect(usePlanStore.getState().auswahl).toEqual(['b']);
  });

  it('behält beim Klicken die Tastatur im Feld', async () => {
    // Sonst wäre die Pfeiltastensteuerung nach dem ersten Klick weg, und man
    // müsste zwischen Maus und Tastatur ständig zurückwechseln.
    const nutzer = userEvent.setup();
    render(<Plansuche />);
    const feld = screen.getByRole('textbox');
    await nutzer.type(feld, 'Kaffee');
    await nutzer.click(screen.getByText('Kaffee Filter'));
    expect(document.activeElement).toBe(feld);
  });

  it('schließt mit Escape', async () => {
    const nutzer = userEvent.setup();
    render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'Kaffee');
    await nutzer.keyboard('{Escape}');
    expect(usePlanStore.getState().sucheOffen).toBe(false);
  });

  it('sagt es, wenn nichts da ist – und wo überall gesucht wurde', async () => {
    const nutzer = userEvent.setup();
    render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'Zahnpasta');
    expect(screen.getByText('nichts')).toBeTruthy();
    expect(screen.getByText(/Beschriftung, Name, Warengruppe/)).toBeTruthy();
  });

  it('nennt bei einem Fund außerhalb des Titels das Feld', async () => {
    const nutzer = userEvent.setup();
    render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'neben');
    expect(screen.getByText(/Notiz: neben Kaffee/)).toBeTruthy();
  });

  it('fängt sich, wenn die Zeichenfläche noch nicht bereit ist', async () => {
    // `zeigeAuf` wird erst gesetzt, wenn die Zeichenfläche eine brauchbare
    // Größe hat. Wer vorher sucht, darf keinen Absturz bekommen.
    buehneSteuerung.zeigeAuf = null;
    const nutzer = userEvent.setup();
    render(<Plansuche />);
    await nutzer.type(screen.getByRole('textbox'), 'Kaffee');
    await nutzer.keyboard('{Enter}');
    expect(usePlanStore.getState().auswahl).toEqual(['a']);
  });
});
