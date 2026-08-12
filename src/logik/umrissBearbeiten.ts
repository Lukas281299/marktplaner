import type { Punkt } from '../typen/modell';
import { vereinfache } from './polygon';

/**
 * Das Umformen eines Umrisses über seine Ecken.
 *
 * Bewusst hier und nicht in der Zeichenfläche: Es sind drei kleine Regeln, die
 * still danebengehen können – eine Ecke, die an der falschen Stelle landet,
 * eine eingefügte, die den Umriss verdreht, eine entfernte, die eine Fläche
 * unter drei Ecken zurücklässt. Als reine Funktionen lassen sie sich prüfen;
 * in einem Mausereignis vergraben nicht.
 */

/** Weniger als drei Ecken ergeben keine Fläche mehr. */
const MINDESTECKEN = 3;

/** Verschiebt eine einzelne Ecke. */
export function punktVerschieben(umriss: Punkt[], index: number, punkt: Punkt): Punkt[] {
  if (index < 0 || index >= umriss.length) return umriss;
  return umriss.map((p, i) => (i === index ? punkt : p));
}

/**
 * Setzt eine neue Ecke hinter die angegebene ein.
 *
 * „Hinter" ist wichtig: Der Umlaufsinn muss erhalten bleiben, sonst schlägt
 * sich der Umriss beim nächsten Zug selbst ein Knie.
 */
export function punktEinfuegen(umriss: Punkt[], nachIndex: number, punkt: Punkt): Punkt[] {
  if (nachIndex < 0 || nachIndex >= umriss.length) return umriss;
  const neu = [...umriss];
  neu.splice(nachIndex + 1, 0, punkt);
  return neu;
}

/**
 * Entfernt eine Ecke. Gibt `null` zurück, wenn das nicht geht – dann bleibt
 * der Umriss, wie er ist, und die Oberfläche sagt warum.
 */
export function punktEntfernen(umriss: Punkt[], index: number): Punkt[] | null {
  if (umriss.length <= MINDESTECKEN) return null;
  if (index < 0 || index >= umriss.length) return null;
  const ohne = umriss.filter((_, i) => i !== index);
  // Fällt durch das Entfernen eine Ecke auf die Verbindungslinie ihrer
  // Nachbarn, fliegt sie gleich mit – sonst sammeln sich Anfasser an, die
  // nichts mehr bewirken.
  const aufgeraeumt = vereinfache(ohne);
  return aufgeraeumt.length >= MINDESTECKEN ? aufgeraeumt : ohne;
}
