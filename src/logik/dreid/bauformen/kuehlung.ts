import { quader, seitenplatte, spiegele, wandplatte, zylinder, type Bauteil } from '../bauteile';
import { hoeheVon } from '../moebel';
import type { PlanElement } from '../../../typen/modell';

/**
 * Kühlung und Theken – WSL Orion/Titan (Hochkühlregal), Cloud (Stufenmöbel)
 * und Blink (Bedien- und SB-Theken), Katalog 2026.
 *
 * **Hochkühlregal:** ein L-förmiger Querschnitt. Unten der geschlossene
 * **Sockelkasten** (Oberkante 33,4 cm) mit heller Stoßleiste, darauf der
 * tiefe **Grundboden**, hinten die Rückwand über die volle Höhe – außen
 * dunkel, innen weißes Lochblech –, oben die **Haube** mit LED, die über die
 * Türlinie kragt. Dazwischen 4–5 Fachböden, nach unten tiefer. Mit Türen:
 * rahmenlose **Glastüren je 62,5 cm** mit weißem Stangengriff. Ohne: offen.
 *
 * **Stufenmöbel (Cloud):** 150 hoch, Grundboden 70,5 tief, drei stufig
 * kürzere Böden, die Front lehnt etwa 10° nach hinten, Deckel nur 78 tief.
 *
 * **Bedientheke (Blink):** dunkler Unterbau (Vorderkante 50,7), Edelstahldeck
 * 84 tief, hinten Rückwand mit Arbeitsplatte (87), vorn die geneigte
 * **Glasfront** bis 124,7 mit waagerechtem Deckglas (35,8 tief). SB flach:
 * dieselbe Hülle mit niedriger Glasbrüstung bis 86,9. SB halbhoch: 150
 * hoch, zwei Böden über der Wanne, Haube mit Lichtnase.
 */

const MODUL = 62.5;
const STOSSLEISTE = 3;

/** Weißer Innenraum, Böden und Ware zwischen zwei Höhen. */
function innenraum(b: number, t: number, von: number, bis: number, boeden: number, bodentiefe: number, teile: Bauteil[]) {
  teile.push(quader(4, 10, von, b - 8, t - 14, bis - von, 'weiss'));
  for (let i = 1; i <= boeden; i++) {
    const z = von + ((bis - von) * i) / (boeden + 1);
    const d = Math.min(bodentiefe, t - 20);
    teile.push(quader(5, t - 8 - d, z, b - 10, d, 1.5, 'hellgrau'));
    teile.push(quader(7, t - 8 - d + 4, z + 1.5, b - 14, d - 8, 16, 'ware'));
  }
}

/** Rahmenlose Glastüren mit weißen Stangengriffen. */
function glastueren(b: number, y: number, z: number, h: number, teile: Bauteil[]) {
  const anzahl = Math.max(1, Math.round(b / MODUL));
  const schritt = b / anzahl;
  for (let i = 0; i < anzahl; i++) {
    const x = i * schritt;
    teile.push(wandplatte(x + 1, y, z, schritt - 2, h, 'glas', 1));
    teile.push(zylinder(x + schritt - 8, y + 2.5, z + h * 0.3, 1.2, h * 0.45, 'z', 'weiss'));
  }
}

/** Orion/Titan: Hochkühlregal, offen oder mit Türen. */
function hochkuehlregal(element: PlanElement, tueren: boolean): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const sockel = 33.4;
  const haube = 9;
  const teile: Bauteil[] = [];

  teile.push(quader(0, 0, 0, b, t - 3, sockel, 'anthrazit'));
  teile.push(quader(0, t - 4.2, 2, b, 1.2, STOSSLEISTE, 'hellgrau'));
  teile.push(wandplatte(0, 0, sockel, b, hoehe - sockel, 'anthrazit', 10));
  teile.push(seitenplatte(0, 0, sockel, t - 3, hoehe - sockel, 'anthrazit', 3));
  teile.push(seitenplatte(b - 3, 0, sockel, t - 3, hoehe - sockel, 'anthrazit', 3));
  // Haube, vorn über die Türlinie kragend.
  teile.push(quader(0, 0, hoehe - haube, b, t + 2, haube, 'anthrazit'));
  // Grundboden und Innenraum.
  const boeden = hoehe > 215 ? 5 : 4;
  teile.push(quader(3, 10, sockel, b - 6, t - 16, 1.5, 'hellgrau'));
  innenraum(b, t, sockel + 1.5, hoehe - haube, boeden, 55, teile);
  if (tueren) glastueren(b, t - 5, sockel, hoehe - haube - sockel, teile);
  return teile;
}

