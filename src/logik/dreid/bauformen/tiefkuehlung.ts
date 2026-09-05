import { quader, seitenplatte, wandplatte, zylinder, type Bauteil } from '../bauteile';
import { hoeheVon } from '../moebel';
import type { PlanElement } from '../../../typen/modell';

/**
 * Tiefkühlung – WSL Eclipse (Island, Standard, Combo), Katalog 2026, dazu
 * AHT und Carrier für die steckerfertigen Truhen.
 *
 * **Die Insel (Truhe):** ein zurückgesetzter Sockel von 20,4 cm, darüber der
 * dunkle Korpus; die Front ist bis etwa 55 cm geschlossen und trägt darüber
 * einen umlaufenden **Glasstreifen von 36,1 cm**, gegliedert von dunklen
 * Pfosten an den Modulgrenzen (62,5 cm). Innen die helle Wanne, oben die
 * **Glasschiebedeckel**, die vom höheren hinteren Rand (98,7) leicht nach
 * vorn (91,6) abfallen. Beidseitig: spiegelsymmetrisch mit Mittelsteg, die
 * Deckel steigen zur Mitte an.
 *
 * **Der Schrank:** ein hoher Quader, 94 tief, mit Sockel (ca. 30), darüber
 * **Glastüren im Raster 78,1 cm** in schwarzen Rahmen mit senkrechtem Griff,
 * oben eine Kopfblende (13 cm) und ein flacher Technikkasten auf dem Dach.
 *
 * **Das Kombimöbel:** eine Wanne vorn (91,8 hoch) mit Glasfenster in der
 * Front, dahinter und darüber der Schrankaufsatz (ca. 75 tief) mit Türen im
 * Modulraster 62,5.
 *
 * **Warum hier überall eine Fuge steckt.** Zwei Flächen, die auf denselben
 * Zehntelmillimeter genau übereinanderliegen, kann die Grafikkarte nicht
 * auseinanderhalten: Sie zeigt mal die eine, mal die andere, und das sieht
 * beim Drehen wie Flimmern aus. Ein Wannenboden, der genau auf der
 * Korpusoberkante endet, ein Rammschutz, der genau in der Front sitzt, eine
 * Rückwand, die genau an der Seitenwand steht — jedes dieser Paare flackert.
 *
 * Deshalb greifen die Teile hier bewusst ineinander, um `FUGE` versetzt. Das
 * sieht man nicht, und die Grafikkarte hat wieder eine klare Antwort.
 */

/**
 * Wie weit sich zwei Teile überlappen müssen, damit nichts flimmert, in cm.
 *
 * Sechs Millimeter: genug, dass die Tiefenauflösung sie noch bei fünfzehn
 * Metern Entfernung trennt, und wenig genug, dass es kein Mensch sieht.
 */
const FUGE = 0.6;

const MODUL = 62.5;
const SOCKEL_H = 20.4;
const SOCKEL_EINZUG = 3;
const GLAS_VON = 55.5;
const GLAS_H = 36.1;
const VORN = 91.6;
const HINTEN = 98.7;
const PFOSTEN = 2;
const RAMMSCHUTZ_H = 3;

const SCHRANK_SOCKEL = 30;
const TUER_RASTER = 78.1;
const KOPFBLENDE = 13;
const TECHNIK = 10;

/** Die Pfosten an den Modulgrenzen entlang einer Front bei `y`. */
function pfosten(breite: number, y: number, z: number, h: number, teile: Bauteil[]) {
  const anzahl = Math.max(1, Math.round(breite / MODUL));
  const schritt = breite / anzahl;
  for (let i = 0; i <= anzahl; i++) {
    const x = Math.min(breite - PFOSTEN, Math.max(0, i * schritt - PFOSTEN / 2));
    teile.push(quader(x, y, z, PFOSTEN, 2, h, 'schwarz'));
  }
}

