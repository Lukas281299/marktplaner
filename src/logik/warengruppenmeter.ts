import { geordnet } from './warengruppe';
import { felderVon, seitenbreite, seitenVon } from './regalseiten';
import type { PlanElement, Projekt, Warengruppenabschnitt } from '../typen/modell';

/**
 * Die Meter je Warengruppe.
 *
 * **Zwei Zahlen, und sie messen Verschiedenes.**
 *
 *  - **Laufende Meter** sind die waagerechte Länge, die eine Warengruppe im
 *    Markt einnimmt. Ein Meter Obst und Gemüse ist ein laufender Meter, egal
 *    wie hoch das Möbel ist und wie viele Etagen es hat.
 *  - **Tatsächliche Meter** sind laufende Meter mal Auslagen. Ein Meter
 *    Regal mit fünf Böden sind fünf tatsächliche Meter. Damit zählt die Höhe
 *    mit, ohne dass man sie eintragen müsste.
 *
 * Die Tiefe zählt bewusst nicht mit. Es geht um Auslagefläche zum Greifen,
 * und ob ein Boden 400 oder 600 tief ist, ändert daran wenig – während es
 * die Zahlen um ein Drittel verschöbe.
 *
 * **Gemessen wird an den Abschnitten, nicht am Möbel.** Bis hierher gab es
 * `regalmeterJeWarengruppe`, und die las das Feld `warengruppe` am ganzen
 * Element. Das trifft den Fall nicht: Ein Zug trägt fünf Sortimente
 * nebeneinander, und die Grenzen laufen mitten durch die Felder. Gerechnet
 * wird deshalb über die Strecken, die im Plan eingezeichnet sind.
 *
 * **Bezugsachse ist die Feldkette der Seite**, nicht `element.breite`. So
 * sind die Abschnitte gespeichert (siehe `Warengruppenabschnitt`), und wer
 * hier anders misst, bekommt bei einer Gondel mit verschieden breiten Seiten
 * andere Zahlen als der Plan zeigt.
 */

/** Was auf einer Strecke steht und wie lang sie ist. */
export interface Streckenmeter {
  /** Der Name, wie er im Plan steht. */
  name: string;
  /** Länge in cm. */
  laenge: number;
  /** Das Möbel, zu dem die Strecke gehört. */
  element: PlanElement;
  /** Welche Seite – bei einer Gondel gibt es zwei. */
  seite: 'unten' | 'oben';
}

/**
 * Alle beschrifteten Strecken eines Plans, Möbel für Möbel.
 *
 * Eine beidseitige Gondel liefert von selbst zwei Strecken – je Seite eine
 * eigene Liste. Deshalb wird hier nirgends verdoppelt: Das Doppelte entsteht
 * dadurch, dass beide Seiten beschriftet sind. Ist nur eine beschriftet,
 * zählt auch nur eine, und das ist richtig so.
 */
export function strecken(projekt: Projekt): Streckenmeter[] {
  const aus: Streckenmeter[] = [];
  const sichtbar = sichtbareEbenen(projekt);

  for (const element of projekt.elemente ?? []) {
    if (element.ebeneId && !sichtbar.has(element.ebeneId)) continue;

    for (const seite of seitenVon(element)) {
      const felder = felderVon(element, seite);
      const breite = seitenbreite(felder);
      if (breite <= 0) continue;

      const abschnitte = seite === 'oben' ? element.warengruppenOben : element.warengruppenUnten;
      for (const a of geordnet(abschnitte, breite)) {
        const name = a.text.trim();
        if (!name) continue;
        aus.push({ name, laenge: a.bis - a.von, element, seite });
      }
    }
  }
  return aus;
}

/**
 * Welche Ebenen gerade sichtbar sind.
 *
 * Was ausgeblendet ist, zählt nicht mit. Ein Planer blendet die Beschriftung
 * aus, um den Grundriss zu sehen – aber wer eine Ebene mit Möbeln ausblendet,
 * meint „die gehören gerade nicht dazu", und dann gehören sie auch nicht in
 * die Auswertung.
 */
