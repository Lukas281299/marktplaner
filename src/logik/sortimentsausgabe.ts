import type { Sortimentsliste } from '../daten/warengruppen';

/**
 * Die Sortimentsliste als Tabelle – der Weg zurück nach Excel.
 *
 * **Derselbe Aufbau, in dem sie hereinkommt.** Drei Spalten, und jede Stufe
 * steht nur in ihrer ersten Zeile: So sieht die Liste im Tabellenprogramm
 * aus wie eine gegliederte Liste und nicht wie eine Datenbank, in der neben
 * jedem Sortiment noch einmal die Abteilung wiederholt wird.
 *
 * ```
 *   Abteilung;Warengruppe;Sortiment
 *   Molkerei;Milch;Vollmilch
 *   ;;H-Milch
 *   ;Joghurt;Fruchtjoghurt
 *   Backwaren;Bake Off;Brötchen
 * ```
 *
 * Genau diese Form liest `leseSortimentsliste` wieder ein – die Datei geht
 * also hin und zurück, ohne dass etwas verlorengeht. Eine Warengruppe ohne
 * Sortimente und eine Abteilung ohne Warengruppen bekommen ihre eigene
 * Zeile; sonst fielen sie beim nächsten Einlesen weg.
 */

/** Das Trennzeichen. Semikolon, weil Excel im Deutschen damit rechnet. */
const TRENNER = ';';

/**
 * Das Zeichen, an dem Excel eine UTF-8-Datei erkennt.
 *
 * Ohne es macht Excel aus „Gemüse" ein „GemÃ¼se" – es rät dann die
 * Zeichensatztabelle des Rechners. Drei Bytes am Anfang ersparen das.
 */
const BOM = '﻿';

/** Eine Zelle so einpacken, dass Trennzeichen und Umbrüche sie nicht zerreißen. */
function zelle(wert: string): string {
  const text = wert ?? '';
  if (!/[";\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Die Liste als Tabelle, gegliedert wie im Fenster.
 *
 * Zurückgegeben wird der reine Text; wer ihn als Datei will, nimmt
 * `alsTabellenblob`.
 */
export function alsTabelle(liste: Sortimentsliste): string {
  const zeilen: string[] = [['Abteilung', 'Warengruppe', 'Sortiment'].join(TRENNER)];

  for (const abteilung of liste.abteilungen) {
    let abteilungOffen = true;

    if (abteilung.warengruppen.length === 0) {
      zeilen.push([zelle(abteilung.name), '', ''].join(TRENNER));
      continue;
    }

    for (const gruppe of abteilung.warengruppen) {
      let gruppeOffen = true;

      const schreibe = (sortiment: string) => {
        zeilen.push(
          [
            abteilungOffen ? zelle(abteilung.name) : '',
            gruppeOffen ? zelle(gruppe.name) : '',
            zelle(sortiment),
          ].join(TRENNER),
        );
        abteilungOffen = false;
        gruppeOffen = false;
      };

      if (gruppe.sortimente.length === 0) schreibe('');
      else for (const sortiment of gruppe.sortimente) schreibe(sortiment);
    }
  }

  return zeilen.join('\r\n');
}

/** Dieselbe Tabelle als Datei, fertig zum Herunterladen. */
export function alsTabellenblob(liste: Sortimentsliste): Blob {
  return new Blob([BOM + alsTabelle(liste)], { type: 'text/csv;charset=utf-8' });
}
