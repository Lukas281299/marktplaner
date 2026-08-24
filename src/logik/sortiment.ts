import {
  EIGENE_ABTEILUNG,
  type Sortimentsabteilung,
  type Sortimentsliste,
} from '../daten/warengruppen';
import { felderVon, seitenVon } from './regalseiten';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Was vom Sortiment schon im Plan steht – und was noch fehlt.
 *
 * Das ist der eigentliche Zweck der Liste: Am Ende einer Planung will man
 * wissen, ob etwas vergessen wurde. Deshalb wird jeder Name der Liste gegen
 * das gehalten, was im Plan geschrieben steht. Was dasteht, ist grün; was
 * fehlt, ist rot.
 *
 * **Verglichen wird über den Text, nicht über eine Kennung.** Eine
 * Beschriftung entsteht beim Schreiben, nicht beim Anklicken einer Liste –
 * wer „Babypflege" von Hand tippt, hat Babypflege platziert. Und wer
 * „Babypflege, Windeln" auf einen Meter schreibt, hat beides platziert:
 * Gesucht wird deshalb, ob der Name **im** Text vorkommt.
 *
 * Zwei Regeln nach unten und oben:
 *
 *  - Steht eine **Warengruppe** im Plan, gelten alle ihre Sortimente als
 *    platziert. Wer „Molkereiprodukte" über sechs Meter schreibt, hat die
 *    Butter nicht vergessen, sondern nicht einzeln aufgeführt.
 *  - Eine Warengruppe gilt auch dann als platziert, wenn **alle** ihre
 *    Sortimente einzeln dastehen. Sonst bliebe sie rot, obwohl nichts fehlt.
 */

/** Kleinschreibung und Leerraum weg – so wird verglichen. */
const schluessel = (text: string) => text.trim().toLocaleLowerCase('de-DE');

/**
 * Jede Warengruppen-Beschriftung, die im Plan steht.
 *
 * Aus den Feldern beider Seiten und aus der Warengruppe am Element selbst.
 * Beides sind Aussagen darüber, was dort liegt – die eine steht im Bild, die
 * andere in den Zusatzangaben.
 */
export function platzierteTexte(projekt: Pick<Projekt, 'elemente'>): string[] {
  const texte: string[] = [];

  for (const element of projekt.elemente ?? []) {
    if (element.warengruppe?.trim()) texte.push(element.warengruppe);
    for (const seite of seitenVon(element)) {
      for (const feld of felderVon(element, seite)) {
        const text = feld.warengruppe?.text;
        if (text?.trim()) texte.push(text);
      }
    }
  }
  return texte;
}

/** Kommt dieser Name in einem der Texte vor? */
export function istPlatziert(texte: string[], name: string): boolean {
  const gesucht = schluessel(name);
  if (!gesucht) return false;
  return texte.some((text) => schluessel(text).includes(gesucht));
}

/** Was von einer Warengruppe im Plan steht. */
export interface Gruppenstand {
  /** Die Warengruppe selbst steht im Plan oder alle ihre Sortimente. */
  platziert: boolean;
  /** Welche Sortimente dastehen – nach Namen. */
  sortimente: Map<string, boolean>;
}

/**
 * Der Stand des ganzen Sortiments, Warengruppe für Warengruppe.
 *
 * Der Schlüssel ist `Abteilung › Warengruppe`, damit gleiche Namen in
 * verschiedenen Abteilungen sich nicht in die Quere kommen – „Snacks" gibt es
 * bei den Backwaren und bei den Knabberartikeln.
 */
export function abdeckung(liste: Sortimentsliste, texte: string[]): Map<string, Gruppenstand> {
  const stand = new Map<string, Gruppenstand>();

  for (const abteilung of liste.abteilungen) {
    for (const gruppe of abteilung.warengruppen) {
      const selbst = istPlatziert(texte, gruppe.name);
      const sortimente = new Map<string, boolean>(
        gruppe.sortimente.map((s) => [s, selbst || istPlatziert(texte, s)]),
      );
      const alle = sortimente.size > 0 && [...sortimente.values()].every(Boolean);
      stand.set(schluesselVon(abteilung.name, gruppe.name), {
        platziert: selbst || alle,
        sortimente,
      });
    }
  }
  return stand;
}

/** Der Schlüssel einer Warengruppe innerhalb ihrer Abteilung. */
export function schluesselVon(abteilung: string, gruppe: string): string {
  return `${abteilung} › ${gruppe}`;
}

