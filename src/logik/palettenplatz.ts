import type { Projekt } from '../typen/modell';

/**
 * Wie viele Paletten auf eine Aktionsfläche gehen.
 *
 * Eine Aktionsfläche ist eine Zone und kein Möbel – sie sagt bisher nur, wie
 * groß sie ist. Beim Planen ist aber die Frage: **Wie viele Paletten stelle
 * ich darauf?** Sechs Quadratmeter sind keine Antwort darauf; sechs ganze
 * oder zwölf halbe sind eine.
 *
 * Gerechnet wird, was **wirklich hinpasst**, nicht die Fläche geteilt durch
 * die Palettenfläche. Der Unterschied ist groß: Auf 3,00 × 1,00 m gehen zwei
 * Europaletten längs, nicht drei – und wer nach Fläche rechnet, bestellt eine
 * zu viel.
 *
 * Angenommen wird ein **achsparalleles Raster**, notfalls mit einem Schnitt:
 * ein Streifen quer, der Rest längs. So stellt man sie auch wirklich hin.
 *
 * **Die Zahl ist eher zu klein als zu groß.** Ineinandergedreht – im Windrad
 * – geht auf manche Fläche eine Palette mehr, und das rechnet hier niemand
 * aus. Der Fehler geht damit in die harmlose Richtung: Eine Palette, die man
 * noch unterbekommt, findet man vor Ort; eine zu viel bestellte steht im
 * Gang.
 *
 * Die Gasse davor zählt nicht mit – die steht im Plan als freie Fläche
 * daneben und nicht in dieser Zahl.
 */

/** Die drei Größen, in cm. Die CHEP ist so groß wie eine Europalette. */
export const PALETTENGROESSEN = [
  { kennung: 'ganz', name: 'CHEP / EPAL', lang: 120, kurz: 80 },
  { kennung: 'halb', name: 'Halbe', lang: 80, kurz: 60 },
  { kennung: 'viertel', name: 'Viertel', lang: 60, kurz: 40 },
] as const;

/** Ein reines Raster: so viele nebeneinander mal so viele hintereinander. */
function raster(breite: number, laenge: number, a: number, b: number): number {
  return Math.floor(breite / a) * Math.floor(laenge / b);
}

/**
 * Das Beste aus beiden Ausrichtungen – und aus einem Schnitt dazwischen.
 *
 * Der Schnitt ist der Fall, den man im Markt wirklich sieht: Vorn eine Reihe
 * quer, dahinter der Rest längs, weil es sonst nicht aufgeht.
 */
function bestesRaster(breite: number, laenge: number, lang: number, kurz: number): number {
  if (!(breite > 0) || !(laenge > 0)) return 0;

  let beste = Math.max(raster(breite, laenge, lang, kurz), raster(breite, laenge, kurz, lang));

  // Ein Schnitt quer zur Breite: links ein Block, rechts der Rest.
  for (const erste of [lang, kurz]) {
    for (let spalten = 1; spalten * erste <= breite; spalten++) {
      const genutzt = spalten * erste;
      const rest = breite - genutzt;
      const links = spalten * Math.floor(laenge / (erste === lang ? kurz : lang));
      const rechts = Math.max(raster(rest, laenge, lang, kurz), raster(rest, laenge, kurz, lang));
      beste = Math.max(beste, links + rechts);
    }
  }

  // Und derselbe Schnitt quer zur Länge.
  for (const erste of [lang, kurz]) {
    for (let reihen = 1; reihen * erste <= laenge; reihen++) {
      const rest = laenge - reihen * erste;
      const vorn = reihen * Math.floor(breite / (erste === lang ? kurz : lang));
      const hinten = Math.max(raster(breite, rest, lang, kurz), raster(breite, rest, kurz, lang));
      beste = Math.max(beste, vorn + hinten);
    }
  }

  return beste;
}

/** Wie viele Paletten jeder Größe auf eine Fläche gehen. */
export interface Palettenplaetze {
  ganz: number;
  halb: number;
  viertel: number;
}

/**
 * Die Palettenplätze einer rechteckigen Fläche, in cm gemessen.
 *
 * Jede Zahl steht für sich: „6 ganze **oder** 12 halbe", nicht
 * nebeneinander. Gemischt aufzubauen geht natürlich, aber dann rechnet man
 * es sich ohnehin selbst zusammen.
 */
export function palettenplaetze(breite: number, laenge: number): Palettenplaetze {
  return {
    ganz: bestesRaster(breite, laenge, 120, 80),
    halb: bestesRaster(breite, laenge, 80, 60),
    viertel: bestesRaster(breite, laenge, 60, 40),
  };
}

/**
 * Die Aktionsflächen des ganzen Marktes.
 *
 * **Zwei Zahlen, weil zwei Fragen gestellt werden.**
 *
 *  - Die **Umrechnung** teilt die Quadratmeter durch die Palettenfläche. Sie
 *    beantwortet „wie viele Aktionsplätze hat dieser Markt" und ist die
 *    Zahl, mit der man über einen Markt spricht.
 *  - Die **Packung** rechnet Fläche für Fläche aus, was wirklich hinpasst.
 *    Sie ist kleiner, sobald ein Zuschnitt nicht aufgeht – und sie ist die
 *    Zahl, nach der man bestellt.
 *
 * Beide stehen nebeneinander, weil die Lücke dazwischen selbst eine Aussage
 * ist: Sie sagt, wie viel Fläche der Zuschnitt verschenkt.
 *
 * Ausgewählt wird über die **Form** und nicht über die Kategorie: Nur
 * `aktionsflaeche` sind die Zonen, während in derselben Kategorie auch
 * Paletten, Drehständer und Displays stehen – Möbel, die *auf* der Fläche
 * stehen und sie nicht ausmachen.
 */
export interface Aktionsflaechen {
  anzahl: number;
  /** Quadratmeter. */
  qm: number;
  umrechnung: Palettenplaetze;
  packung: Palettenplaetze;
}

export function aktionsflaechen(projekt: Projekt): Aktionsflaechen {
  const sichtbar = new Set(
    (projekt.ebenen ?? []).filter((e) => e.sichtbar !== false).map((e) => e.id),
  );

  let anzahl = 0;
  let qcm = 0;
  const packung: Palettenplaetze = { ganz: 0, halb: 0, viertel: 0 };

  for (const el of projekt.elemente ?? []) {
    if (el.form !== 'aktionsflaeche') continue;
    if (el.ebeneId && !sichtbar.has(el.ebeneId)) continue;
    anzahl++;
    qcm += el.breite * el.tiefe;
    const p = palettenplaetze(el.breite, el.tiefe);
    packung.ganz += p.ganz;
    packung.halb += p.halb;
    packung.viertel += p.viertel;
  }

  const qm = qcm / 10000;
  const teile = (g: (typeof PALETTENGROESSEN)[number]) =>
    Math.floor(qcm / (g.lang * g.kurz));

  return {
    anzahl,
    qm: Math.round(qm * 10) / 10,
    umrechnung: {
      ganz: teile(PALETTENGROESSEN[0]),
      halb: teile(PALETTENGROESSEN[1]),
      viertel: teile(PALETTENGROESSEN[2]),
    },
    packung,
  };
}
