import { neueId } from '../logik/id';
import { SCHEMA_VERSION, type BibliothekEintrag, type Projekt } from '../typen/modell';
import { db } from './datenbank';

/**
 * Alles rund um Speichern, Laden, Kopieren und den Austausch als JSON-Datei.
 *
 * Die Funktionen kennen die Oberfläche nicht. Wenn später eine Cloud-Speicherung
 * dazukommt, muss nur hier eine zweite Umsetzung eingehängt werden.
 */

/** Kurzinfo für die Projektliste – ohne die (großen) Elementdaten. */
export interface ProjektInfo {
  id: string;
  name: string;
  geaendertAm: number;
  anzahlElemente: number;
}

export async function speichereProjekt(projekt: Projekt): Promise<void> {
  const datenbank = await db();
  await datenbank.put('projekte', { ...projekt, geaendertAm: Date.now() });
}

export async function ladeProjekt(id: string): Promise<Projekt | undefined> {
  const datenbank = await db();
  return datenbank.get('projekte', id);
}

export async function listeProjekte(): Promise<ProjektInfo[]> {
  const datenbank = await db();
  const alle = await datenbank.getAll('projekte');
  return alle
    .map((p) => ({
      id: p.id,
      name: p.name,
      geaendertAm: p.geaendertAm,
      anzahlElemente: p.elemente.length,
    }))
    .sort((a, b) => b.geaendertAm - a.geaendertAm);
}

export async function loescheProjekt(id: string): Promise<void> {
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

export async function merkeZuletztGeoeffnet(id: string): Promise<void> {
  const datenbank = await db();
  await datenbank.put('einstellungen', id, 'zuletztGeoeffnet');
}

export async function holeZuletztGeoeffnet(): Promise<string | undefined> {
  const datenbank = await db();
  const wert = await datenbank.get('einstellungen', 'zuletztGeoeffnet');
  return typeof wert === 'string' ? wert : undefined;
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
    ...inhalt.projekt,
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