/** Wie viele Warengruppen einer Abteilung schon stehen. */
export function abteilungsstand(
  abteilung: Sortimentsabteilung,
  stand: Map<string, Gruppenstand>,
): { platziert: number; gesamt: number } {
  const gesamt = abteilung.warengruppen.length;
  const platziert = abteilung.warengruppen.filter(
    (w) => stand.get(schluesselVon(abteilung.name, w.name))?.platziert,
  ).length;
  return { platziert, gesamt };
}

/**
 * Die Liste, auf eine Sucheingabe eingedampft.
 *
 * Gesucht wird auf allen drei Stufen. Trifft eine Abteilung oder eine
 * Warengruppe, bleibt sie mit allem darunter stehen: Wer „molk" tippt, will
 * die Abteilung sehen und nicht ihren Namen allein.
 */
export function gefiltert(liste: Sortimentsliste, suche: string): Sortimentsliste {
  const text = schluessel(suche);
  if (!text) return liste;

  const abteilungen = liste.abteilungen
    .map((abteilung) => {
      if (schluessel(abteilung.name).includes(text)) return abteilung;

      const warengruppen = abteilung.warengruppen
        .map((gruppe) => {
          if (schluessel(gruppe.name).includes(text)) return gruppe;
          const treffer = gruppe.sortimente.filter((s) => schluessel(s).includes(text));
          return treffer.length > 0 ? { ...gruppe, sortimente: treffer } : null;
        })
        .filter((g): g is Sortimentsgruppeartig => g !== null);

      return warengruppen.length > 0 ? { ...abteilung, warengruppen } : null;
    })
    .filter((a): a is Sortimentsabteilung => a !== null);

  return { abteilungen };
}

/** Hilfstyp, damit der Filter oben lesbar bleibt. */
type Sortimentsgruppeartig = Sortimentsabteilung['warengruppen'][number];

/** Steht dieser Name schon irgendwo in der Liste? */
export function kenntNamen(liste: Sortimentsliste, name: string): boolean {
  const gesucht = schluessel(name);
  return liste.abteilungen.some((a) =>
    a.warengruppen.some(
      (w) => schluessel(w.name) === gesucht || w.sortimente.some((s) => schluessel(s) === gesucht),
    ),
  );
}

/**
 * Nimmt einen Namen in die Liste auf.
 *
 * Ohne Angabe landet er unter „Eigene". Wer ihn später richtig einordnen
 * will, tut das in der Datei – hier geht es darum, beim Schreiben nicht
 * aufgehalten zu werden.
 *
 * Gibt `null` zurück, wenn es nichts zu tun gibt: Der Name ist leer oder
 * steht schon da.
 */
export function mitAufgenommenem(
  liste: Sortimentsliste,
  name: string,
  abteilung = EIGENE_ABTEILUNG,
  warengruppe = EIGENE_ABTEILUNG,
): Sortimentsliste | null {
  const sauber = name.trim();
  if (!sauber || kenntNamen(liste, sauber)) return null;

  const vorhanden = liste.abteilungen.find((a) => a.name === abteilung);
  if (!vorhanden) {
    return {
      abteilungen: [
        ...liste.abteilungen,
        { name: abteilung, warengruppen: [{ name: warengruppe, sortimente: [sauber] }] },
      ],
    };
  }

  return {
    abteilungen: liste.abteilungen.map((a) => {
      if (a.name !== abteilung) return a;
      const gruppe = a.warengruppen.find((w) => w.name === warengruppe);
      if (!gruppe) {
        return { ...a, warengruppen: [...a.warengruppen, { name: warengruppe, sortimente: [sauber] }] };
      }
      return {
        ...a,
        warengruppen: a.warengruppen.map((w) =>
          w.name === warengruppe ? { ...w, sortimente: [...w.sortimente, sauber] } : w,
        ),
      };
    }),
  };
}

// ---------------------------------------------------------------- Pflegen

/**
 * Die Liste ändern: umbenennen, anlegen, entfernen.
 *
 * Alle drei Stufen, mit derselben Handschrift: Es entsteht immer eine **neue**
 * Liste, die alte bleibt unangetastet. Das kostet ein paar Zeilen mehr und
 * spart die Fehlersorte, bei der eine Änderung an einer Stelle woanders
 * durchschlägt.
 *
 * Was es nicht gibt, wird nicht angelegt: Wer eine Warengruppe in einer
 * Abteilung umbenennt, die es nicht mehr gibt, bekommt die Liste zurück, wie
 * sie war. Ein stillschweigend neu angelegter Eintrag wäre schlimmer als
 * nichts – man sucht ihn dann an der falschen Stelle.
 */

