import { KASSE_BAND, kassenfugen } from '../../kassen';
import {
  platte,
  quader,
  saeule,
  seitenplatte,
  spiegele,
  verteileHoehen,
  wandplatte,
  zylinder,
  type Bauteil,
} from '../bauteile';
import { hoeheVon } from '../moebel';
import type { PlanElement } from '../../../typen/modell';

/**
 * Die Kassenzone – Wanzl (Standard, Genesis, KLS) und ITAB (Straight IV,
 * C-MAX, MoveFlow), nach den Datenblättern und Maßzeichnungen der Hersteller.
 *
 * **Die Kassenzeile ist ein langes Möbel mit vier Abschnitten**, und die
 * stehen schon in `logik/kassen.ts`, weil die Bibliothek und der Grundriss
 * sie ebenfalls brauchen: Kopfteil 42,8 cm, Warenband (wählbar), Kassenplatz
 * 61,8 cm, Abpacktisch 106,7 cm. Hier wird daraus ein Körper – dieselben
 * Fugen, nur mit Höhe.
 *
 * Quer dazu liegt die Kundenseite bei `y = 0`: Dort läuft das Band, dort
 * steht der Wagen. Die Bedienung sitzt bei `y = tiefe`, so wie der Stuhl im
 * Grundriss neben dem Möbel steht.
 *
 * Was aus der Recherche in die Maße eingeht:
 *
 * ```
 *   Arbeitshöhe        87,8 (Wanzl Standard) · 84,5 Sitz / 96 Steh (ITAB)
 *   Sockel                8–10, umlaufend, Edelstahl gegen die Putzmaschine
 *   Bandgehäuse        53 (Genesis) bis 64,6 (Standard) breit
 *   Warenband          40–45 breit, dunkles Gummi
 *   Warentrenner       30 × 3 × 3
 *   Scannerfach        29,4 × 40, 10 tief (Datalogic Magellan 9300i)
 *   Kassenlade         46 × 17,5 × 10
 *   Spuckschutz        Oberkante 122 (ITAB) bis 133,4 (Wanzl)
 *   Packmulde          130–140 breit, Aufkantung 2
 *   Leitsystem-Mast    238 (Wanzl KLS) · 182 gesamt (ITAB Linear)
 * ```
 *
 * Die Höhe des Elements gewinnt: Wer eine Sitzkasse auf 84,5 stellt, bekommt
 * eine, die 84,5 hoch ist. Alles darüber – Spuckschutz, Bildschirm, Mast –
 * hängt an der Arbeitshöhe und wandert mit.
 */

/** Der Sockel unter jedem Kassenmöbel, in cm. */
const SOCKEL = 9;
/** Wie weit der Sockel zurückspringt. */
const SOCKEL_RAND = 2.5;
/** Der Rammschutz auf Höhe des Einkaufswagenkorbs. */
const RAMMSCHUTZ_H = 6;
/** Die Aufkantung der Packmulde. */
const AUFKANTUNG = 2;
/** Oberkante des Spuckschutzes über dem Boden. */
const SPUCKSCHUTZ = 133.4;
/** Der Leitsystem-Mast mit der Kassennummer. */
const MAST = 238;

/** Sockel und Korpus eines Abschnitts – das, was jedes Kassenmöbel hat. */
function korpus(
  x: number,
  y: number,
  b: number,
  t: number,
  hoehe: number,
  farbe: 'anthrazit' | 'hellgrau' = 'anthrazit',
): Bauteil[] {
  if (!(b > 0) || !(t > 0)) return [];
  return [
    quader(x + SOCKEL_RAND, y + SOCKEL_RAND, 0, b - 2 * SOCKEL_RAND, t - 2 * SOCKEL_RAND, SOCKEL, 'edelstahl'),
    quader(x, y, SOCKEL, b, t, hoehe - SOCKEL - 2, farbe),
    platte(x, y, hoehe - 2, b, t, 'edelstahl'),
  ];
}

/** Der Rammschutz: eine umlaufende Leiste auf Korbhöhe. */
function rammschutz(b: number, t: number, hoehe: number): Bauteil[] {
  const z = Math.max(SOCKEL + 2, hoehe - 18);
  return [
    wandplatte(-1, -1.5, z, b + 2, RAMMSCHUTZ_H, 'schwarz', 1.5),
    wandplatte(-1, t, z, b + 2, RAMMSCHUTZ_H, 'schwarz', 1.5),
  ];
}

