import { describe, expect, it } from 'vitest';
import {
  GRUPPE_NORMAL,
  KLEINSTE_SCHRIFT,
  gruppenZeilen,
  gruppensatz,
  gruppenspannen,
} from './warengruppe';
import type { Regalfeld } from '../typen/modell';

/**
 * Prüfungen für die Warengruppen unter dem Zug.
 *
 * Zwei Dinge dürfen nicht schiefgehen, weil man beide im Plan nicht sieht:
 * Eine Beschriftung darf nicht weiter reichen, als der Nutzer gemeint hat –
 * sonst steht Ketchup über der Mayonnaise. Und ein Name darf nicht
 * abgeschnitten werden: Aus „Grillsoßen" würde „Grillso", und das liest sich
 * wie eine Angabe.
 */

/** Zehn Punkte je Zeichen – so misst hier die Leinwand. */
const messen = (text: string) => text.length * 10;

const felder = (...eintraege: (string | null)[]): Regalfeld[] =>
  eintraege.map((e) => {
    if (!e) return { breite: 100 };
    const [text, felder] = e.split('/');
    return { breite: 100, warengruppe: { text, felder: Number(felder ?? 1) } };
  });

describe('Strecke einer Beschriftung', () => {
  it('reicht über so viele Felder, wie eingestellt sind', () => {
    expect(gruppenspannen(felder('Ketchup/3', null, null))).toEqual([
      { von: 0, bis: 2, text: 'Ketchup' },
    ]);
  });

  it('endet an der nächsten Beschriftung', () => {
    // Wer Ketchup drei Felder gibt und ins zweite Senf schreibt, meint das
    // zweite als Anfang von Senf – nicht zwei Namen an derselben Stelle.
    expect(gruppenspannen(felder('Ketchup/3', 'Senf/1', null))).toEqual([
      { von: 0, bis: 0, text: 'Ketchup' },
      { von: 1, bis: 1, text: 'Senf' },
    ]);
  });

  it('endet am letzten Feld', () => {
    // Eine zu große Angabe ist kein Fehler: Der Zug wurde hinterher gekürzt.
    expect(gruppenspannen(felder('Ketchup/9', null))).toEqual([
      { von: 0, bis: 1, text: 'Ketchup' },
    ]);
  });

  it('deckt ohne Angabe genau ein Feld ab', () => {
    expect(gruppenspannen(felder('Senf'))).toEqual([{ von: 0, bis: 0, text: 'Senf' }]);
  });

  it('übergeht leeren Text', () => {
    expect(gruppenspannen(felder('   /2', null))).toEqual([]);
    expect(gruppenspannen(felder(null, null))).toEqual([]);
  });
});

describe('Umbruch einer Beschriftung', () => {
  it('lässt einen kurzen Namen in einer Zeile', () => {
    expect(gruppenZeilen('Ketchup', 200, messen)).toEqual(['Ketchup']);
  });

  it('bricht an der Wortgrenze um, wenn es zu breit wird', () => {
    expect(gruppenZeilen('Ketchup und Grillsoßen', 130, messen)).toEqual([
      'Ketchup und',
      'Grillsoßen',
    ]);
  });

  it('achtet einen Umbruch von Hand', () => {
    // Wer selbst trennt, weiß besser, wo.
    expect(gruppenZeilen('Wein\nund Spirituosen', 9999, messen)).toEqual([
      'Wein',
      'und Spirituosen',
    ]);
  });

  it('schneidet ein zu langes Wort nicht ab', () => {
    // Lieber steht es über, als dass eine falsche Angabe im Plan steht.
    expect(gruppenZeilen('Grundnahrungsmittel', 50, messen)).toEqual(['Grundnahrungsmittel']);
  });

  it('macht aus leerem Text keine Zeile', () => {
    expect(gruppenZeilen('', 200, messen)).toEqual([]);
    expect(gruppenZeilen('  \n ', 200, messen)).toEqual([]);
  });

  it('lässt eine gewollte Leerzeile in der Mitte stehen', () => {
    expect(gruppenZeilen('Aktion\n\nSüßwaren', 9999, messen)).toEqual([
      'Aktion',
      '',
      'Süßwaren',
    ]);
  });
});

