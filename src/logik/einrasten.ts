import type { Einstellungen, Grundflaeche, PlanElement } from '../typen/modell';
import { umgrenzung, type Rahmen } from './geometrie';
import { rahmen as umrissRahmen, strahlAufUmriss, wandlinien } from './polygon';

/**
 * Einrasten ("Snapping") und automatische Hilfslinien.
 *
 * Beim Verschieben eines Elements sucht der Marktplaner nach Kanten und Mitten
 * anderer Elemente sowie nach den Wänden. Liegt das gezogene Element nahe genug
 * daran, wird es exakt darauf gesetzt und eine rote Hilfslinie eingeblendet.
 */

/** Eine eingeblendete Hilfslinie. */
export interface Hilfslinie {
  richtung: 'senkrecht' | 'waagerecht';
  /** Position der Linie in cm (x bei senkrecht, y bei waagerecht). */
  position: number;
  /** Von wo bis wo die Linie gezeichnet wird (in der jeweils anderen Achse). */
  von: number;
  bis: number;
}

/** Ein angezeigtes Abstandsmaß zwischen zwei Kanten. */
export interface Abstandsmass {
  /** Start- und Endpunkt der Maßlinie in cm. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Abstand in cm. */
  wert: number;
}

/** Ergebnis der Einrast-Berechnung. */
export interface EinrastErgebnis {
  x: number;
  y: number;
  hilfslinien: Hilfslinie[];
}

/** Kandidatenlinie, an der eingerastet werden kann. */
interface Kandidat {
  wert: number;
  /** Bereich des Partners – nur für die Länge der Hilfslinie. */
  von: number;
  bis: number;
}

/** Sammelt alle senkrechten bzw. waagerechten Linien, an denen eingerastet wird. */
function sammleKandidaten(
  andere: PlanElement[],
  grund: Grundflaeche,
  achse: 'x' | 'y',
): Kandidat[] {
  const liste: Kandidat[] = [];

  // Jede Wand des Grundrisses – Außenkante und Innenkante. Bei einem einfachen
  // Rechteck sind das die vier bekannten Wände; bei einer L-Form kommen die
  // einspringenden Wände von selbst dazu.
  for (const linie of wandlinien(grund.umriss, grund.wandstaerke)) {
    if (linie.achse === achse) {
      liste.push({ wert: linie.wert, von: linie.von, bis: linie.bis });
    }
  }

  // Die Mitte des Gebäudes – praktisch, um etwas mittig auszurichten.
  const aussen = umrissRahmen(grund.umriss);
  liste.push(
    achse === 'x'
      ? { wert: (aussen.links + aussen.rechts) / 2, von: aussen.oben, bis: aussen.unten }
      : { wert: (aussen.oben + aussen.unten) / 2, von: aussen.links, bis: aussen.rechts },
  );

  // Kanten und Mitte aller übrigen Elemente.
  for (const el of andere) {
    const r = umgrenzung(el);
    if (achse === 'x') {
      liste.push({ wert: r.links, von: r.oben, bis: r.unten });
      liste.push({ wert: (r.links + r.rechts) / 2, von: r.oben, bis: r.unten });
      liste.push({ wert: r.rechts, von: r.oben, bis: r.unten });
    } else {
      liste.push({ wert: r.oben, von: r.links, bis: r.rechts });
      liste.push({ wert: (r.oben + r.unten) / 2, von: r.links, bis: r.rechts });
      liste.push({ wert: r.unten, von: r.links, bis: r.rechts });
    }
  }
  return liste;
}

/**
 * Berechnet die eingerastete Position eines Elements.
 *
 * @param rahmen    Umgrenzung des gezogenen Elements an der aktuellen Mausposition
 * @param andere    alle übrigen Elemente (das gezogene selbst nicht!)
 * @param toleranz  Fangbereich in cm (hängt vom Zoom ab, damit es sich immer
 *                  gleich anfühlt)
 */
