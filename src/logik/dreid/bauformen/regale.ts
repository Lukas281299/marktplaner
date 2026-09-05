import { felderVon } from '../../regalseiten';
import {
  halbellipse,
  halbellipseInnen,
  platte,
  prisma,
  quader,
  spiegele,
  verteileHoehen,
  wandplatte,
  zylinder,
  type Bauteil,
} from '../bauteile';
import { hoeheVon } from '../moebel';
import type { PlanElement, Regalfeld } from '../../../typen/modell';

/**
 * Regale – Wanzl wire tech 100, aus dem Workbook Version 77 (12/2025).
 *
 * Was man sieht, von unten nach oben: Stellfüße unter einem flachen
 * **Fußrohr** (100 × 30 mm) je Säule, das von der Säule nach vorn bis zur
 * Nenntiefe reicht. An jeder Feldgrenze eine **Säule** 100 × 30 mm, ein Zug
 * mit n Feldern hat n + 1. Zwischen den Säulen hängt mittig die
 * **Gitter-Rückwand** (Maschen 100 × 50), vom Sockel bis zur Säulenoberkante.
 * Auf den Füßen liegt der **Grundboden** (Sockel-Blechetage), davor die
 * **Sockelblende** (ca. 10 hoch) und – wenn bestellt – das verzinkte
 * **Führungsrohr** (Ø 27 mm) ein paar Zentimeter vor der Front. Darüber die
 * **Drahtetagen** auf Konsolen, 5–6 Stück, nach oben flacher, jede vorn mit
 * einer transparenten Preisschiene (30–40 mm).
 *
 * Maße, die der Katalog nicht hergibt und die hier geschätzt sind: die
 * Oberkante des Grundbodens (ca. 12 cm) und die Dicke einer Drahtetage
 * samt Konsole (ca. 2,5 cm). Beides steht im Workbook nicht bemaßt.
 *
 * Die **Gondel** ist das Wandregal an der Rückwand gespiegelt: Säule und
 * Gitter in der Mitte, auf jeder Seite ein eigener Grundboden, eigene Etagen,
 * eigene Blende und eigenes Rohr. Genau so wird sie hier gebaut – eine Seite
 * als Rezept, die andere als Spiegelbild.
 */

/** Säule 100 × 30 mm – im Plan 10 tief, 3 breit. */
const SAEULE_T = 10;
const SAEULE_B = 3;
/** Fußrohr 100 mm hoch. */
const FUSS_H = 10;
/** Oberkante des Grundbodens über dem Fußboden – geschätzt, nicht bemaßt. */
const SOCKEL = 12;
/** Drahtetage mit Konsole. */
const ETAGE = 2.5;
/** Preisschiene an der Vorderkante. */
const PREISSCHIENE = 3.5;
/** Die tote Zone hinter dem Grundboden, wie sie das Programm rechnet. */
const TOTE_ZONE = 7;
/** Wie weit das Führungsrohr vor der Front läuft – wie im Grundriss. */
const ROHR_ABSTAND = 4;
const ROHR_RADIUS = 1.35;
/** Wie viele Böden ein Feld hat, wenn niemand etwas eingetragen hat. */
const ERSATZ_BOEDEN = 5;

/** Die Feldgrenzen als x-Werte, von 0 an. */
function grenzen(felder: Regalfeld[]): number[] {
  const aus = [0];
  let x = 0;
  for (const feld of felder) {
    x += feld.breite;
    aus.push(x);
  }
  return aus;
}

/**
 * Eine Regalseite: Grundboden, Blende, Rohr und Etagen für alle Felder.
 *
 * Die Säule steht hinten bei `y = 0 … SAEULE_T`, der Grundboden reicht bis
 * zur Front bei `y = tiefe`. Säulen und Rückwand baut der Aufrufer – bei
 * der Gondel gibt es sie nur einmal in der Mitte.
 */
