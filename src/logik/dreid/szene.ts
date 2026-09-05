import { alleWandachsen } from '../waende';
import { bauteileFuer } from './moebel';
import { prisma, quader, rechteck, type Bauteil } from './bauteile';
import { sichtbareEbenen } from '../warengruppenmeter';
import type { Oeffnung, Projekt, Punkt, Raum } from '../../typen/modell';

/**
 * Die Szene: alles, was die 3D-Ansicht zeigt, als Daten.
 *
 * Der Renderer bekommt eine Liste von **Körpern**. Jeder Körper hat seinen
 * Ort im Markt (Plan-Koordinaten in cm, Drehung im Uhrzeigersinn wie im
 * Grundriss), seine Bauteile in eigenen Koordinaten und – wenn er ein Möbel
 * ist – die Kennung des Elements, damit ein Klick es auswählen kann.
 *
 * Der Fußboden, die Wände und die Räume sind Körper ohne Kennung: Sie stehen
 * still, man klickt sie nicht an.
 */

/** Ein Körper in der Szene. */
export interface Koerper {
  /** Kennung des Elements – fehlt bei Gebäudeteilen. */
  elementId?: string;
  /** Mittelpunkt im Plan (cm). */
  x: number;
  y: number;
  /** Drehung in Grad, im Uhrzeigersinn wie im Grundriss. */
  drehung: number;
  /** Die Breite und Tiefe des Körpers – die Bauteile liegen in 0…breite / 0…tiefe. */
  breite: number;
  tiefe: number;
  bauteile: Bauteil[];
}

export interface Szene {
  koerper: Koerper[];
  /** Die Umgrenzung des Marktes in Plan-Koordinaten – für die Kamera. */
  rahmen: { links: number; oben: number; rechts: number; unten: number };
}

/** Wie hoch die Wände stehen. Ein Markt hat meist 3 bis 4 m, gezeigt werden 3. */
export const WANDHOEHE = 300;
/** Eine Tür ist 2,10 m hoch, darüber bleibt Wand. */
export const TUERHOEHE = 210;
/** Ein Tor ist höher. */
export const TORHOEHE = 250;

/** Der Rahmen um ein Polygon. */
function rahmenVon(punkte: Punkt[]): Szene['rahmen'] {
  if (punkte.length === 0) return { links: 0, oben: 0, rechts: 4000, unten: 2500 };
  const xs = punkte.map((p) => p.x);
  const ys = punkte.map((p) => p.y);
  return {
    links: Math.min(...xs),
    oben: Math.min(...ys),
    rechts: Math.max(...xs),
    unten: Math.max(...ys),
  };
}

/**
 * Ein Körper in Weltlage: Mittelpunkt `x`/`y`, ungedreht, Bauteile in
 * Weltkoordinaten minus Mittelpunkt. Für Gebäudeteile, die ihre Punkte
 * schon im Plan tragen.
 */
function weltkoerper(bauteile: Bauteil[], rahmen: Szene['rahmen']): Koerper {
  const breite = rahmen.rechts - rahmen.links;
  const tiefe = rahmen.unten - rahmen.oben;
  // Die Bauteile liegen in Weltkoordinaten; der Körper steht mit seiner
  // linken hinteren Ecke bei `links/oben`. Dafür ist sein Mittelpunkt die
  // Mitte des Rahmens, und die Bauteile werden um `links/oben` verschoben.
  const verschoben = bauteile.map((teil) => verschiebe(teil, -rahmen.links, -rahmen.oben));
  return {
    x: rahmen.links + breite / 2,
    y: rahmen.oben + tiefe / 2,
    drehung: 0,
    breite,
    tiefe,
    bauteile: verschoben,
  };
}

