import type { Vektorform, Vektortext } from './planvektor';

/**
 * Übersetzt die Formen und Texte eines Plans in PDF-Befehle.
 *
 * PDF und SVG bekommen **denselben** Pfad – der `Pfadschreiber` gibt Bögen
 * schon als Bézierkurven aus, und die kennen beide. Es gibt also keine zweite
 * Fassung der Zeichnung, die auseinanderlaufen könnte.
 *
 * Drei Dinge sind in PDF anders als in SVG und stehen deshalb hier:
 *
 * 1. **Der Nullpunkt liegt unten links** und die y-Achse zeigt nach oben. Ein
 *    Plan ist andersherum gedacht. Statt jede Koordinate umzurechnen, wird
 *    einmal gespiegelt – dann stimmen alle.
 * 2. **Farben sind Zahlen von 0 bis 1**, kein `#rrggbb`.
 * 3. **Durchsichtigkeit ist keine Eigenschaft der Farbe**, sondern ein
 *    eigener Zustand, der oben im Dokument angemeldet werden muss.
 */

/** Eine Farbe als die drei Zahlen, die PDF erwartet. */
export function pdfFarbe(farbe: string): [number, number, number] | null {
  const wert = farbe.trim().toLowerCase();
  if (!wert || wert === 'none' || wert === 'transparent') return null;

  const kurz = wert.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (kurz) {
    return [1, 2, 3].map((i) => parseInt(kurz[i] + kurz[i], 16) / 255) as [number, number, number];
  }
  const lang = wert.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (lang) {
    return [1, 2, 3].map((i) => parseInt(lang[i], 16) / 255) as [number, number, number];
  }
  const rgb = wert.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const teile = rgb[1].split(',').map((t) => parseFloat(t));
    if (teile.length >= 3 && teile.every((t) => Number.isFinite(t))) {
      return [teile[0] / 255, teile[1] / 255, teile[2] / 255];
    }
  }
  return null;
}

/** Die Durchsichtigkeit, die in einer `rgba`-Farbe steckt. */
export function pdfDeckkraft(farbe: string | undefined): number {
  if (!farbe) return 1;
  const rgb = farbe.trim().match(/^rgba\(([^)]+)\)$/i);
  if (!rgb) return 1;
  const teile = rgb[1].split(',').map((t) => parseFloat(t));
  return teile.length >= 4 && Number.isFinite(teile[3]) ? teile[3] : 1;
}

function n(wert: number): string {
  return (Math.round(wert * 1000) / 1000).toString();
}

/**
 * Wandelt einen SVG-Pfad in PDF-Befehle.
 *
 * Es sind nur vier: `m` (hin), `l` (Strecke), `c` (Kurve), `h` (schließen) –
 * genau die vier, die der `Pfadschreiber` erzeugt. Ein Bogenbefehl käme hier
 * nie an, weil er schon dort in Kurven zerlegt wurde.
 */
export function pfadZuPdf(d: string): string {
  const zeichen = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  const aus: string[] = [];
  let i = 0;
  const zahl = () => Number(zeichen[i++]);

  while (i < zeichen.length) {
    const befehl = zeichen[i++];
    switch (befehl) {
      case 'M': {
        const x = zahl();
        const y = zahl();
        aus.push(`${n(x)} ${n(y)} m`);
        break;
      }
      case 'L': {
        const x = zahl();
        const y = zahl();
        aus.push(`${n(x)} ${n(y)} l`);
        break;
      }
      case 'C': {
        const werte = [zahl(), zahl(), zahl(), zahl(), zahl(), zahl()];
        aus.push(`${werte.map(n).join(' ')} c`);
        break;
      }
      case 'Z':
        aus.push('h');
        break;
      default:
        // Eine Zahl ohne Befehl davor – das kann nur ein Fehler sein, und
        // stillschweigend weiterzumachen wäre schlimmer als sie zu übergehen.
        break;
    }
  }
  return aus.join('\n');
}

/**
 * Eine Umformung aus dem SVG als PDF-Matrix.
 *
 * Unterstützt genau das, was `planvektor.ts` erzeugt: verschieben und um
 * einen Punkt drehen. Mehr braucht ein Plan nicht, und mehr zu unterstützen
 * hieße, einen SVG-Deuter zu schreiben, den niemand prüft.
 */
export function umformungZuPdf(umformung: string | undefined): string | null {
  if (!umformung) return null;
  const schieben = umformung.match(/translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/);
  const drehen = umformung.match(/rotate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/);
  const teile: string[] = [];
  if (schieben) teile.push(`1 0 0 1 ${n(Number(schieben[1]))} ${n(Number(schieben[2]))} cm`);
  if (drehen) {
    const grad = Number(drehen[1]);
    const cx = Number(drehen[2]);
    const cy = Number(drehen[3]);
    const w = (grad * Math.PI) / 180;
    const cos = Math.cos(w);
    const sin = Math.sin(w);
    // Um einen Punkt drehen heißt: hin, drehen, zurück.
    teile.push(`1 0 0 1 ${n(cx)} ${n(cy)} cm`);
    teile.push(`${n(cos)} ${n(sin)} ${n(-sin)} ${n(cos)} 0 0 cm`);
    teile.push(`1 0 0 1 ${n(-cx)} ${n(-cy)} cm`);
  }
  return teile.length > 0 ? teile.join('\n') : null;
}

