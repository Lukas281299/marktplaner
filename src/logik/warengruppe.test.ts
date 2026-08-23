import { describe, expect, it } from 'vitest';
import { gruppenZeilen, gruppenspannen } from './warengruppe';
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
