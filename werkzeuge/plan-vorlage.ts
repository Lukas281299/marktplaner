/**
 * Einen Ladenplan als maßstabsgetreue Vorlage zum Nachzeichnen.
 *
 * Die automatische Wanderkennung trifft die Machart jedes Plans nur
 * ungefähr: Was Wand ist und was Regal, entscheidet sich an Farbe und
 * Stärke, und beides sagt jeder Zeichner anders. Das Ergebnis war ein
 * Grundriss mit Löchern und mit Möbeln darin – mehr Nacharbeit als Gewinn.
 *
 * Sicher ist dagegen der **Maßstab**. Ein Blatt im Maßstab 1:100 zeigt an
 * jeder Stelle hundertfach verkleinert, was gebaut wird; daraus ergibt sich
 * eindeutig, wie groß das Bild im Plan liegen muss. Liegt es richtig, kann
 * der Planer die Wände darüberzeichnen und sie stimmen auf den Zentimeter.
 * Danach nimmt er die Vorlage weg – der Knopf dafür steht im Projektfenster.
 *
 *   node werkzeuge/plan-vorlage.mjs <plan.pdf> <projekt.json> [Name] [Maßstab]
 *
 * Zugeschnitten wird auf das Gebäude: Ein Markt auf einem A0-Bogen füllt
 * ein Viertel des Blattes, und die restlichen drei Viertel sind Schriftfeld
 * und Legende. Woher der Ausschnitt kommt, steht bei `ausschnitt`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist';
import { PLAENE, waende } from './plan-waende';

const PT_JE_MM_BLATT = 72 / 25.4;
const SCHEMA_VERSION = 15;

/**
 * Wo auf dem Blatt das Gebäude liegt, in Metern.
 *
 * Aus derselben Wanderkennung, die für die Wände selbst zu ungenau ist –
 * für die Frage "wo ungefähr" reicht sie mühelos. Findet sie nichts, bleibt
 * das ganze Blatt stehen.
 */
async function ausschnitt(pfad: string): Promise<{ x1: number; y1: number; x2: number; y2: number } | undefined> {
  const wahl = PLAENE[basename(pfad)];
  if (!wahl) return undefined;
  const balken = await waende(pfad, wahl);
  if (balken.length === 0) return undefined;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of balken) {
    if (b.x1 < x1) x1 = b.x1;
    if (b.y1 < y1) y1 = b.y1;
    if (b.x2 > x2) x2 = b.x2;
    if (b.y2 > y2) y2 = b.y2;
  }
  // Ein Meter Luft, damit die Außenwand nicht am Bildrand klebt.
  return { x1: x1 - 1, y1: y1 - 1, x2: x2 + 1, y2: y2 + 1 };
}

const pfad = process.argv[2];
const ziel = process.argv[3];
if (!pfad || !ziel) {
  console.error('Aufruf: plan-vorlage.mjs <plan.pdf> <projekt.json> [Name] [Maßstab]');
  process.exit(1);
}
const massstab = Number(process.argv[5]) || 100;

const { readFile } = await import('node:fs/promises');
const roh = await readFile(pfad);
const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;
const dokument = await pdfjs.getDocument({ data: daten }).promise;
const seite = await dokument.getPage(1);

const blatt = seite.getViewport({ scale: 1 });
// Meter auf dem Blatt je Punkt – dieselbe Rechnung wie in plan-nach-svg.
const mJePunkt = (massstab / PT_JE_MM_BLATT) / 1000;

const bereich = (await ausschnitt(pfad)) ?? {
  x1: 0, y1: 0, x2: blatt.width * mJePunkt, y2: blatt.height * mJePunkt,
};
const breiteM = bereich.x2 - bereich.x1;
const hoeheM = bereich.y2 - bereich.y1;

// Rund 4200 Punkte auf der langen Seite: fein genug, dass die Bemaßung
// lesbar bleibt, ohne dass die Datei unhandlich wird.
const zoom = Math.min(6, 4200 / (Math.max(breiteM, hoeheM) / mJePunkt));
const sicht = seite.getViewport({ scale: zoom });

const leinwand = createCanvas(
  Math.round((breiteM / mJePunkt) * zoom),
  Math.round((hoeheM / mJePunkt) * zoom),
);
const ctx = leinwand.getContext('2d');
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, leinwand.width, leinwand.height);
// Den Ausschnitt an den Ursprung schieben, dann das Blatt darüber zeichnen.
ctx.translate(-(bereich.x1 / mJePunkt) * zoom, -(bereich.y1 / mJePunkt) * zoom);
await seite.render({
  canvas: leinwand as unknown as HTMLCanvasElement,
  canvasContext: ctx as unknown as CanvasRenderingContext2D,
  viewport: sicht,
}).promise;

const breite = Math.round(breiteM * 100);
const hoehe = Math.round(hoeheM * 100);
const bild = 'data:image/png;base64,' + leinwand.toBuffer('image/png').toString('base64');
const name = process.argv[4] ?? basename(pfad).replace(/\.pdf$/i, '');
const jetzt = Date.now();

const projekt = {
  id: 'p-000001',
  name,
  version: SCHEMA_VERSION,
  erstelltAm: jetzt,
  geaendertAm: jetzt,
  grundflaeche: {
    umriss: [
      { x: 0, y: 0 },
      { x: breite, y: 0 },
      { x: breite, y: hoehe },
      { x: 0, y: hoehe },
    ],
    wandstaerke: 24,
  },
  einstellungen: {
    anzeigeEinheit: 'm' as const,
    rasterSichtbar: true,
    rasterWeite: 50,
    amRasterEinrasten: true,
    hilfslinienAktiv: true,
    masseAnzeigen: true,
  },
  ebenen: [
    { id: 'ebene-grund', name: 'Grundriss', sichtbar: true, gesperrt: false, reihenfolge: 0 },
    { id: 'ebene-moebel', name: 'Möbel', sichtbar: true, gesperrt: false, reihenfolge: 1 },
  ],
  raeume: [],
  verkaufsflaechen: [],
  waende: [],
  oeffnungen: [],
  elemente: [],
  gruppen: [],
  masslinien: [],
  hintergrund: {
    bild,
    breite,
    hoehe,
    x: 0,
    y: 0,
    // Blass genug, dass die eigene Zeichnung darauf zu sehen ist, kräftig
    // genug, dass die Wände im Plan erkennbar bleiben.
    deckkraft: 0.5,
    sichtbar: true,
    gesperrt: true,
    quelle: basename(pfad),
    massstab,
  },
};

await mkdir(dirname(ziel), { recursive: true });
await writeFile(
  ziel,
  JSON.stringify({
    format: 'marktplaner',
    version: SCHEMA_VERSION,
    exportiertAm: new Date().toISOString(),
    projekt,
    eigeneVorlagen: [],
  }),
  'utf8',
);
console.log(
  `${name}: ${(breite / 100).toFixed(1)} × ${(hoehe / 100).toFixed(1)} m bei 1:${massstab}, ` +
    `${leinwand.width}x${leinwand.height} px -> ${ziel}`,
);
