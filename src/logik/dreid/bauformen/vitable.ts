import { felderVon } from '../../regalseiten';
import { auflageFuer, IFKO, nutzbreite } from '../../ifko';
import {
  halbellipse,
  nachInnen,
  prisma,
  quader,
  seitenplatte,
  spiegele,
  trapez,
  viertelkreis,
  wandplatte,
  type Bauteil,
} from '../bauteile';
import { hoeheVon } from '../moebel';
import type { PlanElement, Regalfeld } from '../../../typen/modell';

/**
 * Obst und Gemüse – Wanzl Vitable, aus dem Workbook Version 38 (10/2025).
 *
 * Hinten stehen an jeder Feldgrenze schlanke **L-Säulen** (30 × 80 mm) in
 * Schwarz Metallic, an jede ist unten ein **Fußrohr** angeschweißt, das bis
 * zur Vorderkante des Korpus auf dem Boden liegt. Zwischen den Säulen die
 * **Gitter-Rückwand**, darüber eine Blechverkleidung mit Dekor. In die
 * Säulen hängen schräge Konsolen: Die **Auflagen fallen um etwa 25° nach
 * vorn**, die unterste ist die tiefste (T800 oder T1200), darüber sitzen bis
 * zu zwei kürzere (T600, T400). Ihre Hinterkanten stehen im Katalog auf den
 * Zentimeter: 117,8 (T1200), 100,9 (T800) oder 65,9 (T800 unten, bei drei
 * Stufen oder niedrigen Möbeln); die Vorderkante der untersten liegt damit
 * immer bei ≈ 67 cm. Unter ihr verschließt die **Hygieneklappe** die Front bis
 * kurz über den Boden, vorn sitzt ein **Frontgitter** (6 cm). Die Zugenden
 * schließen **Holz-Seitenwände** ab.
 *
 * Auf den Auflagen liegen die **grünen Kisten** – so, wie `logik/ifko.ts`
 * sie zählt: T400 eine Reihe quer, T600 eine Reihe längs, T800 zwei quer,
 * T1200 zwei längs, je Feld auf der Nutzbreite ohne Grifflücke.
 */

const NEIGUNG = 25;
const SAEULE_B = 3;
const SAEULE_T = 8;
const FUSS_H = 8;
const AUFLAGE = 2;
const KISTE_H = 19;
const KLAPPE_STAERKE = 1.5;
const FRONTGITTER_H = 6;

const SIN = Math.sin((NEIGUNG * Math.PI) / 180);
const COS = Math.cos((NEIGUNG * Math.PI) / 180);

/** Die Stufen eines Möbels – aus dem Element oder aus seiner Tiefe geschätzt. */
function stufenVon(element: PlanElement, seitentiefe: number): number[] {
  if (element.stufen && element.stufen.length > 0) return element.stufen;
  return [seitentiefe >= 120 ? 120 : 80];
}

/**
 * Die Hinterkante der untersten Auflage – die Katalogzahlen.
 *
 * Bei drei Stufen oder einem niedrigen Möbel (H1100/H1300) mit zwei Stufen
 * ist es die „T800 unten"-Ausführung.
 */
function untersteHinterkante(stufen: number[], hoehe: number): number {
  if (stufen.length >= 3 || (stufen.length >= 2 && hoehe <= 130)) return 65.9;
  return stufen[0] >= 100 ? 117.8 : 100.9;
}

/** Die Feldgrenzen als x-Werte. */
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
 * Die Kisten auf einer Auflage eines Feldes.
 *
 * `d` ist der Abstand entlang der geneigten Auflage ab der Hinterkante; die
 * Kiste sitzt geneigt wie die Auflage, ihr hinterer unterer Punkt liegt dort,
 * wo die Auflage ist.
 */