function sichtbareEbenen(projekt: Projekt): Set<string> {
  return new Set((projekt.ebenen ?? []).filter((e) => e.sichtbar !== false).map((e) => e.id));
}

/**
 * Die Länge einer Möbelseite, die **nicht** beschriftet ist.
 *
 * Diese Meter stehen im Markt und tragen Ware – sie sind nur noch keinem
 * Sortiment zugeschrieben. Sie wegzulassen hieße, eine Tabelle zu zeigen,
 * deren Summe kleiner ist als der Markt, ohne dass man sähe warum.
 */
export function unbeschriftet(element: PlanElement): number {
  let offen = 0;
  for (const seite of seitenVon(element)) {
    const breite = seitenbreite(felderVon(element, seite));
    if (breite <= 0) continue;
    const abschnitte = seite === 'oben' ? element.warengruppenOben : element.warengruppenUnten;
    const belegt = geordnet(abschnitte, breite)
      .filter((a) => a.text.trim().length > 0)
      .reduce((summe, a) => summe + (a.bis - a.von), 0);
    offen += Math.max(0, breite - belegt);
  }
  return offen;
}

/** Wie viele Auslagen ein Möbel je laufendem Meter trägt. */
export type Auslagenzahl = (element: PlanElement, seite: 'unten' | 'oben') => number | undefined;

/** Eine Zeile der Auswertung. */
export interface Warengruppenzeile {
  name: string;
  /** Laufende Meter. */
  laufend: number;
  /**
   * Tatsächliche Meter – oder `undefined`, wenn für diese Möbel keine
   * Auslagenzahl bekannt ist.
   *
   * Lieber leer als erfunden: Eine Null sähe aus wie „hier steht nichts",
   * und eine geschätzte Zahl wanderte in eine Bestellung.
   */
  tatsaechlich?: number;
  /**
   * Auf wie vielen laufenden Metern die Auslagenzahl fehlt.
   *
   * Sagt, wie belastbar die Spalte daneben ist. Steht hier etwas, ist die
   * Zeile unvollständig – und man sieht, welches Möbel man noch ausfüllen muss.
   */
  ohneAuslagen: number;
  /** Wie viele Möbelseiten zu dieser Zeile beitragen. */
  strecken: number;
}

/** Der Name, unter dem Meter ohne Beschriftung erscheinen. */
export const OHNE_WARENGRUPPE = 'ohne Warengruppe';

export interface Meteroptionen {
  /**
   * Wie viele Auslagen ein Möbel je laufendem Meter trägt.
   *
   * Kommt von außen, weil jede Abteilung anders rechnet: Regale und Kühlung
   * über die Bödenzahl, die Tiefkühlung über die Sichtfläche, die Getränke
   * über Kistenfacings. Wer hier nichts liefert, bekommt nur laufende Meter –
   * und das ist eine brauchbare Auswertung für sich.
   */
  auslagen?: Auslagenzahl;
  /**
   * Wohin ein Name für die Rechnung gehört, wenn er einem anderen zugeordnet
   * ist.
   *
   * Wer vier Meter „Kuchen" einzeichnet, obwohl dort auch Waffeln liegen,
   * ordnet Waffeln dem Kuchen zu. Dann laufen die Meter über Kuchen, und in
   * der Liste sieht es nicht so aus, als sei Waffeln vergessen worden.
   */
  zugeordnetZu?: (name: string) => string | undefined;
}

