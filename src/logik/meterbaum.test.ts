import { describe, expect, it } from 'vitest';
import { meterauswertung, obstgemuesezahlen, OHNE_ABTEILUNG } from './meterbaum';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Prüfungen für die Auswertung als Baum.
 *
 * Zwei Dinge entscheiden sich hier: ob gleichnamige Sortimente aus
 * verschiedenen Abteilungen auseinandergehalten werden – „Kuchen" steht in
 * der Liste zweimal –, und ob die Summen einer Stufe wirklich das ergeben,
 * was darunter hängt.
 */

const LISTE = {
  abteilungen: [
    { name: 'Obst & Gemüse', warengruppen: [{ name: 'Äpfel', sortimente: ['Elstar'] }] },
    { name: 'Backwaren', warengruppen: [{ name: 'Bake Off', sortimente: ['Kuchen'] }] },
    { name: 'Feinbackwaren', warengruppen: [{ name: 'Süßes', sortimente: ['Kuchen'] }] },
  ],
};

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
    felderUnten: [{ breite: 100, boeden: 5 }],
    ...teil,
  } as PlanElement;
}

function projekt(elemente: PlanElement[]): Projekt {
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
    elemente,
    gruppen: [],
    masslinien: [],
    verkaufsflaechen: [],
  } as unknown as Projekt;
}

/** Ein Möbel mit einer Strecke über die ganze Breite. */
function mit(text: string, pfad?: string, teil: Partial<PlanElement> = {}) {
  return element({
    id: `e-${text}-${pfad ?? ''}`,
    warengruppenUnten: [{ von: 0, bis: 100, text, pfad }],
    ...teil,
  });
}

describe('Der Baum', () => {
  it('hält zwei gleiche Namen aus verschiedenen Abteilungen auseinander', () => {
    const { baum } = meterauswertung(
      projekt([
        mit('Kuchen', 'Backwaren › Bake Off › Kuchen'),
        mit('Kuchen', 'Feinbackwaren › Süßes › Kuchen'),
      ]),
      LISTE,
    );
    expect(baum.map((k) => k.name)).toEqual(['Backwaren', 'Feinbackwaren']);
    // Jede Abteilung trägt ihren eigenen Meter, nicht beide zusammen.
    expect(baum[0].laufend).toBe(1);
    expect(baum[1].laufend).toBe(1);
  });

  it('baut drei Stufen und summiert nach oben', () => {
    const { baum, gesamt } = meterauswertung(
      projekt([
        mit('Elstar', 'Obst & Gemüse › Äpfel › Elstar'),
        mit('Boskoop', 'Obst & Gemüse › Äpfel › Boskoop'),
      ]),
      LISTE,
    );
    const abteilung = baum[0];
    expect(abteilung.stufe).toBe(1);
    expect(abteilung.laufend).toBe(2);
    const gruppe = abteilung.kinder[0];
    expect(gruppe.name).toBe('Äpfel');
    expect(gruppe.kinder.map((k) => k.name).sort()).toEqual(['Boskoop', 'Elstar']);
    expect(gesamt.laufend).toBe(2);
    // 1 m mit fünf Böden sind fünf tatsächliche Meter, zweimal.
    expect(abteilung.tatsaechlich).toBe(10);
  });

  it('folgt der Reihenfolge der Sortimentsliste', () => {
    // Die ist die des Marktes – sie folgt dem Weg durch den Laden.
    const { baum } = meterauswertung(
      projekt([
        mit('Kuchen', 'Backwaren › Bake Off › Kuchen'),
        mit('Elstar', 'Obst & Gemüse › Äpfel › Elstar'),
      ]),
      LISTE,
    );
    expect(baum.map((k) => k.name)).toEqual(['Obst & Gemüse', 'Backwaren']);
  });

  it('ordnet einen Namen ohne Pfad über die Liste ein', () => {
    // Alte Planungen und frei getippte Namen sollen nicht alle unten landen.
    const { baum } = meterauswertung(projekt([mit('Elstar')]), LISTE);
    expect(baum[0].name).toBe('Obst & Gemüse');
  });

  it('stellt ans Ende, was sich nicht einordnen lässt', () => {
    const { baum } = meterauswertung(
      projekt([mit('Elstar', 'Obst & Gemüse › Äpfel › Elstar'), mit('Wundertüten')]),
      LISTE,
    );
    expect(baum[baum.length - 1].name).toBe(OHNE_ABTEILUNG);
  });
});

describe('Die Obst- und Gemüsezahlen', () => {
  it('führt Kisten und Kühlmeter nebeneinander', () => {
    // Die Tische zählen in Kisten, die Kühlmöbel in Metern – zusammenzählen
    // ließe sich das nicht, weil kein einzelner Umrechnungskurs existiert.
    const tisch = mit('Elstar', 'Obst & Gemüse › Äpfel › Elstar', {
      kategorie: 'obstgemuese',
      ifkoKisten: 8,
      auslagen: 3,
      felderUnten: [{ breite: 100 }],
    });
    const kuehl = mit('Boskoop', 'Obst & Gemüse › Äpfel › Boskoop', {
      id: 'kuehl',
      kategorie: 'kuehlung',
      form: 'kuehlOffen',
      felderUnten: [{ breite: 100, boeden: 4 }],
    });

    const z = obstgemuesezahlen(projekt([tisch, kuehl]), LISTE);
    expect(z.vorhanden).toBe(true);
    expect(z.laufend).toBe(2);
    expect(z.kisten).toBe(8);
    expect(z.kuehlungLaufend).toBe(1);
    expect(z.kuehlungTatsaechlich).toBe(4);
  });

  it('nimmt ein Kartoffelregal mit, weil die Warengruppe es dorthin stellt', () => {
    // Es kommt aus der Kategorie „Regale" – die Abteilung entscheidet die
    // Warengruppe, nicht der Katalog.
    const regal = mit('Elstar', 'Obst & Gemüse › Äpfel › Elstar', { ifkoKisten: 6 });
    const z = obstgemuesezahlen(projekt([regal]), LISTE);
    expect(z.laufend).toBe(1);
    expect(z.kisten).toBe(6);
    expect(z.kuehlungLaufend).toBe(0);
  });

  it('lässt ein Kühlregal an der Molkerei draußen', () => {
    const molkerei = mit('Joghurt', undefined, { kategorie: 'kuehlung', form: 'kuehlOffen' });
    expect(obstgemuesezahlen(projekt([molkerei]), LISTE).vorhanden).toBe(false);
  });
});
