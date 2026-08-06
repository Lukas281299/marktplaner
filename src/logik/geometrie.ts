import type { PlanElement } from '../typen/modell';

/** Ein achsenparalleles Rechteck (Umgrenzung) in Planmaßen. */
export interface Rahmen {
  links: number;
  oben: number;
  rechts: number;
  unten: number;
}

/** Grad in Bogenmaß umrechnen. */
export function inBogenmass(grad: number): number {
  return (grad * Math.PI) / 180;
}

/**
 * Die vier Eckpunkte eines Elements – unter Berücksichtigung der Drehung.
 * Gedreht wird um den Mittelpunkt (x/y).
 */
export function eckpunkte(el: PlanElement): { x: number; y: number }[] {
  const hb = el.breite / 2;
  const ht = el.tiefe / 2;
  const w = inBogenmass(el.drehung);
  const cos = Math.cos(w);
  const sin = Math.sin(w);
  return [
    { x: -hb, y: -ht },
    { x: hb, y: -ht },
    { x: hb, y: ht },
    { x: -hb, y: ht },
  ].map((p) => ({
    x: el.x + p.x * cos - p.y * sin,
    y: el.y + p.x * sin + p.y * cos,
  }));
}

/**
 * Die kleinste achsenparallele Umgrenzung eines Elements.
 * Wird für Auswahlrahmen, Ausrichten und Einrasten gebraucht.
 */
export function umgrenzung(el: PlanElement): Rahmen {
  // Bei 0° können wir uns das Rechnen sparen – das ist der häufigste Fall.
  if (el.drehung % 360 === 0) {
    return {
      links: el.x - el.breite / 2,
      oben: el.y - el.tiefe / 2,
      rechts: el.x + el.breite / 2,
      unten: el.y + el.tiefe / 2,
    };
  }
  const punkte = eckpunkte(el);
  return {
    links: Math.min(...punkte.map((p) => p.x)),
    oben: Math.min(...punkte.map((p) => p.y)),
    rechts: Math.max(...punkte.map((p) => p.x)),
    unten: Math.max(...punkte.map((p) => p.y)),
  };
}

/** Umgrenzung mehrerer Elemente zusammen. */
export function gesamtUmgrenzung(elemente: PlanElement[]): Rahmen | null {
  if (elemente.length === 0) return null;
  const rahmen = elemente.map(umgrenzung);
  return {
    links: Math.min(...rahmen.map((r) => r.links)),
    oben: Math.min(...rahmen.map((r) => r.oben)),
    rechts: Math.max(...rahmen.map((r) => r.rechts)),
    unten: Math.max(...rahmen.map((r) => r.unten)),
  };
}

/** Überschneiden sich zwei Rechtecke? (für die Auswahl mit dem Rahmen) */
export function ueberschneiden(a: Rahmen, b: Rahmen): boolean {
  return a.links < b.rechts && a.rechts > b.links && a.oben < b.unten && a.unten > b.oben;
}

/** Grundfläche eines Elements in Quadratzentimetern. */
export function grundflaecheVon(el: PlanElement): number {
  if (el.form === 'kreis') {
    return Math.PI * (el.breite / 2) * (el.tiefe / 2);
  }
  if (el.form === 'halbkreis') {
    return (Math.PI * (el.breite / 2) * (el.tiefe / 2)) / 2;
  }
  return el.breite * el.tiefe;
}

/** Rundet auf eine sinnvolle Genauigkeit (halbe Zentimeter). */
export function runde(wert: number): number {
  return Math.round(wert * 2) / 2;
}
