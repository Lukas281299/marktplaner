/**
 * Einen Bereich eines Plans groß rendern, um Maße abzulesen.
 *
 * Für die Stellen, an denen es auf Zentimeter ankommt: Anlagen, Einbauten,
 * Bemaßungen. Was im Gesamtplan ein Fleck ist, wird hier lesbar.
 *
 *   node werkzeuge/plan-ausschnitt.mjs <plan.pdf> <bild.png> x1 y1 x2 y2
 *
 * Die Koordinaten sind Meter im Plan, so wie plan-nach-bild sie anzeigt.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist';

const PT_JE_MM_BLATT = 72 / 25.4;

const [pfad, ziel, x1, y1, x2, y2] = process.argv.slice(2);
if (!pfad || !ziel) {
  console.error('Aufruf: plan-ausschnitt.mjs <plan.pdf> <bild.png> x1 y1 x2 y2');
  process.exit(1);
}

const roh = await readFile(pfad);
const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;
const dokument = await pdfjs.getDocument({ data: daten }).promise;
const seite = await dokument.getPage(1);

const mJePunkt = (100 / PT_JE_MM_BLATT) / 1000;
const breiteM = Number(x2) - Number(x1);
const hoeheM = Number(y2) - Number(y1);
// So groß, dass die Bemaßung lesbar wird, aber unter einem handlichen Bild.
const zoom = Math.min(20, 2400 / (Math.max(breiteM, hoeheM) / mJePunkt));

const leinwand = createCanvas(
  Math.round((breiteM / mJePunkt) * zoom),
  Math.round((hoeheM / mJePunkt) * zoom),
);
const ctx = leinwand.getContext('2d');
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, leinwand.width, leinwand.height);
ctx.translate(-(Number(x1) / mJePunkt) * zoom, -(Number(y1) / mJePunkt) * zoom);
await seite.render({
  canvas: leinwand as unknown as HTMLCanvasElement,
  canvasContext: ctx as unknown as CanvasRenderingContext2D,
  viewport: seite.getViewport({ scale: zoom }),
}).promise;

await writeFile(ziel, leinwand.toBuffer('image/png'));
console.log(
  `${breiteM.toFixed(1)} × ${hoeheM.toFixed(1)} m -> ${leinwand.width}x${leinwand.height} px ` +
    `(${(leinwand.width / breiteM).toFixed(0)} Punkte je Meter)`,
);
