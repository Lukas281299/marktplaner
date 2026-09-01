import type { Grundflaeche, Punkt, Raum, Wand } from '../typen/modell';
import { kanten, vorzeichenFlaeche } from './polygon';

/**
 * Wo verlaufen die Wände, und welche liegt unter dem Mauszeiger?
 *
 * Gebraucht wird das beim Setzen einer Tür: Man klickt auf eine Wand, und die
 * Tür soll dort sitzen – in der richtigen Richtung, mit der richtigen Stärke,
 * mittig in der Wand. Von Hand einen Drehwinkel einzugeben wäre die
 * unbrauchbare Alternative.
 *
 * Die drei Wandsorten haben ihre Achse an verschiedenen Stellen:
 *  - **Innenwand:** `von`/`bis` ist bereits die Achse
 *  - **Außenwand:** Der Umriss ist die Außenkante, die Achse liegt eine halbe
 *    Wandstärke weiter innen
 *  - **Raumwand:** genau wie die Außenwand
 *
 * Diese Verschiebung ist der Grund, warum es diese Datei gibt: Ohne sie säße
 * jede Tür in der Außenwand um eine halbe Wandstärke daneben.
 */

/** Eine Wandachse, auf die eine Öffnung gesetzt werden kann. */
export interface Wandachse {
  von: Punkt;
  bis: Punkt;
  staerke: number;
  quelle: 'aussen' | 'raum' | 'innen';
  /** Kennung der Innenwand bzw. des Raums – für die Auswahl. */
  id?: string;
}

/** Was beim Suchen unter dem Mauszeiger herauskommt. */
export interface Wandtreffer {
  /** Der auf die Wandachse gesetzte Punkt. */
  punkt: Punkt;
  /** Richtung der Wand in Grad, immer zwischen -90 und 90. */
  winkel: number;
  staerke: number;
  /** Abstand des angeklickten Punktes zur Achse, in cm. */
  abstand: number;
  quelle: Wandachse['quelle'];
  id?: string;
}

/**
 * Verschiebt eine Umrisskante um eine halbe Wandstärke nach innen.
 *
 * Bei einem im Uhrzeigersinn umlaufenden Umriss zeigt die um 90° gedrehte
 * Kantenrichtung nach innen.
 */
function nachInnen(von: Punkt, bis: Punkt, abstand: number, drehung: number): [Punkt, Punkt] {
  const dx = bis.x - von.x;
  const dy = bis.y - von.y;
  const laenge = Math.hypot(dx, dy) || 1;
  const nx = (-dy / laenge) * abstand * drehung;
  const ny = (dx / laenge) * abstand * drehung;
  return [
    { x: von.x + nx, y: von.y + ny },
    { x: bis.x + nx, y: bis.y + ny },
  ];
}

/** Die Achsen aller Wände eines Umrisses. */
function achsenAusUmriss(
  umriss: Punkt[],
  staerke: number,
  quelle: Wandachse['quelle'],
  id?: string,
): Wandachse[] {
  if (umriss.length < 3 || staerke <= 0) return [];
  const drehung = vorzeichenFlaeche(umriss) >= 0 ? 1 : -1;
  return kanten(umriss).map((kante) => {
    const [von, bis] = nachInnen(kante.von, kante.bis, staerke / 2, drehung);
    return { von, bis, staerke, quelle, id };
  });
}

/** Sammelt alle Wandachsen einer Planung. */
export function alleWandachsen(
  grundflaeche: Grundflaeche,
  raeume: Raum[],
  waende: Wand[],
): Wandachse[] {
  return [
    ...achsenAusUmriss(grundflaeche.umriss, grundflaeche.wandstaerke, 'aussen'),
    ...raeume.flatMap((raum) => achsenAusUmriss(raum.umriss, raum.wandstaerke, 'raum', raum.id)),
    ...waende.map(
      (wand): Wandachse => ({
        von: wand.von,
        bis: wand.bis,
        staerke: wand.staerke,
        quelle: 'innen',
        id: wand.id,
      }),
    ),
  ];
}

