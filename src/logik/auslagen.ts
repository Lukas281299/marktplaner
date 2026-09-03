import { felderVon } from './regalseiten';
import type { Auslagenanteil, Streckenmeter } from './warengruppenmeter';
import type { PlanElement, Regalfeld } from '../typen/modell';

/**
 * Wie viele Auslagen ein Möbel je laufendem Meter trägt.
 *
 * Die zweite Hälfte der Warengruppen-Auswertung. `warengruppenmeter` misst,
 * **wie lang** eine Warengruppe ist; hier steht, **wie oft** diese Länge
 * zählt. Ein Meter Regal mit fünf Böden sind fünf tatsächliche Meter.
 *
 * **Die Zahl am Feld gewinnt immer.** Steht am Feld eine Bodenzahl, gilt die
 * – über jede Regel hinweg, die hier aufgeschrieben ist. Ein Katalog kennt
 * die Bauart, aber nicht den Markt: Wer den obersten Boden herausgenommen
 * hat, weil die Decke tief hängt, trägt vier ein, und dann sind es vier.
 *
 * Erst wo nichts eingetragen ist, greifen die Regeln der Abteilung. Und wo
 * es auch dafür keine gibt, kommt **keine Zahl** heraus statt einer
 * geschätzten: Die Auswertung sagt dann, auf wie vielen Metern sie fehlt.
 * Eine erfundene Zahl wanderte sonst in eine Bestellung.
 *
 * Was unter den Böden steht, zählt eigenständig mit – eine Palette, eine
 * Kartoffelkiste, ein eingebautes Kühlmöbel. Es trägt Ware und ist damit
 * eine Auslage, ganz gleich was es ist.
 */

/**
 * Die Fachhöhe eines Tiefkühlschranks, in cm.
 *
 * Der H2010 hat 153 cm Sichtfläche auf fünf Böden. Daraus ergibt sich alles
 * Weitere in der Tiefkühlung.
 */
export const TK_FACH = 153 / 5;

/**
 * Die tote Zone zwischen zwei Böden, in cm – **geschätzt**.
 *
 * Der Boden selbst, die Preisschiene davor und die Luft, die über der Ware
 * bleiben muss. Wer sie genauer kennt, ändert diese eine Zahl; alles andere
 * in der Tiefkühlung rechnet sich daraus.
 */
export const TK_TOTZONE = 4;

/**
 * Auslagen je laufendem Meter **einer** Truhenseite.
 *
 * Eine Truhe ist stufenlos: 85 cm Auslage am Stück, ohne tote Zone. In einem
 * Schrank bleiben von einem Fach nach Abzug der toten Zone 26,6 cm übrig –
 * die Truhenseite ist also gut drei Fächer wert.
 *
 * Eine beidseitige Truhe kommt dadurch von selbst auf das Doppelte: Sie
 * trägt zwei Seiten, und jede zählt einzeln.
 */
export const TRUHE_AUSLAGE_CM = 85;
export const TRUHE_AUSLAGEN = Math.round((TRUHE_AUSLAGE_CM / (TK_FACH - TK_TOTZONE)) * 10) / 10;

/** Die Sichtfläche des Schrankteils eines Kombigeräts, in cm. */
const KOMBI_SICHT = { niedrig: 85.2, hoch: 105.2 };

/** Ab dieser Höhe in cm gilt ein Möbel als die hohe Bauform. */
const TK_SCHRANK_HOCH = 211;
const TK_KOMBI_HOCH = 220;

/**
 * Wie viele Auslagen ein Möbel je laufendem Meter mitbringt.
 *
 * Die Bauart, nicht die Planung – deshalb steht hier nur, was aus dem
 * Katalog folgt. Alles, was der Planer entscheidet, steht am Feld und geht
 * dieser Zahl vor.
 */
