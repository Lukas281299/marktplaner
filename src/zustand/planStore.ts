import { create } from 'zustand';
import { STANDARD_EBENE_ID, neuesProjekt } from '../daten/standardProjekt';
import { gesamtUmgrenzung, umgrenzung } from '../logik/geometrie';
import { neueId } from '../logik/id';
import type {
  BibliothekEintrag,
  Einstellungen,
  Grundflaeche,
  PlanElement,
  Projekt,
} from '../typen/modell';

/**
 * Der zentrale Datenspeicher der Anwendung.
 *
 * Grundregel: Die Oberfläche liest hier Daten und ruft hier Aktionen auf –
 * sie verändert niemals selbst etwas an den Daten. Dadurch funktionieren
 * "Rückgängig" und das automatische Speichern zuverlässig.
 *
 * Rückgängig/Wiederholen arbeitet mit vollständigen Kopien des Projekts.
 * Das ist einfach zu verstehen und für Pläne dieser Größe schnell genug.
 */

/** Wie viele Schritte lassen sich rückgängig machen? */
const HISTORIE_TIEFE = 60;

/** Ausschnitt und Vergrößerung der Ansicht. */
export interface Ansicht {
  /** Verschiebung der Zeichenfläche in Bildschirmpunkten. */
  x: number;
  y: number;
  /** Bildschirmpunkte pro Zentimeter Planmaß. */
  zoom: number;
}

/** Auswahlmodus beim Anklicken. */
export type Auswahlmodus = 'ersetzen' | 'umschalten';

export type Ausrichtung = 'links' | 'mitteWaagerecht' | 'rechts' | 'oben' | 'mitteSenkrecht' | 'unten';
export type Reihenfolgebefehl = 'ganzVorne' | 'ganzHinten' | 'nachVorne' | 'nachHinten';

interface PlanStore {
  // ------------------------------------------------------------------ Daten
  projekt: Projekt;
  /** Kennungen der ausgewählten Elemente. */
  auswahl: string[];
  /** Inhalt der internen Zwischenablage (Kopieren/Einfügen). */
  zwischenablage: PlanElement[];
  /** Selbst angelegte Bibliotheksvorlagen. */
  eigeneVorlagen: BibliothekEintrag[];
  ansicht: Ansicht;
  /** Erst `true`, wenn aus der Datenbank geladen wurde. */
  geladen: boolean;
  /** Beim Ziehen an den Ecken das Seitenverhältnis beibehalten? */
  seitenverhaeltnisHalten: boolean;

  vergangenheit: Projekt[];
  zukunft: Projekt[];

  // --------------------------------------------------------------- Projekt
  setzeProjekt(projekt: Projekt, alsGeladen?: boolean): void;
  setzeEigeneVorlagen(vorlagen: BibliothekEintrag[]): void;
  benenneProjektUm(name: string): void;
  setzeGrundflaeche(werte: Partial<Grundflaeche>): void;
  setzeEinstellung(werte: Partial<Einstellungen>): void;
  setzeEbene(id: string, werte: Partial<{ sichtbar: boolean; gesperrt: boolean }>): void;

  // ------------------------------------------------------------- Historie
  /** Merkt den aktuellen Stand, bevor eine längere Aktion (z. B. Ziehen) beginnt. */
  schnappschuss(): void;
  rueckgaengig(): void;
  wiederholen(): void;

  // ------------------------------------------------------------- Elemente
  fuegeElementHinzu(vorlage: BibliothekEintrag, x: number, y: number): string;
  aendereElemente(ids: string[], werte: Partial<PlanElement>, mitHistorie?: boolean): void;
  /** Setzt für mehrere Elemente gleichzeitig neue Positionen (beim Ziehen). */
  setzePositionen(werte: { id: string; x: number; y: number }[], mitHistorie?: boolean): void;
  /** Übernimmt Position, Größe und Drehung nach dem Ziehen an den Anfassern. */
  setzeGeometrien(
    werte: { id: string; x: number; y: number; breite: number; tiefe: number; drehung: number }[],
  ): void;
  loescheAuswahl(): void;
  dupliziereAuswahl(): void;
  kopiereAuswahl(): void;
  fuegeEin(): void;
  dreheAuswahl(grad: number): void;
  verschiebeAuswahl(dx: number, dy: number, mitHistorie?: boolean): void;
  setzeReihenfolge(befehl: Reihenfolgebefehl): void;
  richteAus(art: Ausrichtung): void;
  verteileGleichmaessig(achse: 'waagerecht' | 'senkrecht'): void;

