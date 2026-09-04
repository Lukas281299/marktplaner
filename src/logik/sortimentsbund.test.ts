import { describe, expect, it } from 'vitest';
import { buende, teileBeschriftung, zieleDerStrecke } from './sortimentsbund';
import { pfadeImPlan } from './planstand';
import { abteilungsstand, gruppenstand, istAbgedeckt, standVon } from './sortiment';
import { meterauswertung } from './meterbaum';
import type { PlanElement, Projekt } from '../typen/modell';
import type { Sortimentsliste } from '../daten/warengruppen';

/**
 * Prüfungen für zwei Sortimente auf einer Strecke.
 *
 * Drei Meter tragen Nüsse **und** Trockenobst, und wie sie sich verteilen,
 * weiß niemand. Zwei Wege führen dahin – gemeinsam beschriften oder das eine
 * dem anderen zuordnen –, und beide sollen dasselbe ergeben: **eine** Zeile
 * mit beiden Namen, die Meter einmal gezählt, und beide Namen in der Liste
 * abgehakt.
 */

const liste: Sortimentsliste = {
  abteilungen: [
    {
      name: 'Trockensortiment',
      warengruppen: [
        { name: 'Knabbern', sortimente: ['Nüsse', 'Trockenobst', 'Chips'] },
        // Ein Name, der selbst Kommas trägt – der darf nicht zerfallen.
        { name: 'Backwaren SB', sortimente: ['Baguette, Stangen, Ciab.'] },
      ],
    },
    {
      name: 'Backwaren',
      warengruppen: [{ name: 'Bake Off', sortimente: ['Kuchen', 'Waffeln'] }],
    },
    {
      name: 'Feinbackwaren',
      warengruppen: [{ name: 'Süßes', sortimente: ['Kuchen'] }],
    },
  ],
};

const P = (...stufen: string[]) => stufen.join(' › ');
const NUESSE = P('Trockensortiment', 'Knabbern', 'Nüsse');
const TROCKENOBST = P('Trockensortiment', 'Knabbern', 'Trockenobst');
const KUCHEN_BAKE = P('Backwaren', 'Bake Off', 'Kuchen');
const WAFFELN = P('Backwaren', 'Bake Off', 'Waffeln');

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'wt100',
    ebeneId: 'einrichtung',
    name: 'Zug',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 300,
    tiefe: 70,
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
    felderUnten: [{ breite: 300, boeden: 5 }],
    ...teil,
  } as PlanElement;
}

const projekt = (elemente: PlanElement[], zuordnungen?: Record<string, string>): Projekt =>
  ({
    elemente,
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
    zuordnungen,
  }) as Projekt;

/** Ein Möbel mit einer beschrifteten Strecke über die ganze Breite. */
const mit = (text: string, pfad?: string, id = 'e1') =>
  element({ id, warengruppenUnten: [{ von: 0, bis: 300, text, pfad }] });

/** Alle Namen im Baum, von oben nach unten. */
function namenIm(baum: { name: string; kinder: unknown[] }[]): string[] {
  const aus: string[] = [];
  const geh = (k: { name: string; kinder: unknown[] }) => {
    aus.push(k.name);
    (k.kinder as typeof baum).forEach(geh);
  };
  baum.forEach(geh);
  return aus;
}

describe('Eine Beschriftung in ihre Namen zerlegen', () => {
  it('trennt zwei bekannte Namen am Komma', () => {
    expect(teileBeschriftung(liste, 'Nüsse, Trockenobst')).toEqual(['Nüsse', 'Trockenobst']);
  });

  it('lässt einen Namen, der selbst Kommas hat, zusammen', () => {
    // „Baguette, Stangen, Ciab." ist ein Sortiment und keine drei.
    expect(teileBeschriftung(liste, 'Baguette, Stangen, Ciab.')).toEqual([
      'Baguette, Stangen, Ciab.',
    ]);
  });

  it('trennt nicht, wenn ein Teil kein Name ist', () => {
    // „Nüsse, ab KW 12" ist ein Name mit einer Anmerkung dahinter.
    expect(teileBeschriftung(liste, 'Nüsse, ab KW 12')).toEqual(['Nüsse, ab KW 12']);
  });

  it('lässt einen einzelnen Namen, wie er ist', () => {
    expect(teileBeschriftung(liste, 'Nüsse')).toEqual(['Nüsse']);
    expect(teileBeschriftung(liste, '   ')).toEqual([]);
  });
});

