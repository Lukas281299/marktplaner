/**
 * Aus einem Ladenplan die Wände herauslösen – mit Kontrollbild.
 *
 * Der schwierige Teil ist nicht das Messen, sondern das Unterscheiden: Eine
 * Wand und ein Regal sind beide lange, schmale Rechtecke. Getrennt werden sie
 * an der Farbe und der Dicke, und jeder Plan macht das anders. Deshalb ist
 * die Auswahl hier ein Wert und keine Regel im Code – sie wird pro Plan
 * eingestellt und **angesehen**, bevor sie ins Projekt geht.
 *
 * Das Kontrollbild ist der Kern des Werkzeugs. Eine Wandliste, die niemand
 * gesehen hat, ist eine Behauptung.
 *
 *   node werkzeuge/plan-waende.mjs <plan.pdf> <bild.png> [waende.json]
 *
 * Die Einstellung je Plan steht in `plan-einstellungen.json` daneben.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { planZuege } from './plan-nach-svg';

export interface Balken {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  laenge: number;
  dicke: number;
  waagerecht: boolean;
  farbe: string;
}

export interface Auswahl {
  /** Welche Füllfarben Wand sind. Leer heißt: alle. */
  farben?: string[];
  /** Dünnste und dickste Wand, in Metern. */
  dicke: [number, number];
  /** Kürzestes Wandstück, in Metern. */
  minLaenge: number;
  /** Nur was in diesem Fenster liegt – hält Legenden und Tabellen draußen. */
  fenster?: { x1: number; y1: number; x2: number; y2: number };
  /** Auch ungefüllte Züge annehmen. Manche Pläne zeichnen Wände als Umriss. */
  auchStriche?: boolean;
  /**
   * Wände aus Strichpaaren bilden.
   *
   * Manche Pläne füllen gar nichts – eine Wand ist dort zwei parallele
   * Linien im richtigen Abstand, dazwischen eine Schraffur. Manche Pläne
   * sind ganz so gezeichnet, andere zur Hälfte.
   */
  strichpaare?: boolean;
  /**
   * Lange Einzelstriche als Wand übernehmen, ab dieser Länge in Metern.
   *
   * Manche Pläne zeichnen die Außenkontur als einfache Linie ohne Partner –
   * dort *ist* der Strich die Wand. Sie bekommt dann die Stärke, die die
   * übrigen Wände des Plans haben (`strichstaerke`).
   *
   * Die Schwelle muss hoch sein: Unterhalb von fünf Metern besteht ein Plan
   * fast nur aus Maßhilfslinien und Achsen.
   */
  einzelstriche?: number;
  /** Welche Stärke ein Einzelstrich bekommt. Standard 24 cm. */
  strichstaerke?: number;
  /**
   * Bereiche, in denen nichts Wand ist.
   *
   * Für die Achsen und Maßhilfslinien, die quer durch das Gebäude laufen und
   * sich von einer Wand weder durch Farbe noch durch Länge unterscheiden.
   * Ein Mensch sieht auf einen Blick, dass die Linie mitten durch den Markt
   * keine Wand ist; eine Regel dafür gibt es nicht.
   */
  ohne?: { x1: number; y1: number; x2: number; y2: number }[];
}

/**
 * Einstellung je Plan - geladen aus `plan-einstellungen.json`.
 *
 * Die Datei liegt daneben und ist gesperrt: Marktnamen und Gebaeudemasse
 * gehoeren nicht in ein oeffentliches Repository. Das Werkzeug ist
 * allgemein, die Werte sind es nicht.
 *
 * Aufbau, am Beispiel eines Plans mit gefuellten 24er-Waenden in Dunkelgrau:
 *
 *   {
 *     "Musterstadt 2024.pdf": {
 *       "farben": ["#545454"],       // Fuellfarben, die Wand sind
 *       "dicke": [0.21, 0.28],       // Wandstaerke von-bis, in Metern
 *       "minLaenge": 0.6,            // kuerzestes Wandstueck
 *       "fenster": { "x1": 0, "y1": 10, "x2": 70, "y2": 48 },
 *       "strichpaare": true,         // Waende auch als Linienpaar erkennen
 *       "einzelstriche": 5,          // lange Einzellinien als Wand ab ... m
 *       "ohne": [{ "x1": 4, "y1": 33.6, "x2": 57, "y2": 34 }]  // Achsen
 *     }
 *   }
 *
 * In allen bisherigen Plaenen sind die Waende 24 bis 25 cm stark, Regale
 * dagegen 30 bis 45 cm tief. Das enge Dickenband trennt beides sauber - und
 * zwar in jedem Plan mit derselben Zahl. Was sich von Plan zu Plan
 * unterscheidet, ist nur die Machart: gefuellter Balken oder Strichpaar,
 * und in welcher Farbe.
 */