describe('Beschriftung in die Strecke einpassen', () => {
  /** Zehn Punkte je Zeichen bei Schrifthöhe 20 – linear wie eine echte Schrift. */
  const miss = (text: string, schrift: number) => text.length * 10 * (schrift / 20);

  it('lässt eine passende Beschriftung in voller Größe', () => {
    const satz = gruppensatz('Senf', 400, GRUPPE_NORMAL, miss);
    expect(satz.schrift).toBe(GRUPPE_NORMAL);
    expect(satz.zeilen).toEqual(['Senf']);
  });

  it('bricht um, bevor es verkleinert', () => {
    // Umbrechen kostet nichts an Lesbarkeit, Verkleinern schon.
    const satz = gruppensatz('Ketchup und Grillsoßen', 130, 20, miss);
    expect(satz.zeilen.length).toBeGreaterThan(1);
    expect(satz.schrift).toBe(20);
  });

  it('verkleinert ein einzelnes zu langes Wort, bis es passt', () => {
    // „Grundnahrungsmittel" lässt sich nicht umbrechen. Statt über den
    // Nachbarn zu ragen, wird es kleiner.
    const breite = 100;
    const satz = gruppensatz('Grundnahrungsmittel', breite, 20, miss);
    expect(satz.zeilen).toEqual(['Grundnahrungsmittel']);
    expect(satz.schrift).toBeLessThan(20);
    expect(miss(satz.zeilen[0], satz.schrift)).toBeLessThanOrEqual(breite + 0.01);
  });

  it('hält keine Zeile breiter als ihre Strecke', () => {
    // Die eigentliche Zusage: Was hier herauskommt, passt.
    const faelle: [string, number][] = [
      ['Ketchup, Grillsoßen', 300],
      ['Wein und Spirituosen', 120],
      ['Grundnahrungsmittel', 90],
      ['Aktion', 40],
      ['Molkereiprodukte\nund Käse', 150],
    ];
    for (const [text, breite] of faelle) {
      const satz = gruppensatz(text, breite, GRUPPE_NORMAL, miss);
      for (const zeile of satz.zeilen) {
        // Passt – oder die Schrift steht schon an der Untergrenze. Weiter
        // schrumpfen hieße, sie unlesbar zu machen.
        const passt = miss(zeile, satz.schrift) <= breite + 0.01;
        expect(passt || satz.schrift <= KLEINSTE_SCHRIFT + 0.01).toBe(true);
      }
    }
  });

  it('schrumpft nicht ins Unlesbare', () => {
    // Ein Feld von vier Zentimetern kann keinen Namen tragen. Dann steht er
    // lieber ein wenig über – das sieht man und kann ihn kürzen.
    const satz = gruppensatz('Wein und Spirituosen', 4, 20, miss);
    expect(satz.schrift).toBeGreaterThanOrEqual(KLEINSTE_SCHRIFT - 0.01);
  });

  it('passt ein langes Wort auf ein schmales Feld noch ein', () => {
    // Der Fall, der die Untergrenze fast erreicht: 19 Zeichen auf 90 cm.
    const satz = gruppensatz('Grundnahrungsmittel', 90, GRUPPE_NORMAL, miss);
    expect(miss(satz.zeilen[0], satz.schrift)).toBeLessThanOrEqual(90.01);
    expect(satz.schrift).toBeGreaterThan(KLEINSTE_SCHRIFT);
  });

  it('nimmt die eingestellte Größe als Ausgangspunkt', () => {
    expect(gruppensatz('Senf', 400, 14, miss).schrift).toBe(14);
    expect(gruppensatz('Senf', 400, 28, miss).schrift).toBe(28);
  });

  it('kommt mit einer Strecke ohne Breite zurecht', () => {
    // Kann beim Zeichnen vorkommen, bevor die Größe steht.
    expect(gruppensatz('Senf', 0, 20, miss).schrift).toBe(20);
  });
});
