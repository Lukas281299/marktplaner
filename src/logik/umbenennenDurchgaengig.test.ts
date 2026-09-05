import { describe, expect, it } from 'vitest';
import { mitUmbenanntemPfad } from './pfadumbenennung';
import { meterauswertung } from './meterbaum';
import { pfadeImPlan } from './planstand';
import { umbenanntesSortiment, umbenannteWarengruppe, umbenannteAbteilung } from './sortiment';
import { umgehaengtesSortiment, pfadVon } from './sortiment';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Umbenennen muss **durchgängig** ankommen.
 *
 * Die eine Frage, um die es hier geht: Wenn ein Name in der Sortimentsliste
 * sich ändert, muss danach nichts von Hand nachgezogen werden. Vier Dinge
 * hängen an demselben Namen, und alle vier werden geprüft:
 *
 *  1. der **Pfad** an der Strecke, über den gerechnet wird,
 *  2. die **Beschriftung** im Plan, die man am Möbel liest,
 *  3. die **Auswertung**, die danach unter dem neuen Namen steht,
 *  4. der **grüne Haken** in der Liste.
 *
 * Geprüft wird über die ganze Kette und nicht Funktion für Funktion: Genau
 * dazwischen entstehen die Fehler, bei denen die Rechnung stimmt und der Plan
 * etwas anderes zeigt.
 */

