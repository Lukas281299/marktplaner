// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Warengruppenwahl } from './Warengruppenwahl';
import { usePlanStore } from '../zustand/planStore';

/**
 * Das Auswahlmenü über die Sortimentsliste.
 *
 * Es soll dieselbe Liste sein wie links – drei Stufen, aufklappbare
 * Abteilungen, eine Suche. Ein Auswahlfeld konnte das nicht: zwei Ebenen,
 * alles auf einmal, keine Suche. Geprüft wird deshalb vor allem, dass die
 * Gruppierung wirklich ankommt und dass sich das Menü nicht wichtigmacht.
 */

const LISTE = {
  abteilungen: [
    {
      name: 'Backwaren',
      warengruppen: [{ name: 'Bake Off', sortimente: ['Croissants', 'Laugengebäck'] }],
    },
    { name: 'Trockensortiment', warengruppen: [{ name: 'Kaffee', sortimente: [] }] },
  ],
};

afterEach(() => {
  cleanup();
  usePlanStore.setState({ sortiment: { abteilungen: [] }, offeneAbteilungen: [] });
});

/** Öffnet das Menü und gibt den Knopf zurück. */
async function oeffne() {
  const knopf = screen.getByTitle('Aus der Sortimentsliste wählen');
  await userEvent.click(knopf);
  return knopf;
}

describe('Warengruppen wählen', () => {
  it('erscheint gar nicht, solange keine Liste geladen ist', () => {
    const { container } = render(<Warengruppenwahl waehle={() => {}} />);
    // Ein leeres Menü wäre ein Knopf, der nichts tut.
    expect(container.innerHTML).toBe('');
  });

  it('zeigt zugeklappt nur die Abteilungen', async () => {
    usePlanStore.setState({ sortiment: LISTE });
    render(<Warengruppenwahl waehle={() => {}} />);
    await oeffne();
    expect(screen.getByText('Backwaren')).toBeTruthy();
    expect(screen.getByText('Trockensortiment')).toBeTruthy();
    // Genau wie links: Was zu ist, ist zu.
    expect(screen.queryByText('Bake Off')).toBeNull();
  });

  it('klappt eine Abteilung auf und zeigt beide Stufen', async () => {
    usePlanStore.setState({ sortiment: LISTE });
    render(<Warengruppenwahl waehle={() => {}} />);
    await oeffne();
    await userEvent.click(screen.getByText('Backwaren'));
    expect(screen.getByText('Bake Off')).toBeTruthy();
    expect(screen.getByText('Croissants')).toBeTruthy();
  });

  it('sucht über alle drei Stufen und klappt dafür auf', async () => {
    usePlanStore.setState({ sortiment: LISTE });
    render(<Warengruppenwahl waehle={() => {}} />);
    await oeffne();
    await userEvent.type(screen.getByPlaceholderText('Suchen …'), 'crois');
    // Wer sucht, will den Treffer sehen und ihn nicht erst aufklappen.
    expect(screen.getByText('Croissants')).toBeTruthy();
    expect(screen.queryByText('Trockensortiment')).toBeNull();
  });

  it('gibt den gewählten Namen weiter und schließt sich', async () => {
    usePlanStore.setState({ sortiment: LISTE, offeneAbteilungen: ['Backwaren'] });
    const waehle = vi.fn();
    render(<Warengruppenwahl waehle={waehle} />);
    await oeffne();
    await userEvent.click(screen.getByText('Croissants'));
    expect(waehle).toHaveBeenCalledWith('Croissants');
    expect(screen.queryByPlaceholderText('Suchen …')).toBeNull();
  });

  it('sagt bei einem Fehlschlag, dass man trotzdem tippen darf', async () => {
    usePlanStore.setState({ sortiment: LISTE });
    render(<Warengruppenwahl waehle={() => {}} />);
    await oeffne();
    await userEvent.type(screen.getByPlaceholderText('Suchen …'), 'zzz');
    // Die Liste ist eine Hilfe und keine Vorschrift – das muss dastehen.
    expect(screen.getByText(/eintippen/)).toBeTruthy();
  });
});
