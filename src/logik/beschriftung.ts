/**
 * Wie groß Beschriftungen im Plan sind.
 *
 * Die Unterscheidung, um die es hier geht, ist die zwischen **Zeichnung** und
 * **Werkzeug**:
 *
 *  - Was zur Zeichnung gehört – ein Maß, der Name eines Raums, seine Fläche –
 *    hat eine feste Größe **im Plan**, so wie auf einem gedruckten Blatt. Zoomt
 *    man heraus, schrumpft es mit. Es kann den Plan dadurch nie zudecken; dafür
 *    wird es in der Übersicht über den ganzen Markt zu klein zum Lesen und
 *    blendet sich aus.
 *
 *  - Was Werkzeug ist – der Abstand, der beim Ziehen eingeblendet wird, die
 *    Kantenlänge an einem Anfasser – behält eine feste Größe **auf dem
 *    Bildschirm**. Man schaut in dem Moment genau darauf, und es verschwindet
 *    ohnehin wieder, sobald man loslässt.
 *
 * Vorher waren alle Beschriftungen bildschirmfest. Auf dem Schirm wuchs damit
 * zwar nichts, im Plan aber sehr wohl: Beim Herauszoomen von 13 auf 3,5 Prozent
 * wurde aus einer Raumbeschriftung von einem Meter Höhe eine von vier – sie
 * legte sich über den halben Markt.
 */

/** Höhe eines Maßtextes im Plan, in cm. */
export const SCHRIFT_MASS = 35;

/** Höhe einer Raum- oder Flächenbeschriftung im Plan, in cm. */
export const SCHRIFT_FLAECHE = 45;

/**
 * Ab wieviel Bildpunkten eine Beschriftung noch lesbar ist.
 *
 * Darunter wird sie nicht klein gezeichnet, sondern gar nicht: Ein Text von
 * vier Bildpunkten ist kein Text mehr, sondern ein grauer Fleck, und ein Plan
 * voller grauer Flecken ist unruhiger als einer ohne.
 */
const LESBAR_AB = 7;

/** Ist eine Beschriftung dieser Planhöhe bei diesem Zoom noch zu lesen? */
export function lesbar(planHoehe: number, zoom: number): boolean {
  return planHoehe * zoom >= LESBAR_AB;
}
