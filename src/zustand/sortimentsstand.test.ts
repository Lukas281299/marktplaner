import { beforeEach, describe, expect, it } from 'vitest';
import { BIBLIOTHEK } from '../daten/bibliothek';
import { neuesProjekt } from '../daten/standardProjekt';
import { pfadVon, standVon } from '../logik/sortiment';
import { pfadeImPlan } from '../logik/planstand';
import { usePlanStore } from './planStore';
import type { Sortimentsliste } from '../daten/warengruppen';

/**
 * Prüfungen für den Haken in der Sortimentsliste.
 *
 * Zwei gemeldete Fälle, beide dieselbe Wurzel: Der Haken wurde beim
 * Beschriften **gespeichert** statt gelesen.
 *
 *  - Nahm man die Warengruppe wieder vom Möbel, blieb sie links abgehakt.
 *  - Und abgehakt wurde über den **Namen**: Wer „Kräuter" beim Obst setzte,
 *    hakte die Kräuter beim Tiefkühl gleich mit ab.
 */

const store = () => usePlanStore.getState();

const liste: Sortimentsliste = {
  abteilungen: [
    {
      name: 'Obst & Gemüse',
      warengruppen: [{ name: 'Frischgemüse', sortimente: ['Kräuter', 'Salat'] }],
    },
    {
      name: 'Tiefkühl',
      warengruppen: [{ name: 'TK-Gemüse', sortimente: ['Kräuter', 'Erbsen'] }],
    },
  ],
};

const KRAEUTER_OBST = pfadVon('Obst & Gemüse', 'Frischgemüse', 'Kräuter');
const KRAEUTER_TK = pfadVon('Tiefkühl', 'TK-Gemüse', 'Kräuter');
const SALAT = pfadVon('Obst & Gemüse', 'Frischgemüse', 'Salat');

const vorlage = (id: string) => {
  const treffer = BIBLIOTHEK.find((v) => v.id === id);
  if (!treffer) throw new Error(`Vorlage ${id} gibt es nicht`);
  return treffer;
};

/** Ein Regal in die Mitte, mit dieser Warengruppe über der ganzen Breite. */
function legeRegalMit(name: string, pfad?: string) {
  store().fuegeElementHinzu(vorlage('wt-wand-1000-300-1400'), 1000, 1000);
  const elemente = store().projekt.elemente;
  const el = elemente[elemente.length - 1];
  store().aendereElemente([el.id], {
    warengruppenUnten: [{ von: 0, bis: el.breite, text: name, pfad }],
  });
  return el.id;
}

const stand = (pfad: string) =>
  standVon(
    store().projekt.sortimentsstand,
    pfad,
    store().projekt.zuordnungen,
    pfadeImPlan(store().projekt, store().sortiment),
  );

describe('Der Haken folgt dem Plan', () => {
  beforeEach(() => {
    usePlanStore.setState({ projekt: neuesProjekt('Prüfung', 4000, 2500), sortiment: liste });
  });

  it('hakt ab, was im Plan steht', () => {
    legeRegalMit('Kräuter', KRAEUTER_OBST);
    expect(stand(KRAEUTER_OBST)).toBe('gruen');
  });

  it('hakt nicht den gleichnamigen Eintrag einer anderen Abteilung mit ab', () => {
    // Der gemeldete Fall: Kräuter beim Obst gesetzt, Kräuter beim Tiefkühl
    // waren mit abgehakt. Gezählt wird jetzt über den Pfad, nicht den Namen.
    legeRegalMit('Kräuter', KRAEUTER_OBST);
    expect(stand(KRAEUTER_TK)).toBe('rot');
  });

  it('nimmt den Haken zurück, sobald die Warengruppe vom Möbel verschwindet', () => {
    const id = legeRegalMit('Kräuter', KRAEUTER_OBST);
    expect(stand(KRAEUTER_OBST)).toBe('gruen');
    store().aendereElemente([id], { warengruppenUnten: [] });
    expect(stand(KRAEUTER_OBST)).toBe('rot');
  });

  it('hakt auch ab, wenn das Möbel ganz gelöscht wird', () => {
    const id = legeRegalMit('Kräuter', KRAEUTER_OBST);
    store().waehleAus([id]);
    store().loescheAuswahl();
    expect(stand(KRAEUTER_OBST)).toBe('rot');
  });
});

describe('Der Klick auf den Punkt', () => {
  beforeEach(() => {
    usePlanStore.setState({ projekt: neuesProjekt('Prüfung', 4000, 2500), sortiment: liste });
  });

  it('setzt „nicht vorgesehen" auf einen Eintrag, der nicht im Plan steht', () => {
    store().setzeSortimentsstand(SALAT, 'grau');
    expect(stand(SALAT)).toBe('grau');
  });

  it('lässt einen gezeichneten Eintrag unberührt', () => {
    // Sonst stünde unter einem gezeichneten Meter still „nicht vorgesehen" –
    // unsichtbar, weil der Plan vorgeht, und wirksam, sobald der Meter
    // irgendwann verschwindet.
    legeRegalMit('Kräuter', KRAEUTER_OBST);
    store().setzeSortimentsstand(KRAEUTER_OBST, 'grau');
    expect(store().projekt.sortimentsstand?.[KRAEUTER_OBST]).toBeUndefined();
    expect(stand(KRAEUTER_OBST)).toBe('gruen');
  });

  it('wirkt über eine Abteilung auf alles darunter, was nicht gezeichnet ist', () => {
    legeRegalMit('Kräuter', KRAEUTER_OBST);
    store().setzeSortimentsstand(pfadVon('Obst & Gemüse'), 'grau');
    expect(stand(SALAT)).toBe('grau');
    expect(stand(KRAEUTER_OBST)).toBe('gruen');
  });
});
