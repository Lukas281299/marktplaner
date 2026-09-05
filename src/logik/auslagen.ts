import { felderVon, seitenbreite, type Seite } from './regalseiten';
import { KISTE, kistenseiten } from './getraenkekisten';
import { ifkoGewichte, ifkoVorschlag } from './ifko';
import { ersteStufe } from './sortiment';
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
    // **Bei einem einseitigen Gestell ist die eine Seite die bestückte.**
    // Sonst fiele die Facingzahl eines Wandgestells auf null: Gezeichnet wird
    // seine einzige Seite als „unten", bestückt ist aber „vorne", und der
    // Abgleich zwischen beiden Namen ist genau hier zu machen.
    const dran = hinten === null ? vorne : seite === 'oben' ? vorne : hinten;
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
 * Abteilungen, in denen es **bewusst** keine tatsächlichen Meter gibt.
 *
 * Blumen und Pflanzen haben kaum klassische Böden: ein Trog, eine Treppe,
 * ein Wagen. Die Gastronomie hat gar keine Ware im Regal. Dort sind die
 * laufenden Meter die ganze Aussage.
 *
 * Erkannt am **Namen der Abteilung** in der Sortimentsliste, wie schon bei
 * Obst und Gemüse (siehe `logik/meterbaum.ts`). Wer eine Abteilung umbenennt
 * oder eine weitere ohne Regale hat, ändert diese eine Zeile.
 */
export const NUR_LAUFENDE_METER = /blumen|pflanzen|centeria|gastronomie|restaurant/i;

/**
 * Trägt diese Strecke **bewusst** keine zweite Zahl?
 *
 * Das ist etwas anderes als eine fehlende Zahl. Zählte man diese Meter unter
 * „Bodenzahl fehlt", mahnte die Auswertung dauerhaft etwas an, das niemand
 * nachtragen will – und die eine Zeile, an der wirklich etwas fehlt, ginge
 * darin unter.
 *
 * **Entschieden wird an der Abteilung**, nicht am Möbel: Ein Blumentrog kann
 * überall stehen, und ein Regalmöbel in der Gastronomie ist trotzdem keines,
 * an dem man Böden zählt. Trägt die Strecke keinen Pfad – frei getippt oder
 * aus einer älteren Planung –, entscheidet ersatzweise die Möbelkategorie;
 * die trifft den Blumenfall, weil dort eigene Möbel stehen.
 */
export function ohneAuslagenbegriff(strecke: Streckenmeter): boolean {
  if (strecke.pfad) return NUR_LAUFENDE_METER.test(ersteStufe(strecke.pfad));
  return strecke.element.kategorie === 'blumen';
}

/**
 * Wie viele grüne Kisten ein Möbel trägt.
 *
 * **Ein Obst- und Gemüsemöbel rechnet es sich selbst aus** – aus seinen
 * Auflagen und deren Tiefen (siehe `logik/ifko.ts`). Von Hand eintragen muss
 * das niemand; wer es trotzdem tut, dessen Zahl gilt. Genau dieselbe Zahl
 * zeichnet das Symbol ins Möbel, damit Bild und Auswertung nicht zweierlei
 * sagen.
 *
 * Bei allem anderen gilt nur, was eingetragen ist. Ein Kartoffelregal kommt
 * aus der Kategorie „Regale" und steht trotzdem in der Obstabteilung – dort
 * trägt der Planer die Zahl ein, sonst bekäme jedes Trockenregal im Markt
 * eine Kistenzahl, die niemand wollte.
 */
export function kistenzahl(element: PlanElement): number {
  if (element.ifkoKisten !== undefined) return element.ifkoKisten;
  if (element.kategorie !== 'obstgemuese') return 0;
  return ifkoVorschlag(element) ?? 0;
}

/**
 * Die Kisten eines Möbels, aufgeteilt auf seine Felder.
 *
 * Damit steht in jedem Feld **seine eigene** Zahl und nicht die des ganzen
 * Möbels: Ein Zug aus vier Einheiten zeigt viermal die Kisten einer Einheit,
 * und wer nachzählt, findet die Zahl aus der Auswertung wieder.
 *
 * Aufgeteilt wird nach dem, was jedes Feld tragen kann (`ifkoGewichte`) –
 * ein schmales Eckfeld bekommt weniger als ein volles. Trägt kein Feld etwas
 * Berechenbares, entscheidet die Breite; das ist der Fall, wenn die Zahl von
 * Hand am Möbel steht.
 *
 * **Gerundet wird auf die Summe hin.** Die einzelnen Zahlen sind Bruchteile –
 * ein 1,00-m-Feld trägt auf einer 400er Auflage 1⅔ Kisten, weil die dritte
 * über die Fuge ins nächste Feld reicht. Wer jede für sich rundete, käme auf
 * eine andere Summe als die Auswertung. Deshalb bekommt jedes Feld erst
 * seinen ganzen Teil, und die übrigen Kisten gehen an die Felder mit dem
 * größten Rest.
 */
