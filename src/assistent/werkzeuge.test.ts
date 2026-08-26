import { beforeEach, describe, expect, it } from 'vitest';
import { neuesProjekt } from '../daten/standardProjekt';
import { usePlanStore } from '../zustand/planStore';
import { kurzeKennung } from './planbild';
import { findeElement, fuehreWerkzeugAus, werkzeugliste, WERKZEUGE } from './werkzeuge';

/**
 * Prüfungen für die Werkzeuge des Assistenten.
 *
 * Zwei Dinge stehen hier auf dem Spiel, und beide sind schlecht zu bemerken,
 * wenn sie schiefgehen:
 *
 *   1. **Ein Auftrag ist ein Strg+Z.** Der Assistent darf ungefragt handeln,
 *      weil ein Fehlgriff einen Tastendruck kostet. Zerfiele eine Runde in
 *      zwanzig Schritte, wäre dieses Versprechen gebrochen.
 *   2. **Ein Werkzeug meldet, was wirklich geschah.** Ein „erledigt" auf
 *      einen Aufruf, der nichts getan hat, führt zu einem Assistenten, der
 *      Erfolge zusammenzählt, die es nicht gab.
 */

const store = () => usePlanStore.getState();
const tue = (name: string, eingabe: Record<string, unknown> = {}) =>
  fuehreWerkzeugAus(name, eingabe);

/** Setzt ein Möbel und gibt die Kennung zurück, die im Ergebnis steht. */
function setze(vorlageId: string, x = 1000, y = 1000, weiteres: Record<string, unknown> = {}) {
  const ergebnis = tue('element_einfuegen', { vorlageId, x, y, ...weiteres });
  expect(ergebnis.fehlgeschlagen).toBe(false);
  return store().auswahl;
}

describe('Kennungen', () => {
  it('kürzt eine Kennung auf Vorsilbe und acht Stellen', () => {
    expect(kurzeKennung('el-f293bbea-c4a3-48fa-a373-6fec4bd1c1b2')).toBe('el-f293bbea');
  });

  it('lässt eine Kennung ohne Strich in Ruhe', () => {
    expect(kurzeKennung('zug')).toBe('zug');
  });

  it('findet ein Element über die gekürzte Kennung wieder', () => {
    const elemente = [{ id: 'el-abc12345-0000-0000-0000-000000000000' }] as never;
    expect(findeElement('el-abc12345', elemente)).toBe((elemente as never[])[0]);
  });

  it('nimmt lieber gar nichts, als bei mehreren Treffern zu raten', () => {
    const elemente = [
      { id: 'el-abc12345-0000-0000-0000-000000000000' },
      { id: 'el-abc12399-0000-0000-0000-000000000000' },
    ] as never;
    expect(findeElement('el-abc123', elemente)).toBe('mehrdeutig');
  });
});

describe('Die Werkzeugliste', () => {
  it('gibt jedes Werkzeug in der Form heraus, die die API erwartet', () => {
    const liste = werkzeugliste();
    expect(liste).toHaveLength(WERKZEUGE.length);
    for (const eintrag of liste) {
      expect(eintrag.name).toMatch(/^[a-z_]+$/);
      expect(eintrag.description.length).toBeGreaterThan(20);
      expect((eintrag.input_schema as { type: string }).type).toBe('object');
    }
  });

  it('vergibt keinen Namen zweimal', () => {
    const namen = WERKZEUGE.map((w) => w.name);
    expect(new Set(namen).size).toBe(namen.length);
  });
});

