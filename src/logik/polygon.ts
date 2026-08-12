// Standard-Import, kein `import * as`: Die Bibliothek hat ausschließlich einen
// Standard-Export. Ein Namensraum-Import läuft in den Prüfungen (Node) noch
// durch, im Browser aber nicht – dort wären `union` und `difference` schlicht
// nicht vorhanden, und das Umformen des Grundrisses täte still gar nichts.
import clipping from 'polygon-clipping';
import type { Punkt } from '../typen/modell';
import type { Rahmen } from './geometrie';

/**
 * Rechnen mit Umrissen.
 *
 * Ein Umriss ist eine Liste von Eckpunkten in cm, im Uhrzeigersinn, ohne
 * Wiederholung des ersten Punktes am Ende. Alles hier ist reines Rechnen ohne
 * Nebenwirkungen und deshalb vollständig geprüft – an dieser Stelle entscheidet
 * sich, ob eine Fläche stimmt, und eine falsche Quadratmeterzahl im Ladenbau
 * ist keine Kleinigkeit.
 *
 * Für das Zusammenfügen und Abziehen von Flächen wird `polygon-clipping`
 * benutzt. Solche Verschneidungen selbst zu schreiben sieht einfach aus, bis
 * zwei Kanten genau aufeinanderliegen oder sich in einem Punkt berühren –
 * dann fängt es an, still falsche Ergebnisse zu liefern.
 */

/** Kleinste sinnvolle Länge in cm. Darunter ist es ein Zeichenfehler. */
const WINZIG = 0.01;

// --------------------------------------------------------------- Erzeugen

/** Ein achsenparalleles Rechteck als Umriss, im Uhrzeigersinn. */
export function rechteck(x: number, y: number, breite: number, laenge: number): Punkt[] {
  return [
    { x, y },
    { x: x + breite, y },
    { x: x + breite, y: y + laenge },
    { x, y: y + laenge },
  ];
}

