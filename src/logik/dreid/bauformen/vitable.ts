import { felderVon } from '../../regalseiten';
import { auflageFuer, IFKO, nutzbreite } from '../../ifko';
import {
  kugel,
  nachInnen,
  prisma,
  quader,
  rechteck,
  seitenplatte,
  spiegele,
  wandplatte,
  type Bauteil,
} from '../bauteile';
import { hoeheVon } from '../moebel';
import type { PlanElement, Punkt, Regalfeld } from '../../../typen/modell';

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

  // **Keine Auflage über der eingetragenen Höhe.** Der Kopf prüft das längst;
  // im geraden Zug fehlte es. Sechzehn Einträge der Bibliothek standen dadurch
  // 4 bis 21 cm höher, als am Möbel steht – und genau dafür ist die 3D-Ansicht
  // da: um zu sehen, ob man über das Möbel hinwegschaut.
  //
  // Gemessen wird bis zur Oberkante der Kisten: Die stehen auf der Auflage und
  // sind das, was am Ende oben herausragt.
  const passt = (z: number) => z + AUFLAGE + KISTE_H <= hoehe + 1;

  felder.forEach((feld, i) => {
    if (feld.leer) return;
    const x0 = kanten[i];
    const b = feld.breite;
    stufen.forEach((d, s) => {
      const z = hinterkanten[s];
      if (!passt(z)) return;
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

/** Die Vorderkante der untersten Auflage – überall gleich, siehe oben. */
const VORDERKANTE = 67;
/** Der schwarze Sockel unter dem Korpus. */
const KOPF_SOCKEL = 11;
/** Wie viel jede weitere Stufe nach innen rückt und nach oben steigt. */
const STUFE_EINZUG = 30;
const STUFE_STEIGUNG = 24;
/** Der Drahtrand um eine Auflage – im Markt hält er die lose Ware. */
const RAND_H = 9;

/** Der Schwerpunkt eines Umrisses. */
function mitte(umriss: Punkt[]) {
  return {
    x: umriss.reduce((s, p) => s + p.x, 0) / umriss.length,
    y: umriss.reduce((s, p) => s + p.y, 0) / umriss.length,
  };
}

/** Liegt der Punkt im Polygon? Strahlensatz, wie üblich. */
function drin(umriss: Punkt[], x: number, y: number): boolean {
  let innen = false;
  for (let i = 0, j = umriss.length - 1; i < umriss.length; j = i++) {
    const a = umriss[i];
    const b = umriss[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) innen = !innen;
  }
  return innen;
}

/**
 * Der Umriss des runden Gondelkopfs — **so wie im Grundriss**.
 *
 * Gerade Seite am Zug (x = 0), dann zwei gerade Kanten und vorn der
 * Halbkreis, der sich vom Zug weg wölbt. Genau diese Form zeichnet
 * `ElementSymbol` auch; wölbte sie sich hier nach vorn statt zur Seite,
 * stünde im Raum ein anderes Möbel als im Plan.
 */
function rundkopf(breite: number, tiefe: number, schritte = 18): Punkt[] {
  const r = tiefe / 2;
  const gerade = Math.max(0, breite - r);
  const punkte: Punkt[] = [
    { x: 0, y: 0 },
    { x: gerade, y: 0 },
  ];
  for (let i = 0; i <= schritte; i++) {
    const w = -Math.PI / 2 + (Math.PI * i) / schritte;
    punkte.push({ x: gerade + r * Math.cos(w), y: r + r * Math.sin(w) });
  }
  punkte.push({ x: 0, y: tiefe });
  return punkte;
}

/**
 * Der Drahtrand um eine Auflage.
 *
 * Ein Ring lässt sich aus einem Prisma nicht bauen — also aus Stücken: je
 * zwei benachbarte Punkte des Umrisses und dieselben zwei ein Stück weiter
 * innen. Jedes zweite Paar genügt; aus zwei Metern Entfernung sieht das
 * niemand.
 */
function randdraht(umriss: Punkt[], z: number, h: number): Bauteil[] {
  const innen = nachInnen(umriss, 1.4);
  const teile: Bauteil[] = [];
  for (let i = 0; i + 2 < umriss.length; i += 2) {
    teile.push(
      prisma([umriss[i], umriss[i + 2], innen[i + 2], innen[i]], z, h, 'regalDunkel'),
    );
  }
  return teile;
}

/**
 * Die radialen Trennbügel auf einem runden Kopf.
 *
 * Auf dem Kopfmöbel liegt die Ware nicht in Kisten, sondern lose in
 * Tortenstücken, die schmale Drahtbügel voneinander trennen. Ein Bügel ist
 * hier ein dünnes Prisma vom Mittelpunkt zur Kante – anders lässt sich ein
 * Teil, das nicht achsparallel steht, aus Quadern nicht bauen.
 */
function trennbuegel(umriss: Punkt[], z: number, h: number, anzahl: number): Bauteil[] {
  const m = mitte(umriss);
  const teile: Bauteil[] = [];
  const schritt = Math.max(1, Math.floor(umriss.length / anzahl));

  for (let i = 0; i < umriss.length; i += schritt) {
    const p = umriss[i];
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * 0.5;
    const ny = (dx / l) * 0.5;
    teile.push(
      prisma(
        [
          { x: m.x + nx, y: m.y + ny },
          { x: p.x + nx, y: p.y + ny },
          { x: p.x - nx, y: p.y - ny },
          { x: m.x - nx, y: m.y - ny },
        ],
        z,
        h,
        'regalDunkel',
      ),
    );
  }
  return teile;
}

/** Die Farben, in denen die lose Ware auf einem Kopfmöbel liegt. */
const OBSTFARBEN = ['#d8c33a', '#3f6b2f', '#c4562f', '#8a5a2a', '#b8402f'];

/**
 * Lose Ware, aufgehäuft — je Tortenstück ein Haufen in seiner Farbe.
 *
 * Auf dem runden Kopf liegen Bananen, Avocados und Mangos frei, jede Sorte
 * für sich. Fünf Kugeln je Stück, in zwei Lagen: Das sieht nach Haufen aus
 * und nicht nach aufgereihten Bällen.
 */
function loseWare(umriss: Punkt[], z: number, stuecke: number): Bauteil[] {
  const m = mitte(umriss);
  const teile: Bauteil[] = [];
  const schritt = Math.max(1, Math.floor(umriss.length / stuecke));

  let n = 0;
  for (let i = Math.floor(schritt / 2); i < umriss.length; i += schritt) {
    const p = umriss[i];
    const farbe = OBSTFARBEN[n % OBSTFARBEN.length];
    n++;
    const lagen: [number, number, number][] = [
      [0.42, -0.06, 5],
      [0.6, 0.06, 5.5],
      [0.78, -0.05, 5],
      [0.55, 0, 5.5],
      [0.72, 0.08, 4.5],
    ];
    lagen.forEach(([anteil, quer, radius], k) => {
      const dx = p.x - m.x;
      const dy = p.y - m.y;
      const x = m.x + dx * anteil - dy * quer;
      const y = m.y + dy * anteil + dx * quer;
      teile.push(kugel(x, y, z + (k < 3 ? radius : radius + 5), radius, 'ware', farbe));
    });
  }
  return teile;
}

/**
 * Grüne Kisten auf einer Auflage — im Raster, wie am geraden Möbel.
 *
 * Gesetzt wird über ein Gitter im Rasterschritt der ifko; behalten wird, was
 * wirklich auf der Auflage liegt. Über Eck gibt es keine Reihe, der man
 * folgen könnte, und aufgereihte Einzelkisten sähen aus wie hingestreut.
 */
function kistenAuf(umriss: Punkt[], z: number, hoechstens = 14): Bauteil[] {
  const xs = umriss.map((p) => p.x);
  const ys = umriss.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const teile: Bauteil[] = [];

  /** Liegt die ganze Kiste auf der Auflage – nicht nur ihre Mitte? */
  const liegtDrauf = (x: number, y: number) => {
    const hx = IFKO.lang / 2;
    const hy = IFKO.kurz / 2;
    // Die vier Ecken und die Mitte. Bei einem Umriss mit schrägen Kanten
    // reicht die Mitte nicht: Vorher hingen an einem geraden Abschluss zwei
    // Kisten je Auflage 25,6 cm über die Möbelkante und schwebten über dem
    // Gang – im Raum stand ein anderes Möbel als im Grundriss.
    return (
      drin(umriss, x, y) &&
      drin(umriss, x - hx + 1, y - hy + 1) &&
      drin(umriss, x + hx - 1, y - hy + 1) &&
      drin(umriss, x - hx + 1, y + hy - 1) &&
      drin(umriss, x + hx - 1, y + hy - 1)
    );
  };

  for (let y = y0 + IFKO.kurz / 2; y < Math.max(...ys); y += IFKO.kurz) {
    for (let x = x0 + IFKO.lang / 2; x < Math.max(...xs); x += IFKO.lang) {
      if (!liegtDrauf(x, y)) continue;
      teile.push(
        quader(x - IFKO.lang / 2 + 1, y - IFKO.kurz / 2 + 1, z, IFKO.lang - 2, IFKO.kurz - 2, KISTE_H, 'kiste'),
      );
      if (teile.length >= hoechstens) return teile;
    }
  }
  return teile;
}

/**
 * Die Ecken, Abschlüsse und Köpfe – gestufte Auslagen über einem Holzkorpus.
 *
 * **So sieht es im Markt aus** (Fotos, Dezember 2025): unten ein schwarzer
 * Sockel, darüber ein Korpus in Holzdekor, der dem Umriss folgt, am oberen
 * Rand eine dunkle Schiene und darüber die schräg stehenden Preisschilder.
 * Obenauf die Auflagen – die unterste außen, jede weitere ein Stück weiter
 * innen und höher, jede mit ihrem Drahtrand.
 *
 * Was daraufliegt, unterscheidet die beiden Fälle:
 *
 *  - Am **Eck und am geraden Abschluss** laufen die grünen Kisten des Zuges
 *    weiter – dasselbe Bild wie am geraden Möbel.
 *  - Auf dem **runden Kopf** liegt die Ware lose in Tortenstücken, die
 *    Drahtbügel trennen.
 */
function kopf(element: PlanElement, umriss: Punkt[], rund: boolean): Bauteil[] {
  const hoehe = hoeheVon(element);
  const stufen = stufenVon(element, element.tiefe);
  const teile: Bauteil[] = [];

  // Sockel, Holzkorpus, dunkle Schiene, Preisschilder.
  teile.push(prisma(nachInnen(umriss, 4), 0, KOPF_SOCKEL, 'schwarz'));
  teile.push(prisma(umriss, KOPF_SOCKEL - 0.8, VORDERKANTE - KOPF_SOCKEL - 5, 'holzHell'));
  teile.push(prisma(nachInnen(umriss, -0.8), VORDERKANTE - 6, 6, 'regalDunkel'));
  teile.push(prisma(nachInnen(umriss, -3), VORDERKANTE - 1, 5, 'glas'));

  // Die Auflagen: außen die unterste, jede weitere höher und weiter innen.
  const anzahl = Math.max(1, Math.min(stufen.length, 3));
  for (let k = 0; k < anzahl; k++) {
    const flaeche = nachInnen(umriss, 3 + k * STUFE_EINZUG);
    const z = VORDERKANTE + k * STUFE_STEIGUNG;
    if (z + AUFLAGE > hoehe) break;

    const xs = flaeche.map((p) => p.x);
    const ys = flaeche.map((p) => p.y);
    if (Math.max(...xs) - Math.min(...xs) < 35 || Math.max(...ys) - Math.min(...ys) < 35) break;

    teile.push(prisma(flaeche, z, AUFLAGE, 'edelstahl'));
    teile.push(...randdraht(flaeche, z + AUFLAGE, RAND_H));

    if (rund) {
      teile.push(...trennbuegel(flaeche, z + AUFLAGE, RAND_H + 3, 6));
      teile.push(...loseWare(flaeche, z + AUFLAGE, 6));
    } else {
      teile.push(...kistenAuf(flaeche, z + AUFLAGE));
    }
  }
  return teile;
}

// ===========================================================================
//  Das Eckstück: derselbe Zug, unter 45 Grad auslaufend
// ===========================================================================

/**
 * Die Ecke ist kein eigenes Möbel, sondern der Zug um die Ecke gezogen.
 *
 * **Warum das vorher ein Klotz war.** Das Eckstück wurde wie ein Kopf gebaut –
 * voller Korpus bis 67 cm, darüber waagerechte Auflagen. Das ist die Bauform
 * des runden Kopfes am Gangende und für die Ecke falsch. Auf dem Foto sieht
 * man das Gegenteil: Die geneigten Auflagen des geraden Zuges laufen **durch**
 * die Ecke weiter, sie werden nur nach vorn hin kürzer, bis sie an der
 * Diagonalen auslaufen. Zwei solche Stücke, eines je Zug und das zweite
 * seitenverkehrt, fasen die Gangecke gemeinsam ab – die zwei 45-Grad-Ecken.
 *
 * Deshalb wird hier dasselbe gebaut wie in `vitableSeite`: dieselben
 * Hinterkanten aus dem Katalog, dieselbe Neigung, dasselbe Frontgitter,
 * dieselbe Hygieneklappe, dieselben Kisten. Nur endet jede Auflage nicht an
 * einer geraden Vorderkante, sondern an der Schräge des Umrisses.
 *
 * **Gebaut wird in schmalen Streifen entlang der Breite.** Ein Quader kann
 * nicht spitz zulaufen; drei Zentimeter breite Streifen, jeder so tief, wie
 * der Umriss es an seiner engsten Stelle zulässt, ergeben die Schräge sauber
 * genug – auf 180 cm Höhe sieht man die Stufen nicht.
 */
const ECK_STREIFEN = 3;

/**
 * Wo die Front an der Stelle `x` liegt.
 *
 * `rest` ist die Tiefe am flachen Ende: beim Inneneck `tiefe − breite` (bei
 * gleicher Breite und Tiefe also null), beim Außeneck immer null. Damit ist
 * es genau der Umriss, den `ElementSymbol` in den Grundriss zeichnet.
 */
function eckfront(x: number, breite: number, tiefe: number, rest: number, gespiegelt: boolean) {
  if (breite <= 0) return tiefe;
  const anteil = x / breite;
  return gespiegelt ? rest + (tiefe - rest) * anteil : tiefe - (tiefe - rest) * anteil;
}

/**
 * Die Kisten auf einer Ecke-Auflage – nur dort, wo sie noch hinpassen.
 *
 * **In der Ecke wird gedreht.** Ein Eckstück ist keinen Meter breit, sondern
 * einen halben: Quer passt dort keine 60er Kiste, längs aber zwei 40er. Genau
 * so steht es im Markt, und deshalb wird hier nicht die Lage des Zuges
 * übernommen, sondern die genommen, von der mehr auf die Auflage geht.
 *
 * Ob eine Reihe noch Platz hat, entscheidet die Tiefe an der **knapperen**
 * Seite der Spalte: Eine Kiste, die halb über der Schräge hinge, wäre
 * schlimmer als eine fehlende.
 */
function eckKisten(
  breite: number,
  zHinten: number,
  nenntiefe: number,
  tiefeBei: (x: number) => number,
): Bauteil[] {
  const hoechstens = auflageFuer(nenntiefe).reihen;

  /** Was bei dieser Lage herauskommt – Zahl der Kisten und ihre Plätze. */
  const versuch = (kisteBreite: number, kisteTiefe: number) => {
    const spalten = Math.floor(nutzbreite(breite) / kisteBreite);
    if (spalten <= 0) return { zahl: 0, kisteBreite, kisteTiefe, plaetze: [] as number[][] };
    const rand = (breite - spalten * kisteBreite) / 2;
    const plaetze: number[][] = [];
    let zahl = 0;
    for (let k = 0; k < spalten; k++) {
      const xa = rand + k * kisteBreite;
      const eng = Math.min(tiefeBei(xa), tiefeBei(xa + kisteBreite));
      const reihen = Math.min(hoechstens, Math.floor(eng / kisteTiefe));
      plaetze.push([xa, reihen]);
      zahl += reihen;
    }
    return { zahl, kisteBreite, kisteTiefe, plaetze };
  };

  const quer = versuch(IFKO.lang, IFKO.kurz);
  const laengs = versuch(IFKO.kurz, IFKO.lang);
  const besser = laengs.zahl > quer.zahl ? laengs : quer;

  const teile: Bauteil[] = [];
  for (const [xa, reihen] of besser.plaetze) {
    for (let reihe = 0; reihe < reihen; reihe++) {
      const d = reihe * besser.kisteTiefe;
      teile.push(
        quader(
          xa + 1,
          SAEULE_T + d * COS,
          zHinten + AUFLAGE - d * SIN,
          besser.kisteBreite - 2,
          besser.kisteTiefe - 2,
          KISTE_H,
          'kiste',
          { neigung: NEIGUNG },
        ),
      );
    }
  }
  return teile;
}

/**
 * Lose Ware auf einer geneigten Auflage – für die Ecke, wo keine Kiste hinpasst.
 *
 * **Warum nicht einfach Kisten.** Ein 45-Grad-Eckstück eines T800-Zuges ist
 * 47,5 cm breit und läuft von 80 auf 44 cm Tiefe zu. Quer passt dort keine
 * 60er Kiste (zu schmal), längs keine (vorn zu flach) – das ist keine Lücke
 * im Programm, sondern die Wirklichkeit: Über Eck liegt die Ware lose, und
 * genau so ist es auf dem Foto zu sehen.
 *
 * Gelegt wird im Raster über die Auflage, jede Reihe in ihrer Farbe, und die
 * Höhe folgt der Neigung – sonst schwebten die vorderen Stücke.
 */
function eckWare(breite: number, zHinten: number, tiefeBei: (x: number) => number): Bauteil[] {
  const teile: Bauteil[] = [];
  const spalte = 13;
  const reihe = 13;
  const spalten = Math.floor(breite / spalte);
  if (spalten <= 0) return teile;
  const rand = (breite - spalten * spalte) / 2;

  for (let i = 0; i < spalten; i++) {
    const x = rand + (i + 0.5) * spalte;
    const tief = tiefeBei(x);
    const reihen = Math.floor((tief - 8) / reihe);
    const farbe = OBSTFARBEN[i % OBSTFARBEN.length];
    for (let r = 0; r < reihen; r++) {
      // Etwas versetzt, damit es nach Haufen aussieht und nicht nach Gitter.
      const d = 8 + (r + 0.5) * reihe;
      const versatz = r % 2 === 0 ? 0 : spalte / 2.6;
      const radius = r % 3 === 0 ? 5 : 4.2;
      teile.push(
        kugel(
          Math.min(breite - radius, x + versatz),
          SAEULE_T + d * COS,
          zHinten + AUFLAGE - d * SIN + radius,
          radius,
          'ware',
          farbe,
        ),
      );
    }
  }
  return teile;
}

/** Ein Eckstück – innen (`rest = tiefe − breite`) oder außen (`rest = 0`). */
function vitableEcke(element: PlanElement, rest: number): Bauteil[] {
  const breite = element.breite;
  const tiefe = element.tiefe;
  if (breite <= 0 || tiefe <= 0) return [];

  const gespiegelt = !!element.gespiegelt;
  const hoehe = hoeheVon(element);
  const stufen = stufenVon(element, tiefe);
  const teile: Bauteil[] = [];

  const front = (x: number) => eckfront(x, breite, tiefe, rest, gespiegelt);
  /** Wie tief eine Auflage der Nenntiefe `d` bei `x` noch sein darf. */
  const tiefeBei = (d: number) => (x: number) =>
    Math.max(0, Math.min(d, (front(x) - SAEULE_T) / COS));

  // Die Hinterkanten aus dem Katalog – dieselben wie im geraden Zug, sonst
  // träfen die Auflagen am Stoß nicht aufeinander.
  const hk0 = untersteHinterkante(stufen, hoehe);
  let hinterkante = hk0;
  const hinterkanten: number[] = [];
  stufen.forEach((d, i) => {
    if (i > 0) hinterkante += 30 + 0.2 * d;
    hinterkanten.push(hinterkante);
  });

  // Säulen an beiden Enden, Fußrohr so weit, wie der Korpus dort reicht.
  const unterste = stufen[0];
  const korpusBei = (x: number) =>
    Math.max(SAEULE_T, Math.min(front(x) - 2, SAEULE_T + unterste * COS));
  for (const x of [0, breite]) {
    teile.push(quader(x - SAEULE_B / 2, 0, 0, SAEULE_B, SAEULE_T, hoehe, 'regalDunkel'));
    teile.push(quader(x - SAEULE_B / 2, 0, 0, SAEULE_B, korpusBei(x), FUSS_H, 'regalDunkel'));
  }
  teile.push(wandplatte(0, SAEULE_T / 2 - 0.4, FUSS_H, breite, hoehe - FUSS_H, 'gitter', 0.8));

  const obersteKante = hinterkanten[hinterkanten.length - 1] + 12;
  if (hoehe > obersteKante + 15) {
    teile.push(
      wandplatte(
        0,
        SAEULE_T / 2 + 0.8,
        obersteKante,
        breite,
        hoehe - obersteKante - 4,
        'holzHell',
        1.2,
      ),
    );
  }

  // Die Auflagen, Streifen für Streifen.
  const streifen = Math.max(1, Math.ceil(breite / ECK_STREIFEN));
  const w = breite / streifen;
  stufen.forEach((d, s) => {
    const z = hinterkanten[s];
    const bis = tiefeBei(d);
    for (let i = 0; i < streifen; i++) {
      const x0 = i * w;
      // Die knappere Seite zählt: Sonst stünde der Streifen über die Schräge
      // hinaus, und die Ecke wäre wieder ein Klotz.
      const dLokal = Math.min(bis(x0), bis(x0 + w));
      if (dLokal < 6) continue;

      teile.push(
        quader(x0, SAEULE_T, z, w + 0.05, dLokal, AUFLAGE, 'edelstahl', { neigung: NEIGUNG }),
      );

      const yVorn = SAEULE_T + dLokal * COS;
      const zVorn = z - dLokal * SIN;
      teile.push(quader(x0, yVorn - 0.6, zVorn + AUFLAGE, w + 0.05, 0.6, FRONTGITTER_H, 'chrom'));

      if (s === 0) {
        // Hygieneklappe: Sie folgt der Schräge mit nach vorn.
        teile.push(
          quader(x0, yVorn - KLAPPE_STAERKE, 3, w + 0.05, KLAPPE_STAERKE, zVorn - 3, 'regalDunkel'),
        );
      }
    }
    const mitKisten = eckKisten(breite, z, d, bis);
    teile.push(...(mitKisten.length > 0 ? mitKisten : eckWare(breite, z, bis)));
  });

  // Holz-Seitenwand nur am **tiefen** Ende: Dort stößt das Stück an den Zug.
  // Am flachen Ende trifft es sein seitenverkehrtes Gegenstück, und eine Wand
  // mitten in der Fase sähe aus wie eine Trennung, die es nicht gibt.
  const tiefesEnde = gespiegelt ? breite : 0;
  teile.push(
    seitenplatte(
      gespiegelt ? breite : -1.9,
      0,
      0,
      korpusBei(tiefesEnde),
      hk0 + 12,
      'holzHell',
      1.9,
    ),
  );
  return teile;
}

export function vitableBauteile(element: PlanElement): Bauteil[] {
  switch (element.form) {
    // Die Umrisse sind dieselben, die `ElementSymbol` in den Grundriss
    // zeichnet. Wäre hier eine andere Form, stünde im Raum ein anderes Möbel
    // als im Plan.
    case 'vitableAbschlussRund':
      return kopf(element, rundkopf(element.breite, element.tiefe), true);
    case 'vitableAbschluss':
      return kopf(element, rechteck(element.breite, element.tiefe), false);
    // Die Ecken sind **kein Kopf**, sondern der Zug um die Ecke gezogen –
    // siehe `vitableEcke`. Volle Tiefe am Anschluss an den Zug, zur Ecke hin
    // unter 45 Grad auslaufend.
    case 'vitableEckInnen':
      return vitableEcke(element, Math.max(0, element.tiefe - element.breite));
    case 'vitableEckAussen':
      // Das Außeneck läuft auf null aus – der Umriss ist ein Dreieck.
      return vitableEcke(element, 0);
    default:
      return element.beidseitig ? gondel(element) : gerade(element);
  }
}
