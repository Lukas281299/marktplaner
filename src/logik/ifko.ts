import { bodentiefeMm } from './feldnotiz';
import { felderVon, type Seite } from './regalseiten';
import type { PlanElement } from '../typen/modell';

/**
 * Wie viele grüne Kisten auf ein Möbel gehen.
 *
 * Die Kennzahl, um die es beim Bestellen geht. Sie steht von Hand am
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
 *   Feld 1,00   1 2/3      3      3 1/3      5
 *   Feld 1,25       2      3          4      6
 * ```
 *
 * **Eine Regel steckt trotzdem darin**, und sie erklärt beide Zeilen: Die
 * Kisten liegen **längs** – die lange Seite von 60 cm zeigt zum Gang, die
 * kurze von 40 cm in die Tiefe. Damit trägt eine Auflage `Tiefe ÷ 40` Reihen,
 * und in jede Reihe passen `Breite ÷ 60` Kisten. Beim 1,25-m-Feld sind das
 * genau zwei ganze je Reihe (1,60 je Meter), beim 1,00-m-Feld 1 2/3. Nur das
 * T600-Feld mit 1,00 m fällt heraus: Dort ergäbe die Rechnung anderthalb
 * Reihen, und die halbe wird aufgefüllt.
 *
 * **Andersherum gelegt sieht alles anders aus**, und darum bleibt die Tabelle
 * die Quelle: Wer die Kisten quer stellt, bekommt 2,5 statt 1,67 auf den
 * laufenden Meter je Reihe, dafür weniger Reihen in dieselbe Tiefe.
 *
 * Ein gestuftes Möbel hat mehrere Auflagen verschiedener Tiefe; gezählt wird
 * Stufe für Stufe und zusammengelegt. Eine Gondel trägt ihre Stufen auf
 * beiden Seiten und damit das Doppelte.
 */

/** Das Maß einer grünen Kiste, in cm. */
export const IFKO = { lang: 60, kurz: 40 } as const;

/**
 * Kisten je laufendem Meter **einer** Auflagenreihe, nach Lage der Kiste.
 *
 * Zwei Zahlen und nicht eine – das ist der Punkt. Wie viele Kisten einem
 * Meter entsprechen, hängt daran, wie sie liegen: `laengs` heißt, die lange
 * Seite von 60 cm zeigt zum Gang, `quer` ist das Gegenteil. Dazu kommt die
 * Tiefe, die über die Zahl der Reihen entscheidet.
 *
 * **Deshalb gibt es keinen einzelnen Umrechnungskurs zwischen Kisten und
 * Metern.** Wer eine Abteilung in Kisten zählt und eine andere in Metern,
 * darf die beiden Spalten nicht addieren – die Auswertung führt sie getrennt.
 */
export const KISTEN_JE_METER = {
  laengs: 100 / IFKO.lang,
  quer: 100 / IFKO.kurz,
} as const;

/** Die Feldbreiten, für die gemessen wurde, in cm. */
const BREITEN = [100, 125];

/** Die Auflagentiefen, für die gemessen wurde, in cm. */
const TIEFEN = [40, 60, 80, 120];

/** Kisten je Auflage: `TABELLE[breite][tiefe]`. */
const TABELLE: Record<number, Record<number, number>> = {
  100: { 40: 5 / 3, 60: 3, 80: 10 / 3, 120: 5 },
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
 * Zwei Wege, je nachdem, was das Möbel über sich sagt:
 *
 *  - Ein **gestuftes** Möbel (Vitable) nennt seine Auflagen samt Tiefen. Dann
 *    zählt jede Stufe einzeln.
 *  - Ein **Regal oder Kühlmöbel**, das in der Obstabteilung steht – das
 *    Kartoffelregal, die Kühlwanne für Salate –, hat Böden gleicher Tiefe.
 *    Dann zählt die Bodenzahl mal die Kisten je Boden. Damit ist beantwortet,
 *    wie sich so ein Möbel in die Abteilung einmischt: **Es zählt in Kisten
 *    wie alles andere dort** und nicht in umgerechneten Metern.
 *
 * `undefined` heißt: Dieses Möbel sagt nichts, woraus sich etwas ableiten
 * ließe, und dann wäre jede Zahl geraten. Eingetragen wird der Vorschlag nie
 * von selbst; er steht da, und übernehmen tut ihn der Planer.
 */
export function ifkoVorschlag(element: PlanElement): number | undefined {
  if (!(element.breite > 0)) return undefined;
  const seiten = element.beidseitig ? 2 : 1;

  const stufen = element.stufen;
  if (stufen && stufen.length > 0) {
    const eineSeite = stufen.reduce((summe, tiefe) => summe + ifkoJeStufe(element.breite, tiefe), 0);
    return Math.round(eineSeite * seiten);
  }

  // Sonst über die Böden: Sie liegen alle gleich tief, und wie tief, weiß das
  // Möbel selbst – `bodentiefeMm` zieht die tote Zone hinter der Ware ab.
  const tiefe = bodentiefeMm(element) / 10;
  const jeBoden = ifkoJeStufe(element.breite, tiefe);
  if (jeBoden <= 0) return undefined;

  const boeden = boedenSchnitt(element);
  if (boeden === undefined) return undefined;
  return Math.round(jeBoden * boeden * seiten);
}

/**
 * Die Bodenzahl eines Möbels, über seine Felder gemittelt.
 *
 * Ein Zug trägt vorn fünf und hinten sechs; für einen Vorschlag genügt der
 * Schnitt. Steht nirgends eine Zahl, kommt `undefined` heraus – geraten wird
 * nicht.
 */
function boedenSchnitt(element: PlanElement): number | undefined {
  const seiten: Seite[] = element.beidseitig ? ['unten', 'oben'] : ['unten'];
  let breite = 0;
  let gewichtet = 0;
  for (const seite of seiten) {
    for (const feld of felderVon(element, seite)) {
      if (feld.boeden === undefined || feld.leer) continue;
      breite += feld.breite;
      gewichtet += feld.breite * feld.boeden;
    }
  }
  return breite > 0 ? gewichtet / breite : undefined;
}