function kisten(
  x0: number,
  feldbreite: number,
  yHinten: number,
  zHinten: number,
  tiefe: number,
): Bauteil[] {
  const teile: Bauteil[] = [];
  const auflage = auflageFuer(tiefe);
  const kisteBreite = auflage.lage === 'quer' ? IFKO.lang : IFKO.kurz;
  const kisteTiefe = auflage.lage === 'quer' ? IFKO.kurz : IFKO.lang;
  const nutz = nutzbreite(feldbreite);
  const anzahl = Math.floor(nutz / kisteBreite);
  if (anzahl <= 0) return teile;
  const rand = (feldbreite - anzahl * kisteBreite) / 2;
  const reihenTiefe = auflage.reihen * kisteTiefe;
  const start = Math.max(0, (tiefe - reihenTiefe) / 2);

  for (let reihe = 0; reihe < auflage.reihen; reihe++) {
    const d = start + reihe * kisteTiefe;
    const y = yHinten + d * COS;
    const z = zHinten + AUFLAGE - d * SIN;
    for (let k = 0; k < anzahl; k++) {
      teile.push(
        quader(x0 + rand + k * kisteBreite + 1, y, z, kisteBreite - 2, kisteTiefe - 2, KISTE_H, 'kiste', {
          neigung: NEIGUNG,
        }),
      );
    }
  }
  return teile;
}

/**
 * Eine Vitable-Seite: Säule hinten bei `y = 0`, Front bei `y = tiefe`.
 *
 * Bei `mitSaeulen = false` fehlen Säule und Rückwand – die Gondel baut sie
 * einmal in der Mitte.
 */
function vitableSeite(
  felder: Regalfeld[],
  tiefe: number,
  stufen: number[],
  hoehe: number,
  mitSaeulen: boolean,
): Bauteil[] {
  const teile: Bauteil[] = [];
  const kanten = grenzen(felder);
  const gesamt = kanten[kanten.length - 1];
  if (gesamt <= 0) return teile;

  const hk0 = untersteHinterkante(stufen, hoehe);
  const unterste = stufen[0];
  const korpus = Math.min(tiefe - 2, SAEULE_T + unterste * COS);

  // Säulen und Fußrohre.
  for (const x of kanten) {
    if (mitSaeulen) teile.push(quader(x - SAEULE_B / 2, 0, 0, SAEULE_B, SAEULE_T, hoehe, 'regalDunkel'));
    teile.push(quader(x - SAEULE_B / 2, 0, 0, SAEULE_B, korpus, FUSS_H, 'regalDunkel'));
  }
  if (mitSaeulen) {
    teile.push(wandplatte(0, SAEULE_T / 2 - 0.4, FUSS_H, gesamt, hoehe - FUSS_H, 'gitter', 0.8));
  }

  // Die Auflagen, von unten nach oben.
  let hinterkante = hk0;
  const hinterkanten: number[] = [];
  stufen.forEach((d, i) => {
    if (i > 0) hinterkante += 30 + 0.2 * d;
    hinterkanten.push(hinterkante);
  });
  const obersteKante = hinterkanten[hinterkanten.length - 1] + 12;

  // Dekor-Rückwand über der obersten Auflage.
  if (mitSaeulen && hoehe > obersteKante + 15) {
    teile.push(wandplatte(0, SAEULE_T / 2 + 0.8, obersteKante, gesamt, hoehe - obersteKante - 4, 'holzHell', 1.2));
  }

  felder.forEach((feld, i) => {
    if (feld.leer) return;
    const x0 = kanten[i];
    const b = feld.breite;
    stufen.forEach((d, s) => {
      const z = hinterkanten[s];
      const yHinten = SAEULE_T;
      teile.push(quader(x0, yHinten, z, b, d, AUFLAGE, 'edelstahl', { neigung: NEIGUNG }));
      // Frontgitter an der Vorderkante der Auflage.
      const yVorn = yHinten + d * COS;
      const zVorn = z - d * SIN;
      teile.push(quader(x0, yVorn - 0.6, zVorn + AUFLAGE, b, 0.6, FRONTGITTER_H, 'chrom'));
      teile.push(...kisten(x0, b, yHinten, z, d));
      if (s === 0) {
        // Hygieneklappe: von der Vorderkante fast bis zum Boden, leicht
        // nach hinten geneigt.
        teile.push(quader(x0, yVorn - KLAPPE_STAERKE, 3, b, KLAPPE_STAERKE, zVorn - 3, 'regalDunkel'));
        // Stützblech unter der Vorderkante der Konsole.
        teile.push(quader(x0 + 0.5, yVorn - 6, FUSS_H, 1.5, 5, zVorn - FUSS_H, 'regalDunkel'));
        teile.push(quader(x0 + b - 2, yVorn - 6, FUSS_H, 1.5, 5, zVorn - FUSS_H, 'regalDunkel'));
      }
    });
  });

  // Holz-Seitenwände an den Zugenden.
  const seitenhoehe = hk0 + 12;
  teile.push(seitenplatte(-1.9, 0, 0, korpus, seitenhoehe, 'holzHell', 1.9));
  teile.push(seitenplatte(gesamt, 0, 0, korpus, seitenhoehe, 'holzHell', 1.9));
  return teile;
}