/**
 * Der Kassenplatz: Scanner, Lade, Bildschirm, Terminal, Spuckschutz.
 *
 * `x` ist der linke Rand des Abschnitts, `laenge` seine Länge. Alles
 * Aufbauende hängt an der Arbeitshöhe.
 */
function kassenplatz(x: number, laenge: number, t: number, hoehe: number): Bauteil[] {
  const teile: Bauteil[] = [];
  const mitte = x + laenge / 2;

  // Das Scannerfach, in die Arbeitsfläche eingelassen: 29,4 × 40, 10 tief.
  const scanB = Math.min(40, laenge - 8);
  const scanT = Math.min(29.4, t - 12);
  if (scanB > 0 && scanT > 0) {
    teile.push(quader(mitte - scanB / 2, (t - scanT) / 2, hoehe - 2.5, scanB, scanT, 2.5, 'schwarz'));
    // Das Fenster der Waage – die Glasscheibe, über die gezogen wird.
    teile.push(platte(mitte - scanB / 2 + 3, (t - scanT) / 2 + 3, hoehe - 0.4, scanB - 6, scanT - 6, 'glas', 0.6));
  }

  // Die Kassenlade, bedienerseitig unter der Arbeitsfläche.
  if (laenge > 20 && t > 25) {
    teile.push(quader(mitte - 23, t - 20, hoehe - 14, Math.min(46, laenge - 4), 17.5, 10, 'schwarz'));
  }

  // Bildschirm und Kundendisplay auf einem Schwenkarm.
  const armX = Math.min(x + laenge - 6, x + laenge * 0.85);
  teile.push(saeule(armX, t - 10, 1.6, hoehe + 32, 'hellgrau'));
  teile.push(quader(armX - 17, t - 12, hoehe + 26, 34, 3, 22, 'schwarz', { neigung: -12 }));
  // Das Kundendisplay, kleiner und andersherum.
  teile.push(quader(armX - 8, 6, hoehe + 6, 16, 2.5, 10, 'schwarz', { neigung: 12 }));

  // Kartenterminal und Bondrucker.
  teile.push(quader(x + 4, 8, hoehe, 10, 12, 9, 'schwarz', { neigung: -25 }));
  teile.push(quader(x + 3, t - 22, hoehe, 15, 20, 15, 'hellgrau'));

  // Der Spuckschutz zwischen Kunde und Bedienung.
  const scheibe = Math.min(70, laenge + 8);
  if (SPUCKSCHUTZ > hoehe + 10) {
    teile.push(
      wandplatte(mitte - scheibe / 2, t / 2 - 1, hoehe + 4, scheibe, SPUCKSCHUTZ - hoehe - 4, 'glas', 1),
    );
  }
  return teile;
}

/** Der Leitsystem-Mast mit der Kassennummer. */
function mast(x: number, t: number): Bauteil[] {
  return [
    saeule(x, t - 6, 2.2, MAST - 14, 'hellgrau'),
    quader(x - 12, t - 8, MAST - 26, 24, 4, 20, 'weiss'),
    zylinder(x, t - 6, MAST - 6, 3.2, 6, 'z', 'kiste'),
  ];
}

/**
 * Das Warenband mit seinem Gehäuse.
 *
 * Das Gehäuse ist Teil des Korpus; hier kommt nur oben das dunkle Gummiband
 * hinein, dazu die Schiene mit den Warentrennern an der Außenkante.
 */
function warenband(x: number, laenge: number, t: number, hoehe: number): Bauteil[] {
  if (!(laenge > 1)) return [];
  const breite = Math.min(KASSE_BAND, t - 8);
  const teile: Bauteil[] = [
    platte(x, 4, hoehe - 1.6, laenge, breite, 'schwarz', 1.8),
    // Die Führungsschiene an der Außenkante, darauf die Warentrenner.
    wandplatte(x, 2, hoehe, laenge, 2.5, 'hellgrau', 1.5),
  ];
  const trenner = Math.max(1, Math.floor(laenge / 70));
  for (let i = 0; i < trenner; i++) {
    const tx = x + ((i + 0.5) * laenge) / trenner - 15;
    teile.push(quader(tx, 5, hoehe + 0.4, 30, 3, 3, 'preisschiene'));
  }
  // Die Tütenhaken darunter, kundenseitig.
  teile.push(wandplatte(x + laenge * 0.2, -0.5, hoehe - 22, laenge * 0.6, 3, 'hellgrau', 1));
  return teile;
}

