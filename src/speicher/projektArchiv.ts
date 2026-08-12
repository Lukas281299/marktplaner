import { neueId } from '../logik/id';
import { SCHEMA_VERSION, type BibliothekEintrag, type Projekt } from '../typen/modell';
import type { Grabstein, Verzeichniseintrag } from './abgleich';
import { db } from './datenbank';
import { wandleProjekt } from './wandlung';

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

// ---------------------------------------------------------------- Grabsteine

export async function listeGraeber(): Promise<Grabstein[]> {
  const datenbank = await db();
  return datenbank.getAll('graeber');
}

/** Ersetzt alle Grabsteine durch den zusammengeführten Stand. */
export async function setzeGraeber(graeber: Grabstein[]): Promise<void> {
  const datenbank = await db();
  const schreiben = datenbank.transaction('graeber', 'readwrite');
  await schreiben.store.clear();
  for (const g of graeber) await schreiben.store.put(g);
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
