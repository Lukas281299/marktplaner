import { quader, seitenplatte, wandplatte, zylinder, type Bauteil } from '../bauteile';
import { hoeheVon, klotz } from '../moebel';
import type { PlanElement } from '../../../typen/modell';

/**
 * Bau, Technik und Eingang – das, was kein Möbel ist.
 *
 * Stützen sind Beton bis zur Decke, mit Rammschutz auf Kniehöhe. Die Treppe
 * ist ein Blocktreppe mit Stufen 28 × 17 (DIN 18065), der Aufzug ein Schacht
 * mit Edelstahltür. Die Kundenführung besteht aus Rohrbügeln, die
 * Schiebetüranlage aus Glasflügeln im Rahmen, das eGate aus Glasflügeln auf
 * Säulen, die Wagenbox aus Gitterwänden mit Dach.
 */

const RAUMHOEHE = 300;

function rundstuetze(element: PlanElement): Bauteil[] {
  const r = Math.min(element.breite, element.tiefe) / 2;
  const h = element.hoehe && element.hoehe > 0 ? element.hoehe : RAUMHOEHE;
  return [
    zylinder(element.breite / 2, element.tiefe / 2, 0, r, h, 'z', 'wand'),
    zylinder(element.breite / 2, element.tiefe / 2, 0, r + 1, 110, 'z', 'hellgrau'),
  ];
}

function eckstuetze(element: PlanElement): Bauteil[] {
  const h = element.hoehe && element.hoehe > 0 ? element.hoehe : RAUMHOEHE;
  return [
    quader(0, 0, 0, element.breite, element.tiefe, h, 'wand'),
    quader(-1, -1, 0, element.breite + 2, element.tiefe + 2, 110, 'hellgrau'),
  ];
}

/** Blocktreppe entlang der Breite, Geländerpfosten an beiden Seiten. */
function treppe(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const n = Math.max(3, Math.round(b / 28));
  const auftritt = b / n;
  const steigung = 17;
  const teile: Bauteil[] = [];
  for (let i = 0; i < n; i++) {
    teile.push(quader(i * auftritt, 0, 0, auftritt, t, steigung * (i + 1), 'hellgrau'));
    teile.push(quader(i * auftritt, 0, steigung * (i + 1) - 0.5, 3, t, 0.5, 'markierung', { farbe: '#f7b500' }));
  }
  for (let i = 0; i <= n; i += 3) {
    const x = Math.min(b - 2, i * auftritt + 2);
    const z = steigung * Math.min(n, i + 1);
    teile.push(zylinder(x, 3, z, 1.5, 90, 'z', 'edelstahl'));
    teile.push(zylinder(x, t - 3, z, 1.5, 90, 'z', 'edelstahl'));
  }
  return teile;
}

function aufzug(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  return [
    quader(0, 0, 0, b, t, RAUMHOEHE, 'wand'),
    wandplatte(b / 2 - 46, t - 1, 0, 92, 212, 'anthrazit', 1.5),
    wandplatte(b / 2 - 44, t - 0.5, 1, 43, 210, 'edelstahl', 1),
    wandplatte(b / 2 + 1, t - 0.5, 1, 43, 210, 'edelstahl', 1),
    wandplatte(b / 2 + 55, t - 0.5, 95, 10, 25, 'anthrazit', 1),
  ];
}

function unterzug(element: PlanElement): Bauteil[] {
  return [quader(0, 0, RAUMHOEHE - 50, element.breite, element.tiefe, 50, 'wand')];
}

function schacht(element: PlanElement): Bauteil[] {
  return [quader(0, 0, 0, element.breite, element.tiefe, RAUMHOEHE, 'wand')];
}

function feuerloescher(element: PlanElement): Bauteil[] {
  const x = element.breite / 2;
  const y = element.tiefe / 2;
  return [
    zylinder(x, y, 80, Math.min(8, element.breite / 2), 55, 'z', 'kisteRot'),
    zylinder(x, y, 135, 2, 8, 'z', 'schwarz'),
  ];
}

/** Kundenführung: Rohrbügel – zwei Pfosten, zwei Holme. */
function kundenfuehrung(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const y = element.tiefe / 2;
  return [
    zylinder(3, y, 0, 2.5, 100, 'z', 'chrom'),
    zylinder(b - 3, y, 0, 2.5, 100, 'z', 'chrom'),
    zylinder(0, y, 45, 2, b, 'x', 'chrom'),
    zylinder(0, y, 97, 2, b, 'x', 'chrom'),
  ];
}

/** Schiebetüranlage: Rahmen mit zwei Glasflügeln. */
function schiebetuer(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = Math.max(220, hoeheVon(element));
  const teile: Bauteil[] = [];
  teile.push(quader(0, 0, 0, 6, t, h, 'anthrazit'));
  teile.push(quader(b - 6, 0, 0, 6, t, h, 'anthrazit'));
  teile.push(quader(0, 0, h - 12, b, t, 12, 'anthrazit'));
  teile.push(wandplatte(6, t / 2 - 1, 2, b / 2 - 7, h - 14, 'glas', 1));
  teile.push(wandplatte(b / 2 + 1, t / 2, 2, b / 2 - 7, h - 14, 'glas', 1));
  return teile;
}

