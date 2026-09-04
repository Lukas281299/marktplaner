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

  it('rät bei einem mehrdeutigen Namen ohne Pfad nicht', () => {
    // „Kuchen" steht in der Liste zweimal. Die erste Fundstelle zu nehmen
    // hieße, die Meter mit halber Wahrscheinlichkeit richtig einzuordnen –
    // und zwar unsichtbar. Sie stehen deshalb offen da, bis jemand sie über
    // das Menü zuweist.
    const { baum } = meterauswertung(projekt([mit('Kuchen')]), LISTE);
    expect(baum).toHaveLength(1);
    expect(baum[0].name).toBe(OHNE_ABTEILUNG);
    expect(baum[0].kinder[0].name).toBe('Kuchen');
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

describe('Über Grenzen hinweg', () => {
  const PFAD = 'Obst & Gemüse › Äpfel › Elstar';

  it('legt dieselbe Warengruppe von mehreren Möbeln in eine Zeile', () => {
    // Vier Meter Elstar auf zwei Zügen sind vier Meter Elstar. Zusammengelegt
    // wird über den Pfad, nicht über das Möbel.
    const a = mit('Elstar', PFAD, { id: 'a', breite: 100 });
    const b = mit('Elstar', PFAD, { id: 'b', breite: 100 });
    const { baum } = meterauswertung(projekt([a, b]), LISTE);
    const sortiment = baum[0].kinder[0].kinder[0];
    expect(sortiment.name).toBe('Elstar');
    expect(sortiment.laufend).toBe(2);
    expect(sortiment.strecken).toBe(2);
  });

  it('rechnet eine Strecke über Feldgrenzen mit verschiedenen Böden', () => {
    // Der Fall, der von Hand nie aufgeht: Eine Warengruppe läuft über drei
    // Felder, und die tragen fünf, sechs und vier Böden.
    const zug = element({
      id: 'zug',
      breite: 300,
      felderUnten: [
        { breite: 100, boeden: 5 },
        { breite: 100, boeden: 6 },
        { breite: 100, boeden: 4 },
      ],
      warengruppenUnten: [{ von: 0, bis: 300, text: 'Elstar', pfad: PFAD }],
    });
    const { gesamt } = meterauswertung(projekt([zug]), LISTE);
    expect(gesamt.laufend).toBe(3);
    // 1·5 + 1·6 + 1·4 – und nicht 3 × irgendein Mittelwert.
    expect(gesamt.tatsaechlich).toBe(15);
  });

  it('rechnet auch eine Strecke mitten durch ein Feld richtig', () => {
    // Die Grenze zwischen zwei Sortimenten darf mitten durch ein Feld laufen.
    const zug = element({
      id: 'zug',
      breite: 200,
      felderUnten: [
        { breite: 100, boeden: 5 },
        { breite: 100, boeden: 10 },
      ],
      warengruppenUnten: [
        { von: 0, bis: 150, text: 'Elstar', pfad: PFAD },
        { von: 150, bis: 200, text: 'Boskoop', pfad: 'Obst & Gemüse › Äpfel › Boskoop' },
      ],
    });
    const { baum } = meterauswertung(projekt([zug]), LISTE);
    const kinder = baum[0].kinder[0].kinder;
    const elstar = kinder.find((k) => k.name === 'Elstar')!;
    const boskoop = kinder.find((k) => k.name === 'Boskoop')!;
    // Elstar: 1,00 m mit 5 Böden + 0,50 m mit 10 = 5 + 5 = 10 tm.
    expect(elstar.laufend).toBe(1.5);
    expect(elstar.tatsaechlich).toBe(10);
    // Boskoop: 0,50 m mit 10 Böden = 5 tm.
    expect(boskoop.laufend).toBe(0.5);
    expect(boskoop.tatsaechlich).toBe(5);
  });

  it('zählt beide Seiten einer Gondel getrennt und legt sie zusammen', () => {
    const gondel = element({
      id: 'g',
      breite: 100,
      beidseitig: true,
      felderUnten: [{ breite: 100, boeden: 5 }],
      felderOben: [{ breite: 100, boeden: 5 }],
      warengruppenUnten: [{ von: 0, bis: 100, text: 'Elstar', pfad: PFAD }],
      warengruppenOben: [{ von: 0, bis: 100, text: 'Elstar', pfad: PFAD }],
    });
    const { gesamt } = meterauswertung(projekt([gondel]), LISTE);
    // Ein Meter Gondel, beidseitig beschriftet: zwei laufende Meter.
    expect(gesamt.laufend).toBe(2);
    expect(gesamt.tatsaechlich).toBe(10);
  });
});

describe('Was der Durchgang gefunden hat', () => {
  it('nimmt bei der Zuordnung den Anzeigenamen und nicht den Plantext', () => {
    // Im Plan steht „Marmorkuchen Aktion", gezählt wird es als Kuchen. Wer
    // Kuchen den Torten zuordnet, muss diese Strecke mitnehmen – sonst
    // bleiben die Meter stehen und die Kisten wandern allein weiter.
    const el = mit('Marmorkuchen Aktion', 'Backwaren › Bake Off › Kuchen', {
      kategorie: 'obstgemuese',
      ifkoKisten: 4,
    });
    const plan = { ...projekt([el]), zuordnungen: { kuchen: 'Torten' } };
    const { baum, gesamt } = meterauswertung(plan, LISTE);

    const namen: string[] = [];
    const geh = (k: { name: string; kinder: unknown[] }) => {
      namen.push(k.name);
      (k.kinder as (typeof k)[]).forEach(geh);
    };
    baum.forEach(geh);
    expect(namen).toContain('Torten');
    expect(namen).not.toContain('Kuchen');
    // Und die Kisten sind mitgekommen, statt unterwegs zu verschwinden.
    expect(gesamt.kisten).toBe(4);
  });

  it('hängt ein Sortiment ohne Pfad unter seine Warengruppe', () => {
    // Eine ältere Planung trägt nur den Namen. Er steht in der Liste genau
    // einmal – dann gehört er unter seine Warengruppe und nicht daneben.
    const { baum } = meterauswertung(projekt([mit('Elstar')]), LISTE);
    expect(baum[0].name).toBe('Obst & Gemüse');
    expect(baum[0].kinder[0].name).toBe('Äpfel');
    expect(baum[0].kinder[0].kinder[0].name).toBe('Elstar');
    // Die Warengruppe trägt die Meter dann auch wirklich.
    expect(baum[0].kinder[0].laufend).toBe(1);
  });
});
