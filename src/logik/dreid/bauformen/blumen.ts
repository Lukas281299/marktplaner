import { kugel, quader, seitenplatte, wandplatte, zylinder, type Bauteil } from '../bauteile';
import { hoeheVon, klotz } from '../moebel';
import type { PlanElement } from '../../../typen/modell';

/**
 * Blumen und Pflanzen – nach den CMS-Metasys-Möbeln, die der Bibliothek
 * zugrunde liegen (Pflanzregal PR 2017–2019, Blumeninsel PR 2008,
 * Kassendisplay KD 2004, Topfblumen-Präsenter BT 9080, Blumentreppe BT 1007/
 * 1010, Bewässerungswanne BW 0653/1253, Blumenwagen BW 1826).
 *
 * Gemeinsam ist ihnen: dunkles Stahlgestell (Anthrazit RAL 7016) oder helles
 * Holzdekor, verzinkte Eimer in Drahtringen, schwarze Wasserwannen – und
 * darin Grün. Die Pflanzen sind hier Kugeln und Blüten Kugeln in Rosa; mehr
 * braucht es nicht, damit man aus drei Metern Entfernung Blumen sieht.
 */

const EIMER_R = 13;
const EIMER_H = 25;
const TOPF_RASTER = 28;

/**
 * Die Farben, in denen die Blüten stehen.
 *
 * Drei reichen. Ein Blumenstand ist bunt, aber er ist kein Farbkasten: Wer
 * zwölf Farben verteilt, bekommt Konfetti und keine Blumen.
 */
const BLUETEN = ['#e0577a', '#e8c94a', '#f2efe6', '#c8506e'];

/**
 * Ein Eimer mit seinem Strauß.
 *
 * **Das meistwiederholte Teil der ganzen Abteilung** – an einem Pflanzregal
 * stehen sechs, an einer Insel acht. Deshalb lohnt sich hier die Mühe: ein
 * Eimer, der sich nach unten verjüngt, ein heller Rand, Grün darin und
 * darüber drei Blüten statt einer großen Kugel. Sechs Teile statt zwei, und
 * aus drei Metern Entfernung sieht man den Unterschied sofort.
 */
function eimer(x: number, y: number, z: number, teile: Bauteil[], zink = true, saat = 0) {
  const material = zink ? 'edelstahl' : 'schwarz';
  // Der Eimer: unten schmaler als oben.
  teile.push(zylinder(x, y, z, EIMER_R - 3, EIMER_H * 0.6, 'z', material));
  teile.push(zylinder(x, y, z + EIMER_H * 0.55, EIMER_R, EIMER_H * 0.45, 'z', material));
  // Der Rand, eine Spur heller.
  teile.push(zylinder(x, y, z + EIMER_H - 1.4, EIMER_R + 0.8, 1.4, 'z', 'chrom'));
  // Das Grün, aus dem die Blüten kommen.
  teile.push(kugel(x, y, z + EIMER_H + 5, 10.5, 'pflanze'));
  // Und drei Blüten, versetzt.
  const versatz: [number, number, number][] = [
    [-6, -3, 13],
    [6, 2, 15],
    [0, 6, 11],
  ];
  versatz.forEach(([dx, dy, dz], i) => {
    teile.push(kugel(x + dx, y + dy, z + EIMER_H + dz, 5.5, 'blume', BLUETEN[(saat + i) % BLUETEN.length]));
  });
}

/**
 * Pflanzen im Raster auf einer Fläche.
 *
 * Topf, Grün, und auf jeder dritten Pflanze eine Blüte: So sieht ein Tisch
 * mit Topfware aus, und nicht wie ein Feld gleicher Kugeln.
 */
function pflanzen(x0: number, y0: number, b: number, t: number, z: number, teile: Bauteil[], radius = 11) {
  const nx = Math.max(1, Math.floor(b / TOPF_RASTER));
  const ny = Math.max(1, Math.floor(t / TOPF_RASTER));
  const rx = (b - nx * TOPF_RASTER) / 2 + TOPF_RASTER / 2;
  const ry = (t - ny * TOPF_RASTER) / 2 + TOPF_RASTER / 2;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const x = x0 + rx + i * TOPF_RASTER;
      const y = y0 + ry + j * TOPF_RASTER;
      // Der Topf verjüngt sich nach unten, wie ein Topf es tut.
      teile.push(zylinder(x, y, z, 6.5, 5, 'z', 'holzDunkel'));
      teile.push(zylinder(x, y, z + 4.5, 8, 6, 'z', 'holzDunkel'));
      teile.push(kugel(x, y, z + 10 + radius * 0.75, radius, 'pflanze'));
      if ((i + j) % 3 === 0) {
        teile.push(
          kugel(x, y, z + 10 + radius * 1.35, radius * 0.42, 'blume', BLUETEN[(i + j) % BLUETEN.length]),
        );
      }
    }
  }
}

