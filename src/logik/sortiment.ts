import {
  EIGENE_ABTEILUNG,
  type Sortimentsabteilung,
  type Sortimentsliste,
} from '../daten/warengruppen';
import type { Sortimentsgruppe } from '../daten/warengruppen';

/**
 * Was in diesem Markt aus dem Sortiment geworden ist.
 *
 * Drei Zustände, von Hand gesetzt:
 *
 *  - **rot** – offen. Der Grundzustand: Was niemand angefasst hat, fehlt noch.
 *  - **grün** – erledigt, steht im Markt.
 *  - **grau** – in diesem Markt nicht vorgesehen. Nicht dasselbe wie
 *    erledigt, und schon gar nicht wie offen: Was es hier nicht gibt, soll
 *    beim Durchgehen weder als Haken noch als Lücke zählen.
 *
 * **Von Hand und nicht geraten.** Vorher wurde am Text abgeglichen, ob eine
 * Warengruppe im Plan steht. Das ging schief, sobald ein Name im anderen
 * steckt: „Kaffee" galt als gesetzt, weil irgendwo „Filterkaffee" stand. Ein
 * Haken, der sich selbst setzt, ist schlimmer als keiner – man verlässt sich
 * darauf.
 *
 * Was mit dem Pinsel zugeordnet wird, hakt sich trotzdem selbst ab: Dort ist
 * der Name genau der Name und nicht ein Teil davon.
 */

/** Die drei Zustände. Rot ist der Grundzustand und wird nicht gespeichert. */
export type Standwert = 'rot' | 'gruen' | 'grau';

/** Was in der Planung steht – siehe `Projekt.sortimentsstand`. */
export type Sortimentsstand = Record<string, 'gruen' | 'grau'>;

/** Kleinschreibung und Leerraum weg – so werden Namen verglichen. */
const schluessel = (text: string) => text.trim().toLocaleLowerCase('de-DE');

/** Der Schlüssel eines Eintrags: seine Stufen mit einem Zeichen dazwischen. */
export function pfadVon(...stufen: string[]): string {
  return stufen.join(' › ');
}

/** Der alte Name für den Pfad einer Warengruppe – bleibt der Lesbarkeit wegen. */
export function schluesselVon(abteilung: string, gruppe: string): string {
  return pfadVon(abteilung, gruppe);
}

/** Der Zustand eines einzelnen Eintrags. */
export function standVon(stand: Sortimentsstand | undefined, pfad: string): Standwert {
  return stand?.[pfad] ?? 'rot';
}

/**
 * Der nächste Zustand beim Anklicken: rot → grün → grau → rot.
 *
 * Grün steht in der Mitte, weil es der häufige Fall ist: Beim Durchgehen hakt
 * man ab, was steht, und nur ab und zu ist etwas gar nicht vorgesehen.
 */
export function naechsterStand(jetzt: Standwert): Standwert {
  return jetzt === 'rot' ? 'gruen' : jetzt === 'gruen' ? 'grau' : 'rot';
}

/**
 * Alle Pfade von einem Eintrag abwärts – er selbst eingeschlossen.
 *
 * Wer eine Warengruppe abhakt, hakt ihre Sortimente mit ab; wer eine ganze
 * Abteilung grau setzt, meint alles darin. Alles andere wäre Klickarbeit.
 */
export function pfadeUnter(liste: Sortimentsliste, pfad: string): string[] {
  const pfade: string[] = [];

  for (const abteilung of liste.abteilungen) {
    const a = pfadVon(abteilung.name);
    for (const gruppe of abteilung.warengruppen) {
      const g = pfadVon(abteilung.name, gruppe.name);
      const sortimente = gruppe.sortimente.map((n) => pfadVon(abteilung.name, gruppe.name, n));
      if (pfad === a || pfad === g) {
        if (pfad === g) pfade.push(g, ...sortimente);
        else pfade.push(g, ...sortimente);
      } else {
        const treffer = sortimente.find((sp) => sp === pfad);
        if (treffer) pfade.push(treffer);
      }
    }
    if (pfad === a) pfade.unshift(a);
  }
  return pfade.length > 0 ? [...new Set(pfade)] : [pfad];
}

/** Wie viele Einträge einer Menge grün, offen und grau sind. */
export interface Standzahlen {
  gruen: number;
  offen: number;
  grau: number;
}

function zaehle(stand: Sortimentsstand | undefined, pfade: string[]): Standzahlen {
  const zahlen: Standzahlen = { gruen: 0, offen: 0, grau: 0 };
  for (const pfad of pfade) {
    const wert = standVon(stand, pfad);
    if (wert === 'gruen') zahlen.gruen++;
    else if (wert === 'grau') zahlen.grau++;
    else zahlen.offen++;
  }
  return zahlen;
}