/** Eine Abteilung anlegen. Ein Name, den es schon gibt, wird nicht verdoppelt. */
export function mitAbteilung(liste: Sortimentsliste, name: string): Sortimentsliste {
  const sauber = name.trim();
  if (!sauber || liste.abteilungen.some((a) => a.name === sauber)) return liste;
  return { abteilungen: [...liste.abteilungen, { name: sauber, warengruppen: [] }] };
}

/** Eine Abteilung mitsamt allem darunter entfernen. */
export function ohneAbteilung(liste: Sortimentsliste, name: string): Sortimentsliste {
  return { abteilungen: liste.abteilungen.filter((a) => a.name !== name) };
}

/** Eine Abteilung umbenennen. */
export function umbenannteAbteilung(
  liste: Sortimentsliste,
  alt: string,
  neu: string,
): Sortimentsliste {
  const sauber = neu.trim();
  if (!sauber) return liste;
  return {
    abteilungen: liste.abteilungen.map((a) => (a.name === alt ? { ...a, name: sauber } : a)),
  };
}

/** Eine Warengruppe in einer Abteilung anlegen. */
export function mitWarengruppe(
  liste: Sortimentsliste,
  abteilung: string,
  name: string,
): Sortimentsliste {
  const sauber = name.trim();
  if (!sauber) return liste;
  return {
    abteilungen: liste.abteilungen.map((a) =>
      a.name === abteilung && !a.warengruppen.some((w) => w.name === sauber)
        ? { ...a, warengruppen: [...a.warengruppen, { name: sauber, sortimente: [] }] }
        : a,
    ),
  };
}

/** Eine Warengruppe mitsamt ihren Sortimenten entfernen. */
export function ohneWarengruppe(
  liste: Sortimentsliste,
  abteilung: string,
  name: string,
): Sortimentsliste {
  return {
    abteilungen: liste.abteilungen.map((a) =>
      a.name === abteilung ? { ...a, warengruppen: a.warengruppen.filter((w) => w.name !== name) } : a,
    ),
  };
}

/** Eine Warengruppe umbenennen. */
export function umbenannteWarengruppe(
  liste: Sortimentsliste,
  abteilung: string,
  alt: string,
  neu: string,
): Sortimentsliste {
  const sauber = neu.trim();
  if (!sauber) return liste;
  return {
    abteilungen: liste.abteilungen.map((a) =>
      a.name === abteilung
        ? {
            ...a,
            warengruppen: a.warengruppen.map((w) => (w.name === alt ? { ...w, name: sauber } : w)),
          }
        : a,
    ),
  };
}

/** Ein Sortiment in einer Warengruppe anlegen. */
export function mitSortiment(
  liste: Sortimentsliste,
  abteilung: string,
  gruppe: string,
  name: string,
): Sortimentsliste {
  const sauber = name.trim();
  if (!sauber) return liste;
  return aendereGruppe(liste, abteilung, gruppe, (w) =>
    w.sortimente.includes(sauber) ? w : { ...w, sortimente: [...w.sortimente, sauber] },
  );
}

/** Ein Sortiment entfernen. */
export function ohneSortiment(
  liste: Sortimentsliste,
  abteilung: string,
  gruppe: string,
  name: string,
): Sortimentsliste {
  return aendereGruppe(liste, abteilung, gruppe, (w) => ({
    ...w,
    sortimente: w.sortimente.filter((s) => s !== name),
  }));
}

/** Ein Sortiment umbenennen. */
export function umbenanntesSortiment(
  liste: Sortimentsliste,
  abteilung: string,
  gruppe: string,
  alt: string,
  neu: string,
): Sortimentsliste {
  const sauber = neu.trim();
  if (!sauber) return liste;
  return aendereGruppe(liste, abteilung, gruppe, (w) => ({
    ...w,
    sortimente: w.sortimente.map((s) => (s === alt ? sauber : s)),
  }));
}

/** Der gemeinsame Weg zu einer Warengruppe – die drei Sortimentsschritte teilen ihn. */
function aendereGruppe(
  liste: Sortimentsliste,
  abteilung: string,
  gruppe: string,
  wandeln: (w: Sortimentsgruppeartig) => Sortimentsgruppeartig,
): Sortimentsliste {
  return {
    abteilungen: liste.abteilungen.map((a) =>
      a.name === abteilung
        ? { ...a, warengruppen: a.warengruppen.map((w) => (w.name === gruppe ? wandeln(w) : w)) }
        : a,
    ),
  };
}

