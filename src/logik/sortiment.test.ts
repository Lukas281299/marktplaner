import { describe, expect, it } from 'vitest';
import {
  abdeckung,
  abteilungsstand,
  gefiltert,
  istPlatziert,
  kenntNamen,
  leseSortimentsliste,
  mitAufgenommenem,
  platzierteTexte,
  schluesselVon,
  umfang,
} from './sortiment';
import type { Sortimentsliste } from '../daten/warengruppen';
import type { PlanElement } from '../typen/modell';

/**
 * Prüfungen für den Abgleich zwischen Sortimentsliste und Plan.
 *
 * Der Zweck der Liste ist die Frage „habe ich etwas vergessen?" – und die
 * beantwortet sie nur, wenn sie beides richtig zählt. Zu viel Grün wiegt in
 * Sicherheit, zu viel Rot schickt einen auf die Suche nach etwas, das längst
 * dasteht.
 */

const liste: Sortimentsliste = {
  abteilungen: [
    {
      name: 'Drogerie',
      warengruppen: [
        { name: 'Babyartikel', sortimente: ['Babypflege', 'Windeln', 'Babynahrung Glas'] },
        { name: 'Waschmittel', sortimente: ['Vollwaschmittel', 'Weichspüler'] },
      ],
    },
    {
      name: 'Backwaren',
      warengruppen: [{ name: 'Bake Off', sortimente: ['Croissants', 'Snacks'] }],
    },
  ],
};

const feld = (text: string) => ({ breite: 100, warengruppe: { text, felder: 1 } });

const zug = (texte: string[]): PlanElement =>
  ({
    id: 'z',
    vorlageId: 'wt-zug',
    ebeneId: 'einrichtung',
    name: 'Zug',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 100 * texte.length,
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
    felderUnten: texte.map(feld),
  }) as unknown as PlanElement;

const standVon = (texte: string[]) => abdeckung(liste, texte);
const gruppe = (texte: string[], abteilung: string, name: string) =>
  standVon(texte).get(schluesselVon(abteilung, name))!;

describe('Was im Plan steht', () => {
  it('liest die Warengruppen aus den Feldern beider Seiten', () => {
    const gondel = {
      ...zug(['Windeln']),
      beidseitig: true,
      felderOben: [feld('Croissants')],
    } as PlanElement;
    expect(platzierteTexte({ elemente: [gondel] }).sort()).toEqual(['Croissants', 'Windeln']);
  });

  it('liest auch die Warengruppe am Element', () => {
    const el = { ...zug([]), warengruppe: 'Drogerie' } as PlanElement;
    expect(platzierteTexte({ elemente: [el] })).toContain('Drogerie');
  });

  it('findet einen Namen mitten im Text', () => {
    // Mehrere Sortimente auf einem Meter: „Babypflege, Windeln" ist beides.
    expect(istPlatziert(['Babypflege, Windeln'], 'Windeln')).toBe(true);
    expect(istPlatziert(['Babypflege, Windeln'], 'Babypflege')).toBe(true);
  });

  it('achtet nicht auf Groß- und Kleinschreibung', () => {
    expect(istPlatziert(['babypflege'], 'Babypflege')).toBe(true);
  });

  it('hält einen leeren Namen für nirgends platziert', () => {
    // Sonst wäre jede leere Zeile überall ein Treffer.
    expect(istPlatziert(['irgendwas'], '   ')).toBe(false);
  });
});

