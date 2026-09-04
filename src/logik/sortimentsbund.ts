import { eindeutigerPfad, kenntNamen, letzteStufe } from './sortiment';
import { strecken } from './warengruppenmeter';
import type { Sortimentsliste } from '../daten/warengruppen';
import type { Projekt } from '../typen/modell';

/**
 * Zwei Sortimente auf einer Strecke – der Bund.
 *
 * Nicht jede Strecke gehört genau einem Sortiment. Drei Meter tragen Nüsse
 * **und** Trockenobst, und wie sie sich darauf verteilen, ist keine Angabe,
 * die jemand hat: Es liegt gemischt, und es soll auch gemischt bleiben.
 *
 * Dafür gibt es **zwei Wege, die dasselbe meinen**:
 *
 *  1. Beide Namen stehen gemeinsam an der Strecke — „Nüsse, Trockenobst".
 *  2. Nur einer steht da, und der andere ist ihm über den Stift zugeordnet.
 *
 * Beide führen hier zusammen: Die Namen bilden einen **Bund**, ihre Meter
 * laufen in **eine** Zeile, und die Zeile heißt nach allen Namen des Bundes.
 * Zusammengefasst wird nur in der Auswertung — in der Sortimentsliste bleiben
 * es zwei Einträge, und beide werden abgehakt, weil beide im Markt stehen.
 *
 * **Nichts davon wird gespeichert.** Der Bund entsteht bei jeder Auswertung
 * neu aus dem Plan. Trennt man die Sortimente wieder, ist er ohne Zutun weg.
 */

const schluessel = (text: string) => text.trim().toLocaleLowerCase('de-DE');

/**
 * Zerlegt eine Beschriftung in die Namen, die darin stehen.
 *
 * **Der ganze Text zuerst.** „Baguette, Stangen, Ciab." ist ein einziges
 * Sortiment und trägt seine Kommas im Namen; blind zu trennen machte daraus
 * drei Namen, von denen es zwei nicht gibt.
 *
 * Getrennt wird nur, wenn danach **jeder** Teil ein Name aus der Liste ist.
 * Sonst bleibt der Text, wie er ist – ein Kommentar hinter dem Namen soll
 * kein halbes Sortiment werden.
 */
export function teileBeschriftung(liste: Sortimentsliste, text: string): string[] {
  const ganz = text.trim();
  if (!ganz) return [];
  if (kenntNamen(liste, ganz)) return [ganz];

  const teile = ganz.split(',').map((t) => t.trim()).filter(Boolean);
  if (teile.length < 2) return [ganz];
  return teile.every((t) => kenntNamen(liste, t)) ? teile : [ganz];
}

/**
 * Die Schreibweise, die in der Sortimentsliste steht.
 *
 * Die Zuordnungen sind unter dem kleingeschriebenen Namen abgelegt – das ist
 * richtig zum Vergleichen und falsch zum Anzeigen. In der Zeile soll „Kuchen"
 * stehen und nicht „kuchen".
 */
function schreibweise(liste: Sortimentsliste, name: string): string {
  const gesucht = schluessel(name);
  for (const abteilung of liste.abteilungen) {
    for (const gruppe of abteilung.warengruppen) {
      if (schluessel(gruppe.name) === gesucht) return gruppe.name;
      for (const sortiment of gruppe.sortimente) {
        if (schluessel(sortiment) === gesucht) return sortiment;
      }
    }
  }
  return name.trim();
}

/** Ein Bund: mehrere Namen, die sich eine Strecke teilen. */
export interface Bund {
  /** Alle Namen, in der Reihenfolge, in der sie zusammengekommen sind. */
  namen: string[];
  /** Wie die Zeile in der Auswertung heißt: „Kuchen, Waffeln". */
  beschriftung: string;
  /** Wohin sie im Baum gehört – der Pfad des ersten Namens, wenn bekannt. */
  pfad?: string;
}

