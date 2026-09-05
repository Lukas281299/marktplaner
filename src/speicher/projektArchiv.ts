import type { Sortimentsliste } from '../daten/warengruppen';
import { neueId } from '../logik/id';
import { SCHEMA_VERSION, type BibliothekEintrag, type Projekt } from '../typen/modell';
import type { Grabstein, Verzeichniseintrag } from './abgleich';
import { db } from './datenbank';
import { wandleProjekt } from './wandlung';
import type { Spaltenstand } from '../zustand/planStore';

/**
 * Alles rund um Speichern, Laden, Kopieren und den Austausch als JSON-Datei.
 *
 * Die Funktionen kennen die Oberfläche nicht. Der Abgleich mit dem Server
 * (`syncClient.ts`) benutzt dieselben Funktionen – er hat keinen eigenen
 * Zugang zur Datenbank.
 */

/** Kurzinfo für die Projektliste – ohne die (großen) Elementdaten. */
export type ProjektInfo = Verzeichniseintrag;

/**
 * Speichert eine Planung und vermerkt sie als soeben geändert.
 *
 * Für alles gedacht, was der Mensch tut. Beim Abgleich darf die Änderungszeit
 * gerade **nicht** angefasst werden – dafür gibt es `uebernehmeProjekt`.
 */
export async function speichereProjekt(projekt: Projekt): Promise<void> {
  const datenbank = await db();
  await datenbank.put('projekte', { ...projekt, geaendertAm: Date.now() });
}

/**
 * Legt eine Planung genau so ab, wie sie ist.
 *
 * Beim Abgleich ist die Änderungszeit die Entscheidungsgrundlage: Würde sie
 * beim Herunterladen auf „jetzt" gesetzt, sähe die geholte Fassung beim
 * nächsten Mal neuer aus als das Original und liefe dem anderen Rechner
 * dauernd hinterher.
 */
export async function uebernehmeProjekt(projekt: Projekt): Promise<void> {
  const datenbank = await db();
  await datenbank.put('projekte', projekt);
}

export async function ladeProjekt(id: string): Promise<Projekt | undefined> {
  const datenbank = await db();
  const gespeichert = await datenbank.get('projekte', id);
  // Ältere Planungen werden beim Öffnen auf das aktuelle Modell gebracht.
  return gespeichert ? wandleProjekt(gespeichert) : undefined;
}

export async function listeProjekte(): Promise<ProjektInfo[]> {
  const datenbank = await db();
  const alle = await datenbank.getAll('projekte');
  return alle
    .map((p) => ({
      id: p.id,
      name: p.name,
      ordner: p.ordner,
      ordnerAm: p.ordnerAm,
      erstelltAm: p.erstelltAm,
      geaendertAm: p.geaendertAm,
      anzahlElemente: p.elemente.length,
    }))
    .sort((a, b) => b.geaendertAm - a.geaendertAm);
}

/**
 * Löscht eine Planung und hinterlässt einen Grabstein.
 *
 * Ohne den Grabstein wäre die Löschung beim nächsten Abgleich rückgängig
 * gemacht: Der andere Rechner hat die Planung noch und würde sie als
 * „fehlt hier" wieder herüberschieben.
 */
export async function loescheProjekt(id: string): Promise<void> {
  const datenbank = await db();
  await datenbank.delete('projekte', id);
  await datenbank.put('graeber', { id, geloeschtAm: Date.now() });
}

/** Löscht ohne Grabstein – für den Abgleich, wenn anderswo gelöscht wurde. */
export async function entferneProjektStill(id: string): Promise<void> {
  const datenbank = await db();
  await datenbank.delete('projekte', id);
}

/** Legt eine unabhängige Kopie eines Projekts an. */
/**
 * Benennt eine gespeicherte Planung um.
 *
 * Geht über `speichereProjekt`, damit der Zeitstempel und der Abgleich
 * genauso mitgezogen werden wie bei jeder anderen Änderung. Ist die Planung
 * gerade geöffnet, muss die Oberfläche sie zusätzlich neu laden – eine
 * Datenbank weiß nichts davon, was auf dem Bildschirm steht.
 */
