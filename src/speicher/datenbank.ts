import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BibliothekEintrag, Projekt } from '../typen/modell';

/**
 * Die lokale Datenbank im Browser (IndexedDB).
 *
 * Bewusst dünn gehalten: nur Öffnen und Zugriff. Alles Fachliche steht in
 * `projektArchiv.ts`. Dadurch lässt sich diese Datei später gegen einen
 * Server- oder Cloud-Zugriff austauschen, ohne den Rest anzufassen.
 */
interface MarktplanerDb extends DBSchema {
  projekte: {
    key: string;
    value: Projekt;
    indexes: { geaendertAm: number };
  };
  vorlagen: {
    key: string;
    value: BibliothekEintrag;
  };
  /** Kleinkram wie "zuletzt geöffnetes Projekt". */
  einstellungen: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'marktplaner';
const DB_VERSION = 1;

let verbindung: Promise<IDBPDatabase<MarktplanerDb>> | null = null;

export function db(): Promise<IDBPDatabase<MarktplanerDb>> {
  if (!verbindung) {
    verbindung = openDB<MarktplanerDb>(DB_NAME, DB_VERSION, {
      upgrade(datenbank) {
        const projekte = datenbank.createObjectStore('projekte', { keyPath: 'id' });
        projekte.createIndex('geaendertAm', 'geaendertAm');
        datenbank.createObjectStore('vorlagen', { keyPath: 'id' });
        datenbank.createObjectStore('einstellungen');
      },
    });
  }
  return verbindung;
}
