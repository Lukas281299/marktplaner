import type { Punkt } from '../../typen/modell';

/**
 * Die Bauteile der 3D-Ansicht.
 *
 * Ein Möbel wird nicht als Klotz gezeigt, sondern aus wenigen einfachen
 * Teilen zusammengesetzt: Säulen, Böden, Rückwand, Sockel, Glas, Kisten.
 * Diese Teile sind **reine Daten** – Lage, Maß, Material –, ohne eine Zeile
 * three.js. Das hat zwei Gründe:
 *
 *  1. Die Rezepte lassen sich prüfen, ohne WebGL zu starten: Wie viele Böden
 *     hat ein Regal mit fünf Böden? Wie hoch ist die Truhe? Das ist Rechnen,
 *     kein Zeichnen.
 *  2. Der Renderer bleibt dumm. Er kennt vier Formen und ein Dutzend
 *     Materialien und muss nichts über Wanzl wissen.
 *
 * **Koordinaten eines Möbels:** `x` läuft von links nach rechts über die
 * Breite (0 … breite), `y` von hinten nach vorn über die Tiefe (0 … tiefe;
 * `y = tiefe` ist die Front, die im Plan unten liegt), `z` ist die Höhe über
 * dem Fußboden. Alles in Zentimetern. Die Szene stellt das Möbel dann an
 * seinen Ort im Markt und dreht es – das Rezept muss davon nichts wissen.
 *
 * `x`, `y`, `z` eines Quaders sind die **Ecke hinten links unten**, nicht die
 * Mitte: Ein Sockel „steht bei 0 und ist 20 hoch" schreibt sich so, wie man
 * es sagt.
 */

/** Welches Material ein Teil hat – die Palette steht in `material.ts`. */
export type Materialname =
  | 'regal' // Regalblech pulverbeschichtet, hell
  | 'regalDunkel' // Anthrazit / Schwarz Metallic
  | 'gitter' // Drahtgitter, Rückwand
  | 'draht' // Drahtetage
  | 'chrom' // Führungsrohr, Frontgitter
  | 'edelstahl'
  | 'schwarz'
  | 'anthrazit' // Tiefkühl- und Kühlmöbel außen
  | 'weiss' // Innenräume von Kühlmöbeln
  | 'hellgrau'
  | 'glas'
  | 'holzHell'
  | 'holzDunkel'
  | 'preisschiene'
  | 'kiste' // grüne ifko-Kiste
  | 'kisteRot' // Getränkekasten
  | 'palette'
  | 'pflanze'
  | 'blume'
  | 'wand'
  | 'boden'
  | 'bodenLager'
  | 'markierung'
  | 'ware' // neutrale Ware im Regal
  | 'kategorie'; // wird je Element durch die Kategoriefarbe ersetzt

interface Grundteil {
  material: Materialname;
  /** Eine eigene Farbe, die das Material überstimmt – für Kategoriefarben. */
  farbe?: string;
}

/**
 * Ein Quader – das Brot und Butter.
 *
 * `neigung` kippt ihn um seine **hintere untere Kante** (die Achse entlang
 * `x`): positiv heißt, die Vorderkante sinkt. Eine Vitable-Auflage fällt so
 * um 25° nach vorn, eine Glasfront lehnt sich mit negativem Winkel nach
 * hinten.
 */
export interface Quader extends Grundteil {
  art: 'quader';
  x: number;
  y: number;
  z: number;
  /** Breite entlang `x`. */
  b: number;
  /** Tiefe entlang `y`. */
  t: number;
  /** Höhe entlang `z`. */
  h: number;
  neigung?: number;
  /**
   * Gespiegelt: Die Neigung kippt um die **vordere** untere Kante, und
   * positiv heißt, die Hinterkante sinkt. So wird aus dem Rezept einer
   * Vorderseite das der Rückseite – siehe `spiegele`.
   */
  gespiegelt?: boolean;
}

/**
 * Ein Zylinder – Säulen, Rohre, Töpfe, Griffe.
 *
 * `achse` sagt, wohin er zeigt. `x`, `y`, `z` sind der **Anfang** der Achse,
 * `laenge` reicht von dort in Achsenrichtung.
 */
export interface Zylinder extends Grundteil {
  art: 'zylinder';
  x: number;
  y: number;
  z: number;
  radius: number;
  laenge: number;
  achse: 'x' | 'y' | 'z';
}

