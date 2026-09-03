import { felderVon } from './regalseiten';
import { KISTE, kistenseiten } from './getraenkekisten';
import type { Auslagenanteil, Streckenmeter } from './warengruppenmeter';
import type { PlanElement, Regalfeld } from '../typen/modell';

/**
 * Wie viele Auslagen ein Möbel je laufendem Meter trägt.
 *
 * Die zweite Hälfte der Warengruppen-Auswertung. `warengruppenmeter` misst,
 * **wie lang** eine Warengruppe ist; hier steht, **wie oft** diese Länge
 * zählt. Ein Meter Regal mit fünf Böden sind fünf tatsächliche Meter.
 *
 * **Die Zahl am Feld gewinnt immer.** Steht am Feld eine Bodenzahl, gilt die
 * – über jede Regel hinweg, die hier aufgeschrieben ist. Ein Katalog kennt
 * die Bauart, aber nicht den Markt: Wer den obersten Boden herausgenommen
 * hat, weil die Decke tief hängt, trägt vier ein, und dann sind es vier.
 *
 * Erst wo nichts eingetragen ist, greifen die Regeln der Abteilung. Und wo
 * es auch dafür keine gibt, kommt **keine Zahl** heraus statt einer
 * geschätzten: Die Auswertung sagt dann, auf wie vielen Metern sie fehlt.
 * Eine erfundene Zahl wanderte sonst in eine Bestellung.
 *
 * Was unter den Böden steht, zählt eigenständig mit – eine Palette, eine
 * Kartoffelkiste, ein eingebautes Kühlmöbel. Es trägt Ware und ist damit
 * eine Auslage, ganz gleich was es ist.
 */

/**
 * Die Fachhöhe eines Tiefkühlschranks, in cm.
 *
 * Der H2010 hat 153 cm Sichtfläche auf fünf Böden. Daraus ergibt sich alles
 * Weitere in der Tiefkühlung.
 */
export const TK_FACH = 153 / 5;

/**
 * Die tote Zone zwischen zwei Böden, in cm – **geschätzt**.
 *
 * Der Boden selbst, die Preisschiene davor und die Luft, die über der Ware
 * bleiben muss. Wer sie genauer kennt, ändert diese eine Zahl; alles andere
 * in der Tiefkühlung rechnet sich daraus.
 */
export const TK_TOTZONE = 4;

/**
 * Auslagen je laufendem Meter **einer** Truhenseite.
 *
 * Eine Truhe ist stufenlos: 85 cm Auslage am Stück, ohne tote Zone. In einem
 * Schrank bleiben von einem Fach nach Abzug der toten Zone 26,6 cm übrig –
 * die Truhenseite ist also gut drei Fächer wert.
 *
 * Eine beidseitige Truhe kommt dadurch von selbst auf das Doppelte: Sie
 * trägt zwei Seiten, und jede zählt einzeln.
 */
export const TRUHE_AUSLAGE_CM = 85;
export const TRUHE_AUSLAGEN = Math.round((TRUHE_AUSLAGE_CM / (TK_FACH - TK_TOTZONE)) * 10) / 10;

/** Die Sichtfläche des Schrankteils eines Kombigeräts, in cm. */
const KOMBI_SICHT = { niedrig: 85.2, hoch: 105.2 };

/** Ab dieser Höhe in cm gilt ein Möbel als die hohe Bauform. */
const TK_SCHRANK_HOCH = 211;
const TK_KOMBI_HOCH = 220;

/**
 * Wie viele Auslagen ein Möbel je laufendem Meter mitbringt.
 *
 * Die Bauart, nicht die Planung – deshalb steht hier nur, was aus dem
 * Katalog folgt. Alles, was der Planer entscheidet, steht am Feld und geht
 * dieser Zahl vor.
 */