/** Pflanzregal mit Holzrückwand: Sockelwanne, Pfosten, zwei bis drei Körbe mit Eimern. */
function pflanzregal(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const teile: Bauteil[] = [];
  teile.push(quader(0, 0, 2, b, t, 9, 'anthrazit'));
  teile.push(quader(2, t - 46, 11, b - 4, 43, 2.5, 'edelstahl'));
  pflanzen(2, t - 46, b - 4, 43, 13.5, teile, 10);
  teile.push(quader(4, 2, 0, 5, 5, h, 'anthrazit'));
  teile.push(quader(b - 9, 2, 0, 5, 5, h, 'anthrazit'));
  teile.push(wandplatte(9, 3, 11, b - 18, h - 11, 'holzHell', 2));
  const n = h > 140 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const z = h * (0.36 + (0.6 * i) / Math.max(1, n - 1)) - 8;
    teile.push(quader(2, 7, z, b - 4, 32, 1.5, 'draht', { neigung: 15 }));
    teile.push(zylinder(2, 7 + 32 * 0.96, z - 32 * 0.26, 1.5, b - 4, 'x', 'chrom'));
    eimer(b * 0.3, 7 + 20, z - 20, teile, true, i);
    eimer(b * 0.7, 7 + 20, z - 20, teile, true, i + 2);
  }
  return teile;
}

/** Schnittblumen-Präsenter: ein A-Bock mit drei gestaffelten Eimern. */
function blumensaeule(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const teile: Bauteil[] = [];
  // Zwei schräge vordere Holme, zwei senkrechte hintere.
  teile.push(quader(2, t - 5, 0, 3, 3, h, 'anthrazit', { neigung: -22 }));
  teile.push(quader(b - 5, t - 5, 0, 3, 3, h, 'anthrazit', { neigung: -22 }));
  teile.push(quader(2, 4, 0, 3, 3, h * 0.9, 'anthrazit'));
  teile.push(quader(b - 5, 4, 0, 3, 3, h * 0.9, 'anthrazit'));
  // Drei Eimer, unten vorn bis oben hinten.
  const stufen = [
    [t - 16, 4],
    [t - 26, h * 0.4],
    [t - 36, h * 0.74],
  ];
  stufen.forEach(([y, z], i) => eimer(b / 2, y, z, teile, false, i));
  return teile;
}

/** Blumeninsel: Holzwürfel mit Wanne, rundum Körbe mit acht Eimern. */
function blumeninsel(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const teile: Bauteil[] = [];
  const k = Math.min(65, b * 0.45);
  const x0 = (b - k) / 2;
  const y0 = (t - k) / 2;
  teile.push(quader(x0, y0, 5, k, k, 53, 'holzHell'));
  teile.push(quader(x0 - 1, y0 - 1, 58, k + 2, k + 2, 4.5, 'edelstahl'));
  pflanzen(x0, y0, k, k, 62.5, teile, 12);
  // Körbe an den vier Seiten mit je zwei Eimern.
  const z = 40;
  teile.push(quader(x0 + 2, y0 + k, z, k - 4, 35, 1.5, 'draht'));
  teile.push(quader(x0 + 2, y0 - 35, z, k - 4, 35, 1.5, 'draht'));
  teile.push(quader(x0 - 35, y0 + 2, z, 35, k - 4, 1.5, 'draht'));
  teile.push(quader(x0 + k, y0 + 2, z, 35, k - 4, 1.5, 'draht'));
  for (const [i, [x, y]] of [
    [x0 + k * 0.3, y0 + k + 18],
    [x0 + k * 0.7, y0 + k + 18],
    [x0 + k * 0.3, y0 - 18],
    [x0 + k * 0.7, y0 - 18],
    [x0 - 18, y0 + k * 0.3],
    [x0 - 18, y0 + k * 0.7],
    [x0 + k + 18, y0 + k * 0.3],
    [x0 + k + 18, y0 + k * 0.7],
  ].entries()) {
    eimer(x, y, z - 22, teile, true, i);
  }
  return teile;
}

/** Blumendisplay an der Kasse: Bodenplatte, Säule, vier Eimer übereinander, Schild. */
function blumendisplay(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const teile: Bauteil[] = [];
  teile.push(quader(1, 1, 0, b - 2, t - 2, 1, 'hellgrau'));
  const ys = t * 0.6;
  teile.push(quader(b / 2 - 6, ys, 1, 12, 7, h * 0.8, 'hellgrau'));
  const n = 4;
  for (let i = 0; i < n; i++) {
    const z = 8 + i * ((h * 0.75) / n);
    teile.push(quader(b / 2 - 14, ys - 30, z + 20, 28, 30, 1, 'draht'));
    eimer(b / 2, ys - 18, z, teile, false);
  }
  teile.push(wandplatte(b / 2 - 12, ys + 3, h * 0.8, 24, 33, 'weiss', 1.5));
  teile.push(wandplatte(b / 2 - 13, ys + 2.5, h * 0.8 - 1, 26, 35, 'anthrazit', 0.5));
  return teile;
}