/** Fasst gleiche Namen zusammen und rechnet beide Spalten. */
export function warengruppenmeter(
  projekt: Projekt,
  optionen: Meteroptionen = {},
): Warengruppenzeile[] {
  const zeilen = new Map<string, Warengruppenzeile>();

  const nimm = (name: string) => {
    const vorhanden = zeilen.get(name);
    if (vorhanden) return vorhanden;
    const neu: Warengruppenzeile = { name, laufend: 0, ohneAuslagen: 0, strecken: 0 };
    zeilen.set(name, neu);
    return neu;
  };

  for (const strecke of strecken(projekt)) {
    // Erst umleiten: Ein zugeordneter Name bringt seine Meter dorthin, wo
    // gerechnet wird. Eine Kette wird dabei nicht verfolgt – eine Zuordnung
    // ist eine Aussage über zwei Namen, keine Vererbung.
    const ziel = optionen.zugeordnetZu?.(strecke.name)?.trim() || strecke.name;
    const zeile = nimm(ziel);
    zeile.laufend += strecke.laenge;
    zeile.strecken++;

    const auslagen = optionen.auslagen?.(strecke.element, strecke.seite);
    if (auslagen === undefined || !Number.isFinite(auslagen)) {
      zeile.ohneAuslagen += strecke.laenge;
    } else {
      zeile.tatsaechlich = (zeile.tatsaechlich ?? 0) + strecke.laenge * auslagen;
    }
  }

  // Die Meter, die noch keinen Namen tragen – damit die Summe der Tabelle
  // dem Markt entspricht.
  const sichtbar = sichtbareEbenen(projekt);
  let offen = 0;
  for (const element of projekt.elemente ?? []) {
    if (element.ebeneId && !sichtbar.has(element.ebeneId)) continue;
    offen += unbeschriftet(element);
  }
  if (offen > 0.5) {
    const zeile = nimm(OHNE_WARENGRUPPE);
    zeile.laufend += offen;
  }

  return [...zeilen.values()]
    .map((z) => ({
      ...z,
      laufend: Math.round(z.laufend) / 100,
      tatsaechlich: z.tatsaechlich === undefined ? undefined : Math.round(z.tatsaechlich) / 100,
      ohneAuslagen: Math.round(z.ohneAuslagen) / 100,
    }))
    .sort((a, b) => {
      // Die namenlosen Meter stehen unten: Sie sind kein Sortiment.
      if (a.name === OHNE_WARENGRUPPE) return 1;
      if (b.name === OHNE_WARENGRUPPE) return -1;
      return b.laufend - a.laufend || a.name.localeCompare(b.name, 'de');
    });
}

/** Die Summen unter der Tabelle. */
export function metersumme(zeilen: Warengruppenzeile[]): {
  laufend: number;
  tatsaechlich: number;
  ohneAuslagen: number;
  ohneWarengruppe: number;
} {
  let laufend = 0;
  let tatsaechlich = 0;
  let ohneAuslagen = 0;
  let ohneWarengruppe = 0;
  for (const z of zeilen) {
    laufend += z.laufend;
    tatsaechlich += z.tatsaechlich ?? 0;
    ohneAuslagen += z.ohneAuslagen;
    if (z.name === OHNE_WARENGRUPPE) ohneWarengruppe += z.laufend;
  }
  const rund = (w: number) => Math.round(w * 100) / 100;
  return {
    laufend: rund(laufend),
    tatsaechlich: rund(tatsaechlich),
    ohneAuslagen: rund(ohneAuslagen),
    ohneWarengruppe: rund(ohneWarengruppe),
  };
}

/**
 * Alle Namen, die im Plan vorkommen – für den Abgleich mit der
 * Sortimentsliste.
 */
export function namenImPlan(projekt: Projekt): Set<string> {
  return new Set(strecken(projekt).map((s) => s.name));
}

/** Nur zum Prüfen: die rohen Abschnitte einer Seite, schon beschnitten. */
export function abschnitteDerSeite(
  element: PlanElement,
  seite: 'unten' | 'oben',
): Warengruppenabschnitt[] {
  const breite = seitenbreite(felderVon(element, seite));
  const abschnitte = seite === 'oben' ? element.warengruppenOben : element.warengruppenUnten;
  return geordnet(abschnitte, breite);
}