export function kistenJeFeld(element: PlanElement): { seite: Seite; werte: number[] }[] {
  const gesamt = kistenzahl(element);
  const gewichte = ifkoGewichte(element);
  const flach = gewichte.flatMap((g) => g.werte);
  const summe = flach.reduce((s, w) => s + w, 0);

  // Ohne berechenbare Gewichte nach Breite verteilen – sonst bekäme das
  // erste Feld alles.
  const breiten = gewichte.flatMap((g) =>
    felderVon(element, g.seite).map((feld) => (feld.leer ? 0 : feld.breite)),
  );
  const breitensumme = breiten.reduce((s, b) => s + b, 0);
  const roh =
    summe > 0
      ? flach.map((w) => (w / summe) * gesamt)
      : breitensumme > 0
        ? breiten.map((b) => (b / breitensumme) * gesamt)
        : flach.map(() => 0);

  const verteilt = groessteReste(roh, Math.round(gesamt));
  let gelesen = 0;
  return gewichte.map((g) => {
    const werte = verteilt.slice(gelesen, gelesen + g.werte.length);
    gelesen += g.werte.length;
    return { seite: g.seite, werte };
  });
}

/**
 * Ganze Zahlen, die zusammen genau die Summe ergeben.
 *
 * Jedem seinen ganzen Teil, den Rest an die mit dem größten Bruchteil. So
 * verschwindet keine Kiste zwischen den Feldern und es taucht keine auf.
 */
function groessteReste(werte: number[], summe: number): number[] {
  const ganz = werte.map((w) => Math.floor(w));
  let fehlt = summe - ganz.reduce((s, g) => s + g, 0);
  const reihenfolge = werte
    .map((w, i) => ({ i, rest: w - Math.floor(w) }))
    .sort((a, b) => b.rest - a.rest);
  for (const { i } of reihenfolge) {
    if (fehlt <= 0) break;
    ganz[i]++;
    fehlt--;
  }
  return ganz;
}

/**
 * Wie viele grüne Kisten auf dieser Strecke stehen.
 *
 * Die Zahl gilt für das **ganze** Möbel. Eine Gondel wird zweimal durchlaufen
 * – einmal je Seite –, also bekommt jede Seite die Hälfte.
 */
export function kistenAnteil(strecke: Streckenmeter): number {
  const el = strecke.element;
  const kisten = kistenzahl(el);
  if (!kisten) return 0;

  // Verteilt wird über die **Feldkette dieser Seite** und nicht über
  // `element.breite`. Die beiden sind nicht dasselbe: Die Breite eines Möbels
  // ist die **längere** seiner Seiten. Wer über sie verteilt, verliert an der
  // kürzeren Seite genau den Unterschied – bei 5,00 zu 4,00 m ein Fünftel
  // der Kisten, ohne dass irgendwo stünde, wo sie geblieben sind.
  const laenge = seitenbreite(felderVon(el, strecke.seite)) || el.breite;
  if (!(laenge > 0)) return 0;

  const seiten = el.beidseitig ? 2 : 1;
  const jeCm = kisten / seiten / laenge;
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
  const stumm = ohneAuslagenbegriff(strecke);

  // **Am Preisgestell gibt es keine Böden.** Die Vorgabe sind Kistenfacings,
  // und die gelten über die ganze Strecke. Liefe sie durch `feldauslagen`,
  // gewänne eine versehentlich eingetragene Bodenzahl über sie, und ein
  // Unterbau addierte ein Facing – zwei Regalbegriffe, die hier nichts
  // bedeuten.
  if (strecke.element.form === 'getraenkegestell') {
    const laenge = strecke.bis - strecke.von;
    if (vorgabe === undefined) return { tatsaechlich: 0, ohne: laenge, ohneMassstab: 0 };
    return { tatsaechlich: laenge * vorgabe, ohne: 0, ohneMassstab: 0 };
  }

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
