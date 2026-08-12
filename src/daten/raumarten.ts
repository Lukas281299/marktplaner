import type { Raumart } from '../typen/modell';

/**
 * Die Arten von Räumen, die es in einem Lebensmittelmarkt gibt.
 *
 * Die Art bestimmt zweierlei: die Farbe auf dem Plan und – wichtiger – ob der
 * Raum zur Verkaufsfläche zählt. Nur `verkauf` tut das; alles andere ist
 * Nebenfläche. Deshalb steht hier auch eine kurze Erklärung an jeder Art: Wer
 * einen Raum falsch einsortiert, verschiebt am Ende eine Kennzahl.
 *
 * Die Farben sind blass gehalten, damit die Regale darauf noch zu erkennen
 * sind. Sie sind nur Vorschläge – jeder Raum lässt sich einzeln umfärben.
 */
export interface Raumartinfo {
  id: Raumart;
  name: string;
  farbe: string;
  hinweis: string;
}

export const RAUMARTEN: Raumartinfo[] = [
  {
    id: 'verkauf',
    name: 'Verkaufsraum',
    farbe: '#eff4ea',
    hinweis: 'Zählt zur Verkaufsfläche',
  },
  {
    id: 'lager',
    name: 'Lager',
    farbe: '#f0e9db',
    hinweis: 'Nebenfläche – Trockenlager, Leergut, Anlieferung',
  },
  {
    id: 'kuehlung',
    name: 'Kühlraum',
    farbe: '#dbeaf4',
    hinweis: 'Nebenfläche – Kühlhaus, Tiefkühlzelle',
  },
  {
    id: 'sozial',
    name: 'Sozialraum',
    farbe: '#f1eaf3',
    hinweis: 'Nebenfläche – Aufenthalt, Umkleide, WC, Büro',
  },
  {
    id: 'technik',
    name: 'Technik',
    farbe: '#e9ecef',
    hinweis: 'Nebenfläche – Verbund, Elektro, Lüftung',
  },
  {
    id: 'sonstige',
    name: 'Sonstiges',
    farbe: '#eeeeec',
    hinweis: 'Nebenfläche – wenn nichts anderes passt',
  },
];

export function raumart(id: Raumart): Raumartinfo {
  return RAUMARTEN.find((a) => a.id === id) ?? RAUMARTEN[RAUMARTEN.length - 1];
}