/**
 * Ein Prisma – ein Polygon in der Fläche, nach oben gezogen.
 *
 * Für alles, was kein Rechteck ist: die Kopfgondel rund, das Vitable-Eck,
 * ein frei geformter Umriss, ein Wandkörper aus einem eingelesenen Plan.
 * `punkte` liegen in `x`/`y` des Möbels, `z` ist die Unterkante.
 */
export interface Prisma extends Grundteil {
  art: 'prisma';
  punkte: Punkt[];
  z: number;
  h: number;
}

/** Eine Kugel – Pflanzenkronen, Blüten. */
export interface Kugel extends Grundteil {
  art: 'kugel';
  x: number;
  y: number;
  z: number;
  radius: number;
}

export type Bauteil = Quader | Zylinder | Prisma | Kugel;

// ------------------------------------------------------------ Kurzschreibweisen

/** Ein Quader mit Ecke hinten links unten. */
export function quader(
  x: number,
  y: number,
  z: number,
  b: number,
  t: number,
  h: number,
  material: Materialname,
  weiteres: Partial<Pick<Quader, 'neigung' | 'farbe' | 'gespiegelt'>> = {},
): Quader {
  return { art: 'quader', x, y, z, b, t, h, material, ...weiteres };
}

/**
 * Spiegelt Bauteile an der Mitte eines Möbels der Tiefe `tiefe`.
 *
 * Eine Gondel ist ihre Vorderseite noch einmal, rückwärts. Statt jedes
 * Rezept zweimal zu schreiben, wird die eine Seite gebaut und dann
 * gespiegelt: `y` läuft von der anderen Kante, geneigte Teile kippen um die
 * andere Kante, Polygone laufen andersherum, damit ihre Fläche nach oben
 * zeigt.
 */
export function spiegele(teile: Bauteil[], tiefe: number): Bauteil[] {
  return teile.map((teil): Bauteil => {
    switch (teil.art) {
      case 'quader':
        return { ...teil, y: tiefe - teil.y - teil.t, gespiegelt: !teil.gespiegelt };
      case 'zylinder':
        return {
          ...teil,
          y: teil.achse === 'y' ? tiefe - teil.y - teil.laenge : tiefe - teil.y,
        };
      case 'prisma':
        return {
          ...teil,
          punkte: [...teil.punkte].reverse().map((p) => ({ x: p.x, y: tiefe - p.y })),
        };
      case 'kugel':
        return { ...teil, y: tiefe - teil.y };
    }
  });
}

/**
 * Eine waagerechte Platte – ein Boden, ein Deckel, eine Auflage.
 *
 * Dasselbe wie ein Quader; der Name sagt, was gemeint ist.
 */
export function platte(
  x: number,
  y: number,
  z: number,
  b: number,
  t: number,
  material: Materialname,
  staerke = 2,
  weiteres: Partial<Pick<Quader, 'neigung' | 'farbe'>> = {},
): Quader {
  return quader(x, y, z, b, t, staerke, material, weiteres);
}

/** Eine senkrechte Platte quer zur Tiefe – Rückwand, Front, Glasscheibe. */
export function wandplatte(
  x: number,
  y: number,
  z: number,
  b: number,
  h: number,
  material: Materialname,
  staerke = 1,
  weiteres: Partial<Pick<Quader, 'neigung' | 'farbe'>> = {},
): Quader {
  return quader(x, y, z, b, staerke, h, material, weiteres);
}

/** Eine senkrechte Platte quer zur Breite – Seitenwand, Trennwand. */
export function seitenplatte(
  x: number,
  y: number,
  z: number,
  t: number,
  h: number,
  material: Materialname,
  staerke = 1,
): Quader {
  return quader(x, y, z, staerke, t, h, material);
}

export function zylinder(
  x: number,
  y: number,
  z: number,
  radius: number,
  laenge: number,
  achse: Zylinder['achse'],
  material: Materialname,
  farbe?: string,
): Zylinder {
  return { art: 'zylinder', x, y, z, radius, laenge, achse, material, ...(farbe ? { farbe } : {}) };
}

/** Eine stehende Säule. */
export function saeule(x: number, y: number, radius: number, h: number, material: Materialname): Zylinder {
  return zylinder(x, y, 0, radius, h, 'z', material);
}

