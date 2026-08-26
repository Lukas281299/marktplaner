import { laeuftRueckwaerts } from './beschriftung';
import { neueId } from './id';
import type { PlanElement, Warengruppenband } from '../typen/modell';

/**
 * Die Warengruppen-Beschriftung unter einer Reihe von Möbeln.
 *
 * Ein **Band** gehört zu einer Auswahl von Elementen, nicht zu einem Feld:
 * Man markiert die Meter, die zusammengehören, und drückt Enter. Darunter
 * steht dann **ein** Name über die ganze Strecke – nicht viermal „Eier" über
 * vier Metern.
 *
 * Kommen weitere Sortimente auf dieselbe Strecke, wachsen sie in denselben
 * Text hinein, mit Komma getrennt: „Eier, Butter". Ein zweiter Text darunter
 * wäre schwerer zu lesen und im Plan nicht üblich.
 *
 * Ein Möbel gehört zu **höchstens einem** Band. Sonst stünden zwei
 * Beschriftungen übereinander, und man müsste raten, welche gilt.
 */

/** Wie die Namen im Band verbunden werden. */
const TRENNER = ', ';

/** Die Namen eines Bandes, einzeln. */
export function namenVon(band: Warengruppenband): string[] {
  return band.text
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Sind das dieselben Elemente – ohne Rücksicht auf die Reihenfolge? */
export function gleicheElemente(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const menge = new Set(a);
  return b.every((id) => menge.has(id));
}

/**
 * Ordnet einer Auswahl einen Namen zu.
 *
 * Drei Fälle, in dieser Reihenfolge:
 *
 *  1. Es gibt schon ein Band mit **genau dieser** Auswahl – dann kommt der
 *     Name dort dazu, mit Komma. Zweimal derselbe Name kommt nicht dazu.
 *  2. Sonst entsteht ein neues Band.
 *
 * In beiden Fällen verlieren andere Bänder die betroffenen Elemente: Ein
 * Möbel trägt eine Beschriftung, nicht zwei übereinander. Bänder, die dabei
 * leer werden, fallen weg.
 */
export function mitZugeordnetem(
  baender: Warengruppenband[],
  auswahl: string[],
  name: string,
): Warengruppenband[] {
  const text = name.trim();
  if (!text || auswahl.length === 0) return baender;

  const treffer = baender.find((b) => gleicheElemente(b.elemente, auswahl));
  if (treffer) {
    if (namenVon(treffer).some((n) => n.toLocaleLowerCase('de-DE') === text.toLocaleLowerCase('de-DE'))) {
      return baender;
    }
    return baender.map((b) =>
      b.id === treffer.id ? { ...b, text: `${b.text}${TRENNER}${text}` } : b,
    );
  }

  // Die Elemente aus allen anderen Bändern lösen, dann das neue anhängen.
  const gewaehlt = new Set(auswahl);
  const uebrig = baender
    .map((b) => ({ ...b, elemente: b.elemente.filter((id) => !gewaehlt.has(id)) }))
    .filter((b) => b.elemente.length > 0);

  return [...uebrig, { id: neueId('band'), elemente: [...auswahl], text }];
}

/** Nimmt die Beschriftung von diesen Elementen weg. */
export function ohneElemente(
  baender: Warengruppenband[],
  ids: string[],
): Warengruppenband[] {
  const menge = new Set(ids);
  return baender
    .map((b) => ({ ...b, elemente: b.elemente.filter((id) => !menge.has(id)) }))
    .filter((b) => b.elemente.length > 0);
}

/** Das Band, zu dem dieses Element gehört – falls es eines gibt. */
export function bandVon(
  baender: Warengruppenband[],
  elementId: string,
): Warengruppenband | undefined {
  return baender.find((b) => b.elemente.includes(elementId));
}

/** Wo und wie breit ein Band im Plan liegt. */
export interface Bandlage {
  /** Mitte der Strecke, in Weltkoordinaten. */
  x: number;
  y: number;
  /** Länge der Strecke – so breit darf der Text werden. */
  breite: number;
  /** Drehung der Schrift in Grad. */
  drehung: number;
  /** Ob der Text gewendet werden muss, damit er sich lesen lässt. */
  kopfueber: boolean;
}

/**
 * Rechnet aus, wo die Beschriftung eines Bandes steht.
 *
 * Die Elemente einer Strecke stehen in einer Flucht – daran hängt die ganze
 * Rechnung. Genommen wird die Richtung des **ersten** Elements; die übrigen
 * werden auf diese Achse projiziert. Steht eines schief, verschiebt das die
 * Beschriftung ein wenig, aber nichts geht kaputt.
 *
 * Der Abstand nach unten richtet sich nach dem **tiefsten** Möbel der
 * Strecke: Die Schrift soll unter allen stehen und nicht auf einem davon.
 */
export function bandlage(
  band: Warengruppenband,
  alle: PlanElement[],
  abstand: number,
): Bandlage | null {
  const elemente = band.elemente
    .map((id) => alle.find((el) => el.id === id))
    .filter((el): el is PlanElement => Boolean(el));
  if (elemente.length === 0) return null;

  const drehung = elemente[0].drehung;
  const bogen = (drehung * Math.PI) / 180;
  // Längsrichtung des Möbels und die Richtung „nach vorn".
  const ux = Math.cos(bogen);
  const uy = Math.sin(bogen);
  const nx = -Math.sin(bogen);
  const ny = Math.cos(bogen);

  let von = Infinity;
  let bis = -Infinity;
  let vorn = -Infinity;

  for (const el of elemente) {
    const laengs = el.x * ux + el.y * uy;
    const quer = el.x * nx + el.y * ny;
    // Ein quer stehendes Möbel ist längs seiner Tiefe so breit wie tief.
    const halbe = ausdehnung(el, drehung) / 2;
    von = Math.min(von, laengs - halbe);
    bis = Math.max(bis, laengs + halbe);
    vorn = Math.max(vorn, quer + tiefeNachVorn(el, drehung) / 2);
  }

  const mitte = (von + bis) / 2;
  const abstandVorn = vorn + abstand;

  return {
    x: mitte * ux + abstandVorn * nx,
    y: mitte * uy + abstandVorn * ny,
    breite: bis - von,
    drehung,
    kopfueber: laeuftRueckwaerts(drehung),
  };
}

/**
 * Wie weit ein Möbel längs der Bandachse reicht.
 *
 * Steht es quer zur Strecke – eine Kopfgondel am Ende eines Zugs –, ist das
 * seine Tiefe und nicht seine Breite.
 */
function ausdehnung(el: PlanElement, achse: number): number {
  return quer(el.drehung, achse) ? el.tiefe : el.breite;
}

/** Wie tief ein Möbel quer zur Bandachse ist. */
function tiefeNachVorn(el: PlanElement, achse: number): number {
  return quer(el.drehung, achse) ? el.breite : el.tiefe;
}

/** Steht dieses Möbel quer zur Achse des Bandes? */
function quer(drehung: number, achse: number): boolean {
  const unterschied = (((drehung - achse) % 180) + 180) % 180;
  return unterschied > 45 && unterschied < 135;
}
