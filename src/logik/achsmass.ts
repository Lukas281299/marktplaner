/**
 * Das Achsmaß steckt im Symbol.
 *
 * Im Ladenbauplan liest man die Feldbreite an der Zeichnung ab, ohne dass sie
 * danebenstehen muss. Die Regel ist in allen Abteilungen dieselbe – ob
 * Trockensortiment, Obst und Gemüse oder Backwaren:
 *
 *   1000 mm  →  nichts
 *   1250 mm  →  eine Diagonale von unten links nach oben rechts
 *   1333 mm  →  ein Kreuz
 *    625 mm  →  ein Kreuz
 *
 * Dass 625 und 1333 dasselbe Zeichen tragen, ist kein Fehler: Die beiden
 * unterscheiden sich auf dem Plan schon durch ihre Breite so deutlich, dass
 * eine Verwechslung nicht möglich ist – 625 ist halb so breit wie 1250.
 *
 * Alles, was zu keinem der vier Maße passt, bleibt leer. Ein Sonderformat
 * bekommt bewusst kein Zeichen: Ein falsches wäre schlimmer als keines.
 */

export type Achsmasszeichen = 'keins' | 'diagonale' | 'kreuz';

/** Die genormten Achsmaße in Zentimetern, mit ihrem Zeichen. */
const ZEICHEN: { breite: number; zeichen: Achsmasszeichen }[] = [
  { breite: 62.5, zeichen: 'kreuz' },
  { breite: 100, zeichen: 'keins' },
  { breite: 125, zeichen: 'diagonale' },
  { breite: 133.3, zeichen: 'kreuz' },
];

/**
 * Wie viel Abweichung noch als dasselbe Achsmaß durchgeht.
 *
 * Ein Zentimeter, weil 1333 mm sich nicht rund in Zentimeter teilen lässt und
 * beim Ziehen mit der Maus ohnehin gerundet wird. Enger wäre in der Praxis
 * ärgerlich, weiter würde 1250 und 1333 zusammenfallen lassen.
 */
const TOLERANZ = 1;

export function achsmassZeichen(breiteInCm: number): Achsmasszeichen {
  for (const eintrag of ZEICHEN) {
    if (Math.abs(breiteInCm - eintrag.breite) <= TOLERANZ) return eintrag.zeichen;
  }
  return 'keins';
}

/** Alle genormten Achsmaße in Zentimetern – für Auswahllisten. */
export const ACHSMASSE = ZEICHEN.map((z) => z.breite);