/** Eine einseitige Insel: Rückwand hinten, Glasstreifen und Deckel vorn. */
function inselEinseitig(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const teile: Bauteil[] = [];

  teile.push(quader(SOCKEL_EINZUG, SOCKEL_EINZUG, 0, b - 2 * SOCKEL_EINZUG, t - 2 * SOCKEL_EINZUG, SOCKEL_H, 'schwarz'));
  // Korpus bis unter den Glasstreifen, hinten bis zur höheren Rückkante.
  teile.push(quader(0, 0, SOCKEL_H, b, t, GLAS_VON - SOCKEL_H, 'anthrazit'));
  // Die Rückwand endet vor den Seitenwänden, sonst teilen sie sich eine Fläche.
  teile.push(wandplatte(2, 0, GLAS_VON - FUGE, b - 4, HINTEN - GLAS_VON + FUGE, 'anthrazit', 6));
  teile.push(seitenplatte(0, 0, GLAS_VON - FUGE, t, HINTEN - GLAS_VON + FUGE, 'anthrazit', 3));
  teile.push(seitenplatte(b - 3, 0, GLAS_VON - FUGE, t, HINTEN - GLAS_VON + FUGE, 'anthrazit', 3));
  // Rammschutz — er steht vor der Front, wie im Markt auch.
  teile.push(quader(0, t - FUGE, SOCKEL_H, b, 1.2 + FUGE, RAMMSCHUTZ_H, 'hellgrau'));
  // Glasstreifen mit Pfosten. Die Pfosten sitzen dahinter, nicht bündig.
  teile.push(wandplatte(0, t - 1.5, GLAS_VON - FUGE, b, GLAS_H + FUGE, 'glas', 1));
  pfosten(b, t - 3.4, GLAS_VON, GLAS_H - FUGE, teile);
  // Wanne: heller Boden, eine Fuge über der Korpusoberkante.
  teile.push(quader(3, 6, GLAS_VON - 1.4, b - 6, t - 9, 1 + FUGE, 'weiss'));
  // Handlauf vorn und Deckel.
  teile.push(quader(0, t - 4, VORN, b, 4, 2, 'anthrazit'));
  const deckelTiefe = t - 10;
  const neigung = (Math.atan2(HINTEN - VORN, deckelTiefe) * 180) / Math.PI;
  const anzahl = Math.max(1, Math.round(b / MODUL));
  const schritt = b / anzahl;
  for (let i = 0; i < anzahl; i++) {
    teile.push(quader(i * schritt + 0.5, 6, HINTEN, schritt - 1, deckelTiefe, 0.8, 'glas', { neigung }));
    // Griffknopf nahe der Vorderkante.
    teile.push(zylinder(i * schritt + schritt / 2, t - 12, VORN + 0.5, 2, 1.2, 'z', 'schwarz'));
  }
  return teile;
}

/** Die beidseitige Insel: zwei Wannen Rücken an Rücken, Deckel steigen zur Mitte. */
function inselBeidseitig(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const mitte = t / 2;
  const aussen = 96.1;
  const mitteHoehe = 98.6;
  const teile: Bauteil[] = [];

  teile.push(quader(SOCKEL_EINZUG, SOCKEL_EINZUG, 0, b - 2 * SOCKEL_EINZUG, t - 2 * SOCKEL_EINZUG, SOCKEL_H, 'schwarz'));
  teile.push(quader(0, 0, SOCKEL_H, b, t, 60 - SOCKEL_H, 'anthrazit'));
  teile.push(seitenplatte(0, 0, 60 - FUGE, t, aussen - 60 + FUGE, 'anthrazit', 3));
  teile.push(seitenplatte(b - 3, 0, 60 - FUGE, t, aussen - 60 + FUGE, 'anthrazit', 3));
  // Mittelsteg.
  teile.push(quader(0, mitte - 5, 60 - FUGE, b, 10, mitteHoehe - 60 + FUGE, 'anthrazit'));
  // Rammschutz und Glasstreifen an beiden Längsseiten.
  for (const [y, yGlas, yPfosten] of [
    [t - FUGE, t - 1.5, t - 3.4],
    [-FUGE, 0.5, 1.4],
  ]) {
    teile.push(quader(0, y, SOCKEL_H, b, 1.2 + FUGE, RAMMSCHUTZ_H, 'hellgrau'));
    teile.push(wandplatte(0, yGlas, 60 - FUGE, b, GLAS_H + FUGE, 'glas', 1));
    pfosten(b, yPfosten, 60, GLAS_H - FUGE, teile);
  }
  // Wannenböden, eine Fuge über der Korpusoberkante.
  teile.push(quader(3, 6, 58.6, b - 6, mitte - 11, 1 + FUGE, 'weiss'));
  teile.push(quader(3, mitte + 5, 58.6, b - 6, mitte - 11, 1 + FUGE, 'weiss'));
  // Handläufe außen.
  teile.push(quader(0, t - 4, aussen, b, 4, 2, 'anthrazit'));
  teile.push(quader(0, 0, aussen, b, 4, 2, 'anthrazit'));
  // Deckel: von der Mitte nach außen abfallend, je Seite und Modul eine Scheibe.
  const deckelTiefe = mitte - 9;
  const neigung = (Math.atan2(mitteHoehe - aussen, deckelTiefe) * 180) / Math.PI;
  const anzahl = Math.max(1, Math.round(b / MODUL));
  const schritt = b / anzahl;
  for (let i = 0; i < anzahl; i++) {
    const x = i * schritt + 0.5;
    // Vorderseite: Pivot an der Mitte (hinten aus Sicht der Vorderseite), fällt nach vorn.
    teile.push(quader(x, mitte + 5, mitteHoehe, schritt - 1, deckelTiefe, 0.8, 'glas', { neigung }));
    // Rückseite: gespiegelt – Pivot an der Mitte, fällt nach hinten.
    teile.push(quader(x, 4, mitteHoehe, schritt - 1, deckelTiefe, 0.8, 'glas', { neigung, gespiegelt: true }));
    teile.push(zylinder(x + schritt / 2, t - 12, aussen + 0.5, 2, 1.2, 'z', 'schwarz'));
    teile.push(zylinder(x + schritt / 2, 12, aussen + 0.5, 2, 1.2, 'z', 'schwarz'));
  }
  return teile;
}