describe('Wohin eine Strecke zählt', () => {
  it('nimmt den gespeicherten Pfad für den Namen, auf den er zeigt', () => {
    expect(zieleDerStrecke(liste, { name: 'Nüsse', pfad: NUESSE })).toEqual([
      { name: 'Nüsse', pfad: NUESSE },
    ]);
  });

  it('lässt einen freien Text sich an den Pfad anlehnen', () => {
    // „Marmorkuchen Aktion" steht in keiner Liste – dafür gibt es den Pfad.
    expect(zieleDerStrecke(liste, { name: 'Marmorkuchen Aktion', pfad: KUCHEN_BAKE })).toEqual([
      { name: 'Kuchen', pfad: KUCHEN_BAKE },
    ]);
  });

  it('lässt einen echten Namen über einen Restpfad gewinnen', () => {
    // Der gemeldete Fall: „Nüsse, Trockenobst" mit dem Pfad des Trockenobsts,
    // dann die Nüsse allein stehen gelassen. Was dasteht, ist die Aussage.
    expect(zieleDerStrecke(liste, { name: 'Nüsse', pfad: TROCKENOBST })).toEqual([
      { name: 'Nüsse', pfad: NUESSE },
    ]);
  });

  it('gibt bei zwei Namen zwei Ziele zurück', () => {
    expect(zieleDerStrecke(liste, { name: 'Nüsse, Trockenobst', pfad: NUESSE })).toEqual([
      { name: 'Nüsse', pfad: NUESSE },
      { name: 'Trockenobst', pfad: TROCKENOBST },
    ]);
  });

  it('lässt einen mehrdeutigen Namen ohne Pfad ungelöst', () => {
    // „Kuchen" steht zweimal in der Liste.
    expect(zieleDerStrecke(liste, { name: 'Kuchen' })).toEqual([{ name: 'Kuchen', pfad: undefined }]);
  });
});

describe('Der Bund', () => {
  it('entsteht aus einer gemeinsamen Beschriftung', () => {
    const bund = buende(projekt([mit('Nüsse, Trockenobst', NUESSE)]), liste);
    expect(bund.get('nüsse')?.beschriftung).toBe('Nüsse, Trockenobst');
    expect(bund.get('trockenobst')?.pfad).toBe(NUESSE);
  });

  it('entsteht ebenso aus einer Zuordnung – mit dem Ziel voran', () => {
    const plan = projekt([mit('Kuchen', KUCHEN_BAKE)], { waffeln: 'Kuchen' });
    expect(buende(plan, liste).get('waffeln')?.beschriftung).toBe('Kuchen, Waffeln');
  });

  it('schreibt den zugeordneten Namen so, wie er in der Liste steht', () => {
    // Zuordnungen liegen kleingeschrieben ab – das ist zum Vergleichen
    // richtig und zum Anzeigen falsch.
    const plan = projekt([mit('Kuchen', KUCHEN_BAKE)], { waffeln: 'kuchen' });
    expect(buende(plan, liste).get('waffeln')?.beschriftung).toBe('Kuchen, Waffeln');
  });

  it('gibt es nicht, solange ein Name für sich steht', () => {
    expect(buende(projekt([mit('Nüsse', NUESSE)]), liste).size).toBe(0);
  });

  it('ist wieder weg, sobald die Namen getrennt sind', () => {
    // Nichts davon wird gespeichert – der Bund entsteht aus dem Plan.
    expect(buende(projekt([mit('Nüsse', NUESSE)]), liste).size).toBe(0);
  });
});

describe('Die Auswertung', () => {
  it('führt beide Namen in einer Zeile – gemeinsam beschriftet', () => {
    const { baum, gesamt } = meterauswertung(projekt([mit('Nüsse, Trockenobst', NUESSE)]), liste);
    expect(namenIm(baum)).toContain('Nüsse, Trockenobst');
    // Die Meter zählen einmal, nicht zweimal.
    expect(gesamt.laufend).toBe(3);
  });

  it('führt beide Namen in einer Zeile – zugeordnet', () => {
    const plan = projekt(
      [mit('Kuchen', KUCHEN_BAKE, 'a'), mit('Waffeln', WAFFELN, 'b')],
      { waffeln: 'Kuchen' },
    );
    const { baum, gesamt } = meterauswertung(plan, liste);
    const namen = namenIm(baum);
    expect(namen).toContain('Kuchen, Waffeln');
    expect(namen).not.toContain('Waffeln');
    expect(gesamt.laufend).toBe(6);
  });

  it('hängt die gemeinsame Zeile unter die Warengruppe des ersten Namens', () => {
    const { baum } = meterauswertung(projekt([mit('Nüsse, Trockenobst', NUESSE)]), liste);
    expect(namenIm(baum)).toEqual(['Trockensortiment', 'Knabbern', 'Nüsse, Trockenobst']);
  });

  it('trennt wieder, sobald ein Name herausgenommen wird', () => {
    const { baum } = meterauswertung(projekt([mit('Nüsse', NUESSE)]), liste);
    expect(namenIm(baum)).toEqual(['Trockensortiment', 'Knabbern', 'Nüsse']);
  });
});