/**
 * Der Abpacktisch: die Edelstahlmulde mit Aufkantung und Glaseinsatz.
 *
 * Sie liegt eine Handbreit tiefer als die Arbeitsfläche, damit die Ware ohne
 * Hebearbeit hineinläuft. Vorn eine Scheibe, durch die das Personal das
 * Untergestell des Wagens sieht.
 */
function packmulde(x: number, laenge: number, t: number, hoehe: number): Bauteil[] {
  if (!(laenge > 4)) return [];
  const tiefe = 11;
  const rand = 3;
  return [
    // Der Muldenboden, leicht geneigt zur Mitte hin.
    platte(x + rand, rand, hoehe - tiefe, laenge - 2 * rand, t - 2 * rand, 'edelstahl'),
    // Die vier Wände der Wanne.
    wandplatte(x + rand, rand, hoehe - tiefe, laenge - 2 * rand, tiefe, 'edelstahl', 1),
    wandplatte(x + rand, t - rand - 1, hoehe - tiefe, laenge - 2 * rand, tiefe, 'edelstahl', 1),
    seitenplatte(x + rand, rand, hoehe - tiefe, t - 2 * rand, tiefe, 'edelstahl'),
    seitenplatte(x + laenge - rand - 1, rand, hoehe - tiefe, t - 2 * rand, tiefe, 'edelstahl'),
    // Die Aufkantung ringsum.
    wandplatte(x, 0, hoehe, laenge, AUFKANTUNG, 'edelstahl', 1.2),
    wandplatte(x, t - 1.2, hoehe, laenge, AUFKANTUNG, 'edelstahl', 1.2),
    // Der Warentrenner, der die Mulde für zwei Kunden teilt.
    seitenplatte(x + laenge / 2, t * 0.2, hoehe - tiefe, t * 0.6, tiefe + 6, 'hellgrau', 1.2),
    // Die Glasscheibe in der Front.
    wandplatte(x + laenge * 0.2, -0.6, hoehe - 34, laenge * 0.6, 24, 'glas', 1),
  ];
}

/** Der Stuhl der Sitzkasse – er steht neben dem Möbel, wie im Grundriss. */
function stuhl(x: number, t: number): Bauteil[] {
  const y = t + 22;
  return [
    saeule(x, y, 2.5, 44, 'hellgrau'),
    zylinder(x, y, 0, 20, 1.5, 'z', 'hellgrau'),
    zylinder(x, y, 44, 17, 5, 'z', 'schwarz'),
    wandplatte(x - 16, y + 14, 49, 32, 34, 'schwarz', 3),
  ];
}