/** Glastüren im Raster über eine Front bei `y`, von `z` bis `z + h`. */
function glastueren(breite: number, y: number, z: number, h: number, raster: number, teile: Bauteil[]) {
  const anzahl = Math.max(1, Math.round(breite / raster));
  const schritt = breite / anzahl;
  for (let i = 0; i < anzahl; i++) {
    const x = i * schritt;
    // Die Scheibe greift in die Stege hinein, sonst stossen zwei Flaechen
    // genau aufeinander und flimmern.
    teile.push(wandplatte(x + 1, y, z, schritt - 2, h, 'glas', 1));
    // Rahmen: senkrechte Stege zwischen den Türen. Sie reichen eine Fuge in
    // die Kopfblende hinein, sonst enden sie auf derselben Höhe wie die
    // Seitenwände.
    teile.push(quader(x, y - 0.5, z, 1.5, 2, h + FUGE, 'schwarz'));
    // Griff: senkrechte Stange an der Öffnungskante.
    teile.push(zylinder(x + schritt - 6, y + 2.5, z + h * 0.25, 1, h * 0.5, 'z', 'schwarz'));
  }
  teile.push(quader(breite - 1.5, y - 0.5, z, 1.5, 2, h + FUGE, 'schwarz'));
}

/** Der Schrank mit Glastüren. */
function schrank(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const teile: Bauteil[] = [];
  const tuerVon = SCHRANK_SOCKEL + 5;
  const tuerBis = hoehe - KOPFBLENDE;

  // Sockel mit Rammschutz.
  teile.push(quader(0, 0, 0, b, t - 2, SCHRANK_SOCKEL, 'anthrazit'));
  teile.push(quader(0, t - 2 - FUGE, 4, b, 1.2 + FUGE, RAMMSCHUTZ_H, 'hellgrau'));
  // Rückwand, Seiten, Kopfblende, Technikkasten. Jedes greift eine Fuge in
  // das Nachbarteil hinein, sonst teilen sie sich eine Fläche.
  // Rückwand und Seiten enden unter der Kopfblende, die sie ohnehin verdeckt,
  // und jede auf ihrer eigenen Höhe — sonst treffen sich drei Deckflächen.
  const korpusH = tuerBis - SCHRANK_SOCKEL + 2 * FUGE;
  teile.push(wandplatte(2, 0, SCHRANK_SOCKEL - FUGE, b - 4, korpusH, 'anthrazit', 10));
  teile.push(seitenplatte(0, 0, SCHRANK_SOCKEL - FUGE, t - 2, korpusH - FUGE, 'anthrazit', 5));
  teile.push(seitenplatte(b - 5, 0, SCHRANK_SOCKEL - FUGE, t - 2, korpusH - FUGE, 'anthrazit', 5));
  teile.push(quader(0, 0, tuerBis, b, t - 2, KOPFBLENDE, 'anthrazit'));
  teile.push(quader(5, 5, hoehe - FUGE, b - 10, t - 25, TECHNIK + FUGE, 'schwarz'));
  // Innenraum hell, mit Drahtböden. Er sitzt eine Fuge in jedem Nachbarn.
  teile.push(
    quader(
      4,
      9,
      SCHRANK_SOCKEL - FUGE,
      b - 8,
      t - 18,
      tuerBis - SCHRANK_SOCKEL + 2 * FUGE,
      'weiss',
    ),
  );
  const boeden = hoehe > 215 ? 5 : 4;
  for (let i = 1; i <= boeden; i++) {
    const z = SCHRANK_SOCKEL + ((tuerBis - SCHRANK_SOCKEL) * i) / (boeden + 1);
    teile.push(quader(6, t - 8 - 60, z, b - 12, 60, 1.5, 'hellgrau'));
    teile.push(quader(8, t - 8 - 55, z + 1.5, b - 16, 50, 18, 'ware'));
  }
  glastueren(b, t - 5, tuerVon, tuerBis - tuerVon, TUER_RASTER, teile);
  return teile;
}

