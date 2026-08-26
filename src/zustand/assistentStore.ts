import { create } from 'zustand';
import type { Beitrag, ModellId, Tat } from '../assistent/gespraech';

/**
 * Der Zustand des Assistenten.
 *
 * Eigener Speicher und nicht Teil der Komponente, damit das Gespräch das
 * Zuklappen der Spalte übersteht: Wer den Assistenten schließt, um mehr vom
 * Plan zu sehen, will danach nicht von vorn anfangen.
 *
 * Das Gespräch gehört bewusst **nicht** zur Planung und wird nicht mit ihr
 * gespeichert. Es ist ein Arbeitsgespräch über den Plan, nicht sein Inhalt.
 */
interface AssistentStore {
  offen: boolean;
  verlauf: Beitrag[];
  /** Läuft gerade eine Anfrage? */
  laeuft: boolean;
  /** Was der Assistent in der laufenden Runde schon getan hat. */
  laufendeTaten: Tat[];
  modell: ModellId;
  /** Verbrauch am heutigen Tag, wie ihn der Worker meldet. */
  kontingent: { verbraucht: number; grenze: number } | null;
  /** Damit sich eine laufende Anfrage abbrechen lässt. */
  abbruch: AbortController | null;

  schalteOffen(offen?: boolean): void;
  setzeModell(modell: ModellId): void;
  haengeAn(beitrag: Beitrag): void;
  ersetzeLetzten(beitrag: Beitrag): void;
  starte(abbruch: AbortController): void;
  meldeTaten(taten: Tat[]): void;
  beende(kontingent?: { verbraucht: number; grenze: number }): void;
  brichAb(): void;
  leere(): void;
}

export const useAssistentStore = create<AssistentStore>((set, get) => ({
  offen: false,
  verlauf: [],
  laeuft: false,
  laufendeTaten: [],
  modell: 'claude-sonnet-5',
  kontingent: null,
  abbruch: null,

  schalteOffen(offen) {
    set({ offen: offen ?? !get().offen });
  },

  setzeModell(modell) {
    set({ modell });
  },

  haengeAn(beitrag) {
    set({ verlauf: [...get().verlauf, beitrag] });
  },

  ersetzeLetzten(beitrag) {
    const verlauf = get().verlauf;
    set({ verlauf: [...verlauf.slice(0, -1), beitrag] });
  },

  starte(abbruch) {
    set({ laeuft: true, laufendeTaten: [], abbruch });
  },

  meldeTaten(taten) {
    set({ laufendeTaten: taten });
  },

  beende(kontingent) {
    set({
      laeuft: false,
      laufendeTaten: [],
      abbruch: null,
      kontingent: kontingent ?? get().kontingent,
    });
  },

  brichAb() {
    get().abbruch?.abort();
    set({ laeuft: false, laufendeTaten: [], abbruch: null });
  },

  leere() {
    get().abbruch?.abort();
    set({ verlauf: [], laeuft: false, laufendeTaten: [], abbruch: null });
  },
}));
