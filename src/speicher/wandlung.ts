import { AKTION_TEXT, SAISON_TEXT, WT_GRAU, WT_GRAU_ALT } from '../daten/bibliothek';
import { mitAusgerichtetenKoepfen } from '../logik/kopfgondel';
import { mitZugeordnetenFeldern } from '../logik/warengruppenzuordnung';
import { laeuftRueckwaerts } from '../logik/beschriftung';
import { geordnet } from '../logik/warengruppe';
import { grundfelder } from '../logik/regalseiten';
import { nachgezogeneBezeichnung } from '../logik/regalbezeichnung';
import { STANDARD_EBENEN } from '../daten/standardProjekt';
import { neueId } from '../logik/id';
import { imUhrzeigersinn, rechteck } from '../logik/polygon';
import {
  SCHEMA_VERSION,
  type Ebene,
  type PlanElement,
  type Projekt,
  type Raum,
  type Regalfeld,
  type Unterbauplatz,
  type Warengruppenabschnitt,
} from '../typen/modell';

/**
 * Bringt ältere Planungen auf den aktuellen Stand des Datenmodells.
 *
 * Jede Planung, die von irgendwoher hereinkommt – aus der Datenbank, aus einer
 * JSON-Datei, vom Abgleich – läuft hier durch. Das ist bewusst die einzige
 * Stelle: Sobald es zwei gäbe, würde eine davon vergessen, sobald das Modell
 * sich das nächste Mal ändert.
 *
 * Grundregel: **nie etwas wegwerfen.** Was nicht sicher umgewandelt werden
 * kann, bekommt einen vernünftigen Ersatzwert. Eine Planung, an der jemand
 * einen Nachmittag gesessen hat, darf an einer Schemaänderung nicht zerbrechen.
 */

/** So sah die Grundfläche in Fassung 1 aus. */
interface AlteGrundflaeche {
  breite?: number;
  laenge?: number;
  wandstaerke?: number;
}

/** So sah ein Raum in Fassung 1 aus. */
interface AlterRaum {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  breite?: number;
  laenge?: number;
  wandstaerke?: number;
  farbe?: string;
  beschriftungSichtbar?: boolean;
}

/** Standardmaße, falls in einer alten Datei gar nichts Brauchbares steht. */
const ERSATZ_BREITE = 4000;
const ERSATZ_LAENGE = 2500;

