/**
 * Aus einem Ladenplan ein Marktplaner-Projekt mit Räumen und Wänden.
 *
 * Nur der Grundriss, keine Einrichtung: Wo Wände stehen, ist eine Tatsache
 * des Gebäudes, wo Regale stehen eine Entscheidung des Planers. Die trifft
 * er selbst.
 *
 * Die Wände kommen aus `plan-waende.ts`, das sie am Kontrollbild überprüfbar
 * macht. Hier werden sie nur noch in Zentimeter gerechnet, auf den Ursprung
 * geschoben und als `wandkoerper` abgelegt – die Form, in der der Marktplaner
 * eingelesene Wände hält.
 *
 *   node werkzeuge/plan-nach-grundriss.mjs <plan.pdf> <projekt.json> [Name]
 *
 * Die Projektdateien gehören in den Kladdeordner und nie ins Repository:
 * Sie sind die Grundrisse unserer Märkte.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { PLAENE, waende, type Balken } from './plan-waende';

/** Muss zu `src/typen/modell.ts` passen. */
const SCHEMA_VERSION = 15;

const STANDARD_EBENEN = [
  // Muss zu `src/daten/standardProjekt.ts` passen. Erfundene Kennungen
  // machen alles unsichtbar, was auf ihnen liegt: Was zu einer Ebene
  // gehoert, die es nicht gibt, wird nirgends gezeichnet.
  { id: 'gebaeude', name: 'Gebäude & Wände', sichtbar: true, gesperrt: false },
  { id: 'raeume', name: 'Räume', sichtbar: true, gesperrt: false },
  { id: 'verkaufsflaeche', name: 'Verkaufsfläche', sichtbar: true, gesperrt: false },
  { id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false },
  { id: 'beschriftung', name: 'Beschriftungen', sichtbar: true, gesperrt: false },
  { id: 'laufwege', name: 'Laufwege', sichtbar: true, gesperrt: false },
];

function kennung(vorsatz: string, n: number) {
  return `${vorsatz}-${n.toString(36).padStart(6, '0')}`;
}

/**
 * Die Wände auf den Ursprung schieben und in Zentimeter rechnen.
 *
 * Ein Plan hat seinen Nullpunkt irgendwo auf dem Blatt – oft weit außerhalb
 * des Gebäudes. Ohne das Verschieben läge der Markt beim Öffnen außerhalb
 * des Bildschirms.
 */
export function alsProjekt(balken: Balken[], name: string) {
  let mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity;
  for (const b of balken) {
    if (b.x1 < mx) mx = b.x1;
    if (b.y1 < my) my = b.y1;
    if (b.x2 > Mx) Mx = b.x2;
    if (b.y2 > My) My = b.y2;
  }
  if (!Number.isFinite(mx)) throw new Error('Keine Wände – nichts zu schreiben.');

  // Ein halber Meter Luft, damit die Außenwand nicht am Rand klebt.
  const RAND = 0.5;
  const cm = (v: number) => Math.round(v * 100);
  const versetztX = (v: number) => cm(v - mx + RAND);
  const versetztY = (v: number) => cm(v - my + RAND);

  const wandkoerper = balken.map((b) => [
    { x: versetztX(b.x1), y: versetztY(b.y1) },
    { x: versetztX(b.x2), y: versetztY(b.y1) },
    { x: versetztX(b.x2), y: versetztY(b.y2) },
    { x: versetztX(b.x1), y: versetztY(b.y2) },
  ]);

  const breite = cm(Mx - mx + 2 * RAND);
  const hoehe = cm(My - my + 2 * RAND);
  const jetzt = Date.now();

  return {
    id: kennung('p', 1),
    name,
    version: SCHEMA_VERSION,
    erstelltAm: jetzt,
    geaendertAm: jetzt,
    grundflaeche: {
      // Der Umriss ist der Rahmen, mit dem die Flächenrechnung arbeitet;
      // die Wandkörper daneben sind die Wirklichkeit darin.
      umriss: [
        { x: 0, y: 0 },
        { x: breite, y: 0 },
        { x: breite, y: hoehe },
        { x: 0, y: hoehe },
      ],
      wandstaerke: 24,
      wandkoerper,
    },
    einstellungen: {
      anzeigeEinheit: 'm' as const,
      rasterSichtbar: true,
      rasterWeite: 50,
      amRasterEinrasten: true,
      hilfslinienAktiv: true,
      masseAnzeigen: true,
    },
    ebenen: STANDARD_EBENEN.map((e) => ({ ...e })),
    raeume: [],
    verkaufsflaechen: [],
    waende: [],
    oeffnungen: [],
    elemente: [],
    gruppen: [],
    masslinien: [],
  };
}

/**
 * Das Projekt in die Huelle packen, die der Import erwartet.
 *
 * Der Marktplaner liest keine nackten Projekte ein, sondern Austauschdateien
 * mit `format: 'marktplaner'` - dieselbe Huelle, die "Speichern als JSON"
 * schreibt. Ohne sie meldet der Import "Diese Datei stammt nicht aus dem
 * Marktplaner", und das waere eine unnoetig raetselhafte Auskunft fuer eine
 * Datei, die genau daher stammt.
 */
export function austauschdatei(projekt: ReturnType<typeof alsProjekt>) {
  return {
    format: 'marktplaner' as const,
    version: SCHEMA_VERSION,
    exportiertAm: new Date().toISOString(),
    projekt,
    eigeneVorlagen: [],
  };
}

/* --------------------------------------------------------- Befehlszeile */

if ((process.argv[1] ?? '').endsWith('plan-nach-grundriss.mjs') && process.argv[2] && process.argv[3]) {
  const pfad = process.argv[2];
  const wahl = PLAENE[basename(pfad)];
  if (!wahl) {
    console.error(`Keine Einstellung für ${basename(pfad)} – siehe PLAENE in plan-waende.ts.`);
    process.exit(1);
  }
  const balken = await waende(pfad, wahl);
  const name = process.argv[4] ?? basename(pfad).replace(/\.pdf$/i, '');
  const projekt = alsProjekt(balken, name);
  await mkdir(dirname(process.argv[3]), { recursive: true });
  await writeFile(process.argv[3], JSON.stringify(austauschdatei(projekt)), 'utf8');
  const g = projekt.grundflaeche;
  console.log(
    `${name}: ${balken.length} Wandkörper, ` +
      `${(g.umriss[2].x / 100).toFixed(1)} × ${(g.umriss[2].y / 100).toFixed(1)} m -> ${process.argv[3]}`,
  );
}
