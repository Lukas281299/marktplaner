import { create } from 'zustand';
import type { SyncErgebnis } from '../speicher/syncClient';
import type { SyncZugang } from '../speicher/projektArchiv';

/**
 * Der Zustand der Synchronisation – getrennt vom Planungsdatenspeicher.
 *
 * Beides hat nichts miteinander zu tun: Ob gerade abgeglichen wird, gehört
 * nicht in die Historie der Planung und darf kein „Rückgängig" auslösen.
 */

export type Abgleichzustand =
  /** Noch nicht eingerichtet. */
  | 'aus'
  | 'bereit'
  | 'laeuft'
  | 'fehler';

interface SyncStore {
  zugang: SyncZugang | null;
  zustand: Abgleichzustand;
  /** Verständlicher Satz für die Oberfläche – Fehler oder Erfolgsmeldung. */
  meldung: string;
  letzterAbgleich: number;
  letztesErgebnis: SyncErgebnis | null;

  setzeZugang(zugang: SyncZugang | null): void;
  setzeZustand(zustand: Abgleichzustand, meldung?: string): void;
  setzeErgebnis(ergebnis: SyncErgebnis): void;
  setzeLetztenAbgleich(wann: number): void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  zugang: null,
  zustand: 'aus',
  meldung: '',
  letzterAbgleich: 0,
  letztesErgebnis: null,

  setzeZugang(zugang) {
    set({ zugang, zustand: zugang ? 'bereit' : 'aus', meldung: '' });
  },

  setzeZustand(zustand, meldung = '') {
    set({ zustand, meldung });
  },

  setzeErgebnis(ergebnis) {
    set({
      zustand: 'bereit',
      letzterAbgleich: ergebnis.zeitpunkt,
      letztesErgebnis: ergebnis,
      meldung: ergebnisSatz(ergebnis),
    });
  },

  setzeLetztenAbgleich(wann) {
    set({ letzterAbgleich: wann });
  },
}));

/** Fasst zusammen, was der Abgleich getan hat – in einem Satz. */
export function ergebnisSatz(ergebnis: SyncErgebnis): string {
  const teile: string[] = [];
  if (ergebnis.geholt > 0) teile.push(`${ergebnis.geholt} geholt`);
  if (ergebnis.geschickt > 0) teile.push(`${ergebnis.geschickt} geschickt`);
  if (ergebnis.geloescht > 0) teile.push(`${ergebnis.geloescht} gelöscht`);
  if (teile.length === 0) return 'Alles auf dem gleichen Stand';
  return teile.join(' · ');
}