  // -------------------------------------------------------------- Auswahl
  waehleAus(ids: string[], modus?: Auswahlmodus): void;
  waehleAlle(): void;
  hebeAuswahlAuf(): void;

  // -------------------------------------------------------------- Ansicht
  setzeAnsicht(ansicht: Partial<Ansicht>): void;
  setzeSeitenverhaeltnisHalten(wert: boolean): void;
}

/** Nächste freie Zeichenreihenfolge (neue Elemente liegen immer obenauf). */
function naechsteReihenfolge(elemente: PlanElement[]): number {
  return elemente.reduce((max, el) => Math.max(max, el.reihenfolge), 0) + 1;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  projekt: neuesProjekt(),
  auswahl: [],
  zwischenablage: [],
  eigeneVorlagen: [],
  ansicht: { x: 60, y: 60, zoom: 0.25 },
  geladen: false,
  seitenverhaeltnisHalten: false,
  vergangenheit: [],
  zukunft: [],

  // =========================================================== Projektdaten
  setzeProjekt(projekt, alsGeladen = true) {
    set({
      projekt,
      auswahl: [],
      vergangenheit: [],
      zukunft: [],
      geladen: alsGeladen,
    });
  },

  setzeEigeneVorlagen(vorlagen) {
    set({ eigeneVorlagen: vorlagen });
  },

  benenneProjektUm(name) {
    aendere(set, get, (p) => ({ ...p, name }));
  },

  setzeGrundflaeche(werte) {
    aendere(set, get, (p) => ({
      ...p,
      grundflaeche: { ...p.grundflaeche, ...werte },
    }));
  },

  setzeEinstellung(werte) {
    // Einstellungen sind Ansichtssache – sie landen nicht in der Historie.
    set((s) => ({
      projekt: { ...s.projekt, einstellungen: { ...s.projekt.einstellungen, ...werte } },
    }));
  },

  setzeEbene(id, werte) {
    set((s) => ({
      projekt: {
        ...s.projekt,
        ebenen: s.projekt.ebenen.map((e) => (e.id === id ? { ...e, ...werte } : e)),
      },
    }));
  },

  // =============================================================== Historie
  schnappschuss() {
    set((s) => ({
      vergangenheit: [...s.vergangenheit, structuredClone(s.projekt)].slice(-HISTORIE_TIEFE),
      zukunft: [],
    }));
  },

  rueckgaengig() {
    const { vergangenheit, projekt, zukunft } = get();
    if (vergangenheit.length === 0) return;
    const vorher = vergangenheit[vergangenheit.length - 1];
    set({
      projekt: vorher,
      vergangenheit: vergangenheit.slice(0, -1),
      zukunft: [...zukunft, structuredClone(projekt)],
      // Auswahl aufräumen: gelöschte Elemente dürfen nicht ausgewählt bleiben.
      auswahl: get().auswahl.filter((id) => vorher.elemente.some((e) => e.id === id)),
    });
  },

  wiederholen() {
    const { vergangenheit, projekt, zukunft } = get();
    if (zukunft.length === 0) return;
    const nachher = zukunft[zukunft.length - 1];
    set({
      projekt: nachher,
      zukunft: zukunft.slice(0, -1),
      vergangenheit: [...vergangenheit, structuredClone(projekt)],
      auswahl: get().auswahl.filter((id) => nachher.elemente.some((e) => e.id === id)),
    });
  },

  // =============================================================== Elemente
  fuegeElementHinzu(vorlage, x, y) {
    const id = neueId('el');
    aendere(set, get, (p) => ({
      ...p,
      elemente: [
        ...p.elemente,
        {
          id,
          vorlageId: vorlage.id,
          ebeneId: STANDARD_EBENE_ID,
          name: vorlage.name,
          kategorie: vorlage.kategorie,
          x,
          y,
          breite: vorlage.breite,
          tiefe: vorlage.tiefe,
          hoehe: vorlage.hoehe,
          drehung: 0,
          form: vorlage.form,
          farbe: vorlage.farbe,
          beschriftung: vorlage.standardBeschriftung ?? vorlage.name,
          beschriftungSichtbar: true,
          schriftgroesse: 12,
          gesperrt: false,
          reihenfolge: naechsteReihenfolge(p.elemente),
        },
      ],
    }));
    set({ auswahl: [id] });
    return id;
  },

  aendereElemente(ids, werte, mitHistorie = true) {
    const menge = new Set(ids);
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      elemente: p.elemente.map((el) => (menge.has(el.id) ? { ...el, ...werte } : el)),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  setzePositionen(werte, mitHistorie = false) {
    const karte = new Map(werte.map((w) => [w.id, w]));
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      elemente: p.elemente.map((el) => {
        const neu = karte.get(el.id);
        return neu && !el.gesperrt ? { ...el, x: neu.x, y: neu.y } : el;
      }),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  setzeGeometrien(werte) {
    const karte = new Map(werte.map((w) => [w.id, w]));
    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) => {
        const neu = karte.get(el.id);
        if (!neu || el.gesperrt) return el;
        return {
          ...el,
          x: neu.x,
          y: neu.y,
          breite: neu.breite,
          tiefe: neu.tiefe,
          drehung: ((neu.drehung % 360) + 360) % 360,
        };
      }),
    }));
  },

  loescheAuswahl() {
    const { auswahl } = get();
    if (auswahl.length === 0) return;
    const menge = new Set(auswahl);
    aendere(set, get, (p) => ({
      ...p,
      // Gesperrte Elemente werden bewusst nicht gelöscht.
      elemente: p.elemente.filter((el) => !menge.has(el.id) || el.gesperrt),
    }));
    set({ auswahl: [] });
  },

  dupliziereAuswahl() {
    const { auswahl, projekt } = get();
    if (auswahl.length === 0) return;
    const neue: PlanElement[] = [];
    let reihenfolge = naechsteReihenfolge(projekt.elemente);
    for (const el of projekt.elemente) {
      if (!auswahl.includes(el.id)) continue;
      neue.push({
        ...structuredClone(el),
        id: neueId('el'),
        // Etwas versetzt, damit die Kopie sichtbar ist.
        x: el.x + 30,
        y: el.y + 30,
        gesperrt: false,
        reihenfolge: reihenfolge++,
      });
    }
    aendere(set, get, (p) => ({ ...p, elemente: [...p.elemente, ...neue] }));
    set({ auswahl: neue.map((e) => e.id) });
  },

  kopiereAuswahl() {
    const { auswahl, projekt } = get();
    set({
      zwischenablage: projekt.elemente
        .filter((el) => auswahl.includes(el.id))
        .map((el) => structuredClone(el)),
    });
  },

  fuegeEin() {
    const { zwischenablage, projekt } = get();
    if (zwischenablage.length === 0) return;
    let reihenfolge = naechsteReihenfolge(projekt.elemente);
    const neue = zwischenablage.map((el) => ({
      ...structuredClone(el),
      id: neueId('el'),
      x: el.x + 40,
      y: el.y + 40,
      gesperrt: false,
      reihenfolge: reihenfolge++,
    }));
    aendere(set, get, (p) => ({ ...p, elemente: [...p.elemente, ...neue] }));
    // Die Zwischenablage rückt mit, damit mehrfaches Einfügen nicht übereinander landet.
    set({ auswahl: neue.map((e) => e.id), zwischenablage: neue.map((e) => structuredClone(e)) });
  },

  dreheAuswahl(grad) {
    const { auswahl } = get();
    if (auswahl.length === 0) return;
    const menge = new Set(auswahl);
    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) =>
        menge.has(el.id) && !el.gesperrt
          ? { ...el, drehung: (((el.drehung + grad) % 360) + 360) % 360 }
          : el,
      ),
    }));
  },

  verschiebeAuswahl(dx, dy, mitHistorie = true) {
    const { auswahl } = get();
    if (auswahl.length === 0) return;
    const menge = new Set(auswahl);
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      elemente: p.elemente.map((el) =>
        menge.has(el.id) && !el.gesperrt ? { ...el, x: el.x + dx, y: el.y + dy } : el,
      ),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  setzeReihenfolge(befehl) {
    const { auswahl } = get();
    if (auswahl.length === 0) return;
    aendere(set, get, (p) => {
      // Nach aktueller Reihenfolge sortieren, dann die Auswahl verschieben.
      const sortiert = [...p.elemente].sort((a, b) => a.reihenfolge - b.reihenfolge);
      const ausgewaehlt = sortiert.filter((el) => auswahl.includes(el.id));
      const rest = sortiert.filter((el) => !auswahl.includes(el.id));

      let neueListe: PlanElement[];
      if (befehl === 'ganzVorne') {
        neueListe = [...rest, ...ausgewaehlt];
      } else if (befehl === 'ganzHinten') {
        neueListe = [...ausgewaehlt, ...rest];
      } else {
        // Einen Platz nach vorne oder hinten schieben.
        neueListe = [...sortiert];
        const richtung = befehl === 'nachVorne' ? 1 : -1;
        const indizes = neueListe
          .map((el, i) => (auswahl.includes(el.id) ? i : -1))
          .filter((i) => i >= 0);
        // Bei "nach vorne" von hinten durchgehen, sonst überholen sich die Elemente.
        if (richtung === 1) indizes.reverse();
        for (const i of indizes) {
          const ziel = i + richtung;
          if (ziel < 0 || ziel >= neueListe.length) continue;
          if (auswahl.includes(neueListe[ziel].id)) continue;
          [neueListe[i], neueListe[ziel]] = [neueListe[ziel], neueListe[i]];
        }
      }
      return {
        ...p,
        elemente: neueListe.map((el, i) => ({ ...el, reihenfolge: i + 1 })),
      };
    });
  },

  richteAus(art) {
    const { auswahl, projekt } = get();
    if (auswahl.length < 2) return;
    const ausgewaehlt = projekt.elemente.filter((el) => auswahl.includes(el.id));
    const rahmen = gesamtUmgrenzung(ausgewaehlt);
    if (!rahmen) return;

    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) => {
        if (!auswahl.includes(el.id) || el.gesperrt) return el;
        const eigen = umgrenzung(el);
        const halbeBreite = (eigen.rechts - eigen.links) / 2;
        const halbeTiefe = (eigen.unten - eigen.oben) / 2;
        switch (art) {
          case 'links':
            return { ...el, x: rahmen.links + halbeBreite };
          case 'rechts':
            return { ...el, x: rahmen.rechts - halbeBreite };
          case 'mitteWaagerecht':
            return { ...el, x: (rahmen.links + rahmen.rechts) / 2 };
          case 'oben':
            return { ...el, y: rahmen.oben + halbeTiefe };
          case 'unten':
            return { ...el, y: rahmen.unten - halbeTiefe };
          case 'mitteSenkrecht':
            return { ...el, y: (rahmen.oben + rahmen.unten) / 2 };
        }
      }),
    }));
  },

  verteileGleichmaessig(achse) {
    const { auswahl, projekt } = get();
    if (auswahl.length < 3) return;
    const ausgewaehlt = projekt.elemente
      .filter((el) => auswahl.includes(el.id))
      .sort((a, b) => (achse === 'waagerecht' ? a.x - b.x : a.y - b.y));

    const erster = ausgewaehlt[0];
    const letzter = ausgewaehlt[ausgewaehlt.length - 1];
    const start = achse === 'waagerecht' ? erster.x : erster.y;
    const ende = achse === 'waagerecht' ? letzter.x : letzter.y;
    const schritt = (ende - start) / (ausgewaehlt.length - 1);

    const neuePositionen = new Map<string, number>();
    ausgewaehlt.forEach((el, i) => neuePositionen.set(el.id, start + schritt * i));

    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) => {
        const wert = neuePositionen.get(el.id);
        if (wert === undefined || el.gesperrt) return el;
        return achse === 'waagerecht' ? { ...el, x: wert } : { ...el, y: wert };
      }),
    }));
  },

  // ================================================================ Auswahl
  waehleAus(ids, modus = 'ersetzen') {
    if (modus === 'ersetzen') {
      set({ auswahl: ids });
      return;
    }
    set((s) => {
      const menge = new Set(s.auswahl);
      for (const id of ids) {
        if (menge.has(id)) menge.delete(id);
        else menge.add(id);
      }
      return { auswahl: [...menge] };
    });
  },

  waehleAlle() {
    const { projekt } = get();
    const sichtbareEbenen = new Set(
      projekt.ebenen.filter((e) => e.sichtbar && !e.gesperrt).map((e) => e.id),
    );
    set({
      auswahl: projekt.elemente
        .filter((el) => sichtbareEbenen.has(el.ebeneId))
        .map((el) => el.id),
    });
  },

  hebeAuswahlAuf() {
    set({ auswahl: [] });
  },

  // ================================================================ Ansicht
  setzeAnsicht(ansicht) {
    set((s) => ({ ansicht: { ...s.ansicht, ...ansicht } }));
  },

  setzeSeitenverhaeltnisHalten(wert) {
    set({ seitenverhaeltnisHalten: wert });
  },
}));

/**
 * Ändert das Projekt und legt vorher einen Schnappschuss für "Rückgängig" an.
 * Alle Aktionen, die Daten verändern, laufen über diese Funktion.
 */
function aendere(
  set: (teil: Partial<PlanStore>) => void,
  get: () => PlanStore,
  wandeln: (projekt: Projekt) => Projekt,
): void {
  const { projekt, vergangenheit } = get();
  set({
    vergangenheit: [...vergangenheit, structuredClone(projekt)].slice(-HISTORIE_TIEFE),
    zukunft: [],
    projekt: { ...wandeln(projekt), geaendertAm: Date.now() },
  });
}
