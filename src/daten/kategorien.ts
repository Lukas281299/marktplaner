import type { KategorieId } from '../typen/modell';

/**
 * Die Oberkategorien der Elementbibliothek.
 * Die Farbe dient als "Hausfarbe" der Kategorie: neue Elemente bekommen sie
 * als Füllfarbe, und in der Bibliothek erkennt man die Gruppe am Farbpunkt.
 */
export interface Kategorie {
  id: KategorieId;
  name: string;
  farbe: string;
  /** Kurze Erklärung, erscheint als Tooltip. */
  beschreibung: string;
}

export const KATEGORIEN: Kategorie[] = [
  {
    id: 'regale',
    name: 'Regale',
    farbe: '#d9d0c1',
    beschreibung: 'Trockensortiment, Wand- und Gondelregale',
  },
  {
    id: 'kuehlung',
    name: 'Kühlung & Tiefkühlung',
    farbe: '#b9d7ea',
    beschreibung: 'Kühlregale, Truhen und Tiefkühlschränke',
  },
  {
    id: 'frische',
    name: 'Frischeabteilungen',
    farbe: '#c3ddb8',
    beschreibung: 'Obst und Gemüse, Theken, Backshop',
  },
  {
    id: 'kassen',
    name: 'Kassen & Eingang',
    farbe: '#f5dda0',
    beschreibung: 'Kassenzone, Ein- und Ausgang, Leergut',
  },
  {
    id: 'aktion',
    name: 'Aktions- & Sonderflächen',
    farbe: '#f0c4b3',
    beschreibung: 'Paletten, Displays, Saison- und Verkostungsflächen',
  },
  {
    id: 'ausstattung',
    name: 'Weitere Ausstattung',
    farbe: '#d5d8dc',
    beschreibung: 'Säulen, Türen, Technik und Sonstiges',
  },
  {
    id: 'eigene',
    name: 'Eigene Elemente',
    farbe: '#e0d3ea',
    beschreibung: 'Selbst angelegte Vorlagen',
  },
];

/** Schneller Zugriff auf eine Kategorie über ihre Kennung. */
export function findeKategorie(id: KategorieId): Kategorie {
  return KATEGORIEN.find((k) => k.id === id) ?? KATEGORIEN[KATEGORIEN.length - 1];
}
