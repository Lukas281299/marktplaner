import type { Projekt } from '../typen/modell';
import { paketBauen, planeAbgleich, type SyncPaket, type Verzeichniseintrag } from './abgleich';
import { entschluesseln, kontoKennung, verschluesseln } from './krypto';
import {
  entferneProjektStill,
  holeAbgleichStand,
  holeGeraeteName,
  holeZuletztGeoeffnet,
  holeZuletztGeoeffnetAm,
  ladeProjekt,
  listeGraeber,
  listeProjekte,
  listeVorlagen,
  merkeZuletztGeoeffnet,
  setzeGraeber,
  speichereAbgleichStand,
  speichereLetztenAbgleich,
  speichereVorlage,
  uebernehmeProjekt,
  type SyncZugang,
} from './projektArchiv';
import { wandleProjekt } from './wandlung';

/**
 * Der Teil, der mit dem Server spricht.
 *
 * Die Reihenfolge ist mit Absicht so gewählt, dass ein Abbruch an jeder Stelle
 * folgenlos bleibt:
 *
 *   1. Verzeichnis holen und rechnen, was zu tun ist
 *   2. fremde Planungen herunterladen (nur in den Arbeitsspeicher)
 *   3. eigene Planungen hochladen
 *   4. Verzeichnis schreiben – erst hier wird der neue Stand gültig
 *   5. lokal übernehmen und aufräumen
 *
 * Reißt die Verbindung vor Schritt 4 ab, steht danach genau der Zustand von
 * vorher. Hochgeladene Planungen, auf die noch kein Verzeichnis zeigt, stören
 * niemanden – sie werden beim nächsten Versuch einfach überschrieben.
 */

export interface SyncErgebnis {
  /** Planungen insgesamt nach dem Abgleich. */
  planungen: number;
  /** Wie viele vom anderen Rechner dazukamen oder aktualisiert wurden. */
  geholt: number;
  geschickt: number;
  geloescht: number;
  /** Planungen, an denen beide Rechner gearbeitet haben – gesichert als Kopie. */
  gabelungen: string[];
  /**
   * Kennungen der Planungen, die hier neu geschrieben wurden. Die Oberfläche
   * muss das wissen: Ist die gerade geöffnete Planung dabei, zeigt der
   * Bildschirm einen überholten Stand, und der nächste Tastendruck würde ihn
   * über den geholten zurückschreiben.
   */
  aktualisiert: string[];
  /** Kennungen der Planungen, die anderswo gelöscht wurden. */
  entfernt: string[];
  /** Die Planung, an der zuletzt gearbeitet wurde – egal an welchem Rechner. */
  zuletztGeoeffnet?: string;
  /** Rechner, die schon in dieses Fach geschrieben haben. */
  geraete: string[];
  /**
   * Warnung, wenn dieser Rechner als einziger in einem sonst leeren Fach sitzt.
   * Typisch dafür, dass am zweiten Rechner ein neuer Kopplungscode erzeugt
   * statt der vorhandene eingegeben wurde.
   */
  alleinImFach: boolean;
  zeitpunkt: number;
}

function saubereAdresse(adresse: string): string {
  return adresse.trim().replace(/\/+$/, '');
}

/**
 * Jeder Zugriff aufs Netz läuft hierüber.
 *
 * Scheitert eine Anfrage schon auf Netzebene, wirft der Browser ein nacktes
 * „Failed to fetch" – eine Meldung, aus der niemand etwas ableiten kann. Sie
 * bedeutet in der Praxis fast immer eines von dreien: keine Verbindung, die
 * Adresse stimmt nicht, oder der Worker ist abgestürzt und Cloudflares
 * Fehlerseite kommt ohne CORS-Kopfzeilen zurück.
 */
