import { quader, wandplatte, zylinder, type Bauteil } from '../bauteile';
import { hoeheVon, kategoriefarbe, klotz } from '../moebel';
import type { PlanElement } from '../../../typen/modell';

/**
 * Aktionsmöbel – Palette, Drehständer, Schütte, Display.
 *
 * Die **Europalette** ist nach EPAL gebaut: drei Bodenbretter, neun Klötze,
 * drei Querbretter, fünf Deckbretter, zusammen 14,4 cm hoch; darauf der
 * Warenblock in Stretchfolie bis zur Höhe des Elements. Eine CHEP ist blau.
 * Der **Drehständer** ist ein Kreuz aus vier Lochblechen um ein Rohr auf
 * einer runden Fußplatte, oben ein Schild. Die **Schütte** ist ein Korb aus
 * Draht auf vier Beinen mit der Ware darin, das **Display** ein Kartonaufbau
 * mit Etagen auf einer Viertelpalette.
 */

const PALETTE_H = 14.4;
const BRETT = 2.2;
const KLOTZ = 7.8;

/** Die Europalette in ihren Brettern und Klötzen. */
function europalette(b: number, t: number, material: 'palette' | 'kategorie', farbe: string | undefined): Bauteil[] {
  const teile: Bauteil[] = [];
  const laengs = b >= t; // die Bretter laufen entlang der langen Seite
  const L = laengs ? b : t;
  const Q = laengs ? t : b;
  const brett = (entlang: number, quer: number, z: number, laengeEntlang: number, breiteQuer: number, hoehe: number) =>
    laengs
      ? quader(entlang, quer, z, laengeEntlang, breiteQuer, hoehe, material, { farbe })
      : quader(quer, entlang, z, breiteQuer, laengeEntlang, hoehe, material, { farbe });

  // Drei Bodenbretter längs: Rand 10, Mitte 14,5.
  const bodenBreiten = [10, 14.5, 10];
  const bodenLagen = [0, Q / 2 - 7.25, Q - 10];
  bodenBreiten.forEach((w, i) => teile.push(brett(0, bodenLagen[i], 0, L, w, BRETT)));
  // Neun Klötze in drei Reihen.
  for (const e of [0, L / 2 - 7.25, L - 14.5]) {
    bodenLagen.forEach((q, i) => teile.push(brett(e, q, BRETT, 14.5, bodenBreiten[i], KLOTZ)));
  }
  // Drei Querbretter über den Klötzen.
  for (const e of [0, L / 2 - 7.25, L - 14.5]) teile.push(brett(e, 0, BRETT + KLOTZ, 14.5, Q, BRETT));
  // Fünf Deckbretter längs mit Lücken.
  const deck = [
    [0, 14.5],
    [Q * 0.24, 10],
    [Q / 2 - 7.25, 14.5],
    [Q * 0.76 - 10, 10],
    [Q - 14.5, 14.5],
  ];
  for (const [q, w] of deck) teile.push(brett(0, q, BRETT * 2 + KLOTZ, L, w, BRETT));
  return teile;
}

function palette(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const chep = /chep/i.test(element.vorlageId) || /chep/i.test(element.name);
  const teile = europalette(b, t, chep ? 'kategorie' : 'palette', chep ? '#2f5fa8' : undefined);
  // Der Warenblock: Kartons in Folie, ein wenig eingerückt.
  if (h > PALETTE_H + 10) {
    teile.push(quader(3, 3, PALETTE_H, b - 6, t - 6, h - PALETTE_H, 'ware', { farbe: kategoriefarbe(element) }));
    // Ein paar Kartonfugen als Schatten – zwei dünne Streifen.
    const lagen = Math.max(1, Math.floor((h - PALETTE_H) / 30));
    for (let i = 1; i < lagen; i++) {
      const z = PALETTE_H + i * ((h - PALETTE_H) / lagen);
      teile.push(quader(2.5, 2.5, z - 0.4, b - 5, t - 5, 0.8, 'hellgrau'));
    }
  }
  return teile;
}

