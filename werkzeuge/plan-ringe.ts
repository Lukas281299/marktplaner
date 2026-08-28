/**
 * Welche Farbe zeichnet die Wände?
 *
 * Zeigt je Füllfarbe den **größten einzelnen Ring** statt der Summe aller.
 * Der Unterschied entscheidet: Der Außenwandzug eines Marktes ist ein
 * einziger riesiger Ring, Schraffuren sind tausend winzige. Wer summiert,
 * bekommt die Schraffur.
 */
import { readFile } from 'node:fs/promises';
import { lesePlan, liesFuellflaechen } from '../src/logik/planImport/pdfLesen';
import { bestimmeMassstab } from '../src/logik/planImport/massstab';
import { polygonflaeche, rahmenVon } from '../src/logik/planImport/wandkoerper';

const RING_GRENZE = 0.6;

const pfad = process.argv[2];
const roh = await readFile(pfad);
const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;
const { dokument } = await lesePlan(daten.slice(0));
const flaechen = await liesFuellflaechen(dokument);

interface Eintrag {
  farbe: string;
  ringe: number;
  groesster: number;
  breitePt: number;
  hoehePt: number;
  summe: number;
}
const nach = new Map<string, Eintrag>();

for (const f of flaechen) {
  if (f.punkte.length < 3) continue;
  const r = rahmenVon(f.punkte);
  const kasten = (r.rechts - r.links) * (r.unten - r.oben);
  if (kasten <= 0) continue;
  if (polygonflaeche(f.punkte) / kasten > RING_GRENZE) continue;

  const s = f.fuellung.map((v) => Math.round(v * 255)).join(',');
  const e = nach.get(s) ?? { farbe: s, ringe: 0, groesster: 0, breitePt: 0, hoehePt: 0, summe: 0 };
  e.ringe++;
  e.summe += kasten;
  if (kasten > e.groesster) {
    e.groesster = kasten;
    e.breitePt = r.rechts - r.links;
    e.hoehePt = r.unten - r.oben;
  }
  nach.set(s, e);
}

// Bei 1:100 ist ein Punkt 35,28 mm – so groß wäre der größte Ring in Metern.
const jeM = (35.28 / 1000);
console.log('Farbe          Ringe   größter Ring (pt)   bei 1:100 (m)      Summe');
for (const e of [...nach.values()].sort((a, b) => b.groesster - a.groesster).slice(0, 10)) {
  console.log(
    `${e.farbe.padEnd(14)} ${String(e.ringe).padStart(5)}   ` +
      `${Math.round(e.breitePt)} × ${Math.round(e.hoehePt)}`.padEnd(19) +
      `${(e.breitePt * jeM).toFixed(1)} × ${(e.hoehePt * jeM).toFixed(1)}`.padEnd(18) +
      `${Math.round(e.summe)}`,
  );
}
