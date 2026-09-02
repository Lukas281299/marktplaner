import { modulsatzFuer, zerlegeInModule } from '../daten/module';
import type { PlanElement, Regalfeld } from '../typen/modell';
import { feldliste } from './feldaufteilung';

/**
 * Die zwei Seiten eines Regals.
 *
 * Eine Gondel ist **ein** Möbel mit zwei Seiten, und die werden getrennt
 * bestückt. Bis Fassung 8 teilten sie sich eine Liste von Feldbreiten – das
 * trifft den Normalfall, aber nicht die Wirklichkeit: Man lässt ein Feld frei,
 * weil dort eine Palette steht, oder baut die Rückseite ganz anders auf.
 *
 * Deshalb trägt jede Seite ihre eigene Liste. Zwei Regeln halten das
 * zusammen:
 *
 *  - **Die Breite des Möbels ist die längere Seite.** Die kürzere endet
 *    früher, und man sieht die Stufe im Plan. Alles andere wäre gelogen: Der
 *    Platz, den das Möbel am Boden braucht, richtet sich nach dem, was am
 *    weitesten reicht.
 *  - **Ein leeres Feld belegt trotzdem Platz.** Die Säule steht ja. Es wird
 *    nur nicht gefüllt gezeichnet, damit man sieht, dass dort nichts hängt.
 *
 * Getrennte Seiten gibt es nur beim Regalzug. Eine Truhe hat zwei Seiten,
 * aber keine Felder, die man einzeln herausnehmen könnte – dort bleibt es
 * bei der einen Liste, und `felderVon` gibt für beide Seiten dieselbe zurück.
 */

/** Welche Seite eines Möbels gemeint ist – im ungedrehten Zustand. */
export type Seite = 'oben' | 'unten';

/**
 * Die Einteilung eines Möbels ohne eigene Seitenlisten.
 *
 * Genau die Deutung, nach der bis Fassung 8 gezeichnet wurde: beim Regalzug
 * gleichmäßig nach Achsmaß, sonst in die Einheiten der Abteilung. Eine ältere
 * Planung sieht dadurch unverändert aus.
 */
export function grundfelder(element: PlanElement): number[] {
  if (element.felder && element.felder.length > 0) return element.felder;
  if (element.achsmass) return feldliste(element.breite, element.achsmass);
  const satz = modulsatzFuer(element.form);
  return satz ? zerlegeInModule(element.breite, satz) : [element.breite];
}

/**
 * Die Felder einer Seite – notfalls aus der Grundeinteilung erschlossen.
 *
 * Eine Planung ohne Seitenlisten wird nicht angefasst: Ihre Felder ergeben
 * sich wie eh und je, und genau so wurde sie bis dahin auch gezeichnet.
 */
export function felderVon(element: PlanElement, seite: Seite): Regalfeld[] {
  const eigene = seite === 'oben' ? element.felderOben : element.felderUnten;
  if (eigene) return eigene;
  return grundfelder(element).map((breite) => ({ breite }));
}

/** Die Seiten, die dieses Möbel überhaupt hat. */
export function seitenVon(element: PlanElement): Seite[] {
  return element.beidseitig ? ['oben', 'unten'] : ['unten'];
}

/**
 * Hat dieses Möbel zwei Seiten, die man einzeln bestückt?
 *
 * Nur der Regalzug. Bei einer Truhe oder einem Obsttisch sind die beiden
 * Seiten ein Körper – dort ein Feld herauszunehmen hieße, ein Loch in die
 * Wanne zu schneiden.
 */
export function seitenEinzeln(element: PlanElement): boolean {
  return element.form === 'wt100' && Boolean(element.beidseitig);
}