export async function benenneProjektUm(id: string, name: string): Promise<Projekt | undefined> {
  const projekt = await ladeProjekt(id);
  if (!projekt) return undefined;
  const neu = { ...projekt, name: name.trim() || projekt.name };
  await speichereProjekt(neu);
  return neu;
}

/**
 * Verschiebt eine Planung in einen Ordner – oder wieder heraus.
 *
 * Der Ordner ist nur ein Name am Projekt; es wird nichts umkopiert. Deshalb
 * geht auch das Umbenennen eines Ordners einfach dadurch, dass man alle
 * Planungen darin auf den neuen Namen setzt.
 *
 * `geaendertAm` wird **nicht** angefasst: Wohin eine Planung einsortiert ist,
 * ist keine Änderung an der Planung. Sonst stünde sie nach dem Aufräumen in
 * der Liste ganz oben, als hätte jemand daran gearbeitet.
 */
export async function verschiebeProjekt(
  id: string,
  ordner: string | undefined,
  /** Wann – für den Abgleich. Vorgabe: jetzt. */
  wann = Date.now(),
): Promise<Projekt | undefined> {
  const datenbank = await db();
  const projekt = await datenbank.get('projekte', id);
  if (!projekt) return undefined;
  const sauber = ordner?.trim();
  // `geaendertAm` bleibt, `ordnerAm` bekommt den Zeitpunkt: Nur so sieht der
  // Abgleich, dass hier etwas passiert ist, ohne dass die Planung als
  // bearbeitet gilt.
  const neu = { ...projekt, ordner: sauber ? sauber : undefined, ordnerAm: wann };
  await datenbank.put('projekte', neu);
  return neu;
}

/** Alle Ordner, in denen wirklich etwas liegt – nach Namen sortiert. */
export async function listeOrdner(): Promise<string[]> {
  const alle = await listeProjekte();
  const namen = new Set(
    alle.map((p) => p.ordner?.trim()).filter((o): o is string => Boolean(o)),
  );
  return [...namen].sort((a, b) => a.localeCompare(b, 'de'));
}

export async function kopiereProjekt(id: string): Promise<Projekt | undefined> {
  const original = await ladeProjekt(id);
  if (!original) return undefined;
  const kopie: Projekt = {
    ...structuredClone(original),
    id: neueId('projekt'),
    name: `${original.name} (Kopie)`,
    erstelltAm: Date.now(),
    geaendertAm: Date.now(),
  };
  await speichereProjekt(kopie);
  return kopie;
}

// ------------------------------------------------- zuletzt geöffnetes Projekt

export async function merkeZuletztGeoeffnet(id: string, wann = Date.now()): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', id, 'zuletztGeoeffnet');
  // Der Zeitpunkt entscheidet beim Abgleich, welcher Rechner zuletzt am Werk
  // war – und damit, wo man an einem anderen Rechner weitermacht.
  await datenbank.put('einstellungen', wann, 'zuletztGeoeffnetAm');
}

export async function holeZuletztGeoeffnet(): Promise<string | undefined> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'zuletztGeoeffnet');
  return typeof wert === 'string' ? wert : undefined;
}

export async function holeZuletztGeoeffnetAm(): Promise<number> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'zuletztGeoeffnetAm');
  return typeof wert === 'number' ? wert : 0;
}

// ------------------------------------------------------------- Favoriten

/**
 * Die als Favorit markierten Vorlagen.
 *
 * Bewusst nicht im Projekt, sondern am Gerät: Favoriten sind eine
 * Arbeitsgewohnheit, keine Eigenschaft einer Planung. Wer meist mit 1250er
 * Gondeln plant, will die in jedem Markt oben stehen haben und nicht in
 * jedem neu anhaken.
 */
export async function holeFavoriten(): Promise<string[]> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'favoriten');
  return Array.isArray(wert) ? wert.filter((v): v is string => typeof v === 'string') : [];
}

export async function setzeFavoriten(ids: string[]): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', ids, 'favoriten');
}

// -------------------------------------------------- Kennzahlen am Möbel

