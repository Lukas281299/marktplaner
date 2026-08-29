import { beforeEach, describe, expect, it } from 'vitest';
import { neuesProjekt } from '../daten/standardProjekt';
import { OEFFNUNGSARTEN } from '../komponenten/Eigenschaftenfenster';
import type { Oeffnungsart } from '../typen/modell';
import { usePlanStore } from './planStore';

/**
 * Die Voreinstellung für neue Öffnungen.
 *
 * Wer eine Reihe Fenster in die Außenwand setzt, will nicht nach jedem
 * einzelnen die Art umstellen – vorher gab es immer eine Tür von 100 cm,
 * ganz gleich, was man eigentlich vorhatte.
 */

const store = () => usePlanStore.getState();

const setzeOeffnung = (art?: Oeffnungsart, breite?: number) =>
  store().fuegeOeffnungHinzu({
    art: art ?? store().oeffnungsartNeu,
    x: 500,
    y: 200,
    breite: breite ?? store().oeffnungsbreiteNeu,
    tiefe: 24,
    drehung: 0,
    gespiegelt: false,
  });

describe('Neue Öffnungen', () => {
  beforeEach(() => {
    usePlanStore.setState({ oeffnungsartNeu: 'tuer', oeffnungsbreiteNeu: 100 });
    store().setzeProjekt(neuesProjekt());
  });

  it('nimmt die eingestellte Art und Breite', () => {
    store().setzeOeffnungsartNeu('rolltor');
    store().setzeOeffnungsbreiteNeu(300);
    const id = setzeOeffnung();
    const o = store().projekt.oeffnungen.find((x) => x.id === id);
    expect(o?.art).toBe('rolltor');
    expect(o?.breite).toBe(300);
  });

  it('merkt sich, was an einer fertigen Öffnung eingestellt wurde', () => {
    const id = setzeOeffnung();
    store().aendereOeffnung(id, { art: 'fenster', breite: 150 });
    expect(store().oeffnungsartNeu).toBe('fenster');
    expect(store().oeffnungsbreiteNeu).toBe(150);
  });

  it('lässt keine unsinnig schmale Öffnung zu', () => {
    store().setzeOeffnungsbreiteNeu(0);
    expect(store().oeffnungsbreiteNeu).toBeGreaterThanOrEqual(20);
  });

  it('bietet jede Art zur Auswahl an, die das Modell kennt', () => {
    // Eine Art ohne Eintrag in der Liste wäre nicht auswählbar – und ein
    // Symbol, das niemand setzen kann, ist totes Gewicht.
    const angeboten = new Set(OEFFNUNGSARTEN.map((a) => a.wert));
    const alle: Oeffnungsart[] = [
      'tuer', 'doppeltuer', 'schiebetuer', 'schiebetuerDoppel', 'durchgang',
      'rolltor', 'sektionaltor', 'fenster', 'schaufenster', 'notausgang',
    ];
    for (const art of alle) expect(angeboten.has(art)).toBe(true);
  });
});