/**
 * Der Zustand einer Warengruppe, aus ihren Sortimenten abgeleitet.
 *
 * Eine Warengruppe **ohne** Sortimente trägt ihren eigenen Haken. Eine mit
 * Sortimenten richtet sich nach ihnen: Erst wenn alles darunter steht, steht
 * sie. Sonst könnte sie grün sein, während drei ihrer Sortimente fehlen – und
 * genau davor soll die Liste ja warnen.
 */
export function gruppenstand(
  stand: Sortimentsstand | undefined,
  abteilung: string,
  gruppe: Sortimentsgruppeartig,
): { wert: Standwert; zahlen: Standzahlen } {
  const eigen = pfadVon(abteilung, gruppe.name);
  if (gruppe.sortimente.length === 0) {
    const wert = standVon(stand, eigen);
    return {
      wert,
      zahlen: { gruen: wert === 'gruen' ? 1 : 0, offen: wert === 'rot' ? 1 : 0, grau: wert === 'grau' ? 1 : 0 },
    };
  }

  const zahlen = zaehle(
    stand,
    gruppe.sortimente.map((n) => pfadVon(abteilung, gruppe.name, n)),
  );
  return { wert: ausZahlen(zahlen), zahlen };
}

/** Der Zustand einer Abteilung, aus ihren Warengruppen abgeleitet. */
export function abteilungsstand(
  stand: Sortimentsstand | undefined,
  abteilung: Sortimentsabteilung,
): { wert: Standwert; zahlen: Standzahlen } {
  if (abteilung.warengruppen.length === 0) {
    const wert = standVon(stand, pfadVon(abteilung.name));
    return {
      wert,
      zahlen: { gruen: wert === 'gruen' ? 1 : 0, offen: wert === 'rot' ? 1 : 0, grau: wert === 'grau' ? 1 : 0 },
    };
  }

  const zahlen: Standzahlen = { gruen: 0, offen: 0, grau: 0 };
  for (const gruppe of abteilung.warengruppen) {
    const wert = gruppenstand(stand, abteilung.name, gruppe).wert;
    if (wert === 'gruen') zahlen.gruen++;
    else if (wert === 'grau') zahlen.grau++;
    else zahlen.offen++;
  }
  return { wert: ausZahlen(zahlen), zahlen };
}

/**
 * Aus den Zahlen darunter wird der Zustand darüber.
 *
 * Grau zählt nicht mit: Eine Warengruppe, von der die Hälfte hier gar nicht
 * vorgesehen ist, ist erledigt, sobald die andere Hälfte steht. Ist alles
 * grau, ist sie selbst grau – dann gibt es sie hier nicht.
 */
function ausZahlen(zahlen: Standzahlen): Standwert {
  if (zahlen.offen > 0) return 'rot';
  if (zahlen.gruen > 0) return 'gruen';
  return 'grau';
}

/**
 * Hakt einen Namen ab, weil er gerade zugeordnet wurde.
 *
 * Anders als der frühere Textabgleich ist das eindeutig: Der Pinsel schreibt
 * genau diesen Namen, nicht einen, in dem er vorkommt. Grün werden alle
 * Einträge, die so heißen – ein Name kann in zwei Abteilungen stehen.
 */
export function mitAbgehaktemNamen(
  liste: Sortimentsliste,
  stand: Sortimentsstand | undefined,
  name: string,
): Sortimentsstand {
  const gesucht = schluessel(name);
  const neu: Sortimentsstand = { ...(stand ?? {}) };

  for (const abteilung of liste.abteilungen) {
    for (const gruppe of abteilung.warengruppen) {
      if (schluessel(gruppe.name) === gesucht) {
        for (const pfad of pfadeUnter(liste, pfadVon(abteilung.name, gruppe.name))) {
          neu[pfad] = 'gruen';
        }
      }
      for (const sortiment of gruppe.sortimente) {
        if (schluessel(sortiment) === gesucht) {
          neu[pfadVon(abteilung.name, gruppe.name, sortiment)] = 'gruen';
        }
      }
    }
  }
  return neu;
}