describe('Elemente anfassen', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('setzt eine Reihe lückenlos nebeneinander', () => {
    setze('regal-frei', 1000, 1000, { anzahl: 3 });
    const gesetzt = store().projekt.elemente;
    expect(gesetzt).toHaveLength(3);
    expect(gesetzt.map((e) => e.x)).toEqual([1000, 1125, 1250]);
  });

  it('verschiebt relativ', () => {
    const [id] = setze('regal-frei', 1000, 1000);
    tue('elemente_verschieben', { ids: [id], dx: 200, dy: -50 });
    const el = store().projekt.elemente[0];
    expect([el.x, el.y]).toEqual([1200, 950]);
  });

  it('rückt die Mitte der Auswahl auf einen festen Punkt', () => {
    setze('regal-frei', 1000, 1000, { anzahl: 2 });
    const ids = store().projekt.elemente.map((e) => e.id);
    tue('elemente_verschieben', { ids, x: 2000 });
    const mitten = store().projekt.elemente.map((e) => e.x);
    // Zwei Möbel à 125 nebeneinander: die gemeinsame Mitte liegt dazwischen.
    expect((Math.min(...mitten) + Math.max(...mitten)) / 2).toBe(2000);
  });

  it('nimmt die Auswahl, wenn keine Kennungen dabeistehen', () => {
    const [id] = setze('regal-frei', 1000, 1000);
    usePlanStore.getState().waehleAus([id]);
    const ergebnis = tue('elemente_verschieben', { dx: 100 });
    expect(ergebnis.fehlgeschlagen).toBe(false);
    expect(store().projekt.elemente[0].x).toBe(1100);
  });

  it('sagt Bescheid, wenn nichts gemeint sein kann', () => {
    const ergebnis = tue('elemente_verschieben', { dx: 100 });
    expect(ergebnis.fehlgeschlagen).toBe(true);
    expect(ergebnis.text).toContain('nichts ausgewählt');
  });

  it('meldet ein gesperrtes Möbel, statt Erfolg zu behaupten', () => {
    const [id] = setze('regal-frei', 1000, 1000);
    usePlanStore.getState().aendereElemente([id], { gesperrt: true });
    const ergebnis = tue('elemente_verschieben', { ids: [id], dx: 100 });
    expect(ergebnis.text).toContain('gesperrt');
    expect(store().projekt.elemente[0].x).toBe(1000);
  });

  it('erfindet keine Vorlage', () => {
    const ergebnis = tue('element_einfuegen', { vorlageId: 'gibt-es-nicht', x: 0, y: 0 });
    expect(ergebnis.fehlgeschlagen).toBe(true);
    expect(ergebnis.text).toContain('vorlagen_suchen');
    expect(store().projekt.elemente).toHaveLength(0);
  });
});

describe('Warengruppen schreiben', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('schreibt einen Namen über mehrere Meter – einmal, mit Spanne', () => {
    const [id] = setze('regal-gondel-frei');
    tue('felder_setzen', { id, breiten: [125, 125, 125, 125] });
    const ergebnis = tue('warengruppe_setzen', { id, vonFeld: 2, bisFeld: 4, text: 'Butter' });

    expect(ergebnis.fehlgeschlagen).toBe(false);
    const felder = store().projekt.elemente[0].felderUnten!;
    expect(felder[1].warengruppe).toEqual({ text: 'Butter', felder: 3 });
    // Die übrigen Felder der Strecke bleiben leer, sonst stünde der Name dreimal.
    expect(felder[2].warengruppe).toBeUndefined();
    expect(felder[3].warengruppe).toBeUndefined();
  });

  it('beschriftet ein frisch gesetztes Möbel ohne eigene Feldliste', () => {
    const [id] = setze('regal-gondel-frei');
    expect(store().projekt.elemente[0].felderUnten).toBeUndefined();
    const ergebnis = tue('warengruppe_setzen', { id, vonFeld: 1, text: 'Eier' });
    expect(ergebnis.fehlgeschlagen).toBe(false);
    expect(store().projekt.elemente[0].felderUnten![0].warengruppe?.text).toBe('Eier');
  });

  it('löscht bei leerem Text', () => {
    const [id] = setze('regal-gondel-frei');
    tue('warengruppe_setzen', { id, vonFeld: 1, text: 'Eier' });
    tue('warengruppe_setzen', { id, vonFeld: 1, text: '' });
    expect(store().projekt.elemente[0].felderUnten![0].warengruppe).toBeUndefined();
  });

  it('weist die obere Seite an einem einseitigen Möbel ab', () => {
    const [id] = setze('regal-frei');
    const ergebnis = tue('warengruppe_setzen', { id, seite: 'oben', vonFeld: 1, text: 'Eier' });
    expect(ergebnis.fehlgeschlagen).toBe(true);
    expect(ergebnis.text).toContain('einseitig');
  });

  it('weist ein Feld ab, das es nicht gibt', () => {
    const [id] = setze('regal-gondel-frei');
    tue('felder_setzen', { id, breiten: [125, 125] });
    const ergebnis = tue('warengruppe_setzen', { id, vonFeld: 3, text: 'Eier' });
    expect(ergebnis.fehlgeschlagen).toBe(true);
    expect(ergebnis.text).toContain('gibt es nicht');
  });
});

