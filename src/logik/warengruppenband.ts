import { laeuftRueckwaerts } from './beschriftung';
import { neueId } from './id';
import { felderVon, seitenbreite, type Seite } from './regalseiten';
import type { PlanElement, Warengruppenband, Feldbezug } from '../typen/modell';

/**
 * Die Warengruppen-Beschriftung unter einer Reihe von Metern.
 *
 * Ein **Band** gehört zu einer Menge von **Feldern** und nicht zu einem Möbel:
 * Eine Gondel ist ein einziges Element mit sechs Feldern, und die sechs Meter
 * darin tragen verschiedene Warengruppen. Über Elemente ließe sich das nie
 * ausdrücken.
 *
 * Markiert wird durch Anklicken der Meter, geschrieben wird mit Enter. Über
 * die ganze Strecke steht dann **ein** Name mit einem Strich an jedem Ende –
 * nicht viermal „Eier" über vier Metern.
 *
 * Kommen weitere Sortimente auf dieselbe Strecke, wachsen sie in denselben
 * Text hinein, mit Komma getrennt: „Eier, Butter".
 *
 * Ein Feld gehört zu **höchstens einem** Band. Sonst stünden zwei
 * Beschriftungen übereinander, und man müsste raten, welche gilt.
 */

/** Wie die Namen im Band verbunden werden. */
const TRENNER = ', ';

/** Ein Feld eindeutig benennen – für Vergleiche und Mengen. */
export function feldSchluessel(bezug: Feldbezug): string {
  return `${bezug.element}|${bezug.seite}|${bezug.feld}`;
}

