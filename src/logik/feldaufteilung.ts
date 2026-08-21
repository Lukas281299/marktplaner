/**
 * Die Feldaufteilung eines Regalzugs.
 *
 * Ein Zug ist kein Balken, den man auf jedes Maß ziehen kann. Er besteht aus
 * Feldern, und jedes Feld hat eines von vier Achsmaßen — andere Breiten gibt
 * es im System nicht. Ein 6,25-m-Zug ist deshalb nicht „6,25 m Regal",
 * sondern fünf Felder A1000 und eines A1250.
 *
 * Genau das rechnet dieses Modul: Aus einer gewünschten Gesamtlänge wird eine
 * Aufteilung, die es wirklich gibt — und zwar mit **so wenig Änderung wie
 * möglich** an dem, was schon dasteht. Wer einen 6-m-Zug auf 6,25 m zieht,
 * will fünf unveränderte Felder und ein breiteres, nicht sechs neu gewürfelte.
 */

/**
 * Die Achsmaße, aus denen ein Zug bestehen darf, in cm.
 *
 * Aus dem Workbook wire tech 100, Seite 24. A800 fehlt bewusst: Es gibt das
 * Maß, aber nur für Wandregale in 400er und 500er Tiefe, und in einem
 * gemischten Zug kommt es nicht vor.
 */
export const MODULE = [62.5, 100, 125, 133.3] as const;

/**
 * Wie genau eine Summe stimmen muss, in cm.
 *
 * A1333 ist in Wahrheit 1333⅓ mm. Drei solche Felder ergeben 399,9 cm und
 * meinen 400. Ohne Toleranz fiele jede Aufteilung mit diesem Maß durch.
 */
const TOLERANZ = 0.6;

/** Summe einer Feldliste, auf Zehntelmillimeter gerundet. */
export function summe(felder: number[]): number {
  return Math.round(felder.reduce((s, f) => s + f, 0) * 100) / 100;
}

/** Ist das ein zulässiges Achsmaß? */
export function istModul(breite: number): boolean {
  return MODULE.some((m) => Math.abs(m - breite) < 0.05);
}

/** Das nächstgelegene zulässige Achsmaß. */
export function naechstesModul(breite: number): number {
  return MODULE.reduce((a, b) => (Math.abs(b - breite) < Math.abs(a - breite) ? b : a));
}

/**
 * Die Feldliste eines Elements, notfalls aus Breite und Achsmaß erschlossen.
 *
 * Ältere Planungen haben nur ein Achsmaß und eine Gesamtbreite. Daraus eine
 * gleichmäßige Liste zu bilden ist die einzige ehrliche Deutung: Genau so
 * wurde der Zug bis dahin auch gezeichnet.
 */
export function feldliste(breite: number, achsmass: number | undefined): number[] {
  if (!achsmass || achsmass <= 0) return [breite];
  const anzahl = Math.max(1, Math.round(breite / achsmass));
  return Array.from({ length: anzahl }, () => achsmass);
}

/** Wie viele Felder je Achsmaß – für die Anzeige „4 × A1000, 2 × A1250". */
export function zaehleModule(felder: number[]): { modul: number; anzahl: number }[] {
  return MODULE.map((modul) => ({
    modul,
    anzahl: felder.filter((f) => Math.abs(f - modul) < 0.05).length,
  })).filter((e) => e.anzahl > 0);
}

/**
 * Sucht die Feldzahlen, die zusammen die Ziellänge ergeben.
 *
 * Durchgezählt wird über die Anzahl der ersten drei Maße; das vierte ergibt
 * sich aus der Feldzahl. Das ist stumpf, aber bei höchstens ein paar Dutzend
 * Feldern in Sekundenbruchteilen erledigt – und im Gegensatz zu einem
 * geschickteren Verfahren nachweislich vollständig.
 */