export function prisma(
  punkte: Punkt[],
  z: number,
  h: number,
  material: Materialname,
  farbe?: string,
): Prisma {
  return { art: 'prisma', punkte, z, h, material, ...(farbe ? { farbe } : {}) };
}

export function kugel(
  x: number,
  y: number,
  z: number,
  radius: number,
  material: Materialname,
  farbe?: string,
): Kugel {
  return { art: 'kugel', x, y, z, radius, material, ...(farbe ? { farbe } : {}) };
}

// ------------------------------------------------------------------ Formen

/**
 * Die Punkte einer Halbellipse: gerade Seite hinten (`y = 0`), Bogen nach
 * vorn bis `y = tiefe`. Für Kopfgondeln und runde Abschlüsse.
 */
export function halbellipse(breite: number, tiefe: number, schritte = 24): Punkt[] {
  const punkte: Punkt[] = [];
  for (let i = 0; i <= schritte; i++) {
    const w = Math.PI - (Math.PI * i) / schritte; // von links (180°) nach rechts (0°)
    punkte.push({ x: breite / 2 + (breite / 2) * Math.cos(w), y: tiefe * Math.sin(w) });
  }
  return punkte;
}

/**
 * Eine Halbellipse, um `rand` nach innen verkleinert – für die Böden einer
 * Kopfgondel, die nach oben kleiner werden.
 */
export function halbellipseInnen(breite: number, tiefe: number, rand: number, schritte = 24): Punkt[] {
  const b = Math.max(2, breite - 2 * rand);
  const t = Math.max(2, tiefe - rand);
  return halbellipse(b, t, schritte).map((p) => ({ x: p.x + rand, y: p.y }));
}

/**
 * Die Ecken eines Viertelkreises mit Mittelpunkt hinten links (`0/0`):
 * gerade Seiten links und hinten, Bogen vorn rechts.
 */
export function viertelkreis(radius: number, schritte = 16): Punkt[] {
  const punkte: Punkt[] = [{ x: 0, y: 0 }];
  for (let i = 0; i <= schritte; i++) {
    const w = (Math.PI / 2) * (1 - i / schritte); // von oben (90°) nach rechts (0°)
    punkte.push({ x: radius * Math.cos(w), y: radius * Math.sin(w) });
  }
  return punkte;
}

/** Das Rechteck eines Möbels – als Polygon, für Prismen. */
export function rechteck(breite: number, tiefe: number): Punkt[] {
  return [
    { x: 0, y: 0 },
    { x: breite, y: 0 },
    { x: breite, y: tiefe },
    { x: 0, y: tiefe },
  ];
}

/**
 * Ein Trapez: hinten schmal, vorn breit – das Vitable-Inneneck.
 *
 * `anteil` sagt, wie breit die Rückkante im Verhältnis zur Front ist.
 */
export function trapez(breite: number, tiefe: number, anteilHinten: number): Punkt[] {
  const einzug = (breite * (1 - anteilHinten)) / 2;
  return [
    { x: einzug, y: 0 },
    { x: breite - einzug, y: 0 },
    { x: breite, y: tiefe },
    { x: 0, y: tiefe },
  ];
}

/** Verkleinert ein Polygon um `rand` zur Mitte hin – grob, aber für Böden genug. */
export function nachInnen(punkte: Punkt[], rand: number): Punkt[] {
  if (punkte.length === 0) return punkte;
  const mx = punkte.reduce((s, p) => s + p.x, 0) / punkte.length;
  const my = punkte.reduce((s, p) => s + p.y, 0) / punkte.length;
  return punkte.map((p) => {
    const dx = p.x - mx;
    const dy = p.y - my;
    const l = Math.hypot(dx, dy) || 1;
    const f = Math.max(0, l - rand) / l;
    return { x: mx + dx * f, y: my + dy * f };
  });
}

// ------------------------------------------------------------ Hilfsrechnung

/** Ordnet Böden gleichmäßig zwischen zwei Höhen an; gibt die Unterkanten. */
export function verteileHoehen(von: number, bis: number, anzahl: number): number[] {
  if (anzahl <= 0 || bis <= von) return [];
  const schritt = (bis - von) / anzahl;
  return Array.from({ length: anzahl }, (_, i) => von + schritt * (i + 1));
}

/** Rundet auf einen Zehntelzentimeter – die Rezepte rechnen mit Brüchen. */
export function r(wert: number): number {
  return Math.round(wert * 10) / 10;
}
