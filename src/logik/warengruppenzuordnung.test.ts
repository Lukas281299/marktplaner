import { describe, expect, it } from 'vitest';
import {
  enthaelt,
  feldlage,
  mitZugeordnetenFeldern,
  namenIm,
  ohneZugeordneteFelder,
  umgeschaltet,
  feldkanten,
  warengruppenVon,
} from './warengruppenzuordnung';
import { felderVon } from './regalseiten';
import type { Feldbezug, PlanElement } from '../typen/modell';

/**
 * Prüfungen fürs Zuordnen einer Warengruppe an markierte Meter.
 *
 * Der Kern: Geschrieben wird in **dieselben Felder**, die man in der
 * Gondelübersicht von Hand füllt. Es gibt nur eine Sorte Beschriftung – sonst
 * findet man beim Nachbessern zwei Stellen und ändert die falsche.
 *
 * Dazu zwei Zusagen, die man erst im gedruckten Plan sieht: Vier Meter Eier
 * tragen **einen** Namen und nicht viermal denselben. Und der Text hängt am
 * ersten Meter der Strecke **im Bild** – bei einem Zug an der unteren Wand
 * ist das der mit der höchsten Nummer.
 */

/** Eine Gondel: ein Element, sechs Meter, beide Seiten. */
const gondel = (werte: Partial<PlanElement> = {}): PlanElement =>
  ({
    id: 'zug',
    vorlageId: 'wt-zug',
    ebeneId: 'einrichtung',
    name: 'Gondel',
    kategorie: 'regale',
    x: 1300,
    y: 1000,
    breite: 600,
    tiefe: 127,
    hoehe: 180,
    drehung: 0,
    form: 'wt100',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
    beidseitig: true,
    achsmass: 100,
    ...werte,
  }) as PlanElement;

const f = (feld: number, seite: 'oben' | 'unten' = 'unten'): Feldbezug => ({
  element: 'zug',
  seite,
  feld,
});

/**
 * Die Warengruppen einer Seite, kurz aufgeschrieben – ein Eintrag je Feld.
 *
 * Gespeichert wird in Zentimetern; hier wird zurück auf Felder gerechnet,
 * damit die Prüfungen lesbar bleiben. `Eier/4` heißt: ab diesem Feld, über
 * vier Felder. Passt eine Strecke nicht auf Feldgrenzen, steht ein `~` dabei –
 * dann sagt der Test selbst, dass es nicht mehr feldweise aufgeht.
 */
const gruppen = (elemente: PlanElement[], seite: 'oben' | 'unten' = 'unten') => {
  const felder = felderVon(elemente[0], seite);
  const kanten = feldkanten(felder);
  const zeilen = felder.map(() => '—');

  for (const a of warengruppenVon(elemente[0], seite)) {
    const von = kanten.findIndex((k) => Math.abs(k - a.von) < 0.5);
    const bis = kanten.findIndex((k) => Math.abs(k - a.bis) < 0.5);
    if (von < 0 || bis < 0) {
      zeilen[0] = `~${a.text}/${a.von}-${a.bis}`;
      continue;
    }
    zeilen[von] = `${a.text}/${bis - von}`;
  }
  return zeilen;
};

describe('Markieren', () => {
  it('nimmt einen Meter auf und wieder heraus', () => {
    const eins = umgeschaltet([], f(0));
    expect(enthaelt(eins, f(0))).toBe(true);
    expect(umgeschaltet(eins, f(0))).toEqual([]);
  });

  it('hält die beiden Seiten auseinander', () => {
    // Vorder- und Rückseite einer Gondel sind verschiedene Meter.
    expect(umgeschaltet(umgeschaltet([], f(2, 'unten')), f(2, 'oben'))).toHaveLength(2);
  });
});

