import type { BibliothekEintrag } from '../typen/modell';

/**
 * Die Entscheidungslogik der Synchronisation – ohne Netz, ohne Datenbank.
 *
 * Diese Datei rechnet nur: Sie bekommt den hiesigen Stand und den Stand vom
 * Server und sagt, was zu tun ist. Nichts hier hat Nebenwirkungen. Genau
 * deshalb liegt es getrennt: Hier entscheidet sich, ob eine Marktplanung
 * überlebt oder verschwindet, und das muss man testen können, ohne einen
 * Server zu befragen.
 *
 * Die Grundregel lautet: **Pro Planung gewinnt die zuletzt geänderte.** Eine
 * Planung ist ein Ganzes und wird nicht Element für Element verschmolzen –
 * ein halb vom einen und halb vom anderen Rechner zusammengesetzter Grundriss
 * wäre schlimmer als jede Alternative.
 *
 * Haben beide Rechner seit dem letzten Abgleich an derselben Planung
 * gearbeitet, entsteht eine **Gabelung**: Die neuere gewinnt, die ältere wird
 * als Kopie gesichert. Verloren geht dabei nichts.
 */

/** Was im Verzeichnis über eine Planung steht – ohne die Planung selbst. */
export interface Verzeichniseintrag {
  id: string;
  name: string;
  /** In welchem Ordner sie liegt – siehe `Projekt.ordner`. */
  ordner?: string;
  /** Wann er zuletzt gesetzt wurde – siehe `Projekt.ordnerAm`. */
  ordnerAm?: number;
  erstelltAm: number;
  geaendertAm: number;
  anzahlElemente: number;
}

/** Merkzettel über eine gelöschte Planung. */
export interface Grabstein {
  id: string;
  geloeschtAm: number;
}

/** Der Block, der (verschlüsselt) auf dem Server liegt. */
export interface SyncPaket {
  format: 'marktplaner-sync';
  version: number;
  verzeichnis: Verzeichniseintrag[];
  graeber: Grabstein[];
  /** Rechner, die schon in dieses Fach geschrieben haben. */
  geraete: string[];
  /** Zuletzt geöffnete Planung – damit man anderswo dort weitermacht. */
  zuletztGeoeffnet?: string;
  zuletztGeoeffnetAm?: number;
  /** Selbst angelegte Vorlagen der Elementbibliothek. */
  eigeneVorlagen?: BibliothekEintrag[];
}

/** Der Stand auf diesem Rechner. */
export interface LokalerStand {
  verzeichnis: Verzeichniseintrag[];
  graeber: Grabstein[];
  /**
   * Mit welcher Änderungszeit jede Planung zuletzt erfolgreich abgeglichen
   * wurde. Das ist der Bezugspunkt, an dem sich erkennen lässt, ob seither
   * hier, dort oder auf beiden Seiten gearbeitet wurde. Ohne diesen Wert
   * ließe sich „der andere ist neuer" nicht von „beide haben geändert"
   * unterscheiden.
   */
  abgeglichen: Record<string, number>;
  zuletztGeoeffnet?: string;
  zuletztGeoeffnetAm?: number;
  eigeneVorlagen: BibliothekEintrag[];
}

/** Eine Planung, an der beide Rechner gearbeitet haben. */
export interface Gabelung {
  /** Die betroffene Planung. Ihre Kennung behält die neuere Fassung. */
  id: string;
  /** Unter dieser Kennung wird die unterlegene Fassung gesichert. */
  kopieId: string;
  kopieName: string;
  /**
   * Wo die unterlegene Fassung liegt: `lokal` heißt, der Server ist neuer und
   * die hiesige Fassung wandert in die Kopie. `fern` heißt umgekehrt – dann
   * muss die Fassung vom Server geholt und als Kopie abgelegt werden.
   */
  verlierer: 'lokal' | 'fern';
  standAm: number;
}

/** Was nach dem Rechnen zu tun ist. */
export interface Abgleichplan {
  /** Diese Planungen vom Server holen. */
  holen: string[];
  /** Diese Planungen zum Server schicken. */
  schicken: string[];
  /** Diese Planungen hier löschen – anderswo wurden sie gelöscht. */
  loeschenLokal: string[];
  /** Diese Planungen auf dem Server wegräumen. */
  loeschenFern: string[];
  gabelungen: Gabelung[];
  /**
   * Diese Planungen hier einsortieren – anderswo wurden sie verschoben.
   *
   * Getrennt von `holen`: Der Ordner steht im Verzeichnis, nicht in der
   * Planung selbst. Ihn zu übernehmen heißt, ein Feld zu setzen – nicht, die
   * ganze Planung vom Server zu holen.
   */
  ordnerUebernehmen: { id: string; ordner?: string; ordnerAm: number }[];
  /** Das Verzeichnis, das nach getaner Arbeit geschrieben wird. */
  verzeichnis: Verzeichniseintrag[];
  graeber: Grabstein[];
  eigeneVorlagen: BibliothekEintrag[];
  zuletztGeoeffnet?: string;
  zuletztGeoeffnetAm?: number;
}