function regalseite(
  felder: Regalfeld[],
  tiefe: number,
  grundbodenTiefe: number,
  hoehe: number,
  fuehrungsrohr: boolean,
): Bauteil[] {
  const teile: Bauteil[] = [];
  const kanten = grenzen(felder);
  const gesamt = kanten[kanten.length - 1];
  if (gesamt <= 0) return teile;

  const T = Math.max(20, Math.min(grundbodenTiefe, tiefe - 2));
  const front = tiefe;

  // Füße: an jeder Feldgrenze, von der Säule bis zur Front.
  for (const x of kanten) {
    teile.push(quader(x - SAEULE_B / 2, 0, 0, SAEULE_B, front, FUSS_H, 'regal'));
  }

  felder.forEach((feld, i) => {
    if (feld.leer) return;
    const x0 = kanten[i];
    const b = feld.breite;

    // Grundboden und Sockelblende.
    teile.push(platte(x0, front - T, SOCKEL - 2, b, T, 'regal', 2));
    teile.push(quader(x0, front - 1.5, 1.5, b, 1, SOCKEL - 3, 'regal'));

    // Etagen: nach oben flacher, die oberste bleibt eine gute Handbreit
    // unter der Säulenoberkante.
    const n = feld.boeden ?? ERSATZ_BOEDEN;
    if (n <= 0) return;
    const hoehen = verteileHoehen(SOCKEL, hoehe - 20, n);
    const unten = Math.max(20, T - 10);
    const oben = Math.max(20, Math.min(30, unten));
    hoehen.forEach((z, k) => {
      const anteil = n > 1 ? k / (n - 1) : 0;
      const d = Math.round(unten - (unten - oben) * anteil);
      teile.push(platte(x0, front - d, z, b, d, 'draht', ETAGE));
      teile.push(quader(x0, front - 0.6, z, b, 0.6, PREISSCHIENE, 'preisschiene'));
      // Konsolen unter der Etage, keilförmig – hier ein kurzer Klotz an der Säule.
      teile.push(quader(x0 + 0.5, front - d, z - 4, 2, Math.min(15, d), 4, 'regal'));
      teile.push(quader(x0 + b - 2.5, front - d, z - 4, 2, Math.min(15, d), 4, 'regal'));
    });
  });

  if (fuehrungsrohr) {
    teile.push(zylinder(0, front + ROHR_ABSTAND, FUSS_H - 1, ROHR_RADIUS, gesamt, 'x', 'chrom'));
  }
  return teile;
}

/** Säulen und Gitter-Rückwand an einer Linie `y`. */
function saeulenreihe(felder: Regalfeld[], y: number, hoehe: number): Bauteil[] {
  const teile: Bauteil[] = [];
  const kanten = grenzen(felder);
  const gesamt = kanten[kanten.length - 1];
  for (const x of kanten) {
    teile.push(quader(x - SAEULE_B / 2, y, 0, SAEULE_B, SAEULE_T, hoehe, 'regal'));
    // Die Kappe oben – schwarz, wie im Katalog.
    teile.push(quader(x - SAEULE_B / 2, y, hoehe, SAEULE_B, SAEULE_T, 1, 'schwarz'));
  }
  teile.push(wandplatte(0, y + SAEULE_T / 2 - 0.4, SOCKEL, gesamt, hoehe - SOCKEL, 'gitter', 0.8));
  return teile;
}

/** Wandregal: Säulen hinten, eine Seite nach vorn. */
function wandregal(element: PlanElement): Bauteil[] {
  const felder = felderVon(element, 'unten');
  const hoehe = hoeheVon(element);
  const grundboden = element.grundboden ?? element.tiefe - TOTE_ZONE;
  return [
    ...saeulenreihe(felder, 0, hoehe),
    ...regalseite(felder, element.tiefe, grundboden, hoehe, Boolean(element.fuehrungsrohr)),
  ];
}

/**
 * Gondel: Säulen in der Mitte, zwei Seiten.
 *
 * Die Vorderseite (`unten`) läuft von der Mitte zur Front, die Rückseite
 * (`oben`) ist ihr Spiegelbild – mit ihren eigenen Feldern, wenn sie welche
 * hat.
 */