/** Setzt eine Menge von Pfaden auf einen Zustand. Rot heißt: nichts merken. */
export function mitStand(
  stand: Sortimentsstand | undefined,
  pfade: string[],
  wert: Standwert,
): Sortimentsstand {
  const neu: Sortimentsstand = { ...(stand ?? {}) };
  for (const pfad of pfade) {
    if (wert === 'rot') delete neu[pfad];
    else neu[pfad] = wert;
  }
  return neu;
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
type Sortimentsgruppeartig = Sortimentsgruppe;

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

/** Was ein Ergänzen hinzugefügt hat – für die Rückmeldung danach. */
export interface Zuwachs {
  abteilungen: number;
  warengruppen: number;
  sortimente: number;
}

/**
 * Ergänzt die vorhandene Liste um alles, was in der neuen dazugekommen ist.
 *
 * Der übliche Weg, wenn die Sortimentsliste des Marktes überarbeitet wurde:
 * Ein paar Sortimente sind dazugekommen, der Rest ist geblieben. **Ersetzen
 * wäre hier falsch** – es würfe weg, was von Hand aufgenommen wurde, und
 * jeder Haken hinge plötzlich an einem Eintrag, den es so nicht mehr gibt.
 *
 * Ergänzt wird deshalb nur, und zwar in der Reihenfolge der neuen Liste
 * eingehängt: Ein neues Sortiment steht dort, wo es in der Tabelle steht,
 * und nicht am Ende. Was in der neuen Liste **fehlt**, bleibt trotzdem
 * stehen: Vielleicht wurde es dort gestrichen, vielleicht steht es nur
 * woanders – und ein Eintrag, den das Programm still entfernt, nimmt einen
 * Haken mit, den jemand gesetzt hat.
 *
 * Verglichen wird ohne Rücksicht auf Groß- und Kleinschreibung; sonst stünde
 * „Bake off" ein zweites Mal neben „Bake Off".
 */
export function vereinigt(
  alt: Sortimentsliste,
  neu: Sortimentsliste,
): { liste: Sortimentsliste; zuwachs: Zuwachs } {
  const zuwachs: Zuwachs = { abteilungen: 0, warengruppen: 0, sortimente: 0 };

  const abteilungen = alt.abteilungen.map((abteilung) => {
    const dazu = neu.abteilungen.find((a) => schluessel(a.name) === schluessel(abteilung.name));
    if (!dazu) return abteilung;

    const warengruppen = abteilung.warengruppen.map((gruppe) => {
      const g = dazu.warengruppen.find((w) => schluessel(w.name) === schluessel(gruppe.name));
      if (!g) return gruppe;

      const bekannt = new Set(gruppe.sortimente.map(schluessel));
      const neue = g.sortimente.filter((sortiment) => !bekannt.has(schluessel(sortiment)));
      if (neue.length === 0) return gruppe;
      zuwachs.sortimente += neue.length;
      return { ...gruppe, sortimente: [...gruppe.sortimente, ...neue] };
    });

    const bekannt = new Set(abteilung.warengruppen.map((w) => schluessel(w.name)));
    const neueGruppen = dazu.warengruppen.filter((w) => !bekannt.has(schluessel(w.name)));
    zuwachs.warengruppen += neueGruppen.length;
    zuwachs.sortimente += neueGruppen.reduce((n, w) => n + w.sortimente.length, 0);

    return { ...abteilung, warengruppen: [...warengruppen, ...neueGruppen] };
  });

  const bekannt = new Set(alt.abteilungen.map((a) => schluessel(a.name)));
  const neueAbteilungen = neu.abteilungen.filter((a) => !bekannt.has(schluessel(a.name)));
  zuwachs.abteilungen = neueAbteilungen.length;
  zuwachs.warengruppen += neueAbteilungen.reduce((n, a) => n + a.warengruppen.length, 0);
  zuwachs.sortimente += neueAbteilungen.reduce(
    (n, a) => n + a.warengruppen.reduce((m, w) => m + w.sortimente.length, 0),
    0,
  );

  return { liste: { abteilungen: [...abteilungen, ...neueAbteilungen] }, zuwachs };
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

    // Eine neue Abteilung setzt die gemerkte Warengruppe zurück. Ohne das
    // rutschte die letzte Warengruppe der vorigen Abteilung mit hinüber und
    // stünde dort als leere Zeile – ein Eintrag, den es nirgends gibt.
    if (a) {
      letzteAbteilung = a;
      letzteGruppe = '';
    }
    if (w) letzteGruppe = w;
    if (!letzteAbteilung) continue;

    let abteilung = abteilungen.find((x) => x.name === letzteAbteilung);
    if (!abteilung) {
      abteilung = { name: letzteAbteilung, warengruppen: [] };
      abteilungen.push(abteilung);
    }
    // Eine Abteilung ohne Warengruppe gibt es – „Pflanzen & Blumen" hat
    // welche, „Centeria" hat eine einzige. Sie darf also allein dastehen.
    if (!letzteGruppe) continue;

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