/**
 * Was ein Möbeltyp an Auslagen und grünen Kisten fasst.
 *
 * Nach Vorlagenkennung: Ein Vitable-Tisch A1250 trägt immer dieselbe Zahl
 * Auslagen, gleich wie oft er im Markt steht. Deshalb wird sie **einmal**
 * eingetragen und gilt danach für jeden weiteren.
 *
 * Sie liegt am Gerät und nicht in der Planung – so wie die Favoriten und die
 * eigenen Vorlagen. Es ist eine Eigenschaft des Möbels, keine des Marktes:
 * Wer in zwei Märkten plant, will sie nicht zweimal eintragen.
 */
export interface Moebelkennzahl {
  auslagen?: number;
  ifkoKisten?: number;
}

export async function holeMoebelkennzahlen(): Promise<Record<string, Moebelkennzahl>> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'moebelkennzahlen');
  return wert && typeof wert === 'object' ? (wert as Record<string, Moebelkennzahl>) : {};
}

export async function setzeMoebelkennzahlen(
  kennzahlen: Record<string, Moebelkennzahl>,
): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', kennzahlen, 'moebelkennzahlen');
}

// ------------------------------------------------------ Sortimentsliste

/**
 * Die Sortimentsliste des Marktes.
 *
 * Wie die Favoriten am Gerät und nicht in der Planung – und aus einem zweiten
 * Grund: Sie gehört dem Markt und nicht dem Programm. Ein öffentliches
 * Programm hat kein Sortiment mitzuliefern; geladen wird sie von der Platte,
 * gespeichert wird sie hier.
 *
 * Nichts gespeichert heißt: Es gilt der allgemeine Anfang aus
 * `daten/warengruppen.ts`.
 */
export async function holeSortimentsliste(): Promise<Sortimentsliste | null> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'sortimentsliste');
  const abteilungen = (wert as Sortimentsliste | undefined)?.abteilungen;
  return Array.isArray(abteilungen) && abteilungen.length > 0
    ? { abteilungen }
    : null;
}

export async function setzeSortimentsliste(liste: Sortimentsliste): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', liste, 'sortimentsliste');
}

// ---------------------------------------------------------------- Grabsteine

export async function listeGraeber(): Promise<Grabstein[]> {
  const datenbank = await db();
  return datenbank.getAll('graeber');
}

/**
 * Ersetzt die Grabsteine durch den zusammengeführten Stand.
 *
 * **Was während des Abgleichs dazukam, bleibt.** Der Abgleich liest den
 * lokalen Stand einmal zu Beginn und hängt danach minutenlang an den
 * Netzabrufen. Löscht der Planer in dieser Zeit eine Planung, entsteht ein
 * neuer Grabstein – und ein blindes Ersetzen räumte ihn mit weg. Die Planung
 * stünde beim nächsten Abgleich als „hier fehlt etwas" da und käme vom Server
 * zurück, für immer, weil der andere Rechner sie auch nie löscht.
 *
 * `seit` ist der Zeitpunkt, zu dem der Abgleich begonnen hat: Alles, was
 * danach begraben wurde, bleibt liegen.
 */
export async function setzeGraeber(graeber: Grabstein[], seit = Infinity): Promise<void> {
  const datenbank = await db();
  const schreiben = datenbank.transaction('graeber', 'readwrite');
  const vorhanden = (await schreiben.store.getAll()) as Grabstein[];
  const zusammen = new Map(graeber.map((g) => [g.id, g]));
  for (const g of vorhanden) {
    if (g.geloeschtAm >= seit && !zusammen.has(g.id)) zusammen.set(g.id, g);
  }
  await schreiben.store.clear();
  for (const g of zusammen.values()) await schreiben.store.put(g);
  await schreiben.done;
}

// ------------------------------------------------------- Zugang und Abgleich

/** Zugangsdaten für die Synchronisation. Bleiben auf diesem Rechner. */
export interface SyncZugang {
  adresse: string;
  code: string;
}

export async function holeSyncZugang(): Promise<SyncZugang | undefined> {
  const datenbank = await db();
  const wert = (await datenbank.get('einstellungen', 'syncZugang')) as SyncZugang | undefined;
  return wert?.adresse && wert?.code ? wert : undefined;
}

export async function speichereSyncZugang(zugang: SyncZugang): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', zugang, 'syncZugang');
}

