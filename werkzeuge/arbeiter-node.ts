/**
 * Der Ersatz für `planImport/arbeiter.ts` außerhalb des Browsers.
 *
 * In Node gibt es keinen Arbeiter und keinen Vite, der eine Datei mit `?url`
 * ausliefert. pdf.js rechnet dann im selben Faden weiter – für ein Werkzeug,
 * das ein paar Pläne umwandelt, ist das schnell genug.
 */
export const ARBEITER_URL: string | undefined = undefined;
