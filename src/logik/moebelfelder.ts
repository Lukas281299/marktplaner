import { traegtWare } from './warengruppenmeter';
import { ersteStufe } from './sortiment';
import type { Grundform, PlanElement } from '../typen/modell';

/**
 * Welche Eingaben zu welchem Möbel gehören.
 *
 * Das Eigenschaftenfenster zeigte an jedem Element dieselben Felder. An einer
 * Kasse standen damit „Unterster Boden", „Korpustiefe", „Beidseitig bestückt"
 * und ein Warengruppenband — vier Angaben aus der Welt der Regale, an einem
 * Möbel, das keine Ware trägt.
 *
 * Das ist nicht nur unaufgeräumt. Ein Feld, das dasteht, sieht aus wie eines,
 * das man ausfüllen soll; und was jemand hineinschreibt, wandert in die
 * Auswertung. Ein leeres Feld an der falschen Stelle ist eine Einladung zum
 * Fehler.
 *
 * **Was einen Wert trägt, bleibt sichtbar.** Sonst käme niemand mehr an eine
 * Zahl heran, die aus einem eingelesenen Plan, einer älteren Fassung oder
 * einem umgewidmeten Möbel stammt. Weggeräumt wird, was leer *und*
 * bedeutungslos ist.
 */

/**
 * Möbel, die keine Böden haben.
 *
 * Eine Truhe ist eine Wanne, ein Preisgestell trägt Kisten davor, eine
 * Palette ist ein Ladungsträger. Bei ihnen gibt es keine Bodentiefe, nach der
 * jemand fragen könnte.
 */
const OHNE_BOEDEN: ReadonlySet<Grundform> = new Set<Grundform>([
  'tkTruhe',
  'getraenkegestell',
  'palette',
  'drehstaender',
  'kastenablage',
]);

/**
 * Zeigt dieses Möbel die Bodenmaße — Korpustiefe und unterster Boden?
 *
 * Beide beschreiben, wie tief die Ware liegt. Das setzt Böden voraus, und
 * Böden setzen voraus, dass überhaupt Ware daraufliegt.
 */
export function zeigtBodenmasse(element: PlanElement): boolean {
  if (element.korpustiefe !== undefined || element.grundboden !== undefined) return true;
  if (!traegtWare(element)) return false;
  return !OHNE_BOEDEN.has(element.form);
}

/**
 * Zeigt dieses Möbel den Schalter „beidseitig bestückt"?
 *
 * Eine Kasse hat keine zweite Seite, eine Säule auch nicht. Bei allem, was
 * Ware trägt, bleibt der Schalter dagegen stehen: Ob jemand zwei Kühlmöbel
 * Rücken an Rücken als **ein** Möbel plant, ist seine Entscheidung und nicht
 * die des Katalogs.
 */
export function zeigtBeidseitig(element: PlanElement): boolean {
  return Boolean(element.beidseitig) || traegtWare(element);
}

/**
 * Zeigt dieses Möbel ein Warengruppenband und eine Feldnotiz?
 *
 * Dieselbe Frage wie in der Auswertung: Was keine Ware trägt, bekommt auch
 * keine Warengruppe. Eine Kassenzeile, eine Kundenführung, eine Säule tragen
 * keine — und was man dort hineinschriebe, stünde danach in keiner Tabelle.
 */
export function zeigtWarengruppen(element: PlanElement): boolean {
  const abschnitte = [...(element.warengruppenUnten ?? []), ...(element.warengruppenOben ?? [])];
  if (abschnitte.length > 0) return true;
  return traegtWare(element);
}

/**
 * Der Name der Abteilung, an dem Obst und Gemüse erkannt wird.
 *
 * Dieselbe Frage wie in der Auswertung (`logik/meterbaum.ts`): Die Abteilung
 * entscheidet, nicht der Katalog. Ein Kartoffelregal kommt aus „Regale" und
 * steht trotzdem beim Obst.
 */
const OG_ERKENNUNG = /obst|gem(ü|ue)se/i;

/**
 * Steht dieses Möbel in der Obst- und Gemüseabteilung?
 *
 * Gefragt wird das Möbel selbst: Was auf seinen Strecken steht, sagt, wo es
 * steht. Ohne Pfad – frei getippt oder aus einer älteren Planung – bleibt der
 * Name; der trifft „Obst" und „Gemüse" genauso.
 */
function stehtBeimObst(element: PlanElement): boolean {
  const abschnitte = [...(element.warengruppenUnten ?? []), ...(element.warengruppenOben ?? [])];
  return abschnitte.some((a) => OG_ERKENNUNG.test(a.pfad ? ersteStufe(a.pfad) : a.text));
}

/**
 * Zeigt dieses Möbel die Auslagen und die grünen Kisten?
 *
 * Die Kistenzahl ist die Kennzahl **einer Abteilung**. Sie stand bisher an
 * jedem Regal und an jedem Kühlmöbel des Marktes – an zweihundert
 * Trockenregalen ein leeres Feld, das nach einer Zahl aussieht, die niemand
 * hat. Gleichzeitig darf sie am Kartoffelregal nicht fehlen, und das kommt
 * aus der Kategorie „Regale".
 *
 * Deshalb entscheidet nicht der Katalog, sondern:
 *
 *  - eine schon eingetragene Zahl – die bleibt immer erreichbar,
 *  - die Kategorie „Obst & Gemüse",
 *  - ein gestuftes Möbel (Vitable): Es bringt seine Auflagen mit,
 *  - oder eine Warengruppe aus der Obst- und Gemüseabteilung auf dem Möbel.
 *
 * Das Kartoffelregal bekommt das Feld also, sobald es beschriftet ist – und
 * das ist es, bevor jemand nach Kisten fragt.
 */
export function zeigtKisten(element: PlanElement): boolean {
  if (element.ifkoKisten !== undefined || element.auslagen !== undefined) return true;
  if (!traegtWare(element)) return false;
  if (element.kategorie === 'obstgemuese') return true;
  if (element.stufen && element.stufen.length > 0) return true;
  return stehtBeimObst(element);
}