export const PLAENE: Record<string, Auswahl> = await (async () => {
  try {
    const roh = await readFile(new URL('plan-einstellungen.json', import.meta.url), 'utf8');
    return JSON.parse(roh) as Record<string, Auswahl>;
  } catch {
    // Ohne Datei laesst sich kein Plan lesen - die Meldung kommt beim Aufruf.
    return {};
  }
})();

function umriss(punkte: { x: number; y: number }[]) {
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  for (const p of punkte) {
    if (p.x < x1) x1 = p.x;
    if (p.x > x2) x2 = p.x;
    if (p.y < y1) y1 = p.y;
    if (p.y > y2) y2 = p.y;
  }
  return { x1, x2, y1, y2 };
}

/**
 * Wände als Paare paralleler Linien.
 *
 * Zwei Striche gehören zusammen, wenn sie dieselbe Richtung haben, ihr
 * Abstand im Dickenband liegt und sie sich über eine nennenswerte Strecke
 * überdecken. Was dabei herauskommt, ist genau die Wand zwischen ihnen.
 *
 * Regale fallen von selbst heraus: Sie sind 60 bis 90 cm tief und damit zu
 * dick für ein Wandband, das bei 40 cm endet.
 */
function ausStrichpaaren(
  zuege: { punkte: { x: number; y: number }[]; gefuellt: boolean; farbe: string }[],
  wahl: Auswahl,
): Balken[] {
  const TOLERANZ = 0.02;

  // Erst alle geraden Stücke einsammeln – ein Zug kann mehrere enthalten.
  const waagerecht: { lage: number; von: number; bis: number; farbe: string }[] = [];
  const senkrecht: { lage: number; von: number; bis: number; farbe: string }[] = [];
  for (const z of zuege) {
    if (wahl.farben && wahl.farben.length > 0 && !wahl.farben.includes(z.farbe)) continue;
    for (let i = 1; i < z.punkte.length; i++) {
      const a = z.punkte[i - 1];
      const b = z.punkte[i];
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      if (dy <= TOLERANZ && dx >= wahl.minLaenge) {
        waagerecht.push({ lage: (a.y + b.y) / 2, von: Math.min(a.x, b.x), bis: Math.max(a.x, b.x), farbe: z.farbe });
      } else if (dx <= TOLERANZ && dy >= wahl.minLaenge) {
        senkrecht.push({ lage: (a.x + b.x) / 2, von: Math.min(a.y, b.y), bis: Math.max(a.y, b.y), farbe: z.farbe });
      }
    }
  }

  const balken: Balken[] = [];
  const paare = (
    striche: { lage: number; von: number; bis: number; farbe: string }[],
    quer: boolean,
  ) => {
    // Nach Lage sortiert, dann muss jeder Strich nur mit den nächsten
    // verglichen werden statt mit allen.
    striche.sort((a, b) => a.lage - b.lage);
    for (let i = 0; i < striche.length; i++) {
      for (let j = i + 1; j < striche.length; j++) {
        const abstand = striche[j].lage - striche[i].lage;
        if (abstand > wahl.dicke[1]) break;
        if (abstand < wahl.dicke[0]) continue;
        const von = Math.max(striche[i].von, striche[j].von);
        const bis = Math.min(striche[i].bis, striche[j].bis);
        if (bis - von < wahl.minLaenge) continue;
        balken.push(
          quer
            ? { x1: von, y1: striche[i].lage, x2: bis, y2: striche[j].lage,
                laenge: bis - von, dicke: abstand, waagerecht: true, farbe: striche[i].farbe }
            : { x1: striche[i].lage, y1: von, x2: striche[j].lage, y2: bis,
                laenge: bis - von, dicke: abstand, waagerecht: false, farbe: striche[i].farbe },
        );
      }
    }
  };
  paare(waagerecht, true);
  paare(senkrecht, false);

  // Und die langen Einzelnen, wo der Strich selbst die Wand ist.
  if (wahl.einzelstriche) {
    const d = wahl.strichstaerke ?? 0.24;
    for (const w of waagerecht) {
      if (w.bis - w.von < wahl.einzelstriche) continue;
      balken.push({ x1: w.von, y1: w.lage - d / 2, x2: w.bis, y2: w.lage + d / 2,
        laenge: w.bis - w.von, dicke: d, waagerecht: true, farbe: w.farbe });
    }
    for (const w of senkrecht) {
      if (w.bis - w.von < wahl.einzelstriche) continue;
      balken.push({ x1: w.lage - d / 2, y1: w.von, x2: w.lage + d / 2, y2: w.bis,
        laenge: w.bis - w.von, dicke: d, waagerecht: false, farbe: w.farbe });
    }
  }
  return balken;
}

