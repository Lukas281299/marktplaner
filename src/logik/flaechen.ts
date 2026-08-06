import type { KategorieId, Projekt } from '../typen/modell';
import { grundflaecheVon } from './geometrie';

/**
 * Flächenberechnung.
 * Alle Werte in Quadratzentimetern – die Anzeige rechnet in m² um
 * (siehe `formatiereFlaeche`).
 */
export interface Flaechenuebersicht {
  /** Außenmaß des Gebäudes. */
  brutto: number;
  /** Innenfläche ohne Außenwände. */
  netto: number;
  /** Von Elementen belegte Fläche. */
  belegt: number;
  /** Nettofläche minus belegte Fläche. */
  frei: number;
  /** Belegte Fläche je Kategorie. */
  jeKategorie: { kategorie: KategorieId; flaeche: number }[];
}

export function berechneFlaechen(projekt: Projekt): Flaechenuebersicht {
  const { breite, laenge, wandstaerke } = projekt.grundflaeche;
  const brutto = breite * laenge;
  const netto = Math.max(0, (breite - 2 * wandstaerke) * (laenge - 2 * wandstaerke));

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
    belegt,
    frei: Math.max(0, netto - belegt),
    jeKategorie: [...proKategorie.entries()]
      .map(([kategorie, flaeche]) => ({ kategorie, flaeche }))
      .sort((a, b) => b.flaeche - a.flaeche),
  };
}

/**
 * Regallänge in laufenden Metern: die Summe der Breiten aller Regale
 * und Kühlmöbel. Gondeln zählen doppelt, weil sie von beiden Seiten
 * bestückt werden.
 */
export function berechneRegalmeter(projekt: Projekt): number {
  let cm = 0;
  for (const el of projekt.elemente) {
    if (el.kategorie !== 'regale' && el.kategorie !== 'kuehlung') continue;
    const doppelseitig = el.vorlageId.includes('gondel');
    cm += el.breite * (doppelseitig ? 2 : 1);
  }
  return cm / 100;
}
