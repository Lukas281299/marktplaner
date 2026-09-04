import { felderVon, seitenbreite } from './regalseiten';
import { geordnet } from './warengruppe';
import { warengruppenVon } from './warengruppenzuordnung';
import { inElementkoordinaten } from './feldtreffer';
import type { PlanElement, Punkt } from '../typen/modell';

/**
 * Welche Warengruppe an einer Stelle des Plans steht.
 *
 * Für das Zuordnen: Wer „Waffeln" dem Kuchen zuschlagen will, klickt die
 * vier Meter an, auf denen der Kuchen schon steht – das ist schneller und
 * sicherer, als den Namen abzutippen.
 *
 * Gesucht wird in derselben Achse, in der die Strecken gespeichert sind:
 * Zentimeter ab dem Anfang der Feldkette dieser Seite. Bei einer Gondel
 * entscheidet die Höhe über die Seite, genau wie beim Treffen eines Feldes.
 *
 * `null` heißt: Dort steht nichts – daneben, auf einer unbeschrifteten
 * Strecke, oder auf einem Möbel ohne Warengruppen.
 */
export function warengruppeUnterPunkt(
  element: PlanElement,
  punkt: Punkt,
): { name: string; pfad?: string } | null {
  const eigen = inElementkoordinaten(element, punkt);
  if (eigen.x < 0 || eigen.x > element.breite) return null;
  if (eigen.y < 0 || eigen.y > element.tiefe) return null;

  const seite = element.beidseitig && eigen.y < element.tiefe / 2 ? 'oben' : 'unten';
  const gesamt = seitenbreite(felderVon(element, seite));
  if (gesamt <= 0) return null;

  // Dieselbe Streckung wie beim Zeichnen: Die längere Seite füllt die Breite
  // des Möbels, beide Seiten teilen sich den Faktor.
  const laenge = Math.max(
    seitenbreite(felderVon(element, 'oben')),
    seitenbreite(felderVon(element, 'unten')),
  );
  const faktor = laenge > 0 ? laenge / element.breite : 1;
  const stelle = eigen.x * faktor;

  for (const a of geordnet(warengruppenVon(element, seite), gesamt)) {
    if (stelle < a.von || stelle > a.bis) continue;
    const name = a.text.trim();
    if (!name) continue;
    return { name, pfad: a.pfad };
  }
  return null;
}
