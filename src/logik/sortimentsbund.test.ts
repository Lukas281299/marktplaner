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
      // Der echte Fall: „Säfte" steht hier **und** bei den Getränken.
      name: 'Obst & Gemüse',
      warengruppen: [{ name: 'Convenience', sortimente: ['Dressing', 'Säfte'] }],
    },
    {
      name: 'Getränke',
      warengruppen: [{ name: 'Getränke Einweg', sortimente: ['Säfte', 'Cola', 'Sirup'] }],
    },
    {
      // Der zweite echte Fall: „Sirup" steht hier unter Konfitüre, Dessert
      // **und** bei den Getränken; Kaffeefilter steht in derselben Abteilung,
      // aber in einer anderen Warengruppe.
      name: 'Lebensmittel & Tabak (TroSo)',
      warengruppen: [
        { name: 'Kaffee', sortimente: ['Kaffeefilter', 'Kaffee gemahlen'] },
        { name: 'Konfitüre, Dessert', sortimente: ['Sirup', 'Pudding'] },
      ],
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

  it('trennt, sobald ein Teil ein Name ist', () => {
    // „Dressings" gibt es in der Liste nicht – die führt „Dressing" in der
    // Einzahl. Früher fiel damit auch der zweite Name durch.
    expect(teileBeschriftung(liste, 'Dressings, Säfte')).toEqual(['Dressings', 'Säfte']);
    expect(teileBeschriftung(liste, 'Nüsse, ab KW 12')).toEqual(['Nüsse', 'ab KW 12']);
  });

  it('lässt zusammen, worin kein einziger Name steht', () => {
    expect(teileBeschriftung(liste, 'Aktion, ab KW 12')).toEqual(['Aktion, ab KW 12']);
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

describe('Der Nachbar auf demselben Meter', () => {
  const DRESSING = P('Obst & Gemüse', 'Convenience', 'Dressing');
  const SAEFTE_OG = P('Obst & Gemüse', 'Convenience', 'Säfte');

  it('findet einen mehrdeutigen Namen in der Warengruppe des Nachbarn', () => {
    // Der gemeldete Fall: „Säfte allein nimmt er. Dressings, Säfte – dann
    // fällt Säfte raus." „Säfte" steht zweimal in der Liste; welches gemeint
    // ist, sagt der Nachbar auf demselben Meter.
    expect(zieleDerStrecke(liste, { name: 'Dressing, Säfte', pfad: DRESSING })).toEqual([
      { name: 'Dressing', pfad: DRESSING },
      { name: 'Säfte', pfad: SAEFTE_OG },
    ]);
  });

  it('kommt auch mit der Mehrzahl im Plan zurecht', () => {
    // „Dressings" kennt die Liste nicht – der Teil lehnt sich an den Pfad an,
    // und die Säfte finden sich trotzdem.
    expect(zieleDerStrecke(liste, { name: 'Dressings, Säfte', pfad: DRESSING })).toEqual([
      { name: 'Dressing', pfad: DRESSING },
      { name: 'Säfte', pfad: SAEFTE_OG },
    ]);
  });

  it('hakt danach beide ab', () => {
    const plan = projekt([mit('Dressings, Säfte', DRESSING)]);
    expect([...pfadeImPlan(plan, liste)].sort()).toEqual([DRESSING, SAEFTE_OG].sort());
  });

  it('rät nicht, wenn es keinen Nachbarn gibt', () => {
    // „Säfte" allein und ohne Pfad bleibt ungeordnet – beide Bedeutungen sind
    // gleich richtig.
    expect(zieleDerStrecke(liste, { name: 'Säfte' })).toEqual([
      { name: 'Säfte', pfad: undefined },
    ]);
  });

  it('macht aus einer Anmerkung keinen Bund', () => {
    const plan = projekt([mit('Nüsse, ab KW 12', NUESSE)]);
    expect(buende(plan, liste).size).toBe(0);
    expect([...pfadeImPlan(plan, liste)]).toEqual([NUESSE]);
  });
});

describe('Der zweite Ring: die Abteilung des Nachbarn', () => {
  const KAFFEEFILTER = P('Lebensmittel & Tabak (TroSo)', 'Kaffee', 'Kaffeefilter');
  const SIRUP_TROSO = P('Lebensmittel & Tabak (TroSo)', 'Konfitüre, Dessert', 'Sirup');
  const SIRUP_GETRAENKE = P('Getränke', 'Getränke Einweg', 'Sirup');

  it('findet den Sirup in der Abteilung des Kaffeefilters', () => {
    // Der gemeldete Fall: „Sirup, Kaffeefilter" auf einer Kopfgondel, der
    // Pfad am Kaffeefilter. Sirup steht nicht in dessen Warengruppe, aber in
    // dessen Abteilung genau einmal.
    expect(zieleDerStrecke(liste, { name: 'Sirup, Kaffeefilter', pfad: KAFFEEFILTER })).toEqual([
      { name: 'Sirup', pfad: SIRUP_TROSO },
      { name: 'Kaffeefilter', pfad: KAFFEEFILTER },
    ]);
  });

  it('lässt den Pfad des eigenen Namens immer gewinnen', () => {
    // Hängt der Pfad am Sirup der Getränke, bleibt es dieser Sirup – und der
    // Kaffeefilter findet sich, weil er in der Liste eindeutig ist.
    expect(zieleDerStrecke(liste, { name: 'Sirup, Kaffeefilter', pfad: SIRUP_GETRAENKE })).toEqual([
      { name: 'Sirup', pfad: SIRUP_GETRAENKE },
      { name: 'Kaffeefilter', pfad: KAFFEEFILTER },
    ]);
  });

  it('hakt beide ab, egal an welchem der Pfad hängt', () => {
    const a = pfadeImPlan(projekt([mit('Sirup, Kaffeefilter', KAFFEEFILTER)]), liste);
    expect([...a].sort()).toEqual([KAFFEEFILTER, SIRUP_TROSO].sort());
    const b = pfadeImPlan(projekt([mit('Sirup, Kaffeefilter', SIRUP_GETRAENKE)]), liste);
    expect([...b].sort()).toEqual([KAFFEEFILTER, SIRUP_GETRAENKE].sort());
  });

  it('nimmt die eigene Warengruppe vor der Abteilung', () => {
    const doppelt: Sortimentsliste = {
      abteilungen: [
        {
          name: 'A',
          warengruppen: [
            { name: 'G1', sortimente: ['Anker', 'Zwilling'] },
            { name: 'G2', sortimente: ['Zwilling'] },
          ],
        },
      ],
    };
    expect(zieleDerStrecke(doppelt, { name: 'Anker, Zwilling', pfad: P('A', 'G1', 'Anker') })).toEqual([
      { name: 'Anker', pfad: P('A', 'G1', 'Anker') },
      { name: 'Zwilling', pfad: P('A', 'G1', 'Zwilling') },
    ]);
  });

  it('rät nicht, wenn auch die Abteilung den Namen doppelt kennt', () => {
    const doppelt: Sortimentsliste = {
      abteilungen: [
        {
          name: 'A',
          warengruppen: [
            { name: 'G0', sortimente: ['Anker'] },
            { name: 'G1', sortimente: ['Zwilling'] },
            { name: 'G2', sortimente: ['Zwilling'] },
          ],
        },
      ],
    };
    expect(zieleDerStrecke(doppelt, { name: 'Anker, Zwilling', pfad: P('A', 'G0', 'Anker') })).toEqual([
      { name: 'Anker', pfad: P('A', 'G0', 'Anker') },
      { name: 'Zwilling', pfad: undefined },
    ]);
  });
});

/**
 * Eine Sonderplatzierung bündelt nichts.
 *
 * „Kuchen, Waffeln" auf einer Aktionspalette heißt: Dort liegt Werbeware von
 * beidem. Es heißt **nicht**, dass Kuchen und Waffeln im ganzen Markt eine
 * gemeinsame Zeile bekommen – die Aktionsstrecke selbst trägt zu dieser Zeile
 * keinen einzigen Meter bei, sie wandert in ihre eigene. Ohne diese Ausnahme
 * verschmolzen zwei reguläre Sortimentszeilen wegen eines Meters Werbeware,
 * und man sah nicht mehr, wie viel von welchem im Markt steht.
 */
describe('Sonderplatzierungen bilden keinen Bund', () => {
  const strecke = (id: string, text: string, pfad: string, aktion = false) =>
    element({
      id,
      breite: 100,
      felderUnten: [{ breite: 100, boeden: 5 }],
      warengruppenUnten: [{ von: 0, bis: 100, text, pfad, aktion: aktion || undefined }],
    });

  const KUCHEN = 'Backwaren › Bake Off › Kuchen';
  const WAFFELN = 'Backwaren › Bake Off › Waffeln';

  it('lässt zwei reguläre Zeilen getrennt', () => {
    const p = projekt([
      strecke('a', 'Kuchen', KUCHEN),
      strecke('b', 'Waffeln', WAFFELN),
      strecke('c', 'Kuchen, Waffeln', KUCHEN, true),
    ]);
    expect(buende(p, liste).size).toBe(0);
    const { baum } = meterauswertung(p, liste);
    const gruppe = baum
      .find((k) => k.name === 'Backwaren')
      ?.kinder.find((k) => k.name === 'Bake Off');
    const namen = (gruppe?.kinder ?? []).map((k) => k.name).sort();
    expect(namen).toEqual(['Kuchen', 'Sonderplatzierung', 'Waffeln']);
  });

  it('bündelt weiterhin, wenn die Strecke keine Aktion ist', () => {
    // Die Gegenprobe: Ohne das Häkchen ist „Kuchen, Waffeln" ein Bund, und
    // genau so soll es bleiben.
    const p = projekt([
      strecke('a', 'Kuchen', KUCHEN),
      strecke('b', 'Waffeln', WAFFELN),
      strecke('c', 'Kuchen, Waffeln', KUCHEN),
    ]);
    expect(buende(p, liste).size).toBeGreaterThan(0);
  });
});