/**
 * Wie der Assistent an seinen Worker kommt.
 *
 * Der Schluessel selbst steht **nicht** hier, sondern beim Worker. Hier liegt
 * nur, wo er zu finden ist und mit welchem Wort man dort vorgelassen wird -
 * siehe `assistent/worker.js`.
 */
export interface AssistentZugang {
  adresse: string;
  wort: string;
}

export async function holeAssistentZugang(): Promise<AssistentZugang | undefined> {
  const datenbank = await db();
  const wert = (await datenbank.get('einstellungen', 'assistentZugang')) as
    | AssistentZugang
    | undefined;
  return wert?.adresse && wert?.wort ? wert : undefined;
}

export async function speichereAssistentZugang(zugang: AssistentZugang): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', zugang, 'assistentZugang');
}

export async function loescheAssistentZugang(): Promise<void> {
  const datenbank = await db();
  await datenbank.delete('einstellungen', 'assistentZugang');
}

/**
 * Eine Kennung fuer dieses Geraet, an der das Tageslimit haengt.
 *
 * Nicht der Geraetename: Der darf Umlaute und Leerzeichen enthalten, und der
 * Worker laesst nur Buchstaben, Ziffern, Strich und Unterstrich durch.
 */
export async function holeGeraetekennung(): Promise<string> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'geraetekennung');
  if (typeof wert === 'string' && /^[a-zA-Z0-9_-]{4,64}$/.test(wert)) return wert;
  const kennung = 'g-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  await datenbank.put('einstellungen', kennung, 'geraetekennung');
  return kennung;
}

export async function loescheSyncZugang(): Promise<void> {
  const datenbank = await db();
  await datenbank.delete('einstellungen', 'syncZugang');
  await datenbank.delete('einstellungen', 'abgleichStand');
}

/**
 * Mit welcher Änderungszeit jede Planung zuletzt abgeglichen wurde.
 * Siehe `abgleich.ts` – das ist der Bezugspunkt für Gabelungen.
 */
export async function holeAbgleichStand(): Promise<Record<string, number>> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'abgleichStand');
  return (wert as Record<string, number>) ?? {};
}

export async function speichereAbgleichStand(stand: Record<string, number>): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', stand, 'abgleichStand');
}

export async function holeLetztenAbgleich(): Promise<number> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'letzterAbgleich');
  return typeof wert === 'number' ? wert : 0;
}

export async function speichereLetztenAbgleich(wann: number): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', wann, 'letzterAbgleich');
}

/**
 * Ein Name für diesen Rechner, damit im Abgleich erkennbar ist, wie viele
 * Geräte in dem Fach sitzen. Wird einmal vergeben und bleibt dann liegen.
 */
export async function holeGeraeteName(): Promise<string> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'geraet');
  if (typeof wert === 'string' && wert) return wert;
  const name = geraeteNameRaten();
  await datenbank.put('einstellungen', name, 'geraet');
  return name;
}

export async function setzeGeraeteName(name: string): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', name.trim() || geraeteNameRaten(), 'geraet');
}

/** Grobe Einschätzung aus der Browserkennung – nur als Vorschlag gedacht. */
function geraeteNameRaten(): string {
  const kennung = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Android/i.test(kennung)) return 'Android-Gerät';
  if (/iPhone|iPad/i.test(kennung)) return 'iPhone oder iPad';
  if (/Macintosh/i.test(kennung)) return 'Mac';
  if (/Windows/i.test(kennung)) return 'Windows-Rechner';
  return 'Rechner';
}

// ------------------------------------------------------------ eigene Vorlagen

export async function speichereVorlage(vorlage: BibliothekEintrag): Promise<void> {
  const datenbank = await db();
  await datenbank.put('vorlagen', vorlage);
}

export async function listeVorlagen(): Promise<BibliothekEintrag[]> {
  const datenbank = await db();
  return datenbank.getAll('vorlagen');
}

export async function loescheVorlage(id: string): Promise<void> {
  const datenbank = await db();
  await datenbank.delete('vorlagen', id);
}

// ------------------------------------------------------------- JSON-Austausch

