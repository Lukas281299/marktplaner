import type { PlanElement } from '../typen/modell';

/**
 * Wie viele grüne Kisten auf ein Obst- und Gemüsemöbel gehen.
 *
 * Die Kennzahl, um die es beim Bestellen geht. Sie steht bisher von Hand am
 * Möbeltyp – hier steht der **Vorschlag**, damit man sie nicht für zwanzig
 * Vitable-Varianten einzeln abzählen muss.
 *
 * **Die Zahlen sind gemessen, nicht gerechnet.** Sie kommen aus dem Markt und
 * nicht aus der Geometrie: Eine ifko misst 600 × 400 mm, aber wie viele auf
 * eine Auflage gehen, entscheidet auch, wie weit man sie überstehen lässt.
 * Deshalb steht hier eine Tabelle und keine Formel.
 *
 * ```
 *              T400     T600     T800    T1200
 *   Feld 1,00   1 2/3      3      3 1/3      6
 *   Feld 1,25       2      3          4      6
 * ```
 *
 * Ein gestuftes Möbel hat mehrere Auflagen verschiedener Tiefe; gezählt wird
 * Stufe für Stufe und zusammengelegt. Eine Gondel trägt ihre Stufen auf
 * beiden Seiten und damit das Doppelte.
 */

/** Die Feldbreiten, für die gemessen wurde, in cm. */
const BREITEN = [100, 125];

/** Die Auflagentiefen, für die gemessen wurde, in cm. */
const TIEFEN = [40, 60, 80, 120];

/** Kisten je Auflage: `TABELLE[breite][tiefe]`. */
const TABELLE: Record<number, Record<number, number>> = {
  100: { 40: 5 / 3, 60: 3, 80: 10 / 3, 120: 6 },
  125: { 40: 2, 60: 3, 80: 4, 120: 6 },
};

/**
 * Der Wert aus der Liste, der einer Zahl am nächsten kommt.
 *
 * Bei genau gleichem Abstand gewinnt der **kleinere**: Eine Kiste zu wenig
 * steht in der Ecke, eine zu viel wird bestellt und passt nicht.
 */
function naechste(werte: number[], wert: number): number {
  const sortiert = [...werte].sort((a, b) => a - b);
  return sortiert.reduce((a, b) => (Math.abs(b - wert) < Math.abs(a - wert) ? b : a));
}

/**
 * Kisten auf **einer** Auflage.
 *
 * Für eine Breite oder Tiefe, die nicht in der Tabelle steht, gilt der
 * nächstgelegene gemessene Fall – bei der Breite zusätzlich hochgerechnet,
 * denn quer nebeneinander stehen die Kisten einfach weiter. Die Tiefe wird
 * nicht hochgerechnet: Sie entscheidet über **Reihen**, und eine halbe Reihe
 * gibt es nicht.
 */
export function ifkoJeStufe(feldbreite: number, stufentiefe: number): number {
  if (!(feldbreite > 0) || !(stufentiefe > 0)) return 0;
  const breite = naechste(BREITEN, feldbreite);
  const tiefe = naechste(TIEFEN, stufentiefe);
  return TABELLE[breite][tiefe] * (feldbreite / breite);
}

/**
 * Der Vorschlag für ein ganzes Möbel – oder `undefined`.
 *
 * Undefined heißt: Dieses Möbel sagt nicht, wie es gestuft ist, und dann
 * wäre jede Zahl geraten. Eingetragen wird der Vorschlag nie von selbst; er
 * steht als Vorschlag da, und übernehmen tut ihn der Planer.
 */
export function ifkoVorschlag(element: PlanElement): number | undefined {
  const stufen = element.stufen;
  if (!stufen || stufen.length === 0) return undefined;
  if (!(element.breite > 0)) return undefined;

  const eineSeite = stufen.reduce((summe, tiefe) => summe + ifkoJeStufe(element.breite, tiefe), 0);
  const gesamt = element.beidseitig ? eineSeite * 2 : eineSeite;
  return Math.round(gesamt);
}
