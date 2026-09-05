import { strecken } from './warengruppenmeter';
import { pfadeDerStrecke } from './sortimentsbund';
import type { Sortimentsliste } from '../daten/warengruppen';
import type { Projekt } from '../typen/modell';

/**
 * Welche Einträge der Sortimentsliste im Plan stehen.
 *
 * **Der grüne Haken ist keine Meinung, sondern eine Tatsache über die
 * Planung.** Vorher wurde er beim Beschriften einmal gesetzt und blieb dann
 * stehen: Wer die Warengruppe wieder vom Möbel nahm, sah sie links weiterhin
 * als erledigt — und ging am Ende an einer Lücke vorbei, weil die Liste sagte,
 * dort stünde etwas.
 *
 * Deshalb wird er jetzt jedes Mal aus dem Plan gelesen. Was gezeichnet ist,
 * ist grün; was nicht mehr gezeichnet ist, ist es auch nicht mehr. Von Hand
 * bleibt nur, was der Plan **nicht** beantworten kann: „hier nicht
 * vorgesehen" und „steht im Markt, aber nicht gezeichnet".
 *
 * **Gezählt wird über den Pfad**, nicht über den Namen. Ein frei getippter
 * Name ohne Pfad zählt nur, wenn die Liste ihn eindeutig kennt — bei „Kuchen"
 * tut sie das nicht, und fünf Haken für einen Meter wären falsch.
 *
 * Stehen **zwei Sortimente gemeinsam** an einer Strecke — „Nüsse,
 * Trockenobst" —, werden beide abgehakt: Beide stehen im Markt, und die Liste
 * soll das sagen (siehe `logik/sortimentsbund.ts`).
 *
 * **Eine Sonderplatzierung hakt nichts ab.** Auf ihr liegt Werbeware und kein
 * reguläres Sortiment; sie ist Fläche der Warengruppe, aber kein Beleg dafür,
 * dass das Sortiment untergebracht wäre. Würde sie haken, ginge man am Ende
 * an einer Lücke vorbei — genau der Fehler, gegen den der grüne Haken
 * gedacht ist.
 */
export function pfadeImPlan(projekt: Projekt, liste: Sortimentsliste): Set<string> {
  const pfade = new Set<string>();
  for (const strecke of strecken(projekt)) {
    if (strecke.aktion) continue;
    for (const pfad of pfadeDerStrecke(liste, strecke)) pfade.add(pfad);
  }
  return pfade;
}