const LISTE = {
  abteilungen: [
    {
      name: 'Molkerei',
      warengruppen: [
        { name: 'Milch', sortimente: ['Vollmilch', 'H-Milch'] },
        { name: 'Käse', sortimente: ['Schmelzkäse'] },
      ],
    },
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

function projekt(elemente: PlanElement[], teil: Partial<Projekt> = {}): Projekt {
  return {
    id: 'p1',
    name: 'Testmarkt',
    version: 21,
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
    ...teil,
  } as unknown as Projekt;
}

/** Die Strecke, wie sie beim Setzen über die Liste entsteht: Text und Pfad. */
const gesetzt = (text: string, pfad: string, teil: Partial<PlanElement> = {}) =>
  element({ warengruppenUnten: [{ von: 0, bis: 100, text, pfad }], ...teil });

/** Sucht eine Zeile im ganzen Baum. */
function finde(
  baum: ReturnType<typeof meterauswertung>['baum'],
  name: string,
): { laufend: number; tatsaechlich?: number } | undefined {
  for (const knoten of baum) {
    if (knoten.name === name) return knoten;
    const tiefer = finde(knoten.kinder, name);
    if (tiefer) return tiefer;
  }
  return undefined;
}

describe('Ein Sortiment umbenennen', () => {
  const alt = 'Molkerei › Milch › Vollmilch';
  const neu = 'Molkerei › Milch › Frischmilch';

  const nachher = () => {
    const liste = umbenanntesSortiment(LISTE, 'Molkerei', 'Milch', 'Vollmilch', 'Frischmilch');
    const p = mitUmbenanntemPfad(projekt([gesetzt('Vollmilch', alt)]), alt, neu);
    return { liste, projekt: p };
  };

  it('zieht den Pfad an der Strecke nach', () => {
    expect(nachher().projekt.elemente[0].warengruppenUnten?.[0].pfad).toBe(neu);
  });

  it('benennt die Beschriftung im Plan mit um', () => {
    // Sonst stünde am Möbel weiter „Vollmilch", während die Rechnung schon
    // „Frischmilch" zählt.
    expect(nachher().projekt.elemente[0].warengruppenUnten?.[0].text).toBe('Frischmilch');
  });

  it('führt die Meter in der Auswertung unter dem neuen Namen', () => {
    const { liste, projekt: p } = nachher();
    const { baum } = meterauswertung(p, liste);
    expect(finde(baum, 'Frischmilch')?.laufend).toBe(1);
    expect(finde(baum, 'Vollmilch')).toBeUndefined();
    // Und die Warengruppe darüber behält ihre Meter.
    expect(finde(baum, 'Milch')?.laufend).toBe(1);
  });

  it('behält den grünen Haken', () => {
    const { liste, projekt: p } = nachher();
    expect(pfadeImPlan(p, liste).has(neu)).toBe(true);
  });

  it('lässt eine eigene Beschriftung in Ruhe', () => {
    // „Marmorkuchen Aktion" ist ein Satz des Planers und nicht der Name aus
    // der Liste. Er bleibt stehen, der Pfad zieht trotzdem mit.
    const p = mitUmbenanntemPfad(projekt([gesetzt('Vollmilch aus der Region', alt)]), alt, neu);
    const strecke = p.elemente[0].warengruppenUnten?.[0];
    expect(strecke?.text).toBe('Vollmilch aus der Region');
    expect(strecke?.pfad).toBe(neu);
  });

  it('tauscht bei zwei Sortimenten nur den einen Namen', () => {
    const p = mitUmbenanntemPfad(projekt([gesetzt('Vollmilch, H-Milch', alt)]), alt, neu);
    expect(p.elemente[0].warengruppenUnten?.[0].text).toBe('Frischmilch, H-Milch');
  });

  it('rührt eine Strecke ohne Pfad nicht an, solange es den Namen noch gibt', () => {
    // Ein frei getippter Name kann überall herkommen. Solange die Liste ihn
    // weiter führt, hieße Umbenennen raten.
    const p = mitUmbenanntemPfad(
      projekt([element({ warengruppenUnten: [{ von: 0, bis: 100, text: 'Vollmilch' }] })]),
      alt,
      neu,
    );
    expect(p.elemente[0].warengruppenUnten?.[0].text).toBe('Vollmilch');
  });

  it('nimmt eine Strecke ohne Pfad mit, wenn es den alten Namen nicht mehr gibt', () => {
    // Wer den Namen von Hand auf einen Meter geschrieben hat, hat keinen
    // Pfad daran. Führt die Liste ihn nach dem Umbenennen nirgends mehr,
    // kann nur dieser eine gemeint gewesen sein — und der Plan muss mit.
    const p = mitUmbenanntemPfad(
      projekt([element({ warengruppenUnten: [{ von: 0, bis: 100, text: 'Vollmilch' }] })]),
      alt,
      neu,
      true,
    );
    const strecke = p.elemente[0].warengruppenUnten?.[0];
    expect(strecke?.text).toBe('Frischmilch');
    // **Einen Pfad bekommt sie dabei nicht.** Umbenannt wird, zugeordnet
    // nicht: Eine Strecke ohne Pfad ist oft mit Absicht ohne, weil noch offen
    // ist, wohin ihre Meter zählen. Gerechnet wird sie über ihren Namen.
    expect(strecke?.pfad).toBeUndefined();
  });

  it('lässt einen eigenen Satz stehen und zieht nur den Pfad', () => {
    // „Milch aus der Region" gehört dem Planer. Die Meter zählen trotzdem
    // zum umbenannten Sortiment — deshalb muss der Pfad mit.
    const mitMarke = mitUmbenanntemPfad(
      projekt([
        element({
          warengruppenUnten: [
            { von: 0, bis: 100, text: 'Milch aus der Region', pfad: alt, eigenerText: true },
          ],
        }),
      ]),
      alt,
      neu,
    );
    const strecke = mitMarke.elemente[0].warengruppenUnten?.[0];
    expect(strecke?.text).toBe('Milch aus der Region');
    expect(strecke?.pfad).toBe(neu);
  });

  it('nimmt ein Teilsortiment mit, das genau so heißt', () => {
    const p = mitUmbenanntemPfad(
      projekt([
        element({
          warengruppenUnten: [
            {
              von: 0,
              bis: 100,
              text: 'Vollmilch',
              pfad: alt,
              teile: [
                { von: 0, bis: 50, text: 'Vollmilch' },
                { von: 50, bis: 100, text: 'Vollmilch Bio' },
              ],
            },
          ],
        }),
      ]),
      alt,
      neu,
    );
    const teile = p.elemente[0].warengruppenUnten?.[0].teile;
    expect(teile?.[0].text).toBe('Frischmilch');
    // Nur bei genauem Treffer: Was davon der Name ist und was die
    // Beschreibung, weiß hier niemand.
    expect(teile?.[1].text).toBe('Vollmilch Bio');
  });

  it('benennt auch die grobe Einordnung des Möbels um', () => {
    const p = mitUmbenanntemPfad(
      projekt([element({ warengruppe: 'Milch' })]),
      'Molkerei › Milch',
      'Molkerei › Weiße Linie',
    );
    expect(p.elemente[0].warengruppe).toBe('Weiße Linie');
  });

  it('nimmt den zweiten Namen eines Bundes mit', () => {
    // „Vollmilch, H-Milch" trägt nur **einen** Pfad — den der Vollmilch.
    // Wird die H-Milch umbenannt, greift kein Pfad; der Name muss trotzdem
    // mit, sobald es den alten nirgends mehr gibt.
    const p = mitUmbenanntemPfad(
      projekt([gesetzt('Vollmilch, H-Milch', alt)]),
      'Molkerei › Milch › H-Milch',
      'Molkerei › Milch › Haltbare Milch',
      true,
    );
    const strecke = p.elemente[0].warengruppenUnten?.[0];
    expect(strecke?.text).toBe('Vollmilch, Haltbare Milch');
    // Der Pfad bleibt, wo er war — er gehört der Vollmilch.
    expect(strecke?.pfad).toBe(alt);
  });

  it('nimmt auch eine getippte Warengruppe mit', () => {
    const p = mitUmbenanntemPfad(
      projekt([element({ warengruppenUnten: [{ von: 0, bis: 100, text: 'Milch' }] })]),
      'Molkerei › Milch',
      'Molkerei › Weiße Linie',
      true,
    );
    expect(p.elemente[0].warengruppenUnten?.[0].text).toBe('Weiße Linie');
  });
});

describe('Eine Warengruppe umbenennen', () => {
  it('nimmt ihre Sortimente mit – Pfad, Plan und Rechnung', () => {
    const liste = umbenannteWarengruppe(LISTE, 'Molkerei', 'Milch', 'Weiße Linie');
    const p = mitUmbenanntemPfad(
      projekt([gesetzt('Vollmilch', 'Molkerei › Milch › Vollmilch')]),
      'Molkerei › Milch',
      'Molkerei › Weiße Linie',
    );
    const strecke = p.elemente[0].warengruppenUnten?.[0];
    // Der Pfad zieht mit, der Name des Sortiments bleibt seiner.
    expect(strecke?.pfad).toBe('Molkerei › Weiße Linie › Vollmilch');
    expect(strecke?.text).toBe('Vollmilch');
    const { baum } = meterauswertung(p, liste);
    expect(finde(baum, 'Weiße Linie')?.laufend).toBe(1);
    expect(pfadeImPlan(p, liste).has('Molkerei › Weiße Linie › Vollmilch')).toBe(true);
  });

  it('benennt die Strecke mit um, die auf der Warengruppe selbst steht', () => {
    // Ganze Warengruppen lassen sich setzen – dann steht ihr Name im Plan.
    const p = mitUmbenanntemPfad(
      projekt([gesetzt('Milch', 'Molkerei › Milch')]),
      'Molkerei › Milch',
      'Molkerei › Weiße Linie',
    );
    expect(p.elemente[0].warengruppenUnten?.[0].text).toBe('Weiße Linie');
  });
});

describe('Eine Abteilung umbenennen', () => {
  it('nimmt alles darunter mit', () => {
    const liste = umbenannteAbteilung(LISTE, 'Molkerei', 'Mopro');
    const p = mitUmbenanntemPfad(
      projekt([gesetzt('Vollmilch', 'Molkerei › Milch › Vollmilch')], {
        sortimentsstand: { 'Molkerei › Käse › Schmelzkäse': 'grau' },
      }),
      'Molkerei',
      'Mopro',
    );
    expect(p.elemente[0].warengruppenUnten?.[0].pfad).toBe('Mopro › Milch › Vollmilch');
    // Auch der von Hand gesetzte Stand hängt am Pfad und zieht mit.
    expect(p.sortimentsstand).toEqual({ 'Mopro › Käse › Schmelzkäse': 'grau' });
    const { baum } = meterauswertung(p, liste);
    expect(baum.map((k) => k.name)).toEqual(['Mopro']);
  });
});

describe('Ein Sortiment umhängen', () => {
  it('nimmt Pfad, Plan und Rechnung mit', () => {
    // Derselbe Weg wie beim Umbenennen: Die Liste ändert sich, und die
    // Planung geht denselben Schritt.
    const liste = umgehaengtesSortiment(LISTE, 'Molkerei', 'Milch', 'Vollmilch', 'Molkerei', 'Käse');
    const p = mitUmbenanntemPfad(
      projekt([gesetzt('Vollmilch', 'Molkerei › Milch › Vollmilch')]),
      pfadVon('Molkerei', 'Milch', 'Vollmilch'),
      pfadVon('Molkerei', 'Käse', 'Vollmilch'),
    );
    expect(p.elemente[0].warengruppenUnten?.[0].pfad).toBe('Molkerei › Käse › Vollmilch');
    expect(p.elemente[0].warengruppenUnten?.[0].text).toBe('Vollmilch');
    const { baum } = meterauswertung(p, liste);
    const kaese = baum[0].kinder.find((k) => k.name === 'Käse');
    expect(kaese?.kinder.map((k) => k.name)).toContain('Vollmilch');
    expect(pfadeImPlan(p, liste).has('Molkerei › Käse › Vollmilch')).toBe(true);
  });
});
