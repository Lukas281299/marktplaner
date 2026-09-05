import { eindeutigerPfad, kenntNamen, letzteStufe } from './sortiment';
import { teileBeschriftung, zieleDerStrecke } from './sortimentsbund';
import { strecken } from './warengruppenmeter';
import type { Sortimentsliste } from '../daten/warengruppen';
import type { Projekt, Warengruppenabschnitt } from '../typen/modell';

/**
 * Was eine neue Sortimentsliste an einer Planung anrichtet – und was sich
 * davon nachziehen lässt.
 *
 * **Der Plan merkt sich den ganzen Pfad**, nicht einen Verweis in die Liste.
 * Deshalb geht beim Ersetzen der Liste nichts verloren: Die Meter bleiben, wo
 * sie sind, und die Rechnung stimmt weiter.
 *
 * Was reißen kann, ist die **Verbindung zur Liste**. Wird ein Eintrag in der
 * neuen Datei anders geschrieben oder in eine andere Warengruppe verschoben,
 * dann zeigt der gespeicherte Pfad auf etwas, das die Liste nicht mehr kennt:
 * Der neue Name steht rot da, obwohl seine Meter im Markt stehen, und in der
 * Übersicht taucht der alte Name weiter auf.
 *
 * Deshalb wird nach dem Ersetzen nachgesehen – und dort, wo der Name in der
 * neuen Liste **eindeutig** wiederzufinden ist, lässt sich der Pfad umhängen.
 * Bei einem mehrdeutigen Namen wird nichts angefasst: „Säfte" gibt es zweimal,
 * und die falsche Stelle zu treffen verschöbe Meter zwischen zwei Abteilungen,
 * ohne dass es auffiele.
 */

/** Ein Pfad in der Planung, den die neue Liste nicht mehr kennt. */
export interface VerwaisterPfad {
  /** Der Pfad, wie er in der Planung steht. */
  alt: string;
  /** Wohin er gehört, wenn der Name in der neuen Liste eindeutig ist. */
  neu?: string;
  /** Auf wie vielen laufenden Metern er steht – damit man das Gewicht sieht. */
  meter: number;
}

/** Kennt diese Liste diesen Pfad noch – mit allen Stufen? */
function kenntPfad(liste: Sortimentsliste, pfad: string): boolean {
  const stufen = pfad.split(' › ');
  const abteilung = liste.abteilungen.find((a) => a.name === stufen[0]);
  if (!abteilung) return false;
  if (stufen.length === 1) return true;
  const gruppe = abteilung.warengruppen.find((w) => w.name === stufen[1]);
  if (!gruppe) return false;
  if (stufen.length === 2) return true;
  return gruppe.sortimente.includes(stufen[2]);
}

/**
 * Welche Pfade einer Planung die neue Liste nicht mehr kennt.
 *
 * Geordnet nach Metern: Was am schwersten wiegt, steht oben. Ein Pfad kommt
 * nur einmal vor, auch wenn er an fünf Möbeln steht.
 */
export function verwaistePfade(projekt: Projekt, liste: Sortimentsliste): VerwaisterPfad[] {
  const meter = new Map<string, number>();

  for (const strecke of strecken(projekt)) {
    for (const ziel of zieleDerStrecke(liste, strecke)) {
      if (!ziel.pfad || kenntPfad(liste, ziel.pfad)) continue;
      meter.set(ziel.pfad, (meter.get(ziel.pfad) ?? 0) + strecke.laenge);
    }
  }

  const aus: VerwaisterPfad[] = [];
  for (const [alt, laenge] of meter) {
    const name = letzteStufe(alt);
    // Nur wenn die neue Liste den Namen **einmal** kennt. Sonst bleibt es
    // stehen, und der Planer entscheidet am Möbel.
    const neu = kenntNamen(liste, name) ? eindeutigerPfad(liste, name) : undefined;
    aus.push({ alt, neu: neu && neu !== alt ? neu : undefined, meter: Math.round(laenge) });
  }
  return aus.sort((a, b) => b.meter - a.meter || a.alt.localeCompare(b.alt, 'de'));
}

/**
 * Hängt die Pfade einer Planung um – nur die, die eindeutig sind.
 *
 * Gibt die Elemente zurück, wenn sich etwas geändert hat, sonst `null`. Der
 * **Text im Plan bleibt stehen**: Er ist die Beschriftung, die jemand gewählt
 * hat, und die neue Liste hat daran nichts zu ändern.
 */