/** Das Kombimöbel: Wanne vorn, Schrank hinten oben. */
function kombi(element: PlanElement): Bauteil[] {
  const b = element.breite;
  const t = element.tiefe;
  const hoehe = hoeheVon(element);
  const wanneHoch = 91.8;
  const aufsatzTiefe = Math.min(75, t * 0.65);
  const tuerVon = wanneHoch + 20;
  const tuerBis = hoehe - KOPFBLENDE;
  const teile: Bauteil[] = [];

  // Sockel und Wanne.
  teile.push(quader(SOCKEL_EINZUG, SOCKEL_EINZUG, 0, b - 2 * SOCKEL_EINZUG, t - 2 * SOCKEL_EINZUG, 13, 'schwarz'));
  teile.push(quader(0, 0, 13, b, t, 45 - 13, 'anthrazit'));
  teile.push(wandplatte(0, t - 1.5, 45 - FUGE, b, 45 + FUGE, 'glas', 1));
  pfosten(b, t - 3.4, 45, 45 - FUGE, teile);
  teile.push(seitenplatte(0, 0, 45 - FUGE, t, wanneHoch - 45 + FUGE, 'anthrazit', 3));
  teile.push(seitenplatte(b - 3, 0, 45 - FUGE, t, wanneHoch - 45 + FUGE, 'anthrazit', 3));
  teile.push(quader(0, t - FUGE, 13, b, 1.2 + FUGE, RAMMSCHUTZ_H, 'hellgrau'));
  teile.push(quader(3, aufsatzTiefe, 55.6, b - 6, t - aufsatzTiefe - 5, 1 + FUGE, 'weiss'));
  teile.push(quader(0, t - 4, wanneHoch - 2, b, 4, 2 + FUGE, 'anthrazit'));
  // Deckel über der Wanne, fast waagerecht.
  const anzahl = Math.max(1, Math.round(b / MODUL));
  const schritt = b / anzahl;
  for (let i = 0; i < anzahl; i++) {
    teile.push(quader(i * schritt + 0.5, aufsatzTiefe, wanneHoch + 1, schritt - 1, t - aufsatzTiefe - 5, 0.8, 'glas', { neigung: 2 }));
  }
  // Der Aufsatz.
  teile.push(quader(0, 0, wanneHoch, b, aufsatzTiefe, tuerVon - wanneHoch, 'anthrazit'));
  const aufsatzH = tuerBis - wanneHoch + FUGE;
  teile.push(wandplatte(2, 0, wanneHoch, b - 4, aufsatzH, 'anthrazit', 10));
  teile.push(seitenplatte(0, 0, wanneHoch, aufsatzTiefe, aufsatzH - FUGE, 'anthrazit', 4));
  teile.push(seitenplatte(b - 4, 0, wanneHoch, aufsatzTiefe, aufsatzH - FUGE, 'anthrazit', 4));
  teile.push(quader(0, 0, tuerBis, b, aufsatzTiefe, KOPFBLENDE, 'anthrazit'));
  teile.push(quader(5, 5, hoehe - FUGE, b - 10, aufsatzTiefe - 20, TECHNIK + FUGE, 'schwarz'));
  teile.push(
    // Der Innenraum bleibt hinter den Türrahmen — sonst enden beide auf
    // derselben Höhe und in derselben Ebene.
    quader(3, 9, tuerVon - FUGE, b - 6, aufsatzTiefe - 14, tuerBis - tuerVon + 2 * FUGE, 'weiss'),
  );
  for (let i = 1; i <= 3; i++) {
    const z = tuerVon + ((tuerBis - tuerVon) * i) / 4;
    teile.push(quader(6, aufsatzTiefe - 6 - 40, z, b - 12, 40, 1.5, 'hellgrau'));
    teile.push(quader(8, aufsatzTiefe - 6 - 36, z + 1.5, b - 16, 32, 16, 'ware'));
  }
  glastueren(b, aufsatzTiefe - 4, tuerVon, tuerBis - tuerVon, MODUL, teile);
  return teile;
}

export function tiefkuehlBauteile(element: PlanElement): Bauteil[] {
  switch (element.form) {
    case 'tkSchrank':
      return schrank(element);
    case 'tkKombi':
      return kombi(element);
    default:
      return element.beidseitig ? inselBeidseitig(element) : inselEinseitig(element);
  }
}