export async function waende(pfad: string, wahl: Auswahl): Promise<Balken[]> {
  const zuege = await planZuege(pfad, 100);
  const roh: Balken[] = [];

  for (const z of zuege) {
    if (!z.gefuellt && !wahl.auchStriche) continue;
    if (wahl.farben && wahl.farben.length > 0 && !wahl.farben.includes(z.farbe)) continue;

    const u = umriss(z.punkte);
    const b = u.x2 - u.x1;
    const h = u.y2 - u.y1;
    const laenge = Math.max(b, h);
    const dicke = Math.min(b, h);
    if (laenge < wahl.minLaenge) continue;
    if (dicke < wahl.dicke[0] || dicke > wahl.dicke[1]) continue;

    const f = wahl.fenster;
    if (f && (u.x1 < f.x1 || u.x2 > f.x2 || u.y1 < f.y1 || u.y2 > f.y2)) continue;

    roh.push({
      x1: +u.x1.toFixed(3), y1: +u.y1.toFixed(3),
      x2: +u.x2.toFixed(3), y2: +u.y2.toFixed(3),
      laenge: +laenge.toFixed(3), dicke: +dicke.toFixed(3),
      waagerecht: b >= h, farbe: z.farbe,
    });
  }

  if (wahl.strichpaare) {
    // Das Fenster gilt auch hier – sonst wandern die Linien der Stücklisten
    // und Schriftfelder am Blattrand als Wände in den Plan.
    for (const b of ausStrichpaaren(zuege, wahl)) {
      const f = wahl.fenster;
      if (f && (b.x1 < f.x1 || b.x2 > f.x2 || b.y1 < f.y1 || b.y2 > f.y2)) continue;
      roh.push({
        x1: +b.x1.toFixed(3), y1: +b.y1.toFixed(3),
        x2: +b.x2.toFixed(3), y2: +b.y2.toFixed(3),
        laenge: +b.laenge.toFixed(3), dicke: +b.dicke.toFixed(3),
        waagerecht: b.waagerecht, farbe: b.farbe,
      });
    }
  }

  // Ein Balken wird oft zweimal gezeichnet – einmal gefüllt, einmal umrandet,
  // manchmal noch in einer zweiten Ebene. Doppelte fallen weg, sonst stünden
  // in der Wandliste drei Wände an derselben Stelle.
  const gesehen = new Set<string>();
  const einmal: Balken[] = [];
  for (const b of roh) {
    if (wahl.ohne?.some((o) => b.x1 >= o.x1 && b.x2 <= o.x2 && b.y1 >= o.y1 && b.y2 <= o.y2)) continue;
    const schluessel = [b.x1, b.y1, b.x2, b.y2].map((v) => Math.round(v * 20)).join(':');
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    einmal.push(b);
  }
  return einmal;
}

