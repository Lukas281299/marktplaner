/**
 * Einen Ladenplan als PNG zeichnen, damit ich ihn ansehen kann.
 *
 * Aus Koordinatenlisten ist nicht zu erkennen, was Wand ist und was Regal –
 * beides sind lange, schmale Rechtecke. Auf dem Bild ist es eine Sekunde.
 * Gezeichnet wird aus denselben Zügen, aus denen später die Wandkörper
 * werden, im selben Maßstab: Was hier am Raster abgelesen wird, gilt
 * unverändert im Projekt.
 *
 *   node werkzeuge/plan-nach-bild.mjs <plan.pdf> <bild.png> [px/m] [von-bis]
 *
 * Das vierte Feld blendet auf ein Dickenband ein – `0.2-0.28` zeigt allein
 * die 24er-Wände. So lässt sich eine Auswahl prüfen, bevor sie ins Projekt
 * geschrieben wird.
 *
 * Die Bilder gehören in den Kladdeordner und nie ins Repository: Sie sind
 * die Grundrisse unserer Märkte.
 */
import { writeFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import { planZuege } from './plan-nach-svg';

interface Zug {
  punkte: { x: number; y: number }[];
  gefuellt: boolean;
  farbe: string;
}

/** Umriss eines Zuges, ohne `Math.min(...)` – dafür sind es zu viele Punkte. */
function grenzen(punkte: { x: number; y: number }[]) {
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  for (const p of punkte) {
    if (p.x < x1) x1 = p.x;
    if (p.x > x2) x2 = p.x;
    if (p.y < y1) y1 = p.y;
    if (p.y > y2) y2 = p.y;
  }
  return { x1, x2, y1, y2, breite: x2 - x1, hoehe: y2 - y1 };
}

export function zeichne(zuege: Zug[], jePx = 22, band?: [number, number]) {
  const gewaehlt = band
    ? zuege.filter((z) => {
        const g = grenzen(z.punkte);
        const dicke = Math.min(g.breite, g.hoehe);
        const laenge = Math.max(g.breite, g.hoehe);
        return laenge >= 1 && dicke >= band[0] && dicke <= band[1];
      })
    : zuege;

  let mx = Infinity, Mx = -Infinity, my = Infinity, My = -Infinity;
  for (const z of gewaehlt) {
    const g = grenzen(z.punkte);
    if (g.x1 < mx) mx = g.x1;
    if (g.x2 > Mx) Mx = g.x2;
    if (g.y1 < my) my = g.y1;
    if (g.y2 > My) My = g.y2;
  }
  if (!Number.isFinite(mx)) throw new Error('Nichts zu zeichnen');

  const minx = Math.floor(mx - 1);
  const miny = Math.floor(my - 1);
  const breite = Math.ceil(Mx + 1) - minx;
  const hoehe = Math.ceil(My + 1) - miny;

  const leinwand = createCanvas(Math.round(breite * jePx), Math.round(hoehe * jePx));
  const ctx = leinwand.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, leinwand.width, leinwand.height);

  // Meter in Bildpunkte.
  ctx.translate(-minx * jePx, -miny * jePx);
  ctx.scale(jePx, jePx);

  // Raster alle fünf Meter, beschriftet. Ohne das ist ein Bild nur ein Bild;
  // damit ist es ein Maßstab.
  ctx.lineWidth = 0.03;
  ctx.strokeStyle = '#a9ccff';
  for (let x = Math.ceil(minx / 5) * 5; x <= minx + breite; x += 5) {
    ctx.beginPath();
    ctx.moveTo(x, miny);
    ctx.lineTo(x, miny + hoehe);
    ctx.stroke();
  }
  for (let y = Math.ceil(miny / 5) * 5; y <= miny + hoehe; y += 5) {
    ctx.beginPath();
    ctx.moveTo(minx, y);
    ctx.lineTo(minx + breite, y);
    ctx.stroke();
  }

  for (const z of gewaehlt) {
    ctx.beginPath();
    z.punkte.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (z.gefuellt) {
      ctx.closePath();
      ctx.fillStyle = z.farbe;
      ctx.fill();
    } else {
      ctx.lineWidth = 0.04;
      ctx.strokeStyle = z.farbe;
      ctx.stroke();
    }
  }

  // Die Beschriftung zuletzt, damit sie über den Möbeln liegt.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '600 13px sans-serif';
  ctx.fillStyle = '#1552a8';
  for (let x = Math.ceil(minx / 5) * 5; x <= minx + breite; x += 5) {
    ctx.fillText(String(x), (x - minx) * jePx + 2, 14);
  }
  for (let y = Math.ceil(miny / 5) * 5; y <= miny + hoehe; y += 5) {
    ctx.fillText(String(y), 2, (y - miny) * jePx - 3);
  }

  return leinwand;
}

/* --------------------------------------------------------- Befehlszeile */

if ((process.argv[1] ?? '').endsWith('plan-nach-bild.mjs') && process.argv[2] && process.argv[3]) {
  const zuege = await planZuege(process.argv[2], 100);
  const band = process.argv[5]
    ? (process.argv[5].split('-').map(Number) as [number, number])
    : undefined;
  const leinwand = zeichne(zuege, Number(process.argv[4]) || 22, band);
  await writeFile(process.argv[3], leinwand.toBuffer('image/png'));
  console.log(`${zuege.length} Züge, ${leinwand.width}x${leinwand.height} px -> ${process.argv[3]}`);
}
