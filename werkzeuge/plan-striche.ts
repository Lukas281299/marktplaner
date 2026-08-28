/**
 * Wie zeichnet dieser Plan seine Wände?
 *
 * Der Import sucht Wände als **gefüllte Ringe** – so zeichnet CAD sie
 * üblicherweise. Manche Pläne tun das nicht: Sie ziehen die Wand als dicken
 * Strich oder setzen sie aus einzelnen vollen Rechtecken zusammen. Dann
 * findet die Ringsuche nichts, und der Import liefert ein Gebäude von elf
 * Metern, wo einer von siebzig steht.
 *
 * Dieses Werkzeug zeigt beides: die längsten Striche und die längsten vollen
 * Rechtecke, jeweils nach Farbe. Was davon über zwanzig Meter lang ist, kann
 * nur die Außenwand sein.
 */
import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist';

const PT_JE_MM_BLATT = 72 / 25.4;
/** Bei 1:100 ist ein Blattpunkt 35,28 mm in Wirklichkeit. */
const MM_JE_PUNKT = 100 / PT_JE_MM_BLATT;

type Matrix = [number, number, number, number, number, number];
const EINHEIT: Matrix = [1, 0, 0, 1, 0, 0];

function verkette(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}
function bilde(m: Matrix, x: number, y: number) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}
function hex(wert: unknown): string {
  return typeof wert === 'string' ? wert : String(wert);
}

const pfad = process.argv[2];
const roh = await readFile(pfad);
const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;
const dokument = await pdfjs.getDocument({ data: daten }).promise;
const seite = await dokument.getPage(1);
const befehle = await seite.getOperatorList();
const { OPS } = pdfjs;

const MOVE = 0;
const LINE = 1;
const KURVE = 2;

interface Stueck {
  farbe: string;
  gefuellt: boolean;
  breite: number;
  hoehe: number;
  laenge: number;
}
const stuecke: Stueck[] = [];

let strichfarbe = '#000000';
let fuellfarbe = '#000000';
let matrix: Matrix = EINHEIT;
const stapel: { s: string; f: string; m: Matrix }[] = [];

const FUELLT = new Set<number>([
  OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke,
  OPS.closeFillStroke, OPS.closeEOFillStroke,
]);

for (let i = 0; i < befehle.fnArray.length; i++) {
  const befehl = befehle.fnArray[i];
  const args = befehle.argsArray[i] as unknown[];

  if (befehl === OPS.save) { stapel.push({ s: strichfarbe, f: fuellfarbe, m: matrix }); continue; }
  if (befehl === OPS.restore) {
    const alt = stapel.pop();
    if (alt) { strichfarbe = alt.s; fuellfarbe = alt.f; matrix = alt.m; }
    continue;
  }
  if (befehl === OPS.transform) { matrix = verkette(args as unknown as Matrix, matrix); continue; }
  if (befehl === OPS.setStrokeRGBColor || befehl === OPS.setStrokeGray) { strichfarbe = hex(args[0]); continue; }
  if (befehl === OPS.setFillRGBColor || befehl === OPS.setFillGray) { fuellfarbe = hex(args[0]); continue; }
  if (befehl !== OPS.constructPath) continue;

  const malbefehl = args[0] as number;
  const gefuellt = FUELLT.has(malbefehl);
  const teilpfade = args[1];
  if (!Array.isArray(teilpfade)) continue;

  for (const teil of teilpfade as (ArrayLike<number> | null)[]) {
    if (!teil || typeof teil.length !== 'number') continue;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    let n = 0;
    let punkte = 0;
    while (n < teil.length) {
      const code = teil[n++];
      let x: number, y: number;
      if (code === MOVE || code === LINE) { x = teil[n++]; y = teil[n++]; }
      else if (code === KURVE) { n += 4; x = teil[n++]; y = teil[n++]; }
      else break;
      const p = bilde(matrix, x, y);
      minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
      miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
      punkte++;
    }
    if (punkte < 2) continue;
    const b = (maxx - minx) * MM_JE_PUNKT / 1000;
    const h = (maxy - miny) * MM_JE_PUNKT / 1000;
    stuecke.push({
      farbe: gefuellt ? fuellfarbe : strichfarbe,
      gefuellt,
      breite: b,
      hoehe: h,
      laenge: Math.max(b, h),
    });
  }
}

console.log(`Pfadstücke: ${stuecke.length}  (davon gefüllt: ${stuecke.filter((s) => s.gefuellt).length})`);
console.log('\nDie zwanzig längsten Stücke – Länge in Metern bei 1:100:');
console.log('Länge     Breite×Höhe        Art        Farbe');
for (const s of [...stuecke].sort((a, b) => b.laenge - a.laenge).slice(0, 20)) {
  console.log(
    `${s.laenge.toFixed(2).padStart(7)} m  ` +
      `${s.breite.toFixed(2)} × ${s.hoehe.toFixed(2)}`.padEnd(19) +
      `${(s.gefuellt ? 'gefüllt' : 'Strich').padEnd(11)}${s.farbe}`,
  );
}

// Lange, schmale Stücke sind Wandkandidaten.
const wandartig = stuecke.filter((s) => s.laenge > 3 && Math.min(s.breite, s.hoehe) < 0.8);
const nachFarbe = new Map<string, { n: number; laengste: number; summe: number }>();
for (const s of wandartig) {
  const k = `${s.gefuellt ? 'F' : 'S'} ${s.farbe}`;
  const e = nachFarbe.get(k) ?? { n: 0, laengste: 0, summe: 0 };
  e.n++;
  e.summe += s.laenge;
  e.laengste = Math.max(e.laengste, s.laenge);
  nachFarbe.set(k, e);
}
console.log(`\nLange schmale Stücke (>3 m lang, <0,8 m dick): ${wandartig.length}`);
console.log('Art/Farbe            Anzahl   längstes   Summe');
for (const [k, e] of [...nachFarbe.entries()].sort((a, b) => b[1].summe - a[1].summe).slice(0, 10)) {
  console.log(`${k.padEnd(20)} ${String(e.n).padStart(6)}   ${e.laengste.toFixed(1).padStart(7)} m  ${e.summe.toFixed(0).padStart(6)} m`);
}