async function netz(adresse: string, pfad: string, optionen?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${saubereAdresse(adresse)}${pfad}`, optionen);
  } catch {
    throw new Error(
      'Keine Antwort vom Server. Entweder ist gerade keine Verbindung da, ' +
        'oder der Worker läuft nicht sauber. Ruf die Adresse einmal im Browser auf: ' +
        'Dort muss {"dienst":"marktplaner-sync",…} stehen.',
    );
  }
}

async function hole(adresse: string, pfad: string): Promise<Response> {
  return netz(adresse, pfad, { method: 'GET' });
}

/**
 * Zieht die Begründung aus einer abschlägigen Antwort.
 *
 * Der Worker legt seinen Grund immer ins Feld `fehler`. Den weiterzureichen
 * ist der Unterschied zwischen „Abholen fehlgeschlagen (500)" und einem Satz,
 * der sagt, welcher Haken in Cloudflare fehlt.
 */
async function begruendung(antwort: Response, ersatz: string): Promise<string> {
  const daten = (await antwort.json().catch(() => null)) as { fehler?: string } | null;
  return daten?.fehler ?? `${ersatz} (${antwort.status}).`;
}

/**
 * Prüft, ob unter der Adresse wirklich das Vermittlungsprogramm läuft.
 *
 * Ohne diese Prüfung würde ein Tippfehler in der Adresse erst beim ersten
 * Abgleich auffallen – und dann mit einer Meldung, die niemand versteht.
 */
export async function serverPruefen(adresse: string): Promise<void> {
  let antwort: Response;
  try {
    antwort = await hole(adresse, '/');
  } catch {
    throw new Error(
      'Der Server ist nicht erreichbar. Stimmt die Adresse, und wurde der Worker veröffentlicht?',
    );
  }
  if (!antwort.ok) {
    throw new Error(`Der Server antwortet mit Fehler ${antwort.status}.`);
  }
  const daten = (await antwort.json().catch(() => null)) as
    | { dienst?: string; ablage?: boolean }
    | null;
  if (daten?.dienst !== 'marktplaner-sync') {
    throw new Error(
      'Unter dieser Adresse läuft etwas anderes. Steht dort der Inhalt von worker.js?',
    );
  }
  // Der Worker läuft, aber ohne Ablage kann er nichts aufbewahren. Das hier
  // zu bemerken erspart die Suche nach dem Fehler beim ersten Abgleich.
  if (daten.ablage === false) {
    throw new Error(
      'Der Worker läuft, aber die Ablage fehlt. In Cloudflare beim Worker unter ' +
        'Einstellungen → Bindungen eine Bindung vom Typ „KV-Namespace" mit dem ' +
        'Namen MARKTPLANER auf den Namensraum „marktplaner" anlegen.',
    );
  }
}

// ------------------------------------------------------------- Verzeichnis

interface Serverstand {
  version: number;
  paket?: SyncPaket;
}

async function verzeichnisHolen(zugang: SyncZugang, konto: string): Promise<Serverstand> {
  const antwort = await hole(zugang.adresse, `/daten/${konto}`);
  if (antwort.status === 404) return { version: 0 };
  if (!antwort.ok) throw new Error(await begruendung(antwort, 'Abholen fehlgeschlagen'));

  const roh = (await antwort.json()) as { version: number; inhalt: string };
  const paket = await entschluesseln<SyncPaket>(roh.inhalt, zugang.code);
  return { version: roh.version, paket };
}

/** Schreibt das Verzeichnis. Liefert false, wenn inzwischen jemand anders schrieb. */
async function verzeichnisSchreiben(
  zugang: SyncZugang,
  konto: string,
  version: number,
  paket: SyncPaket,
): Promise<boolean> {
  const inhalt = await verschluesseln(paket, zugang.code);
  const antwort = await netz(zugang.adresse, `/daten/${konto}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, inhalt }),
  });
  if (antwort.status === 409) return false;
  if (!antwort.ok) throw new Error(await begruendung(antwort, 'Speichern fehlgeschlagen'));
  return true;
}

// -------------------------------------------------------- einzelne Planungen

