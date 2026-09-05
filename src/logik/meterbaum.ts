import { auslagenAnteil, kistenAnteil } from './auslagen';
import {
  abteilungVon,
  eindeutigerPfad,
  ersteStufe,
  letzteStufe,
  pfadVon,
} from './sortiment';
import { metersumme, OHNE_WARENGRUPPE, strecken, warengruppenmeter } from './warengruppenmeter';
import type { Sortimentsliste } from '../daten/warengruppen';
import type { Projekt } from '../typen/modell';
import { buende, bundFuer, zieleDerStrecke } from './sortimentsbund';
import type { Meterziel, Streckenmeter, Warengruppenzeile } from './warengruppenmeter';

/**
 * Die Meterauswertung als Baum – so geordnet wie die Sortimentsliste.
 *
 * Eine flache Liste von Warengruppen ist beim Durchgehen unbrauchbar: 73
 * Namen in der Reihenfolge ihrer Meter sind kein Bild vom Markt. Wer die
 * Auswertung liest, denkt in Abteilungen, so wie er auch durch den Laden
 * geht – und genauso steht die Liste links.
 *
 * Deshalb dieselben drei Stufen: **Abteilung → Warengruppe → Sortiment**,
 * in der Reihenfolge der geladenen Liste, mit Summen auf jeder Stufe. Was
 * eine Stufe zeigt, ist die Summe dessen, was darunter hängt.
 *
 * **Geordnet wird über den Pfad**, nicht über den Namen: „Kuchen" steht in
 * der Liste zweimal, und die beiden gehören an zwei verschiedene Stellen.
 * Eine Strecke ohne Pfad – frei getippt, oder aus einer älteren Planung –
 * wird über ihren Namen eingeordnet, solange der eindeutig ist; sonst
 * landet sie unter „Noch nicht eingeordnet".
 */

/** Ein Knoten im Baum: eine Abteilung, eine Warengruppe oder ein Sortiment. */
export interface Meterknoten {
  name: string;
  /** Der volle Pfad – zugleich der Schlüssel für React und fürs Aufklappen. */
  pfad: string;
  /** 1 = Abteilung, 2 = Warengruppe, 3 = Sortiment. */
  stufe: 1 | 2 | 3;
  /** Laufende Meter, mit allem darunter. */
  laufend: number;
  /** Tatsächliche Meter – `undefined`, wenn nirgends darunter eine bekannt ist. */
  tatsaechlich?: number;
  /** Meter, auf denen die Bodenzahl fehlt. */
  ohneAuslagen: number;
  /** Meter, die bewusst nur laufend zählen (Blumen). */
  nurLaufend: number;
  /** Grüne Kisten, mit allem darunter. */
  kisten: number;
  /** Wie viele Möbelseiten beitragen. */
  strecken: number;
  kinder: Meterknoten[];
}

/** Was oben in der Kopfzeile steht. */
export interface Metergesamt {
  laufend: number;
  tatsaechlich: number;
  ohneAuslagen: number;
  nurLaufend: number;
  ohneWarengruppe: number;
  kisten: number;
  /** Wie viele Warengruppen und Sortimente überhaupt vorkommen. */
  posten: number;
}

/** Die Überschrift für alles, was sich nicht einordnen ließ. */
export const OHNE_ABTEILUNG = 'Noch nicht eingeordnet';

function leererKnoten(name: string, pfad: string, stufe: 1 | 2 | 3): Meterknoten {
  return {
    name,
    pfad,
    stufe,
    laufend: 0,
    ohneAuslagen: 0,
    nurLaufend: 0,
    kisten: 0,
    strecken: 0,
    kinder: [],
  };
}

/** Legt die Zahlen einer Zeile auf einen Knoten – und auf alles darüber. */
function addiere(ziel: Meterknoten, zeile: Warengruppenzeile, kisten: number) {
  ziel.laufend += zeile.laufend;
  ziel.ohneAuslagen += zeile.ohneAuslagen;
  ziel.nurLaufend += zeile.nurLaufend;
  ziel.strecken += zeile.strecken;
  ziel.kisten += kisten;
  if (zeile.tatsaechlich !== undefined) {
    ziel.tatsaechlich = (ziel.tatsaechlich ?? 0) + zeile.tatsaechlich;
  }
}

