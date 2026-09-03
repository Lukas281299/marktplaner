import type { Grundform, PlanElement } from '../typen/modell';

/**
 * Was in einem Regalfeld steht.
 *
 * Auf einem Ladenbauplan trägt jedes Feld seine eigenen Angaben: wie viele
 * Böden es hat, ob Körbe darin sind, welche Höhe und Tiefe das Regal hat.
 * Man liest das Feld für Feld ab, so wie man später im Markt davorsteht.
 *
 * Die Aufteilung im Feld folgt dem, was auf den Plänen üblich ist:
 *
 *   ┌──────────────────┐
 *   │ 5+          H1800│   links oben: von Hand, erste Zeile die Bodenzahl
 *   │ 1K            T600│   rechts oben: gerechnet, Höhe und Tiefe
 *   │                  │
 *   └──────────────────┘
 *
 * Links steht, was man selbst hineinschreibt – bis zu drei Zeilen. Rechts
 * steht, was das Programm ohnehin weiß, und zwar kleiner: Wer die Höhe eines
 * Regals von Hand einträgt, tippt sie irgendwann falsch ab.
 */

/** Höchstens so viele Zeilen werden links gezeichnet. */
export const NOTIZ_ZEILEN = 3;

/**
 * Die Zeilen einer Notiz, aufgeräumt.
 *
 * Leere Zeilen fallen weg, nicht nur am Rand: Wer zwischen zwei Angaben eine
 * Leerzeile lässt, meint keinen Abstand, sondern hat sich vertippt – und im
 * Feld ist der Platz zu knapp, um ihn zu verschenken.
 */
export function notizZeilen(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean)
    .slice(0, NOTIZ_ZEILEN);
}

/** Die Bodentiefen, die es im wire-tech-System gibt, in cm. */
const WT_BOEDEN = [30, 40, 50, 60, 70, 80];

/**
 * Wie weit ein gemessenes Maß von einer Katalogtiefe abweichen darf, in cm.
 *
 * Zwei Zentimeter. Ein Regal, das im eingelesenen Plan 680 tief steht, ist ein
 * 600er Boden — 680 gibt es nicht zu kaufen. Was weiter danebenliegt, wird
 * unverändert angezeigt: Dann stimmt etwas anderes nicht, und das soll man
 * sehen statt es weggerundet zu bekommen.
 */
const TIEFEN_SPIEL = 2;

/**
 * Die Tiefe **einer Regalseite** in Millimetern.
 *
 * Die Tiefe am Element ist das Stellmaß mitsamt toter Zone, bei einer Gondel
 * für beide Seiten zusammen. Auf dem Plan steht aber die Bodentiefe, nach der
 * man bestellt: bei 2 × 600 + 70 tote Zone steht dort T600 und nicht T1270.
 *
 * Drei Wege dorthin, in dieser Reihenfolge:
 *
 *  1. Steht am Möbel eine **Grundbodentiefe**, gilt die. Beim Kühlmöbel ist
 *     das die einzig richtige Angabe — dort hat das Gehäuse mit dem Boden,
 *     auf dem die Ware steht, wenig zu tun.
 *  1a. Bei einem **gestuften** Möbel — den Obst- und Gemüsetischen — ist es
 *     die **unterste Auflage**. Nach ihr heißt das Möbel im Katalog: Ein
 *     Vitable T800 hat 800 unten und 600 und 400 darüber, ist aber 955 tief.
 *  2. Sonst Stellmaß minus tote Zone, bei der Gondel geteilt durch zwei.
 *  3. Beim Regalzug wird das Ergebnis auf die nächste **Katalogtiefe**
 *     gezogen, wenn es nah genug dran liegt. Ein Zug aus einem eingelesenen
 *     Plan misst schon mal 680 statt 670 — bestellt wird trotzdem ein 600er
 *     Boden, und genau das soll dastehen.
 */
/**
 * Möbel, die keine Böden haben – dort steht keine Bodentiefe.
 *
 * Die Kassenzeile ist ein Tisch mit einem Band darauf, die Packrutsche eine
 * schräge Fläche, das Füllstück ein Blech. Bei keinem davon gibt es eine
 * Auflage, deren Tiefe man bestellen könnte.
 */
const OHNE_BODEN = new Set<Grundform>([
  'kasse',
  'kasseSitz',
  'kasseDoppel',
  'kasseExpress',
  'packrutsche',
  'sbKasse',
  'ausgangsanlage',
]);

export function bodentiefeMm(
  element: Pick<PlanElement, 'tiefe' | 'beidseitig' | 'form' | 'grundboden' | 'stufen'>,
): number {
  if (element.grundboden && element.grundboden > 0) return Math.round(element.grundboden * 10);

  // Die unterste Auflage ist die tiefste – nach ihr heißt das Möbel.
  const tiefste = element.stufen?.length ? Math.max(...element.stufen) : 0;
  if (tiefste > 0) return Math.round(tiefste * 10);

  const TOTE_ZONE = 7;
  const jeSeite = Math.max(
    0,
    element.beidseitig ? (element.tiefe - TOTE_ZONE) / 2 : element.tiefe - TOTE_ZONE,
  );

  if (element.form === 'wt100' || element.form === 'wt100Rund' || element.form === 'wt100Eck') {
    const naechster = WT_BOEDEN.reduce((a, b) =>
      Math.abs(b - jeSeite) < Math.abs(a - jeSeite) ? b : a,
    );
    if (Math.abs(naechster - jeSeite) <= TIEFEN_SPIEL) return naechster * 10;
  }

  return Math.round(jeSeite * 10);
}

/**
 * Die zwei Zeilen, die rechts oben stehen: Höhe und Tiefe in Millimetern.
 *
 * Immer in Millimetern, unabhängig davon, ob die Anzeige sonst auf Meter
 * steht – so steht es auf jedem Ladenbauplan, und so wird auch bestellt.
 *
 * Fehlt die Höhe am Element, bleibt die Zeile weg. Eine Null wäre eine
 * Behauptung.
 */
export function masszeilen(
  element: Pick<
    PlanElement,
    'hoehe' | 'tiefe' | 'beidseitig' | 'form' | 'breite' | 'grundboden' | 'stufen'
  >,
): string[] {
  // Eine Palette hat keine Höhe, die jemanden interessiert – sie ist so hoch,
  // wie gestapelt wird. Was man von ihr wissen will, sind ihre beiden
  // Grundmaße: 1200 × 800 und man weiß, welche es ist. Für eine Aktionsfläche
  // gilt dasselbe: Sie ist eine Zone auf dem Boden und hat gar keine Höhe.
  if (element.form === 'palette' || element.form === 'aktionsflaeche') {
    const laenge = Math.round(Math.max(element.breite, element.tiefe) * 10);
    const breite = Math.round(Math.min(element.breite, element.tiefe) * 10);
    if (laenge <= 0 || breite <= 0) return [];
    return [`L ${laenge}`, `B ${breite}`];
  }

  const zeilen: string[] = [];
  if (element.hoehe && element.hoehe > 0) zeilen.push(`H ${Math.round(element.hoehe * 10)}`);
  // Ein Möbel ohne Böden hat keine Bodentiefe. Bisher stand an einer Kasse
  // „T 514" – ihre Tiefe von 584 mm minus die tote Zone eines Regals, die es
  // dort gar nicht gibt. Eine erfundene Zahl im Plan ist schlimmer als keine:
  // Sie wird abgeschrieben.
  if (!OHNE_BODEN.has(element.form)) {
    const tiefe = bodentiefeMm(element);
    if (tiefe > 0) zeilen.push(`T ${tiefe}`);
  }
  return zeilen;
}
