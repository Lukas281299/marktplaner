/**
 * Das Sortiment eines Marktes: Abteilungen, Warengruppen, Sortimente.
 *
 * Drei Stufen, so wie die Sortimentsliste des Marktes aufgebaut ist:
 *
 * ```
 * Backwaren                 ← Abteilung
 *   Bake Off                ← Warengruppe
 *     Croissants            ← Sortiment
 *     Laugengebäck
 * ```
 *
 * Beim Planen schreibt man mal die Warengruppe unter einen Zug und mal ein
 * einzelnes Sortiment – beides muss gehen. Deshalb sind die Stufen keine
 * Pflicht, sondern eine Ordnung: Man greift auf der Höhe zu, auf der man
 * gerade denkt.
 *
 * **Hier steht keine Liste.** Die Sortimentsliste eines Marktes ist dessen
 * eigene Sache und gehört nicht in ein öffentliches Programm; sie wird über
 * *Sortimentsliste laden* von der Platte geholt und liegt danach am Gerät –
 * siehe `speicher/projektArchiv.ts`. Hier stehen nur die Formen, in denen sie
 * abgelegt wird.
 */

/** Eine Warengruppe mit ihren Sortimenten. */
export interface Sortimentsgruppe {
  name: string;
  sortimente: string[];
}

/** Eine Abteilung mit ihren Warengruppen. */
export interface Sortimentsabteilung {
  name: string;
  warengruppen: Sortimentsgruppe[];
}

/** Die ganze Liste. */
export interface Sortimentsliste {
  abteilungen: Sortimentsabteilung[];
}

/** Wohin von Hand aufgenommene Namen wandern, solange sie niemand einordnet. */
export const EIGENE_ABTEILUNG = 'Eigene';

/**
 * Solange nichts geladen ist, ist die Liste **leer**.
 *
 * Hier stand einmal eine allgemeine Beispielliste. Das war ein Fehler: Sie
 * sah aus wie das Sortiment des Marktes, war es aber nicht, und niemand
 * konnte den Unterschied sehen. Eine leere Liste sagt dagegen deutlich, was
 * fehlt – und daneben steht der Knopf, der es behebt.
 */
export const STANDARD_SORTIMENT: Sortimentsliste = { abteilungen: [] };

/**
 * Alle Namen einer Liste, flach – für die Vorschläge am Eingabefeld.
 *
 * Warengruppen und Sortimente zusammen: Wer tippt, meint mal das eine und mal
 * das andere, und die Vorschlagsliste soll ihm beides anbieten.
 */
export function alleNamen(liste: Sortimentsliste): string[] {
  const namen = liste.abteilungen.flatMap((a) =>
    a.warengruppen.flatMap((w) => [w.name, ...w.sortimente]),
  );
  return [...new Set(namen.map((n) => n.trim()).filter(Boolean))];
}

/**
 * Die Namen für das Feld am Element.
 *
 * Kommen aus der geladenen Liste – siehe `usePlanStore.sortiment`. Ohne
 * geladene Liste gibt es keine Vorschläge, und das ist richtig: Erfundene
 * Vorschläge wären schlechter als keine.
 */
export const WARENGRUPPEN: string[] = [];