function verteilungenFuer(anzahl: number, ziel: number): number[][] {
  const treffer: number[][] = [];
  for (let a = 0; a <= anzahl; a++) {
    for (let b = 0; a + b <= anzahl; b++) {
      for (let c = 0; a + b + c <= anzahl; c++) {
        const d = anzahl - a - b - c;
        const laenge = a * MODULE[0] + b * MODULE[1] + c * MODULE[2] + d * MODULE[3];
        if (Math.abs(laenge - ziel) <= TOLERANZ) treffer.push([a, b, c, d]);
      }
    }
  }
  return treffer;
}

/** Wie viele Felder müssten sich ändern, um von `ist` auf `soll` zu kommen? */
function aenderungen(ist: number[], soll: number[]): number {
  let gleich = 0;
  for (let i = 0; i < MODULE.length; i++) gleich += Math.min(ist[i], soll[i]);
  const gesamt = soll.reduce((s, n) => s + n, 0);
  return gesamt - gleich;
}

/**
 * Baut aus einer Verteilung die Feldliste – und lässt dabei stehen, was
 * stehen bleiben kann.
 *
 * Die alte Reihenfolge wird von links nach rechts durchgegangen. Jedes Feld,
 * dessen Maß in der neuen Verteilung noch frei ist, bleibt genau dort, wo es
 * war. Erst was übrig bleibt, wird ersetzt – von links nach rechts mit den
 * noch offenen Maßen aufgefüllt.
 *
 * Dadurch wandert die Änderung ans Ende des Zuges. Das ist die Stelle, an der
 * man sie erwartet, wenn man den Zug am rechten Griff länger gezogen hat.
 */
function baueListe(alt: number[], verteilung: number[]): number[] {
  const offen = [...verteilung];
  const neu: (number | null)[] = [];

  for (const feld of alt) {
    const i = MODULE.findIndex((m) => Math.abs(m - feld) < 0.05);
    if (i >= 0 && offen[i] > 0) {
      offen[i] -= 1;
      neu.push(MODULE[i]);
    } else {
      neu.push(null);
    }
  }

  // Was in der neuen Verteilung noch aussteht, der Reihe nach.
  const rest: number[] = [];
  for (let i = 0; i < MODULE.length; i++) {
    for (let n = 0; n < offen[i]; n++) rest.push(MODULE[i]);
  }

  const ergebnis = neu.map((f) => (f === null ? rest.shift() ?? null : f)).filter(
    (f): f is number => f !== null,
  );
  // Mehr Felder als vorher: der Überhang kommt hinten dran.
  return [...ergebnis, ...rest];
}

export interface Anpassung {
  felder: number[];
  /** Die tatsächlich erreichte Länge – kann um Millimeter vom Wunsch abweichen. */
  breite: number;
  /** Wie viele Felder ein anderes Maß bekommen haben. */
  geaendert: number;
}

/**
 * Passt eine Feldliste an eine gewünschte Gesamtlänge an.
 *
 * Bevorzugt wird die **gleiche Feldzahl**: Ein Zug, den man um 25 cm länger
 * zieht, soll dieselben Felder behalten und eines davon breiter machen. Erst
 * wenn das mit keiner Kombination aufgeht, kommen Felder dazu oder fallen
 * weg – und auch dann in der kleinsten Stufe, die trägt.
 *
 * Gibt `null` zurück, wenn die Ziellänge mit diesen Maßen gar nicht zu bauen
 * ist. Das ist kein Fehler, sondern eine Aussage: 30 cm Zug gibt es nicht.
 */