function verschiebe(teil: Bauteil, dx: number, dy: number): Bauteil {
  switch (teil.art) {
    case 'prisma':
      return { ...teil, punkte: teil.punkte.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    default:
      return { ...teil, x: teil.x + dx, y: teil.y + dy };
  }
}

/**
 * Eine Wand entlang einer Achse, mit Löchern für ihre Öffnungen.
 *
 * Die Wand ist ein Quader entlang der Achse; wo eine Öffnung sitzt, fehlt
 * ein Stück bis zur Türhöhe, darüber bleibt der Sturz. Öffnungen gehören zu
 * einer Achse, wenn ihr Mittelpunkt nah an ihr liegt.
 */
function wandStuecke(
  von: Punkt,
  bis: Punkt,
  staerke: number,
  oeffnungen: Oeffnung[],
): Bauteil[] {
  const dx = bis.x - von.x;
  const dy = bis.y - von.y;
  const laenge = Math.hypot(dx, dy);
  if (laenge < 1) return [];

  // Öffnungen auf dieser Achse, als Abschnitt entlang der Achse (in cm ab `von`).
  const loecher = oeffnungen
    .map((o) => {
      const t = ((o.x - von.x) * dx + (o.y - von.y) * dy) / (laenge * laenge);
      const fuss = { x: von.x + dx * t, y: von.y + dy * t };
      const abstand = Math.hypot(o.x - fuss.x, o.y - fuss.y);
      return { o, t: t * laenge, abstand };
    })
    .filter(({ t, abstand, o }) => abstand <= Math.max(staerke, 6) && t > -o.breite && t < laenge + o.breite)
    .map(({ o, t }) => ({
      von: Math.max(0, t - o.breite / 2),
      bis: Math.min(laenge, t + o.breite / 2),
      ...lochhoehe(o),
    }))
    .filter((l) => l.bis > l.von + 1)
    .sort((a, b) => a.von - b.von);

  // Die Stücke liegen im Koordinatensystem der Achse: `x` läuft entlang der
  // Achse ab `von`, `y` quer über die Stärke. Der Körper, der sie trägt,
  // übernimmt Lage und Drehung.
  const teile: Bauteil[] = [];
  const stueck = (a: number, b: number, z: number, h: number) => {
    if (b - a < 0.5 || h <= 0) return;
    teile.push(quader(a, 0, z, b - a, staerke, h, 'wand'));
  };

  let cursor = 0;
  for (const loch of loecher) {
    stueck(cursor, loch.von, 0, WANDHOEHE);
    // Brüstung unter einem Fenster, Sturz über jeder Öffnung.
    stueck(loch.von, loch.bis, 0, loch.unten);
    stueck(loch.von, loch.bis, loch.oben, WANDHOEHE - loch.oben);
    cursor = loch.bis;
  }
  stueck(cursor, laenge, 0, WANDHOEHE);
  return teile;
}

/**
 * Wo eine Öffnung die Wand durchbricht – von `unten` bis `oben`.
 *
 * Türen und Durchgänge reichen bis zum Boden, Tore sind höher, Fenster
 * beginnen über einer Brüstung.
 */
function lochhoehe(o: Oeffnung): { unten: number; oben: number } {
  switch (o.art) {
    case 'rolltor':
    case 'sektionaltor':
      return { unten: 0, oben: TORHOEHE };
    case 'fenster':
      return { unten: 90, oben: 230 };
    case 'schaufenster':
      return { unten: 20, oben: 260 };
    default:
      return { unten: 0, oben: TUERHOEHE };
  }
}

/**
 * Die Wandkörper einer Planung – Außenwand, Raumwände, Innenwände.
 *
 * Jede Achse wird ein eigener Körper mit eigener Drehung; so bleibt eine
 * schräge Wand schräg, und die Löcher liegen richtig.
 */
function waende(projekt: Projekt): Koerper[] {
  const achsen = alleWandachsen(projekt.grundflaeche, projekt.raeume, projekt.waende);
  const koerper: Koerper[] = [];

  for (const achse of achsen) {
    // Ein Raum ohne Wandstärke ist nur eine Farbfläche.
    if (achse.staerke <= 0) continue;
    const dx = achse.bis.x - achse.von.x;
    const dy = achse.bis.y - achse.von.y;
    const laenge = Math.hypot(dx, dy);
    if (laenge < 1) continue;
    const winkel = (Math.atan2(dy, dx) * 180) / Math.PI;

    const stuecke = wandStuecke(achse.von, achse.bis, achse.staerke, projekt.oeffnungen);
    if (stuecke.length === 0) continue;

    // Der Körper hat seine Mitte in der Achsenmitte, Breite = Länge, Tiefe =
    // Stärke; die Stücke liegen schon in 0…breite / 0…tiefe.
    koerper.push({
      x: achse.von.x + dx / 2,
      y: achse.von.y + dy / 2,
      drehung: winkel,
      breite: laenge,
      tiefe: achse.staerke,
      bauteile: stuecke,
    });
  }

  // Wandkörper aus einem eingelesenen Plan: Polygone, wie sie sind.
  const koerperPolygone = projekt.grundflaeche.wandkoerper ?? [];
  if (koerperPolygone.length > 0) {
    const alle = koerperPolygone.flat();
    const rahmen = rahmenVon(alle);
    koerper.push(
      weltkoerper(
        koerperPolygone.filter((p) => p.length >= 3).map((p) => prisma(p, 0, WANDHOEHE, 'wand')),
        rahmen,
      ),
    );
  }

  return koerper;
}

/** Der Fußboden – die Grundfläche als flache Platte, Räume darauf getönt. */
function boden(projekt: Projekt, rahmen: Szene['rahmen']): Koerper[] {
  const teile: Bauteil[] = [];
  const umriss = projekt.grundflaeche.umriss;
  if (umriss.length >= 3) teile.push(prisma(umriss, -3, 3, 'boden'));
  else teile.push(prisma(rechteck(rahmen.rechts - rahmen.links, rahmen.unten - rahmen.oben), -3, 3, 'boden'));

  for (const raum of projekt.raeume) {
    if (raum.umriss.length < 3) continue;
    teile.push(prisma(raum.umriss, 0, 0.6, raumboden(raum)));
  }
  return [weltkoerper(teile, rahmen)];
}

function raumboden(raum: Raum): Bauteil['material'] {
  return raum.art === 'verkauf' ? 'boden' : 'bodenLager';
}

/**
 * Die ganze Szene aus einer Planung.
 *
 * Ausgeblendete Ebenen fehlen – wie im Grundriss und in der Auswertung.
 */
export function szeneAus(projekt: Projekt): Szene {
  const rahmen = rahmenVon(projekt.grundflaeche.umriss);
  const sichtbar = sichtbareEbenen(projekt);
  const koerper: Koerper[] = [...boden(projekt, rahmen), ...waende(projekt)];

  for (const element of projekt.elemente) {
    if (element.ebeneId && !sichtbar.has(element.ebeneId)) continue;
    const bauteile = bauteileFuer(element);
    if (bauteile.length === 0) continue;
    koerper.push({
      elementId: element.id,
      x: element.x,
      y: element.y,
      drehung: element.drehung,
      breite: element.breite,
      tiefe: element.tiefe,
      bauteile,
    });
  }

  return { koerper, rahmen };
}
