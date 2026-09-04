import { describe, expect, it } from 'vitest';
import { mitUmbenanntemPfad } from './pfadumbenennung';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Prüfungen fürs Nachziehen umbenannter Pfade.
 *
 * Der Fehler, um den es geht, ist leise: Die Liste heißt neu, die Planung
 * zeigt noch auf den alten Namen, und in der Auswertung stehen zwei
 * Abteilungen nebeneinander, von denen eine leer ist.
 */

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'wt100',
    ebeneId: 'einrichtung',
    name: 'Zug',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 100,
    tiefe: 70,
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

function projekt(teil: Partial<Projekt> = {}): Projekt {
  return {
    id: 'p1',
    name: 'Testmarkt',
    version: 20,
    erstelltAm: 0,
    geaendertAm: 0,
    grundflaeche: { umriss: [], wandstaerke: 30 },
    einstellungen: {} as Projekt['einstellungen'],
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
    raeume: [],
    waende: [],
    oeffnungen: [],
    elemente: [],
    gruppen: [],
    masslinien: [],
    verkaufsflaechen: [],
    ...teil,
  } as unknown as Projekt;
}

const KUCHEN = 'Feinbackwaren › Süßes › Kuchen';
const WAFFELN = 'Feinbackwaren › Süßes › Waffeln';

describe('Umbenannte Pfade', () => {
  it('zieht den Pfad einer Strecke mit', () => {
    const p = projekt({
      elemente: [
        element({ warengruppenUnten: [{ von: 0, bis: 100, text: 'Kuchen', pfad: KUCHEN }] }),
      ],
    });
    const neu = mitUmbenanntemPfad(p, 'Feinbackwaren', 'Feine Backwaren');
    expect(neu.elemente[0].warengruppenUnten?.[0].pfad).toBe('Feine Backwaren › Süßes › Kuchen');
  });

  it('nimmt alles mit, was unter dem umbenannten Zweig hängt', () => {
    // Wer eine Abteilung umbenennt, benennt ihre Sortimente mit um.
    const p = projekt({
      sortimentsstand: {
        'Feinbackwaren': 'gruen',
        [KUCHEN]: 'gruen',
        [WAFFELN]: 'grau',
        'Molkereiprodukte › Käse SB': 'gruen',
      },
    });
    const neu = mitUmbenanntemPfad(p, 'Feinbackwaren', 'Feine Backwaren');
    expect(Object.keys(neu.sortimentsstand!).sort()).toEqual([
      'Feine Backwaren',
      'Feine Backwaren › Süßes › Kuchen',
      'Feine Backwaren › Süßes › Waffeln',
      'Molkereiprodukte › Käse SB',
    ]);
  });

  it('fasst einen fremden Zweig nicht an', () => {
    // „Feinbackwaren" darf nicht auf „Feinbackwaren SB" abfärben.
    const p = projekt({
      sortimentsstand: { 'Feinbackwaren SB › Brot': 'gruen' },
      elemente: [
        element({
          warengruppenUnten: [
            { von: 0, bis: 100, text: 'Brot', pfad: 'Feinbackwaren SB › Brot' },
          ],
        }),
      ],
    });
    const neu = mitUmbenanntemPfad(p, 'Feinbackwaren', 'Feine Backwaren');
    expect(neu).toBe(p);
  });

  it('zieht die Zuordnung mit, wenn sich der Name ändert', () => {
    // „Zählt zu" steht auf Namen, nicht auf Pfaden – umbenannt wird nur die
    // letzte Stufe, und beide Seiten der Zuordnung.
    const p = projekt({ zuordnungen: { waffeln: 'Kuchen', kekse: 'Kuchen' } });
    const neu = mitUmbenanntemPfad(p, KUCHEN, 'Feinbackwaren › Süßes › Torten');
    expect(neu.zuordnungen).toEqual({ waffeln: 'Torten', kekse: 'Torten' });
  });

  it('benennt auch die Quelle einer Zuordnung um', () => {
    const p = projekt({ zuordnungen: { waffeln: 'Kuchen' } });
    const neu = mitUmbenanntemPfad(p, WAFFELN, 'Feinbackwaren › Süßes › Waffelnn');
    expect(neu.zuordnungen).toEqual({ waffelnn: 'Kuchen' });
  });

  it('lässt die Zuordnung in Ruhe, wenn nur eine obere Stufe umbenannt wird', () => {
    const p = projekt({ zuordnungen: { waffeln: 'Kuchen' } });
    const neu = mitUmbenanntemPfad(p, 'Feinbackwaren', 'Feine Backwaren');
    expect(neu.zuordnungen).toEqual({ waffeln: 'Kuchen' });
  });

  it('gibt dieselbe Planung zurück, wenn es nichts zu tun gibt', () => {
    // Sonst legte der Datenspeicher einen Schritt für Rückgängig an, bei dem
    // sich nichts geändert hat.
    const p = projekt({ elemente: [element({})] });
    expect(mitUmbenanntemPfad(p, 'Nonfood', 'Non-Food')).toBe(p);
    expect(mitUmbenanntemPfad(p, 'Nonfood', 'Nonfood')).toBe(p);
    expect(mitUmbenanntemPfad(p, '', 'Neu')).toBe(p);
  });
});
