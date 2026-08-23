import { AKTION_TEXT, SAISON_TEXT, WT_GRAU, WT_GRAU_ALT } from '../daten/bibliothek';
import { mitAusgerichtetenKoepfen } from '../logik/kopfgondel';
import { grundfelder } from '../logik/regalseiten';
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
  if (version >= SCHEMA_VERSION) return projekt as Projekt;

  return {
    ...(projekt as Projekt),
    version: SCHEMA_VERSION,
    grundflaeche: wandleGrundflaeche(projekt?.grundflaeche),
    raeume: (projekt?.raeume ?? []).map(wandleRaum),
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
    elemente: mitAusgerichtetenKoepfen(
      (projekt?.elemente ?? [])
        .map(wandleElement)
        .map(vereinheitlicheRegalfarbe)
        .map(teileSeitenAuf)
        .map(beschrifteAktionsflaeche),
    ),
  };
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
  const wireTech = element?.form === 'wt100' || element?.form === 'wt100Rund' || element?.form === 'wt100Eck';
  if (!wireTech || !WT_GRAU_ALT.includes(element.farbe)) return element;
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
