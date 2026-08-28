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
    farbe: '#9e9e9e',
    beschreibung: 'wire tech 100: Wandregale, Gondeln, Züge, Kopfgondeln',
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
    id: 'bedienung',
    name: 'Bedienung & SB-Theken',
    farbe: '#d0504f',
    beschreibung: 'Blink-Theken von WSL – bedient und Selbstbedienung',
  },
  {
    id: 'obstgemuese',
    name: 'Obst & Gemüse',
    farbe: '#1a7a1a',
    beschreibung: 'Vitable-Tische, Gondeln, Ecken und Köpfe',
  },
  {
    id: 'blumen',
    name: 'Blumen & Pflanzen',
    farbe: '#b6dfa6',
    beschreibung: 'Pflanzregale, Blumentreppen, Bewässerungswannen und Präsenter',
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
    beschreibung: 'Steh-, Sitz- und Doppelkassen, SB, Ausgang, Leergut',
  },
  {
    id: 'aktion',
    name: 'Aktions- & Sonderflächen',
    farbe: '#e6d24a',
    beschreibung: 'Aktionsflächen, EPAL und CHEP, Drehständer, Displays',
  },
  {
    id: 'ausstattung',
    name: 'Weitere Ausstattung',
    farbe: '#d5d8dc',
    beschreibung: 'Treppe, Aufzug, Säulen, Türen und Stellflächen',
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
