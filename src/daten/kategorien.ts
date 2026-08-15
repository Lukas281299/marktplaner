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
    name: 'Kühlung',
    farbe: '#b9d7ea',
    beschreibung: 'Normalkühlung: Molkerei, SB-Fleisch, Convenience',
  },
  {
    id: 'tiefkuehlung',
    name: 'Tiefkühlung',
    farbe: '#a78ecf',
    beschreibung: 'Truhen, Schränke und Kombigeräte von WSL',
  },
  {
    id: 'obstgemuese',
    name: 'Obst & Gemüse',
    farbe: '#1a7a1a',
    beschreibung: 'Vitable-Tische, Gondeln, Ecken und Köpfe',
  },
  {
    id: 'frische',
    name: 'Frischetheken',
    farbe: '#c3ddb8',
    beschreibung: 'Fleisch, Wurst, Käse, Fisch und Salatbar',
  },
  {
    id: 'backwaren',
    name: 'Backwaren',
    farbe: '#d8bc98',
    beschreibung: 'BakeOff-Türme und Backwarenzeilen',
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
