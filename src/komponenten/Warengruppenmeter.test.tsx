// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Warengruppenmeter } from './Warengruppenmeter';
import { usePlanStore } from '../zustand/planStore';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Die Tabelle der Meter je Warengruppe.
 *
 * Gerechnet wird woanders – hier steht die Frage, ob das Ergebnis auch
 * ankommt, und ob es so geordnet ist wie die Liste links. Zwei Zahlen
 * nebeneinander, die Verschiedenes messen, sind leicht zu verwechseln; eine
 * leere Spalte, die wie eine Null aussieht, wäre der schlimmste Fall.
 */

const LISTE = {
  abteilungen: [
    { name: 'Trockensortiment', warengruppen: [{ name: 'Kaffee', sortimente: ['Bohnen'] }] },
    {
      name: 'Feinbackwaren',
      warengruppen: [{ name: 'Süßes', sortimente: ['Kuchen', 'Waffeln'] }],
    },
  ],
};

afterEach(() => {
  cleanup();
  usePlanStore.setState({ sortiment: { abteilungen: [] } });
});

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'wt100',
    ebeneId: 'einrichtung',
    name: 'Zug',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 250,
    tiefe: 70,
    hoehe: 220,
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

function projekt(elemente: PlanElement[]): Projekt {
  return {
    ...usePlanStore.getState().projekt,
    elemente,
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
  };
}

/** Ein Zug mit zwei Feldern à 125 cm, ganz mit einer Warengruppe beschriftet. */
function zug(teil: Partial<PlanElement> = {}) {
  return element({
    felderUnten: [
      { breite: 125, boeden: 5 },
      { breite: 125, boeden: 5 },
    ],
    warengruppenUnten: [{ von: 0, bis: 250, text: 'Kaffee' }],
    ...teil,
  });
}

/** Klappt den ganzen Baum auf – über den Pfeil in der Kopfzeile. */
async function klappeAuf() {
  await userEvent.click(screen.getByText('Meter je Warengruppe'));
  await userEvent.click(screen.getByTitle('Alles aufklappen'));
}

