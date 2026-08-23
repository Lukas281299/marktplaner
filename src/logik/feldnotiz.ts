import type { PlanElement } from '../typen/modell';

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

/**
 * Die Tiefe **einer Regalseite** in Millimetern.
 *
 * Die Tiefe am Element ist das Stellmaß mitsamt toter Zone, bei einer Gondel
 * für beide Seiten zusammen. Auf dem Plan steht aber die Bodentiefe, nach der
 * man bestellt: bei 2 × 600 + 70 tote Zone steht dort T600 und nicht T1270.
 */
export function bodentiefeMm(element: Pick<PlanElement, 'tiefe' | 'beidseitig'>): number {
  const TOTE_ZONE = 7;
  const jeSeite = element.beidseitig
    ? (element.tiefe - TOTE_ZONE) / 2
    : element.tiefe - TOTE_ZONE;
  return Math.round(Math.max(0, jeSeite) * 10);
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
  element: Pick<PlanElement, 'hoehe' | 'tiefe' | 'beidseitig'>,
): string[] {
  const zeilen: string[] = [];
  if (element.hoehe && element.hoehe > 0) zeilen.push(`H ${Math.round(element.hoehe * 10)}`);
  const tiefe = bodentiefeMm(element);
  if (tiefe > 0) zeilen.push(`T ${tiefe}`);
  return zeilen;
}
