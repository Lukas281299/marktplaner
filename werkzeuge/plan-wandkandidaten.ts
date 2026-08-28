/**
 * Alle Wandkandidaten eines Plans, mit Koordinaten in Metern.
 *
 * Die automatische Erkennung sucht Wände als gefüllte Ringe. Diese Pläne
 * zeichnen sie anders – mal als Balken, mal als Strichpaare, jeder Plan auf
 * seine Weise. Statt für jede Machart eine eigene Erkennung zu bauen, gibt
 * dieses Werkzeug **alles** aus, was eine Wand sein könnte: lang, schmal,
 * achsparallel. Was davon wirklich eine Wand ist, entscheidet ein Blick auf
 * die Liste.
 *
 * Der Maßstab ist 1:100 – belegt über das Achsmaßraster der Möbel, siehe
 * `plan-raster.ts`.
 */
import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist';

const PT_JE_MM_BLATT = 72 / 25.4;

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

export interface Kandidat {
  /** In Metern, Ursprung links oben. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  laenge: number;
  dicke: number;
  waagerecht: boolean;
  gefuellt: boolean;
  farbe: string;
}

export async function wandkandidaten(pfad: string, massstab = 100): Promise<Kandidat[]> {
  const mmJePunkt = massstab / PT_JE_MM_BLATT;
  const roh = await readFile(pfad);
  const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;
  const dokument = await pdfjs.getDocument({ data: daten }).promise;
  const seite = await dokument.getPage(1);
  const hoehePt = seite.getViewport({ scale: 1 }).height;
  const befehle = await seite.getOperatorList();
  const { OPS } = pdfjs;

  const MOVE = 0;
  const LINE = 1;
  const KURVE = 2;
  const FUELLT = new Set<number>([
    OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke,
    OPS.closeFillStroke, OPS.closeEOFillStroke,
  ]);

  let strichfarbe = '#000000';
  let fuellfarbe = '#000000';
  let matrix: Matrix = EINHEIT;
  const stapel: { s: string; f: string; m: Matrix }[] = [];
  const kandidaten: Kandidat[] = [];

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
    if (befehl === OPS.setStrokeRGBColor || befehl === OPS.setStrokeGray) {
      strichfarbe = String(args[0]); continue;
    }
    if (befehl === OPS.setFillRGBColor || befehl === OPS.setFillGray) {
      fuellfarbe = String(args[0]); continue;
    }
    if (befehl !== OPS.constructPath) continue;

    const gefuellt = FUELLT.has(args[0] as number);
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
        const by = hoehePt - p.y;
        minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
        miny = Math.min(miny, by); maxy = Math.max(maxy, by);
        punkte++;
      }
      if (punkte < 2) continue;

      const jeM = mmJePunkt / 1000;
      const b = (maxx - minx) * jeM;
      const h = (maxy - miny) * jeM;
      const laenge = Math.max(b, h);
      const dicke = Math.min(b, h);

      // Eine Wand ist lang und schmal. Alles andere ist ein Möbel, eine
      // Schraffur oder der Blattrahmen.
      if (laenge < 2 || dicke > 0.7) continue;

      kandidaten.push({
        x1: +(minx * jeM).toFixed(3),
        y1: +(miny * jeM).toFixed(3),
        x2: +(maxx * jeM).toFixed(3),
        y2: +(maxy * jeM).toFixed(3),
        laenge: +laenge.toFixed(3),
        dicke: +dicke.toFixed(3),
        waagerecht: b >= h,
        gefuellt,
        farbe: gefuellt ? fuellfarbe : strichfarbe,
      });
    }
  }
  return kandidaten;
}

/* --------------------------------------------------------- Befehlszeile */

// Nur, wenn diese Datei selbst gestartet wurde. Sonst liefe die Ausgabe auch
// dann los, wenn ein anderes Werkzeug nur `wandkandidaten` importiert.
const direktGestartet = (process.argv[1] ?? '').endsWith('plan-wandkandidaten.mjs');

const pfad = process.argv[2];
if (pfad && direktGestartet) {
  const alle = await wandkandidaten(pfad, Number(process.argv[3]) || 100);
  const gefuellte = alle.filter((k) => k.gefuellt);
  console.log(`Kandidaten: ${alle.length} (gefüllt: ${gefuellte.length})`);

  // Nach Farbe und Dicke gruppieren – Wände einer Machart haben beides gleich.
  const gruppen = new Map<string, Kandidat[]>();
  for (const k of alle) {
    const s = `${k.gefuellt ? 'F' : 'S'} ${k.farbe} d=${k.dicke.toFixed(2)}`;
    gruppen.set(s, [...(gruppen.get(s) ?? []), k]);
  }
  console.log('\nGruppen (Art, Farbe, Dicke) – Anzahl, längste, Gesamtlänge:');
  for (const [s, ks] of [...gruppen.entries()]
    .sort((a, b) => b[1].reduce((x, k) => x + k.laenge, 0) - a[1].reduce((x, k) => x + k.laenge, 0))
    .slice(0, 14)) {
    const summe = ks.reduce((x, k) => x + k.laenge, 0);
    const laengste = Math.max(...ks.map((k) => k.laenge));
    console.log(`  ${s.padEnd(30)} ${String(ks.length).padStart(4)}   ${laengste.toFixed(1).padStart(6)} m   ${summe.toFixed(0).padStart(6)} m`);
  }

  console.log('\nDie 30 längsten:');
  for (const k of [...alle].sort((a, b) => b.laenge - a.laenge).slice(0, 30)) {
    console.log(
      `  ${k.laenge.toFixed(2).padStart(6)} m  d=${k.dicke.toFixed(2)}  ` +
        `(${k.x1.toFixed(1)},${k.y1.toFixed(1)})–(${k.x2.toFixed(1)},${k.y2.toFixed(1)})  ` +
        `${k.gefuellt ? 'F' : 'S'} ${k.farbe}`,
    );
  }
}