export function wandleProjekt(roh: unknown): Projekt {
  const projekt = roh as Projekt & { grundflaeche?: AlteGrundflaeche; raeume?: unknown[] };
  const version = typeof projekt?.version === 'number' ? projekt.version : 1;
  if (version >= SCHEMA_VERSION) {
    // Auch eine aktuelle Datei kann Ebenen mitbringen, die es nicht gibt –
    // etwa aus einem Werkzeug, das sie selbst erfunden hat. Was auf einer
    // unbekannten Ebene liegt, wird nirgends gezeichnet: Wände, Räume und
    // Regale verschwinden, und niemand sieht, woran es liegt. Deshalb wird
    // der Satz Ebenen **immer** vervollständigt, nicht nur beim Umwandeln.
    return { ...(projekt as Projekt), ebenen: ergaenzeEbenen(projekt?.ebenen) };
  }

  return {
    ...(projekt as Projekt),
    version: SCHEMA_VERSION,
    grundflaeche: wandleGrundflaeche(projekt?.grundflaeche),
    raeume: (projekt?.raeume ?? []).map(wandleRaum).map(ohneRaumwand),
    // Fassung 3: Beides gab es vorher nicht, es kann also nur leer sein.
    // Trotzdem über `??`, damit ein späterer Schritt hier nichts überschreibt.
    waende: projekt?.waende ?? [],
    oeffnungen: projekt?.oeffnungen ?? [],
    // Fassung 4
    gruppen: projekt?.gruppen ?? [],
    masslinien: projekt?.masslinien ?? [],
    // Fassung 6: nichts eingezeichnet heißt „weiter rechnen wie bisher".
    verkaufsflaechen: projekt?.verkaufsflaechen ?? [],
    // Fassung 7
    ebenen: ergaenzeEbenen(projekt?.ebenen),
    // Fassung 11: Die Köpfe stellen sich neu an ihre Züge. Sie werden sonst
    // erst nachgerichtet, wenn jemand den Zug bewegt — ein Plan, der nur
    // geöffnet wird, behielte seine verdrehten Köpfe für immer.
    // Fassung 14 führte die Warengruppen kurz als eigenes Band. Sie gehören
    // in die Felder – dort werden sie auch von Hand geschrieben.
    elemente: loeseBaenderAuf(
      (projekt as { warengruppenbaender?: AltesBand[] }).warengruppenbaender,
      mitAusgerichtetenKoepfen(
      (projekt?.elemente ?? [])
        .map(wandleElement)
        .map(vereinheitlicheRegalfarbe)
        .map(teileSeitenAuf)
        .map(beschrifteAktionsflaeche)
        .map(machZurFlaeche),
      ),
    // Fassung 15: Die Warengruppen messen jetzt in Zentimetern. Zuletzt,
    // damit die Bänder aus Fassung 14 vorher wieder in den Feldern liegen –
    // sonst gingen genau die verloren, die den Umweg mitgemacht haben.
    )
      .map(aufsMeterband)
      // Fassung 18: aus der Palette wird der Unterbau.
      .map(ausPaletteWirdUnterbau)
      // Fassung 17: ganz zuletzt, wenn Felder, Maße und Seiten stehen.
      .map(ziehBezeichnungNach),
  };
}

/**
 * Fassung 18: Aus der Palette unter den Böden wird der Unterbau.
 *
 * Unter einem Regalfeld steht nicht nur eine Palette: Genauso oft ein
 * Stapel Getränkekisten oder ein Kühlmöbel, das in die Zeile eingebaut
 * ist. Das Feld trägt deshalb `unterbau` statt `palette`; die Art heißt
 * weiter `euro`, `halb` und so fort, es sind nur ein paar dazugekommen.
 *
 * Umgeschrieben wird nur der Name des Feldes – die Palette bleibt, was
 * sie war, und steht nach dem Öffnen an derselben Stelle.
 */
function ausPaletteWirdUnterbau(element: PlanElement): PlanElement {
  const alt = element as PlanElement & {
    felderUnten?: (Regalfeld & { palette?: Unterbauplatz })[];
    felderOben?: (Regalfeld & { palette?: Unterbauplatz })[];
  };
  const wandle = (felder?: (Regalfeld & { palette?: Unterbauplatz })[]) => {
    if (!felder || !felder.some((f) => f?.palette)) return felder;
    return felder.map((f) => {
      if (!f?.palette) return f;
      const { palette, ...rest } = f;
      return { ...rest, unterbau: f.unterbau ?? palette };
    });
  };
  const unten = wandle(alt.felderUnten);
  const oben = wandle(alt.felderOben);
  if (unten === alt.felderUnten && oben === alt.felderOben) return element;
  return { ...element, felderUnten: unten, felderOben: oben };
}

/**
 * Fassung 17: Die Bezeichnung nennt wieder, was wirklich im Möbel steht.
 *
 * Seit Fassung 16 folgt die Bezeichnung den Feldern – aber nur bei Möbeln,
 * die seitdem angefasst wurden. Ein Regalzug, der vor einem halben Jahr
 * auf 1,25 m umgebaut wurde, hieß im Plan weiter A1000. Beim Öffnen wird
 * das jetzt einmal für jede Planung nachgeholt, in allen Abteilungen:
 * Trockensortiment, Kühlung, Tiefkühlung, Getränke, Obst & Gemüse,
 * Bedienung, Backwaren.
 *
 * `nachgezogeneBezeichnung` ist dabei absichtlich vorsichtig: Sie fasst nur
 * an, was schon eine Maßangabe trägt. In alten Planungen gab es das
 * Kennzeichen für eigene Texte noch nicht, und ein Regal, das jemand
 * „Kaffee“ genannt hat, darf davon nichts merken.
 */