export function mitNachgezogenenPfaden(
  projekt: Projekt,
  umzug: Map<string, string>,
): Projekt['elemente'] | null {
  if (umzug.size === 0) return null;
  let geaendert = false;

  const elemente = projekt.elemente.map((element) => {
    const ziehe = (abschnitte: typeof element.warengruppenUnten) =>
      abschnitte?.map((abschnitt) => {
        const neu = abschnitt.pfad ? umzug.get(abschnitt.pfad) : undefined;
        if (!neu) return abschnitt;
        geaendert = true;
        return { ...abschnitt, pfad: neu };
      });

    const unten = ziehe(element.warengruppenUnten);
    const oben = ziehe(element.warengruppenOben);
    if (unten === element.warengruppenUnten && oben === element.warengruppenOben) return element;
    return {
      ...element,
      ...(unten ? { warengruppenUnten: unten } : {}),
      ...(oben ? { warengruppenOben: oben } : {}),
    };
  });

  return geaendert ? elemente : null;
}

// ===========================================================================
//  Beschriftungen, die nicht mehr so heißen wie die Liste
// ===========================================================================

/**
 * Der Pfad stimmt – der Name im Plan nicht mehr.
 *
 * **Zwei Dinge hängen an einer Strecke:** wohin sie zählt (der Pfad) und was
 * am Möbel steht (der Text). Beim Aufnehmen aus der Liste sind sie derselbe
 * Name; danach ist der Text eine **Kopie**, die für sich lebt. Wird der
 * Eintrag in der Liste umbenannt, zieht der Pfad mit – die Kopie nicht,
 * jedenfalls nicht in Planungen, die gerade nicht offen sind, und nicht in
 * Fassungen, die vor dem Nachziehen entstanden sind.
 *
 * Das Ergebnis sieht man sofort und versteht es nicht: Die Auswertung führt
 * „Aufbackware", im Plan steht weiter „Aufbackware Brötchen". Gerechnet ist
 * es richtig, gelesen ist es falsch – und der Plan ist das, was ausgedruckt
 * an der Wand hängt.
 *
 * **Gemeldet wird nur, was nichts trägt.** Steht im Text ein Name, den die
 * Liste kennt, dann ist er Teil der Rechnung – „Nüsse, Trockenobst" auf einer
 * Strecke sind zwei Sortimente, und daran wird nichts angeglichen. Übrig
 * bleiben Texte, die in der Rechnung gar nicht vorkommen: der veraltete Name
 * und der frei geschriebene Satz. Welcher von beiden es ist, weiß nur der
 * Planer – deshalb wird gezeigt und nicht stillschweigend ersetzt.
 */
export interface VeralteteBeschriftung {
  /** Der Pfad, der weiterhin stimmt. */
  pfad: string;
  /** Was im Plan steht. */
  alt: string;
  /** Wie der Eintrag in der Liste heute heißt. */
  neu: string;
  /** Auf wie vielen Zentimetern – damit man das Gewicht sieht. */
  meter: number;
}

/** Der Schlüssel einer Zeile: derselbe falsche Name am selben Pfad ist eine. */
export function beschriftungsschluessel(pfad: string, alt: string): string {
  return JSON.stringify([pfad, alt]);
}

const zeichen = (text: string) => text.trim().toLocaleLowerCase('de-DE');

/** Jeder Abschnitt einer Planung, Ebene hin oder her. */
function alleAbschnitte(projekt: Projekt): Warengruppenabschnitt[] {
  const aus: Warengruppenabschnitt[] = [];
  for (const element of projekt.elemente ?? []) {
    aus.push(...(element.warengruppenUnten ?? []), ...(element.warengruppenOben ?? []));
  }
  return aus;
}

/**
 * Welche Beschriftungen einer Planung nicht mehr zur Liste passen.
 *
 * **Über alle Ebenen**, auch die ausgeblendeten: Was man gerade nicht sieht,
 * ist trotzdem falsch beschriftet, und beim nächsten Einblenden stünde es
 * wieder da.
 *
 * Geordnet nach Metern. Derselbe falsche Name am selben Pfad kommt einmal
 * vor, auch wenn er an zwölf Möbeln steht.
 */
