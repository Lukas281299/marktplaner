/**
 * Warum ein Plan sich nicht einlesen lässt.
 *
 * Zeigt die drei Dinge, an denen es hängt, wenn ein Import schiefgeht: Was an
 * Text im Blatt steht (daraus kommt der Maßstab), welche Füllfarben es gibt
 * (daraus kommen die Wände) und wie groß die größten Flächen sind.
 *
 * Ohne diese Auskunft rät man beim Einlesen – und ein geratener Maßstab macht
 * jedes Maß im Plan falsch, ohne dass man es sieht.
 */
import { readFile } from 'node:fs/promises';
import { lesePlan, liesFuellflaechen } from '../src/logik/planImport/pdfLesen';
import { bestimmeMassstab, probenAusMassketten } from '../src/logik/planImport/massstab';
import {
  farbeGleich,
  findeWandfarbe,
  polygonflaeche,
  rahmenVon,
  teileEin,
} from '../src/logik/planImport/wandkoerper';

const pfad = process.argv[2];
const roh = await readFile(pfad);
const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;

const { befund, dokument } = await lesePlan(daten.slice(0));
const massstab = bestimmeMassstab(befund.texte);
const proben = probenAusMassketten(befund.texte);

console.log('--- Blatt ---');
console.log({
  planart: befund.planart,
  begruendung: befund.begruendung,
  blattMm: `${Math.round(befund.blattBreiteMm)} × ${Math.round(befund.blattHoeheMm)}`,
  texte: befund.texte.length,
  massstab: massstab.massstab,
  sicherheit: massstab.sicherheit,
  proben: massstab.proben,
  probenwerte: proben.slice(0, 8).map((p) => p.toFixed(3)),
  begruendungMassstab: massstab.begruendung,
});

console.log('\n--- Alle Texte ---');
for (const t of befund.texte.slice(0, 60)) {
  console.log(`  "${t.text}"  bei ${Math.round(t.x)}/${Math.round(t.y)}`);
}

const flaechen = await liesFuellflaechen(dokument);
console.log(`\n--- Füllflächen: ${flaechen.length} ---`);

const nachFarbe = new Map<string, { anzahl: number; flaeche: number }>();
for (const f of flaechen) {
  const s = f.fuellung.map((v) => Math.round(v * 255)).join(',');
  const e = nachFarbe.get(s) ?? { anzahl: 0, flaeche: 0 };
  e.anzahl++;
  e.flaeche += Math.abs(polygonflaeche(f.punkte));
  nachFarbe.set(s, e);
}
const sortiert = [...nachFarbe.entries()].sort((a, b) => b[1].flaeche - a[1].flaeche);
for (const [farbe, e] of sortiert.slice(0, 12)) {
  console.log(`  RGB ${farbe.padEnd(14)} ${String(e.anzahl).padStart(6)} Flächen, Summe ${Math.round(e.flaeche)} pt²`);
}

const wandfarbe = findeWandfarbe(flaechen);
console.log('\nGewählte Wandfarbe:', wandfarbe ? wandfarbe.map((v) => Math.round(v * 255)).join(',') : 'keine');

if (wandfarbe) {
  const eigene = flaechen.filter((f) => farbeGleich(f.fuellung, wandfarbe));
  const koerper = teileEin(eigene, massstab.mmJePunkt);
  const arten = new Map<string, number>();
  for (const k of koerper) arten.set(k.art, (arten.get(k.art) ?? 0) + 1);
  console.log('Körper nach Einteilung:', [...arten.entries()]);

  const r = rahmenVon(eigene.flatMap((f) => f.punkte));
  const jeCm = massstab.mmJePunkt / 10;
  console.log(
    'Ausdehnung dieser Flächen:',
    `${(((r.rechts - r.links) * jeCm) / 100).toFixed(2)} × ${(((r.unten - r.oben) * jeCm) / 100).toFixed(2)} m`,
    `(bei Maßstab 1:${massstab.massstab})`,
  );
}

// Und zum Vergleich: Wie groß ist alles Gezeichnete zusammen?
const alle = rahmenVon(flaechen.flatMap((f) => f.punkte));
console.log(
  'Ausdehnung aller Flächen:',
  `${Math.round(alle.rechts - alle.links)} × ${Math.round(alle.unten - alle.oben)} pt`,
);
