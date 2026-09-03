import { felderVon, seitenbreite, type Seite } from './regalseiten';
import { mitAbschnitt, ohneStrecke } from './warengruppe';
import type {
  Feldbezug,
  PlanElement,
  Regalfeld,
  Warengruppenabschnitt,
} from '../typen/modell';

/**
 * Warengruppen den Metern zuordnen – durch Anklicken und Enter.
 *
 * Geschrieben wird in **dieselben Abschnitte**, die man in der Gondelübersicht
 * von Hand füllt. Das ist der ganze Trick: Es gibt nur eine Beschriftung und
 * nicht zwei Sorten davon. Wer sie nachbessern will, findet sie dort, wo sie
 * immer stand; wer sie loswerden will, drückt Strg+Z oder Entf.
 *
 * Markiert wird auf **Meter** und nicht auf Möbel: Eine Gondel ist ein
 * einziges Element mit sechs Feldern, und die tragen verschiedene
 * Warengruppen.
 *
 * Die Felder sind dabei nur der bequeme Weg zur Strecke – gespeichert wird
 * sie in Zentimetern (siehe `logik/warengruppe.ts`). Wer danach die Grenze
 * zwischen zwei Sortimenten mitten in ein Feld ziehen will, kann das; die
 * Zuordnung per Klick trifft nur die üblichen Fälle auf Anhieb.

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
 * Steht auf **genau derselben** Strecke schon ein Name, kommt der neue mit
 * Komma dazu: „Eier, Butter". Zweimal derselbe kommt nicht dazu. Auf einer
 * anderen Strecke ersetzt er, was dort stand – wer etwas Neues hinschreibt,
 * meint, dass es dort jetzt gilt.
 */
export function mitZugeordnetenFeldern(
  elemente: PlanElement[],
  markierung: Feldbezug[],
  name: string,
  pfad?: string,
): PlanElement[] {
  const text = name.trim();
  if (!text || markierung.length === 0) return elemente;

  return wandleMarkierte(elemente, markierung, (abschnitte, gesamt, von, bis) => {
    // Liegt dort schon genau diese Strecke, wächst ihr Text – sonst weicht sie.
    const gleiche = abschnitte.find((a) => nah(a.von, von) && nah(a.bis, bis));
    const schon = namenIm(gleiche?.text);
    const klein = text.toLocaleLowerCase('de-DE');
    const schonDrin = schon.some((n) => n.toLocaleLowerCase('de-DE') === klein);
    const zusammen = schonDrin ? gleiche!.text : [...schon, text].join(TRENNER);

    // Der Pfad macht den Namen eindeutig – „Kuchen" steht in der Liste
    // mehrfach. Er kommt mit, solange auf der Strecke **ein** Name steht.
    //
    // Kommt ein zweiter dazu („Eier, Butter"), fällt er weg: Zwei Sortimente
    // auf einer Strecke haben keinen gemeinsamen Platz in der Liste, und
    // einen davon zu behalten hieße raten. Die Strecke steht dann in der
    // Auswertung unter ihrem Text – sichtbar, aber nicht eingeordnet.
    const eigener = schon.length === 0 || (schonDrin && schon.length === 1);

    return mitAbschnitt(abschnitte, gesamt, {
      ...(gleiche ?? {}),
      von,
      bis,
      text: zusammen,
      pfad: eigener ? (pfad ?? gleiche?.pfad) : undefined,
    });
  });
}

/** Nimmt die Beschriftung von den markierten Metern wieder weg. */
export function ohneZugeordneteFelder(
  elemente: PlanElement[],
  markierung: Feldbezug[],
): PlanElement[] {
  if (markierung.length === 0) return elemente;
  return wandleMarkierte(elemente, markierung, (abschnitte, gesamt, von, bis) =>
    ohneStrecke(abschnitte, gesamt, von, bis),
  );
}

/** Zwei Zentimeterwerte, die dasselbe meinen. */
function nah(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.5;
}

/**
 * Der gemeinsame Weg: markierte Meter je Seite zu Strecken bündeln.
 *
 * Beide Schritte oben tun dasselbe – sie suchen die zusammenhängenden Stücke
 * einer Seite und rechnen sie in Zentimeter um. Nur was sie damit tun, ist
 * verschieden.
 *
 * Gerechnet wird in der **gespeicherten** Achse des Möbels. Die Leserichtung
 * spielt hier keine Rolle mehr: Ein zusammenhängendes Stück Felder ist auch
 * rückwärts dasselbe Stück, und gedreht wird erst beim Zeichnen.
 */
function wandleMarkierte(
  elemente: PlanElement[],
  markierung: Feldbezug[],
  wandeln: (
    abschnitte: Warengruppenabschnitt[],
    gesamtbreite: number,
    von: number,
    bis: number,
  ) => Warengruppenabschnitt[],
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

      const felder = felderVon(geaendert, gruppe.seite);
      const kanten = feldkanten(felder);
      const gesamt = kanten[kanten.length - 1];
      let abschnitte = warengruppenVon(geaendert, gruppe.seite);

      for (const [von, bis] of stuecke(gruppe.felder, felder.length)) {
        abschnitte = wandeln(abschnitte, gesamt, kanten[von], kanten[bis + 1]);
      }

      geaendert = mitWarengruppen(geaendert, gruppe.seite, abschnitte);
    }
    return geaendert;
  });
}

