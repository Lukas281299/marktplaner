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
 * **Die Tiefe der Auflage entscheidet, wie die Kiste liegt.** Eine ifko misst
 * 600 × 400 mm, und je nach Auflagentiefe passt sie nur in einer Lage:
 *
 * ```
 *   T400    eine Reihe  quer     – die kurze Seite nach hinten, 60 cm zum Gang
 *   T600    eine Reihe  längs    – die lange Seite nach hinten, 40 cm zum Gang
 *   T800    zwei Reihen quer
 *   T1200   zwei Reihen längs
 * ```
 *
 * Daraus folgt alles: Wie viele Kisten nebeneinander stehen, ist die Breite
 * geteilt durch das, was von der Kiste zum Gang zeigt – 60 cm quer, 40 cm
 * längs. Mal der Zahl der Reihen dahinter.
 *
 * Dazu die **Grifflücke**: Ein 1,25-m-Feld trägt Kisten auf 1,20 m, die fünf
 * Zentimeter daneben sind zum Anfassen. Beim 1,00-m-Feld bleibt nichts übrig,
 * dort gibt es auch keine.
 *
 * Damit geht die im Markt gemessene Tabelle **ohne Rest und ohne Rundung**
 * auf – jede der acht Zahlen kommt aus der Rechnung heraus:
 *
 * ```
 *              T400     T600     T800    T1200
 *   Feld 1,00   1 2/3     2,5     3 1/3      5
 *   Feld 1,25       2       3         4       6
 * ```
 *
 * Gerechnet wird **Feld für Feld**, denn jedes Feld hat seine eigene
 * Grifflücke: Ein Möbel aus vier 1,25-m-Einheiten trägt Kisten auf 4 × 1,20 m
 * und nicht auf 5,00 m.
 *
 * Ein gestuftes Möbel hat mehrere Auflagen verschiedener Tiefe; gezählt wird
 * Stufe für Stufe und zusammengelegt. Eine Gondel trägt ihre Stufen auf
 * beiden Seiten und damit das Doppelte.
 */

/** Das Maß einer grünen Kiste, in cm. */
export const IFKO = { lang: 60, kurz: 40 } as const;

/**
 * Wie die Kiste liegt.
 *
 * `quer` heißt: die **lange** Seite von 60 cm zeigt zum Gang, die kurze von
 * 40 cm geht in die Tiefe. `laengs` ist das Gegenteil.
 *
 * (Umgekehrt benannt als bei den Getränkekisten in `getraenkekisten.ts` –
 * dort heißt `laengs`, dass die lange Seite parallel zum Gestell liegt. Beide
 * Male ist es die Sprache der Abteilung, und die ist nun einmal verschieden.)
 */
export type Kistenlage = 'quer' | 'laengs';

/** Was von der Kiste zum Gang zeigt, in cm. */
const ZUM_GANG: Record<Kistenlage, number> = {
  quer: IFKO.lang,
  laengs: IFKO.kurz,
};

/**
 * Kisten je laufendem Meter **einer** Reihe, nach Lage der Kiste.
 *
 * Zwei Zahlen und nicht eine – das ist der Punkt. Wie viele Kisten einem
 * Meter entsprechen, hängt daran, wie sie liegen, und dazu kommt die Tiefe
 * mit ihren Reihen.
 *
 * **Deshalb gibt es keinen einzelnen Umrechnungskurs zwischen Kisten und
 * Metern.** Wer eine Abteilung in Kisten zählt und eine andere in Metern,
 * darf die beiden Spalten nicht addieren – die Auswertung führt sie getrennt.
 */
export const KISTEN_JE_METER = {
  quer: 100 / ZUM_GANG.quer,
  laengs: 100 / ZUM_GANG.laengs,
} as const;

