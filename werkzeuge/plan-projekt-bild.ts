/**
 * Ein fertiges Projekt als Bild – die letzte Kontrolle vor der Übergabe.
 *
 * Zeigt genau das, was in der Datei steht: den Umriss und jeden Wandkörper.
 * Nicht das PDF, nicht die Zwischenrechnung, sondern das Ergebnis. Wenn hier
 * ein Grundriss zu sehen ist, sieht der Planer beim Öffnen denselben.
 *
 *   node werkzeuge/plan-projekt-bild.mjs <projekt.json> <bild.png> [px/m]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';

interface Punkt { x: number; y: number }

const projekt = JSON.parse(await readFile(process.argv[2], 'utf8')) as {
  name: string;
  grundflaeche: { umriss: Punkt[]; wandkoerper?: Punkt[][] };
};

const jePx = (Number(process.argv[4]) || 18) / 100; // Bildpunkte je Zentimeter
const umriss = projekt.grundflaeche.umriss;
const breite = Math.max(...umriss.map((p) => p.x));
const hoehe = Math.max(...umriss.map((p) => p.y));

const leinwand = createCanvas(Math.round(breite * jePx), Math.round(hoehe * jePx));
const ctx = leinwand.getContext('2d');
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, leinwand.width, leinwand.height);
ctx.scale(jePx, jePx);

// Raster alle fünf Meter.
ctx.strokeStyle = '#cfe0f8';
ctx.lineWidth = 2;
for (let x = 0; x <= breite; x += 500) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hoehe); ctx.stroke();
}
for (let y = 0; y <= hoehe; y += 500) {
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(breite, y); ctx.stroke();
}

ctx.strokeStyle = '#94a3b8';
ctx.lineWidth = 3;
ctx.beginPath();
umriss.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
ctx.closePath();
ctx.stroke();

ctx.fillStyle = '#3f3f46';
for (const k of projekt.grundflaeche.wandkoerper ?? []) {
  ctx.beginPath();
  k.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}

ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.font = '600 15px sans-serif';
ctx.fillStyle = '#1552a8';
ctx.fillText(
  `${projekt.name} – ${(breite / 100).toFixed(1)} × ${(hoehe / 100).toFixed(1)} m, ` +
    `${(projekt.grundflaeche.wandkoerper ?? []).length} Wandkörper`,
  8,
  20,
);

await writeFile(process.argv[3], leinwand.toBuffer('image/png'));
console.log(`${projekt.name} -> ${process.argv[3]} (${leinwand.width}x${leinwand.height})`);