/**
 * Die Durchsichtigkeitsstufen, die im Dokument angemeldet werden müssen.
 *
 * PDF kann Durchsichtigkeit nicht an der Farbe festmachen; sie ist ein
 * eigener Zustand mit eigenem Namen. Deshalb werden erst alle vorkommenden
 * Stufen gesammelt, dann bekommt jede einen Namen, und im Inhalt steht nur
 * noch der Name.
 */
export function deckkraftstufen(formen: Vektorform[]): number[] {
  const stufen = new Set<number>();
  for (const f of formen) {
    const ausFarbe = Math.min(pdfDeckkraft(f.fuellung), pdfDeckkraft(f.linie));
    const gesamt = (f.deckkraft ?? 1) * ausFarbe;
    if (gesamt < 0.999) stufen.add(Math.round(gesamt * 100) / 100);
  }
  return [...stufen].sort((a, b) => a - b);
}

/** Die Zeichenbreiten von Helvetica, in Tausendstel der Schrifthöhe. */
const HELVETICA_BREITEN: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722,
  I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
};

/**
 * Wie breit ein Text in Helvetica wirklich wird.
 *
 * Über die Zeichenzahl zu schätzen geht daneben, sobald der Text kurz ist:
 * Ein „I" ist ein Viertel so breit wie ein „W". Bei einer mittig gesetzten
 * Beschriftung säße der Text dann sichtbar schief unter dem Möbel.
 */
export function textbreite(text: string, groesse: number): number {
  let tausendstel = 0;
  for (const zeichen of text) {
    // Umlaute und alles Unbekannte: die Breite eines mittleren Buchstabens.
    tausendstel += HELVETICA_BREITEN[zeichen] ?? 556;
  }
  return (tausendstel / 1000) * groesse;
}

/** Wandelt einen Text in die Schreibweise, die PDF in Klammern erwartet. */
function pdfZeichenkette(text: string): string {
  return text.replace(/[\\()]/g, (z) => `\\${z}`);
}

/**
 * Ein Text als PDF-Befehle.
 *
 * Die y-Achse ist im Dokument schon gespiegelt, damit die Formen stimmen.
 * Schrift darf davon aber nichts mitbekommen – sonst stünde sie auf dem Kopf.
 * Deshalb bekommt jeder Text eine eigene Matrix, die die Spiegelung wieder
 * aufhebt und dabei gleich die Drehung mitnimmt.
 */
export function textZuPdf(t: Vektortext, schriftname = 'Helv'): string {
  const w = ((t.drehung ?? 0) * Math.PI) / 180;
  const cos = Math.cos(w);
  const sin = Math.sin(w);
  const breite = textbreite(t.text, t.groesse);
  // Waagerecht mittig, senkrecht auf die Mitte der Versalhöhe.
  const dx = t.anker === 'anfang' ? 0 : -breite / 2;
  const dy = -t.groesse * 0.36;

  const [r, g, b] = pdfFarbe(t.farbe ?? '#26313d') ?? [0.15, 0.19, 0.24];
  // Die Matrix dreht **und** spiegelt y zurück: a b c d e f Tm.
  const a = cos;
  const bb = sin;
  const c = sin;
  const d = -cos;
  const e = t.x + dx * cos - dy * sin;
  const f = t.y + dx * sin + dy * cos;
  return [
    'BT',
    `${n(r)} ${n(g)} ${n(b)} rg`,
    `/${schriftname} ${n(t.groesse)} Tf`,
    `${n(a)} ${n(bb)} ${n(c)} ${n(d)} ${n(e)} ${n(f)} Tm`,
    `(${pdfZeichenkette(t.text)}) Tj`,
    'ET',
  ].join('\n');
}

/**
 * Eine Form als PDF-Befehle.
 *
 * `strichCm` ist die Breite in Zentimetern des Marktes; bei den Konturen
 * kommt sie aus `strichMm` und dem Maßstab. Beides ist beim Aufruf schon
 * ausgerechnet – hier steht nur noch, was gemalt wird.
 */
export function formZuPdf(
  f: Vektorform,
  strichbreiteCm: number,
  deckkraftname?: string,
): string {
  const fuellung = f.fuellung ? pdfFarbe(f.fuellung) : null;
  const linie = f.linie ? pdfFarbe(f.linie) : null;
  if (!fuellung && !linie) return '';

  const zeilen: string[] = ['q'];
  if (deckkraftname) zeilen.push(`/${deckkraftname} gs`);
  const umformung = umformungZuPdf(f.umformung);
  if (umformung) zeilen.push(umformung);
  if (fuellung) zeilen.push(`${fuellung.map(n).join(' ')} rg`);
  if (linie) {
    zeilen.push(`${linie.map(n).join(' ')} RG`);
    zeilen.push(`${n(strichbreiteCm)} w`);
    zeilen.push('1 j');
  }
  zeilen.push(pfadZuPdf(f.d));
  // f = füllen, S = strichen, B = beides. Gefüllt wird nach der
  // Nichtnull-Regel, wie auf der Leinwand – daran hängen die Löcher.
  zeilen.push(fuellung && linie ? 'B' : fuellung ? 'f' : 'S');
  zeilen.push('Q');
  return zeilen.join('\n');
}