/** Rundet eine Stufe auf Zentimeter – Summen von Summen laufen sonst weg. */
function runde(knoten: Meterknoten): Meterknoten {
  const r = (w: number) => Math.round(w * 100) / 100;
  return {
    ...knoten,
    laufend: r(knoten.laufend),
    tatsaechlich: knoten.tatsaechlich === undefined ? undefined : r(knoten.tatsaechlich),
    ohneAuslagen: r(knoten.ohneAuslagen),
    nurLaufend: r(knoten.nurLaufend),
    kisten: Math.round(knoten.kisten),
    kinder: knoten.kinder.map(runde),
  };
}

/**
 * Wie eine Sonder- oder Aktionsplatzierung in der Auswertung heißt.
 *
 * Sie hängt unter ihrer Warengruppe wie ein Sortiment, ist aber keines: Auf
 * ihr liegt Werbeware. In der Sortimentsliste steht sie deshalb nicht, und
 * abgehakt wird durch sie nichts.
 */
export const AKTIONSZEILE = 'Sonderplatzierung';

/**
 * Wo eine Zeile im Baum hingehört.
 *
 * Erst der Pfad, den die Strecke selbst trägt. Sonst der Versuch, den Namen
 * in der Liste zu finden – das trifft alte Planungen und alles, was von Hand
 * getippt und einmal abgehakt wurde. Bleibt beides ohne Treffer, hängt die
 * Zeile unter „Noch nicht eingeordnet": Sie zählt mit, sie steht nur nicht
 * am richtigen Platz, und das sieht man ihr an.
 *
 * **Gesucht wird der volle Pfad und nicht nur die Abteilung.** Ein Name, den
 * die Liste genau einmal kennt, gehört unter seine Warengruppe – wer nur die
 * Abteilung nachschlägt, hängt ein Sortiment neben die Warengruppe statt
 * darunter, und deren Summe fehlten dann genau diese Meter.
 *
 * **Ist der Name mehrdeutig, wird nicht geraten.** „Kuchen" steht in der
 * Liste fünfmal; die erste Fundstelle zu nehmen hieße, die Meter mit einer
 * Wahrscheinlichkeit von eins zu fünf richtig einzuordnen – und zwar
 * unsichtbar. Solche Strecken stehen unter „Noch nicht eingeordnet", bis
 * jemand sie über das Menü einem Sortiment zuweist. Das ist dieselbe
 * Auskunft, die auch am Möbel selbst steht.
 */
function stufenVon(zeile: Warengruppenzeile, liste: Sortimentsliste): string[] {
  if (zeile.pfad) return zeile.pfad.split(' › ');
  if (zeile.name === OHNE_WARENGRUPPE) return [OHNE_ABTEILUNG, zeile.name];
  const pfad = eindeutigerPfad(liste, zeile.name);
  return pfad ? pfad.split(' › ') : [OHNE_ABTEILUNG, zeile.name];
}

/**
 * Die Meter je Warengruppe, als Baum.
 *
 * Nimmt die fertigen Zeilen entgegen und hängt sie ein – gerechnet wird
 * weiterhin in `warengruppenmeter`, hier wird nur geordnet und summiert.
 */
export function meterbaum(
  zeilen: Warengruppenzeile[],
  liste: Sortimentsliste,
  kistenJeZeile: Map<string, number>,
): Meterknoten[] {
  const wurzeln = new Map<string, Meterknoten>();

  for (const zeile of zeilen) {
    const stufen = stufenVon(zeile, liste);
    // Die unterste Stufe heißt, wie die Zeile heißt. Bei einem Bund steht
    // dort „Kuchen, Waffeln" und nicht nur der Name, über dessen Pfad er
    // eingeordnet wurde.
    if (stufen.length > 0) stufen[stufen.length - 1] = zeile.name;
    const kisten = kistenJeZeile.get(zeile.pfad ?? zeile.name) ?? 0;

    let ebene = wurzeln;
    let knoten: Meterknoten | undefined;
    for (let i = 0; i < stufen.length; i++) {
      const pfad = pfadVon(...stufen.slice(0, i + 1));
      let vorhanden = ebene.get(pfad);
      if (!vorhanden) {
        vorhanden = leererKnoten(stufen[i], pfad, Math.min(3, i + 1) as 1 | 2 | 3);
        ebene.set(pfad, vorhanden);
        if (knoten) knoten.kinder.push(vorhanden);
      }
      addiere(vorhanden, zeile, kisten);
      knoten = vorhanden;
      ebene = new Map(vorhanden.kinder.map((k) => [k.pfad, k]));
    }
  }

  // Die Reihenfolge der Sortimentsliste ist die des Marktes – sie folgt dem
  // Weg durch den Laden. Alphabetisch wäre eine Ordnung, die niemand im Kopf
  // hat, und nach Metern zu sortieren machte jede Änderung zu einem Sprung.
  const rang = new Map<string, number>();
  liste.abteilungen.forEach((a, i) => rang.set(a.name, i));

  const oben = [...wurzeln.values()].sort((a, b) => {
    if (a.name === OHNE_ABTEILUNG) return 1;
    if (b.name === OHNE_ABTEILUNG) return -1;
    const ra = rang.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const rb = rang.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb || a.name.localeCompare(b.name, 'de');
  });

  return oben.map(runde);
}

