import { describe, expect, it } from 'vitest';
import { RAHMENFARBEN, rahmenfarbe } from './Zeichenflaeche';
import type { Werkzeug } from '../../zustand/planStore';

/**
 * Prüfung für die Farben des Aufziehrahmens.
 *
 * Klein, aber sie sichert einen Fehler ab, der teuer war: Das freie Textfeld
 * kam später dazu und wurde hier vergessen. `RAHMENFARBEN[werkzeug].fuellung`
 * ist bei einem fehlenden Eintrag ein Zugriff auf `undefined` – und React
 * räumt daraufhin die **ganze** Zeichenfläche ab. Aus einem vergessenen
 * Eintrag wurde so ein Werkzeug, das gar nicht benutzbar war.
 *
 * Deshalb zwei Prüfungen: Jedes Werkzeug hat eine Farbe, und ein unbekanntes
 * bekommt trotzdem eine.
 */

/**
 * Alle Werkzeuge, wie sie der Typ kennt.
 *
 * Von Hand aufgezählt, weil TypeScript-Typen zur Laufzeit nicht existieren.
 * Kommt eins dazu und wird hier vergessen, meldet sich `tsc` an der Zuweisung
 * unten – der Typ deckt die Liste ab und umgekehrt.
 */
const ALLE_WERKZEUGE: Werkzeug[] = [
  'auswahl',
  'umriss',
  'flaecheAnfuegen',
  'flaecheAbziehen',
  'raum',
  'wand',
  'oeffnung',
  'messen',
  'grundrissZeichnen',
  'verkaufsflaeche',
  'textfeld',
];

describe('Farben des Aufziehrahmens', () => {
  it.each(ALLE_WERKZEUGE)('kennt %s', (werkzeug) => {
    expect(RAHMENFARBEN[werkzeug]).toBeDefined();
  });

  it('gibt auch einem unbekannten Werkzeug eine Farbe', () => {
    // Der Rückfall ist die eigentliche Absicherung: Ein vergessener Eintrag
    // soll höchstens eine falsche Farbe bedeuten, nicht eine leere Fläche.
    const farbe = rahmenfarbe('gibt-es-noch-nicht' as Werkzeug);
    expect(farbe.fuellung).toBeTruthy();
    expect(farbe.linie).toBeTruthy();
  });

  it('nennt für jede Farbe Füllung und Linie', () => {
    for (const [name, farbe] of Object.entries(RAHMENFARBEN)) {
      expect(farbe.fuellung, name).toBeTruthy();
      expect(farbe.linie, name).toBeTruthy();
    }
  });
});