describe('Ein Auftrag ist ein Schritt', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('fasst alles in einer Klammer zu einem Rückgängig zusammen', () => {
    const vorher = store().vergangenheit.length;

    usePlanStore.getState().oeffneKlammer();
    const ids = setze('regal-frei', 1000, 1000, { anzahl: 3 });
    tue('elemente_verschieben', { ids, dx: 100 });
    tue('elemente_aendern', { ids, name: 'Umgebaut', farbe: '#ff0000' });
    usePlanStore.getState().schliesseKlammer();

    expect(store().projekt.elemente).toHaveLength(3);
    expect(store().vergangenheit.length - vorher).toBe(1);

    usePlanStore.getState().rueckgaengig();
    expect(store().projekt.elemente).toHaveLength(0);
  });

  it('legt für eine Runde, die nur liest, gar keinen Schritt an', () => {
    setze('regal-frei');
    const vorher = store().vergangenheit.length;

    usePlanStore.getState().oeffneKlammer();
    expect(tue('plan_lesen').fehlgeschlagen).toBe(false);
    expect(tue('vorlagen_suchen', { suche: 'Regal' }).fehlgeschlagen).toBe(false);
    usePlanStore.getState().schliesseKlammer();

    expect(store().vergangenheit.length).toBe(vorher);
  });

  it('zählt nur die äußerste Klammer', () => {
    const vorher = store().vergangenheit.length;
    usePlanStore.getState().oeffneKlammer();
    usePlanStore.getState().klammereZusammen(() => setze('regal-frei', 1000, 1000));
    usePlanStore.getState().klammereZusammen(() => setze('regal-frei', 2000, 1000));
    usePlanStore.getState().schliesseKlammer();

    expect(store().projekt.elemente).toHaveLength(2);
    expect(store().vergangenheit.length - vorher).toBe(1);
  });

  it('schließt die Klammer auch, wenn die Arbeit stolpert', () => {
    expect(() =>
      usePlanStore.getState().klammereZusammen(() => {
        throw new Error('geplatzt');
      }),
    ).toThrow('geplatzt');
    // Bliebe sie offen, käme ab hier nichts mehr in die Historie.
    expect(store().klammertiefe).toBe(0);

    const vorher = store().vergangenheit.length;
    setze('regal-frei');
    expect(store().vergangenheit.length - vorher).toBe(1);
  });

  it('trennt zwei aufeinanderfolgende Aufträge sauber', () => {
    usePlanStore.getState().oeffneKlammer();
    setze('regal-frei', 1000, 1000);
    usePlanStore.getState().schliesseKlammer();

    usePlanStore.getState().oeffneKlammer();
    setze('regal-frei', 2000, 1000);
    usePlanStore.getState().schliesseKlammer();

    expect(store().projekt.elemente).toHaveLength(2);
    usePlanStore.getState().rueckgaengig();
    expect(store().projekt.elemente).toHaveLength(1);
    usePlanStore.getState().rueckgaengig();
    expect(store().projekt.elemente).toHaveLength(0);
  });
});

describe('Lesen', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('filtert nach Warengruppe – auch über die Felder', () => {
    const [gondel] = setze('regal-gondel-frei', 1000, 1000);
    setze('regal-frei', 2000, 1000);
    tue('warengruppe_setzen', { id: gondel, vonFeld: 1, text: 'Eier' });

    const ergebnis = tue('plan_lesen', { warengruppe: 'eier' });
    expect(ergebnis.text).toContain('1 Elemente');
    expect(ergebnis.text).toContain('Eier');
  });

  it('sagt es, wenn nichts passt, statt eine leere Liste zu zeigen', () => {
    const ergebnis = tue('plan_lesen', { kategorie: 'kassen' });
    expect(ergebnis.text).toContain('Kein Element');
  });

  it('kennt ein Werkzeug nicht, das es nicht gibt', () => {
    const ergebnis = tue('zauberei', {});
    expect(ergebnis.fehlgeschlagen).toBe(true);
  });
});