/** Aufbau der Austauschdatei. Enthält bewusst auch die eigenen Vorlagen. */
export interface Austauschdatei {
  format: 'marktplaner';
  version: number;
  exportiertAm: string;
  projekt: Projekt;
  eigeneVorlagen: BibliothekEintrag[];
}

/** Bietet das Projekt als .json-Datei zum Herunterladen an. */
export async function exportiereAlsJson(projekt: Projekt): Promise<void> {
  const inhalt: Austauschdatei = {
    format: 'marktplaner',
    version: SCHEMA_VERSION,
    exportiertAm: new Date().toISOString(),
    projekt,
    eigeneVorlagen: await listeVorlagen(),
  };
  const blob = new Blob([JSON.stringify(inhalt, null, 2)], { type: 'application/json' });
  ladeDateiHerunter(blob, `${dateinameAus(projekt.name)}.json`);
}

/**
 * Liest eine zuvor exportierte Datei ein und prüft sie grob.
 * Wirft einen Fehler mit verständlichem Text, wenn die Datei nicht passt.
 */
/**
 * Alle Planungen auf einmal sichern.
 *
 * Was in der Anwendung steht, liegt allein in der Datenbank des Browsers –
 * an Browser und Adresse gebunden. Wer dort einmal die Websitedaten löscht,
 * löscht die Arbeit von Monaten mit, und zwar ohne Rückfrage. Eine Sicherung
 * ist deshalb keine Bequemlichkeit, sondern die einzige Kopie außerhalb.
 *
 * Kann der Browser einen Ordner öffnen (Chrome und Edge können es), wird
 * jede Planung als eigene Datei hineingeschrieben – dieselben Dateien, die
 * auch der Import liest. Sonst kommt eine Sammeldatei in den Download-Ordner.
 *
 * Rückgabe: wie viele Planungen gesichert wurden und wohin.
 */
export async function sichereAlles(): Promise<{ anzahl: number; ort: string }> {
  const datenbank = await db();
  const roh = await datenbank.getAll('projekte');
  const projekte = roh.map(wandleProjekt);
  const eigeneVorlagen = await listeVorlagen();
  if (projekte.length === 0) return { anzahl: 0, ort: '' };

  const stempel = new Date().toISOString().slice(0, 10);
  const waehler = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> })
    .showDirectoryPicker;

  if (waehler) {
    let ordner: FileSystemDirectoryHandle;
    try {
      ordner = await waehler.call(window);
    } catch {
      // Abgebrochen – das ist keine Störung, nur eine Entscheidung.
      return { anzahl: 0, ort: '' };
    }
    // Zwei Planungen dürfen denselben Namen tragen – eine Datei nicht. Ohne
    // die Nummer überschriebe die zweite stillschweigend die erste, und
    // ausgerechnet die Sicherung verlöre Arbeit.
    const vergeben = new Map<string, number>();
    for (const projekt of projekte) {
      const inhalt: Austauschdatei = {
        format: 'marktplaner',
        version: SCHEMA_VERSION,
        exportiertAm: new Date().toISOString(),
        projekt,
        eigeneVorlagen,
      };
      const grund = dateinameAus(projekt.name);
      const schonda = vergeben.get(grund) ?? 0;
      vergeben.set(grund, schonda + 1);
      const dateiname = schonda === 0 ? `${grund}.json` : `${grund} (${schonda + 1}).json`;
      const datei = await ordner.getFileHandle(dateiname, { create: true });
      const strom = await datei.createWritable();
      await strom.write(JSON.stringify(inhalt, null, 2));
      await strom.close();
    }
    return { anzahl: projekte.length, ort: ordner.name };
  }

  // Ohne Ordnerwahl: eine Datei mit allem darin.
  const sammlung = {
    format: 'marktplaner-sicherung' as const,
    version: SCHEMA_VERSION,
    exportiertAm: new Date().toISOString(),
    projekte,
    eigeneVorlagen,
  };
  const blob = new Blob([JSON.stringify(sammlung, null, 2)], { type: 'application/json' });
  ladeDateiHerunter(blob, `Marktplaner Sicherung ${stempel}.json`);
  return { anzahl: projekte.length, ort: 'Download-Ordner' };
}

