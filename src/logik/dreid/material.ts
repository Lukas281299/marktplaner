import type { Materialname } from './bauteile';

/**
 * Die Farbpalette der 3D-Ansicht.
 *
 * Ein Dutzend Töne, aus den Katalogen abgelesen: Wanzl-Regale in hellem
 * Pulvergrau (die Marktfotos im wire-tech-Workbook, S. 24/48), Vitable und
 * Kühlmöbel in Schwarz Metallic beziehungsweise Anthrazitgrau RAL 7016, die
 * BakeOff-Türme in Tiefschwarz mit Eichenfront, Edelstahl und Chrom als
 * kühle Metalle, Glas durchsichtig.
 *
 * `metall` und `rauheit` sind Werte zwischen 0 und 1, wie three.js sie für
 * ein physikalisch angelehntes Material erwartet: Metall spiegelt, rauhe
 * Flächen streuen. `deckung` unter 1 macht das Teil durchsichtig.
 */
export interface Materialbeschreibung {
  farbe: string;
  metall: number;
  rauheit: number;
  deckung?: number;
}

export const MATERIAL: Record<Materialname, Materialbeschreibung> = {
  regal: { farbe: '#c9c6bf', metall: 0.35, rauheit: 0.55 },
  regalDunkel: { farbe: '#3a3e42', metall: 0.45, rauheit: 0.5 },
  gitter: { farbe: '#b4b1aa', metall: 0.4, rauheit: 0.5, deckung: 0.55 },
  draht: { farbe: '#bdbab3', metall: 0.45, rauheit: 0.45 },
  chrom: { farbe: '#d4d8dc', metall: 0.9, rauheit: 0.2 },
  edelstahl: { farbe: '#c8cacc', metall: 0.8, rauheit: 0.3 },
  schwarz: { farbe: '#141516', metall: 0.2, rauheit: 0.6 },
  anthrazit: { farbe: '#383e42', metall: 0.3, rauheit: 0.5 },
  weiss: { farbe: '#f1f1ee', metall: 0.05, rauheit: 0.7 },
  hellgrau: { farbe: '#a9adb0', metall: 0.3, rauheit: 0.5 },
  glas: { farbe: '#cfe3ea', metall: 0.1, rauheit: 0.05, deckung: 0.32 },
  holzHell: { farbe: '#c8a87c', metall: 0, rauheit: 0.8 },
  holzDunkel: { farbe: '#4a3a2e', metall: 0, rauheit: 0.8 },
  preisschiene: { farbe: '#f6f6f2', metall: 0, rauheit: 0.4, deckung: 0.85 },
  kiste: { farbe: '#3d8b3d', metall: 0, rauheit: 0.75 },
  kisteRot: { farbe: '#b9362c', metall: 0, rauheit: 0.75 },
  palette: { farbe: '#b08a58', metall: 0, rauheit: 0.9 },
  pflanze: { farbe: '#3f7d34', metall: 0, rauheit: 0.9 },
  blume: { farbe: '#d24a6a', metall: 0, rauheit: 0.9 },
  wand: { farbe: '#e9e6df', metall: 0, rauheit: 0.9 },
  boden: { farbe: '#d9d5cc', metall: 0, rauheit: 0.95 },
  bodenLager: { farbe: '#c4c0b8', metall: 0, rauheit: 0.95 },
  markierung: { farbe: '#e6d24a', metall: 0, rauheit: 0.9, deckung: 0.7 },
  ware: { farbe: '#d6cbb8', metall: 0, rauheit: 0.85 },
  kategorie: { farbe: '#9aa0a6', metall: 0.1, rauheit: 0.7 },
};

/**
 * Die Farbe eines Möbels, das kein eigenes Rezept hat.
 *
 * Es bekommt seine Kategoriefarbe aus dem Plan – dieselbe wie im Grundriss,
 * damit man es wiedererkennt –, leicht abgedunkelt, weil ein Klotz in
 * Pastell wie ein Spielzeug aussieht.
 */
export function abgedunkelt(hex: string, anteil = 0.82): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * anteil);
  const g = Math.round(((n >> 8) & 255) * anteil);
  const b = Math.round((n & 255) * anteil);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
