import type Konva from 'konva';

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
} = {
  buehne: null,
  einpassen: null,
};
