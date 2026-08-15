import type { KategorieId, Projekt, Raum, Raumart } from '../typen/modell';
import { grundflaecheVon } from './geometrie';
import { flaeche, umfang } from './polygon';

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

export interface Flaechenuebersicht {
  /** Außenmaß des Gebäudes, also der ganze Umriss. */
  brutto: number;
  /** Innenfläche ohne Außenwände. */
  netto: number;
  /** Summe aller abgetrennten Räume, die nicht zur Verkaufsfläche zählen. */
  nebenflaeche: number;
  /** Innenfläche minus Nebenflächen – die Fläche, auf der verkauft wird. */
  verkaufsflaeche: number;
  /** Von Elementen belegte Fläche. */
  belegt: number;
  /** Verkaufsfläche minus belegte Fläche. */
  frei: number;
  /** Belegte Fläche je Kategorie. */
  jeKategorie: { kategorie: KategorieId; flaeche: number }[];
  /** Jeder Raum einzeln. */
  raeume: Raumflaeche[];
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
  const verkaufsflaeche = Math.max(0, netto - nebenflaeche);

  const proKategorie = new Map<KategorieId, number>();
  let belegt = 0;
  for (const el of projekt.elemente) {
    const f = grundflaecheVon(el);
    belegt += f;
    proKategorie.set(el.kategorie, (proKategorie.get(el.kategorie) ?? 0) + f);
  }

  return {
    brutto,
    netto,
    nebenflaeche,
    verkaufsflaeche,
    belegt,
    frei: Math.max(0, verkaufsflaeche - belegt),
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