/** Cloud: halbhohes Stufenmöbel mit schräger Front. */
function stufenmoebel(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const fuss = 14.6;
  const sockel = 31;
  const deckelTiefe = Math.min(78, t * 0.8);
  const teile: Bauteil[] = [];

  teile.push(quader(2, 2, 0, b - 4, t - 6, fuss, 'schwarz'));
  teile.push(quader(0, 0, fuss, b, t - 3, sockel - fuss, 'anthrazit'));
  teile.push(quader(0, t - 4.2, fuss + 2, b, 1.2, STOSSLEISTE, 'hellgrau'));
  teile.push(wandplatte(0, 0, sockel, b, hoehe - sockel, 'anthrazit', 10));
  teile.push(quader(0, 0, hoehe - 9, b, deckelTiefe, 9, 'anthrazit'));
  // Grundboden und drei Böden, nach oben kürzer.
  teile.push(quader(3, 10, sockel, b - 6, Math.min(70.5, t - 16), 1.5, 'hellgrau'));
  teile.push(quader(5, 12, sockel + 1.5, b - 10, Math.min(60, t - 24), 14, 'ware'));
  const tiefen = [49.2, 44.2, 39.2];
  tiefen.forEach((d, i) => {
    const z = sockel + 26 * (i + 1);
    teile.push(quader(3, 10, z, b - 6, d, 1.5, 'hellgrau'));
    teile.push(quader(5, 12, z + 1.5, b - 10, d - 6, 12, 'ware'));
  });
  // Seitenwände als Trapez-Näherung: vorn niedriger Teil, hinten hoch.
  teile.push(seitenplatte(0, 0, sockel, deckelTiefe, hoehe - sockel, 'anthrazit', 3));
  teile.push(seitenplatte(b - 3, 0, sockel, deckelTiefe, hoehe - sockel, 'anthrazit', 3));
  // Schräge Glasfront von der Sockeloberkante bis zum Deckel.
  const lauf = t - 3 - deckelTiefe;
  const steig = hoehe - 9 - sockel;
  const laenge = Math.hypot(lauf, steig);
  const neigung = -(Math.atan2(lauf, steig) * 180) / Math.PI;
  teile.push(quader(1, t - 4, sockel, b - 2, 1, laenge, 'glas', { neigung }));
  return teile;
}

/**
 * Die Blink-Hülle: Unterbau, Deck, Rückwand mit Arbeitsplatte.
 *
 * Die Vorderkante des Unterbaus liegt bei 50,7 cm; darüber das Deck, das
 * nach vorn leicht abfällt.
 */
function thekenkorpus(b: number, t: number, rueckwandHoehe: number, teile: Bauteil[]) {
  teile.push(quader(3, 3, 0, b - 6, t - 6, 10, 'schwarz'));
  teile.push(quader(0, 0, 10, b, t - 3, 50.7 - 10, 'anthrazit'));
  teile.push(quader(0, t - 4.2, 12, b, 1.2, STOSSLEISTE, 'hellgrau'));
  // Deck aus Edelstahl, leicht geneigt, mit Ware darauf.
  const deckTiefe = Math.min(84.2, t - 30);
  teile.push(quader(1, t - 5 - deckTiefe, 62, b - 2, deckTiefe, 2, 'edelstahl', { neigung: 4 }));
  teile.push(quader(6, t - 5 - deckTiefe + 8, 64, b - 12, deckTiefe - 16, 7, 'ware', { neigung: 4 }));
  // Rückwand und Arbeitsplatte.
  teile.push(wandplatte(0, 0, 50.7, b, rueckwandHoehe - 50.7, 'anthrazit', 6));
  teile.push(quader(0, 0, rueckwandHoehe, b, 24, 2, 'edelstahl'));
  teile.push(seitenplatte(0, 0, 50.7, t - 3, rueckwandHoehe - 50.7, 'anthrazit', 3));
  teile.push(seitenplatte(b - 3, 0, 50.7, t - 3, rueckwandHoehe - 50.7, 'anthrazit', 3));
}