describe('Zuordnen schreibt in die Felder', () => {
  it('macht aus vier Metern eine Strecke mit einem Namen', () => {
    const neu = mitZugeordnetenFeldern([gondel()], [f(0), f(1), f(2), f(3)], 'Eier');
    expect(gruppen(neu)).toEqual(['Eier/4', '—', '—', '—', '—', '—']);
  });

  it('schreibt auch bei einem einzelnen Meter', () => {
    expect(gruppen(mitZugeordnetenFeldern([gondel()], [f(2)], 'Eier'))[2]).toBe('Eier/1');
  });

  it('hängt einen zweiten Namen mit Komma an', () => {
    const eins = mitZugeordnetenFeldern([gondel()], [f(0), f(1)], 'Eier');
    const zwei = mitZugeordnetenFeldern(eins, [f(1), f(0)], 'Butter');
    expect(gruppen(zwei)[0]).toBe('Eier, Butter/2');
    expect(namenIm('Eier, Butter')).toEqual(['Eier', 'Butter']);
  });

  it('hängt denselben Namen nicht zweimal an', () => {
    const eins = mitZugeordnetenFeldern([gondel()], [f(0)], 'Eier');
    expect(gruppen(mitZugeordnetenFeldern(eins, [f(0)], 'eier'))[0]).toBe('Eier/1');
  });

  it('macht aus Lücken mehrere Strecken', () => {
    // Zwischen zwei markierten Stücken steht etwas anderes – da gehört auch
    // eine eigene Beschriftung hin.
    const neu = mitZugeordnetenFeldern([gondel()], [f(0), f(1), f(4)], 'Eier');
    expect(gruppen(neu)).toEqual(['Eier/2', '—', '—', '—', 'Eier/1', '—']);
  });

  it('räumt weg, was auf der Strecke sonst noch stand', () => {
    // Zwei Beschriftungen auf derselben Strecke kann der Plan nicht zeigen.
    const eins = mitZugeordnetenFeldern([gondel()], [f(2)], 'Butter');
    const zwei = mitZugeordnetenFeldern(eins, [f(0), f(1), f(2)], 'Eier');
    expect(gruppen(zwei)).toEqual(['Eier/3', '—', '—', '—', '—', '—']);
  });

  it('schreibt dieselbe Strecke, egal wie das Möbel steht', () => {
    // Gespeichert wird in der Achse des Möbels; gedreht wird erst beim
    // Zeichnen. Vorher hing der Text am ersten Meter **im Bild** und wanderte
    // dadurch mit der Drehung – die Daten hingen an der Ansicht.
    const gerade = mitZugeordnetenFeldern([gondel()], [f(0), f(1)], 'Eier');
    const gedreht = mitZugeordnetenFeldern([gondel({ drehung: 180 })], [f(0), f(1)], 'Eier');
    expect(warengruppenVon(gedreht[0], 'unten')).toEqual(warengruppenVon(gerade[0], 'unten'));
    expect(gruppen(gedreht)).toEqual(['Eier/2', '—', '—', '—', '—', '—']);
  });

  it('schreibt auf der Rückseite in deren eigene Felder', () => {
    const neu = mitZugeordnetenFeldern([gondel()], [f(0, 'oben')], 'Eier');
    expect(gruppen(neu, 'oben')[0]).toBe('Eier/1');
    expect(gruppen(neu, 'unten')[0]).toBe('—');
  });

  it('tut ohne Markierung oder ohne Namen nichts', () => {
    const el = [gondel()];
    expect(mitZugeordnetenFeldern(el, [], 'Eier')).toBe(el);
    expect(mitZugeordnetenFeldern(el, [f(0)], '   ')).toBe(el);
  });
});

