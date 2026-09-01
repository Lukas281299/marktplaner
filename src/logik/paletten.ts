import type { Palettenart, Palettenplatz } from '../typen/modell';

/**
 * Palettenmaße und wie viele in ein Regalfeld passen.
 *
 * Die Maße sind Norm und keine Einstellung: Eine Europalette misst 1200 ×
 * 800 mm, eine Viertelpalette 600 × 400. Deshalb stehen sie hier und nicht
 * in der Bibliothek – wer eine andere Größe braucht, braucht eine andere
 * Palettenart und keine andere Zahl.
 */

/** Länge und Breite in Zentimetern, lange Seite zuerst. */
export const PALETTEN: Record<Palettenart, { lang: number; kurz: number; name: string }> = {
  euro: { lang: 120, kurz: 80, name: 'Europalette' },
  chep: { lang: 120, kurz: 100, name: 'CHEP' },
  halb: { lang: 80, kurz: 60, name: 'Halbe (Düsseldorfer)' },
  viertel: { lang: 60, kurz: 40, name: 'Viertel' },
};

/**
 * Wie eine Palette im Feld liegt, in Zentimetern.
 *
 * `laengs` heißt: die lange Seite parallel zur Regalfront. So steht eine
 * Europalette 120 breit und ragt 80 tief ins Regal – das passt in ein Regal
 * mit 80 cm Korpustiefe. Quer wäre sie 80 breit und 120 tief und stünde
 * vorne über.
 */
export function palettenmass(art: Palettenart, laengs: boolean) {
  const p = PALETTEN[art];
  return laengs ? { breite: p.lang, tiefe: p.kurz } : { breite: p.kurz, tiefe: p.lang };
}

/**
 * Wie viele Paletten nebeneinander in ein Feld passen.
 *
 * Ohne ausdrückliche Angabe so viele, wie hineingehen – mindestens aber
 * eine. Ein Feld, das für keine ganze Palette reicht, bekommt trotzdem eine
 * gezeichnet: Der Planer hat sie dort hingestellt, und im Plan zu sehen,
 * dass sie übersteht, ist nützlicher als sie wegzulassen.
 */
export function palettenAnzahl(platz: Palettenplatz, feldbreite: number): number {
  if (platz.anzahl && platz.anzahl > 0) return platz.anzahl;
  const { breite } = palettenmass(platz.art, platz.laengs ?? true);
  return Math.max(1, Math.floor(feldbreite / breite));
}

/**
 * Passt die Palette in dieser Lage überhaupt in die Tiefe des Möbels?
 *
 * Nur ein Hinweis, keine Sperre: Eine Palette, die 20 cm übersteht, stellt
 * man im Markt trotzdem hin – man will es nur wissen.
 */
export function stehtUeber(platz: Palettenplatz, moebeltiefe: number): number {
  const { tiefe } = palettenmass(platz.art, platz.laengs ?? true);
  return Math.max(0, tiefe - moebeltiefe);
}
