import { describe, expect, it } from 'vitest';
import { meterauswertung, obstgemuesezahlen, OHNE_ABTEILUNG } from './meterbaum';
import { pfadeImPlan } from './planstand';
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
    //
    // Die Zeile heißt danach nach beiden Namen: Zugeordnet heißt nicht
    // ersetzt, sondern zusammengelegt.
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
    expect(namen).toContain('Torten, Kuchen');
    expect(namen).not.toContain('Kuchen');
    // Und sie hängt dort, wo die Meter liegen, statt unter „Noch nicht
    // eingeordnet": Torten steht in keiner Liste, Kuchen schon.
    expect(namen).toContain('Bake Off');
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

/**
 * Wie sich mehrere Sortimente eine Strecke teilen.
 *
 * Lukas' beide Fälle, unverändert übernommen:
 *
 *  - Die **Staubsaugerbeutel** stehen mit bei den Haushaltsreinigern. Sie
 *    gehören in verschiedene Abteilungen und teilen sich einen Meter
 *    nebeneinander.
 *  - Die **Dessertsoßen** stehen auf 1,25 m, belegen davon aber nur zwei
 *    Regalböden; darunter steht eine Milchpalette. Beide sind 1,25 m breit
 *    und unterscheiden sich in den Auslagen.
 */
const MISCHLISTE = {
  abteilungen: [
    {
      name: 'Drogerie & Tiernahrung',
      warengruppen: [{ name: 'Wasch & Putzmittel', sortimente: ['Haushaltsreiniger'] }],
    },
    {
      name: 'Non-Food',
      warengruppen: [{ name: 'Haushaltswaren', sortimente: ['Staubsaugerbeutel'] }],
    },
    {
      name: 'Molkerei',
      warengruppen: [{ name: 'Milch', sortimente: ['Milch'] }],
    },
    {
      name: 'Lebensmittel',
      warengruppen: [{ name: 'Konfitüre, Dessert', sortimente: ['Dessertsoßen'] }],
    },
  ],
};

/** Sucht eine Zeile im ganzen Baum. */
function finde(baum: ReturnType<typeof meterauswertung>['baum'], name: string): {
  laufend: number;
  tatsaechlich?: number;
} {
  for (const knoten of baum) {
    if (knoten.name === name) return knoten;
    const tiefer = finde(knoten.kinder, name);
    if (tiefer) return tiefer;
  }
  return undefined as unknown as { laufend: number; tatsaechlich?: number };
}