async function projektHolen(
  zugang: SyncZugang,
  konto: string,
  id: string,
): Promise<Projekt | undefined> {
  const antwort = await hole(zugang.adresse, `/anhang/${konto}/${id}`);
  // **Nur „gibt es nicht" heißt fehlt.** Ein Serverfehler ist etwas anderes,
  // und ihn wie ein Fehlen zu behandeln kostet eine Planung: Der Eintrag
  // flöge aus dem Verzeichnis, und beim nächsten Abgleich schöbe der lokale –
  // ältere – Stand den neueren auf dem Server beiseite. Ein abgebrochener
  // Abgleich ist immer besser als ein stiller Verlust.
  if (antwort.status === 404) return undefined;
  if (!antwort.ok) throw new Error(await begruendung(antwort, 'Abholen fehlgeschlagen'));
  const roh = (await antwort.json()) as { inhalt: string };
  // Der andere Rechner kann eine ältere Fassung des Marktplaners haben –
  // etwa weil dort die Web-Version noch nicht neu geladen wurde.
  return wandleProjekt(await entschluesseln<Projekt>(roh.inhalt, zugang.code));
}

async function projektSchicken(
  zugang: SyncZugang,
  konto: string,
  projekt: Projekt,
): Promise<void> {
  const inhalt = await verschluesseln(projekt, zugang.code);
  const antwort = await netz(zugang.adresse, `/anhang/${konto}/${projekt.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inhalt }),
  });
  if (!antwort.ok) {
    throw new Error(await begruendung(antwort, `„${projekt.name}" ließ sich nicht hochladen`));
  }
}

async function projektEntfernen(zugang: SyncZugang, konto: string, id: string): Promise<void> {
  // Bewusst ohne Fehlerbehandlung: Bleibt hier ein verwaister Anhang liegen,
  // stört er niemanden – im Verzeichnis steht er nicht mehr.
  await netz(zugang.adresse, `/anhang/${konto}/${id}`, { method: 'DELETE' }).catch(
    () => undefined,
  );
}

// ---------------------------------------------------------------- Abgleich

/** Sammelt den hiesigen Stand für die Entscheidungslogik. */
async function lokalenStandLesen() {
  const [verzeichnis, graeber, abgeglichen, eigeneVorlagen, zuletztGeoeffnet, zuletztGeoeffnetAm] =
    await Promise.all([
      listeProjekte(),
      listeGraeber(),
      holeAbgleichStand(),
      listeVorlagen(),
      holeZuletztGeoeffnet(),
      holeZuletztGeoeffnetAm(),
    ]);
  return { verzeichnis, graeber, abgeglichen, eigeneVorlagen, zuletztGeoeffnet, zuletztGeoeffnetAm };
}

/**
 * Ein vollständiger Abgleich.
 *
 * Schreibt ein anderer Rechner dazwischen, beginnt der Vorgang von vorn – bis
 * zu drei Mal. Danach wäre etwas grundsätzlich faul.
 */
