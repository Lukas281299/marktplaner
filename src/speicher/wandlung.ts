import { neueId } from '../logik/id';
import { imUhrzeigersinn, rechteck } from '../logik/polygon';
import { SCHEMA_VERSION, type PlanElement, type Projekt, type Raum } from '../typen/modell';

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
    elemente: (projekt?.elemente ?? []).map(wandleElement),
  };
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
