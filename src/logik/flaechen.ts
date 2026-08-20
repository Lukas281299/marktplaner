import clipping from 'polygon-clipping';
import type { KategorieId, Projekt, Punkt, Raum, Raumart, Verkaufsflaeche } from '../typen/modell';
import { grundflaecheVon } from './geometrie';
import { flaeche, punktInnerhalb, umfang } from './polygon';

/**
 * Flächenberechnung.
 * Alle Werte in Quadratzentimetern – die Anzeige rechnet in m² um
 * (siehe `formatiereFlaeche`).
 */

/**
 * Welche Raumarten zählen zur Verkaufsfläche?
 *
 * Das ist im Ladenbau die Trennlinie, auf die es ankommt: Alles, was der Kunde
 * betritt, ist Verkaufsfläche; Lager, Kühlhaus, Sozial- und Technikräume sind
 * Nebenfläche. „Sonstige" zählt bewusst nicht mit – ein Raum, dessen Zweck
 * niemand angegeben hat, soll die Kennzahl nicht heimlich aufblähen.
 */
const VERKAUFSARTEN = new Set<Raumart>(['verkauf']);

export interface Raumflaeche {
  id: string;
  name: string;
  art: Raumart;
  flaeche: number;
  /** Zählt dieser Raum zur Verkaufsfläche? */
  verkauf: boolean;
}

export interface Teilflaeche {
  id: string;
  name: string;
  flaeche: number;
}

export interface Flaechenuebersicht {
  /** Außenmaß des Gebäudes, also der ganze Umriss. */
  brutto: number;
  /** Innenfläche ohne Außenwände. */
  netto: number;
  /** Summe aller abgetrennten Räume, die nicht zur Verkaufsfläche zählen. */
  nebenflaeche: number;
  /** Die Fläche, auf der verkauft wird – gezeichnet oder gerechnet. */
  verkaufsflaeche: number;
  /**
   * Ist die Verkaufsfläche eingezeichnet?
   *
   * Steht hier `true`, stammt der Wert aus den markierten Teilflächen und
   * nicht aus der Rechnung „Innenfläche minus Nebenräume". Die Oberfläche
   * sagt das dazu – eine Kennzahl, deren Herkunft man raten muss, ist keine.
   */
  verkaufsflaecheMarkiert: boolean;
  /** Jede markierte Teilfläche einzeln. Leer, wenn nichts markiert ist. */
  verkaufsflaechen: Teilflaeche[];
  /** Von Elementen belegte Fläche. */
  belegt: number;
  /**
   * Belegte Fläche, die innerhalb der Verkaufsfläche steht.
   *
   * Ohne Markierung ist das dasselbe wie `belegt`. Mit Markierung zählt nur,
   * was auch wirklich dort steht – sonst würde das Lagerregal die freie
   * Verkaufsfläche kleinrechnen.
   */
  belegtInVerkauf: number;
  /** Verkaufsfläche minus der Elemente, die darauf stehen. */
  frei: number;
  /** Belegte Fläche je Kategorie. */
  jeKategorie: { kategorie: KategorieId; flaeche: number }[];
  /** Jeder Raum einzeln. */
  raeume: Raumflaeche[];
}

/**
 * Gesamtfläche mehrerer Polygone – Überlappungen zählen nur einmal.
 *
 * Nötig, weil zwei markierte Teilflächen einander überlappen dürfen: Wer die
 * Fläche vor der Kasse und die Fläche im Gang einzeichnet, trifft sich in der
 * Ecke dazwischen. Ein simples Aufsummieren würde diese Ecke doppelt zählen,
 * und die Kennzahl wäre still zu groß.
 *
 * `vereinige` aus `polygon.ts` taugt dafür nicht: Die Funktion ist für den
 * Grundriss gebaut und behält nur das größte Stück. Hier zählen aber gerade
 * die getrennten Teile mit, und Löcher werden abgezogen.
 */
export function vereinigteFlaeche(polygone: Punkt[][]): number {
  const brauchbar = polygone.filter((p) => p.length >= 3);
  if (brauchbar.length === 0) return 0;

  const ringe = brauchbar.map((p) => [p.map((punkt): [number, number] => [punkt.x, punkt.y])]);
  const [erstes, ...weitere] = ringe;
  const vereinigt = clipping.union(erstes, ...weitere);

  let summe = 0;
  for (const teil of vereinigt) {
    teil.forEach((ring, index) => {
      const punkte = ring.map((paar) => ({ x: paar[0], y: paar[1] }));
      // Ring 0 ist der Außenrand, alles danach ist ein Loch.
      summe += index === 0 ? flaeche(punkte) : -flaeche(punkte);
    });
  }
  return Math.max(0, summe);
}

/** Steht dieses Element auf einer der markierten Flächen? */
function stehtAufVerkaufsflaeche(mitte: Punkt, flaechen: Verkaufsflaeche[]): boolean {
  // Entschieden wird am Mittelpunkt. Ein Regal, das halb über der Kante
  // steht, muss so oder so zugeordnet werden – und der Mittelpunkt ist die
  // Regel, die man am Plan nachvollziehen kann.
  return flaechen.some((f) => f.umriss.length >= 3 && punktInnerhalb(mitte, f.umriss));
}

