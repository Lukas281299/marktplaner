import { felderVon } from '../../regalseiten';
import {
  platte,
  quader,
  seitenplatte,
  spiegele,
  verteileHoehen,
  wandplatte,
  zylinder,
  type Bauteil,
} from '../bauteile';
import { hoeheVon } from '../moebel';
import type { PlanElement, Regalfeld } from '../../../typen/modell';

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
/** Preisschiene an der Vorderkante eines Fachbodens. */
const PREISSCHIENE = 3;

/**
 * Wie viele Ebenen ein **Feld** zeigt.
 *
 * **Dieselbe Zählweise wie beim Regal:** Was am Feld steht, ist die Zahl der
 * Ebenen einschließlich des Grundbodens. Steht dort nichts, gilt die
 * Katalogvorgabe — vier Fachböden, bei hohen Möbeln fünf, jeweils über dem
 * Grundboden.
 *
 * Gefragt wird **je Feld**. Vorher zählte allein das erste und die Zahl galt
 * über die ganze Möbelbreite: Wer im ersten Feld vier und im zweiten sechs
 * Böden eintrug, sah überall vier und las damit eine falsche Zahl ab.
 */
function ebenenzahl(feld: Regalfeld | undefined, hoehe: number): number {
  if (feld?.boeden !== undefined && feld.boeden > 0) return feld.boeden;
  return hoehe > 215 ? 6 : 5;
}

/**
 * Der weiße Innenraum mit seinen Fachböden.
 *
 * **Eine Schale und kein Klotz.** Hier stand ein voller weißer Quader über den
 * ganzen Innenraum, und die Fachböden lagen darin — also unsichtbar. Weiß
 * sind aber nur die Flächen, die man sieht: Rückwand (im Katalog ein
 * Lochblech), Seiten und Decke.
 *
 * Die Böden werden nach unten tiefer, wie im WSL-Katalog, und tragen vorn
 * ihre Preisschiene. Der **Grundboden zählt als erste Ebene** — wer fünf
 * einträgt, sieht fünf.
 */
function innenraum(
  b: number,
  t: number,
  von: number,
  bis: number,
  ebenen: number,
  bodentiefe: number,
  teile: Bauteil[],
  /** Wo das Feld beginnt – bei einem Möbel aus mehreren Feldern. */
  x0 = 0,
) {
  const hinten = 10;
  const innen = Math.max(20, Math.min(bodentiefe, t - 16));

  // Die Schale: Rückwand, Seiten, Decke.
  teile.push(wandplatte(x0 + 4, hinten, von, b - 8, bis - von, 'weiss', 2));
  teile.push(seitenplatte(x0 + 4, hinten, von, t - 14, bis - von, 'weiss', 2));
  teile.push(seitenplatte(x0 + b - 6, hinten, von, t - 14, bis - von, 'weiss', 2));
  teile.push(platte(x0 + 4, hinten, bis - 2, b - 8, t - 14, 'weiss'));

  // Der Grundboden ist die erste Ebene; darüber hängen die übrigen.
  const hoehen = verteileHoehen(von, bis - 12, Math.max(0, ebenen - 1));
  hoehen.forEach((z, k) => {
    // Nach unten tiefer: der unterste Fachboden reicht am weitesten vor.
    const anteil = hoehen.length > 1 ? k / (hoehen.length - 1) : 0;
    const d = Math.round(innen - (innen - Math.max(20, innen - 14)) * anteil);
    teile.push(quader(x0 + 5, hinten + 1, z, b - 10, d, 1.5, 'hellgrau'));

    // **Die Ware bleibt in ihrem Fach.** Über dem obersten Boden sind es bis
    // zur Innendecke nur zehn Zentimeter; ein fester Warenblock von sechzehn
    // durchstieß sie und steckte in der Haube. Durch die offene Front oder die
    // Glastür sah man das sofort – beim häufigsten Möbel im Markt.
    const darueber = (k + 1 < hoehen.length ? hoehen[k + 1] : bis - 2) - z - 1.5;
    const warenhoehe = Math.min(16, darueber - 1);
    if (warenhoehe > 2) {
      teile.push(quader(x0 + 7, hinten + 5, z + 1.5, b - 14, d - 8, warenhoehe, 'ware'));
    }
    teile.push(quader(x0 + 5, hinten + d - 0.8, z, b - 10, 0.8, PREISSCHIENE, 'preisschiene'));
  });
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
  // Grundboden und Innenraum. Der Grundboden ist die erste Ebene.
  teile.push(quader(3, 10, sockel, b - 6, t - 16, 1.5, 'hellgrau'));
  teile.push(quader(3, t - 7.3, sockel, b - 6, 0.8, PREISSCHIENE, 'preisschiene'));
  // **Je Feld sein eigener Innenraum.** Ein 3,75-m-Regal aus drei Feldern mit
  // verschiedenen Bodenzahlen ist im Markt genau das – drei Abschnitte, und
  // jeder trägt, was an ihm steht.
  const felder = felderVon(element, 'unten');
  const grundboden = element.grundboden && element.grundboden > 0 ? element.grundboden : 55;
  let x = 0;
  for (const feld of felder.length > 0 ? felder : [{ breite: b }]) {
    const fb = Math.min(feld.breite, b - x);
    if (fb <= 0) break;
    innenraum(fb, t, sockel + 1.5, hoehe - haube, ebenenzahl(feld, hoehe), grundboden, teile, x);
    x += feld.breite;
  }
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
