import { eindeutigerPfad, kenntNamen, letzteStufe } from './sortiment';
import { zieleDerStrecke } from './sortimentsbund';
import { strecken } from './warengruppenmeter';
import type { Sortimentsliste } from '../daten/warengruppen';
import type { Projekt } from '../typen/modell';

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