/** Eine bediente Kassenzeile mit Warenband. */
function bandkasse(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const hoehe = hoeheVon(element);
  const doppelt = element.form === 'kasseDoppel';
  // Bei der Doppelkasse ist eine Bahn so tief wie eine Einzelkasse; die Insel
  // dazwischen ist der Rest.
  const bahn = doppelt ? Math.min(48, element.tiefe / 3) : element.tiefe;
  const t = bahn;

  const { x1, x2, x3 } = kassenfugen(b, Boolean(element.gespiegelt));
  const gespiegelt = Boolean(element.gespiegelt);
  const bandVon = gespiegelt ? x2 : x1;
  const bandBis = gespiegelt ? x3 : x2;
  const platzVon = gespiegelt ? x1 : x2;
  const platzBis = gespiegelt ? x2 : x3;
  const packVon = gespiegelt ? 0 : x3;
  const packBis = gespiegelt ? x1 : b;

  const teile: Bauteil[] = [];
  // Kopfteil, Band, Kassenplatz: ein durchgehender Korpus.
  const korpusVon = gespiegelt ? x1 : 0;
  const korpusBis = gespiegelt ? b : x3;
  teile.push(...korpus(korpusVon, 0, korpusBis - korpusVon, t, hoehe));
  teile.push(...warenband(bandVon, bandBis - bandVon, t, hoehe));
  teile.push(...kassenplatz(platzVon, platzBis - platzVon, t, hoehe));

  // Der Abpacktisch: eigener Korpus mit der Mulde darin.
  teile.push(...korpus(packVon, 0, packBis - packVon, t, hoehe));
  teile.push(...packmulde(packVon, packBis - packVon, t, hoehe));

  teile.push(...rammschutz(b, t, hoehe));
  teile.push(...mast(gespiegelt ? platzBis - 6 : platzVon + 6, t));

  if (doppelt) {
    // Die zweite Bahn spiegelverkehrt an der anderen Außenseite, dazwischen
    // die Bedieninsel, auf der beide Kassenplätze Rücken an Rücken sitzen.
    const gesamt = element.tiefe;
    const insel = gesamt - 2 * bahn;
    const zurueck = spiegele(teile, gesamt);
    const mitte: Bauteil[] = insel > 4 ? korpus(0, bahn, b, insel, hoehe, 'hellgrau') : [];
    return [...teile, ...mitte, ...zurueck];
  }

  if (element.form === 'kasseSitz') {
    teile.push(...stuhl((platzVon + platzBis) / 2, t));
  }
  return teile;
}

/** Die Expresskasse: derselbe Tisch, nur kurz und ohne Band. */
function expresskasse(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const platz = Math.min(62, b * 0.55);
  const teile = korpus(0, 0, b, t, hoehe);
  teile.push(...kassenplatz((b - platz) / 2, platz, t, hoehe));
  // Statt der Packmulde eine kurze Warenwanne am rechten Ende.
  const wanne = Math.min(50, (b - platz) / 2);
  if (wanne > 8) teile.push(...packmulde(b - wanne, wanne, t, hoehe));
  // Und links die Auflagefläche für den Korb.
  teile.push(...rammschutz(b, t, hoehe));
  return teile;
}

/**
 * Die Packrutsche: die Mulde ohne Kasse davor.
 *
 * Ein eigenes Möbel im Katalog (PR 1000), das hinter dem Kassenplatz steht,
 * wenn die Zeile länger werden soll.
 */
function packrutsche(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const teile = korpus(0, 0, b, t, hoehe);
  teile.push(...packmulde(0, b, t, hoehe));
  // Die Rollenbahn im Muldenboden.
  const rollen = Math.max(2, Math.floor(b / 12));
  for (let i = 0; i < rollen; i++) {
    teile.push(zylinder(((i + 0.5) * b) / rollen, 5, hoehe - 8, 1.8, t - 10, 'y', 'hellgrau'));
  }
  teile.push(...rammschutz(b, t, hoehe));
  return teile;
}

/**
 * Die Kassengondel: das Vorsatzregal mit der Quengelware.
 *
 * Niedrig, damit die Sichtachse über die Kassenzone frei bleibt, und
 * beidseitig bestückt: Fuß, Rückwand in der Mitte, vier bis fünf Böden je
 * Seite, unten tiefer als oben.
 */
function kassengondel(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const teile: Bauteil[] = [];

  // Fuß und Rückwand.
  teile.push(quader(1, 2, 0, b - 2, t - 4, 10, 'hellgrau'));
  teile.push(wandplatte(0, t / 2 - 1.2, 10, b, hoehe - 10, 'anthrazit', 2.4));
  // Die Säulen an beiden Enden.
  for (const x of [0, b - 4]) {
    teile.push(quader(x, t / 2 - 4, 10, 4, 8, hoehe - 10, 'hellgrau'));
  }

  // Die Böden: unten tiefer, oben flacher – so hängt die Ware im Blick.
  const boeden = hoehe >= 130 ? 5 : 4;
  const hoehen = verteileHoehen(28, hoehe - 12, boeden);
  const vorn: Bauteil[] = [];
  hoehen.forEach((z, i) => {
    const anteil = 1 - (i / Math.max(1, boeden - 1)) * 0.35;
    const tiefe = Math.max(9, (t / 2 - 2) * anteil);
    vorn.push(platte(2, t / 2 - 1.4 - tiefe, z, b - 4, tiefe, 'hellgrau'));
    vorn.push(wandplatte(2, t / 2 - 1.4 - tiefe - 0.8, z + 2, b - 4, 3.2, 'preisschiene', 0.8));
  });
  return [...teile, ...vorn, ...spiegele(vorn, t)];
}

