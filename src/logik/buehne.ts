import type Konva from 'konva';
import type { Punkt } from '../typen/modell';

/**
 * Verbindung zwischen Werkzeugleiste und Zeichenfläche.
 *
 * Die Werkzeugleiste braucht gelegentlich direkten Zugriff auf die
 * Zeichenfläche – etwa für "Ansicht einpassen" oder den Bild-Export.
 * Statt diese Funktionen durch viele Komponenten hindurchzureichen, meldet
 * sich die Zeichenfläche hier einmal an.
 */
export const buehneSteuerung: {
  buehne: Konva.Stage | null;
  /** Zoomt so, dass das ganze Gebäude sichtbar ist. */
  einpassen: (() => void) | null;
  /**
   * Rückt einen Punkt des Plans in die Mitte der Ansicht.
   *
   * Für die Suche: Ein Treffer nützt nichts, wenn er außerhalb des
   * Ausschnitts liegt. `mindestZoom` zoomt nur hinein, wenn man sonst nichts
   * erkennen würde – wer weit herausgezoomt hat, um den ganzen Markt zu
   * sehen, soll nicht ungefragt hineingerissen werden.
   */
  zeigeAuf: ((punkt: Punkt, mindestZoom?: number) => void) | null;
} = {
  buehne: null,
  einpassen: null,
  zeigeAuf: null,
};
