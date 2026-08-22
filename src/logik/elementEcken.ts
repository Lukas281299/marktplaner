import type { PlanElement, Punkt } from '../typen/modell';

/**
 * Die Ecken eines frei geformten Elements.
 *
 * Manche Möbel lassen sich durch kein Rechteck und keine feste Vorlage
 * beschreiben – eine Ecklösung im Obst und Gemüse zum Beispiel, die in jedem
 * Markt anders zugeschnitten ist. Für die trägt das Element seinen eigenen
 * Umriss (`polygon`), und dieses Modul rechnet, was beim Ziehen an einer Ecke
 * passieren muss.
 *
 * Der Umriss liegt **zentriert** am Element: Seine Punkte sind Abstände zum
 * Mittelpunkt, nicht Weltkoordinaten. Das hat einen guten Grund – so dreht
 * sich das Element um seine Mitte wie jedes andere auch. Es bedeutet aber,
 * dass nach jedem Zug am Eckpunkt nachgerechnet werden muss: Der Umriss
 * bekommt eine neue Ausdehnung, also auch eine neue Mitte, und das Element
 * muss so nachrücken, dass die Form auf dem Plan stehen bleibt.
 */

/** Dreht einen Punkt um den Ursprung. `grad` im Uhrzeigersinn. */
function drehe(p: Punkt, grad: number): Punkt {
  const bogen = (grad * Math.PI) / 180;
  const sin = Math.sin(bogen);
  const cos = Math.cos(bogen);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/** Die Weltkoordinaten aller Ecken eines Elements. */
export function eckenVon(element: PlanElement): Punkt[] {
  if (!element.polygon || element.polygon.length < 3) return [];
  return element.polygon.map((p) => {
    const gedreht = drehe(p, element.drehung);
    return { x: element.x + gedreht.x, y: element.y + gedreht.y };
  });
}

/** Die Kantenlängen in der Reihenfolge der Ecken, umlaufend geschlossen. */
export function kantenlaengen(element: PlanElement): number[] {
  const ecken = eckenVon(element);
  if (ecken.length < 3) return [];
  return ecken.map((p, i) => {
    const q = ecken[(i + 1) % ecken.length];
    return Math.hypot(q.x - p.x, q.y - p.y);
  });
}

/**
 * Was sich am Element ändert, wenn eine Ecke an eine neue Stelle gezogen wird.
 *
 * `ziel` ist eine Weltkoordinate – dort, wo die Maus losgelassen wurde.
 *
 * Gibt `null` zurück, wenn nichts zu tun ist: kein Umriss, ein Punkt, den es
 * nicht gibt, oder eine Form, die dabei in sich zusammenfiele. Lieber nichts
 * tun als eine Fläche mit null Ausdehnung erzeugen – die ließe sich hinterher
 * nicht mehr anfassen.
 */
export function verschiebeEcke(
  element: PlanElement,
  index: number,
  ziel: Punkt,
): Pick<PlanElement, 'polygon' | 'breite' | 'tiefe' | 'x' | 'y'> | null {
  const alt = element.polygon;
  if (!alt || index < 0 || index >= alt.length || alt.length < 3) return null;

  // Weltkoordinate in das ungedrehte System des Elements zurückrechnen.
  const roh = drehe({ x: ziel.x - element.x, y: ziel.y - element.y }, -element.drehung);
  const punkte = alt.map((p, i) => (i === index ? roh : p));

  const xs = punkte.map((p) => p.x);
  const ys = punkte.map((p) => p.y);
  const breite = Math.max(...xs) - Math.min(...xs);
  const tiefe = Math.max(...ys) - Math.min(...ys);
  // Eine Fläche ohne Ausdehnung wäre auf dem Plan nicht mehr zu treffen.
  if (breite < 1 || tiefe < 1) return null;

  // Der Umriss wird neu auf seine Mitte bezogen; das Element rückt um genau
  // diese Verschiebung nach, damit die Form stehen bleibt.
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const my = (Math.max(...ys) + Math.min(...ys)) / 2;
  const versatz = drehe({ x: mx, y: my }, element.drehung);

  return {
    polygon: punkte.map((p) => ({ x: p.x - mx, y: p.y - my })),
    breite,
    tiefe,
    x: element.x + versatz.x,
    y: element.y + versatz.y,
  };
}

/** Trägt dieses Element einen frei formbaren Umriss? */
export function hatEcken(element: PlanElement): boolean {
  return element.form === 'umriss' && (element.polygon?.length ?? 0) >= 3;
}