export async function abgleichen(zugang: SyncZugang): Promise<SyncErgebnis> {
  const konto = await kontoKennung(zugang.code);
  const geraet = await holeGeraeteName();

  for (let versuch = 0; versuch < 3; versuch++) {
    // Ab wann dieser Versuch den lokalen Stand kennt. Alles, was der Planer
    // danach löscht, darf beim Aufräumen nicht wieder auferstehen – siehe
    // `setzeGraeber`.
    const beginn = Date.now();
    const stand = await verzeichnisHolen(zugang, konto);
    const lokal = await lokalenStandLesen();
    const plan = planeAbgleich(lokal, stand.paket);

    // ------------------------------------------------- 2. herunterladen
    const zuSpeichern = new Map<string, Projekt>();
    const hochladen = new Map<string, Projekt>();
    const fehlend = new Set<string>();

    // Gabelungen zuerst: Sie legen die Sicherungskopie der unterlegenen
    // Fassung an, bevor die neuere sie überschreibt.
    for (const gabel of plan.gabelungen) {
      const quelle =
        gabel.verlierer === 'lokal'
          ? await ladeProjekt(gabel.id)
          : await projektHolen(zugang, konto, gabel.id);
      if (!quelle) {
        fehlend.add(gabel.kopieId);
        continue;
      }
      const kopie: Projekt = { ...structuredClone(quelle), id: gabel.kopieId, name: gabel.kopieName };
      zuSpeichern.set(kopie.id, kopie);
      hochladen.set(kopie.id, kopie);
    }

    for (const id of plan.holen) {
      const projekt = await projektHolen(zugang, konto, id);
      // Steht im Verzeichnis, liegt aber nicht da: Das kann nach einem
      // abgebrochenen Abgleich vorkommen. Der Eintrag fliegt dann raus,
      // damit sich das Verzeichnis von selbst wieder einrenkt.
      if (projekt) zuSpeichern.set(id, projekt);
      else fehlend.add(id);
    }

    // --------------------------------------------------- 3. hochladen
    for (const id of plan.schicken) {
      if (hochladen.has(id)) continue; // Kopien aus Gabelungen sind schon dabei
      const projekt = await ladeProjekt(id);
      if (projekt) hochladen.set(id, projekt);
      else fehlend.add(id);
    }
    for (const projekt of hochladen.values()) {
      await projektSchicken(zugang, konto, projekt);
    }

    // ----------------------------------------- 4. Verzeichnis schreiben
    const verzeichnis = plan.verzeichnis.filter((e) => !fehlend.has(e.id));
    const jetzt = Date.now();
    const paket = paketBauen(
      { ...plan, verzeichnis },
      geraet,
      stand.paket?.geraete ?? [],
      jetzt,
    );

    const geschrieben = await verzeichnisSchreiben(zugang, konto, stand.version, paket);
    if (!geschrieben) continue; // ein anderer Rechner war schneller – von vorn

    // --------------------------------- 5. lokal übernehmen und aufräumen
    for (const projekt of zuSpeichern.values()) await uebernehmeProjekt(projekt);
    for (const id of plan.loeschenLokal) await entferneProjektStill(id);
    for (const id of plan.loeschenFern) await projektEntfernen(zugang, konto, id);
    for (const vorlage of plan.eigeneVorlagen) await speichereVorlage(vorlage);
    await setzeGraeber(paket.graeber, beginn);

    if (plan.zuletztGeoeffnet && plan.zuletztGeoeffnet !== lokal.zuletztGeoeffnet) {
      await merkeZuletztGeoeffnet(plan.zuletztGeoeffnet, plan.zuletztGeoeffnetAm);
    }

    await speichereAbgleichStand(neuerAbgleichStand(verzeichnis));
    await speichereLetztenAbgleich(jetzt);

    return {
      planungen: verzeichnis.length,
      geholt: plan.holen.filter((id) => !fehlend.has(id)).length,
      geschickt: hochladen.size,
      geloescht: plan.loeschenLokal.length,
      gabelungen: plan.gabelungen.map((g) => g.kopieName),
      aktualisiert: [...zuSpeichern.keys()],
      entfernt: plan.loeschenLokal,
      zuletztGeoeffnet: plan.zuletztGeoeffnet,
      geraete: paket.geraete,
      // Ein Fach, in dem noch nie ein anderer Rechner war, ist entweder das
      // erste – oder ein Versehen bei der Einrichtung.
      alleinImFach: paket.geraete.length <= 1,
      zeitpunkt: jetzt,
    };
  }

  throw new Error(
    'Ein anderer Rechner schreibt gerade dauernd dazwischen. Versuch es in einer Minute noch einmal.',
  );
}

/**
 * Der neue Bezugspunkt: Nach dem Abgleich sind hiesiger und ferner Stand
 * identisch, also gilt für jede Planung ihre aktuelle Änderungszeit.
 */
function neuerAbgleichStand(verzeichnis: Verzeichniseintrag[]): Record<string, number> {
  const stand: Record<string, number> = {};
  for (const eintrag of verzeichnis) stand[eintrag.id] = eintrag.geaendertAm;
  return stand;
}
