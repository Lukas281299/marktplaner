import { felderVon, seitenbreite, type Seite } from './regalseiten';
import type { PlanElement, Punkt } from '../typen/modell';

/**
 * Welches Feld eines Möbels liegt unter diesem Punkt?
 *
 * Gebraucht beim Zuordnen einer Warengruppe: Man klickt auf einen Meter im
 * Plan, nicht auf ein Möbel. Damit der Name im richtigen Feld landet, muss
 * der Klick durch dieselbe Rechnung wie die Zeichnung – erst in die eigenen
 * Koordinaten des Möbels, dann durch die Feldliste der getroffenen Seite.
 *
 * Ein Möbel ohne Felder ist genau ein Feld. Dann kommt immer die Null heraus,
 * und das ist richtig: Dort gibt es nur eine Stelle, an die der Name kann.
 */

/** Wo ein Klick gelandet ist. */
export interface Feldtreffer {
  seite: Seite;
  feld: number;
}

/**
 * Rechnet einen Punkt der Weltebene in die Koordinaten des Möbels um.
 *
 * Der Bezugspunkt eines Elements ist seine Mitte, gezeichnet wird ab der
 * linken oberen Ecke – deshalb am Ende die halbe Größe dazu. Gedreht wird
 * gegen die Drehung des Möbels: Man will wissen, wo der Punkt auf dem
 * ungedrehten Möbel läge.
 */
export function inElementkoordinaten(element: PlanElement, punkt: Punkt): Punkt {
  const bogen = (-element.drehung * Math.PI) / 180;
  const dx = punkt.x - element.x;
  const dy = punkt.y - element.y;
  return {
    x: dx * Math.cos(bogen) - dy * Math.sin(bogen) + element.breite / 2,
    y: dx * Math.sin(bogen) + dy * Math.cos(bogen) + element.tiefe / 2,
  };
}

/**
 * Das Feld unter dem Punkt – oder `null`, wenn er neben dem Möbel liegt.
 *
 * Ein wenig Luft ringsum, damit ein Klick knapp am Rand nicht ins Leere geht:
 * Getroffen wird mit der Maus, nicht mit dem Lineal.
 */
export function feldUnterPunkt(element: PlanElement, punkt: Punkt, luft = 0): Feldtreffer | null {
  const eigen = inElementkoordinaten(element, punkt);
  if (eigen.x < -luft || eigen.x > element.breite + luft) return null;
  if (eigen.y < -luft || eigen.y > element.tiefe + luft) return null;

  // Bei einer Gondel entscheidet die Höhe über die Seite: Oben liegt die
  // Rückseite, unten die Vorderseite – dieselbe Aufteilung wie beim Zeichnen.
  const seite: Seite = element.beidseitig && eigen.y < element.tiefe / 2 ? 'oben' : 'unten';
  const felder = felderVon(element, seite);
  if (felder.length === 0) return { seite, feld: 0 };

  // Dieselbe Streckung wie in der Zeichnung: Die längere Seite füllt die
  // Breite des Möbels, beide Seiten teilen sich den Faktor.
  const laenge = Math.max(
    seitenbreite(felderVon(element, 'oben')),
    seitenbreite(felderVon(element, 'unten')),
  );
  const faktor = laenge > 0 ? element.breite / laenge : 1;

  let x = 0;
  for (let i = 0; i < felder.length; i++) {
    x += felder[i].breite * faktor;
    if (eigen.x <= x) return { seite, feld: i };
  }
  // Rechts vom letzten Feld – das kommt bei der kürzeren Seite einer Gondel
  // vor, deren Ende früher liegt als das Möbel.
  return { seite, feld: felder.length - 1 };
}