export function moebelauslagen(
  element: PlanElement,
  seite: 'unten' | 'oben' = 'unten',
): number | undefined {
  const hoehe = element.hoehe ?? 0;

  // Die Getränkeabteilung zählt in **Kistenfacings** und nicht in Böden.
  //
  // Eine Kiste misst 40 × 30 cm und ist damit nicht quadratisch: Wer sie
  // längs stellt, bekommt 2,5 auf den laufenden Meter, wer sie quer stellt,
  // 3,33. Genau dieser Unterschied ist die Entscheidung, um die es beim
  // Einräumen geht – er darf in der Zahl nicht verschwinden.
  //
  // **Gezählt wird die vordere Reihe.** Ein Facing ist, was der Kunde sieht;
  // was dahintersteht, ist Nachschub. Die Zahl der Reihen ist deshalb eine
  // **eigene** Kennzahl neben dieser (siehe `logik/getraenkezahlen.ts`) und
  // kein Faktor darin – sonst sagte eine Zahl zwei Dinge auf einmal, und man
  // sähe nicht mehr, ob die Gasse eng oder das Sortiment breit ist.
  //
  // Die Seite zur Gasse zeichnet das Symbol **oben** – siehe
  // `zeichneGetraenkegestell`, wo `vorne` bis zur Gestellkante nach oben
  // wächst. Deshalb liegt sie hier an „oben" und nicht an „unten", anders
  // als bei einem Regal. Steht auf beiden Seiten dasselbe – der Regelfall –,
  // macht die Zuordnung ohnehin keinen Unterschied.
  if (element.form === 'getraenkegestell') {
    const { vorne, hinten } = kistenseiten(element.kisten);
    const dran = seite === 'oben' ? vorne : hinten;
    // Keine Reihe heißt: Diese Seite steht an der Wand und zeigt nichts.
    if (!dran || dran.reihen <= 0) return 0;
    const kistenbreite = dran.lage === 'laengs' ? KISTE.laenge : KISTE.breite;
    return 100 / kistenbreite;
  }

  switch (element.form) {
    // Tiefkühlung. Truhe stufenlos, Schrank in Böden, Kombi beides
    // übereinander: unten die Wanne, oben der Schrank.
    case 'tkTruhe':
      return TRUHE_AUSLAGEN;
    case 'tkSchrank':
      return hoehe >= TK_SCHRANK_HOCH ? 6 : 5;
    case 'tkKombi':
      return (
        Math.round(
          (TRUHE_AUSLAGEN +
            (hoehe >= TK_KOMBI_HOCH ? KOMBI_SICHT.hoch : KOMBI_SICHT.niedrig) / TK_FACH) *
            10,
        ) / 10
      );

    // Bedienung und Selbstbedienung, nach den Schnittzeichnungen im
    // WSL-Katalog: Die bediente Theke und die flache Selbstbedienung zeigen
    // **eine** Lage Ware auf dem Auslageboden. Das halbhohe SV-Möbel trägt
    // über dem Grundboden zwei weitere Etagen – zusammen drei.
    //
    // Die SV-Etagen hängen an einer gelochten Säule und sind verstellbar;
    // wer vier einbaut, trägt am Feld eine 4 ein, und die gilt dann.
    case 'blinkTheke':
    case 'blinkSelf':
      return 1;
    case 'blinkSv':
      return 3;

    // Der BakeOff-Turm bringt vier Etagen mit, das Eckstück ebenso.
    case 'bakeoff':
    case 'bakeoffEcke':
      return 4;

    default:
      break;
  }

  // Obst und Gemüse trägt seine Auslagen am Möbel: Ein Vitable-Tisch bringt
  // sie aus dem Modul mit, nicht aus der Planung.
  //
  // **Die grünen Kisten stehen bewusst nicht in dieser Spalte.** Wie viele
  // Kisten einem Meter entsprechen, hängt daran, wie sie liegen und wie tief
  // die Auflage ist – es gibt keinen einzelnen Umrechnungskurs (siehe
  // `KISTEN_JE_METER` in `logik/ifko.ts`). Eine Spalte, die Kisten und Meter
  // addierte, ergäbe eine Zahl, die nichts bedeutet. Die Kisten laufen
  // deshalb als eigene Zahl mit – siehe `kistenAnteil`.
  if (element.auslagen && element.auslagen > 0) return element.auslagen;

  return undefined;
}

/**
 * Möbel, für die es **bewusst** keine zweite Zahl gibt.
 *
 * Blumen und Pflanzen haben kaum klassische Böden: ein Trog, eine Treppe,
 * ein Wagen. Dort sind die laufenden Meter die ganze Aussage.
 *
 * Das ist etwas anderes als eine fehlende Zahl. Zählte man diese Meter unter
 * „Bodenzahl fehlt", mahnte die Auswertung dauerhaft etwas an, das niemand
 * nachtragen will – und die eine Zeile, an der wirklich etwas fehlt, ginge
 * darin unter.
 */
export function ohneAuslagenbegriff(element: PlanElement): boolean {
  return element.kategorie === 'blumen';
}

/**
 * Wie viele grüne Kisten auf dieser Strecke stehen.
 *
 * Gilt für jedes Möbel, an dem eine Kistenzahl steht – auch für ein
 * Kartoffelregal, das aus der Kategorie „Regale" kommt und trotzdem in der
 * Obstabteilung steht. Die Abteilung entscheidet die Warengruppe, nicht der
 * Katalog.
 *
 * Die Zahl gilt für das **ganze** Möbel. Eine Gondel wird zweimal durchlaufen
 * – einmal je Seite –, also bekommt jede Seite die Hälfte.
 */
export function kistenAnteil(strecke: Streckenmeter): number {
  const el = strecke.element;
  if (!el.ifkoKisten || !(el.breite > 0)) return 0;
  const seiten = el.beidseitig ? 2 : 1;
  const jeCm = el.ifkoKisten / seiten / el.breite;
  return (strecke.bis - strecke.von) * jeCm;
}