describe('Meter je Warengruppe', () => {
  it('sagt gar nichts, solange nichts im Plan steht', () => {
    const { container } = render(<Warengruppenmeter projekt={projekt([])} />);
    // Eine leere Tabelle wäre eine Zeile, die nur mitteilt, dass sie leer ist.
    expect(container.innerHTML).toBe('');
  });

  it('zeigt zugeklappt die Summe beider Spalten', () => {
    render(<Warengruppenmeter projekt={projekt([zug()])} />);
    // 2,50 lfm bei fünf Böden sind 12,50 tatsächliche Meter.
    expect(screen.getByText(/2,50 lfm/)).toBeTruthy();
    expect(screen.getByText(/12,50 tm/)).toBeTruthy();
  });

  it('ordnet nach den Abteilungen der Sortimentsliste', async () => {
    usePlanStore.setState({ sortiment: LISTE });
    render(<Warengruppenmeter projekt={projekt([zug()])} />);
    await klappeAuf();
    // Die Abteilung steht über der Warengruppe, wie in der Liste links.
    expect(screen.getByText('Trockensortiment')).toBeTruthy();
    const zeile = screen.getByText('Kaffee').closest('.meterzeile')!;
    expect(within(zeile as HTMLElement).getByText('2,50')).toBeTruthy();
    expect(within(zeile as HTMLElement).getByText('12,50')).toBeTruthy();
  });

  it('klappt zu und wieder auf', async () => {
    usePlanStore.setState({ sortiment: LISTE });
    render(<Warengruppenmeter projekt={projekt([zug()])} />);
    await userEvent.click(screen.getByText('Meter je Warengruppe'));
    // Zugeklappt steht die Abteilung da, die Warengruppe darunter nicht.
    expect(screen.getByText('Trockensortiment')).toBeTruthy();
    expect(screen.queryByText('Kaffee')).toBeNull();
    await userEvent.click(screen.getByTitle('Alles aufklappen'));
    expect(screen.getByText('Kaffee')).toBeTruthy();
  });

  it('trennt zwei gleiche Namen aus verschiedenen Abteilungen', async () => {
    // „Kuchen" steht in der Liste zweimal. Ohne Pfad liefe beides in eine
    // Zeile, und die Meter lägen an der falschen Stelle im Markt.
    usePlanStore.setState({
      sortiment: {
        abteilungen: [
          { name: 'Backwaren', warengruppen: [{ name: 'Bake Off', sortimente: ['Kuchen'] }] },
          ...LISTE.abteilungen,
        ],
      },
    });
    const a = zug({
      id: 'a',
      warengruppenUnten: [
        { von: 0, bis: 250, text: 'Kuchen', pfad: 'Backwaren › Bake Off › Kuchen' },
      ],
    });
    const b = zug({
      id: 'b',
      warengruppenUnten: [
        { von: 0, bis: 250, text: 'Kuchen', pfad: 'Feinbackwaren › Süßes › Kuchen' },
      ],
    });
    render(<Warengruppenmeter projekt={projekt([a, b])} />);
    await klappeAuf();
    expect(screen.getByText('Backwaren')).toBeTruthy();
    expect(screen.getByText('Feinbackwaren')).toBeTruthy();
    expect(screen.getAllByText('Kuchen')).toHaveLength(2);
  });

  it('nimmt den Namen aus dem Pfad und nicht den Text im Plan', async () => {
    // Im Plan steht „Marmorkuchen Aktion", gezählt wird es unter Kuchen.
    usePlanStore.setState({ sortiment: LISTE });
    const el = zug({
      warengruppenUnten: [
        { von: 0, bis: 250, text: 'Marmorkuchen Aktion', pfad: 'Feinbackwaren › Süßes › Kuchen' },
      ],
    });
    render(<Warengruppenmeter projekt={projekt([el])} />);
    await klappeAuf();
    expect(screen.getByText('Kuchen')).toBeTruthy();
    expect(screen.queryByText('Marmorkuchen Aktion')).toBeNull();
  });

  it('lässt die zweite Spalte leer, wo die Bodenzahl fehlt', async () => {
    usePlanStore.setState({ sortiment: LISTE });
    const ohne = zug({ felderUnten: [{ breite: 125 }, { breite: 125 }] });
    render(<Warengruppenmeter projekt={projekt([ohne])} />);
    await klappeAuf();
    const zeile = screen.getByText('Kaffee').closest('.meterzeile')!;
    // Ein Strich und keine Null: Null sähe aus wie „hier steht nichts".
    expect(within(zeile as HTMLElement).getByText('–')).toBeTruthy();
    expect(screen.getByText(/2,50 m/)).toBeTruthy();
  });

  it('führt die unbeschrifteten Meter mit, statt sie zu verschweigen', async () => {
    const halb = zug({ warengruppenUnten: [{ von: 0, bis: 125, text: 'Kaffee' }] });
    render(<Warengruppenmeter projekt={projekt([halb])} />);
    await klappeAuf();
    // Sonst wäre die Summe der Tabelle kleiner als der Markt, ohne dass man
    // sähe warum.
    const zeile = screen.getByText('ohne Warengruppe').closest('.meterzeile')!;
    expect(within(zeile as HTMLElement).getByText('1,25')).toBeTruthy();
  });

  it('bringt zugeordnete Meter zur Zielwarengruppe', async () => {
    // Wer vier Meter „Kuchen" einzeichnet, obwohl dort auch Waffeln liegen,
    // ordnet Waffeln dem Kuchen zu – dann steht in der Tabelle eine Zeile
    // „Kuchen" mit allen Metern und keine halbe „Waffeln".
    const kuchen = zug({ id: 'a', warengruppenUnten: [{ von: 0, bis: 250, text: 'Kuchen' }] });
    const waffeln = zug({ id: 'b', warengruppenUnten: [{ von: 0, bis: 250, text: 'Waffeln' }] });
    const plan = { ...projekt([kuchen, waffeln]), zuordnungen: { waffeln: 'Kuchen' } };

    render(<Warengruppenmeter projekt={plan} />);
    await klappeAuf();
    expect(screen.queryByText('Waffeln')).toBeNull();
    const zeile = screen.getByText('Kuchen').closest('.meterzeile')!;
    expect(within(zeile as HTMLElement).getByText('5,00')).toBeTruthy();
  });
});
