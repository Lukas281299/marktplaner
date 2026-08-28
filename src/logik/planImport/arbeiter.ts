import arbeiterUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Wo pdf.js seinen Arbeiter findet.
 *
 * Die **einzige** Zeile im Planimport, die Vite braucht: `?url` lässt die
 * Datei mit ausliefern, statt sie von einem fremden Server zu holen – das
 * Programm soll auch ohne Netz laufen.
 *
 * Sie steht hier allein, damit der übrige Import auch außerhalb des Browsers
 * läuft. Ein Werkzeug, das Pläne stapelweise umwandelt, biegt diese eine
 * Datei auf einen Ersatz um (siehe `werkzeuge/plan-nach-projekt.mjs`) und
 * teilt sonst jede Zeile Erkennung mit der App. Zwei Kopien der Erkennung
 * wären zwei, die auseinanderlaufen.
 */
export const ARBEITER_URL: string | undefined = arbeiterUrl;