describe('Wieder wegnehmen', () => {
  it('leert die markierten Meter', () => {
    // Damit man einen Fehlgriff loswird, ohne sich in die Gondelübersicht
    // hineinzuklicken.
    const eins = mitZugeordnetenFeldern([gondel()], [f(0), f(1)], 'Eier');
    expect(gruppen(ohneZugeordneteFelder(eins, [f(0), f(1)]))).toEqual([
      '—',
      '—',
      '—',
      '—',
      '—',
      '—',
    ]);
  });

  it('lässt die übrigen stehen', () => {
    const eins = mitZugeordnetenFeldern([gondel()], [f(0)], 'Eier');
    const zwei = mitZugeordnetenFeldern(eins, [f(3)], 'Butter');
    expect(gruppen(ohneZugeordneteFelder(zwei, [f(0)]))[3]).toBe('Butter/1');
  });
});

describe('Wo ein Meter liegt', () => {
  it('findet die Vorderkante des ersten Meters', () => {
    // Der Zug reicht von 1000 bis 1600, sechs Meter. Der erste hat seine
    // Mitte bei 1050, die Vorderkante bei y = 1000 + 127/2.
    const lage = feldlage(gondel(), 'unten', 0)!;
    expect(lage.x).toBeCloseTo(1050, 3);
    expect(lage.y).toBeCloseTo(1063.5, 3);
    expect(lage.breite).toBeCloseTo(100, 3);
  });

  it('legt die Rückseite an die andere Kante', () => {
    const lage = feldlage(gondel(), 'oben', 0)!;
    expect(lage.y).toBeCloseTo(936.5, 3);
    expect(lage.seite).toBe('oben');
  });

  it('gibt es einen Meter nicht, kommt nichts zurück', () => {
    expect(feldlage(gondel(), 'unten', 9)).toBeNull();
  });
});

describe('Der Pfad kommt mit dem Pinsel mit', () => {
  const PFAD = 'Lebensmittel & Tabak (TroSo) › Feinbackwaren › Kuchen';

  it('schreibt ihn an die Strecke', () => {
    // Der Name allein ist nicht eindeutig – „Kuchen" steht in der Liste
    // fünfmal. Wer aus der Liste links aufnimmt, trifft genau einen.
    const [el] = mitZugeordnetenFeldern([gondel()], [f(0), f(1)], 'Kuchen', PFAD);
    expect(el.warengruppenUnten).toEqual([
      { von: 0, bis: 200, text: 'Kuchen', pfad: PFAD },
    ]);
  });

  it('behält ihn, wenn derselbe Name noch einmal darauf landet', () => {
    const einmal = mitZugeordnetenFeldern([gondel()], [f(0)], 'Kuchen', PFAD);
    const zweimal = mitZugeordnetenFeldern(einmal, [f(0)], 'Kuchen', PFAD);
    expect(zweimal[0].warengruppenUnten?.[0].pfad).toBe(PFAD);
  });

  it('lässt ihn fallen, wenn ein zweiter Name dazukommt', () => {
    // „Kuchen, Waffeln" auf einer Strecke haben keinen gemeinsamen Platz in
    // der Liste. Einen der beiden zu behalten hieße raten.
    const erst = mitZugeordnetenFeldern([gondel()], [f(0)], 'Kuchen', PFAD);
    const dann = mitZugeordnetenFeldern(erst, [f(0)], 'Waffeln', 'Anderswo › X › Waffeln');
    expect(dann[0].warengruppenUnten?.[0].text).toBe('Kuchen, Waffeln');
    expect(dann[0].warengruppenUnten?.[0].pfad).toBeUndefined();
  });

  it('läuft über Feldgrenzen hinweg als eine Strecke', () => {
    // Vier Meter Eier tragen einen Namen mit einer Klammer darüber – nicht
    // viermal denselben, und die Feldgrenzen darunter stören nicht.
    const [el] = mitZugeordnetenFeldern(
      [gondel()],
      [f(1), f(2), f(3)],
      'Eier',
      'Lebensmittel & Tabak (TroSo) › Eier › Eier',
    );
    expect(el.warengruppenUnten).toHaveLength(1);
    expect(el.warengruppenUnten?.[0]).toMatchObject({ von: 100, bis: 400, text: 'Eier' });
  });
});