/** Die Namen eines Bandes, einzeln. */
export function namenVon(band: Warengruppenband): string[] {
  return band.text
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Dieselben Felder – ohne Rücksicht auf die Reihenfolge? */
export function gleicheFelder(a: Feldbezug[], b: Feldbezug[]): boolean {
  if (a.length !== b.length) return false;
  const menge = new Set(a.map(feldSchluessel));
  return b.every((f) => menge.has(feldSchluessel(f)));
}

/** Ist dieses Feld markiert? */
export function enthaelt(felder: Feldbezug[], bezug: Feldbezug): boolean {
  const gesucht = feldSchluessel(bezug);
  return felder.some((f) => feldSchluessel(f) === gesucht);
}

/** Nimmt ein Feld in die Markierung auf oder wieder heraus. */
export function umgeschaltet(felder: Feldbezug[], bezug: Feldbezug): Feldbezug[] {
  const gesucht = feldSchluessel(bezug);
  return enthaelt(felder, bezug)
    ? felder.filter((f) => feldSchluessel(f) !== gesucht)
    : [...felder, bezug];
}

/**
 * Ordnet einer Markierung einen Namen zu.
 *
 * Gibt es schon ein Band mit **genau diesen** Feldern, kommt der Name dort
 * dazu, mit Komma; sonst entsteht ein neues. In beiden Fällen verlieren
 * andere Bänder die betroffenen Felder – ein Meter trägt eine Beschriftung,
 * nicht zwei übereinander. Bänder, die dabei leer werden, fallen weg.
 */
export function mitZugeordnetem(
  baender: Warengruppenband[],
  markierung: Feldbezug[],
  name: string,
): Warengruppenband[] {
  const text = name.trim();
  if (!text || markierung.length === 0) return baender;

  const treffer = baender.find((b) => gleicheFelder(b.felder, markierung));
  if (treffer) {
    const klein = text.toLocaleLowerCase('de-DE');
    if (namenVon(treffer).some((n) => n.toLocaleLowerCase('de-DE') === klein)) return baender;
    return baender.map((b) =>
      b.id === treffer.id ? { ...b, text: `${b.text}${TRENNER}${text}` } : b,
    );
  }

  const gewaehlt = new Set(markierung.map(feldSchluessel));
  const uebrig = baender
    .map((b) => ({ ...b, felder: b.felder.filter((f) => !gewaehlt.has(feldSchluessel(f))) }))
    .filter((b) => b.felder.length > 0);

  return [...uebrig, { id: neueId('band'), felder: [...markierung], text }];
}

/** Nimmt die Beschriftung von diesen Möbeln weg – etwa beim Löschen. */
export function ohneElemente(
  baender: Warengruppenband[],
  ids: string[],
): Warengruppenband[] {
  const menge = new Set(ids);
  return baender
    .map((b) => ({ ...b, felder: b.felder.filter((f) => !menge.has(f.element)) }))
    .filter((b) => b.felder.length > 0);
}

/** Das Band, zu dem dieses Feld gehört – falls es eines gibt. */
export function bandVon(
  baender: Warengruppenband[],
  bezug: Feldbezug,
): Warengruppenband | undefined {
  return baender.find((b) => enthaelt(b.felder, bezug));
}

// ------------------------------------------------------------------ Lage

/** Wo ein Feld im Plan liegt – seine Vorderkante, in Weltkoordinaten. */
export interface Feldlage {
  /** Mitte der Vorderkante. */
  x: number;
  y: number;
  /** Länge des Felds längs des Möbels. */
  breite: number;
  drehung: number;
  /** Welche Seite des Möbels – daran hängt, wohin „vorn" zeigt. */
  seite: Seite;
  /** Richtung „nach vorn", vom Möbel weg, in Weltkoordinaten. */
  nx: number;
  ny: number;
}

/**
 * Die Vorderkante eines Feldes in Weltkoordinaten.
 *
 * „Vorn" ist beim Regal die Seite, an der die Ware steht: bei der
 * Vorderseite die untere Kante, bei der Rückseite einer Gondel die obere.
 * Genau dort steht auch die Beschriftung – dieselbe Stelle wie bei den von
 * Hand gesetzten.
 */
export function feldlage(element: PlanElement, seite: Seite, feld: number): Feldlage | null {
  const felder = felderVon(element, seite);
  if (feld < 0 || feld >= felder.length) return null;

  const laenge = Math.max(
    seitenbreite(felderVon(element, 'oben')),
    seitenbreite(felderVon(element, 'unten')),
  );
  const faktor = laenge > 0 ? element.breite / laenge : 1;

  let x = 0;
  for (let i = 0; i < feld; i++) x += felder[i].breite * faktor;
  const weite = felder[feld].breite * faktor;

  // Eigene Koordinaten, Ursprung in der Mitte des Möbels.
  const mx = x + weite / 2 - element.breite / 2;
  const my = seite === 'oben' ? -element.tiefe / 2 : element.tiefe / 2;

  const bogen = (element.drehung * Math.PI) / 180;
  const cos = Math.cos(bogen);
  const sin = Math.sin(bogen);
  // Die eigene y-Achse in Weltkoordinaten, bei der Rückseite umgedreht.
  const richtung = seite === 'oben' ? -1 : 1;

  return {
    x: element.x + mx * cos - my * sin,
    y: element.y + mx * sin + my * cos,
    breite: weite,
    drehung: element.drehung,
    seite,
    nx: -sin * richtung,
    ny: cos * richtung,
  };
}

/** Wo die Beschriftung eines Bandes steht. */
export interface Bandlage {
  x: number;
  y: number;
  breite: number;
  drehung: number;
  kopfueber: boolean;
  /** Welche Seite des Möbels – daran hängt, wohin die Schrift wächst. */
  seite: Seite;
}

/**
 * Rechnet aus, wo die Beschriftung eines Bandes steht.
 *
 * Genommen wird die Richtung des **ersten** Feldes; die übrigen werden auf
 * diese Achse projiziert. Die Meter einer Strecke stehen in einer Flucht –
 * daran hängt die ganze Rechnung. Steht eines schief, verschiebt das die
 * Beschriftung ein wenig, aber nichts geht kaputt.
 */
export function bandlage(
  band: Warengruppenband,
  alle: PlanElement[],
  abstand: number,
): Bandlage | null {
  const lagen: Feldlage[] = [];
  for (const bezug of band.felder) {
    const element = alle.find((el) => el.id === bezug.element);
    if (!element) continue;
    const lage = feldlage(element, bezug.seite, bezug.feld);
    if (lage) lagen.push(lage);
  }
  if (lagen.length === 0) return null;

  const erste = lagen[0];
  const bogen = (erste.drehung * Math.PI) / 180;
  const ux = Math.cos(bogen);
  const uy = Math.sin(bogen);

  let von = Infinity;
  let bis = -Infinity;
  let vorn = -Infinity;

  for (const lage of lagen) {
    const laengs = lage.x * ux + lage.y * uy;
    von = Math.min(von, laengs - lage.breite / 2);
    bis = Math.max(bis, laengs + lage.breite / 2);
    // Wie weit die Vorderkante in Richtung „vorn" liegt.
    vorn = Math.max(vorn, lage.x * erste.nx + lage.y * erste.ny);
  }

  const mitte = (von + bis) / 2;
  const hinaus = vorn + abstand;

  return {
    x: mitte * ux + hinaus * erste.nx,
    y: mitte * uy + hinaus * erste.ny,
    breite: bis - von,
    drehung: erste.drehung,
    kopfueber: laeuftRueckwaerts(erste.drehung),
    seite: erste.seite,
  };
}
