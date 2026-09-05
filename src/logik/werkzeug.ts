import type { Werkzeug } from '../zustand/planStore';

/**
 * Werkzeuge, die einen freien Polygonzug zeichnen.
 *
 * Grundriss, Verkaufsfläche, Raum, Förderband, Wand und freies Element werden
 * auf genau dieselbe Weise gezeichnet – Ecken setzen, Ziehen ergibt einen
 * Bogen, Klick auf den Anfang schließt. Nur was am Ende daraus wird,
 * unterscheidet sich.
 *
 * **Warum das hier steht und nicht in der Zeichenfläche:** Die Tastatur
 * braucht dieselbe Antwort. Solange ein Zug läuft, gehört Rückschritt der
 * Zeichnung – dort nimmt er die letzte gesetzte Ecke zurück. Stand die Liste
 * nur in der Zeichenfläche und die Tastatur kannte davon zwei Werkzeuge,
 * liefen bei den anderen vier **beide** Bedeutungen gleichzeitig: Der eben
 * fertig gezeichnete Raum war noch ausgewählt und verschwand, während der
 * Planer nur eine falsch gesetzte Ecke zurücknehmen wollte. Die Hinweiszeile
 * des Werkzeugs fordert genau diesen Tastendruck.
 */
export function zeichnetZug(werkzeug: Werkzeug): boolean {
  return (
    werkzeug === 'grundrissZeichnen' ||
    werkzeug === 'verkaufsflaeche' ||
    werkzeug === 'raumZeichnen' ||
    werkzeug === 'foerderband' ||
    werkzeug === 'wandZeichnen' ||
    werkzeug === 'elementZeichnen'
  );
}
