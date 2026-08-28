/**
 * Einen Plan als maßstabsgetreuen Hintergrund in ein Projekt legen.
 *
 * Für Pläne, die als Bild gescannt und nicht gezeichnet sind: Dort gibt es
 * keine Linien zu messen, nur Bildpunkte. Gemessen werden kann trotzdem –
 * über die Blattgröße. Ein Blatt im Maßstab 1:100 ist an jeder Stelle
 * hundertmal kleiner als das Gebäude, und daraus ergibt sich, wie groß das
 * Bild im Plan liegen muss.
 *
 * Damit ist der Grundriss nicht fertig, aber nachzeichenbar: Der Planer legt
 * die Wände mit dem Innenwandwerkzeug darüber, und weil der Hintergrund
 * maßstäblich liegt, stimmen die Maße.
 *
 *   node werkzeuge/plan-hintergrund.mjs <plan.pdf> <projekt.json> [Name] [Maßstab]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist';

const PT_JE_MM_BLATT = 72 / 25.4;
const SCHEMA_VERSION = 15;

const pfad = process.argv[2];
const ziel = process.argv[3];
if (!pfad || !ziel) {
  console.error('Aufruf: plan-hintergrund.mjs <plan.pdf> <projekt.json> [Name] [Maßstab]');
  process.exit(1);
}
const massstab = Number(process.argv[5]) || 100;

const roh = await readFile(pfad);
const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;
const dokument = await pdfjs.getDocument({ data: daten }).promise;
const seite = await dokument.getPage(1);

// Genug Punkte, dass die Bemaßung lesbar bleibt, ohne dass die Datei
// unhandlich wird. Bei einem Blatt in A0 sind das rund 4000 Bildpunkte.
const blatt = seite.getViewport({ scale: 1 });
const zoom = Math.min(4, 4200 / Math.max(blatt.width, blatt.height));
const sicht = seite.getViewport({ scale: zoom });

const leinwand = createCanvas(Math.round(sicht.width), Math.round(sicht.height));
const ctx = leinwand.getContext('2d');
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, leinwand.width, leinwand.height);
await seite.render({
  canvas: leinwand as unknown as HTMLCanvasElement,
  canvasContext: ctx as unknown as CanvasRenderingContext2D,
  viewport: sicht,
}).promise;

// Ein Punkt auf dem Blatt sind `massstab` Punkte in Wirklichkeit; in
// Zentimetern gerechnet also Blattmillimeter mal Maßstab durch zehn.
const breite = Math.round((blatt.width / PT_JE_MM_BLATT) * (massstab / 10));
const hoehe = Math.round((blatt.height / PT_JE_MM_BLATT) * (massstab / 10));

const bild = 'data:image/png;base64,' + leinwand.toBuffer('image/png').toString('base64');
const name = process.argv[4] ?? basename(pfad).replace(/\.pdf$/i, '');
const jetzt = Date.now();

const projekt = {
  id: 'p-hintergrund',
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
    deckkraft: 0.55,
    sichtbar: true,
    gesperrt: true,
    quelle: basename(pfad),
    massstab,
  },
};

await mkdir(dirname(ziel), { recursive: true });
await writeFile(ziel, JSON.stringify(projekt), 'utf8');
console.log(
  `${name}: Hintergrund ${leinwand.width}x${leinwand.height} px, ` +
    `${(breite / 100).toFixed(1)} × ${(hoehe / 100).toFixed(1)} m bei 1:${massstab} -> ${ziel}`,
);