function ziehBezeichnungNach(element: PlanElement): PlanElement {
  const neu = nachgezogeneBezeichnung(element);
  return neu ? { ...element, beschriftung: neu } : element;
}

/**
 * Fassung 16: Abgetrennte Räume zeichnen keine Wand mehr.
 *
 * Sie brachten eine eigene Wandstärke mit und zeichneten damit eine zweite
 * Wand neben die, die der Planer selbst gezogen hat – im Plan nicht zu
 * unterscheiden und in der Flächenrechnung doppelt. Ein Raum markiert jetzt
 * nur noch die Fläche und benennt sie.
 *
 * Wer sie zurückwill, stellt sie am Raum wieder ein; die Möglichkeit bleibt.
 */
function ohneRaumwand(raum: Raum): Raum {
  return { ...raum, wandstaerke: 0 };
}

/** So sah eine Warengruppen-Beschriftung in Fassung 14 aus. */
interface AltesBand {
  felder?: { element: string; seite: 'oben' | 'unten'; feld: number }[];
  text?: string;
}

/**
 * Fassung 14 war ein Umweg: Die Warengruppen-Beschriftung lag kurz als
 * eigenes „Band" neben den Möbeln statt in ihren Feldern.
 *
 * Das war eine Sorte Beschriftung zu viel – von Hand geschrieben stand sie
 * schon immer im Feld, und wer sie ändern wollte, fand zwei Stellen dafür.
 * Hier wandern die Bänder zurück in die Felder; danach gibt es wieder eine.
 */
function loeseBaenderAuf(baender: AltesBand[] | undefined, elemente: PlanElement[]): PlanElement[] {
  if (!Array.isArray(baender) || baender.length === 0) return elemente;

  let ergebnis = elemente;
  for (const band of baender) {
    const felder = (band?.felder ?? []).filter((f) => f && typeof f.element === 'string');
    const text = (band?.text ?? '').trim();
    if (felder.length === 0 || !text) continue;
    ergebnis = mitZugeordnetenFeldern(ergebnis, felder, text);
  }
  return ergebnis;
}

/** So sah eine Warengruppe am Feld bis Fassung 14 aus. */
interface AlteFeldgruppe {
  text?: string;
  felder?: number;
  schrift?: number;
}

/**
 * Fassung 15: Die Warengruppen messen in Zentimetern statt in Feldern.
 *
 * Vorher hing eine Beschriftung am ersten Feld ihrer Strecke und zählte, über
 * wie viele Felder sie reicht. Das ging so lange gut, wie sich jedes
 * Sortiment an die Feldgrenzen hielt – zwei Sortimente auf drei Metern tun
 * das nicht.
 *
 * Zwei Feinheiten, ohne die die Umwandlung Beschriftungen verschieben würde:
 *
 * **Gezählt wurde in Leserichtung.** „Ketchup über drei Felder" hieß: dieses
 * und die zwei rechts daneben **im Bild**. An einem rückwärts laufenden Möbel
 * sind das in der gespeicherten Achse die zwei davor.
 *
 * **Eine Strecke endete an der nächsten Beschriftung.** Eine Angabe von fünf
 * Feldern an einem Zug mit dreien war kein Fehler, sondern ein hinterher
 * gekürzter Zug.
 */