/**
 * Dürfen die beiden Seiten **verschieden eingeteilt** sein?
 *
 * Normalerweise nicht. Wer einen Zug um ein Feld verlängert, verlängert das
 * Möbel – nicht eine Seite davon. Beide Seiten laufen deshalb im Gleichschritt,
 * bis jemand das ausdrücklich löst.
 *
 * Ohne ausdrückliche Angabe entscheidet der Zustand: Ein Zug, dessen Seiten
 * schon verschieden sind, behält seine Freiheit. Sonst würde die erste
 * Änderung an einer von Hand gebauten Gondel sie wieder gleichmachen.
 */
export function seitenTrennbar(element: PlanElement): boolean {
  if (!seitenEinzeln(element)) return false;
  if (typeof element.seitenGetrennt === 'boolean') return element.seitenGetrennt;
  return !gleicheEinteilung(felderVon(element, 'oben'), felderVon(element, 'unten'));
}

/** Summe der Feldbreiten einer Seite, auf Hundertstel gerundet. */
export function seitenbreite(felder: Regalfeld[] | undefined): number {
  if (!felder || felder.length === 0) return 0;
  return Math.round(felder.reduce((summe, f) => summe + f.breite, 0) * 100) / 100;
}

/**
 * Die Breite, die das Möbel mit diesen Seiten haben muss.
 *
 * Die längere von beiden – siehe oben. Kommt null heraus, bleibt die bisherige
 * Breite stehen: Ein Möbel ohne Ausdehnung wäre auf dem Plan nicht zu treffen.
 */
export function breiteAusSeiten(
  element: PlanElement,
  oben?: Regalfeld[],
  unten?: Regalfeld[],
): number {
  const laenge = Math.max(seitenbreite(oben), seitenbreite(unten));
  return laenge > 0 ? laenge : element.breite;
}

/**
 * Sind beide Seiten gleich eingeteilt und ohne Lücke?
 *
 * Dann zeichnet das Möbel wie bisher: Trennlinien und Achsmaß-Zeichen laufen
 * über die ganze Tiefe. Erst wenn die Seiten sich unterscheiden, zerfällt die
 * Zeichnung in zwei Bänder – sonst hätte sich das Bild jeder bestehenden
 * Planung geändert, ohne dass jemand etwas umgebaut hätte.
 */
export function gleicheEinteilung(a: Regalfeld[], b: Regalfeld[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((feld, i) => Math.abs(feld.breite - b[i].breite) < 0.01 && !feld.leer && !b[i].leer);
}

/** Steht in jedem Feld dieser Seite ein Regal? */
export function ohneLuecke(felder: Regalfeld[]): boolean {
  return felder.every((feld) => !feld.leer);
}

/**
 * Zusammenhängende Stücke einer Seite – leere Felder trennen sie.
 *
 * Gebraucht beim Zeichnen: Ein leeres Feld soll als Lücke erscheinen, und
 * dafür muss der Körper in Abschnitte zerfallen. Aus `[voll, leer, voll]`
 * werden zwei Stücke mit der Lücke dazwischen.
 *
 * Die Werte sind Abstände vom linken Rand, in derselben Einheit wie die
 * Feldbreiten.
 */
export function vollStuecke(felder: Regalfeld[]): { von: number; bis: number }[] {
  const stuecke: { von: number; bis: number }[] = [];
  let x = 0;
  let start: number | null = null;

  for (const feld of felder) {
    if (feld.leer) {
      if (start !== null) stuecke.push({ von: start, bis: x });
      start = null;
    } else if (start === null) {
      start = x;
    }
    x += feld.breite;
  }
  if (start !== null) stuecke.push({ von: start, bis: x });
  return stuecke;
}

/**
 * Bringt eine Seitenliste auf eine neue Feldeinteilung.
 *
 * Notizen und Lücken bleiben dabei an ihrem Platz: Was im dritten Feld stand,
 * steht hinterher wieder im dritten. Kommen Felder dazu, sind sie leer im
 * Sinne von „ohne Notiz" – nicht im Sinne von „ohne Regal".
 */
export function uebernehmeBreiten(alt: Regalfeld[], breiten: number[]): Regalfeld[] {
  return breiten.map((breite, i) => ({ ...alt[i], breite }));
}