function gondel(element: PlanElement): Bauteil[] {
  const hoehe = hoeheVon(element);
  const mitte = element.tiefe / 2;
  const seitentiefe = mitte;
  const grundboden = element.grundboden ?? (element.tiefe - TOTE_ZONE) / 2;
  const vorn = felderVon(element, 'unten');
  const hinten = felderVon(element, 'oben');
  const rohr = Boolean(element.fuehrungsrohr);

  // Jede Seite wird so gebaut, als stünde die Säule bei y = 0 und die Front
  // bei y = seitentiefe – dann um die Mitte verschoben bzw. gespiegelt.
  const vorderseite = regalseite(vorn, seitentiefe, grundboden, hoehe, rohr).map((teil) =>
    verschiebeY(teil, mitte),
  );
  const rueckseite = spiegele(
    regalseite(hinten, seitentiefe, grundboden, hoehe, rohr).map((teil) => verschiebeY(teil, mitte)),
    element.tiefe,
  );
  return [...saeulenreihe(vorn, mitte - SAEULE_T / 2, hoehe), ...vorderseite, ...rueckseite];
}

function verschiebeY(teil: Bauteil, dy: number): Bauteil {
  if (teil.art === 'prisma') return { ...teil, punkte: teil.punkte.map((p) => ({ x: p.x, y: p.y + dy })) };
  return { ...teil, y: teil.y + dy };
}

/**
 * Die Kopfgondel rund – ein Halbkreis am Ende des Zugs.
 *
 * Sie hat keine eigenen Säulen: Sie hängt an den Endsäulen des Zugs. Unten
 * das Sockelblech als Halbkreis mit eigener Blende, darüber 4–5 halbrunde
 * Drahtetagen mit radialen Drähten, nach oben kleiner. Die gerade Seite liegt
 * am Zug (hinten, `y = 0`), der Bogen zeigt in den Gang.
 */
function kopfgondelRund(element: PlanElement): Bauteil[] {
  const hoehe = hoeheVon(element);
  const b = element.breite;
  const t = element.tiefe - 3;
  const teile: Bauteil[] = [];
  teile.push(prisma(halbellipseInnen(b, t, 1.5), 1.5, SOCKEL - 1.5, 'regal'));
  teile.push(prisma(halbellipse(b, t), SOCKEL - 2, 2, 'regal'));

  const n = felderVon(element, 'unten')[0]?.boeden ?? 4;
  const hoehen = verteileHoehen(SOCKEL, hoehe - 20, n);
  hoehen.forEach((z, k) => {
    const rand = 6 + 7 * k;
    teile.push(prisma(halbellipseInnen(b, t, rand), z, ETAGE, 'draht'));
  });

  if (element.fuehrungsrohr) {
    // Das gebogene Rohr – angenähert durch ein flaches Band knapp vor dem Bogen.
    teile.push(prisma(halbellipse(b + 2 * ROHR_ABSTAND, t + ROHR_ABSTAND).map((p) => ({ x: p.x - ROHR_ABSTAND, y: p.y })), FUSS_H - 2, 2.5, 'chrom'));
  }
  return teile;
}

/**
 * Das Eckfeld: kein Möbel, sondern die Lücke, wo zwei Züge über Eck stoßen.
 *
 * wire tech 100 hat kein Eckbauteil (Workbook, Verzeichnis S. 116–117). In
 * der Praxis bleibt hinten ein Quadrat leer oder wird unten verblendet – hier
 * ein Sockelblech in Regalfarbe, darüber Luft.
 */
function eckfeld(element: PlanElement): Bauteil[] {
  return [quader(0, 0, 0, element.breite, element.tiefe, SOCKEL, 'regal')];
}

export function regalBauteile(element: PlanElement): Bauteil[] {
  switch (element.form) {
    case 'wt100Rund':
      return kopfgondelRund(element);
    case 'wt100Eck':
      return eckfeld(element);
    default:
      return element.beidseitig ? gondel(element) : wandregal(element);
  }
}
