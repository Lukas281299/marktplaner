import { kistenbelegung, kistenseiten, seitentiefe } from './getraenkekisten';
import type { Projekt } from '../typen/modell';

/**
 * Was die Getränkeabteilung fasst.
 *
 * **Zwei Zahlen, und beide werden gebraucht.** Die Facings sagen, wie breit
 * das Sortiment ist – wie viele verschiedene Kästen vorn stehen können. Die
 * Reihen dahinter sagen, wie tief es ist: wie lange ein Kasten reicht, bevor
 * jemand nachschieben muss. Zwei Reihen statt vier heißt doppelt so oft
 * auffüllen, bei gleicher Sortimentsbreite.
 *
 * Deshalb zählt die eine Zahl nicht in die andere hinein. In der
 * Warengruppenauswertung stehen die Facings; hier daneben steht, wie tief
 * gestellt wird.
 *
 * Gezählt wird über die **ganze Gestelllänge** und nicht Feld für Feld: Ein
 * Zug aus 1,50 + 2,00 + 2,50 m ist ein durchgehendes Gestell, und die Kisten
 * laufen über die Stoßstellen hinweg – so stehen sie auch im Markt.
 */

/** Was in der Getränkeabteilung steht. */
export interface Getraenkezahlen {
  /** Wie viele Gestelle. */
  gestelle: number;
  /** Laufende Meter Gestell, beide Seiten zusammen, in cm. */
  laenge: number;
  /** Kisten in der vordersten Reihe – die Sortimentsbreite. */
  facings: number;
  /** Alle Kisten, die vor den Gestellen stehen. */
  kisten: number;
  /** Die tiefste Bestückung, die vorkommt, in Reihen. */
  reihenHoechstens: number;
  /** Die flachste Bestückung, die vorkommt, in Reihen. */
  reihenMindestens: number;
  /** Wie weit die Kisten in die Gasse ragen, tiefste Stelle, in cm. */
  tiefeHoechstens: number;
}

export function getraenkezahlen(projekt: Projekt): Getraenkezahlen {
  const sichtbar = new Set(
    (projekt.ebenen ?? []).filter((e) => e.sichtbar !== false).map((e) => e.id),
  );

  let gestelle = 0;
  let laenge = 0;
  let facings = 0;
  let kisten = 0;
  let reihenHoechstens = 0;
  let reihenMindestens = Number.POSITIVE_INFINITY;
  let tiefeHoechstens = 0;

  for (const el of projekt.elemente ?? []) {
    if (el.form !== 'getraenkegestell') continue;
    if (el.ebeneId && !sichtbar.has(el.ebeneId)) continue;
    if (!(el.breite > 0)) continue;

    gestelle++;
    const { vorne, hinten } = kistenseiten(el.kisten);
    for (const seite of [vorne, hinten]) {
      if (!seite || seite.reihen <= 0) continue;
      const belegung = kistenbelegung(el.breite, seite.lage, seite.reihen, 1);
      laenge += el.breite;
      facings += belegung.jeReihe;
      kisten += belegung.gesamt;
      reihenHoechstens = Math.max(reihenHoechstens, seite.reihen);
      reihenMindestens = Math.min(reihenMindestens, seite.reihen);
      tiefeHoechstens = Math.max(tiefeHoechstens, seitentiefe(seite));
    }
  }

  return {
    gestelle,
    laenge: Math.round(laenge),
    facings,
    kisten,
    reihenHoechstens,
    reihenMindestens: Number.isFinite(reihenMindestens) ? reihenMindestens : 0,
    tiefeHoechstens: Math.round(tiefeHoechstens),
  };
}