/**
 * Die SB-Kasse – ITAB MoveFlow, Diebold Nixdorf EASY eXpress.
 *
 * Ein geschlossener Standkorpus bis Arbeitshöhe, darauf die Scannerplatte,
 * daneben die Waage mit den Tütenbügeln, darüber der geneigte Touchscreen
 * und oben die Statusampel.
 */
function sbKasse(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  // Der Korpus reicht bis Arbeitshöhe; die Elementhöhe meint die Ampel oben.
  const arbeit = Math.min(90, hoehe * 0.6);
  const teile: Bauteil[] = [
    quader(2, 2, 0, b - 4, t - 4, SOCKEL, 'schwarz'),
    quader(0, 0, SOCKEL, b, t, arbeit - SOCKEL - 2, 'anthrazit'),
    platte(0, 0, arbeit - 2, b, t, 'edelstahl'),
  ];

  // Die Scannerplatte in der Mitte der Bedienseite.
  const scan = Math.min(38, b - 10);
  teile.push(quader((b - scan) / 2, t * 0.45, arbeit - 2.5, scan, Math.min(30, t * 0.4), 2.5, 'schwarz'));

  // Die Waage mit den Tütenbügeln – rechts, und bei breiten Geräten links auch.
  const fluegel = (x: number): Bauteil[] => [
    platte(x, 6, arbeit, Math.min(26, b * 0.3), t - 14, 'edelstahl'),
    saeule(x + 3, 10, 1, 26, 'chrom'),
    saeule(x + 3, t - 12, 1, 26, 'chrom'),
    zylinder(x + 3, 10, arbeit + 26, 1, t - 22, 'y', 'chrom'),
  ];
  teile.push(...fluegel(b - Math.min(28, b * 0.3)));
  if (b >= 110) teile.push(...fluegel(2));

  // Der Bildschirm, leicht nach hinten geneigt, und die Ampel darüber.
  const schirm = Math.min(40, b - 16);
  teile.push(quader((b - schirm) / 2, t * 0.2, arbeit, schirm, 3, 40, 'schwarz', { neigung: -14 }));
  teile.push(saeule(b / 2, t * 0.18, 1.8, hoehe - 12, 'hellgrau'));
  teile.push(zylinder(b / 2, t * 0.18, hoehe - 12, 3.4, 12, 'z', 'kiste'));
  return teile;
}

/**
 * Der Leergutautomat – TOMRA T70 / T90, und die eingebaute Rücknahme T9.
 *
 * Ein hochkant stehender Schrank mit geschlossener Front: unten die Tür zum
 * Sammelraum, auf 127–130 cm die runde Einwurföffnung, daneben Bonschlitz und
 * Kartenleser, oben das Display und die zweite Tür.
 */
function leergutautomat(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const einwurf = Math.min(130, hoehe - 45);
  const geraete = Math.max(1, Math.round(b / 90));
  const breite = b / geraete;

  const teile: Bauteil[] = [
    quader(0, 0, 0, b, t, hoehe, 'hellgrau'),
    // Die Sockelleiste und das Dach setzen den Schrank ab.
    quader(0, -0.6, 0, b, 1.2, 12, 'anthrazit'),
    platte(-1, -1, hoehe - 3, b + 2, t + 1, 'anthrazit', 3),
  ];

  for (let i = 0; i < geraete; i++) {
    const x = i * breite;
    // Die beiden Türen der Front.
    teile.push(wandplatte(x + 2, -0.8, 14, breite - 4, einwurf - 30, 'anthrazit', 1));
    teile.push(wandplatte(x + 2, -0.8, einwurf + 22, breite - 4, hoehe - einwurf - 34, 'anthrazit', 1));
    // Die runde Einwurföffnung mit ihrem Ring.
    teile.push(zylinder(x + breite / 2, 1, einwurf, 9, 3, 'y', 'schwarz'));
    teile.push(zylinder(x + breite / 2, -1.5, einwurf, 7, 4, 'y', 'edelstahl'));
    // Bonschlitz und Kartenleser darunter.
    teile.push(quader(x + breite / 2 + 12, -1.2, einwurf - 18, 10, 1.5, 2, 'schwarz'));
    teile.push(quader(x + breite / 2 - 22, -1.5, einwurf - 22, 8, 2, 8, 'schwarz'));
    // Das Display darüber.
    teile.push(wandplatte(x + breite / 2 - 10, -1.5, einwurf + 26, 21, 16, 'schwarz', 1.5));
  }
  return teile;
}