/**
 * Setzt einen Punkt senkrecht auf eine Strecke.
 * Liegt der Fußpunkt außerhalb, wird das nähere Ende genommen.
 */
export function aufStrecke(p: Punkt, von: Punkt, bis: Punkt): Punkt {
  const dx = bis.x - von.x;
  const dy = bis.y - von.y;
  const laengeQuadrat = dx * dx + dy * dy;
  if (laengeQuadrat === 0) return { ...von };
  let anteil = ((p.x - von.x) * dx + (p.y - von.y) * dy) / laengeQuadrat;
  anteil = Math.max(0, Math.min(1, anteil));
  return { x: von.x + anteil * dx, y: von.y + anteil * dy };
}

/** Die Richtung einer Wand in Grad, zusammengefasst auf -90 bis 90. */
export function wandwinkel(von: Punkt, bis: Punkt): number {
  const grad = (Math.atan2(bis.y - von.y, bis.x - von.x) * 180) / Math.PI;
  // Eine Wand hat keine Vorder- und Rückseite: 170° und -10° sind dieselbe
  // Richtung. Ohne diese Zusammenfassung stünde jede zweite Tür auf dem Kopf.
  if (grad > 90) return grad - 180;
  if (grad <= -90) return grad + 180;
  return grad;
}

/**
 * Wie weit daneben man klicken darf und trotzdem die Wand trifft, in cm.
 *
 * Gerechnet wird in Bildschirmpunkten, damit sich das Anklicken auf jeder
 * Vergrößerung gleich anfühlt. Die Untergrenze sorgt dafür, dass es auch beim
 * Hineinzoomen noch klappt.
 *
 * Bewusst knapp gehalten: Bei einem weit herausgezoomten Plan sind schon
 * wenige Bildpunkte mehrere Meter, und eine Tür, die zwei Meter weit an eine
 * Wand springt, an die man gar nicht gedacht hat, ist ärgerlicher als eine,
 * die beim ersten Versuch nicht trifft.
 */
export function fangbereich(zoom: number): number {
  return Math.max(25, 14 / zoom);
}

/**
 * Sucht die Wand, die einem Punkt am nächsten liegt.
 *
 * `hoechstAbstand` ist der Fangbereich in cm – er hängt vom Zoom ab, damit
 * sich das Anklicken auf jeder Vergrößerung gleich anfühlt.
 */
export function findeWand(
  p: Punkt,
  achsen: Wandachse[],
  hoechstAbstand: number,
): Wandtreffer | undefined {
  let bester: Wandtreffer | undefined;

  for (const achse of achsen) {
    const fuss = aufStrecke(p, achse.von, achse.bis);
    const abstand = Math.hypot(p.x - fuss.x, p.y - fuss.y);
    if (abstand > hoechstAbstand) continue;
    if (bester && abstand >= bester.abstand) continue;
    bester = {
      punkt: fuss,
      winkel: wandwinkel(achse.von, achse.bis),
      staerke: achse.staerke,
      abstand,
      quelle: achse.quelle,
      id: achse.id,
    };
  }

  return bester;
}

/**
 * Richtet eine gezogene Wand auf waagerecht oder senkrecht aus, wenn sie nah
 * genug dran ist.
 *
 * Innenwände in einem Markt stehen praktisch immer im rechten Winkel. Ohne
 * diese Hilfe bekäme man beim Ziehen mit der Maus eine Wand mit 89,4° – was
 * man erst merkt, wenn nichts mehr bündig anschließt.
 */
export function richteWandAus(von: Punkt, bis: Punkt, toleranzGrad = 8): Punkt {
  const dx = bis.x - von.x;
  const dy = bis.y - von.y;
  if (dx === 0 && dy === 0) return bis;

  const grad = (Math.atan2(dy, dx) * 180) / Math.PI;
  const abweichungWaagerecht = Math.min(Math.abs(grad), Math.abs(Math.abs(grad) - 180));
  const abweichungSenkrecht = Math.abs(Math.abs(grad) - 90);

  if (abweichungWaagerecht <= toleranzGrad) return { x: bis.x, y: von.y };
  if (abweichungSenkrecht <= toleranzGrad) return { x: von.x, y: bis.y };
  return bis;
}

