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
  // Ein Trog, eine Treppe, eine Bewässerungswanne: Bei Blumen und Pflanzen
  // gibt es kaum klassische Böden, und die Abteilung zählt ohnehin nur
  // laufende Meter (siehe `logik/auslagen.ts`, NUR_LAUFENDE_METER).
  if (element.kategorie === 'blumen') return false;
  return !OHNE_BOEDEN.has(element.form);
}

/**
 * Möbel, bei denen die Seitenzahl aus dem Katalog kommt.
 *
 * Die **Truhe** gibt es ein- und beidseitig als **zwei verschiedene Möbel**,
 * mit verschiedener Tiefe: 112 gegen 212 cm. Welche von beiden im Markt
 * steht, entscheidet man beim Einsetzen und nicht danach mit einem Schalter –
 * der verdoppelte die Meter, ohne die Tiefe anzufassen, und aus einer Single
 * Island wurde eine Double Island, die im Plan nur halb so tief steht.
 *
 * Deshalb ist der Schalter hier **immer** weg, auch an der beidseitigen: Die
 * Vorlage hat den Wert richtig gesetzt, und niemand soll ihn verstellen. Wer
 * die andere Bauart braucht, nimmt sie aus dem Katalog.
 */
const SEITEN_AUS_DEM_KATALOG: ReadonlySet<Grundform> = new Set<Grundform>(['tkTruhe']);

/**
 * Möbel, die keine zweite Seite haben können.
 *
 * Der Schalter verdoppelt die Meter. Das setzt voraus, dass es zwei Seiten
 * gibt, die getrennt bestückt werden – und eine **Palette**, ein
 * **Drehständer** und eine **Schütte** stehen frei im Gang: Man kommt von
 * überall heran, aber es ist eine Fläche und nicht zwei.
 *
 * Anders als bei der Truhe bleibt der Schalter hier sichtbar, wenn er schon
 * auf an steht. Dort wäre das ein Fehler aus einer älteren Planung, und man
 * muss ihn zurücknehmen können.
 */
const OHNE_ZWEITE_SEITE: ReadonlySet<Grundform> = new Set<Grundform>([
  'palette',
  'drehstaender',
]);

/** Dasselbe, wo die Form allein es nicht sagt: Die Schütte ist ein Trog. */
const OHNE_ZWEITE_SEITE_VORLAGEN: ReadonlySet<string> = new Set(['schuette']);

/**
 * Zeigt dieses Möbel den Schalter „beidseitig bestückt"?
 *
 * Eine Kasse hat keine zweite Seite, eine Säule auch nicht, und eine Palette
 * ebenso wenig. Bei allem übrigen, was Ware trägt, bleibt der Schalter
 * stehen: Ob jemand zwei Kühlmöbel Rücken an Rücken als **ein** Möbel plant,
 * ist seine Entscheidung und nicht die des Katalogs.
 *
 * Bei der Truhe ist es umgekehrt – dort ist es die des Katalogs.
 */
export function zeigtBeidseitig(element: PlanElement): boolean {
  if (SEITEN_AUS_DEM_KATALOG.has(element.form)) return false;
  if (element.beidseitig) return true;
  if (!traegtWare(element)) return false;
  if (OHNE_ZWEITE_SEITE_VORLAGEN.has(element.vorlageId)) return false;
  return !OHNE_ZWEITE_SEITE.has(element.form);
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

/**
 * Zonen und Anmerkungen – kein Möbel.
 *
 * Eine Aktionsfläche ist ein Stück Boden, ein Textfeld eine Anmerkung im
 * Plan. Beide haben Breite und Tiefe, aber keine Höhe und keinen Hersteller.
 */
const ZONEN: ReadonlySet<Grundform> = new Set<Grundform>(['aktionsflaeche', 'textfeld']);

/**
 * Zeigt dieses Element das Feld „Höhe"?
 *
 * Die Höhe wird im Grundriss nicht gezeichnet; sie steht da, damit man beim
 * Bestellen nachsehen kann. Eine Zone hat keine.
 */
export function zeigtHoehe(element: PlanElement): boolean {
  if (element.hoehe !== undefined && element.hoehe > 0) return true;
  return !ZONEN.has(element.form);
}

/**
 * Zeigt dieses Element das Feld „Hersteller / Modell"?
 *
 * Dieselbe Frage: Eine Aktionsfläche und ein Textfeld stehen in keinem
 * Katalog. Die **Notiz** daneben bleibt in jedem Fall – ein Satz dazu ist
 * überall nützlich.
 */
export function zeigtHersteller(element: PlanElement): boolean {
  if (element.hersteller) return true;
  return !ZONEN.has(element.form);
}
