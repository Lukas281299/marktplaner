import type { PlanElement } from '../typen/modell';
import { umgrenzung } from './geometrie';

/**
 * Gruppen und Ketten von Regalen.
 *
 * Zwei Dinge, die im Ladenbau ständig gebraucht werden:
 *
 *  - **Zusammenfassen.** Eine Gondel besteht aus mehreren Feldern, die man
 *    hinterher gemeinsam verschiebt. Einzeln herumzuschieben ist beim
 *    Aufbauen richtig, beim Umplanen fast immer falsch.
 *  - **Aneinanderreihen.** Regale stehen bündig aneinander, ohne Lücke und
 *    ohne Überlappung. Von Hand trifft man das nie genau, und ein Millimeter
 *    Luft je Feld summiert sich über einen 20-Meter-Zug.
 */

/**
 * Alle Elemente, die mit dem angegebenen zusammen bewegt werden.
 *
 * Ohne Gruppe ist das nur das Element selbst.
 */
export function mitgliederVon(elemente: PlanElement[], id: string): string[] {
  const element = elemente.find((el) => el.id === id);
  if (!element) return [];
  if (!element.gruppeId) return [id];
  return elemente.filter((el) => el.gruppeId === element.gruppeId).map((el) => el.id);
}

/** Erweitert eine Auswahl um alle Gruppenmitglieder. */
export function mitGruppen(elemente: PlanElement[], ids: string[]): string[] {
  const gesamt = new Set<string>();
  for (const id of ids) for (const mitglied of mitgliederVon(elemente, id)) gesamt.add(mitglied);
  return [...gesamt];
}

/**
 * Reiht Elemente bündig aneinander.
 *
 * Das erste Element bleibt stehen, alle weiteren rücken lückenlos an ihren
 * Vorgänger. Sortiert wird nach der aktuellen Lage – die Reihenfolge, die man
 * auf dem Bildschirm sieht, ist auch die, die herauskommt.
 *
 * Gerechnet wird mit der Umgrenzung, nicht mit der Breite: Ein gedrehtes
 * Regal ist in X-Richtung so breit wie sein umschließendes Rechteck, und nur
 * das zählt fürs bündige Anschließen.
 */
export function reiheAneinander(
  elemente: PlanElement[],
  achse: 'waagerecht' | 'senkrecht',
): { id: string; x: number; y: number }[] {
  const beweglich = elemente.filter((el) => !el.gesperrt);
  if (beweglich.length < 2) return [];

  const sortiert = [...beweglich].sort((a, b) => (achse === 'waagerecht' ? a.x - b.x : a.y - b.y));
  const ergebnis: { id: string; x: number; y: number }[] = [];

  let kante =
    achse === 'waagerecht' ? umgrenzung(sortiert[0]).rechts : umgrenzung(sortiert[0]).unten;

  for (const element of sortiert.slice(1)) {
    const eigen = umgrenzung(element);
    if (achse === 'waagerecht') {
      // Abstand vom Mittelpunkt zur linken Kante – der bleibt beim Verschieben
      // gleich, auch wenn das Element gedreht ist.
      const nachLinks = element.x - eigen.links;
      const x = kante + nachLinks;
      ergebnis.push({ id: element.id, x, y: element.y });
      kante = x + (eigen.rechts - element.x);
    } else {
      const nachOben = element.y - eigen.oben;
      const y = kante + nachOben;
      ergebnis.push({ id: element.id, x: element.x, y });
      kante = y + (eigen.unten - element.y);
    }
  }

  return ergebnis;
}

/**
 * In welcher Richtung stehen die Elemente überwiegend?
 *
 * Damit „Aneinanderreihen" ohne Rückfrage das Richtige tut: Ein Zug, der
 * schon grob waagerecht liegt, wird waagerecht geschlossen.
 */
export function hauptrichtung(elemente: PlanElement[]): 'waagerecht' | 'senkrecht' {
  if (elemente.length < 2) return 'waagerecht';
  const xs = elemente.map((el) => el.x);
  const ys = elemente.map((el) => el.y);
  const spanneX = Math.max(...xs) - Math.min(...xs);
  const spanneY = Math.max(...ys) - Math.min(...ys);
  return spanneX >= spanneY ? 'waagerecht' : 'senkrecht';
}