export function bestimmeEinrastung(
  rahmen: Rahmen,
  andere: PlanElement[],
  grund: Grundflaeche,
  einstellungen: Einstellungen,
  toleranz: number,
): EinrastErgebnis {
  let versatzX = 0;
  let versatzY = 0;
  const hilfslinien: Hilfslinie[] = [];

  const breite = rahmen.rechts - rahmen.links;
  const tiefe = rahmen.unten - rahmen.oben;

  // ---- 1. An anderen Elementen und Wänden ausrichten -----------------------
  if (einstellungen.hilfslinienAktiv) {
    for (const achse of ['x', 'y'] as const) {
      const kandidaten = sammleKandidaten(andere, grund, achse);
      // Die drei Kanten des gezogenen Elements, die einrasten dürfen.
      const eigene =
        achse === 'x'
          ? [rahmen.links, (rahmen.links + rahmen.rechts) / 2, rahmen.rechts]
          : [rahmen.oben, (rahmen.oben + rahmen.unten) / 2, rahmen.unten];

      let bester: { abstand: number; versatz: number; kandidat: Kandidat } | null = null;
      for (const kante of eigene) {
        for (const k of kandidaten) {
          const abstand = Math.abs(k.wert - kante);
          if (abstand <= toleranz && (bester === null || abstand < bester.abstand)) {
            bester = { abstand, versatz: k.wert - kante, kandidat: k };
          }
        }
      }

      if (bester) {
        if (achse === 'x') {
          versatzX = bester.versatz;
          hilfslinien.push({
            richtung: 'senkrecht',
            position: bester.kandidat.wert,
            von: Math.min(bester.kandidat.von, rahmen.oben),
            bis: Math.max(bester.kandidat.bis, rahmen.unten),
          });
        } else {
          versatzY = bester.versatz;
          hilfslinien.push({
            richtung: 'waagerecht',
            position: bester.kandidat.wert,
            von: Math.min(bester.kandidat.von, rahmen.links),
            bis: Math.max(bester.kandidat.bis, rahmen.rechts),
          });
        }
      }
    }
  }

  // ---- 2. Sonst am Raster ausrichten --------------------------------------
  if (einstellungen.amRasterEinrasten) {
    const w = einstellungen.rasterWeite;
    if (versatzX === 0) {
      versatzX = Math.round(rahmen.links / w) * w - rahmen.links;
    }
    if (versatzY === 0) {
      versatzY = Math.round(rahmen.oben / w) * w - rahmen.oben;
    }
  }

  // Rückgabe ist wieder der Mittelpunkt.
  return {
    x: rahmen.links + versatzX + breite / 2,
    y: rahmen.oben + versatzY + tiefe / 2,
    hilfslinien,
  };
}

/**
 * Ermittelt die Abstände eines Elements nach links, rechts, oben und unten –
 * jeweils bis zum nächsten Nachbarn oder zur Wand.
 */
export function berechneAbstaende(
  rahmen: Rahmen,
  andere: PlanElement[],
  grund: Grundflaeche,
): Abstandsmass[] {
  const masse: Abstandsmass[] = [];
  const mitteX = (rahmen.links + rahmen.rechts) / 2;
  const mitteY = (rahmen.oben + rahmen.unten) / 2;
  const w = grund.wandstaerke;

  const nachbarn = andere.map(umgrenzung);

  /**
   * Die Innenkante der Wand, die in dieser Richtung gegenübersteht.
   *
   * Gesucht wird vom Mittelpunkt des Elements aus. Bei einem L-förmigen Markt
   * ist das die tatsächlich gegenüberliegende Wand und nicht die äußere
   * Umgrenzung – sonst zeigte das Maß einen Abstand an, den es nicht gibt.
   */
  const wand = (richtung: 'links' | 'rechts' | 'oben' | 'unten'): number | undefined => {
    const start = { x: mitteX, y: mitteY };
    const treffer = strahlAufUmriss(start, richtung, grund.umriss);
    if (treffer === undefined) return undefined;
    return richtung === 'rechts' || richtung === 'unten' ? treffer - w : treffer + w;
  };

  // --- waagerecht: links und rechts ---
  const waagerechteNachbarn = nachbarn.filter(
    (r) => r.unten > rahmen.oben && r.oben < rahmen.unten,
  );
  const links = Math.max(
    wand('links') ?? rahmen.links,
    ...waagerechteNachbarn.filter((r) => r.rechts <= rahmen.links).map((r) => r.rechts),
  );
  const rechts = Math.min(
    wand('rechts') ?? rahmen.rechts,
    ...waagerechteNachbarn.filter((r) => r.links >= rahmen.rechts).map((r) => r.links),
  );
  if (rahmen.links - links > 0.5) {
    masse.push({ x1: links, y1: mitteY, x2: rahmen.links, y2: mitteY, wert: rahmen.links - links });
  }
  if (rechts - rahmen.rechts > 0.5) {
    masse.push({ x1: rahmen.rechts, y1: mitteY, x2: rechts, y2: mitteY, wert: rechts - rahmen.rechts });
  }

  // --- senkrecht: oben und unten ---
  const senkrechteNachbarn = nachbarn.filter(
    (r) => r.rechts > rahmen.links && r.links < rahmen.rechts,
  );
  const oben = Math.max(
    wand('oben') ?? rahmen.oben,
    ...senkrechteNachbarn.filter((r) => r.unten <= rahmen.oben).map((r) => r.unten),
  );
  const unten = Math.min(
    wand('unten') ?? rahmen.unten,
    ...senkrechteNachbarn.filter((r) => r.oben >= rahmen.unten).map((r) => r.oben),
  );
  if (rahmen.oben - oben > 0.5) {
    masse.push({ x1: mitteX, y1: oben, x2: mitteX, y2: rahmen.oben, wert: rahmen.oben - oben });
  }
  if (unten - rahmen.unten > 0.5) {
    masse.push({ x1: mitteX, y1: rahmen.unten, x2: mitteX, y2: unten, wert: unten - rahmen.unten });
  }

  return masse;
}
