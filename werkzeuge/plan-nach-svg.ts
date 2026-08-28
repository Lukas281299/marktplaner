/**
 * Einen Ladenplan als SVG nachzeichnen, in Metern, mit Raster.
 *
 * Damit ich den Plan **ansehen** kann, statt aus Koordinatenlisten zu raten.
 * Aus den Listen allein ist nicht zu erkennen, was Wand ist und was Regal:
 * Beides sind lange, schmale Rechtecke. Auf dem Bild ist es eine Sekunde.
 *
 * Das SVG trägt dieselben Koordinaten wie später das Projekt – ein Meter im
 * Plan ist ein Meter im SVG. Was ich hier abmesse, kann ich unverändert in
 * die Wandkörper schreiben. Das Raster alle fünf Meter ist die Kontrolle.
 *
 * Die Datei gehört in den Kladdeordner und nie ins Repository: Sie ist der
 * Grundriss eines Marktes.
 */
import { readFile, writeFile } from 'node:fs/promises';
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

interface Zug {
  punkte: { x: number; y: number }[];
  gefuellt: boolean;
  farbe: string;
}

export async function planZuege(pfad: string, massstab = 100): Promise<Zug[]> {
  const jeM = massstab / PT_JE_MM_BLATT / 1000;
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
  const zuege: Zug[] = [];

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
      const punkte: { x: number; y: number }[] = [];
      let n = 0;
      while (n < teil.length) {
        const code = teil[n++];
        let x: number, y: number;
        if (code === MOVE || code === LINE) { x = teil[n++]; y = teil[n++]; }
        else if (code === KURVE) { n += 4; x = teil[n++]; y = teil[n++]; }
        else break;
        const p = bilde(matrix, x, y);
        punkte.push({ x: +(p.x * jeM).toFixed(3), y: +((hoehePt - p.y) * jeM).toFixed(3) });
      }
      if (punkte.length >= 2) zuege.push({ punkte, gefuellt, farbe: gefuellt ? fuellfarbe : strichfarbe });
    }
  }
  return zuege;
}

/**
 * Aus den Zügen ein SVG bauen.
 *
 * `nurDicke` blendet alles aus, was nicht in einem Dickenband liegt – so
 * lässt sich prüfen, ob eine Auswahl wirklich die Wände trifft, bevor ich
 * sie ins Projekt schreibe.
 */
export function alsSvg(
  zuege: Zug[],
  wahl?: (z: Zug, laenge: number, dicke: number) => boolean,
): string {
  const gewaehlt = zuege.filter((z) => {
    if (!wahl) return true;
    let a = Infinity, b2 = -Infinity, c = Infinity, d = -Infinity;
    for (const p of z.punkte) {
      if (p.x < a) a = p.x;
      if (p.x > b2) b2 = p.x;
      if (p.y < c) c = p.y;
      if (p.y > d) d = p.y;
    }
    const b = b2 - a;
    const h = d - c;
    return wahl(z, Math.max(b, h), Math.min(b, h));
  });

  // Von Hand statt mit Math.min(...punkte): Ein Plan hat zweihunderttausend
  // Punkte, und so viele Aufrufparameter sprengen den Stapel.
  let mx = Infinity, Mx = -Infinity, my = Infinity, My = -Infinity;
  let anzahl = 0;
  for (const z of gewaehlt) {
    for (const p of z.punkte) {
      if (p.x < mx) mx = p.x;
      if (p.x > Mx) Mx = p.x;
      if (p.y < my) my = p.y;
      if (p.y > My) My = p.y;
      anzahl++;
    }
  }
  if (anzahl === 0) return '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
  const minx = Math.floor(mx - 1);
  const maxx = Math.ceil(Mx + 1);
  const miny = Math.floor(my - 1);
  const maxy = Math.ceil(My + 1);
  const b = maxx - minx;
  const h = maxy - miny;

  // Raster alle fünf Meter, beschriftet – die Kontrolle beim Abmessen.
  let raster = '';
  for (let x = Math.ceil(minx / 5) * 5; x <= maxx; x += 5) {
    raster += `<line x1="${x}" y1="${miny}" x2="${x}" y2="${maxy}" stroke="#9ec5fe" stroke-width="0.04"/>`;
    raster += `<text x="${x + 0.15}" y="${miny + 0.9}" font-size="0.7" fill="#1d6fd4">${x}</text>`;
  }
  for (let y = Math.ceil(miny / 5) * 5; y <= maxy; y += 5) {
    raster += `<line x1="${minx}" y1="${y}" x2="${maxx}" y2="${y}" stroke="#9ec5fe" stroke-width="0.04"/>`;
    raster += `<text x="${minx + 0.15}" y="${y - 0.2}" font-size="0.7" fill="#1d6fd4">${y}</text>`;
  }

  const koerper = gewaehlt
    .map((z) => {
      const d = z.punkte.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
      return z.gefuellt
        ? `<path d="${d} Z" fill="${z.farbe}" fill-opacity="0.85"/>`
        : `<path d="${d}" fill="none" stroke="${z.farbe}" stroke-width="0.05"/>`;
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minx} ${miny} ${b} ${h}" ` +
    `width="${Math.round(b * 22)}" height="${Math.round(h * 22)}">` +
    `<rect x="${minx}" y="${miny}" width="${b}" height="${h}" fill="#ffffff"/>` +
    raster +
    koerper +
    '</svg>'
  );
}

/* --------------------------------------------------------- Befehlszeile */

const direktGestartet = (process.argv[1] ?? '').endsWith('plan-nach-svg.mjs');

if (direktGestartet && process.argv[2] && process.argv[3]) {
  const zuege = await planZuege(process.argv[2], 100);
  // Vierter Wert: nur Züge, deren Dicke im Band liegt. "0.2-0.28" etwa
  // zeigt allein die 24er-Wände.
  const band = process.argv[4];
  const wahl = band
    ? (_z: Zug, laenge: number, dicke: number) => {
        const [von, bis] = band.split('-').map(Number);
        return laenge >= 1 && dicke >= von && dicke <= bis;
      }
    : undefined;
  await writeFile(process.argv[3], alsSvg(zuege, wahl), 'utf8');
  console.log(`${zuege.length} Züge -> ${process.argv[3]}`);
}