describe('Grün und Rot', () => {
  it('macht ein einzeln geschriebenes Sortiment grün', () => {
    const stand = gruppe(['Windeln'], 'Drogerie', 'Babyartikel');
    expect(stand.sortimente.get('Windeln')).toBe(true);
    expect(stand.sortimente.get('Babypflege')).toBe(false);
  });

  it('macht mit der Warengruppe alle ihre Sortimente grün', () => {
    // Wer „Babyartikel" über sechs Meter schreibt, hat die Windeln nicht
    // vergessen – er hat sie nicht einzeln aufgeführt.
    const stand = gruppe(['Babyartikel'], 'Drogerie', 'Babyartikel');
    expect(stand.platziert).toBe(true);
    expect([...stand.sortimente.values()].every(Boolean)).toBe(true);
  });

  it('macht die Warengruppe grün, wenn alle Sortimente einzeln dastehen', () => {
    // Sonst bliebe sie rot, obwohl nichts fehlt.
    const stand = gruppe(['Croissants', 'Snacks'], 'Backwaren', 'Bake Off');
    expect(stand.platziert).toBe(true);
  });

  it('lässt die Warengruppe rot, solange eines fehlt', () => {
    expect(gruppe(['Croissants'], 'Backwaren', 'Bake Off').platziert).toBe(false);
  });

  it('hält gleiche Namen in verschiedenen Abteilungen auseinander', () => {
    // „Snacks" gibt es öfter. Der Schlüssel trägt deshalb die Abteilung.
    expect(schluesselVon('Backwaren', 'Bake Off')).not.toBe(schluesselVon('Drogerie', 'Bake Off'));
  });

  it('zählt je Abteilung, wie viel schon steht', () => {
    const stand = standVon(['Babyartikel']);
    expect(abteilungsstand(liste.abteilungen[0], stand)).toEqual({ platziert: 1, gesamt: 2 });
  });
});

describe('Suchen und Aufnehmen', () => {
  it('findet auf allen drei Stufen', () => {
    expect(gefiltert(liste, 'drogerie').abteilungen[0].warengruppen).toHaveLength(2);
    expect(gefiltert(liste, 'bake').abteilungen[0].name).toBe('Backwaren');
    expect(gefiltert(liste, 'windel').abteilungen[0].warengruppen[0].sortimente).toEqual([
      'Windeln',
    ]);
  });

  it('lässt eine Abteilung ohne Treffer weg', () => {
    expect(gefiltert(liste, 'windel').abteilungen).toHaveLength(1);
  });

  it('nimmt einen neuen Namen unter „Eigene" auf', () => {
    const neu = mitAufgenommenem(liste, 'Grillkohle')!;
    expect(kenntNamen(neu, 'Grillkohle')).toBe(true);
    expect(neu.abteilungen[neu.abteilungen.length - 1].name).toBe('Eigene');
  });

  it('nimmt nichts zweimal auf', () => {
    expect(mitAufgenommenem(liste, 'Windeln')).toBeNull();
    expect(mitAufgenommenem(liste, '   ')).toBeNull();
  });
});

describe('Eine Liste einlesen', () => {
  it('liest die JSON-Form', () => {
    const roh = JSON.stringify(liste);
    expect(umfang(leseSortimentsliste(roh))).toEqual({
      abteilungen: 2,
      warengruppen: 3,
      sortimente: 7,
    });
  });

  it('liest eine Tabelle mit drei Spalten', () => {
    const roh = [
      'Abteilung;Warengruppe;Sortiment',
      'Drogerie;Babyartikel;Babypflege',
      ';;Windeln',
      ';Waschmittel;Vollwaschmittel',
      'Backwaren;Bake Off;Croissants',
    ].join('\n');
    const gelesen = leseSortimentsliste(roh);
    expect(umfang(gelesen)).toEqual({ abteilungen: 2, warengruppen: 3, sortimente: 4 });
    expect(gelesen.abteilungen[0].warengruppen[0].sortimente).toEqual(['Babypflege', 'Windeln']);
  });

  it('sagt Bescheid, statt still eine leere Liste zu liefern', () => {
    // Eine leere Liste färbte alles rot, und niemand wüsste warum.
    expect(() => leseSortimentsliste('')).toThrow();
    expect(() => leseSortimentsliste('{ kaputt')).toThrow();
    expect(() => leseSortimentsliste('{"abteilungen":[]}')).toThrow();
  });
});