function gerade(element: PlanElement): Bauteil[] {
  const felder = felderVon(element, 'unten');
  const hoehe = hoeheVon(element);
  return vitableSeite(felder, element.tiefe, stufenVon(element, element.tiefe), hoehe, true);
}

function gondel(element: PlanElement): Bauteil[] {
  const hoehe = hoeheVon(element);
  const mitte = element.tiefe / 2;
  const stufen = stufenVon(element, mitte);
  const vorn = felderVon(element, 'unten');
  const hinten = felderVon(element, 'oben');
  const kanten = grenzen(vorn);
  const gesamt = kanten[kanten.length - 1];

  const teile: Bauteil[] = [];
  // Die T-Säule in der Mitte mit dem Gitter.
  for (const x of kanten) {
    teile.push(quader(x - SAEULE_B / 2, mitte - SAEULE_T / 2, 0, SAEULE_B, SAEULE_T, hoehe, 'regalDunkel'));
  }
  teile.push(wandplatte(0, mitte - 0.4, FUSS_H, gesamt, hoehe - FUSS_H, 'gitter', 0.8));

  const seite = (felder: Regalfeld[]) =>
    vitableSeite(felder, mitte, stufen, hoehe, false).map((teil) =>
      teil.art === 'prisma'
        ? { ...teil, punkte: teil.punkte.map((p) => ({ x: p.x, y: p.y + mitte })) }
        : { ...teil, y: teil.y + mitte },
    );
  teile.push(...seite(vorn));
  teile.push(...spiegele(seite(hinten), element.tiefe));
  return teile;
}

/**
 * Die runden und eckigen Abschlüsse – kegelförmige Auslagen um eine Säule.
 *
 * Der Kegel ist hier eine flache Auflage in mittlerer Höhe (zwischen der
 * Spitze an der Säule und der Außenkante bei ≈ 67 cm), darunter die gebogene
 * Frontverkleidung bis kurz über den Boden. Das trifft den Umriss und die
 * Höhe; die Neigung des Kegels fehlt.
 */
function kopf(element: PlanElement, umriss: { x: number; y: number }[]): Bauteil[] {
  const hoehe = hoeheVon(element);
  const stufen = stufenVon(element, element.tiefe);
  const spitze = untersteHinterkante(stufen, hoehe);
  const auflage = (spitze + 67) / 2;
  const teile: Bauteil[] = [];
  teile.push(prisma(nachInnen(umriss, 2), 3, auflage - 3, 'regalDunkel'));
  teile.push(prisma(umriss, auflage, AUFLAGE, 'edelstahl'));
  teile.push(prisma(nachInnen(umriss, 3), auflage + AUFLAGE, 4, 'chrom'));
  // Ein paar Kisten in der Mitte.
  const mx = umriss.reduce((s, p) => s + p.x, 0) / umriss.length;
  const my = umriss.reduce((s, p) => s + p.y, 0) / umriss.length;
  teile.push(quader(mx - IFKO.lang / 2 - 1, my - IFKO.kurz, auflage + AUFLAGE, IFKO.lang - 2, IFKO.kurz - 2, KISTE_H, 'kiste'));
  if (element.breite > 120) {
    teile.push(quader(mx - IFKO.lang - 2, my + 2, auflage + AUFLAGE, IFKO.lang - 2, IFKO.kurz - 2, KISTE_H, 'kiste'));
    teile.push(quader(mx + 2, my + 2, auflage + AUFLAGE, IFKO.lang - 2, IFKO.kurz - 2, KISTE_H, 'kiste'));
  }
  return teile;
}

export function vitableBauteile(element: PlanElement): Bauteil[] {
  switch (element.form) {
    case 'vitableAbschlussRund':
      return kopf(element, halbellipse(element.breite, element.tiefe - 2));
    case 'vitableAbschluss':
      return kopf(element, viertelkreis(Math.min(element.breite, element.tiefe) - 2));
    case 'vitableEckInnen':
      return kopf(element, trapez(element.breite, element.tiefe, 0.35));
    case 'vitableEckAussen':
      return kopf(element, trapez(element.breite, element.tiefe, 0.6));
    default:
      return element.beidseitig ? gondel(element) : gerade(element);
  }
}