/** Baut den Baum und die Kopfzahlen in einem Zug. */
export function meterauswertung(
  projekt: Projekt,
  liste: Sortimentsliste,
): { baum: Meterknoten[]; gesamt: Metergesamt } {
  // Zwei Sortimente auf einer Strecke laufen in eine Zeile – ob sie
  // gemeinsam beschriftet oder einander zugeordnet sind.
  const bund = buende(projekt, liste);

  /**
   * In welche Zeilen eine Strecke zählt – und mit welchem Anteil.
   *
   * Erst, wohin ihre Namen für sich gehören (`zieleDerStrecke` wägt Text und
   * Pfad gegeneinander ab). Dann entscheidet die Strecke selbst:
   *
   *  - **Ohne Aufteilung** bleibt alles wie bisher: Zwei Namen auf einem
   *    Meter bilden **eine** Zeile mit beiden Namen (der Bund). Das ist der
   *    Normalfall und soll es bleiben.
   *  - **Mit Aufteilung** bekommt jeder Name seine eigene Zeile und seinen
   *    Anteil – nebeneinander teilen sie die Länge, übereinander die
   *    Auslagen. Siehe `Streckenaufteilung`.
   */
  const zieleMitAnteil = (strecke: Streckenmeter): Meterziel[] => {
    const ziele = zieleDerStrecke(liste, strecke);
    const teilung = strecke.aufteilung;

    // **Eine Sonderplatzierung zählt unter ihrer Warengruppe, aber getrennt.**
    // Auf dem Meter liegt Werbeware und kein reguläres Sortiment; er ist
    // trotzdem Fläche dieser Warengruppe, laufend wie tatsächlich. Deshalb
    // hängt er als eigene Zeile unter dem Pfad, den er trägt – ohne dass
    // dafür in jedem Sortiment eine Warengruppe „Aktion" angelegt werden
    // müsste.
    if (strecke.aktion) {
      const pfad = strecke.pfad ?? eindeutigerPfad(liste, strecke.name);
      return [
        {
          name: AKTIONSZEILE,
          pfad: pfad ? pfadVon(...pfad.split(' › '), AKTIONSZEILE) : undefined,
          anteil: 1,
          aktion: true,
        },
      ];
    }

    const gebuendelt = (): Meterziel[] => {
      const erste = ziele[0] ?? { name: strecke.name, pfad: strecke.pfad };
      const treffer = bundFuer(bund, liste, erste.name);
      const ziel = treffer ? { name: treffer.beschriftung, pfad: treffer.pfad } : erste;
      return [{ ...ziel, anteil: 1 }];
    };

    if (!teilung || ziele.length < 2 || teilung.werte.length !== ziele.length) return gebuendelt();
    const werte = teilung.werte.map((w) => Math.max(0, w));
    const summe = werte.reduce((s, w) => s + w, 0);
    if (!(summe > 0)) return gebuendelt();

    if (teilung.art === 'uebereinander') {
      // Jeder hat die ganze Länge; die eingetragene Zahl **sind** seine
      // Auslagen. Zwei Regalböden Dessertsoßen über einer Milchpalette:
      // beide 1,25 m lang, das eine mit zwei Auslagen, das andere mit einer.
      return ziele.map((ziel, i) => ({ ...ziel, anteil: 1, auslagen: werte[i] }));
    }
    return ziele.map((ziel, i) => ({ ...ziel, anteil: werte[i] / summe }));
  };

  const zeilen = warengruppenmeter(projekt, {
    auslagen: auslagenAnteil,
    zieleFuer: zieleMitAnteil,
  });

  // Die Kisten je Zeile: getrennt gerechnet, weil die Meterlogik für den
  // ganzen Markt gilt und nicht wissen soll, dass es eine Obstabteilung gibt.
  const kistenJeZeile = new Map<string, number>();
  for (const strecke of strecken(projekt)) {
    const zahl = kistenAnteil(strecke);
    if (zahl <= 0) continue;
    // Dieselben Schlüssel wie bei den Meterzeilen, sonst behielte eine Zeile
    // ihre Meter und verlöre ihre Kisten. Eine aufgeteilte Strecke verteilt
    // ihre Kisten mit – nebeneinander nach dem Anteil, übereinander bekommt
    // jeder alle: Die Kisten stehen auf demselben Möbel.
    for (const ziel of zieleMitAnteil(strecke)) {
      const schluessel = ziel.pfad ?? ziel.name;
      const teil = zahl * ziel.anteil;
      kistenJeZeile.set(schluessel, (kistenJeZeile.get(schluessel) ?? 0) + teil);
    }
  }

  const summe = metersumme(zeilen);
  const baum = meterbaum(zeilen, liste, kistenJeZeile);

  return {
    baum,
    gesamt: {
      ...summe,
      kisten: Math.round([...kistenJeZeile.values()].reduce((s, k) => s + k, 0)),
      posten: zeilen.filter((z) => z.name !== OHNE_WARENGRUPPE).length,
    },
  };
}

