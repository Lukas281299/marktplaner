// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Warengruppenwahl } from './Warengruppenwahl';
import { usePlanStore } from '../zustand/planStore';

/**
 * Das Auswahlmenü über die Sortimentsliste.
 *
 * Es steht neben einem Textfeld, das die eigentliche Arbeit tut – geprüft
 * wird deshalb vor allem, dass es sich nicht wichtigmacht: kein Menü ohne
 * Liste, und kein Zustand, der neben dem Textfeld eine zweite Wahrheit
 * behauptet.
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
  usePlanStore.setState({ sortiment: { abteilungen: [] } });
});

describe('Warengruppen wählen', () => {
  it('erscheint gar nicht, solange keine Liste geladen ist', () => {
    const { container } = render(<Warengruppenwahl waehle={() => {}} />);
    // Ein leeres Menü wäre ein Knopf, der nichts tut.
    expect(container.innerHTML).toBe('');
  });

  it('führt Warengruppen und Sortimente unter ihrer Abteilung', () => {
    usePlanStore.setState({ sortiment: LISTE });
    render(<Warengruppenwahl waehle={() => {}} />);
    // Beide Stufen im selben Menü: Beim Planen greift man mal auf der einen
    // Höhe zu und mal auf der anderen.
    expect(screen.getByRole('group', { name: 'Backwaren' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Trockensortiment' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Bake Off' })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Croissants/ })).toBeTruthy();
  });

  it('gibt den gewählten Namen weiter und merkt sich nichts', async () => {
    usePlanStore.setState({ sortiment: LISTE });
    const waehle = vi.fn();
    render(<Warengruppenwahl waehle={waehle} />);
    const menue = screen.getByRole('combobox') as HTMLSelectElement;
    await userEvent.selectOptions(menue, 'Croissants');
    expect(waehle).toHaveBeenCalledWith('Croissants');
    // Danach steht es wieder auf leer – der gewählte Name gehört ins
    // Textfeld daneben und nicht zweimal in die Oberfläche.
    expect(menue.value).toBe('');
  });
});