/**
 * Alle Pfade, die im Plan zu einem Namen benutzt werden.
 *
 * Damit lässt sich ein Ziel einordnen, das die Liste mehrfach kennt: Steht
 * „Kuchen" im Markt genau einmal, und zwar unter Bake Off, dann ist das der
 * Kuchen, von dem die Rede ist. Erst wenn beide Kuchen im Plan stehen, wird
 * nicht mehr geraten.
 */
function pfadeJeName(projekt: Projekt, liste: Sortimentsliste): Map<string, Set<string>> {
  const karte = new Map<string, Set<string>>();
  const merke = (name: string, pfad: string) => {
    const k = schluessel(name);
    const menge = karte.get(k) ?? new Set<string>();
    menge.add(pfad);
    karte.set(k, menge);
  };

  for (const strecke of strecken(projekt)) {
    for (const ziel of zieleDerStrecke(liste, strecke)) {
      if (ziel.pfad) merke(ziel.name, ziel.pfad);
    }
  }
  return karte;
}

/**
 * Die Bünde einer Planung – ein Eintrag je beteiligtem Namen.
 *
 * Der Schlüssel ist der Name in Kleinschreibung; alle Namen eines Bundes
 * zeigen auf denselben Bund. Namen, die für sich stehen, kommen nicht vor.
 */
export function buende(projekt: Projekt, liste: Sortimentsliste): Map<string, Bund> {
  /** Union-Find über die Namen: Jeder Name zeigt auf seinen Anker. */
  const anker = new Map<string, string>();
  /** Die Mitglieder je Anker, in ihrer Reihenfolge. */
  const mitglieder = new Map<string, string[]>();

  const wurzel = (k: string): string => {
    let jetzt = k;
    while (anker.get(jetzt) && anker.get(jetzt) !== jetzt) jetzt = anker.get(jetzt)!;
    return jetzt;
  };

  const lege = (name: string) => {
    const k = schluessel(name);
    if (!anker.has(k)) {
      anker.set(k, k);
      mitglieder.set(k, [name.trim()]);
    }
    return wurzel(k);
  };

  /**
   * Führt eine Reihe von Namen zusammen – der erste bleibt vorn.
   *
   * Die Reihenfolge ist die Beschriftung: „Kuchen, Waffeln" liest sich anders
   * herum falsch, und bei einer Zuordnung steht das Ziel voran, weil dort
   * gerechnet wird.
   */
  const verbinde = (namen: string[]) => {
    if (namen.length < 2) return;
    const erste = lege(namen[0]);
    for (const weiterer of namen.slice(1)) {
      const zweite = lege(weiterer);
      if (zweite === erste) continue;
      const dazu = mitglieder.get(zweite) ?? [];
      const bisher = mitglieder.get(erste) ?? [];
      for (const n of dazu) {
        if (!bisher.some((v) => schluessel(v) === schluessel(n))) bisher.push(n);
      }
      mitglieder.set(erste, bisher);
      mitglieder.delete(zweite);
      anker.set(zweite, erste);
    }
  };

  // Erst die gemeinsamen Beschriftungen: Sie stehen im Plan und bestimmen die
  // Reihenfolge, in der die Namen gelesen werden.
  for (const strecke of strecken(projekt)) {
    const ziele = zieleDerStrecke(liste, strecke);
    if (ziele.length > 1) verbinde(ziele.map((z) => z.name));
  }

  // Dann die Zuordnungen. Das Ziel steht voran: Dort laufen die Meter.
  for (const [quelle, ziel] of Object.entries(projekt.zuordnungen ?? {})) {
    if (!ziel?.trim() || schluessel(ziel) === schluessel(quelle)) continue;
    verbinde([schreibweise(liste, ziel), schreibweise(liste, quelle)]);
  }

  const genutzt = pfadeJeName(projekt, liste);
  const fertig = new Map<string, Bund>();
  for (const [wurzelName, namen] of mitglieder) {
    if (namen.length < 2) continue;
    const erste = namen[0];
    // Der Pfad des ersten Namens, wenn er einen hat. Sonst der des ersten
    // Mitglieds, das im Plan steht: Dort liegen die Meter, und dorthin gehört
    // die Zeile – besser als unter „Noch nicht eingeordnet".
    const pfadVonName = (name: string) => {
      const imPlan = genutzt.get(schluessel(name));
      if (imPlan && imPlan.size === 1) return [...imPlan][0];
      return eindeutigerPfad(liste, name);
    };
    let pfad = pfadVonName(erste);
    for (const weiterer of namen.slice(1)) {
      if (pfad) break;
      pfad = pfadVonName(weiterer);
    }
    const bund: Bund = { namen, beschriftung: namen.join(', '), pfad };
    for (const name of namen) fertig.set(schluessel(name), bund);
    void wurzelName;
  }
  return fertig;
}

