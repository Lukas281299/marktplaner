import type { Punkt } from '../typen/modell';

/**
 * Bögen für den frei gezeichneten Grundriss.
 *
 * Ein Grundriss ist im Datenmodell eine Liste von Punkten – ein Polygonzug.
 * Das ist Absicht: Flächenberechnung, Wände, Räume, Einrasten und die
 * Boole'schen Verknüpfungen für „Fläche anfügen" und „Fläche abziehen"
 * arbeiten alle darauf. Ein echter Bogen im Modell würde jede einzelne dieser
 * Stellen betreffen.
 *
 * Deshalb wird ein Bogen hier in einen feinen Polygonzug aufgelöst, sobald er
 * gezeichnet ist. Für die Zeichnung macht das keinen sichtbaren Unterschied –
 * für alles dahinter macht es den Unterschied zwischen „läuft" und „müsste
 * neu geschrieben werden".
 *
 * Der Preis: Ein gezeichneter Bogen lässt sich hinterher nicht mehr als
 * Bogen anfassen, nur noch als Kette von Punkten. Das ist ein ehrlicher
 * Handel und steht so auch in der Anleitung.
 */

/** In wie viele Strecken ein voller Kreis zerlegt wird. */
const STRECKEN_JE_VOLLKREIS = 96;

/** Feinste und gröbste Auflösung eines einzelnen Bogens. */
const MIN_STRECKEN = 2;
const MAX_STRECKEN = 64;

/**
 * Der Bogen durch drei Punkte, als Polygonzug von `von` nach `bis`.
 *
 * `durch` ist der Punkt, den der Bogen unterwegs berühren soll – beim
 * Zeichnen ist das die Stelle, an die man die Maus zieht.
 *
 * Zurück kommen die Punkte **ohne** `von`, aber **mit** `bis`. So lässt sich
 * das Ergebnis direkt an einen laufenden Zug anhängen, ohne den letzten
 * Punkt doppelt einzutragen.
 *
 * Liegen die drei Punkte auf einer Geraden – oder fast, was beim Zeichnen
 * ständig vorkommt –, gibt es keinen Kreis durch sie. Dann kommt einfach die
 * gerade Strecke zurück, statt mit einem Radius nahe unendlich zu rechnen.
 */
export function bogenPunkte(von: Punkt, durch: Punkt, bis: Punkt): Punkt[] {
  const mitte = kreismittelpunkt(von, durch, bis);
  if (!mitte) return [bis];

  const radius = Math.hypot(von.x - mitte.x, von.y - mitte.y);
  if (!Number.isFinite(radius) || radius <= 0) return [bis];

  const winkelVon = Math.atan2(von.y - mitte.y, von.x - mitte.x);
  const winkelDurch = Math.atan2(durch.y - mitte.y, durch.x - mitte.x);
  const winkelBis = Math.atan2(bis.y - mitte.y, bis.x - mitte.x);

  // In welche Richtung läuft der Bogen? Entscheidend ist, auf welcher Seite
  // `durch` liegt – der Bogen soll ja dort entlanggehen und nicht auf der
  // Gegenseite des Kreises.
  let spanne = normiere(winkelBis - winkelVon);
  const bisDurch = normiere(winkelDurch - winkelVon);
  if (bisDurch > spanne) spanne -= 2 * Math.PI;

  const anteil = Math.abs(spanne) / (2 * Math.PI);
  const strecken = Math.max(
    MIN_STRECKEN,
    Math.min(MAX_STRECKEN, Math.ceil(anteil * STRECKEN_JE_VOLLKREIS)),
  );

  const punkte: Punkt[] = [];
  for (let i = 1; i <= strecken; i++) {
    const w = winkelVon + (spanne * i) / strecken;
    punkte.push({ x: mitte.x + Math.cos(w) * radius, y: mitte.y + Math.sin(w) * radius });
  }
  // Der letzte Punkt soll genau `bis` sein und nicht das Ergebnis einer
  // Winkelrechnung – sonst klafft am Ende eines Zuges eine Lücke von einem
  // Hundertstel Millimeter, und der Umriss schließt nicht.
  punkte[punkte.length - 1] = { ...bis };
  return punkte;
}

/** Winkel auf 0 bis 2π bringen. */
function normiere(winkel: number): number {
  const zwei = 2 * Math.PI;
  return ((winkel % zwei) + zwei) % zwei;
}

/**
 * Der Mittelpunkt des Kreises durch drei Punkte.
 *
 * `undefined`, wenn die drei fast auf einer Geraden liegen. Die Schranke ist
 * bewusst großzügig: Beim Zeichnen von Hand ist „fast gerade" der Normalfall,
 * und ein Kreis mit einem Radius von hundert Metern ist für einen Grundriss
 * dasselbe wie eine Gerade.
 */
export function kreismittelpunkt(a: Punkt, b: Punkt, c: Punkt): Punkt | undefined {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return undefined;

  const aq = a.x * a.x + a.y * a.y;
  const bq = b.x * b.x + b.y * b.y;
  const cq = c.x * c.x + c.y * c.y;

  const x = (aq * (b.y - c.y) + bq * (c.y - a.y) + cq * (a.y - b.y)) / d;
  const y = (aq * (c.x - b.x) + bq * (a.x - c.x) + cq * (b.x - a.x)) / d;

  const mitte = { x, y };
  // Ein absurd großer Radius ist praktisch eine Gerade.
  if (Math.hypot(a.x - x, a.y - y) > 100000) return undefined;
  return mitte;
}

/**
 * Ist der Zug lang genug und geschlossen genug, um daraus eine Fläche zu
 * machen?
 *
 * Drei Punkte sind das Mindeste – mit zweien gibt es keine Fläche, nur eine
 * Strecke.
 */
export function taugtAlsUmriss(zug: Punkt[]): boolean {
  if (zug.length < 3) return false;
  // Entartete Züge, bei denen alle Punkte aufeinanderliegen, aussortieren.
  const ersteEcke = zug[0];
  return zug.some((p) => Math.hypot(p.x - ersteEcke.x, p.y - ersteEcke.y) > 1);
}

/**
 * Wirft aufeinanderfolgende Punkte weg, die praktisch gleich sind.
 *
 * Beim Zeichnen entstehen sie ständig – ein Doppelklick, ein Zittern der
 * Hand. Für die Zeichnung sind sie harmlos, für die Flächenberechnung und
 * die Wandableitung nicht: Eine Kante der Länge null hat keine Richtung.
 */
export function entdoppele(zug: Punkt[], mindestabstand = 0.5): Punkt[] {
  const sauber: Punkt[] = [];
  for (const p of zug) {
    const letzter = sauber[sauber.length - 1];
    if (letzter && Math.hypot(p.x - letzter.x, p.y - letzter.y) < mindestabstand) continue;
    sauber.push(p);
  }
  // Auch der Ringschluss zählt: Ist der letzte Punkt fast der erste, fliegt
  // er raus – geschlossen wird der Umriss ohnehin von selbst.
  while (
    sauber.length > 2 &&
    Math.hypot(sauber[0].x - sauber[sauber.length - 1].x, sauber[0].y - sauber[sauber.length - 1].y) <
      mindestabstand
  ) {
    sauber.pop();
  }
  return sauber;
}
