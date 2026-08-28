/**
 * Lässt sich der Maßstab aus dem Möbelraster beweisen?
 *
 * Diese Pläne tragen keine Maßketten – der Maßstab wäre also geraten, und
 * ein geratener Maßstab macht jedes Maß falsch, ohne dass man es sieht.
 *
 * Es gibt aber einen zweiten Zeugen: die Möbel. Ladenbau läuft im Raster,
 * beim wire tech 100 in Achsmaßen von 625, 800, 1000, 1250 und 1333 mm. Wenn
 * die gezeichneten Rechtecke bei einem angenommenen Maßstab auf genau diese
 * Maße fallen, stimmt der Maßstab – und wenn nicht, stimmt er nicht.
 *
 * Geprüft werden alle üblichen Maßstäbe. Der beste ist der, bei dem die
 * meisten Rechtecke aufs Raster passen.
 */
import { readFile } from 'node:fs/promises';
import { lesePlan, liesFuellflaechen } from '../src/logik/planImport/pdfLesen';
import { rahmenVon } from '../src/logik/planImport/wandkoerper';

/** Achsmaße in mm, die im Ladenbau vorkommen. */
const RASTER = [625, 800, 1000, 1250, 1333, 1875, 2500];
const MASSSTAEBE = [50, 75, 100, 125, 150, 200];
const PT_JE_MM_BLATT = 72 / 25.4;

const pfad = process.argv[2];
const roh = await readFile(pfad);
const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;
const { dokument } = await lesePlan(daten.slice(0));
const flaechen = await liesFuellflaechen(dokument);

// Nur Rechtecke von brauchbarer Größe: winzige Schraffuren sagen nichts.
const kaesten = flaechen
  .map((f) => rahmenVon(f.punkte))
  .map((r) => ({ b: r.rechts - r.links, h: r.unten - r.oben }))
  .filter((k) => k.b > 2 && k.h > 2);

console.log(`Rechtecke über 2 pt: ${kaesten.length}`);

for (const massstab of MASSSTAEBE) {
  const mmJePunkt = massstab / PT_JE_MM_BLATT;
  let treffer = 0;
  const gefunden = new Map<number, number>();
  for (const k of kaesten) {
    // Die längere Seite eines Möbels ist seine Länge im Raster.
    const laenge = Math.max(k.b, k.h) * mmJePunkt;
    for (const r of RASTER) {
      // Ein Vielfaches des Rasters, auf 1,5 % genau.
      const n = Math.round(laenge / r);
      if (n >= 1 && n <= 8 && Math.abs(laenge - n * r) / (n * r) < 0.015) {
        treffer++;
        gefunden.set(r, (gefunden.get(r) ?? 0) + 1);
        break;
      }
    }
  }
  const anteil = ((treffer / kaesten.length) * 100).toFixed(1);
  const top = [...gefunden.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log(
    `1:${String(massstab).padEnd(4)} ${String(treffer).padStart(5)} Treffer (${anteil.padStart(5)} %)  ` +
      top.map(([r, n]) => `${r}mm×${n}`).join('  '),
  );
}

// Und die häufigsten Längen in mm bei 1:100 – als Gegenprobe von Hand.
const jeMm100 = 100 / PT_JE_MM_BLATT;
const haeufig = new Map<number, number>();
for (const k of kaesten) {
  const laenge = Math.round((Math.max(k.b, k.h) * jeMm100) / 5) * 5;
  haeufig.set(laenge, (haeufig.get(laenge) ?? 0) + 1);
}
console.log('\nHäufigste Längen bei 1:100 (mm, auf 5 gerundet):');
console.log(
  [...haeufig.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([mm, n]) => `${mm}:${n}`)
    .join('  '),
);
