import { findeVorlage } from '../daten/bibliothek';
import type { BibliothekEintrag, KategorieId, PlanElement, Projekt } from '../typen/modell';

/**
 * Was im Markt steht, nach Möbeltypen gezählt.
 *
 * Die Stückliste. Die Flächenübersicht sagt, wie viele Quadratmeter eine
 * Abteilung belegt; hier steht, **woraus** sie besteht – fünf Gondeln A1000,
 * zwei Kopfgondeln, ein Stufenmöbel. Das ist die Liste, mit der man in ein
 * Gespräch über Umbau geht, und bis hierher musste man sie im Plan abzählen.
 *
 * **Gezählt wird nach Vorlage, nicht nach Form.** Zwei Möbel derselben
 * Bauart, aber verschiedener Länge sind zwei Zeilen: Bestellt werden sie
 * einzeln, und eine gemeinsame Zeile verstecke genau den Unterschied, auf
 * den es ankommt.
 *
 * Was auf einer ausgeblendeten Ebene liegt, zählt nicht mit – wie in der
 * Meterauswertung auch: Wer eine Ebene ausblendet, meint „die gehören gerade
 * nicht dazu".
 */

/** Eine Zeile der Stückliste. */
export interface Moebelzeile {
  /** Die Vorlage, aus der die Möbel stammen. */
  vorlageId: string;
  name: string;
  kategorie: KategorieId;
  anzahl: number;
  /** Zusammengelegte Breite in cm – bei Regalen die laufenden Meter. */
  laenge: number;
  /** Belegte Grundfläche in m². */
  flaeche: number;
}

/**
 * Der Name, unter dem ein Möbel in der Liste steht.
 *
 * Der Bibliotheksname, wenn es ihn gibt: Er nennt das Modell und die Länge
 * und ist damit das, was bestellt wird. Sonst der Name am Möbel – ein frei
 * gezeichnetes Element oder eines aus einem eingelesenen Plan hat keine
 * Vorlage mehr, und dann ist der eigene Name besser als eine leere Zeile.
 */
function anzeigename(element: PlanElement, vorlage?: BibliothekEintrag): string {
  return vorlage?.name || element.name || element.beschriftung || 'Ohne Namen';
}

export function moebelliste(projekt: Projekt, eigene: BibliothekEintrag[] = []): Moebelzeile[] {
  const sichtbar = new Set(
    (projekt.ebenen ?? []).filter((e) => e.sichtbar !== false).map((e) => e.id),
  );
  const zeilen = new Map<string, Moebelzeile>();

  for (const element of projekt.elemente ?? []) {
    if (element.ebeneId && !sichtbar.has(element.ebeneId)) continue;

    const vorlage = findeVorlage(element.vorlageId, eigene);
    const name = anzeigename(element, vorlage);
    // Verschiedene Längen derselben Vorlage bleiben getrennt: Ein von Hand
    // verlängerter Zug ist nicht dasselbe Möbel wie der aus dem Katalog.
    const schluessel = `${element.vorlageId}|${name}|${Math.round(element.breite)}`;

    const vorhanden = zeilen.get(schluessel);
    const flaeche = (element.breite * element.tiefe) / 10000;
    if (vorhanden) {
      vorhanden.anzahl++;
      vorhanden.laenge += element.breite;
      vorhanden.flaeche += flaeche;
    } else {
      zeilen.set(schluessel, {
        vorlageId: element.vorlageId,
        name,
        kategorie: element.kategorie,
        anzahl: 1,
        laenge: element.breite,
        flaeche,
      });
    }
  }

  return [...zeilen.values()]
    .map((z) => ({ ...z, laenge: Math.round(z.laenge), flaeche: Math.round(z.flaeche * 100) / 100 }))
    .sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, 'de'));
}

/** Wie viele Möbel und wie viel Fläche insgesamt. */
export function moebelsumme(zeilen: Moebelzeile[]): { anzahl: number; flaeche: number } {
  const anzahl = zeilen.reduce((s, z) => s + z.anzahl, 0);
  const flaeche = zeilen.reduce((s, z) => s + z.flaeche, 0);
  return { anzahl, flaeche: Math.round(flaeche * 100) / 100 };
}