/** Ein Rechteck aus zwei gegenüberliegenden Ecken – so wird es aufgezogen. */
export function rechteckAusEcken(a: Punkt, b: Punkt): Punkt[] {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return rechteck(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
}

// ----------------------------------------------------------------- Messen

/**
 * Der Flächeninhalt in Quadratzentimetern (Gaußsche Trapezformel).
 *
 * Der Betrag, damit der Umlaufsinn keine Rolle spielt.
 */
export function flaeche(umriss: Punkt[]): number {
  return Math.abs(vorzeichenFlaeche(umriss));
}

/**
 * Die Fläche mit Vorzeichen. Positiv heißt im Uhrzeigersinn – auf dem
 * Bildschirm, wo y nach unten zeigt.
 */
export function vorzeichenFlaeche(umriss: Punkt[]): number {
  let summe = 0;
  for (let i = 0; i < umriss.length; i++) {
    const a = umriss[i];
    const b = umriss[(i + 1) % umriss.length];
    summe += a.x * b.y - b.x * a.y;
  }
  return summe / 2;
}

/** Die Länge des Umrisses in cm. */
export function umfang(umriss: Punkt[]): number {
  let summe = 0;
  for (let i = 0; i < umriss.length; i++) {
    const a = umriss[i];
    const b = umriss[(i + 1) % umriss.length];
    summe += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return summe;
}

/** Die kleinste achsenparallele Umgrenzung. */
export function rahmen(umriss: Punkt[]): Rahmen {
  if (umriss.length === 0) return { links: 0, oben: 0, rechts: 0, unten: 0 };
  return {
    links: Math.min(...umriss.map((p) => p.x)),
    oben: Math.min(...umriss.map((p) => p.y)),
    rechts: Math.max(...umriss.map((p) => p.x)),
    unten: Math.max(...umriss.map((p) => p.y)),
  };
}

/** Breite und Länge der Umgrenzung – für alles, was ein Rechteck erwartet. */
export function aussenmasse(umriss: Punkt[]): { breite: number; laenge: number } {
  const r = rahmen(umriss);
  return { breite: r.rechts - r.links, laenge: r.unten - r.oben };
}

/**
 * Liegt der Punkt innerhalb des Umrisses?
 *
 * Strahlverfahren: Von dem Punkt aus wird waagerecht nach rechts gezählt, wie
 * oft die Umrisslinie überquert wird. Eine ungerade Zahl heißt „drinnen".
 */
export function punktInnerhalb(p: Punkt, umriss: Punkt[]): boolean {
  let drinnen = false;
  for (let i = 0, j = umriss.length - 1; i < umriss.length; j = i++) {
    const a = umriss[i];
    const b = umriss[j];
    const schneidet =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (schneidet) drinnen = !drinnen;
  }
  return drinnen;
}

// ------------------------------------------------------------------ Kanten

/** Eine Wandkante des Umrisses. */
export interface Kante {
  /** Nummer des Anfangspunktes im Umriss. */
  index: number;
  von: Punkt;
  bis: Punkt;
  laenge: number;
  /** Achsenparallele Kanten lassen sich am einfachsten bemaßen und verschieben. */
  richtung: 'waagerecht' | 'senkrecht' | 'schraeg';
}

export function kanten(umriss: Punkt[]): Kante[] {
  return umriss.map((von, index) => {
    const bis = umriss[(index + 1) % umriss.length];
    const dx = Math.abs(bis.x - von.x);
    const dy = Math.abs(bis.y - von.y);
    return {
      index,
      von,
      bis,
      laenge: Math.hypot(bis.x - von.x, bis.y - von.y),
      richtung: dy < WINZIG ? 'waagerecht' : dx < WINZIG ? 'senkrecht' : 'schraeg',
    };
  });
}

/**
 * Ist der Umriss ein einfaches achsenparalleles Rechteck?
 *
 * Der häufigste Fall, und dann darf man Breite und Länge auch weiterhin als
 * zwei Zahlen eintippen, statt Ecken zu ziehen. Sobald die Form komplizierter
 * wird, ergäbe das keinen Sinn mehr.
 */
export function istRechteck(umriss: Punkt[]): boolean {
  return umriss.length === 4 && kanten(umriss).every((k) => k.richtung !== 'schraeg');
}

/** Der Mittelpunkt einer Kante – dort steht die Maßzahl. */
export function kantenMitte(kante: Kante): Punkt {
  return { x: (kante.von.x + kante.bis.x) / 2, y: (kante.von.y + kante.bis.y) / 2 };
}

/**
 * Ein Punkt, der ein Stück weit außerhalb der Kante liegt.
 *
 * Damit die Maßzahl neben der Wand steht und nicht darauf. Welche Seite außen
 * ist, ergibt sich aus dem Umlaufsinn: Bei einem im Uhrzeigersinn umlaufenden
 * Umriss zeigt die nach links gedrehte Kantenrichtung nach außen.
 */
export function kantenVersatz(kante: Kante, abstand: number, umriss: Punkt[]): Punkt {
  const mitte = kantenMitte(kante);
  const dx = kante.bis.x - kante.von.x;
  const dy = kante.bis.y - kante.von.y;
  const laenge = Math.hypot(dx, dy) || 1;
  const richtung = vorzeichenFlaeche(umriss) >= 0 ? 1 : -1;
  return {
    x: mitte.x + (dy / laenge) * abstand * richtung,
    y: mitte.y - (dx / laenge) * abstand * richtung,
  };
}

/**
 * Wo trifft ein waagerechter oder senkrechter Strahl auf die Umrisslinie?
 *
 * Gebraucht für die Abstandsmaße beim Verschieben: Ein Regal soll seinen
 * Abstand zu der Wand anzeigen, die ihm tatsächlich gegenüberliegt – bei einer
 * L-Form ist das nicht die äußere Umgrenzung.
 *
 * Gibt die Koordinate der Wand zurück, oder `undefined`, wenn der Strahl den
 * Umriss nicht trifft.
 */
export function strahlAufUmriss(
  start: Punkt,
  richtung: 'links' | 'rechts' | 'oben' | 'unten',
  umriss: Punkt[],
): number | undefined {
  const waagerecht = richtung === 'links' || richtung === 'rechts';
  const treffer: number[] = [];

  for (const kante of kanten(umriss)) {
    const { von, bis } = kante;
    if (waagerecht) {
      // Kante muss die Höhe des Strahls überspannen.
      if (von.y > start.y !== bis.y > start.y) {
        const anteil = (start.y - von.y) / (bis.y - von.y);
        treffer.push(von.x + anteil * (bis.x - von.x));
      }
    } else if (von.x > start.x !== bis.x > start.x) {
      const anteil = (start.x - von.x) / (bis.x - von.x);
      treffer.push(von.y + anteil * (bis.y - von.y));
    }
  }

  const hier = waagerecht ? start.x : start.y;
  const vorwaerts = richtung === 'rechts' || richtung === 'unten';
  const passend = treffer.filter((t) => (vorwaerts ? t > hier : t < hier));
  if (passend.length === 0) return undefined;
  return vorwaerts ? Math.min(...passend) : Math.max(...passend);
}

/**
 * Die Kanten, an denen ein Element einrasten soll: die Außenkante der Wand und
 * ihre Innenkante. Nur achsenparallele Kanten – an einer schrägen Wand kann
 * ein rechteckiges Regal ohnehin nicht bündig anliegen.
 */
export interface Wandlinie {
  achse: 'x' | 'y';
  wert: number;
  von: number;
  bis: number;
}

export function wandlinien(umriss: Punkt[], wandstaerke: number): Wandlinie[] {
  const linien: Wandlinie[] = [];
  // Bei einem im Uhrzeigersinn umlaufenden Umriss zeigt die um 90° gedrehte
  // Kantenrichtung nach innen.
  const drehung = vorzeichenFlaeche(umriss) >= 0 ? 1 : -1;

  for (const kante of kanten(umriss)) {
    if (kante.richtung === 'schraeg' || kante.laenge < WINZIG) continue;
    const dx = kante.bis.x - kante.von.x;
    const dy = kante.bis.y - kante.von.y;

    if (kante.richtung === 'waagerecht') {
      const nachInnen = Math.sign(dx) * drehung; // +1 = nach unten
      const von = Math.min(kante.von.x, kante.bis.x);
      const bis = Math.max(kante.von.x, kante.bis.x);
      linien.push({ achse: 'y', wert: kante.von.y, von, bis });
      linien.push({ achse: 'y', wert: kante.von.y + nachInnen * wandstaerke, von, bis });
    } else {
      const nachInnen = -Math.sign(dy) * drehung; // +1 = nach rechts
      const von = Math.min(kante.von.y, kante.bis.y);
      const bis = Math.max(kante.von.y, kante.bis.y);
      linien.push({ achse: 'x', wert: kante.von.x, von, bis });
      linien.push({ achse: 'x', wert: kante.von.x + nachInnen * wandstaerke, von, bis });
    }
  }
  return linien;
}

// ----------------------------------------------------------------- Ordnen

/** Dreht den Umriss so, dass er im Uhrzeigersinn läuft. */
export function imUhrzeigersinn(umriss: Punkt[]): Punkt[] {
  return vorzeichenFlaeche(umriss) >= 0 ? umriss : [...umriss].reverse();
}

/** Verschiebt einen ganzen Umriss. */
export function verschiebe(umriss: Punkt[], dx: number, dy: number): Punkt[] {
  return umriss.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/**
 * Räumt einen Umriss auf: doppelte Punkte weg, Punkte mitten auf einer
 * geraden Kante weg.
 *
 * Nötig, weil beim Verschneiden regelmäßig überflüssige Punkte entstehen –
 * jeder davon wäre später ein Anfasser zum Ziehen, den niemand haben will.
 */
export function vereinfache(umriss: Punkt[], toleranz = 0.05): Punkt[] {
  // 1. Aufeinanderfolgende Punkte am selben Ort zusammenfassen.
  const ohneDoppelte: Punkt[] = [];
  for (const p of umriss) {
    const letzter = ohneDoppelte[ohneDoppelte.length - 1];
    if (!letzter || Math.hypot(p.x - letzter.x, p.y - letzter.y) > toleranz) ohneDoppelte.push(p);
  }
  while (
    ohneDoppelte.length > 1 &&
    Math.hypot(
      ohneDoppelte[0].x - ohneDoppelte[ohneDoppelte.length - 1].x,
      ohneDoppelte[0].y - ohneDoppelte[ohneDoppelte.length - 1].y,
    ) <= toleranz
  ) {
    ohneDoppelte.pop();
  }
  if (ohneDoppelte.length < 3) return ohneDoppelte;

  // 2. Punkte entfernen, die auf der Verbindung ihrer Nachbarn liegen.
  const ergebnis: Punkt[] = [];
  for (let i = 0; i < ohneDoppelte.length; i++) {
    const vorher = ohneDoppelte[(i - 1 + ohneDoppelte.length) % ohneDoppelte.length];
    const hier = ohneDoppelte[i];
    const nachher = ohneDoppelte[(i + 1) % ohneDoppelte.length];
    // Kreuzprodukt: Wie weit weicht der Punkt von der Geraden ab?
    const abweichung = Math.abs(
      (hier.x - vorher.x) * (nachher.y - vorher.y) - (hier.y - vorher.y) * (nachher.x - vorher.x),
    );
    const spannweite = Math.hypot(nachher.x - vorher.x, nachher.y - vorher.y) || 1;
    if (abweichung / spannweite > toleranz) ergebnis.push(hier);
  }
  return ergebnis.length >= 3 ? ergebnis : ohneDoppelte;
}

/** Rundet alle Punkte auf halbe Zentimeter – so bleiben die Zahlen lesbar. */
export function runde(umriss: Punkt[]): Punkt[] {
  return umriss.map((p) => ({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 }));
}

// ------------------------------------------------------- Zusammenfügen

/** Ergebnis einer Verschneidung. */
export interface Verschneidung {
  /** Der neue Umriss. Leer, wenn nichts übrig bleibt. */
  umriss: Punkt[];
  /**
   * Was dabei unter den Tisch fiel – oder `undefined`, wenn alles glattging.
   * Die Oberfläche zeigt diesen Satz an, statt still etwas wegzuwerfen.
   */
  hinweis?: string;
}

type Paar = [number, number];

function nachClipping(umriss: Punkt[]): Paar[][] {
  return [umriss.map((p): Paar => [p.x, p.y])];
}

function vonClipping(ring: readonly (readonly number[])[]): Punkt[] {
  // Clipping gibt geschlossene Ringe zurück (letzter Punkt = erster).
  const punkte = ring.map((paar) => ({ x: paar[0], y: paar[1] }));
  if (punkte.length > 1) {
    const erster = punkte[0];
    const letzter = punkte[punkte.length - 1];
    if (erster.x === letzter.x && erster.y === letzter.y) punkte.pop();
  }
  return punkte;
}

/**
 * Sucht aus dem Ergebnis einer Verschneidung den brauchbaren Umriss heraus.
 *
 * Verschneidungen können in mehrere Teile zerfallen oder Löcher bekommen.
 * Beides kann dieses Modell nicht abbilden – deshalb wird der größte Teil
 * genommen und gesagt, was fehlt, statt es zu verschweigen.
 */
function besterUmriss(ergebnis: readonly (readonly (readonly number[])[])[][]): Verschneidung {
  const teile = ergebnis.map((poly) => ({
    aussen: vonClipping(poly[0] ?? []),
    loecher: poly.length - 1,
  }));
  const brauchbar = teile.filter((t) => t.aussen.length >= 3);
  if (brauchbar.length === 0) return { umriss: [] };

  brauchbar.sort((a, b) => flaeche(b.aussen) - flaeche(a.aussen));
  const groesster = brauchbar[0];

  const hinweise: string[] = [];
  if (brauchbar.length > 1) {
    hinweise.push(
      `Die Fläche wäre in ${brauchbar.length} getrennte Teile zerfallen. Übernommen wurde der größte.`,
    );
  }
  if (groesster.loecher > 0) {
    hinweise.push(
      'Mitten in der Fläche wäre eine Aussparung entstanden. Der Grundriss kann keine Löcher – für ausgesparte Bereiche bitte einen Raum anlegen.',
    );
  }

  return {
    umriss: runde(vereinfache(imUhrzeigersinn(groesster.aussen))),
    hinweis: hinweise.length > 0 ? hinweise.join(' ') : undefined,
  };
}

/** Fügt eine Fläche an den Umriss an. */
export function vereinige(umriss: Punkt[], zusatz: Punkt[]): Verschneidung {
  if (umriss.length < 3) return { umriss: runde(imUhrzeigersinn(zusatz)) };
  return besterUmriss(clipping.union(nachClipping(umriss), nachClipping(zusatz)));
}

/** Schneidet eine Fläche aus dem Umriss heraus. */
export function ziehAb(umriss: Punkt[], abzug: Punkt[]): Verschneidung {
  if (umriss.length < 3) return { umriss: [] };
  const ergebnis = besterUmriss(clipping.difference(nachClipping(umriss), nachClipping(abzug)));
  if (ergebnis.umriss.length === 0) {
    return {
      umriss: [],
      hinweis: 'Damit wäre von der Grundfläche nichts übrig geblieben.',
    };
  }
  return ergebnis;
}
