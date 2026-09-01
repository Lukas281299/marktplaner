import type { PlanElement } from '../typen/modell';

/**
 * Die Bezeichnung eines Regals aus dem, was wirklich darin steht.
 *
 * Ein Wandregal heißt „Wandregal A1000 · T700 · H2200“, solange es aus
 * 1-m-Feldern besteht. Baut der Planer es auf 1,25 m um, hieß es bisher
 * weiter A1000 – die Bezeichnung kam aus der Vorlage und blieb stehen, auch
 * wenn vom Ursprung nichts mehr übrig war. Im Plan stand dann eine Angabe,
 * die man beim Bestellen abschreibt und die falsch ist.
 *
 * Deshalb wird sie abgeleitet statt gespeichert: aus den Feldern, der Tiefe
 * und der Höhe. Wer eigene Worte will, schreibt sie hin – dann bleibt seine
 * Fassung stehen und wird nicht mehr angefasst (`beschriftungAutomatisch`).
 */

/** Ein Achsmaß so, wie es im Plan steht: „A1250“. */
export function achsText(achsmass: number): string {
  return `A${Math.round(achsmass * 10)}`;
}

/**
 * Die Felder als Kurzschrift: „A1000“ oder „3× A1000 · 3× A1250“.
 *
 * Gleiche Maße werden gezählt und zusammengefasst, in der Reihenfolge, in
 * der sie im Regal stehen – so liest man es auch am Möbel ab. Leere Felder
 * zählen mit: Der Platz ist belegt, die Säule steht.
 */
export function felderKurz(breiten: number[]): string {
  if (breiten.length === 0) return '';

  const gruppen: { mass: number; anzahl: number }[] = [];
  for (const b of breiten) {
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && Math.abs(letzte.mass - b) < 0.05) letzte.anzahl++;
    else gruppen.push({ mass: b, anzahl: 1 });
  }

  // Ein einzelnes Feld braucht kein „1×“ davor.
  if (gruppen.length === 1 && gruppen[0].anzahl === 1) return achsText(gruppen[0].mass);
  return gruppen.map((g) => `${g.anzahl}× ${achsText(g.mass)}`).join(' · ');
}

/**
 * Der Teil des Namens vor den Maßen – „Wandregal“, „Gondel“, „Gondelzug“.
 *
 * Aus der vorhandenen Bezeichnung gelesen und nicht aus einer Liste: Die
 * Bibliothek benennt ihre Möbel selbst, und diese Namen sollen erhalten
 * bleiben, auch wenn später neue dazukommen.
 */
export function bauart(bezeichnung: string): string {
  // Alles bis zum ersten Maßteil: „A1000“, „T700“, „H2200“ oder „3× A…“.
  const treffer = bezeichnung.match(/^(.*?)\s*(?:\d+×\s*)?[ATH]\d/);
  const vorne = (treffer?.[1] ?? bezeichnung).replace(/[·\s]+$/, '').trim();
  return vorne || bezeichnung.trim();
}

/**
 * Die vollständige Bezeichnung eines Regals.
 *
 * `undefined`, wenn das Möbel keine Felder hat – dann gibt es nichts
 * abzuleiten, und die Bezeichnung bleibt, wie sie ist.
 */
export function bezeichnungFuer(element: PlanElement): string | undefined {
  // Nur was wirklich in Felder geteilt ist. `felderVon` baut für jedes Möbel
  // ein Ersatzfeld – bei einer Palette oder einer Kasse käme dabei ein
  // Achsmaß heraus, das es dort gar nicht gibt.
  const unten = element.felderUnten ?? [];
  const oben = element.felderOben ?? [];
  const breiten = (unten.length > 0 ? unten : oben).map((f) => f.breite).filter((b) => b > 0);
  if (breiten.length === 0) return undefined;

  // Bauart und Maß stehen ohne Trenner nebeneinander – „Wandregal A1250“ –,
  // so wie die Bibliothek ihre Möbel benennt. Erst danach trennen Punkte.
  const kopf = [bauart(element.beschriftung || element.name), felderKurz(breiten)]
    .filter(Boolean)
    .join(' ');

  // Tiefe und Höhe wie in der Bibliothek: in Millimetern, bei beidseitigen
  // Möbeln als „T2×700“ – dort ist die Zahl je Seite gemeint.
  const tiefeMm = Math.round((element.beidseitig ? element.tiefe / 2 : element.tiefe) * 10);
  const teile = [kopf, element.beidseitig ? `T2×${tiefeMm}` : `T${tiefeMm}`];
  if (element.hoehe && element.hoehe > 0) teile.push(`H${Math.round(element.hoehe * 10)}`);

  return teile.filter(Boolean).join(' · ');
}