describe('Zwei Sortimente auf einer Strecke', () => {
  const gemischt = (aufteilung?: { werte: number[] }) =>
    element({
      breite: 100,
      felderUnten: [{ breite: 100, boeden: 5 }],
      warengruppenUnten: [
        {
          von: 0,
          bis: 100,
          text: 'Haushaltsreiniger, Staubsaugerbeutel',
          pfad: 'Drogerie & Tiernahrung › Wasch & Putzmittel › Haushaltsreiniger',
          aufteilung,
        },
      ],
    });

  it('bleibt ohne Angabe eine gemeinsame Zeile', () => {
    // Der Normalfall, und er soll sich nicht ändern: Wer zwei Namen auf einen
    // Meter setzt, will meistens gar nicht auf den Zentimeter aufteilen.
    const { baum } = meterauswertung(projekt([gemischt()]), MISCHLISTE);
    expect(finde(baum, 'Haushaltsreiniger, Staubsaugerbeutel').laufend).toBe(1);
    expect(finde(baum, 'Staubsaugerbeutel')).toBeUndefined();
  });

  it('teilt die Meter nach Prozent – und die Abteilungen gehen auseinander', () => {
    const { baum, gesamt } = meterauswertung(
      projekt([gemischt({ werte: [50, 50] })]),
      MISCHLISTE,
    );
    expect(finde(baum, 'Haushaltsreiniger').laufend).toBe(0.5);
    expect(finde(baum, 'Staubsaugerbeutel').laufend).toBe(0.5);
    // 0,5 m mit fünf Böden sind 2,5 tatsächliche Meter – je Sortiment.
    expect(finde(baum, 'Haushaltsreiniger').tatsaechlich).toBe(2.5);
    expect(finde(baum, 'Staubsaugerbeutel').tatsaechlich).toBe(2.5);
    // Zusammen bleibt es der eine Meter, der im Plan steht.
    expect(gesamt.laufend).toBe(1);
    expect(baum.map((k) => k.name)).toContain('Non-Food');
  });

  it('teilt auch ungleich', () => {
    const { baum } = meterauswertung(
      projekt([gemischt({ werte: [75, 25] })]),
      MISCHLISTE,
    );
    expect(finde(baum, 'Haushaltsreiniger').laufend).toBe(0.75);
    expect(finde(baum, 'Staubsaugerbeutel').laufend).toBe(0.25);
  });

  it('rechnet mit dem Verhältnis, nicht mit der Summe hundert', () => {
    // Zwei Regalböden Dessertsoßen über einer Milchpalette: Der Planer trägt
    // ein, was er für richtig hält, und 4 zu 6 heißt dasselbe wie 40 zu 60.
    const el = element({
      breite: 125,
      felderUnten: [{ breite: 125, boeden: 4 }],
      warengruppenUnten: [
        {
          von: 0,
          bis: 125,
          text: 'Dessertsoßen, Milch',
          pfad: 'Lebensmittel › Konfitüre, Dessert › Dessertsoßen',
          aufteilung: { werte: [4, 6] },
        },
      ],
    });
    const { baum, gesamt } = meterauswertung(projekt([el]), MISCHLISTE);
    expect(finde(baum, 'Dessertsoßen').laufend).toBe(0.5);
    expect(finde(baum, 'Milch').laufend).toBe(0.75);
    // Vier Böden auf 1,25 m sind 5,00 tatsächliche Meter, im selben
    // Verhältnis geteilt.
    expect(finde(baum, 'Dessertsoßen').tatsaechlich).toBe(2);
    expect(finde(baum, 'Milch').tatsaechlich).toBe(3);
    // Und zusammen bleibt es der eine Meter, der im Plan steht.
    expect(gesamt.laufend).toBe(1.25);
  });

  it('übergeht eine Aufteilung, die nicht mehr zu den Namen passt', () => {
    // Jemand hat den Text geändert; lieber eine Zeile zu wenig aufgeteilt als
    // Meter an der falschen Stelle.
    const { baum } = meterauswertung(
      projekt([gemischt({ werte: [50, 30, 20] })]),
      MISCHLISTE,
    );
    expect(finde(baum, 'Haushaltsreiniger, Staubsaugerbeutel').laufend).toBe(1);
  });

  it('lässt eine Aufteilung ohne Gewicht in Ruhe', () => {
    const { baum } = meterauswertung(
      projekt([gemischt({ werte: [0, 0] })]),
      MISCHLISTE,
    );
    expect(finde(baum, 'Haushaltsreiniger, Staubsaugerbeutel').laufend).toBe(1);
  });
});

describe('Sonderplatzierungen', () => {
  /** Ein Meter Werbeware in der Molkerei – kein reguläres Sortiment darauf. */
  const aktionsmeter = element({
    breite: 100,
    felderUnten: [{ breite: 100, boeden: 5 }],
    warengruppenUnten: [
      { von: 0, bis: 100, text: 'Milch', pfad: 'Molkerei › Milch', aktion: true },
    ],
  });

  it('zählt unter ihrer Warengruppe, aber in einer eigenen Zeile', () => {
    const { baum } = meterauswertung(projekt([aktionsmeter]), MISCHLISTE);
    const abteilung = baum.find((k) => k.name === 'Molkerei');
    expect(abteilung?.laufend).toBe(1);
    const gruppe = abteilung?.kinder.find((k) => k.name === 'Milch');
    expect(gruppe?.laufend).toBe(1);
    // Sie hängt darunter wie ein Sortiment, heißt aber nicht wie eines.
    expect(gruppe?.kinder.map((k) => k.name)).toEqual(['Sonderplatzierung']);
    // Und sie zählt voll mit: 1 m mit fünf Böden sind fünf tatsächliche.
    expect(gruppe?.tatsaechlich).toBe(5);
  });

  it('hängt neben dem Sortiment, nicht darunter', () => {
    // **Der Fall, der die Bestellung zu groß macht.** Steht auf dem
    // Aktionsmeter der volle Sortimentspfad, hing die Zeile früher **unter**
    // dem Sortiment: „Milch" las sich dann als 2,00 m, obwohl nur ein Meter
    // reguläre Fläche steht – und weil die Einrückung an der Stufe hängt, sah
    // die Sonderplatzierung zugleich aus wie eine Geschwisterzeile, deren
    // Meter man noch dazuzählen müsste.
    const regulaer = element({
      id: 'e2',
      warengruppenUnten: [{ von: 0, bis: 100, text: 'Milch', pfad: 'Molkerei › Milch › Milch' }],
    });
    const aktion = element({
      id: 'e3',
      warengruppenUnten: [
        { von: 0, bis: 100, text: 'Milch', pfad: 'Molkerei › Milch › Milch', aktion: true },
      ],
    });
    const { baum } = meterauswertung(projekt([regulaer, aktion]), MISCHLISTE);
    const gruppe = baum.find((k) => k.name === 'Molkerei')?.kinder.find((k) => k.name === 'Milch');
    expect(gruppe?.laufend).toBe(2);
    // Zwei Kinder auf derselben Stufe, je ein Meter.
    expect(gruppe?.kinder.map((k) => k.name).sort()).toEqual(['Milch', 'Sonderplatzierung']);
    expect(gruppe?.kinder.find((k) => k.name === 'Milch')?.laufend).toBe(1);
    expect(gruppe?.kinder.find((k) => k.name === 'Sonderplatzierung')?.laufend).toBe(1);
    // Und kein Knoten trägt die Stufe seines eigenen Vaters.
    for (const kind of gruppe?.kinder ?? []) expect(kind.stufe).toBeGreaterThan(gruppe!.stufe);
  });

  it('hakt in der Sortimentsliste nichts ab', () => {
    // Auf ihr liegt Werbeware. Wer sie als Beleg nähme, ginge am Ende an
    // einer Lücke vorbei.
    expect(pfadeImPlan(projekt([aktionsmeter]), MISCHLISTE).size).toBe(0);
  });

  it('lässt einen gewöhnlichen Meter abhaken', () => {
    const el = element({
      breite: 100,
      felderUnten: [{ breite: 100, boeden: 5 }],
      warengruppenUnten: [{ von: 0, bis: 100, text: 'Milch', pfad: 'Molkerei › Milch › Milch' }],
    });
    expect(pfadeImPlan(projekt([el]), MISCHLISTE).has('Molkerei › Milch › Milch')).toBe(true);
  });
});

