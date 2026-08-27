import { rahmen } from './polygon';
import { buehneSteuerung } from './buehne';
import { usePlanStore } from '../zustand/planStore';
import type { Projekt } from '../typen/modell';

/**
 * Eine Aufnahme des Plans in wählbarer Auflösung.
 *
 * Der Kern für alles, was den Plan aus dem Programm heraustragen soll – PDF,
 * Bild, Web-Export. Alle drei zeichnen dieselbe Bühne, nur verschieden groß.
 *
 * Zwei Dinge macht diese Datei anders als ein schlichtes `toCanvas`:
 *
 * **Sie stellt den Zoom auf 1.** Der Plan zeichnet Beschriftungen nur, wenn
 * sie auf dem Bildschirm lesbar wären (`lesbar()` in `beschriftung.ts`). Wer
 * herausgezoomt exportiert, bekäme sonst einen Plan ohne Warengruppen – und
 * merkte es erst auf dem ausgedruckten Blatt.
 *
 * **Sie räumt vorher auf.** Auswahlrahmen, Anfasser und Hilfslinien gehören
 * ins Arbeiten, nicht in den Ausdruck.
 */

/** Rand um den Grundriss, in Zentimetern. */
const RAND = 60;

/**
 * Größte Aufnahme, die erzeugt wird – rund 40 Megapixel.
 *
 * Darüber wird es nicht schöner, sondern nur langsam: Browser geben bei sehr
 * großen Zeichenflächen ohne Vorwarnung ein leeres Bild zurück, und ein
 * leeres PDF ist schlimmer als ein etwas gröberes.
 */
const MAX_PIXEL = 40_000_000;

/** Keine Kante über dieser Grenze – auch das ein Browserlimit. */
const MAX_KANTE = 16_000;

export interface Aufnahme {
  bild: HTMLCanvasElement;
  /** Der abgebildete Ausschnitt in Plankoordinaten (Zentimeter). */
  ausschnitt: { x: number; y: number; breite: number; hoehe: number };
  /** Wie viele Bildpunkte ein Zentimeter des Plans belegt. */
  punkteJeCm: number;
}

/** Der Ausschnitt, der exportiert wird: der Grundriss plus etwas Luft. */
export function ausschnittVon(projekt: Projekt): {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
} {
  const r = rahmen(projekt.grundflaeche.umriss);
  return {
    x: r.links - RAND,
    y: r.oben - RAND,
    breite: r.rechts - r.links + RAND * 2,
    hoehe: r.unten - r.oben + RAND * 2,
  };
}

/**
 * Wartet, bis React die geänderte Ansicht auch gezeichnet hat.
 *
 * Ein einzelnes `requestAnimationFrame` reicht nicht: Der Store meldet die
 * Änderung, React rendert im nächsten Durchlauf, und Konva zeichnet erst
 * danach. Zwei Durchläufe plus ein Atemzug sind das, was zuverlässig trägt.
 *
 * **Mit einer Reißleine daneben.** Ein Fenster im Hintergrund bekommt vom
 * Browser keine Bilddurchläufe mehr – wer den Export anstößt und dann in ein
 * anderes Fenster wechselt, wartete sonst ewig, und der Plan bliebe auf dem
 * Zoom stehen, den der Export gesetzt hat. Nach einer halben Sekunde geht es
 * deshalb auch ohne weiter; gezeichnet wird beim Aufnehmen ohnehin neu.
 */
function warteAufsZeichnen(): Promise<void> {
  return new Promise((fertig) => {
    let erledigt = false;
    const einmal = () => {
      if (erledigt) return;
      erledigt = true;
      fertig();
    };
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.setTimeout(einmal, 30)),
    );
    window.setTimeout(einmal, 500);
  });
}

/**
 * Nimmt den Plan auf.
 *
 * `zielKante` ist die gewünschte Länge der längeren Bildkante in Punkten.
 * Was daraus wird, steht in `punkteJeCm` – bei sehr großen Märkten deckeln
 * die Grenzen oben den Wunsch.
 */
export async function nimmPlanAuf(zielKante = 4000): Promise<Aufnahme | null> {
  const buehne = buehneSteuerung.buehne;
  if (!buehne) return null;

  const laden = usePlanStore.getState();
  const projekt = laden.projekt;
  const ausschnitt = ausschnittVon(projekt);
  if (ausschnitt.breite <= 0 || ausschnitt.hoehe <= 0) return null;

  // Merken, was der Nutzer eingestellt hatte – das kommt am Ende zurück.
  const alteAnsicht = { ...laden.ansicht };
  const alteAuswahl = [...laden.auswahl];
  const alteSonderauswahl = laden.sonderauswahl;

  laden.hebeAuswahlAuf();
  laden.setzeAnsicht({ zoom: 1, x: 0, y: 0 });
  await warteAufsZeichnen();

  // Die oberste Ebene trägt Anfasser und Hilfslinien.
  const ebenen = buehne.getLayers();
  const oberste = ebenen[ebenen.length - 1];
  const warSichtbar = oberste?.visible() ?? true;
  oberste?.visible(false);

  // Von Hand zeichnen lassen: Im Hintergrundfenster hat React die neue
  // Ansicht zwar gesetzt, aber die Bühne malt erst beim nächsten Bild – und
  // das kommt dort nicht.
  buehne.draw();

  try {
    const laengsteCm = Math.max(ausschnitt.breite, ausschnitt.hoehe);
    let punkteJeCm = Math.max(0.25, zielKante / laengsteCm);

    // Deckeln, bevor der Browser es tut – der täte es kommentarlos.
    const kante = punkteJeCm * laengsteCm;
    if (kante > MAX_KANTE) punkteJeCm = MAX_KANTE / laengsteCm;
    const pixel = punkteJeCm * ausschnitt.breite * punkteJeCm * ausschnitt.hoehe;
    if (pixel > MAX_PIXEL) {
      punkteJeCm *= Math.sqrt(MAX_PIXEL / pixel);
    }

    // Zoom 1 heißt: ein Zentimeter ist ein Punkt. Der Rest ist `pixelRatio`.
    const quelle = buehne.toCanvas({
      x: ausschnitt.x,
      y: ausschnitt.y,
      width: ausschnitt.breite,
      height: ausschnitt.hoehe,
      pixelRatio: punkteJeCm,
    });

    // Weiß dahinter: Ohne das ist der Rand durchsichtig, und im PDF wird
    // daraus je nach Betrachter Schwarz.
    const ziel = document.createElement('canvas');
    ziel.width = quelle.width;
    ziel.height = quelle.height;
    const ctx = ziel.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ziel.width, ziel.height);
    ctx.drawImage(quelle, 0, 0);

    return { bild: ziel, ausschnitt, punkteJeCm: ziel.width / ausschnitt.breite };
  } finally {
    // Auch wenn etwas schiefgeht: Der Nutzer soll seinen Bildausschnitt
    // wiederfinden und nicht bei Zoom 1 in der Ecke stehen.
    oberste?.visible(warSichtbar);
    usePlanStore.getState().setzeAnsicht(alteAnsicht);
    if (alteAuswahl.length > 0) usePlanStore.getState().waehleAus(alteAuswahl);
    if (alteSonderauswahl) usePlanStore.getState().waehleSonder(alteSonderauswahl);
  }
}
