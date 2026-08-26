import { laeuftRueckwaerts } from './beschriftung';
import { felderVon, seitenbreite, type Seite } from './regalseiten';
import type { Feldbezug, PlanElement, Regalfeld } from '../typen/modell';

/**
 * Warengruppen den Metern zuordnen – durch Anklicken und Enter.
 *
 * Geschrieben wird in **dieselben Felder**, die man in der Gondelübersicht
 * von Hand füllt. Das ist der ganze Trick: Es gibt nur eine Beschriftung und
 * nicht zwei Sorten davon. Wer sie nachbessern will, findet sie dort, wo sie
 * immer stand; wer sie loswerden will, drückt Strg+Z oder Entf.
 *
 * Markiert wird auf **Meter** und nicht auf Möbel: Eine Gondel ist ein
 * einziges Element mit sechs Feldern, und die tragen verschiedene
 * Warengruppen.
 */

/** Wie die Namen in einem Feld verbunden werden. */
const TRENNER = ', ';

/** Ein Feld eindeutig benennen – für Vergleiche und Mengen. */
export function feldSchluessel(bezug: Feldbezug): string {
  return `${bezug.element}|${bezug.seite}|${bezug.feld}`;
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

/** Die Namen, die in einem Feld stehen. */
export function namenIm(text: string | undefined): string[] {
  return (text ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * Schreibt einen Namen in die markierten Meter.
 *
 * Zusammenhängende Meter einer Seite werden zu **einer** Strecke: Vier Meter
 * Eier tragen einen Namen mit einer Klammer darüber und nicht viermal
 * denselben. Liegen Lücken dazwischen, entstehen mehrere Strecken – dort
 * gehört ja auch etwas anderes hin.
 *
 * Steht auf einer Strecke schon ein Name, kommt der neue mit Komma dazu:
 * „Eier, Butter". Zweimal derselbe kommt nicht dazu.
 *
 * Der Text hängt am **ersten Meter der Strecke im Bild** – bei einem Zug an
 * der unteren Wand ist das der mit der höchsten Nummer. Dieselbe Regel wie
 * beim Tippen von Hand, siehe `logik/warengruppe.ts`.
 */
export function mitZugeordnetenFeldern(
  elemente: PlanElement[],
  markierung: Feldbezug[],
  name: string,
): PlanElement[] {
  const text = name.trim();
  if (!text || markierung.length === 0) return elemente;

  return wandleMarkierte(elemente, markierung, (felder, von, bis, rueckwaerts) => {
    const anker = rueckwaerts ? bis : von;
    const neu = [...felder];

    // Was in der Strecke sonst noch steht, weicht dem einen Text: Zwei
    // Beschriftungen auf derselben Strecke kann der Plan nicht zeigen.
    for (let i = von; i <= bis; i++) {
      if (i !== anker) neu[i] = { ...neu[i], warengruppe: undefined };
    }

    const alt = neu[anker].warengruppe;
    const schon = namenIm(alt?.text);
    const klein = text.toLocaleLowerCase('de-DE');
    const zusammen = schon.some((n) => n.toLocaleLowerCase('de-DE') === klein)
      ? alt!.text
      : [...schon, text].join(TRENNER);

    neu[anker] = {
      ...neu[anker],
      warengruppe: { ...alt, text: zusammen, felder: bis - von + 1 },
    };
    return neu;
  });
}

/** Nimmt die Beschriftung von den markierten Metern wieder weg. */
export function ohneZugeordneteFelder(
  elemente: PlanElement[],
  markierung: Feldbezug[],
): PlanElement[] {
  if (markierung.length === 0) return elemente;

  return wandleMarkierte(elemente, markierung, (felder, von, bis) => {
    const neu = [...felder];
    for (let i = von; i <= bis; i++) neu[i] = { ...neu[i], warengruppe: undefined };
    return neu;
  });
}

/**
 * Der gemeinsame Weg: markierte Meter je Seite zu Strecken bündeln.
 *
 * Beide Schritte oben tun dasselbe – sie suchen die zusammenhängenden Stücke
 * einer Seite und ändern deren Felder. Nur was sie damit tun, ist verschieden.
 */
function wandleMarkierte(
  elemente: PlanElement[],
  markierung: Feldbezug[],
  wandeln: (felder: Regalfeld[], von: number, bis: number, rueckwaerts: boolean) => Regalfeld[],
): PlanElement[] {
  // Nach Möbel und Seite bündeln – eine Strecke läuft nie über beides hinweg.
  const gruppen = new Map<string, { element: string; seite: Seite; felder: number[] }>();
  for (const bezug of markierung) {
    const schluessel = `${bezug.element}|${bezug.seite}`;
    const vorhanden = gruppen.get(schluessel);
    if (vorhanden) vorhanden.felder.push(bezug.feld);
    else gruppen.set(schluessel, { element: bezug.element, seite: bezug.seite, felder: [bezug.feld] });
  }

  return elemente.map((element) => {
    let geaendert = element;

    for (const gruppe of gruppen.values()) {
      if (gruppe.element !== element.id) continue;

      const rueckwaerts = laeuftRueckwaerts(element.drehung);
      let felder = felderVon(geaendert, gruppe.seite);

      for (const [von, bis] of stuecke(gruppe.felder, felder.length)) {
        felder = wandeln(felder, von, bis, rueckwaerts);
      }

      geaendert = mitSeite(geaendert, gruppe.seite, felder);
    }
    return geaendert;
  });
}

/** Zusammenhängende Stücke einer Nummernliste, als [von, bis]. */
function stuecke(nummern: number[], anzahl: number): [number, number][] {
  const sortiert = [...new Set(nummern)].filter((n) => n >= 0 && n < anzahl).sort((a, b) => a - b);
  const ergebnis: [number, number][] = [];

  for (const nummer of sortiert) {
    const letztes = ergebnis[ergebnis.length - 1];
    if (letztes && nummer === letztes[1] + 1) letztes[1] = nummer;
    else ergebnis.push([nummer, nummer]);
  }
  return ergebnis;
}

/**
 * Schreibt eine Feldliste an ihre Seite zurück.
 *
 * Die alte Liste `felder` bleibt als Spiegel der Vorderseite stehen – wie im
 * Speicher auch, damit nichts stehenbleibt, was noch nach ihr greift.
 */
function mitSeite(element: PlanElement, seite: Seite, felder: Regalfeld[]): PlanElement {
  const andere = seite === 'oben' ? 'unten' : 'oben';
  const gegen = felderVon(element, andere);
  const oben = seite === 'oben' ? felder : gegen;
  const unten = seite === 'unten' ? felder : gegen;

  return {
    ...element,
    felderUnten: unten,
    felderOben: element.beidseitig ? oben : undefined,
    felder: unten.map((f) => f.breite),
  };
}

// ----------------------------------------------------- Lage für die Marke

/** Wo ein Meter im Plan liegt – seine Vorderkante, in Weltkoordinaten. */
export interface Feldlage {
  x: number;
  y: number;
  /** Länge des Meters längs des Möbels. */
  breite: number;
  drehung: number;
  /** Welche Seite des Möbels – daran hängt, wohin „vorn" zeigt. */
  seite: Seite;
}

/**
 * Die Vorderkante eines Meters in Weltkoordinaten.
 *
 * Gebraucht, um die Markierung zu zeichnen: Sie liegt dort, wo gleich die
 * Schrift steht. „Vorn" ist beim Regal die Seite, an der die Ware steht – bei
 * der Vorderseite die untere Kante, bei der Rückseite einer Gondel die obere.
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

  return {
    x: element.x + mx * cos - my * sin,
    y: element.y + mx * sin + my * cos,
    breite: weite,
    drehung: element.drehung,
    seite,
  };
}