/**
 * Wie eine Auflage bestückt wird, nach ihrer Tiefe.
 *
 * Die vier Tiefen des Vitable-Systems, und für jede genau eine sinnvolle
 * Bestückung: In 40 cm passt die Kiste nur quer, in 60 cm nur längs, 80 cm
 * fasst zwei quer hintereinander, 120 cm zwei längs.
 */
export const AUFLAGEN: { tiefe: number; lage: Kistenlage; reihen: number }[] = [
  { tiefe: 40, lage: 'quer', reihen: 1 },
  { tiefe: 60, lage: 'laengs', reihen: 1 },
  { tiefe: 80, lage: 'quer', reihen: 2 },
  { tiefe: 120, lage: 'laengs', reihen: 2 },
];

/**
 * Die Bestückung, die zu einer Auflagentiefe passt.
 *
 * Für eine Tiefe, die nicht im System steht, gilt die nächstgelegene. Bei
 * genau gleichem Abstand gewinnt die **flachere**: Eine Kiste zu wenig steht
 * in der Ecke, eine zu viel wird bestellt und passt nicht.
 */
export function auflageFuer(stufentiefe: number) {
  return AUFLAGEN.reduce((a, b) =>
    Math.abs(b.tiefe - stufentiefe) < Math.abs(a.tiefe - stufentiefe) ? b : a,
  );
}

/**
 * Das Raster, in dem die Kisten aufgehen – der größte gemeinsame Teiler von
 * 60 und 40 cm.
 */
const RASTER = 20;

/**
 * Die Breite, auf der wirklich Kisten stehen – abzüglich der Grifflücke.
 *
 * **Ein 1,25-m-Feld trägt Kisten auf 1,20 m**; die fünf Zentimeter daneben
 * sind die Lücke zum Anfassen. Mit dieser einen Regel geht Lukas' gemessene
 * Tabelle glatt auf: 120 ÷ 60 sind zwei Kisten quer, 120 ÷ 40 sind drei
 * längs – ohne Rest und ohne Rundung.
 *
 * Beim 1,00-m-Feld bleibt nichts übrig, dort ist auch keine Lücke.
 */
export function nutzbreite(feldbreite: number): number {
  return Math.floor(feldbreite / RASTER) * RASTER;
}

/**
 * Kisten auf **einer** Auflage eines Feldes.
 *
 * Nutzbreite geteilt durch das, was von der Kiste zum Gang zeigt, mal der
 * Zahl der Reihen dahinter.
 */
export function ifkoJeStufe(feldbreite: number, stufentiefe: number): number {
  if (!(feldbreite > 0) || !(stufentiefe > 0)) return 0;
  const auflage = auflageFuer(stufentiefe);
  return (auflage.reihen * nutzbreite(feldbreite)) / ZUM_GANG[auflage.lage];
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

  // **Feld für Feld**, nicht über die ganze Breite: Jedes Feld hat seine
  // eigene Grifflücke. Ein Möbel aus vier 1,25-m-Einheiten trägt Kisten auf
  // 4 × 1,20 m und nicht auf 5,00 m.
  const felder = felderVon(element, 'unten');

  const stufen = element.stufen;
  if (stufen && stufen.length > 0) {
    const eineSeite = felder.reduce(
      (summe, feld) =>
        summe + stufen.reduce((teil, tiefe) => teil + ifkoJeStufe(feld.breite, tiefe), 0),
      0,
    );
    return Math.round(eineSeite * seiten);
  }

  // Sonst über die Böden: Sie liegen alle gleich tief, und wie tief, weiß das
  // Möbel selbst – `bodentiefeMm` zieht die tote Zone hinter der Ware ab.
  const tiefe = bodentiefeMm(element) / 10;
  const boeden = boedenSchnitt(element);
  if (boeden === undefined) return undefined;
  const eineSeite = felder.reduce(
    (summe, feld) => summe + ifkoJeStufe(feld.breite, tiefe) * boeden,
    0,
  );
  if (eineSeite <= 0) return undefined;
  return Math.round(eineSeite * seiten);
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
