import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BibliothekEintrag, Projekt } from '../typen/modell';
import type { Grabstein } from './abgleich';

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
  /**
   * Merkzettel über gelöschte Planungen. Ohne sie käme eine gelöschte Planung
   * beim nächsten Abgleich vom anderen Rechner zurück – der dort ja nichts
   * von der Löschung weiß und sie nur als „hier fehlt etwas" sähe.
   */
  graeber: {
    key: string;
    value: Grabstein;
  };
  /** Kleinkram wie "zuletzt geöffnetes Projekt" und der Sync-Zugang. */
  einstellungen: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'marktplaner';
const DB_VERSION = 2;

let verbindung: Promise<IDBPDatabase<MarktplanerDb>> | null = null;

export function db(): Promise<IDBPDatabase<MarktplanerDb>> {
  if (!verbindung) {
    verbindung = openDB<MarktplanerDb>(DB_NAME, DB_VERSION, {
      // `vorher` ist die Fassung, die auf diesem Rechner bisher lag: 0 bei
      // einer frischen Einrichtung. Jeder Schritt läuft nur einmal und baut
      // auf dem vorherigen auf – so kommt auch ein alter Stand sauber nach.
      upgrade(datenbank, vorher) {
        if (vorher < 1) {
          const projekte = datenbank.createObjectStore('projekte', { keyPath: 'id' });
          projekte.createIndex('geaendertAm', 'geaendertAm');
          datenbank.createObjectStore('vorlagen', { keyPath: 'id' });
          datenbank.createObjectStore('einstellungen');
        }
        if (vorher < 2) {
          datenbank.createObjectStore('graeber', { keyPath: 'id' });
        }
      },
    });
  }
  return verbindung;
}