describe('Der Haken in der Liste', () => {
  it('hakt bei einer gemeinsamen Beschriftung beide ab', () => {
    const imPlan = pfadeImPlan(projekt([mit('Nüsse, Trockenobst', NUESSE)]), liste);
    expect([...imPlan].sort()).toEqual([NUESSE, TROCKENOBST].sort());
  });

  it('nimmt den Haken vom herausgenommenen Namen und lässt den anderen stehen', () => {
    // Der gemeldete Fall: eines wieder rausnehmen, nur eines verschwindet.
    const imPlan = pfadeImPlan(projekt([mit('Nüsse', NUESSE)]), liste);
    expect([...imPlan]).toEqual([NUESSE]);
  });

  it('kommt auch mit dem Restpfad des herausgenommenen Namens zurecht', () => {
    // Beschriftet über „Trockenobst", danach nur noch „Nüsse": Der Haken
    // gehört den Nüssen und nicht mehr dem Trockenobst.
    const imPlan = pfadeImPlan(projekt([mit('Nüsse', TROCKENOBST)]), liste);
    expect([...imPlan]).toEqual([NUESSE]);
  });
});

describe('Größere Strukturen am Stück', () => {
  const GRUPPE = P('Backwaren', 'Bake Off');

  it('hakt eine ganze Warengruppe ab, die im Plan steht', () => {
    // Der gemeldete Fall: „Fisch/Meeresfrüchte" über drei Meter gesetzt, in
    // der Rechnung richtig, in der Liste rot. Der Punkt leitete sich stur aus
    // den Sortimenten ab.
    const plan = projekt([mit('Bake Off', GRUPPE)]);
    const imPlan = pfadeImPlan(plan, liste);
    const gruppe = liste.abteilungen[1].warengruppen[0];
    expect(gruppenstand(undefined, 'Backwaren', gruppe, undefined, imPlan).wert).toBe('gruen');
  });

  it('zählt die Abteilung darüber als erledigt', () => {
    const plan = projekt([mit('Bake Off', GRUPPE)]);
    const imPlan = pfadeImPlan(plan, liste);
    const zahl = abteilungsstand(undefined, liste.abteilungen[1], undefined, imPlan);
    expect(zahl.wert).toBe('gruen');
    expect(zahl.zahlen.offen).toBe(0);
  });

  it('nimmt die Sortimente darunter aus den offenen Punkten', () => {
    // Sie stehen nicht einzeln im Plan – offen sind sie trotzdem nicht.
    const plan = projekt([mit('Bake Off', GRUPPE)]);
    const imPlan = pfadeImPlan(plan, liste);
    expect(standVon(undefined, KUCHEN_BAKE, undefined, imPlan)).toBe('zugeordnet');
    expect(istAbgedeckt(imPlan, KUCHEN_BAKE)).toBe(true);
  });

  it('lässt ein einzeln gesetztes Sortiment grün, nicht abgedeckt', () => {
    const plan = projekt([mit('Kuchen', KUCHEN_BAKE)]);
    const imPlan = pfadeImPlan(plan, liste);
    expect(standVon(undefined, KUCHEN_BAKE, undefined, imPlan)).toBe('gruen');
    expect(istAbgedeckt(imPlan, KUCHEN_BAKE)).toBe(false);
  });

  it('lässt eine Nachbarabteilung unberührt', () => {
    const plan = projekt([mit('Bake Off', GRUPPE)]);
    const imPlan = pfadeImPlan(plan, liste);
    expect(standVon(undefined, NUESSE, undefined, imPlan)).toBe('rot');
  });

  it('führt die Meter der Warengruppe in ihrer eigenen Zeile', () => {
    const { baum, gesamt } = meterauswertung(projekt([mit('Bake Off', GRUPPE)]), liste);
    expect(namenIm(baum)).toEqual(['Backwaren', 'Bake Off']);
    expect(gesamt.laufend).toBe(3);
  });
});