function aufsMeterband(element: PlanElement): PlanElement {
  const alt = element as PlanElement & {
    felderUnten?: (Regalfeld & { warengruppe?: AlteFeldgruppe })[];
    felderOben?: (Regalfeld & { warengruppe?: AlteFeldgruppe })[];
  };
  const hatAlte =
    [...(alt.felderUnten ?? []), ...(alt.felderOben ?? [])].some((f) => f?.warengruppe?.text);
  // Schon umgestellt oder nie beschriftet: nichts zu tun.
  if (!hatAlte && !element.warengruppenUnten && !element.warengruppenOben) return element;

  const rueckwaerts = laeuftRueckwaerts(element.drehung ?? 0);
  const ergebnis: PlanElement = {
    ...element,
    felderUnten: alt.felderUnten?.map(ohneAlteGruppe),
    felderOben: alt.felderOben?.map(ohneAlteGruppe),
  };
  if (alt.felderUnten && !element.warengruppenUnten) {
    ergebnis.warengruppenUnten = bandAus(alt.felderUnten, rueckwaerts);
  }
  if (alt.felderOben && !element.warengruppenOben) {
    ergebnis.warengruppenOben = bandAus(alt.felderOben, rueckwaerts);
  }
  return ergebnis;
}

function ohneAlteGruppe(feld: Regalfeld & { warengruppe?: AlteFeldgruppe }): Regalfeld {
  const { warengruppe: _weg, ...rest } = feld;
  return rest;
}

/** Rechnet die Feldbeschriftungen einer Seite in Zentimeterstrecken um. */
function bandAus(
  felder: (Regalfeld & { warengruppe?: AlteFeldgruppe })[],
  rueckwaerts: boolean,
): Warengruppenabschnitt[] {
  // Die Kante links von jedem Feld, in der gespeicherten Achse.
  const kanten: number[] = [0];
  for (const feld of felder) kanten.push(kanten[kanten.length - 1] + (feld.breite || 0));
  const gesamt = kanten[kanten.length - 1];

  // In Leserichtung durchgehen – so war die Feldzahl gemeint.
  const reihe = rueckwaerts ? [...felder].reverse() : felder;
  const zurueck = (i: number) => (rueckwaerts ? felder.length - 1 - i : i);

  const naechste = (ab: number) => {
    for (let i = ab; i < reihe.length; i++) {
      if (reihe[i]?.warengruppe?.text?.trim()) return i;
    }
    return reihe.length;
  };

  const abschnitte: Warengruppenabschnitt[] = [];
  for (let i = 0; i < reihe.length; i++) {
    const gruppe = reihe[i]?.warengruppe;
    const text = gruppe?.text?.trim();
    if (!text) continue;

    const gewuenscht = i + Math.max(1, Math.round(gruppe?.felder ?? 1)) - 1;
    const bis = Math.min(gewuenscht, reihe.length - 1, naechste(i + 1) - 1);

    // Zurück in die gespeicherte Achse: Dort ist der Anfang der Strecke die
    // kleinere der beiden Feldnummern.
    const a = zurueck(i);
    const b = zurueck(bis);
    const erstes = Math.min(a, b);
    const letztes = Math.max(a, b);
    abschnitte.push({
      von: kanten[erstes],
      bis: kanten[letztes + 1] ?? gesamt,
      text,
      ...(gruppe?.schrift ? { schrift: gruppe.schrift } : {}),
    });
  }
  return geordnet(abschnitte, gesamt);
}

/**
 * Fassung 12: Aktionsflächen bekommen ihre eigene Grundform.
 *
 * Vorher waren sie Rechtecke wie jedes andere Möbel. Damit trugen sie weder
 * ihre Quadratmeter noch ihre Maße, und ihr Name wurde abgeschnitten statt
 * sich der Größe anzupassen.
 */
function machZurFlaeche(element: PlanElement): PlanElement {
  const vorlage = element.vorlageId ?? '';
  const gemeint = vorlage === 'saisonflaeche' || vorlage.startsWith('aktionsflaeche');
  if (!gemeint || element.form !== 'rechteck') return element;
  return { ...element, form: 'aktionsflaeche' };
}