/**
 * Welcher der beiden Einträge die jüngere Ordnerablage trägt.
 *
 * Fehlt der Zeitpunkt auf beiden Seiten – etwa weil eine Planung von einem
 * Rechner mit älterer Fassung kommt –, bleibt es beim bisherigen Verhalten
 * und die lokale Fassung gilt. Nur wer einen Zeitpunkt mitbringt, kann den
 * anderen überstimmen.
 */
function ordnerSieger(hier: Verzeichniseintrag, dort: Verzeichniseintrag): Verzeichniseintrag {
  return (dort.ordnerAm ?? 0) > (hier.ordnerAm ?? 0) ? dort : hier;
}

/**
 * Ein Zeitpunkt in kurzer, lesbarer Form für den Namen einer Sicherungskopie.
 * Bewusst von Hand gebaut statt über `toLocaleString`, damit derselbe
 * Zeitpunkt auf jedem Rechner denselben Namen ergibt.
 */
export function zeitpunktKurz(ms: number): string {
  const d = new Date(ms);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

/**
 * Rechnet aus, was beim Abgleich zu tun ist.
 *
 * `fern` ist `undefined`, wenn auf dem Server noch nie etwas abgelegt wurde –
 * dann wandert einfach alles Hiesige hoch.
 */
export function planeAbgleich(lokal: LokalerStand, fern: SyncPaket | undefined): Abgleichplan {
  const lokalVerzeichnis = new Map(lokal.verzeichnis.map((e) => [e.id, e]));
  const fernVerzeichnis = new Map((fern?.verzeichnis ?? []).map((e) => [e.id, e]));

  // Grabsteine beider Seiten zusammenlegen; der spätere Zeitpunkt zählt.
  const graeber = new Map<string, number>();
  for (const g of [...lokal.graeber, ...(fern?.graeber ?? [])]) {
    graeber.set(g.id, Math.max(graeber.get(g.id) ?? 0, g.geloeschtAm));
  }

  const holen: string[] = [];
  const schicken: string[] = [];
  const loeschenLokal: string[] = [];
  const loeschenFern: string[] = [];
  const gabelungen: Gabelung[] = [];
  const ordnerUebernehmen: Abgleichplan['ordnerUebernehmen'] = [];
  const verzeichnis: Verzeichniseintrag[] = [];
  const bleibendeGraeber: Grabstein[] = [];

  const alleIds = new Set([...lokalVerzeichnis.keys(), ...fernVerzeichnis.keys(), ...graeber.keys()]);

  for (const id of alleIds) {
    const hier = lokalVerzeichnis.get(id);
    const dort = fernVerzeichnis.get(id);
    const grab = graeber.get(id);
    const juengsteAenderung = Math.max(hier?.geaendertAm ?? 0, dort?.geaendertAm ?? 0);

    // ------------------------------------------------------------ gelöscht
    // Der Grabstein gilt, solange danach niemand mehr an der Planung war.
    // Wurde sie nach dem Löschen anderswo noch geändert, lebt sie weiter –
    // die Arbeit wiegt schwerer als die Löschung.
    if (grab !== undefined && grab >= juengsteAenderung) {
      if (hier) loeschenLokal.push(id);
      if (dort) loeschenFern.push(id);
      bleibendeGraeber.push({ id, geloeschtAm: grab });
      continue;
    }

    // -------------------------------------------------- nur auf einer Seite
    if (hier && !dort) {
      schicken.push(id);
      verzeichnis.push(hier);
      continue;
    }
    if (!hier && dort) {
      holen.push(id);
      verzeichnis.push(dort);
      continue;
    }
    if (!hier || !dort) continue; // kann nicht vorkommen, beruhigt aber TypeScript

    // ---------------------------------------------------- auf beiden Seiten
    if (hier.geaendertAm === dort.geaendertAm) {
      // **Gleicher Stand – bis auf den Ordner.** Einsortieren ändert die
      // Planung nicht und rührt `geaendertAm` deshalb nicht an. Ohne diesen
      // Blick bliebe der Ordner am jeweiligen Rechner hängen, und die beiden
      // Verzeichnisse schrieben ihre Fassung endlos gegeneinander.
      const neuer = ordnerSieger(hier, dort);
      verzeichnis.push(neuer);
      if (neuer === dort && dort.ordner !== hier.ordner) {
        ordnerUebernehmen.push({ id, ordner: dort.ordner, ordnerAm: dort.ordnerAm ?? 0 });
      }
      continue;
    }

    // Der Bezugspunkt vom letzten Abgleich. Fehlt er, ist unbekannt, was
    // beide Seiten voneinander wussten – dann wird vorsichtshalber von einer
    // Gabelung ausgegangen und gesichert.
    const basis = lokal.abgeglichen[id];
    const hierGeaendert = basis === undefined || hier.geaendertAm !== basis;
    const dortGeaendert = basis === undefined || dort.geaendertAm !== basis;

    if (hierGeaendert && dortGeaendert) {
      const fernIstNeuer = dort.geaendertAm > hier.geaendertAm;
      const unterlegen = fernIstNeuer ? hier : dort;
      const gewinner = fernIstNeuer ? dort : hier;

      // Die Kennung der Kopie wird aus der unterlegenen Fassung abgeleitet.
      // Dadurch kommen beide Rechner auf dieselbe Kennung und legen die
      // Sicherung nicht doppelt an.
      const kopieId = `${id}-gabel-${unterlegen.geaendertAm}`;
      const schonDa =
        lokalVerzeichnis.has(kopieId) || fernVerzeichnis.has(kopieId) || graeber.has(kopieId);

      if (!schonDa) {
        const kopieName = `${unterlegen.name} (Stand vom ${zeitpunktKurz(unterlegen.geaendertAm)})`;
        gabelungen.push({
          id,
          kopieId,
          kopieName,
          verlierer: fernIstNeuer ? 'lokal' : 'fern',
          standAm: unterlegen.geaendertAm,
        });
        verzeichnis.push({ ...unterlegen, id: kopieId, name: kopieName });
        schicken.push(kopieId);
      }

      if (fernIstNeuer) holen.push(id);
      else schicken.push(id);
      verzeichnis.push(gewinner);
      continue;
    }

    if (dortGeaendert) {
      holen.push(id);
      verzeichnis.push(dort);
    } else {
      schicken.push(id);
      verzeichnis.push(hier);
    }
  }

  // ------------------------------------------------------- eigene Vorlagen
  // Vereinigung über die Kennung, die hiesige Fassung hat Vorrang. Vorlagen
  // sind klein und werden selten gelöscht – hier ist Nichts-verlieren mehr
  // wert als exaktes Nachvollziehen von Löschungen.
  const vorlagen = new Map<string, BibliothekEintrag>();
  for (const v of fern?.eigeneVorlagen ?? []) vorlagen.set(v.id, v);
  for (const v of lokal.eigeneVorlagen) vorlagen.set(v.id, v);

  // ---------------------------------------------------- zuletzt geöffnet
  // Der spätere Zeitpunkt gewinnt – und nur, wenn es die Planung noch gibt.
  const lebendig = new Set(verzeichnis.map((e) => e.id));
  const kandidaten = [
    { id: lokal.zuletztGeoeffnet, am: lokal.zuletztGeoeffnetAm ?? 0 },
    { id: fern?.zuletztGeoeffnet, am: fern?.zuletztGeoeffnetAm ?? 0 },
  ]
    .filter((k): k is { id: string; am: number } => Boolean(k.id) && lebendig.has(k.id!))
    .sort((a, b) => b.am - a.am);

  return {
    holen,
    schicken,
    loeschenLokal,
    loeschenFern,
    gabelungen,
    ordnerUebernehmen,
    verzeichnis,
    graeber: bleibendeGraeber,
    eigeneVorlagen: [...vorlagen.values()],
    zuletztGeoeffnet: kandidaten[0]?.id,
    zuletztGeoeffnetAm: kandidaten[0]?.am,
  };
}

/**
 * Wie lange ein Grabstein aufgehoben wird.
 *
 * Er muss so lange bleiben, bis ihn jeder Rechner einmal gesehen hat – sonst
 * käme eine gelöschte Planung vom anderen Rechner zurück. Ein Jahr ist für
 * einen Marktplaner reichlich bemessen und kostet fast nichts: Ein Grabstein
 * sind zwei Zahlen.
 */
const GRABSTEIN_HALTBARKEIT = 365 * 24 * 60 * 60 * 1000;

/** Räumt Grabsteine weg, die niemand mehr braucht. */
export function graeberAufraeumen(graeber: Grabstein[], jetzt: number): Grabstein[] {
  return graeber.filter((g) => jetzt - g.geloeschtAm < GRABSTEIN_HALTBARKEIT);
}

/** Baut den Block, der auf dem Server abgelegt wird. */
export function paketBauen(
  plan: Abgleichplan,
  geraet: string,
  bisherigeGeraete: string[],
  jetzt: number,
): SyncPaket {
  return {
    format: 'marktplaner-sync',
    version: 1,
    verzeichnis: plan.verzeichnis,
    graeber: graeberAufraeumen(plan.graeber, jetzt),
    geraete: [...new Set([...bisherigeGeraete, geraet])],
    zuletztGeoeffnet: plan.zuletztGeoeffnet,
    zuletztGeoeffnetAm: plan.zuletztGeoeffnetAm,
    eigeneVorlagen: plan.eigeneVorlagen,
  };
}