/** Länge einer Wand in cm. */
export function wandlaenge(wand: Wand): number {
  return Math.hypot(wand.bis.x - wand.von.x, wand.bis.y - wand.von.y);
}

/**
 * Die Stärke der Wand, die auf dieser Kante liegt – 0, wenn dort keine ist.
 *
 * Gebraucht für die Kantenmaße abgetrennter Räume. Seit Räume keine eigene
 * Wand mehr zeichnen, zieht der Planer sie selbst, und der Raum weiß nichts
 * davon. Stünde die Zahl trotzdem knapp neben der Raumgrenze, läge sie im
 * Mauerwerk – grau auf grau, und damit weg.
 *
 * Als „auf der Kante" gilt eine Wand, die parallel dazu läuft, deren Achse
 * höchstens eine Wandstärke daneben liegt und die sich mit der Kante der
 * Länge nach überschneidet. Eine Wand, die die Kante nur kreuzt, zählt
 * nicht: Sie steht anderswo im Weg, nicht dort, wo die Zahl hin soll.
 */
export function wandstaerkeAufKante(a: Punkt, b: Punkt, achsen: Wandachse[]): number {
  const laenge = Math.hypot(b.x - a.x, b.y - a.y);
  if (laenge === 0) return 0;
  const ex = (b.x - a.x) / laenge;
  const ey = (b.y - a.y) / laenge;

  /** Abstand quer zur Kante. */
  const quer = (p: Punkt) => Math.abs((p.x - a.x) * ey - (p.y - a.y) * ex);
  /** Lage längs der Kante, von `a` aus gezählt. */
  const laengs = (p: Punkt) => (p.x - a.x) * ex + (p.y - a.y) * ey;

  let staerkste = 0;
  for (const achse of achsen) {
    if (achse.staerke <= 0) continue;
    const wx = achse.bis.x - achse.von.x;
    const wy = achse.bis.y - achse.von.y;
    const wLaenge = Math.hypot(wx, wy);
    if (wLaenge === 0) continue;

    // Parallel? Bei gekreuzten Richtungen ist das Kreuzprodukt groß.
    // 0,09 sind gut fünf Grad – genug für eine von Hand gezogene Wand.
    if (Math.abs((wx * ey - wy * ex) / wLaenge) > 0.09) continue;

    // Nah genug an der Kantenlinie? Eine Wandstärke Abstand ist die Grenze:
    // Der Umriss kann auf der Achse liegen oder auf einer ihrer Seiten.
    if (Math.max(quer(achse.von), quer(achse.bis)) > achse.staerke) continue;

    // Und überschneiden sie sich der Länge nach überhaupt?
    const von = Math.min(laengs(achse.von), laengs(achse.bis));
    const bis = Math.max(laengs(achse.von), laengs(achse.bis));
    if (bis <= 0 || von >= laenge) continue;

    staerkste = Math.max(staerkste, achse.staerke);
  }
  return staerkste;
}

/** Die abgeleiteten Maße einer als Fläche gezeichneten Wand. */
export interface Flaechenwand {
  /** Grundfläche des Wandkörpers in cm². */
  flaeche: number;
  /** Die längste Ausdehnung – die Richtung, in der die Wand läuft. */
  laenge: number;
  /** Fläche geteilt durch Länge: die Dicke im Mittel. */
  dicke: number;
  /** Die abgeleitete Achse, mittig in Laufrichtung. */
  von: Punkt;
  bis: Punkt;
}