/** eGate: Säulen mit Glasflügeln dazwischen. */
function egate(element: PlanElement, doppel: boolean): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const saeulen = doppel ? 3 : 2;
  const teile: Bauteil[] = [];
  for (let i = 0; i < saeulen; i++) {
    const x = (i * (b - 18)) / (saeulen - 1);
    teile.push(quader(x, t / 2 - 9, 0, 18, 18, 105, 'anthrazit'));
    teile.push(quader(x + 3, t / 2 - 6, 105, 12, 12, 2, 'kisteRot'));
  }
  for (let i = 0; i < saeulen - 1; i++) {
    const x0 = (i * (b - 18)) / (saeulen - 1) + 18;
    const x1 = ((i + 1) * (b - 18)) / (saeulen - 1);
    teile.push(wandplatte(x0 + 2, t / 2 - 0.5, 8, (x1 - x0) / 2 - 3, 95, 'glas', 1));
    teile.push(wandplatte(x0 + (x1 - x0) / 2 + 1, t / 2 - 0.5, 8, (x1 - x0) / 2 - 3, 95, 'glas', 1));
  }
  return teile;
}

/** Ausgangsanlage: zwei Säulen und ein Schwenkflügel aus Glas. */
function ausgangsanlage(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  return [
    quader(0, t / 2 - 6, 0, 12, 12, 100, 'anthrazit'),
    quader(b - 12, t / 2 - 6, 0, 12, 12, 100, 'anthrazit'),
    wandplatte(12, t / 2 - 0.5, 6, b - 24, 92, 'glas', 1),
  ];
}

/** Einkaufswagenbox: Gitterwände auf Pfosten, ein Dach. */
function wagenbox(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = Math.max(120, hoeheVon(element));
  const teile: Bauteil[] = [];
  for (const [x, y] of [
    [0, 0],
    [b - 5, 0],
    [0, t - 5],
    [b - 5, t - 5],
  ]) {
    teile.push(quader(x, y, 0, 5, 5, h, 'anthrazit'));
  }
  teile.push(wandplatte(0, 0, 10, b, 110, 'gitter', 1));
  teile.push(seitenplatte(0, 0, 10, t, 110, 'gitter', 1));
  teile.push(seitenplatte(b - 1, 0, 10, t, 110, 'gitter', 1));
  if (h > 180) teile.push(quader(-5, -5, h - 6, b + 10, t + 10, 6, 'anthrazit'));
  // Ein paar Wagen darin: flache Körbe auf Rollen.
  const wagen = Math.max(1, Math.floor(t / 45));
  for (let i = 0; i < wagen; i++) {
    const y = 8 + i * 45;
    if (y + 40 > t) break;
    teile.push(quader(b / 2 - 28, y, 25, 56, 40, 40, 'gitter'));
    teile.push(quader(b / 2 - 30, y + 38, 95, 60, 3, 3, 'kisteRot'));
  }
  return teile;
}

/** Holzblende: eine Holzplatte entlang der Front, U-förmig auch an den Seiten. */
function holzblende(element: PlanElement, u: boolean): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const h = Math.max(30, Math.min(hoeheVon(element), 140));
  const teile: Bauteil[] = [wandplatte(0, t - 2, 0, b, h, 'holzHell', 2)];
  if (u) {
    teile.push(seitenplatte(0, 0, 0, t, h, 'holzHell', 2));
    teile.push(seitenplatte(b - 2, 0, 0, t, h, 'holzHell', 2));
  }
  return teile;
}

export function ausstattungBauteile(element: PlanElement): Bauteil[] {
  switch (element.form) {
    case 'saeule':
    case 'einzelsaeule':
      return rundstuetze(element);
    case 'stuetzeEckig':
      return eckstuetze(element);
    case 'treppe':
      return treppe(element);
    case 'aufzug':
      return aufzug(element);
    case 'unterzug':
      return unterzug(element);
    case 'schacht':
      return schacht(element);
    case 'feuerloescher':
      return feuerloescher(element);
    case 'kundenfuehrung':
      return kundenfuehrung(element);
    case 'schiebetueranlage':
      return schiebetuer(element);
    case 'egateEinzel':
      return egate(element, false);
    case 'egateDoppel':
      return egate(element, true);
    case 'ausgangsanlage':
      return ausgangsanlage(element);
    case 'wagenbox':
      return wagenbox(element);
    case 'holzblende':
      return holzblende(element, false);
    case 'holzblendeU':
      return holzblende(element, true);
    default:
      return klotz(element);
  }
}
