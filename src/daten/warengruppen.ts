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
 * **Hier steht nur ein allgemeiner Anfang.** Die richtige Liste eines Marktes
 * ist dessen eigene Sache und gehört nicht in ein öffentliches Programm; sie
 * wird über *Sortimentsliste laden* von der Platte geholt und liegt danach
 * am Gerät – siehe `speicher/projektArchiv.ts`. Was hier steht, ist das, was
 * ohne eigene Liste dasteht.
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

/** Ein allgemeiner Anfang, solange keine eigene Liste geladen ist. */
export const STANDARD_SORTIMENT: Sortimentsliste = {
  abteilungen: [
    {
      name: 'Obst und Gemüse',
      warengruppen: [
        { name: 'Obst', sortimente: ['Äpfel und Birnen', 'Bananen', 'Zitrusfrüchte', 'Beeren'] },
        { name: 'Gemüse', sortimente: ['Salate', 'Tomaten und Gurken', 'Kohl', 'Wurzelgemüse'] },
        { name: 'Kartoffeln und Zwiebeln', sortimente: [] },
      ],
    },
    {
      name: 'Molkerei',
      warengruppen: [
        { name: 'Milch und Butter', sortimente: [] },
        { name: 'Käse SB', sortimente: [] },
        { name: 'Joghurt und Desserts', sortimente: [] },
        { name: 'Eier', sortimente: [] },
      ],
    },
    {
      name: 'Fleisch und Wurst',
      warengruppen: [
        { name: 'Fleisch SB', sortimente: [] },
        { name: 'Wurst SB', sortimente: [] },
        { name: 'Bedientheke', sortimente: [] },
      ],
    },
    {
      name: 'Backwaren',
      warengruppen: [
        { name: 'Bake Off', sortimente: ['Brötchen', 'Brotlaibe', 'Feingebäck'] },
        { name: 'Brot SB', sortimente: [] },
      ],
    },
    {
      name: 'Tiefkühlung',
      warengruppen: [
        { name: 'TK-Kost', sortimente: ['TK-Pizza', 'TK-Gemüse', 'TK-Fisch'] },
        { name: 'Eiscreme', sortimente: [] },
      ],
    },
    {
      name: 'Getränke',
      warengruppen: [
        { name: 'Alkoholfrei', sortimente: ['Wasser', 'Säfte', 'Limonaden'] },
        { name: 'Alkohol', sortimente: ['Bier', 'Wein', 'Spirituosen'] },
      ],
    },
    {
      name: 'Trockensortiment',
      warengruppen: [
        { name: 'Grundnahrungsmittel', sortimente: ['Nudeln und Reis', 'Konserven', 'Öl und Essig'] },
        { name: 'Saucen und Gewürze', sortimente: ['Ketchup', 'Mayonnaise', 'Senf', 'Grillsoßen'] },
        { name: 'Süßwaren', sortimente: [] },
        { name: 'Knabberartikel', sortimente: [] },
        { name: 'Kaffee und Tee', sortimente: [] },
        { name: 'Frühstück', sortimente: [] },
      ],
    },
    {
      name: 'Non-Food',
      warengruppen: [
        { name: 'Wasch- und Putzmittel', sortimente: [] },
        { name: 'Drogerie', sortimente: [] },
        { name: 'Tierbedarf', sortimente: [] },
        { name: 'Haushalt', sortimente: [] },
      ],
    },
    {
      name: 'Kassenzone',
      warengruppen: [
        { name: 'Impuls', sortimente: ['Süßwaren Kasse', 'Zeitschriften'] },
        { name: 'Tabak', sortimente: [] },
      ],
    },
  ],
};

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

/** Die Namen des mitgelieferten Anfangs – für das Feld am Element. */
export const WARENGRUPPEN: string[] = alleNamen(STANDARD_SORTIMENT);