export function veralteteBeschriftungen(
  projekt: Projekt,
  liste: Sortimentsliste,
): VeralteteBeschriftung[] {
  const zeilen = new Map<string, VeralteteBeschriftung>();

  for (const abschnitt of alleAbschnitte(projekt)) {
    const pfad = abschnitt.pfad;
    if (!pfad) continue;
    // Ohne Pfad ist nichts zu vergleichen, und ein eigener Satz bleibt seiner.
    if (abschnitt.eigenerText) continue;
    // **Eine Aktionsstrecke heißt nie wie die Liste.** „Ostergebäck" zählt zu
    // den Feinbackwaren und heißt nicht so – das ist ihr Wesen und kein
    // veralteter Name. Am Aktionsziel steht es wörtlich: „die Beschriftung
    // bleibt stehen".
    if (abschnitt.aktion) continue;
    // Einen Pfad, den die Liste nicht mehr kennt, behandelt `verwaistePfade`.
    if (!kenntPfad(liste, pfad)) continue;

    const alt = abschnitt.text.trim();
    if (!alt) continue;
    const neu = letzteStufe(pfad);
    if (zeichen(alt) === zeichen(neu)) continue;

    // **Trägt der Text selbst etwas zur Rechnung bei, bleibt er.** Sonst
    // machte das Angleichen aus „Nüsse, Trockenobst" ein einzelnes Sortiment
    // und verschöbe Meter.
    if (teileBeschriftung(liste, alt).some((teil) => kenntNamen(liste, teil))) continue;

    const schluessel = beschriftungsschluessel(pfad, alt);
    const laenge = Math.max(0, abschnitt.bis - abschnitt.von);
    const da = zeilen.get(schluessel);
    if (da) da.meter += laenge;
    else zeilen.set(schluessel, { pfad, alt, neu, meter: laenge });
  }

  return [...zeilen.values()]
    .map((z) => ({ ...z, meter: Math.round(z.meter) }))
    .sort((a, b) => b.meter - a.meter || a.alt.localeCompare(b.alt, 'de'));
}

/** Was mit einer gemeldeten Zeile geschehen soll. */
export type Beschriftungsentscheidung = 'angleichen' | 'behalten';

/**
 * Gleicht die Beschriftungen an – oder merkt sich, dass sie so bleiben sollen.
 *
 * `angleichen` schreibt den Namen aus der Liste in den Plan. `behalten` rührt
 * den Text nicht an und setzt `eigenerText`: Damit ist die Frage einmal
 * beantwortet und die Zeile kommt nicht wieder. Ohne dieses Merken stünde
 * „Marmorkuchen Aktion" nach jedem Umbenennen erneut im Bericht, und man
 * müsste jedes Mal aufs Neue Nein sagen.
 *
 * Zurück kommen die Elemente und **wie viele Abschnitte** wirklich betroffen
 * waren. Das ist nicht die Zahl der Zeilen: Der Bericht ist eine Momentaufnahme,
 * und wer inzwischen im Plan gearbeitet hat, findet eine Zeile womöglich nicht
 * mehr vor. Gemeldet wird, was tatsächlich geschehen ist – eine Zahl, die
 * größer klingt als die Wirklichkeit, wäre schlimmer als eine kleine.
 *
 * `null`, wenn sich nichts geändert hat.
 */
export function mitAngeglichenenBeschriftungen(
  projekt: Projekt,
  entscheidungen: Map<string, Beschriftungsentscheidung>,
): { elemente: Projekt['elemente']; zahl: number } | null {
  if (entscheidungen.size === 0) return null;
  let zahl = 0;

  const elemente = (projekt.elemente ?? []).map((element) => {
    const ziehe = (abschnitte: typeof element.warengruppenUnten) =>
      abschnitte?.map((abschnitt) => {
        // Dieselbe Ausnahme wie beim Suchen – der Schlüssel kommt aus einer
        // Momentaufnahme, und inzwischen kann aus der Strecke eine Aktion
        // geworden sein.
        if (!abschnitt.pfad || abschnitt.eigenerText || abschnitt.aktion) return abschnitt;
        const alt = abschnitt.text.trim();
        const wahl = entscheidungen.get(beschriftungsschluessel(abschnitt.pfad, alt));
        if (!wahl) return abschnitt;
        zahl++;
        if (wahl === 'behalten') return { ...abschnitt, eigenerText: true };
        return { ...abschnitt, text: letzteStufe(abschnitt.pfad) };
      });

    const unten = ziehe(element.warengruppenUnten);
    const oben = ziehe(element.warengruppenOben);
    if (unten === element.warengruppenUnten && oben === element.warengruppenOben) return element;
    return {
      ...element,
      ...(unten ? { warengruppenUnten: unten } : {}),
      ...(oben ? { warengruppenOben: oben } : {}),
    };
  });

  return zahl > 0 ? { elemente, zahl } : null;
}