/**
 * Rechnet aus einem Wandumriss Länge, Dicke und Achse aus.
 *
 * Eine als Fläche gezeichnete Wand sagt ihre Stärke nicht, sie zeigt sie.
 * Gesucht ist deshalb die Richtung, in der sie **läuft** – und das ist die,
 * quer zu der sie am schmalsten ist. Geprüft werden dafür die Richtungen
 * ihrer eigenen Kanten: Eine Wand ist ein längliches Vieleck, und ihre
 * Laufrichtung steht immer in einer ihrer Kanten.
 *
 * Die Dicke kommt danach aus Fläche geteilt durch Länge, nicht aus dem
 * schmalsten Querschnitt. Bei einem Trapez gibt es keine eine Dicke; der
 * Mittelwert ist die einzige Zahl, die nicht lügt.
 */
export function flaechenwandmasse(umriss: Punkt[]): Flaechenwand | null {
  if (umriss.length < 3) return null;

  // Fläche über die Trapezformel, Vorzeichen weg.
  let doppelt = 0;
  for (let i = 0; i < umriss.length; i++) {
    const a = umriss[i];
    const b = umriss[(i + 1) % umriss.length];
    doppelt += a.x * b.y - b.x * a.y;
  }
  const flaeche = Math.abs(doppelt) / 2;
  if (flaeche <= 0) return null;

  const richtungen: { ex: number; ey: number; laenge: number; breite: number }[] = [];
  for (let i = 0; i < umriss.length; i++) {
    const a = umriss[i];
    const b = umriss[(i + 1) % umriss.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 0.01) continue;
    const ex = (b.x - a.x) / l;
    const ey = (b.y - a.y) / l;

    let laengsMin = Infinity;
    let laengsMax = -Infinity;
    let querMin = Infinity;
    let querMax = -Infinity;
    for (const p of umriss) {
      const laengs = p.x * ex + p.y * ey;
      const quer = -p.x * ey + p.y * ex;
      laengsMin = Math.min(laengsMin, laengs);
      laengsMax = Math.max(laengsMax, laengs);
      querMin = Math.min(querMin, quer);
      querMax = Math.max(querMax, quer);
    }
    richtungen.push({ ex, ey, laenge: laengsMax - laengsMin, breite: querMax - querMin });
  }
  if (richtungen.length === 0) return null;

  // Die schmalste Richtung ist die gesuchte – aber bei einem Trapez liegen
  // mehrere dicht beieinander, und die knapp schmalste ist oft eine, die um
  // ein paar Grad verkantet ist. Sie würde eine Wand, die man sechs Meter
  // lang gezogen hat, als 6,25 m ausweisen.
  //
  // Deshalb zählt nicht die kleinste Breite allein: Unter allen Richtungen,
  // die höchstens zwei Prozent breiter sind als die schmalste, gewinnt die
  // **kürzeste**. Das ist die am wenigsten verkantete, und es ist die, die
  // der Planer gezogen hat.
  const schmalste = Math.min(...richtungen.map((r) => r.breite));
  const beste = richtungen
    .filter((r) => r.breite <= schmalste * 1.02)
    .reduce((a, b) => (b.laenge < a.laenge ? b : a));

  // Die Achse liegt mittig zwischen den beiden Längsseiten.
  const { ex, ey } = beste;
  let laengsMin = Infinity;
  let laengsMax = -Infinity;
  let querMin = Infinity;
  let querMax = -Infinity;
  for (const p of umriss) {
    const laengs = p.x * ex + p.y * ey;
    const quer = -p.x * ey + p.y * ex;
    laengsMin = Math.min(laengsMin, laengs);
    laengsMax = Math.max(laengsMax, laengs);
    querMin = Math.min(querMin, quer);
    querMax = Math.max(querMax, quer);
  }
  const mitte = (querMin + querMax) / 2;
  const punkt = (laengs: number): Punkt => ({
    x: laengs * ex - mitte * ey,
    y: laengs * ey + mitte * ex,
  });

  return {
    flaeche,
    laenge: beste.laenge,
    dicke: flaeche / beste.laenge,
    von: punkt(laengsMin),
    bis: punkt(laengsMax),
  };
}