/**
 * Die Kennzahlen der Obst- und Gemüseabteilung.
 *
 * **Vier Zahlen, weil die Abteilung aus zweierlei besteht.** Die Tische
 * zählen in grünen Kisten, die Kühlmöbel für Salate, Beeren und Pilze in
 * Metern – und beides lässt sich nicht in eine Zahl bringen, weil kein
 * einzelner Umrechnungskurs zwischen Kisten und Metern existiert (er hängt
 * an der Lage der Kiste und an der Tiefe der Auflage).
 *
 * Also stehen sie nebeneinander: die laufenden Meter der ganzen Abteilung,
 * die Kisten darauf, und getrennt davon, was die Kühlung beisteuert.
 *
 * Zugeordnet wird über die **Warengruppe**, nicht über die Möbelkategorie:
 * Ein Kartoffelregal ist ein Regal und gehört trotzdem hierher, ein
 * Kühlregal an der Molkerei nicht.
 */
export interface Obstgemuesezahlen {
  /** Steht überhaupt etwas in dieser Abteilung? */
  vorhanden: boolean;
  /** Laufende Meter der ganzen Abteilung. */
  laufend: number;
  /** Grüne Kisten darauf. */
  kisten: number;
  /** Laufende Meter davon, die auf Kühlmöbeln liegen. */
  kuehlungLaufend: number;
  /** Deren tatsächliche Meter. */
  kuehlungTatsaechlich: number;
}

/** Der Name der Abteilung in der Sortimentsliste, an dem sie erkannt wird. */
const OG_ERKENNUNG = /obst|gem(ü|ue)se/i;

export function obstgemuesezahlen(projekt: Projekt, liste: Sortimentsliste): Obstgemuesezahlen {
  let laufend = 0;
  let kisten = 0;
  let kuehlungLaufend = 0;
  let kuehlungTatsaechlich = 0;
  let vorhanden = false;

  for (const strecke of strecken(projekt)) {
    const name = strecke.pfad ? letzteStufe(strecke.pfad) : strecke.name;
    const abteilung = strecke.pfad ? ersteStufe(strecke.pfad) : abteilungVon(liste, name);
    if (!abteilung || !OG_ERKENNUNG.test(abteilung)) continue;

    vorhanden = true;
    laufend += strecke.laenge;
    kisten += kistenAnteil(strecke);

    // Was in dieser Abteilung ein Kühlmöbel ist, sagt die Kategorie des
    // Möbels – dort ist sie die richtige Frage, denn es geht um die Bauart
    // und nicht um das Sortiment darauf.
    if (strecke.element.kategorie === 'kuehlung' || strecke.element.kategorie === 'tiefkuehlung') {
      kuehlungLaufend += strecke.laenge;
      kuehlungTatsaechlich += auslagenAnteil(strecke).tatsaechlich;
    }
  }

  const m = (cm: number) => Math.round(cm) / 100;
  return {
    vorhanden,
    laufend: m(laufend),
    kisten: Math.round(kisten),
    kuehlungLaufend: m(kuehlungLaufend),
    kuehlungTatsaechlich: m(kuehlungTatsaechlich),
  };
}