describe('Freie Flächen', () => {
  const flaeche = (meterVorgabe?: number, weiteres: Partial<PlanElement> = {}) =>
    element({
      form: 'aktionsflaeche',
      kategorie: 'aktion',
      breite: 300,
      tiefe: 200,
      felderUnten: undefined,
      meterVorgabe,
      warengruppenUnten: [
        { von: 0, bis: 300, text: 'Milch', pfad: 'Molkerei › Milch › Milch' },
      ],
      ...weiteres,
    });

  it('zählt ohne eingetragene Meter gar nicht', () => {
    // So wie bisher: Die Breite eines Rechtecks hängt daran, wie herum man es
    // gezogen hat, und wäre als laufende Meter geraten.
    const { gesamt } = meterauswertung(projekt([flaeche()]), MISCHLISTE);
    expect(gesamt.laufend).toBe(0);
  });

  it('zählt mit der eingetragenen Zahl und nicht mit ihrer Breite', () => {
    // 3,00 m breit gezeichnet, 5,00 m eingetragen: Es gelten die 5,00 m.
    const { baum } = meterauswertung(projekt([flaeche(500)]), MISCHLISTE);
    expect(finde(baum, 'Milch').laufend).toBe(5);
  });

  it('streckt auch den unbeschrifteten Rest mit', () => {
    // **Sonst verschwinden Meter spurlos.** Drei Meter gezeichnet, zwölf
    // eingetragen, nur die halbe Breite beschriftet: Die beschriftete Hälfte
    // wurde gestreckt, der Rest nicht – zusammen 7,50 statt 12,00 m. Die
    // Probe „Summe der Tabelle = Meter des Marktes", auf der die ganze
    // Auswertung beruht, ging nicht auf, und man sah der Tabelle nicht an,
    // wo es fehlt.
    const halb = flaeche(1200, {
      warengruppenUnten: [{ von: 0, bis: 150, text: 'Milch', pfad: 'Molkerei › Milch › Milch' }],
    });
    const { gesamt, baum } = meterauswertung(projekt([halb]), MISCHLISTE);
    expect(finde(baum, 'Milch').laufend).toBe(6);
    expect(gesamt.ohneWarengruppe).toBe(6);
    expect(gesamt.laufend).toBe(12);
  });

  it('nimmt die Auslagen der Fläche für die tatsächlichen Meter', () => {
    const { baum } = meterauswertung(projekt([flaeche(500, { auslagen: 2 })]), MISCHLISTE);
    expect(finde(baum, 'Milch').tatsaechlich).toBe(10);
  });

  it('teilt die Meter unter zwei Warengruppen auf', () => {
    const el = flaeche(400, {
      warengruppenUnten: [
        { von: 0, bis: 150, text: 'Milch', pfad: 'Molkerei › Milch › Milch' },
        {
          von: 150,
          bis: 300,
          text: 'Dessertsoßen',
          pfad: 'Lebensmittel › Konfitüre, Dessert › Dessertsoßen',
        },
      ],
    });
    const { baum, gesamt } = meterauswertung(projekt([el]), MISCHLISTE);
    expect(finde(baum, 'Milch').laufend).toBe(2);
    expect(finde(baum, 'Dessertsoßen').laufend).toBe(2);
    expect(gesamt.laufend).toBe(4);
  });
});