export function passeAn(alt: number[], ziel: number): Anpassung | null {
  if (ziel < MODULE[0] - TOLERANZ) return null;
  const jetzt = alt.length > 0 ? alt.length : 1;
  // Ober- und Untergrenze der Feldzahl, die überhaupt in Frage kommt.
  const hoechstens = Math.ceil(ziel / MODULE[0]) + 1;
  const mindestens = Math.max(1, Math.floor(ziel / MODULE[MODULE.length - 1]) - 1);

  // Von der bisherigen Feldzahl aus nach außen suchen: erst gleich viele,
  // dann eines mehr oder weniger, und so weiter.
  const reihenfolge: number[] = [];
  for (let abstand = 0; abstand <= hoechstens; abstand++) {
    for (const n of abstand === 0 ? [jetzt] : [jetzt - abstand, jetzt + abstand]) {
      if (n >= mindestens && n <= hoechstens && !reihenfolge.includes(n)) reihenfolge.push(n);
    }
  }

  for (const anzahl of reihenfolge) {
    const treffer = verteilungenFuer(anzahl, ziel);
    if (treffer.length === 0) continue;
    const istVerteilung = MODULE.map(
      (m) => alt.filter((f) => Math.abs(f - m) < 0.05).length,
    );
    // Unter den passenden Verteilungen die, die am wenigsten umbaut.
    const beste = treffer.reduce((a, b) =>
      aenderungen(istVerteilung, b) < aenderungen(istVerteilung, a) ? b : a,
    );
    const felder = baueListe(alt, beste);
    return {
      felder,
      breite: summe(felder),
      geaendert: aenderungen(istVerteilung, beste),
    };
  }
  return null;
}

/**
 * Die Achsmaße in Dritteln eines Millimeters.
 *
 * Der einzige Weg, ohne Toleranz zu rechnen. A1333 ist 1333⅓ mm – in
 * Millimetern eine krumme Zahl, in Dritteln davon glatte 4000. Drei Felder
 * ergeben damit exakt 12 000 Drittel, also genau 4,00 m, und nicht 3,999 m
 * wie bei jeder Rechnung in Millimetern.
 *
 * 1 cm sind 30 Drittelmillimeter.
 */
const DRITTEL = [1875, 3000, 3750, 4000];
const JE_CM = 30;

/**
 * Die größte Länge, die sich aus Achsmaßen bauen lässt und den Wunsch nicht
 * überschreitet.
 *
 * **Abgerundet, nicht gerundet.** Beim Ziehen am Griff entstehen beliebige
 * Zwischenmaße, und ein Regal, das dabei länger würde als die Stelle, an der
 * man losgelassen hat, wäre im Markt eines zu viel. Lieber ein Feld kürzer
 * als eines, das nicht hineinpasst.
 *
 * Gerechnet wird mit dem klassischen Münzproblem: Erreichbar ist eine Länge,
 * wenn sie sich um genau ein Achsmaß von einer erreichbaren unterscheidet.
 * Das findet jede Kombination, auch gemischte – 1,875 m etwa als 62,5 + 125
 * oder als drei mal 62,5.
 */
export function groesstBaubareLaenge(wunsch: number): number | null {
  const ziel = Math.floor(wunsch * JE_CM + 1e-6);
  if (ziel < DRITTEL[0]) return null;

  const erreichbar = new Uint8Array(ziel + 1);
  erreichbar[0] = 1;
  for (let wert = DRITTEL[0]; wert <= ziel; wert++) {
    for (const modul of DRITTEL) {
      if (wert >= modul && erreichbar[wert - modul]) {
        erreichbar[wert] = 1;
        break;
      }
    }
  }

  for (let wert = ziel; wert >= DRITTEL[0]; wert--) {
    if (erreichbar[wert]) return wert / JE_CM;
  }
  return null;
}

/**
 * Die nächstgelegene baubare Länge zu einem Wunschmaß.
 *
 * Für das Ziehen am Griff: Dort entstehen beliebige Zwischenwerte, und
 * gebraucht wird das nächste Maß, das es wirklich gibt.
 */
export function naechsteBaubareLaenge(alt: number[], wunsch: number): Anpassung | null {
  const genau = passeAn(alt, wunsch);
  if (genau) return genau;
  // In immer größeren Schritten um den Wunsch herum suchen. Feiner als ein
  // halber Zentimeter lohnt nicht – kleiner ist kein Unterschied, den ein
  // Regal kennt.
  for (let abstand = 0.5; abstand <= MODULE[MODULE.length - 1]; abstand += 0.5) {
    for (const ziel of [wunsch - abstand, wunsch + abstand]) {
      const versuch = passeAn(alt, ziel);
      if (versuch) return versuch;
    }
  }
  return null;
}
