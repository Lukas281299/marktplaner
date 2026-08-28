/**
 * Zeigt, was auf jeder Seite eines Plan-PDFs steht.
 *
 * Ein Ladenplan kommt selten allein: In derselben Datei stecken Deckblatt,
 * Legende, Möblierungsvarianten und Detailschnitte. Welche Seite der
 * Grundriss ist, sieht man am Maßstab und an der Zahl der Maßketten – und
 * ohne diese Frage zu klären, misst man am Ende ein Deckblatt aus.
 */
import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist';
import { bestimmeMassstab } from '../src/logik/planImport/massstab';
import type { PlanText } from '../src/logik/planImport/typen';

const PT_JE_MM = 72 / 25.4;

async function texteVon(seite: Awaited<ReturnType<Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>['getPage']>>): Promise<PlanText[]> {
  const inhalt = await seite.getTextContent();
  const hoehe = seite.getViewport({ scale: 1 }).height;
  const texte: PlanText[] = [];
  for (const roh of inhalt.items) {
    if (!('str' in roh) || !roh.str.trim()) continue;
    const [a, b, c, d, e, f] = roh.transform;
    const breite = roh.width;
    const sh = roh.height || Math.hypot(c, d) || 1;
    const x = a * (breite / 2) + c * (sh / 2) + e;
    const y = b * (breite / 2) + d * (sh / 2) + f;
    texte.push({
      text: roh.str.trim(),
      x,
      y: hoehe - y,
      breite: Math.abs(a) * breite + Math.abs(c) * sh,
      hoehe: Math.abs(b) * breite + Math.abs(d) * sh,
    });
  }
  return texte;
}

const pfad = process.argv[2];
const roh = await readFile(pfad);
const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;
const dokument = await pdfjs.getDocument({ data: daten }).promise;

const zeilen: Record<string, unknown>[] = [];
for (let n = 1; n <= dokument.numPages; n++) {
  const seite = await dokument.getPage(n);
  const sicht = seite.getViewport({ scale: 1 });
  const texte = await texteVon(seite);
  const massstab = bestimmeMassstab(texte);
  // Maßketten sind vierstellige Zahlen – der sicherste Hinweis auf einen
  // bemaßten Grundriss.
  const masszahlen = texte.filter((t) => /^\d{3,5}$/.test(t.text)).length;
  const befehle = await seite.getOperatorList();

  zeilen.push({
    seite: n,
    blattMm: `${Math.round(sicht.width / PT_JE_MM)} × ${Math.round(sicht.height / PT_JE_MM)}`,
    texte: texte.length,
    masszahlen,
    massstab: massstab.massstab,
    sicherheit: massstab.sicherheit,
    proben: massstab.proben,
    ausSchriftfeld: massstab.ausSchriftfeld ?? null,
    befehle: befehle.fnArray.length,
    titel: texte
      .filter((t) => t.text.length > 6 && /[A-Za-zÄÖÜäöü]/.test(t.text))
      .slice(0, 3)
      .map((t) => t.text)
      .join(' | ')
      .slice(0, 90),
  });
}
console.log(JSON.stringify(zeilen, null, 1));
