// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Aktionsgruppe, Werkzeuggruppe, type Werkzeugeintrag } from './Werkzeuggruppe';
import { usePlanStore } from '../zustand/planStore';

/**
 * Die Ausklappgruppen der Werkzeugleiste.
 *
 * Was hier geprüft wird, ist das Versprechen der Gruppe: Wer immer dasselbe
 * Werkzeug nimmt, soll von ihr nichts merken. Der Knopf muss also zeigen, was
 * man zuletzt gewählt hat, und ein Klick darauf muss genau danach greifen –
 * ohne Umweg über das Menü. Geht das verloren, hat man aus einem Klick zwei
 * gemacht, und niemand sieht sofort, warum die Leiste sich zäh anfühlt.
 */

const GEBAEUDE: Werkzeugeintrag[] = [
  { werkzeug: 'umriss', text: 'Umriss', symbol: null, titel: 'Ecken ziehen' },
  { werkzeug: 'grundrissZeichnen', text: 'Frei zeichnen', symbol: null, titel: 'Neu aufziehen' },
  { werkzeug: 'flaecheAnfuegen', text: 'Anfügen', symbol: null, titel: 'Rechteck dazu' },
];

/** Der Knopf, der das aktuelle Werkzeug der Gruppe zeigt. */
const hauptknopf = (container: HTMLElement) =>
  container.querySelector('.knopf-gruppe') as HTMLButtonElement;
const pfeil = (container: HTMLElement) =>
  container.querySelector('.knopf-gruppenpfeil') as HTMLButtonElement;

describe('Werkzeuggruppe', () => {
  beforeEach(() => usePlanStore.setState({ werkzeug: 'auswahl' }));
  afterEach(cleanup);

  it('zeigt zu Anfang das erste Werkzeug der Gruppe', () => {
    const { container } = render(<Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />);
    expect(hauptknopf(container).textContent).toContain('Umriss');
  });

  it('greift mit einem Klick, ohne das Menü zu öffnen', async () => {
    const nutzer = userEvent.setup();
    const { container } = render(<Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />);
    await nutzer.click(hauptknopf(container));
    expect(usePlanStore.getState().werkzeug).toBe('umriss');
    expect(container.querySelector('.werkzeugmenue')).toBeNull();
  });

  it('legt das Werkzeug beim zweiten Klick wieder weg', async () => {
    const nutzer = userEvent.setup();
    const { container } = render(<Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />);
    await nutzer.click(hauptknopf(container));
    await nutzer.click(hauptknopf(container));
    expect(usePlanStore.getState().werkzeug).toBe('auswahl');
  });

  it('öffnet über den Pfeil die ganze Gruppe', async () => {
    const nutzer = userEvent.setup();
    const { container } = render(<Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />);
    await nutzer.click(pfeil(container));
    const menue = document.querySelector('.werkzeugmenue') as HTMLElement;
    expect(menue.textContent).toContain('Gebäude');
    // Im Menü stehen alle drei – der Knopf selbst zeigt eines davon
    // zusätzlich, deshalb wird hier nur im Menü gesucht.
    const zeilen = [...menue.querySelectorAll('.werkzeugmenue-zeile strong')].map(
      (e) => e.textContent,
    );
    expect(zeilen).toEqual(GEBAEUDE.map((e) => e.text));
  });

  it('merkt sich das zuletzt gewählte Werkzeug für den nächsten Klick', async () => {
    // Der eigentliche Zweck der Gruppe: Wer zweimal hintereinander „Anfügen"
    // braucht, soll nicht zweimal durchs Menü.
    const nutzer = userEvent.setup();
    const { container } = render(<Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />);
    await nutzer.click(pfeil(container));
    await nutzer.click(screen.getByText('Anfügen'));
    expect(usePlanStore.getState().werkzeug).toBe('flaecheAnfuegen');

    // Weglegen – der Knopf zeigt trotzdem weiter „Anfügen".
    await nutzer.click(hauptknopf(container));
    expect(usePlanStore.getState().werkzeug).toBe('auswahl');
    expect(hauptknopf(container).textContent).toContain('Anfügen');

    // Und der nächste Klick greift wieder danach.
    await nutzer.click(hauptknopf(container));
    expect(usePlanStore.getState().werkzeug).toBe('flaecheAnfuegen');
  });

  it('zeigt ein von außen gesetztes Werkzeug der Gruppe an', async () => {
    // Etwa nach einer Tastenkombination: Der Knopf muss mitziehen, sonst
    // steht in der Leiste etwas anderes als im Plan gilt.
    const { container } = render(<Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />);
    usePlanStore.setState({ werkzeug: 'grundrissZeichnen' });
    await Promise.resolve();
    expect(hauptknopf(container).textContent).toContain('Frei zeichnen');
    expect(hauptknopf(container).className).toContain('aktiv');
  });

  it('bleibt blass, solange ein fremdes Werkzeug gewählt ist', () => {
    const { container } = render(<Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />);
    usePlanStore.setState({ werkzeug: 'messen' });
    expect(hauptknopf(container).className).not.toContain('aktiv');
  });

  it('schließt das Menü beim Klick daneben', async () => {
    const nutzer = userEvent.setup();
    const { container } = render(
      <div>
        <Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />
        <button>irgendwo sonst</button>
      </div>,
    );
    await nutzer.click(pfeil(container));
    expect(document.querySelector('.werkzeugmenue')).toBeTruthy();
    await nutzer.click(screen.getByText('irgendwo sonst'));
    expect(document.querySelector('.werkzeugmenue')).toBeNull();
  });

  it('schließt das Menü mit Escape', async () => {
    const nutzer = userEvent.setup();
    const { container } = render(<Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />);
    await nutzer.click(pfeil(container));
    await nutzer.keyboard('{Escape}');
    expect(document.querySelector('.werkzeugmenue')).toBeNull();
  });

  it('hängt das Menü ans Fenster, nicht in die Leiste', async () => {
    // Die Werkzeugleiste trägt `overflow-y: auto`; darin wäre das Menü an
    // ihrer Unterkante abgeschnitten.
    const nutzer = userEvent.setup();
    const { container } = render(<Werkzeuggruppe gruppe="Gebäude" eintraege={GEBAEUDE} />);
    await nutzer.click(pfeil(container));
    const menue = document.querySelector('.werkzeugmenue');
    expect(menue?.parentElement).toBe(document.body);
    expect(container.contains(menue)).toBe(false);
  });
});

describe('Aktionsgruppe', () => {
  afterEach(cleanup);

  it('führt erst aus, wenn man den Eintrag wählt – nicht beim Aufklappen', async () => {
    const nutzer = userEvent.setup();
    const getan = vi.fn();
    render(
      <Aktionsgruppe
        gruppe="Ausgeben"
        symbol={null}
        titel="Den Plan ausgeben"
        eintraege={[{ text: 'PDF oder SVG', titel: 'Zum Drucken', symbol: null, tun: getan }]}
      />,
    );

    await nutzer.click(screen.getByTitle('Den Plan ausgeben'));
    expect(getan).not.toHaveBeenCalled();

    await nutzer.click(screen.getByText('PDF oder SVG'));
    expect(getan).toHaveBeenCalledTimes(1);
    // Nach der Wahl ist das Menü wieder zu.
    expect(document.querySelector('.werkzeugmenue')).toBeNull();
  });
});