/**
 * Was ein einzelnes Feld an Auslagen trägt.
 *
 * Die Bodenzahl, und dazu eine für den Unterbau: Was unter den Böden steht,
 * trägt Ware und zählt eigenständig – egal was es ist.
 */
export function feldauslagen(feld: Regalfeld, vorgabe?: number): number | undefined {
  // Ein leeres Feld trägt nichts. Die Säule steht, aber es hängt nichts
  // darin, und ein Sortiment liegt dort erst recht nicht.
  if (feld.leer) return 0;

  const boeden = feld.boeden ?? vorgabe;
  if (boeden === undefined || !Number.isFinite(boeden)) return undefined;
  return Math.max(0, boeden) + (feld.unterbau ? 1 : 0);
}

/**
 * Was eine beschriftete Strecke an tatsächlichen Metern trägt.
 *
 * **Feld für Feld, nicht für das ganze Möbel.** Ein Zug trägt oben fünf und
 * unten sechs Böden, und eine Warengruppe läuft über beide. Gewichtet wird
 * deshalb mit dem Stück, das jedes Feld zu dieser Strecke beiträgt.
 *
 * Fehlt an einem Feld die Zahl, fehlt sie nur für dessen Stück. Die Strecke
 * bekommt dann eine Zahl **und** eine Restlänge, auf der sie unvollständig
 * ist – so sieht man in der Tabelle, wie viel noch auszufüllen ist, statt
 * die ganze Strecke zu verlieren.
 */
export function auslagenAnteil(strecke: Streckenmeter): Auslagenanteil {
  const vorgabe = moebelauslagen(strecke.element, strecke.seite);
  const felder = felderVon(strecke.element, strecke.seite);

  // Wo es keinen Auslagenbegriff gibt, wandert eine fehlende Zahl nicht in
  // die Mahnung, sondern in „zählt nur laufend". **Ausgestiegen wird hier
  // aber nicht**: Steht am Feld doch eine Bodenzahl, gilt die – das ist die
  // Leitregel dieser Datei, und ein Pflanzregal mit drei Böden hat eben drei.
  const stumm = ohneAuslagenbegriff(strecke.element);

  let tatsaechlich = 0;
  let ohne = 0;
  let ohneMassstab = 0;
  let anfang = 0;

  const fehlt = (stueck: number) => {
    if (stumm) ohneMassstab += stueck;
    else ohne += stueck;
  };

  for (const feld of felder) {
    const ende = anfang + feld.breite;
    const stueck = Math.min(ende, strecke.bis) - Math.max(anfang, strecke.von);
    anfang = ende;
    if (stueck <= 0) continue;

    const zahl = feldauslagen(feld, vorgabe);
    if (zahl === undefined) fehlt(stueck);
    else tatsaechlich += stueck * zahl;
  }

  // Ragt die Strecke über die Felder hinaus – von Hand eingetippte Breite,
  // Abschnitt aus einer älteren Planung –, zählt der Überhang mit der
  // Vorgabe. Ihn wegzulassen hieße, Meter verschwinden zu lassen, die im
  // Plan stehen.
  const ueberhang = strecke.bis - Math.max(strecke.von, anfang);
  if (ueberhang > 0) {
    if (vorgabe === undefined) fehlt(ueberhang);
    else tatsaechlich += ueberhang * vorgabe;
  }

  // Das Eckstück steht schräg: Seine Front ist länger als der Platz, den es
  // am Boden belegt. Die **laufenden** Meter bleiben der Grundriss – daran
  // hängen die Warengruppenstrecken –, die **tatsächlichen** rechnen mit der
  // Front. Sonst fehlten an einer Backwarenecke zwei von sieben Metern.
  return { tatsaechlich: tatsaechlich * frontfaktor(strecke.element), ohne, ohneMassstab };
}

/**
 * Um wie viel länger die Front eines Möbels ist als sein Platz am Boden.
 *
 * Nur die schräg abgeschnittenen Eckstücke haben einen: Ein Stück von 44 cm
 * Breite, vorn unter 45° abgeschnitten, zeigt eine Kante von 63 cm. Wer es
 * mit seiner Breite rechnet, verliert knapp ein Drittel – und zwar an jeder
 * Ecke im Markt.
 *
 * Für alles andere kommt 1 heraus, und dann ändert sich an keiner
 * bestehenden Zahl etwas.
 */
export function frontfaktor(element: PlanElement): number {
  if (element.form !== 'bakeoffEcke' && element.form !== 'vitableEckInnen') return 1;
  const breite = element.breite;
  if (!(breite > 0)) return 1;
  // Die Schräge läuft über die Breite und höchstens über die volle Tiefe –
  // genau die Kante, die das Symbol zeichnet.
  const schraege = Math.hypot(breite, Math.min(breite, element.tiefe));
  return schraege / breite;
}