/**
 * Liest eine Sortimentsliste aus einer Datei.
 *
 * Zwei Formate, weil zwei Wege dorthin führen: die JSON-Datei, die aus der
 * Sortimentsliste des Marktes entsteht, und eine einfache Tabelle mit drei
 * Spalten (Abteilung; Warengruppe; Sortiment), wie sie jedes
 * Tabellenprogramm ausgibt. Leere Zellen übernehmen den Wert der Zeile
 * darüber – so, wie man so eine Tabelle schreibt.
 *
 * Wirft mit einer verständlichen Meldung, wenn nichts Brauchbares drinsteht.
 * Eine stillschweigend leere Liste wäre schlimmer: Dann stünde alles auf rot
 * und niemand wüsste, warum.
 */
export function leseSortimentsliste(inhalt: string): Sortimentsliste {
  const roh = inhalt.trim();
  if (!roh) throw new Error('Die Datei ist leer.');

  if (roh.startsWith('{') || roh.startsWith('[')) return ausJson(roh);
  return ausTabelle(roh);
}

function ausJson(roh: string): Sortimentsliste {
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    throw new Error('Die Datei ist keine gültige JSON-Datei.');
  }

  const abteilungenRoh = Array.isArray(daten)
    ? daten
    : (daten as { abteilungen?: unknown }).abteilungen;
  if (!Array.isArray(abteilungenRoh)) {
    throw new Error('In der Datei steht keine Liste von Abteilungen.');
  }

  const abteilungen = abteilungenRoh
    .map((a) => {
      const eintrag = a as { name?: unknown; warengruppen?: unknown };
      if (typeof eintrag.name !== 'string' || !Array.isArray(eintrag.warengruppen)) return null;
      const warengruppen = eintrag.warengruppen
        .map((w) => {
          const g = w as { name?: unknown; sortimente?: unknown };
          if (typeof g.name !== 'string') return null;
          const sortimente = Array.isArray(g.sortimente)
            ? g.sortimente.filter((s): s is string => typeof s === 'string' && s.trim() !== '')
            : [];
          return { name: g.name, sortimente };
        })
        .filter((g): g is Sortimentsgruppeartig => g !== null);
      return { name: eintrag.name, warengruppen };
    })
    .filter((a): a is Sortimentsabteilung => a !== null);

  if (abteilungen.length === 0) throw new Error('In der Datei steht keine einzige Abteilung.');
  return { abteilungen };
}

function ausTabelle(roh: string): Sortimentsliste {
  const trenner = roh.includes('\t') ? '\t' : roh.includes(';') ? ';' : ',';
  const abteilungen: Sortimentsabteilung[] = [];
  let letzteAbteilung = '';
  let letzteGruppe = '';

  for (const zeile of roh.split(/\r?\n/)) {
    if (!zeile.trim()) continue;
    const spalten = zeile.split(trenner).map((z) => z.trim().replace(/^"|"$/g, ''));
    const [a, w, s] = [spalten[0] ?? '', spalten[1] ?? '', spalten[2] ?? ''];

    // Eine Kopfzeile erkennt man daran, dass sie sich selbst beschreibt.
    if (schluessel(a) === 'abteilung') continue;

    if (a) letzteAbteilung = a;
    if (w) letzteGruppe = w;
    if (!letzteAbteilung || !letzteGruppe) continue;

    let abteilung = abteilungen.find((x) => x.name === letzteAbteilung);
    if (!abteilung) {
      abteilung = { name: letzteAbteilung, warengruppen: [] };
      abteilungen.push(abteilung);
    }
    let gruppe = abteilung.warengruppen.find((x) => x.name === letzteGruppe);
    if (!gruppe) {
      gruppe = { name: letzteGruppe, sortimente: [] };
      abteilung.warengruppen.push(gruppe);
    }
    if (s && !gruppe.sortimente.includes(s)) gruppe.sortimente.push(s);
  }

  if (abteilungen.length === 0) {
    throw new Error(
      'Aus der Tabelle ließ sich nichts lesen. Erwartet werden drei Spalten: Abteilung, Warengruppe, Sortiment.',
    );
  }
  return { abteilungen };
}

/** Zählt, was in einer Liste steht – für die Anzeige nach dem Laden. */
export function umfang(liste: Sortimentsliste): {
  abteilungen: number;
  warengruppen: number;
  sortimente: number;
} {
  return {
    abteilungen: liste.abteilungen.length,
    warengruppen: liste.abteilungen.reduce((n, a) => n + a.warengruppen.length, 0),
    sortimente: liste.abteilungen.reduce(
      (n, a) => n + a.warengruppen.reduce((m, w) => m + w.sortimente.length, 0),
      0,
    ),
  };
}

/** Nur zur Sicherheit: `PlanElement` wird über `felderVon` mitgelesen. */
export type { PlanElement };
