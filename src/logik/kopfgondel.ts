import type { PlanElement } from '../typen/modell';

/**
 * Kopfgondeln vor den Enden eines Zugs.
 *
 * Eine Kopfgondel steht quer vor dem Kopf einer Gondel und schließt sie ab.
 * Ihre Maße folgen nicht dem Geschmack, sondern der Gondel:
 *
 *  - **Breite** ist das Achsmaß, das der Gondeltiefe am nächsten kommt. Vor
 *    eine Gondel mit 600er Boden – zusammen 1270 mm tief – kommt eine
 *    1250er, vor eine mit 500er Boden eine 1000er.
 *  - **Tiefe** ist die Tiefe *einer* Gondelseite. Die Kopfgondel ist ein
 *    einseitiges Regal; sie steht vor dem Kopf und nicht darum herum.
 *
 * Gedreht steht sie quer zum Zug: Ihre Breite läuft über die Gondeltiefe,
 * ihre Tiefe ragt über das Zugende hinaus.
 */

/** Die tote Zone hinter dem Grundboden, in cm – siehe `ElementSymbol`. */
const TOTE_ZONE = 7;

/** Achsmaße, in denen es den Abschluss 180° gibt. */
const KOPF_ACHSMASSE = [62.5, 100, 125, 133.3];

export type Kopfseite = 'anfang' | 'ende';

export interface Kopfmasse {
  breite: number;
  tiefe: number;
  achsmass: number;
}

/**
 * Breite und Tiefe der Kopfgondel vor einem Zug dieser Tiefe.
 *
 * Aus der Gondeltiefe zurückgerechnet: Sie ist zweimal der Grundboden plus
 * die tote Zone, die sich beide Seiten teilen. Eine Seite ist also
 * (Tiefe − 70) / 2 tief, und die Kopfgondel als einseitiges Regal noch einmal
 * 70 mm mehr.
 */
export function kopfmasse(gondeltiefe: number): Kopfmasse {
  const jeSeite = Math.max(0, (gondeltiefe - TOTE_ZONE) / 2);
  const achsmass = KOPF_ACHSMASSE.reduce((a, b) =>
    Math.abs(b - gondeltiefe) < Math.abs(a - gondeltiefe) ? b : a,
  );
  return { breite: achsmass, achsmass, tiefe: jeSeite + TOTE_ZONE };
}

/**
 * Wo die Kopfgondel steht und wie sie gedreht ist.
 *
 * Gerechnet wird in der Achse des Zugs: `anfang` ist das Ende in Richtung
 * des Zugbeginns, `ende` das gegenüberliegende. Bei einem gedrehten Zug
 * wandern beide mit – deshalb die Richtungsvektoren statt schlichtem
 * Plus und Minus auf x.
 */
export function kopflage(
  zug: Pick<PlanElement, 'x' | 'y' | 'breite' | 'tiefe' | 'drehung'>,
  seite: Kopfseite,
): { x: number; y: number; drehung: number } {
  const masse = kopfmasse(zug.tiefe);
  const bogen = (zug.drehung * Math.PI) / 180;
  // Längsrichtung des Zugs in Weltkoordinaten.
  const ux = Math.cos(bogen);
  const uy = Math.sin(bogen);
  const abstand = zug.breite / 2 + masse.tiefe / 2;
  const richtung = seite === 'anfang' ? -1 : 1;

  return {
    x: zug.x + richtung * abstand * ux,
    y: zug.y + richtung * abstand * uy,
    // Quer zum Zug: Die Breite der Kopfgondel läuft über dessen Tiefe.
    // Am Anfang zeigt sie in die Gegenrichtung, damit beide Köpfe vom Zug
    // weg schauen und nicht beide in dieselbe Richtung.
    drehung: (((zug.drehung + (seite === 'anfang' ? 270 : 90)) % 360) + 360) % 360,
  };
}

/** Taugt dieses Element überhaupt als Zug mit Kopfgondeln? */
export function kannKopfgondel(element: PlanElement): boolean {
  // Nur beidseitige wire-tech-Züge: Ein Wandregal hat keinen freien Kopf,
  // und vor ein Kühlmöbel stellt niemand eine Kopfgondel.
  return element.form === 'wt100' && Boolean(element.beidseitig);
}