export function moebelauslagen(element: PlanElement): number | undefined {
  const hoehe = element.hoehe ?? 0;

  switch (element.form) {
    // Tiefkühlung. Truhe stufenlos, Schrank in Böden, Kombi beides
    // übereinander: unten die Wanne, oben der Schrank.
    case 'tkTruhe':
      return TRUHE_AUSLAGEN;
    case 'tkSchrank':
      return hoehe >= TK_SCHRANK_HOCH ? 6 : 5;
    case 'tkKombi':
      return (
        Math.round(
          (TRUHE_AUSLAGEN +
            (hoehe >= TK_KOMBI_HOCH ? KOMBI_SICHT.hoch : KOMBI_SICHT.niedrig) / TK_FACH) *
            10,
        ) / 10
      );

    // Bedienung und Selbstbedienung. Die flache Theke zeigt eine Lage Ware,
    // das halbhohe Möbel drei.
    case 'blinkTheke':
    case 'blinkSelf':
      return 1;
    case 'blinkSv':
      return 3;

    // Der BakeOff-Turm bringt vier Etagen mit, das Eckstück ebenso.
    case 'bakeoff':
    case 'bakeoffEcke':
      return 4;

    default:
      break;
  }

  // Obst und Gemüse tragen ihre Auslagen schon am Möbel: Ein Vitable-Tisch
  // bringt sie aus dem Modul mit, nicht aus der Planung.
  if (element.auslagen && element.auslagen > 0) return element.auslagen;

  return undefined;
}

/**
 * Was ein einzelnes Feld an Auslagen trägt.
 *
 * Die Bodenzahl, und dazu eine für den Unterbau: Was unter den Böden steht,
 * trägt Ware und zählt eigenständig – egal was es ist.
 */
export function feldauslagen(feld: Regalfeld, vorgabe?: number): number | undefined {
  // Ein leeres Feld trägt nichts. Die Säule steht, aber es hängt nichts
  // darin, und ein Sortiment liegt dort erst recht nicht.
  if (feld.leer) return 0;

  const boeden = feld.boeden ?? vorgabe;
  if (boeden === undefined || !Number.isFinite(boeden)) return undefined;
  return Math.max(0, boeden) + (feld.unterbau ? 1 : 0);
}

/**
 * Was eine beschriftete Strecke an tatsächlichen Metern trägt.
 *
 * **Feld für Feld, nicht für das ganze Möbel.** Ein Zug trägt oben fünf und
 * unten sechs Böden, und eine Warengruppe läuft über beide. Gewichtet wird
 * deshalb mit dem Stück, das jedes Feld zu dieser Strecke beiträgt.
 *
 * Fehlt an einem Feld die Zahl, fehlt sie nur für dessen Stück. Die Strecke
 * bekommt dann eine Zahl **und** eine Restlänge, auf der sie unvollständig
 * ist – so sieht man in der Tabelle, wie viel noch auszufüllen ist, statt
 * die ganze Strecke zu verlieren.
 */
export function auslagenAnteil(strecke: Streckenmeter): Auslagenanteil {
  const vorgabe = moebelauslagen(strecke.element);
  const felder = felderVon(strecke.element, strecke.seite);

  let tatsaechlich = 0;
  let ohne = 0;
  let anfang = 0;

  for (const feld of felder) {
    const ende = anfang + feld.breite;
    const stueck = Math.min(ende, strecke.bis) - Math.max(anfang, strecke.von);
    anfang = ende;
    if (stueck <= 0) continue;

    const zahl = feldauslagen(feld, vorgabe);
    if (zahl === undefined) ohne += stueck;
    else tatsaechlich += stueck * zahl;
  }

  // Ragt die Strecke über die Felder hinaus – von Hand eingetippte Breite,
  // Abschnitt aus einer älteren Planung –, zählt der Überhang mit der
  // Vorgabe. Ihn wegzulassen hieße, Meter verschwinden zu lassen, die im
  // Plan stehen.
  const ueberhang = strecke.bis - Math.max(strecke.von, anfang);
  if (ueberhang > 0) {
    if (vorgabe === undefined) ohne += ueberhang;
    else tatsaechlich += ueberhang * vorgabe;
  }

  return { tatsaechlich, ohne };
}
