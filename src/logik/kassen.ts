import type { Grundform, PlanElement } from '../typen/modell';

/**
 * Die Kassenzeile: was daran fest ist und was der Planer wählt.
 *
 * **Warum das eine eigene Datei ist.** Die Maße standen an zwei Stellen –
 * einmal in der Bibliothek, um die Einträge zu bauen, und einmal in der
 * Zeichnung, um die Fugen zu setzen. Zwei Listen derselben Zahlen laufen
 * früher oder später auseinander, und dann steht im Plan eine andere Kasse
 * als in der Bestellung.
 *
 * **Gemessen an der ITAB-Zeichnung** „Straight IV", Familie 65
 * (2018_10008352). Eine Einzelkasse ist längs aus vier Abschnitten gebaut:
 *
 * ```
 *   Kopfteil        428 mm   fest
 *   Warenband      1800 mm   wählbar – 900 bis 3900 in 300er Schritten
 *   Kassenplatz     618 mm   fest
 *   Abpacktisch    1067 mm   fest
 *   ------------------------
 *   Gesamtlänge    3913 mm
 * ```
 *
 * **Nur das Band ist wählbar.** Deshalb steht in der Bibliothek auch nur ein
 * Eintrag je Bauart und nicht elf: Die Länge ist eine Eigenschaft, kein
 * eigenes Möbel. In der Zeichnung selbst stecken 646 Blöcke – aber das sind
 * dieselben acht Bauteile in allen Längen, beiden Anschlägen und vier
 * Ansichten. Eine Bibliothek, die das nachbaut, kann niemand mehr überblicken.
 */

/** Kopfteil, in cm. */
export const KASSE_KOPF = 42.8;
/** Kassenplatz mit Scanner und Lade, in cm. */
export const KASSE_PLATZ = 61.8;
/** Abpacktisch, in cm. */
export const KASSE_ABPACK = 106.7;
/** Alles, was nicht das Band ist. */
export const KASSE_FEST = KASSE_KOPF + KASSE_PLATZ + KASSE_ABPACK;

/** Breite eines Warenbands quer zur Laufrichtung, in cm. */
export const KASSE_BAND = 45;

/**
 * Die Bandlängen, die ITAB liefert – in Zentimetern.
 *
 * Von 900 bis 3900 mm in Schritten von 300. Dazwischen gibt es nichts: Wer
 * 2000 mm plant, bekommt keine Kasse. Genau das stand vorher in der
 * Bibliothek, und im Plan war es nicht zu sehen.
 */
export const BANDLAENGEN = [90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390];

/** Das übliche Band – die Länge, mit der ein Möbel aus der Bibliothek kommt. */
export const BAND_STANDARD = 180;

/** Welche Formen eine Kassenzeile mit Warenband sind. */
const MIT_BAND: Grundform[] = ['kasse', 'kasseSitz', 'kasseDoppel'];

/** Trägt dieses Möbel ein Warenband, dessen Länge man wählt? */
export function hatBand(form: Grundform): boolean {
  return MIT_BAND.includes(form);
}

/** Die Bandlänge dieses Möbels, in cm. */
export function bandlaenge(element: Pick<PlanElement, 'form' | 'breite'>): number {
  if (!hatBand(element.form)) return 0;
  return Math.max(0, Math.round((element.breite - KASSE_FEST) * 10) / 10);
}

/** Die Gesamtlänge, die zu dieser Bandlänge gehört. */
export function gesamtlaenge(band: number): number {
  return Math.round((band + KASSE_FEST) * 10) / 10;
}

/**
 * Die nächstgelegene lieferbare Bandlänge.
 *
 * Beim freien Ziehen kommt jede Zwischenlänge heraus. Die Zahl selbst ist
 * dann nicht falsch – das Möbel ist so breit, wie es dasteht –, aber
 * bestellbar ist sie nicht. Deshalb sagt das Eigenschaftenfenster, welche
 * Länge gemeint sein dürfte, statt stillschweigend zu runden.
 */
export function naechsteBandlaenge(band: number): number {
  return BANDLAENGEN.reduce((beste, laenge) =>
    Math.abs(laenge - band) < Math.abs(beste - band) ? laenge : beste,
  );
}

/** Ist diese Bandlänge eine, die es wirklich gibt? */
export function bandlaengeLieferbar(band: number): boolean {
  return BANDLAENGEN.some((laenge) => Math.abs(laenge - band) < 0.5);
}

/**
 * Die Abschnittsgrenzen einer Kassenzeile, von links nach rechts.
 *
 * Bei einem sehr kurz gezogenen Element bleibt vom Band nichts übrig – dann
 * rücken die Fugen zusammen, statt sich zu überholen.
 *
 * `gespiegelt` ist der Anschlag: Bei ITAB heißen die beiden Ausführungen LA
 * und RA, und sie unterscheiden sich genau darin, von welcher Seite der Kunde
 * seine Ware aufs Band legt. Über die Drehung ist das nicht zu ersetzen – 180
 * Grad vertauschen zwar links und rechts, drehen aber auch vorn und hinten,
 * und dann stünde die Bedienung auf der falschen Seite.
 */
export function kassenfugen(b: number, gespiegelt: boolean) {
  const band = Math.max(b - KASSE_FEST, 0);
  const x1 = Math.min(KASSE_KOPF, b);
  const x2 = Math.min(x1 + band, b);
  const x3 = Math.min(x2 + KASSE_PLATZ, b);
  if (!gespiegelt) return { band, x1, x2, x3 };
  // Gespiegelt läuft dieselbe Folge von rechts nach links.
  return { band, x1: b - x3, x2: b - x2, x3: b - x1 };
}

/**
 * Das Füllstück zwischen zwei Kassenzeilen.
 *
 * Es gibt sie in Vielfachen von 295 mm – 295, 590, 885 und so fort bis 2065.
 * Damit wird die Lücke geschlossen, die bleibt, wenn eine Kassenzeile nicht
 * genau an die Wand stößt.
 */
export const FUELLSTUECK_RASTER = 29.5;
export const FUELLSTUECK_LAENGEN = [1, 2, 3, 4, 5, 6, 7].map(
  (n) => Math.round(n * FUELLSTUECK_RASTER * 10) / 10,
);