/**
 * Der Sammelbehälter für Einwegpfand und die Presse dahinter.
 *
 * Beides sind Kästen; der Behälter hat das Grundmaß einer Palette und ein
 * offenes Oberteil, die Presse einen Einwurfschacht.
 */
function leergutkasten(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  if (element.form === 'dpgBehaelter') {
    const wand = 3;
    return [
      quader(0, 0, 0, b, t, 12, 'anthrazit'),
      platte(wand, wand, 12, b - 2 * wand, t - 2 * wand, 'hellgrau', 2),
      wandplatte(0, 0, 12, b, hoehe - 12, 'hellgrau', wand),
      wandplatte(0, t - wand, 12, b, hoehe - 12, 'hellgrau', wand),
      seitenplatte(0, 0, 12, t, hoehe - 12, 'hellgrau', wand),
      seitenplatte(b - wand, 0, 12, t, hoehe - 12, 'hellgrau', wand),
    ];
  }
  // Die Presse: geschlossener Kasten mit Schacht und Bedienfeld.
  return [
    quader(0, 0, 0, b, t, hoehe, 'hellgrau'),
    quader(0, -0.8, 0, b, 1.2, 10, 'anthrazit'),
    wandplatte(b * 0.2, -1, hoehe - 55, b * 0.6, 35, 'anthrazit', 1.2),
    wandplatte(b * 0.3, -1.4, hoehe - 22, b * 0.4, 14, 'schwarz', 1.4),
  ];
}

/**
 * Die Kastenablage für das Mehrweg-Leergut.
 *
 * Ein Gestell mit zwei Bahnen übereinander, auf denen die Kästen stehen –
 * 40 cm je Kasten, so wird auch gerechnet.
 */
function kastenablage(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const bahnen = t >= 70 ? 2 : 1;
  const teile: Bauteil[] = [];

  // Die Ständer und die Böden.
  const ebenen = verteileHoehen(20, hoehe - 20, Math.max(2, Math.floor(hoehe / 45)));
  for (const x of [0, b / 2 - 2, b - 4]) {
    teile.push(quader(x, 2, 0, 4, t - 4, hoehe, 'regalDunkel'));
  }
  for (const z of ebenen) {
    teile.push(platte(1, 2, z, b - 2, t - 4, 'gitter', 2));
  }

  // Die Kästen darauf – 40 × 30, zwei Bahnen hintereinander.
  const je = Math.floor(b / 40);
  for (const z of ebenen) {
    for (let bahn = 0; bahn < bahnen; bahn++) {
      const y = 4 + bahn * ((t - 8) / bahnen);
      for (let i = 0; i < je; i++) {
        const material = (i + bahn) % 3 === 0 ? 'kisteRot' : (i + bahn) % 3 === 1 ? 'kiste' : 'ware';
        teile.push(quader(i * 40 + 1, y, z + 2, 38, Math.min(30, (t - 8) / bahnen - 2), 28, material));
      }
    }
  }
  return teile;
}

/** Welches Rezept eine Kassen- oder Leergutform bekommt. */
export function kassenBauteile(element: PlanElement): Bauteil[] {
  switch (element.form) {
    case 'kasse':
    case 'kasseSitz':
    case 'kasseDoppel':
      return bandkasse(element);
    case 'kasseExpress':
      return expresskasse(element);
    case 'packrutsche':
      return packrutsche(element);
    case 'kassengondel':
      return kassengondel(element);
    case 'sbKasse':
      return sbKasse(element);
    case 'automat':
    case 'leergutRuecknahme':
      return leergutautomat(element);
    case 'leergutEinweg':
    case 'dpgBehaelter':
      return leergutkasten(element);
    case 'kastenablage':
      return kastenablage(element);
    default:
      return [];
  }
}