/**
 * Fassung 10: „Aktionsfläche" steht in der Fläche.
 *
 * Bis dahin bekam jedes Element den Namen seiner Vorlage als Beschriftung –
 * bei einer Aktionsfläche also „Aktionsfläche 2 x 2 m". In zwei Metern Breite
 * bleibt davon auf dem Bildschirm „Aktionsfl…" übrig, und die Maße stehen
 * ohnehin am Element.
 *
 * Angefasst wird nur, was noch den Vorlagennamen trägt. Wer seine Fläche
 * „Ostern" genannt hat, behält das: Eine Beschriftung, die jemand selbst
 * geschrieben hat, gehört ihm.
 */
function beschrifteAktionsflaeche(element: PlanElement): PlanElement {
  const vorlage = element.vorlageId ?? '';
  const saison = vorlage === 'saisonflaeche';
  if (!saison && !vorlage.startsWith('aktionsflaeche')) return element;

  const text = saison ? SAISON_TEXT : AKTION_TEXT;
  const alt = (element.beschriftung ?? '').trim();
  if (alt !== '' && !alt.startsWith(text)) return element;
  if (alt === text) return element;

  return {
    ...element,
    beschriftung: text,
    // War gar nichts zu sehen, wird es jetzt sichtbar. Eine ausgeblendete
    // Beschriftung mit Text hat jemand ausgeblendet – das bleibt so.
    beschriftungSichtbar: alt === '' ? true : element.beschriftungSichtbar,
  };
}

/**
 * Fassung 9: jede Gondelseite bekommt ihre eigene Feldliste.
 *
 * Bis dahin teilten sich beide Seiten eine Liste von Feldbreiten, und die
 * Notizen lagen daneben in einer zweiten Liste mit `oben` und `unten`. Beides
 * wandert jetzt zusammen ans Feld.
 *
 * Übernommen wird die vorhandene Einteilung unverändert auf beide Seiten –
 * am Bild ändert sich dadurch nichts. Erst wer danach eine Seite umbaut,
 * bekommt zwei verschiedene.
 */
function teileSeitenAuf(element: PlanElement): PlanElement {
  if (element.felderUnten) return element;

  const breiten = grundfelder(element);
  if (breiten.length === 0) return element;

  const seite = (welche: 'oben' | 'unten'): Regalfeld[] =>
    breiten.map((breite, i) => {
      const notiz = element.feldnotizen?.[i]?.[welche];
      return notiz ? { breite, notiz } : { breite };
    });

  return {
    ...element,
    felderUnten: seite('unten'),
    felderOben: element.beidseitig ? seite('oben') : undefined,
  };
}

/**
 * Fassung 8: ein Grauton für das ganze Trockensortiment.
 *
 * Wandregal, Gondel und Kopfgondel hatten drei Abstufungen. Der Plan sah
 * dadurch nach drei verschiedenen Möbeln aus, wo dasselbe Regal steht.
 *
 * Umgefärbt wird nur, was einen der drei alten Töne trägt **und** eine
 * wire-tech-Form hat. Wer ein Regal von Hand eingefärbt hat – etwa um eine
 * Warengruppe hervorzuheben –, behält seine Farbe: Eine stille Änderung
 * daran wäre schlimmer als drei Grautöne.
 */
function vereinheitlicheRegalfarbe(element: PlanElement): PlanElement {
  // Auch das freie Regal und die freie Gondel: Sie tragen dieselbe Ware und
  // sollen im Plan nicht anders aussehen als der Systemzug daneben.
  const regal =
    element?.form === 'wt100' ||
    element?.form === 'wt100Rund' ||
    element?.form === 'wt100Eck' ||
    element?.form === 'regal';
  if (!regal || !WT_GRAU_ALT.includes(element.farbe)) return element;
  return { ...element, farbe: WT_GRAU };
}

/**
 * Trägt fehlende Standardebenen nach, an ihrer angestammten Stelle.
 *
 * Eine Ebene, die es im Programm gibt, aber nicht in der geöffneten Planung,
 * ist die schlimmste Sorte Fehler: Was auf ihr liegt, wird unsichtbar, und es
 * gibt keinen Schalter, mit dem man es zurückholt. Genau das wäre mit der
 * Ebene „Verkaufsfläche" passiert.
 *
 * Vorhandene Ebenen behalten ihre Einstellungen – wer „Räume" ausgeblendet
 * hatte, bekommt sie nicht durchs Öffnen wieder eingeblendet. Eigene Ebenen,
 * die es im Programm nicht gibt, bleiben am Ende stehen statt wegzufallen.
 */