/** Topfblumen-Präsenter: drei Wannen übereinander als Stufen zwischen Wangen. */
function blumentrog(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const teile: Bauteil[] = [];
  const stufen = [
    { z: h * 0.14, d: Math.min(70, t - 8) },
    { z: h * 0.48, d: Math.min(52, t - 8) },
    { z: h * 0.79, d: Math.min(35, t - 8) },
  ];
  stufen.forEach((s, i) => {
    const naechste = stufen[i + 1]?.z ?? h;
    teile.push(quader(2, 6, s.z, b - 4, s.d, 4.5, 'anthrazit'));
    teile.push(quader(3, 7, s.z + 4.5, b - 6, s.d - 2, 0.6, 'schwarz'));
    pflanzen(3, 7, b - 6, s.d - 2, s.z + 5, teile, 10);
    // Wangen, stufig zurückspringend.
    teile.push(seitenplatte(0, 0, s.z, s.d + 8, naechste - s.z, 'hellgrau', 2));
    teile.push(seitenplatte(b - 2, 0, s.z, s.d + 8, naechste - s.z, 'hellgrau', 2));
  });
  teile.push(seitenplatte(0, 0, 0, t - 4, stufen[0].z, 'hellgrau', 2));
  teile.push(seitenplatte(b - 2, 0, 0, t - 4, stufen[0].z, 'hellgrau', 2));
  teile.push(zylinder(2, 4, h * 0.3, 1.5, b - 4, 'x', 'hellgrau'));
  teile.push(zylinder(2, 4, h * 0.7, 1.5, b - 4, 'x', 'hellgrau'));
  return teile;
}

/** Blumentreppe: gestufte Holzkästen mit eingelassenen Wannen. */
function blumentreppe(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const n = Math.max(2, Math.round(t / 33.3));
  const stufe = t / n;
  const teile: Bauteil[] = [];
  teile.push(quader(4, 4, 0, b - 8, t - 8, 9, 'schwarz'));
  for (let i = 0; i < n; i++) {
    // Kasten i reicht von hinten bis zur Vorderkante der Stufe i.
    const vorn = t - i * stufe;
    const oben = h - (n - 1 - i) * (n === 2 ? 27.5 : 20);
    teile.push(quader(0, 0, 9, b, vorn, oben - 9, 'holzHell'));
    teile.push(quader(2, vorn - stufe + 1, oben, b - 4, stufe - 2, 5, 'anthrazit'));
    pflanzen(2, vorn - stufe + 1, b - 4, stufe - 2, oben + 5, teile, 10);
  }
  return teile;
}

/** Bewässerungswanne: niedriger Holzkasten mit schwarzer Wanne. */
function blumenwanne(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const teile: Bauteil[] = [];
  teile.push(quader(4, 4, 0, b - 8, t - 8, 8, 'schwarz'));
  teile.push(quader(0, 0, 8, b, t, h - 14, 'holzDunkel'));
  teile.push(quader(-1, -1, h - 6, b + 2, t + 2, 6, 'schwarz'));
  pflanzen(2, 2, b - 4, t - 4, h - 1, teile, 11);
  return teile;
}

/** Blumenwagen / CC-Container: Rahmen auf Rollen, Pfosten, Böden mit Wannen. */
function blumenwagen(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const teile: Bauteil[] = [];
  for (const [x, y] of [
    [10, 10],
    [b - 10, 10],
    [10, t - 10],
    [b - 10, t - 10],
  ]) {
    teile.push(zylinder(x, y, 0, 6, 12, 'z', 'schwarz'));
  }
  teile.push(quader(0, 0, 12, b, t, 5, 'hellgrau'));
  for (const [x, y] of [
    [1, 1],
    [b - 4, 1],
    [1, t - 4],
    [b - 4, t - 4],
  ]) {
    teile.push(quader(x, y, 17, 3, 3, h - 17, 'hellgrau'));
  }
  const n = Math.max(2, Math.floor((h - 20) / 40));
  for (let i = 0; i < n; i++) {
    const z = 20 + i * ((h - 25) / n);
    teile.push(quader(4, 4, z, b - 8, t - 8, 3, 'holzDunkel'));
    teile.push(quader(5, 5, z + 3, b - 10, t - 10, 4, 'schwarz'));
    pflanzen(5, 5, b - 10, t - 10, z + 6, teile, 10);
  }
  return teile;
}

export function blumenBauteile(element: PlanElement): Bauteil[] {
  switch (element.form) {
    case 'blumenregal':
      return pflanzregal(element);
    case 'blumensaeule':
      return blumensaeule(element);
    case 'blumeninsel':
      return blumeninsel(element);
    case 'blumendisplay':
      return blumendisplay(element);
    case 'blumentrog':
      return blumentrog(element);
    case 'blumentreppe':
      return blumentreppe(element);
    case 'blumenwanne':
      return blumenwanne(element);
    case 'blumenwagen':
      return blumenwagen(element);
    default:
      return klotz(element);
  }
}