function drehstaender(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const r = Math.min(b, t) / 2;
  const teile: Bauteil[] = [];
  teile.push(zylinder(b / 2, t / 2, 0, r * 0.9, 3, 'z', 'hellgrau'));
  teile.push(zylinder(b / 2, t / 2, 3, 2, h - 3, 'z', 'hellgrau'));
  // Vier Paneele als Kreuz.
  const von = h * 0.2;
  const bis = h * 0.9;
  teile.push(quader(b / 2 - r * 0.85, t / 2 - 0.75, von, r * 1.7, 1.5, bis - von, 'hellgrau'));
  teile.push(quader(b / 2 - 0.75, t / 2 - r * 0.85, von, 1.5, r * 1.7, bis - von, 'hellgrau'));
  // Ware an den Paneelen: kleine Blister als flache Blöcke.
  teile.push(quader(b / 2 - r * 0.7, t / 2 + 1, von + 10, r * 1.4, 6, bis - von - 20, 'ware', { farbe: kategoriefarbe(element) }));
  teile.push(quader(b / 2 - r * 0.7, t / 2 - 7, von + 10, r * 1.4, 6, bis - von - 20, 'ware', { farbe: kategoriefarbe(element) }));
  // Schild oben.
  teile.push(wandplatte(b / 2 - 10.5, t / 2 - 0.5, h - 30, 21, 30, 'weiss', 1));
  return teile;
}

/** Schütte: Drahtkorb auf Beinen, Ware im Korb. */
function schuette(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = Math.max(60, hoeheVon(element));
  const korbUnten = h * 0.5;
  const teile: Bauteil[] = [];
  for (const [x, y] of [
    [3, 3],
    [b - 6, 3],
    [3, t - 6],
    [b - 6, t - 6],
  ]) {
    teile.push(quader(x, y, 0, 3, 3, korbUnten, 'chrom'));
  }
  teile.push(quader(2, 2, korbUnten, b - 4, t - 4, 1, 'draht'));
  teile.push(quader(2, 2, korbUnten, b - 4, 0.6, h - korbUnten, 'gitter'));
  teile.push(quader(2, t - 2.6, korbUnten, b - 4, 0.6, h - korbUnten, 'gitter'));
  teile.push(quader(2, 2, korbUnten, 0.6, t - 4, h - korbUnten, 'gitter'));
  teile.push(quader(b - 2.6, 2, korbUnten, 0.6, t - 4, h - korbUnten, 'gitter'));
  teile.push(quader(6, 6, korbUnten + 1, b - 12, t - 12, (h - korbUnten) * 0.75, 'ware', { farbe: kategoriefarbe(element) }));
  return teile;
}

/** Display: Kartonaufbau mit Etagen auf einer blauen Viertelpalette. */
function display(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = hoeheVon(element);
  const teile: Bauteil[] = [];
  teile.push(quader(1, 1, 0, b - 2, t - 2, 14, 'kategorie', { farbe: '#2f5fa8' }));
  const korpusHoehe = Math.max(30, h - 14 - 30);
  teile.push(quader(0, 0, 14, b, t * 0.35, korpusHoehe, 'weiss'));
  teile.push(quader(0, 0, 14, 2, t, korpusHoehe, 'weiss'));
  teile.push(quader(b - 2, 0, 14, 2, t, korpusHoehe, 'weiss'));
  const etagen = Math.max(2, Math.floor(korpusHoehe / 28));
  for (let i = 0; i < etagen; i++) {
    const z = 14 + i * (korpusHoehe / etagen);
    teile.push(quader(2, t * 0.3, z, b - 4, t * 0.7 - 2, 2, 'weiss'));
    teile.push(quader(4, t * 0.32, z + 2, b - 8, t * 0.66 - 4, korpusHoehe / etagen - 8, 'ware', { farbe: kategoriefarbe(element) }));
  }
  teile.push(wandplatte(0, 0, 14 + korpusHoehe, b, Math.min(30, h - 14 - korpusHoehe), 'weiss', 1.5));
  return teile;
}

export function aktionBauteile(element: PlanElement): Bauteil[] {
  if (element.form === 'palette') return palette(element);
  if (element.form === 'drehstaender') return drehstaender(element);
  if (element.vorlageId === 'schuette' || /schütte/i.test(element.name)) return schuette(element);
  if (element.vorlageId === 'display' || /display/i.test(element.name)) return display(element);
  return klotz(element);
}