/**
 * Der Bund zu einem Namen – auch dann, wenn der Name die ganze Beschriftung
 * ist.
 *
 * Eine Strecke ohne Pfad heißt so, wie sie beschriftet ist: „Nüsse,
 * Trockenobst". Diesen Text kennt kein Bund; gesucht wird deshalb auch über
 * seine Teile.
 */
export function bundFuer(
  buende: Map<string, Bund>,
  liste: Sortimentsliste,
  name: string,
): Bund | undefined {
  const direkt = buende.get(schluessel(name));
  if (direkt) return direkt;
  const teile = teileBeschriftung(liste, name);
  if (teile.length < 2) return undefined;
  for (const teil of teile) {
    const treffer = buende.get(schluessel(teil));
    if (treffer) return treffer;
  }
  return undefined;
}

/** Wohin eine Strecke zählt: ein Name mit dem Pfad, den er trägt. */
export interface Streckenziel {
  name: string;
  pfad?: string;
}

/**
 * Wohin eine Strecke zählt – ein Eintrag je Namen darauf.
 *
 * Drei Fragen in einer Reihenfolge, und die Reihenfolge ist der Punkt:
 *
 *  1. **Steht der Name im gespeicherten Pfad?** Dann gilt der Pfad. So ist es
 *     gemeint: Beim Wählen aus der Liste kommen Text und Pfad zusammen.
 *  2. **Ist es ein freier Text?** „Marmorkuchen Aktion" steht in keiner
 *     Liste – dann lehnt er sich an den Pfad an, und die Meter zählen unter
 *     Kuchen. Genau dafür gibt es den Pfad.
 *  3. **Sonst entscheidet der Name selbst.** Wer „Nüsse, Trockenobst"
 *     schreibt und später das Trockenobst herausnimmt, hat eine Strecke, die
 *     „Nüsse" heißt und noch den Pfad des Trockenobsts trägt. Dann gilt
 *     Nüsse: Was dasteht, ist die Aussage, und der Pfad ist ein Rest.
 */
export function zieleDerStrecke(
  liste: Sortimentsliste,
  strecke: { name: string; pfad?: string },
): Streckenziel[] {
  const teile = teileBeschriftung(liste, strecke.name);
  const eigen = strecke.pfad ? letzteStufe(strecke.pfad) : undefined;

  const zuTeil = (teil: string): Streckenziel => {
    if (eigen && schluessel(teil) === schluessel(eigen)) return { name: eigen, pfad: strecke.pfad };
    if (eigen && !kenntNamen(liste, teil)) return { name: eigen, pfad: strecke.pfad };
    return { name: teil, pfad: eindeutigerPfad(liste, teil) };
  };

  if (teile.length === 0) return [{ name: strecke.name, pfad: strecke.pfad }];
  return teile.map(zuTeil);
}

/**
 * Alle Pfade, auf die eine Strecke zählt.
 *
 * Bei einer gemeinsamen Beschriftung sind es mehrere: Beide Sortimente stehen
 * im Markt, und beide gehören in der Liste abgehakt.
 */
export function pfadeDerStrecke(
  liste: Sortimentsliste,
  strecke: { name: string; pfad?: string },
): string[] {
  const aus: string[] = [];
  for (const ziel of zieleDerStrecke(liste, strecke)) {
    if (ziel.pfad) aus.push(ziel.pfad);
  }
  return aus;
}
