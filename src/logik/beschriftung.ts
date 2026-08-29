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
 * drei Bildpunkten ist kein Text mehr, sondern ein grauer Fleck, und ein Plan
 * voller grauer Flecken ist unruhiger als einer ohne.
 *
 * Fünf und nicht sieben: Die Schrift bleibt, wie sie ist, aber sie soll auch
 * aus etwas mehr Abstand noch dastehen. Eine Feldnotiz von 22 cm erscheint
 * damit ab Zoom 23 % statt erst ab 32 % — das ist der Unterschied zwischen
 * „eine Abteilung im Blick" und „drei Regale im Blick".
 */
const LESBAR_AB = 5;

/**
 * Läuft dieses Möbel im Plan **von rechts nach links**?
 *
 * Ein Regal hat eine Richtung: Seine Felder zählen entlang der eigenen
 * x-Achse. Wie die im Plan liegt, hängt an der Drehung — ein Zug an der
 * unteren Wand ist um 180° gedreht, seine erste Feldkante liegt rechts.
 *
 * Daran hängen zwei Dinge, und beide sollen dasselbe sagen:
 *
 *  - **Gezählt wird von links nach rechts**, so wie man den Plan liest. Läuft
 *    das Möbel andersherum, dreht das Eigenschaftenfenster seine Liste um.
 *  - **Gelesen wird von links nach rechts.** Steht die Schrift sonst auf dem
 *    Kopf, wird sie gewendet.
 *
 * Die Grenze liegt bei einer Vierteldrehung, dieselbe wie bei den Maßen jeder
 * Bauzeichnung. Senkrechte Möbel laufen dadurch immer von oben nach unten:
 * Bei 90° zeigt die eigene x-Achse nach unten, bei 270° nach oben — und dort
 * wird gewendet.
 */
export function laeuftRueckwaerts(drehung: number): boolean {
  const grad = ((drehung % 360) + 360) % 360;
  return grad > 90 && grad <= 270;
}

/** Ist eine Beschriftung dieser Planhöhe bei diesem Zoom noch zu lesen? */
export function lesbar(planHoehe: number, zoom: number): boolean {
  return planHoehe * zoom >= LESBAR_AB;
}

/**
 * Wie breit ein Text in einer bestimmten Größe wirklich wird, in Planmaß.
 *
 * Geschätzt über die Zeichenzahl geht es daneben, sobald der Text kurz ist:
 * "WC" braucht je Zeichen anderthalbmal so viel Platz wie "Getränkelager",
 * weil ein W breit und ein l schmal ist. Gemessen wird deshalb auf einer
 * eigenen Leinwand, die nie gezeichnet wird.
 *
 * Wo es keine gibt – in den Prüfungen etwa –, bleibt die Schätzung als
 * Notnagel; sie fällt großzügig aus, damit sie eher zu breit als zu schmal
 * rät. Zu breit heißt: eine Schriftgröße kleiner. Zu schmal hieße: Text im
 * Nachbarraum.
 */
const MESSLEINWAND: CanvasRenderingContext2D | null =
  typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');

export function textbreite(text: string, schrift: number, fett = true): number {
  if (!MESSLEINWAND) return text.length * 0.62 * schrift;
  // Dieselbe Schrift, die Konva für die Beschriftungen nimmt.
  MESSLEINWAND.font = `${fett ? 'bold ' : ''}${schrift}px Arial, sans-serif`;
  return MESSLEINWAND.measureText(text).width;
}