function ergaenzeEbenen(vorhanden: Ebene[] | undefined): Ebene[] {
  const alte = new Map((vorhanden ?? []).map((e) => [e.id, e]));
  const standard = STANDARD_EBENEN.map((e) => alte.get(e.id) ?? { ...e });
  const bekannt = new Set(STANDARD_EBENEN.map((e) => e.id));
  const eigene = (vorhanden ?? []).filter((e) => !bekannt.has(e.id));
  return [...standard, ...eigene];
}

/**
 * Bis Fassung 3 wurde am Namen der Vorlage erkannt, ob ein Regal von beiden
 * Seiten bestückt wird – die Regalmeter zählten doppelt, wenn „gondel" darin
 * vorkam. Jetzt steht das als eigene Eigenschaft am Element.
 *
 * Die alte Erkennung wird hier einmalig nachgezogen, damit die Regalmeter
 * einer bestehenden Planung nach dem Öffnen nicht plötzlich kleiner sind.
 */
function wandleElement(roh: unknown): PlanElement {
  const alt = roh as PlanElement;
  if (typeof alt?.beidseitig === 'boolean') return alt;
  return { ...alt, beidseitig: (alt?.vorlageId ?? '').includes('gondel') };
}

/** Aus Breite × Länge wird ein Rechteck an der linken oberen Ecke. */
function wandleGrundflaeche(alt: AlteGrundflaeche | undefined) {
  if (alt && Array.isArray((alt as { umriss?: unknown }).umriss)) {
    return alt as unknown as Projekt['grundflaeche'];
  }
  const breite = zahl(alt?.breite, ERSATZ_BREITE);
  const laenge = zahl(alt?.laenge, ERSATZ_LAENGE);
  return {
    umriss: rechteck(0, 0, breite, laenge),
    wandstaerke: zahl(alt?.wandstaerke, 30),
  };
}

/**
 * Räume aus Fassung 1 waren Rechtecke ohne Art.
 *
 * Als Art wird „sonstige" gesetzt und nicht geraten: In der Auswertung würde
 * ein falsch einsortierter Raum die Verkaufsfläche verfälschen, und eine Zahl,
 * die plausibel aussieht und falsch ist, richtet mehr Schaden an als eine
 * offensichtlich unbestimmte.
 */
function wandleRaum(roh: unknown): Raum {
  const alt = roh as AlterRaum & { umriss?: unknown; art?: Raum['art']; gesperrt?: boolean };
  const umriss = Array.isArray(alt?.umriss)
    ? (alt.umriss as Raum['umriss'])
    : rechteck(
        zahl(alt?.x, 0),
        zahl(alt?.y, 0),
        zahl(alt?.breite, 500),
        zahl(alt?.laenge, 500),
      );

  return {
    id: typeof alt?.id === 'string' ? alt.id : neueId('raum'),
    name: typeof alt?.name === 'string' ? alt.name : 'Raum',
    umriss: imUhrzeigersinn(umriss),
    art: alt?.art ?? 'sonstige',
    wandstaerke: zahl(alt?.wandstaerke, 15),
    farbe: typeof alt?.farbe === 'string' ? alt.farbe : '#eef0f3',
    beschriftungSichtbar: alt?.beschriftungSichtbar ?? true,
    gesperrt: alt?.gesperrt ?? false,
  };
}

/** Nimmt die Zahl, wenn es eine brauchbare ist – sonst den Ersatzwert. */
function zahl(wert: unknown, ersatz: number): number {
  return typeof wert === 'number' && isFinite(wert) && wert > 0 ? wert : ersatz;
}