/**
 * Die Innenfläche eines Umrisses, also abzüglich der Wände.
 *
 * Genau wäre dafür ein nach innen versetztes Polygon nötig. Das ist bei
 * einspringenden Ecken erstaunlich fehleranfällig, und der Unterschied liegt
 * im Bereich einzelner Quadratzentimeter. Deshalb der saubere Weg über den
 * Umfang: Fläche minus Umfang mal halbe Wandstärke ist für Grundrisse mit
 * rechten Winkeln exakt und sonst sehr nah dran.
 */
export function innenflaeche(umriss: { x: number; y: number }[], wandstaerke: number): number {
  return Math.max(0, flaeche(umriss) - umfang(umriss) * (wandstaerke / 2));
}

/** Die Fläche eines Raums, ohne seine Wände. */
export function raumflaeche(raum: Raum): number {
  return innenflaeche(raum.umriss, raum.wandstaerke);
}

export function berechneFlaechen(projekt: Projekt): Flaechenuebersicht {
  const { umriss, wandstaerke } = projekt.grundflaeche;
  const brutto = flaeche(umriss);
  const netto = innenflaeche(umriss, wandstaerke);

  const raeume: Raumflaeche[] = projekt.raeume.map((raum) => ({
    id: raum.id,
    name: raum.name,
    art: raum.art,
    flaeche: raumflaeche(raum),
    verkauf: VERKAUFSARTEN.has(raum.art),
  }));

  const nebenflaeche = raeume.filter((r) => !r.verkauf).reduce((summe, r) => summe + r.flaeche, 0);

  // Gezeichnet schlägt gerechnet. Wer die Verkaufsfläche selbst einzeichnet,
  // hat einen Grund dazu – und will dann nicht, dass daneben noch eine zweite
  // Zahl aus den Räumen entsteht.
  const markiert = (projekt.verkaufsflaechen ?? []).filter((f) => f.umriss.length >= 3);
  const verkaufsflaecheMarkiert = markiert.length > 0;
  const verkaufsflaeche = verkaufsflaecheMarkiert
    ? vereinigteFlaeche(markiert.map((f) => f.umriss))
    : Math.max(0, netto - nebenflaeche);

  const proKategorie = new Map<KategorieId, number>();
  let belegt = 0;
  let belegtInVerkauf = 0;
  for (const el of projekt.elemente) {
    const f = grundflaecheVon(el);
    belegt += f;
    if (!verkaufsflaecheMarkiert || stehtAufVerkaufsflaeche({ x: el.x, y: el.y }, markiert)) {
      belegtInVerkauf += f;
    }
    proKategorie.set(el.kategorie, (proKategorie.get(el.kategorie) ?? 0) + f);
  }

  return {
    brutto,
    netto,
    nebenflaeche,
    verkaufsflaeche,
    verkaufsflaecheMarkiert,
    verkaufsflaechen: markiert
      .map((f) => ({ id: f.id, name: f.name, flaeche: flaeche(f.umriss) }))
      .sort((a, b) => b.flaeche - a.flaeche),
    belegt,
    belegtInVerkauf,
    frei: Math.max(0, verkaufsflaeche - belegtInVerkauf),
    jeKategorie: [...proKategorie.entries()]
      .map(([kategorie, flaeche]) => ({ kategorie, flaeche }))
      .sort((a, b) => b.flaeche - a.flaeche),
    raeume: raeume.sort((a, b) => b.flaeche - a.flaeche),
  };
}

/**
 * Regallänge in laufenden Metern.
 *
 * Gezählt wird die Breite jedes Regals und Kühlmöbels. Beidseitige Möbel
 * zählen doppelt, weil sie von beiden Seiten bestückt werden – eine Gondel
 * von 4 m bringt 8 laufende Meter.
 *
 * Zwei Wandregale Rücken an Rücken sind dagegen zwei einseitige Möbel und
 * werden schon von selbst zweimal gezählt. Deshalb hängt das Doppeln am
 * einzelnen Möbel und nicht daran, ob mehrere zu einer Gruppe gehören.
 */
export function berechneRegalmeter(projekt: Projekt): number {
  let cm = 0;
  for (const el of projekt.elemente) {
    if (el.kategorie !== 'regale' && el.kategorie !== 'kuehlung') continue;
    cm += el.breite * (el.beidseitig ? 2 : 1);
  }
  return cm / 100;
}

/** Regalmeter je Warengruppe – für die Auswertung einzelner Abteilungen. */
export function regalmeterJeWarengruppe(projekt: Projekt): { name: string; meter: number }[] {
  const summen = new Map<string, number>();
  for (const el of projekt.elemente) {
    if (el.kategorie !== 'regale' && el.kategorie !== 'kuehlung') continue;
    const name = el.warengruppe?.trim() || 'ohne Warengruppe';
    summen.set(name, (summen.get(name) ?? 0) + (el.breite * (el.beidseitig ? 2 : 1)) / 100);
  }
  return [...summen.entries()]
    .map(([name, meter]) => ({ name, meter }))
    .sort((a, b) => b.meter - a.meter);
}
