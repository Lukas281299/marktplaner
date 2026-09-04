import { describe, expect, it } from 'vitest';
import { pfadeImPlan } from './planstand';
import { standVon, pfadVon } from './sortiment';
import type { PlanElement, Projekt } from '../typen/modell';
import type { Sortimentsliste } from '../daten/warengruppen';

/**
 * Prüfungen für den grünen Haken.
 *
 * Er wurde beim Beschriften einmal gesetzt und blieb dann stehen: Wer die
 * Warengruppe wieder vom Möbel nahm, sah sie links weiterhin als erledigt.
 * Am Ende ging man an einer Lücke vorbei, weil die Liste sagte, dort stünde
 * etwas.
 */

const liste: Sortimentsliste = {
  abteilungen: [
    {
      name: 'Backwaren',
      warengruppen: [{ name: 'Bake Off', sortimente: ['Kuchen', 'Brötchen'] }],
    },
    {
      name: 'Lebensmittel',
      warengruppen: [{ name: 'Feinbackwaren', sortimente: ['Kuchen', 'Kekse'] }],
    },
  ],
};

const KUCHEN_BACKWAREN = pfadVon('Backwaren', 'Bake Off', 'Kuchen');
const BROETCHEN = pfadVon('Backwaren', 'Bake Off', 'Brötchen');
const KEKSE = pfadVon('Lebensmittel', 'Feinbackwaren', 'Kekse');

const moebel = (abschnitte: PlanElement['warengruppenUnten']): PlanElement =>
  ({
    id: 'm',
    vorlageId: 'wt-100',
    ebeneId: 'einrichtung',
    name: 'Regal',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 500,
    tiefe: 67,
    drehung: 0,
    form: 'wt100',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
    beidseitig: false,
    achsmass: 100,
    warengruppenUnten: abschnitte,
  }) as PlanElement;

const projekt = (elemente: PlanElement[]): Projekt =>
  ({
    elemente,
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
  }) as Projekt;

describe('Pfade im Plan', () => {
  it('nimmt den Pfad der Strecke', () => {
    const p = projekt([
      moebel([{ von: 0, bis: 200, text: 'Kuchen', pfad: KUCHEN_BACKWAREN }]),
    ]);
    expect([...pfadeImPlan(p, liste)]).toEqual([KUCHEN_BACKWAREN]);
  });

  it('löst einen frei getippten, eindeutigen Namen auf', () => {
    const p = projekt([moebel([{ von: 0, bis: 200, text: 'Kekse' }])]);
    expect([...pfadeImPlan(p, liste)]).toEqual([KEKSE]);
  });

  it('rät bei einem mehrdeutigen Namen nicht', () => {
    // „Kuchen" steht zweimal in der Liste. Fünf Haken für einen Meter wären
    // falsch, und der falsche von beiden erst recht.
    const p = projekt([moebel([{ von: 0, bis: 200, text: 'Kuchen' }])]);
    expect(pfadeImPlan(p, liste).size).toBe(0);
  });

  it('ist leer, wenn nichts beschriftet ist', () => {
    expect(pfadeImPlan(projekt([moebel([])]), liste).size).toBe(0);
  });

  it('sieht mehrere Strecken auf einem Möbel', () => {
    const p = projekt([
      moebel([
        { von: 0, bis: 200, text: 'Kuchen', pfad: KUCHEN_BACKWAREN },
        { von: 200, bis: 500, text: 'Brötchen', pfad: BROETCHEN },
      ]),
    ]);
    expect([...pfadeImPlan(p, liste)].sort()).toEqual([BROETCHEN, KUCHEN_BACKWAREN].sort());
  });

  it('übergeht eine ausgeblendete Ebene', () => {
    // Was nicht gezeichnet wird, zählt in keiner Auswertung – und dann auch
    // nicht als abgehakt.
    const p = {
      elemente: [moebel([{ von: 0, bis: 200, text: 'Kuchen', pfad: KUCHEN_BACKWAREN }])],
      ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: false, gesperrt: false }],
    } as Projekt;
    expect(pfadeImPlan(p, liste).size).toBe(0);
  });
});

describe('Der Haken folgt dem Plan', () => {
  it('ist grün, was im Plan steht', () => {
    expect(standVon(undefined, KUCHEN_BACKWAREN, undefined, new Set([KUCHEN_BACKWAREN]))).toBe(
      'gruen',
    );
  });

  it('ist wieder offen, sobald es aus dem Plan verschwindet', () => {
    // Genau der gemeldete Fall: Warengruppe am Möbel gelöscht, links blieb
    // der Haken stehen.
    expect(standVon(undefined, KUCHEN_BACKWAREN, undefined, new Set())).toBe('rot');
  });

  it('schlägt ein gespeichertes Grau', () => {
    // „Hier nicht vorgesehen" und trotzdem gezeichnet: Der Plan gewinnt.
    const stand = { [KUCHEN_BACKWAREN]: 'grau' as const };
    expect(standVon(stand, KUCHEN_BACKWAREN, undefined, new Set([KUCHEN_BACKWAREN]))).toBe('gruen');
  });

  it('lässt „nicht vorgesehen" stehen, wo nichts gezeichnet ist', () => {
    const stand = { [KEKSE]: 'grau' as const };
    expect(standVon(stand, KEKSE, undefined, new Set())).toBe('grau');
  });
});