/**
 * Die Planungen aus einer Datei lesen – einzeln oder als Sicherung.
 *
 * Eine Sicherung enthält mehrere; eine Austauschdatei genau eine. Beide
 * bekommen frische Kennungen, damit ein Einlesen nichts überschreibt, was
 * schon dasteht.
 */
export async function leseProjektdatei(
  datei: File,
): Promise<{ projekte: Projekt[]; eigeneVorlagen: BibliothekEintrag[] }> {
  let daten: unknown;
  try {
    daten = JSON.parse(await datei.text());
  } catch {
    throw new Error('Die Datei ist keine gültige JSON-Datei.');
  }
  const inhalt = daten as Omit<Partial<Austauschdatei>, 'format'> & {
    format?: string;
    projekte?: Projekt[];
  };
  const frisch = (p: Projekt): Projekt => ({
    ...wandleProjekt(p),
    id: neueId('projekt'),
    geaendertAm: Date.now(),
  });

  if (inhalt?.format === 'marktplaner-sicherung' && Array.isArray(inhalt.projekte)) {
    return {
      projekte: inhalt.projekte.map(frisch),
      eigeneVorlagen: inhalt.eigeneVorlagen ?? [],
    };
  }
  if (inhalt?.format === 'marktplaner' && inhalt.projekt) {
    return { projekte: [frisch(inhalt.projekt)], eigeneVorlagen: inhalt.eigeneVorlagen ?? [] };
  }
  throw new Error('Diese Datei stammt nicht aus dem Marktplaner.');
}

export async function importiereAusJson(datei: File): Promise<Austauschdatei> {
  let daten: unknown;
  try {
    daten = JSON.parse(await datei.text());
  } catch {
    throw new Error('Die Datei ist keine gültige JSON-Datei.');
  }
  const inhalt = daten as Partial<Austauschdatei>;
  if (inhalt?.format !== 'marktplaner' || !inhalt.projekt) {
    throw new Error('Diese Datei stammt nicht aus dem Marktplaner.');
  }
  // Neue Kennung vergeben, damit ein Import ein vorhandenes Projekt nicht überschreibt.
  const projekt: Projekt = {
    ...wandleProjekt(inhalt.projekt),
    id: neueId('projekt'),
    geaendertAm: Date.now(),
  };
  return {
    format: 'marktplaner',
    version: inhalt.version ?? SCHEMA_VERSION,
    exportiertAm: inhalt.exportiertAm ?? new Date().toISOString(),
    projekt,
    eigeneVorlagen: inhalt.eigeneVorlagen ?? [],
  };
}

// --------------------------------------------------------------- Hilfsmittel

/** Macht aus einem Projektnamen einen brauchbaren Dateinamen. */
export function dateinameAus(name: string): string {
  return (
    name
      .replace(/[äÄöÖüÜß]/g, (z) =>
        ({ ä: 'ae', Ä: 'Ae', ö: 'oe', Ö: 'Oe', ü: 'ue', Ü: 'Ue', ß: 'ss' })[z] ?? z,
      )
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'marktplanung'
  );
}

/** Startet den Download einer Datei im Browser. */
export function ladeDateiHerunter(blob: Blob, dateiname: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ------------------------------------------------ Breite der Seitenleisten

/**
 * Wie breit die beiden Seitenleisten stehen und ob sie aufgeklappt sind.
 *
 * Eine Einstellung des Arbeitsplatzes und nicht der Planung: Sie liegt
 * deshalb neben den Projekten und nicht darin. Wer am zweiten Rechner
 * arbeitet, richtet sich dort seine eigene Breite ein.
 */
export async function holeSpaltenstand(): Promise<Partial<Spaltenstand>> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'spaltenstand');
  if (!wert || typeof wert !== 'object') return {};
  const roh = wert as Record<string, unknown>;
  const zahl = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const jaNein = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
  return {
    links: zahl(roh.links),
    rechts: zahl(roh.rechts),
    linksOffen: jaNein(roh.linksOffen),
    rechtsOffen: jaNein(roh.rechtsOffen),
  };
}

export async function speichereSpaltenstand(stand: Spaltenstand): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', stand, 'spaltenstand');
}
