import { prisma, quader, trapez, wandplatte, type Bauteil } from '../bauteile';
import { hoeheVon } from '../moebel';
import type { PlanElement } from '../../../typen/modell';

/**
 * Backwaren – Wanzl BakeOff 3.0, aus dem Workbook Version 18 (08/2025).
 *
 * Der Turm ist ein hohes, schmales Gestell aus vier schwarzen Ständern,
 * 100 × 88,5 cm Stellfläche, 185,5 hoch. Unten Stellfüße und die
 * **Sockelblende** (4,5–11 cm), darüber der **Unterbau** (14,5–53 cm) mit der
 * **Holzdekor-Front** – das einzige große Holzteil und der Farbkontrast zum
 * dunklen Turm. Ab 53 cm die Warenzone: **vier Etagen** à 31 cm, jede ein
 * flacher schwarzgrauer Rahmen mit geneigter Warenfläche und vorn **drei
 * Glasklappen** zwischen zwei schmalen Stegen, unten je eine helle
 * Preisschiene. Oben ein schwarzer Kopfrahmen mit **Glasdach**.
 *
 * Front und Rückständer neigen sich in Wirklichkeit um 3,5–4° nach hinten;
 * hier steht der Turm senkrecht – der Katalog selbst sagt, dass das für ein
 * einfaches Modell reicht.
 */

const STAENDER = 4;
const SOCKEL_VON = 4.5;
const SOCKEL_BIS = 11;
const UNTERBAU_VON = 14.5;
const UNTERBAU_BIS = 53;
const HOLZFRONT = 1.9;
const WARENZONE_BIS = 178;
const KOPF_BIS = 185.5;
const ETAGEN = 4;
const KLAPPEN = 3;
const STEG = 2;
const PREISSCHIENE = 4;
const RAHMEN_H = 3;

function turm(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const f = hoehe / KOPF_BIS; // ein Turm, der nicht 185,5 hoch ist, skaliert mit
  const teile: Bauteil[] = [];

  // Vier Ständer.
  for (const [x, y] of [
    [1, 2],
    [b - STAENDER - 1, 2],
    [1, t - STAENDER - 2],
    [b - STAENDER - 1, t - STAENDER - 2],
  ]) {
    teile.push(quader(x, y, 0, STAENDER, STAENDER, hoehe, 'schwarz'));
  }

  // Sockelblende, Unterbau mit Holzfront.
  teile.push(wandplatte(0, t - 6, SOCKEL_VON * f, b, (SOCKEL_BIS - SOCKEL_VON) * f, 'anthrazit', 1));
  teile.push(quader(2, 6, UNTERBAU_VON * f, b - 4, t - 8, (UNTERBAU_BIS - UNTERBAU_VON) * f, 'anthrazit'));
  teile.push(wandplatte(0, t - 2 - HOLZFRONT, UNTERBAU_VON * f, b, (UNTERBAU_BIS - UNTERBAU_VON) * f, 'holzHell', HOLZFRONT));

  // Rückwand über der Warenzone.
  teile.push(wandplatte(0, 5, UNTERBAU_BIS * f, b, (WARENZONE_BIS - UNTERBAU_BIS) * f, 'anthrazit', 1.6));

  // Die Etagen.
  const etagenHoehe = ((WARENZONE_BIS - UNTERBAU_BIS) * f) / ETAGEN;
  const klappenBreite = (b - 6 - STEG * (KLAPPEN - 1)) / KLAPPEN;
  for (let e = 0; e < ETAGEN; e++) {
    const z = UNTERBAU_BIS * f + e * etagenHoehe;
    // Rahmen und Warenfläche.
    teile.push(quader(3, 6, z, b - 6, t - 10, RAHMEN_H, 'anthrazit'));
    teile.push(quader(4, 8, z + RAHMEN_H, b - 8, t - 18, 1.5, 'holzHell', { neigung: 10 }));
    // Ware: Brote als helle Blöcke.
    teile.push(quader(8, 14, z + RAHMEN_H + 1.5, b - 16, t - 34, 9, 'ware', { neigung: 10 }));
    // Glasklappen und Stege.
    for (let k = 0; k < KLAPPEN; k++) {
      const x = 3 + k * (klappenBreite + STEG);
      teile.push(wandplatte(x, t - 3, z + RAHMEN_H + PREISSCHIENE, klappenBreite, etagenHoehe - RAHMEN_H - PREISSCHIENE - 1, 'glas', 0.5));
      teile.push(wandplatte(x, t - 3.2, z + RAHMEN_H, klappenBreite, PREISSCHIENE, 'preisschiene', 0.8));
      if (k < KLAPPEN - 1) {
        teile.push(quader(x + klappenBreite, t - 4, z + RAHMEN_H, STEG, 3, etagenHoehe - RAHMEN_H, 'anthrazit'));
      }
    }
    // Seitengläser.
    teile.push(quader(1, 8, z + RAHMEN_H, 0.5, t - 12, etagenHoehe - RAHMEN_H - 1, 'glas'));
    teile.push(quader(b - 1.5, 8, z + RAHMEN_H, 0.5, t - 12, etagenHoehe - RAHMEN_H - 1, 'glas'));
  }

  // Kopfrahmen und Glasdach.
  teile.push(quader(0, 2, WARENZONE_BIS * f, b, t - 4, (KOPF_BIS - WARENZONE_BIS) * f - 1, 'schwarz'));
  teile.push(quader(1, 3, hoehe - 1, b - 2, t - 6, 1, 'glas'));
  return teile;
}

/**
 * Das Eckstück 45° – im Workbook nicht enthalten, aus dem Turm abgeleitet:
 * dieselben Höhenschichten, der Grundriss ein Trapez wie im Symbol.
 */
function eckstueck(element: PlanElement): Bauteil[] {
  const hoehe = hoeheVon(element);
  const f = hoehe / KOPF_BIS;
  const umriss = trapez(element.breite, element.tiefe, 0.5);
  return [
    prisma(umriss, SOCKEL_VON * f, (UNTERBAU_BIS - SOCKEL_VON) * f, 'anthrazit'),
    prisma(umriss, UNTERBAU_BIS * f, (WARENZONE_BIS - UNTERBAU_BIS) * f, 'regalDunkel'),
    prisma(umriss, WARENZONE_BIS * f, (KOPF_BIS - WARENZONE_BIS) * f - 1, 'schwarz'),
    prisma(umriss, hoehe - 1, 1, 'glas'),
  ];
}

export function bakeoffBauteile(element: PlanElement): Bauteil[] {
  return element.form === 'bakeoffEcke' ? eckstueck(element) : turm(element);
}