/** Bedientheke: hohe, geneigte Glasfront mit Deckglas. */
function bedientheke(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const teile: Bauteil[] = [];
  thekenkorpus(b, t, 87.1, teile);
  const glasHoehe = 124.7 - 50.7;
  const neigung = -12;
  teile.push(quader(1, t - 4, 50.7, b - 2, 1, glasHoehe, 'glas', { neigung }));
  // Deckglas oben, waagerecht nach hinten.
  const rueck = glasHoehe * Math.sin((12 * Math.PI) / 180);
  teile.push(quader(1, t - 4 - rueck - 35.8, 124.7, b - 2, 35.8, 1, 'glas'));
  // Pfosten an den Seiten.
  teile.push(zylinder(1.5, t - 5, 50.7, 1.5, glasHoehe, 'z', 'chrom'));
  teile.push(zylinder(b - 1.5, t - 5, 50.7, 1.5, glasHoehe, 'z', 'chrom'));
  return teile;
}

/** SB-Theke flach: niedrige Glasbrüstung, offen nach oben. */
function sbFlach(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const teile: Bauteil[] = [];
  thekenkorpus(b, t, 87.1, teile);
  teile.push(wandplatte(1, t - 4, 57, b - 2, 86.9 - 57, 'glas', 1));
  return teile;
}

/** SB-Theke halbhoch: zwei Böden über der Wanne, Haube mit Lichtnase. */
function sbHalbhoch(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const teile: Bauteil[] = [];
  thekenkorpus(b, t, 90, teile);
  teile.push(wandplatte(1, t - 4, 57, b - 2, 83.9 - 57, 'glas', 1));
  teile.push(wandplatte(0, 0, 90, b, hoehe - 90, 'anthrazit', 10));
  for (const [z, d] of [
    [105, 50],
    [125, 40],
  ]) {
    teile.push(quader(3, 10, z, b - 6, d, 1.5, 'hellgrau'));
    teile.push(quader(5, 12, z + 1.5, b - 10, d - 6, 12, 'ware'));
  }
  const haubeTiefe = Math.min(70.7, t - 20);
  teile.push(quader(0, 0, hoehe - 9, b, haubeTiefe, 9, 'anthrazit'));
  teile.push(seitenplatte(0, 0, 90, haubeTiefe, hoehe - 90, 'anthrazit', 3));
  teile.push(seitenplatte(b - 3, 0, 90, haubeTiefe, hoehe - 90, 'anthrazit', 3));
  return teile;
}

export function kuehlBauteile(element: PlanElement): Bauteil[] {
  const beidseitig = Boolean(element.beidseitig);
  const eine = (bau: (el: PlanElement) => Bauteil[]) => {
    if (!beidseitig) return bau(element);
    // Rücken an Rücken: jede Seite halb so tief, die zweite gespiegelt.
    const halb = { ...element, tiefe: element.tiefe / 2, beidseitig: false };
    const vorn = bau(halb).map((teil) =>
      teil.art === 'prisma'
        ? { ...teil, punkte: teil.punkte.map((p) => ({ x: p.x, y: p.y + halb.tiefe })) }
        : { ...teil, y: teil.y + halb.tiefe },
    );
    return [...vorn, ...spiegele(bau(halb).map((teil) =>
      teil.art === 'prisma'
        ? { ...teil, punkte: teil.punkte.map((p) => ({ x: p.x, y: p.y + halb.tiefe })) }
        : { ...teil, y: teil.y + halb.tiefe },
    ), element.tiefe)];
  };

  switch (element.form) {
    case 'kuehlSchrank':
      return eine((el) => hochkuehlregal(el, true));
    case 'kuehlOffen':
      return eine((el) => hochkuehlregal(el, false));
    case 'kuehlStufen':
      return eine(stufenmoebel);
    case 'blinkTheke':
      return bedientheke(element);
    case 'blinkSelf':
      return sbFlach(element);
    case 'blinkSv':
      return sbHalbhoch(element);
    default:
      return hochkuehlregal(element, false);
  }
}