/** Die Kanten der Felder, in Zentimetern ab dem Anfang des Möbels. */
export function feldkanten(felder: Regalfeld[]): number[] {
  const kanten = [0];
  for (const feld of felder) kanten.push(kanten[kanten.length - 1] + (feld.breite || 0));
  return kanten;
}

/** Die Abschnitte einer Seite. */
export function warengruppenVon(
  element: PlanElement,
  seite: Seite,
): Warengruppenabschnitt[] {
  return (seite === 'oben' ? element.warengruppenOben : element.warengruppenUnten) ?? [];
}

/** Schreibt die Abschnitte einer Seite zurück. */
export function mitWarengruppen(
  element: PlanElement,
  seite: Seite,
  abschnitte: Warengruppenabschnitt[],
): PlanElement {
  const sauber = abschnitte.length > 0 ? abschnitte : undefined;
  if (seite === 'oben') {
    // Nur beidseitige Möbel haben eine Rückseite; sonst hinge die Liste dort
    // unsichtbar herum und käme zurück, sobald jemand das Möbel umstellt.
    return { ...element, warengruppenOben: element.beidseitig ? sauber : undefined };
  }
  return { ...element, warengruppenUnten: sauber };
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

/* ------------------------------------------------- Griffe an den Grenzen */

/** Ein Griff an der Kante eines Abschnitts, in Weltkoordinaten. */
export interface Grenzgriff {
  element: string;
  seite: Seite;
  /** Die Stelle des Abschnitts in der gespeicherten Liste. */
  index: number;
  kante: 'von' | 'bis';
  /** Wo er im Plan sitzt. */
  x: number;
  y: number;
  drehung: number;
  /** Der Zentimeterwert, an dem die Kante gerade steht. */
  wert: number;
}

/**
 * Die Griffe, mit denen sich die Grenzen eines Möbels ziehen lassen.
 *
 * Einer je Kante jedes Abschnitts. Grenzen zwei Abschnitte aneinander, fallen
 * ihre Griffe zusammen – gezeigt wird dann nur einer, und der zieht beide
 * Kanten gemeinsam (siehe `mitVerschobenerKante`).
 *
 * Die Rechnung steht hier und nicht in der Zeichenfläche, damit sie sich
 * prüfen lässt: Ein Griff, der zwei Zentimeter neben seiner Grenze sitzt,
 * fällt beim Ansehen nicht auf und beim Ziehen sofort.
 */
export function grenzgriffe(element: PlanElement): Grenzgriff[] {
  const griffe: Grenzgriff[] = [];

  for (const seite of element.beidseitig ? (['unten', 'oben'] as const) : (['unten'] as const)) {
    const felder = felderVon(element, seite);
    const gesamt = seitenbreite(felder);
    if (gesamt <= 0) continue;

    const abschnitte = warengruppenVon(element, seite);
    const gesehen = new Set<number>();

    abschnitte.forEach((abschnitt, index) => {
      for (const kante of ['von', 'bis'] as const) {
        const wert = abschnitt[kante];
        // Zwei Abschnitte, die aneinandergrenzen, teilen sich einen Griff.
        const schluessel = Math.round(wert * 2);
        if (gesehen.has(schluessel)) continue;
        gesehen.add(schluessel);

        const lage = punktAufSeite(element, seite, wert, gesamt);
        griffe.push({ element: element.id, seite, index, kante, wert, ...lage });
      }
    });
  }
  return griffe;
}

/**
 * Wo ein Zentimeterwert der Möbelachse im Plan liegt.
 *
 * Auf der Vorderkante der Seite, dort wo auch die Beschriftung anfängt – der
 * Griff soll auf der Grenze sitzen, die er verschiebt, und nicht daneben.
 */
export function punktAufSeite(
  element: PlanElement,
  seite: Seite,
  cm: number,
  gesamt = seitenbreite(felderVon(element, seite)),
): { x: number; y: number; drehung: number } {
  const faktor = gesamt > 0 ? element.breite / gesamt : 1;
  const mx = cm * faktor - element.breite / 2;
  const my = seite === 'oben' ? -element.tiefe / 2 : element.tiefe / 2;

  const bogen = (element.drehung * Math.PI) / 180;
  const cos = Math.cos(bogen);
  const sin = Math.sin(bogen);
  return {
    x: element.x + mx * cos - my * sin,
    y: element.y + mx * sin + my * cos,
    drehung: element.drehung,
  };
}

/**
 * Rechnet einen Punkt im Plan zurück auf die Achse eines Möbels.
 *
 * Das Gegenstück zu `punktAufSeite` – beim Ziehen kommt eine Mausposition
 * herein und muss zu einem Zentimeterwert werden.
 */
export function cmAufSeite(element: PlanElement, seite: Seite, punkt: { x: number; y: number }): number {
  const gesamt = seitenbreite(felderVon(element, seite));
  const faktor = gesamt > 0 ? element.breite / gesamt : 1;

  const bogen = (-element.drehung * Math.PI) / 180;
  const cos = Math.cos(bogen);
  const sin = Math.sin(bogen);
  const dx = punkt.x - element.x;
  const dy = punkt.y - element.y;
  // Zurückgedreht in die Achse des Möbels; die Tiefe spielt keine Rolle.
  const mx = dx * cos - dy * sin;
  return (mx + element.breite / 2) / (faktor || 1);
}