/** Die Wände als Bild, über dem blassen Rest des Plans zur Kontrolle. */
export function kontrollbild(
  gewaehlt: Balken[],
  alleZuege: { punkte: { x: number; y: number }[]; gefuellt: boolean; farbe: string }[],
  jePx = 20,
) {
  let mx = Infinity, Mx = -Infinity, my = Infinity, My = -Infinity;
  for (const b of gewaehlt) {
    if (b.x1 < mx) mx = b.x1;
    if (b.x2 > Mx) Mx = b.x2;
    if (b.y1 < my) my = b.y1;
    if (b.y2 > My) My = b.y2;
  }
  if (!Number.isFinite(mx)) throw new Error('Keine Wand gefunden');

  const minx = Math.floor(mx - 2);
  const miny = Math.floor(my - 2);
  const breite = Math.ceil(Mx + 2) - minx;
  const hoehe = Math.ceil(My + 2) - miny;

  const leinwand = createCanvas(Math.round(breite * jePx), Math.round(hoehe * jePx));
  const ctx = leinwand.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, leinwand.width, leinwand.height);
  ctx.translate(-minx * jePx, -miny * jePx);
  ctx.scale(jePx, jePx);

  // Der ganze Plan, blass – damit zu sehen ist, was die Auswahl übergeht.
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 0.03;
  for (const z of alleZuege) {
    ctx.beginPath();
    z.punkte.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = '#334155';
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#a9ccff';
  ctx.lineWidth = 0.03;
  for (let x = Math.ceil(minx / 5) * 5; x <= minx + breite; x += 5) {
    ctx.beginPath(); ctx.moveTo(x, miny); ctx.lineTo(x, miny + hoehe); ctx.stroke();
  }
  for (let y = Math.ceil(miny / 5) * 5; y <= miny + hoehe; y += 5) {
    ctx.beginPath(); ctx.moveTo(minx, y); ctx.lineTo(minx + breite, y); ctx.stroke();
  }

  // Und darüber die Wände, kräftig.
  ctx.fillStyle = '#c2410c';
  for (const b of gewaehlt) ctx.fillRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);

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

if ((process.argv[1] ?? '').endsWith('plan-waende.mjs') && process.argv[2]) {
  const pfad = process.argv[2];
  const wahl = PLAENE[basename(pfad)];
  if (!wahl) {
    console.error(`Keine Einstellung für ${basename(pfad)} – siehe plan-einstellungen.json.`);
    process.exit(1);
  }
  const gewaehlt = await waende(pfad, wahl);
  const summe = gewaehlt.reduce((s, b) => s + b.laenge, 0);
  console.log(`${gewaehlt.length} Wandstücke, zusammen ${summe.toFixed(0)} m`);

  if (process.env.LISTE) {
    const senk = gewaehlt.filter((b) => !b.waagerecht).sort((a, b) => b.laenge - a.laenge);
    const waag = gewaehlt.filter((b) => b.waagerecht).sort((a, b) => b.laenge - a.laenge);
    const zeige = (t: string, bs: Balken[]) => {
      console.log(`
${t}`);
      for (const b of bs.slice(0, Number(process.env.LISTE) || 30)) {
        console.log(
          `  L=${b.laenge.toFixed(2).padStart(6)} d=${b.dicke.toFixed(2)}  ` +
            `(${b.x1.toFixed(2)},${b.y1.toFixed(2)})-(${b.x2.toFixed(2)},${b.y2.toFixed(2)})  ${b.farbe}`,
        );
      }
    };
    zeige('Senkrecht:', senk);
    zeige('Waagerecht:', waag);
  }

  if (process.argv[3]) {
    const alle = await planZuege(pfad, 100);
    const bild = kontrollbild(gewaehlt, alle, 20);
    await writeFile(process.argv[3], bild.toBuffer('image/png'));
    console.log(`Kontrollbild: ${process.argv[3]} (${bild.width}x${bild.height})`);
  }
  if (process.argv[4]) {
    await writeFile(process.argv[4], JSON.stringify(gewaehlt, null, 2), 'utf8');
    console.log(`Wandliste: ${process.argv[4]}`);
  }
}
