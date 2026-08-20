import { create } from 'zustand';
import { STANDARD_EBENE_ID, neuesProjekt } from '../daten/standardProjekt';
import { gesamtUmgrenzung, runde, umgrenzung } from '../logik/geometrie';
import { hauptrichtung, reiheAneinander } from '../logik/gruppen';
import { neueId } from '../logik/id';
import { raumart } from '../daten/raumarten';
import { imUhrzeigersinn, verschiebe } from '../logik/polygon';
import type {
  BibliothekEintrag,
  Einstellungen,
  Grundflaeche,
  Gruppenart,
  Hintergrund,
  Masslinie,
  Oeffnung,
  PlanElement,
  Projekt,
  Punkt,
  Raum,
  Raumart,
  Wand,
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

/**
 * Was die Maus auf der Zeichenfläche gerade tut.
 *
 * `auswahl` ist der Normalfall – Elemente anklicken und verschieben. Die
 * übrigen Werkzeuge betreffen den Grundriss und schalten das Anklicken von
 * Elementen ab, damit man beim Aufziehen einer Fläche nicht aus Versehen ein
 * Regal erwischt.
 */
export type Werkzeug =
  | 'auswahl'
  | 'umriss'
  | 'flaecheAnfuegen'
  | 'flaecheAbziehen'
  | 'raum'
  | 'wand'
  | 'oeffnung'
  | 'messen'
  | 'grundrissZeichnen';

/**
 * Was außer Elementen noch ausgewählt sein kann.
 *
 * Räume, Wände und Öffnungen teilen sich einen Platz: Das Eigenschaftenfenster
 * zeigt immer nur eines davon, und drei getrennte Felder wären drei Stellen,
 * an denen man das Aufräumen vergessen kann.
 */
export type Sonderauswahl = { art: 'raum' | 'wand' | 'oeffnung' | 'masslinie'; id: string } | null;

interface PlanStore {
  // ------------------------------------------------------------------ Daten
  projekt: Projekt;
  /** Kennungen der ausgewählten Elemente. */
  auswahl: string[];
  /** Ausgewählter Raum, ausgewählte Wand oder Öffnung. */
  sonderauswahl: Sonderauswahl;
  werkzeug: Werkzeug;
  /**
   * Wartet die Anwendung darauf, dass eine Vorlage zum Austauschen gewählt
   * wird? Solange das an ist, fügt ein Klick in der Bibliothek nichts Neues
   * ein, sondern ersetzt die Auswahl.
   */
  tauschModus: boolean;
  /** Inhalt der internen Zwischenablage (Kopieren/Einfügen). */
  zwischenablage: PlanElement[];
  /** Selbst angelegte Bibliotheksvorlagen. */
  eigeneVorlagen: BibliothekEintrag[];
  ansicht: Ansicht;
  /** Erst `true`, wenn aus der Datenbank geladen wurde. */
  geladen: boolean;
  /**
   * Genau der Stand, wie er zuletzt geladen wurde – als Vergleichspunkt.
   *
   * Damit lässt sich „geöffnet" von „geändert" unterscheiden: Solange
   * `projekt` noch dasselbe Objekt ist, hat niemand etwas angefasst. Ohne das
   * würde schon das bloße Öffnen einer Planung als Änderung durchgehen und
   * beim Abgleich einen Unterschied vortäuschen, den es gar nicht gibt.
   */
  geladenerStand: Projekt | null;
  /** Beim Ziehen an den Ecken das Seitenverhältnis beibehalten? */
  seitenverhaeltnisHalten: boolean;

  vergangenheit: Projekt[];
  zukunft: Projekt[];

  // --------------------------------------------------------------- Projekt
  setzeProjekt(projekt: Projekt, alsGeladen?: boolean): void;
  setzeEigeneVorlagen(vorlagen: BibliothekEintrag[]): void;
  benenneProjektUm(name: string): void;
  setzeGrundflaeche(werte: Partial<Grundflaeche>): void;
  /**
   * Möbel aus einem eingelesenen Plan anlegen.
   *
   * Eigener Weg statt `fuegeElementHinzu` je Möbel: Ein Import bringt
   * Dutzende Elemente, und jedes einzeln anzulegen wäre ein Dutzend Schritte
   * in der Historie. So genügt einmal Strg+Z, um einen Import zurückzunehmen.
   */
  fuegeErkannteMoebelHinzu(
    moebel: {
      vorlage: BibliothekEintrag;
      x: number;
      y: number;
      breite: number;
      tiefe: number;
      hoehe: number;
      drehung: number;
      achsmass: number;
      beidseitig: boolean;
      beschriftung: string;
    }[],
  ): void;
  /** Einen eingelesenen Plan als Vorlage einlegen oder mit `undefined` entfernen. */
  setzeHintergrund(hintergrund: Hintergrund | undefined): void;
  /** Deckkraft, Sichtbarkeit und Lage der Vorlage ändern. */
  aendereHintergrund(werte: Partial<Hintergrund>): void;
  setzeEinstellung(werte: Partial<Einstellungen>): void;
  setzeEbene(id: string, werte: Partial<{ sichtbar: boolean; gesperrt: boolean }>): void;

  // -------------------------------------------------------------- Grundriss
  setzeWerkzeug(werkzeug: Werkzeug): void;
  setzeTauschModus(an: boolean): void;
  /**
   * Ersetzt die ausgewählten Elemente durch eine andere Vorlage.
   *
   * Lage, Drehung, Ebene und Beschriftung bleiben – getauscht wird nur, was
   * das Möbel ausmacht. Bei einem Regalzug bleibt zusätzlich die Feldzahl
   * erhalten: Aus sechs Feldern zu 1000 werden sechs Felder zu 1250 und
   * nicht ein einzelnes Feld. Genau so denkt man beim Umplanen.
   */
  tauscheVorlage(vorlage: BibliothekEintrag): void;
  /** Ersetzt den Umriss des Gebäudes. */
  setzeUmriss(umriss: Punkt[]): void;

  // ------------------------------------------- Räume, Wände und Öffnungen
  waehleSonder(auswahl: Sonderauswahl): void;
  /** Löscht, was gerade an Raum, Wand oder Öffnung ausgewählt ist. */
  loescheSonderauswahl(): void;

  fuegeRaumHinzu(umriss: Punkt[], art?: Raumart): string;
  aendereRaum(id: string, werte: Partial<Raum>, mitHistorie?: boolean): void;
  verschiebeRaum(id: string, dx: number, dy: number, mitHistorie?: boolean): void;

  fuegeWandHinzu(von: Punkt, bis: Punkt, staerke?: number): string;
  aendereWand(id: string, werte: Partial<Wand>, mitHistorie?: boolean): void;
  verschiebeWand(id: string, dx: number, dy: number, mitHistorie?: boolean): void;

  fuegeOeffnungHinzu(werte: Omit<Oeffnung, 'id' | 'gesperrt' | 'beschriftung'>): string;
  aendereOeffnung(id: string, werte: Partial<Oeffnung>, mitHistorie?: boolean): void;

  fuegeMasslinieHinzu(von: Punkt, bis: Punkt): string;
  aendereMasslinie(id: string, werte: Partial<Masslinie>, mitHistorie?: boolean): void;

  // ------------------------------------------------------------- Gruppen
  /** Fasst die Auswahl zu einer Gruppe zusammen. */
  gruppiere(art: Gruppenart): void;
  /** Löst die Gruppen aller ausgewählten Elemente auf. */
  hebeGruppeAuf(): void;
  /** Schiebt die Auswahl lückenlos aneinander. */
  reiheAneinanderAus(achse?: 'waagerecht' | 'senkrecht'): void;

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
  sonderauswahl: null,
  werkzeug: 'auswahl',
  tauschModus: false,
  zwischenablage: [],
  eigeneVorlagen: [],
  ansicht: { x: 60, y: 60, zoom: 0.25 },
  geladen: false,
  geladenerStand: null,
  seitenverhaeltnisHalten: false,
  vergangenheit: [],
  zukunft: [],

  // =========================================================== Projektdaten
  setzeProjekt(projekt, alsGeladen = true) {
    set({
      projekt,
      geladenerStand: projekt,
      auswahl: [],
      sonderauswahl: null,
      // Beim Öffnen einer anderen Planung wieder ins normale Arbeiten
      // zurückfallen – ein noch aktives Zeichenwerkzeug wäre eine Falle.
      werkzeug: 'auswahl',
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

  fuegeErkannteMoebelHinzu(moebel) {
    aendere(set, get, (p) => {
      let reihenfolge = naechsteReihenfolge(p.elemente);
      const neue: PlanElement[] = moebel.map((m) => ({
        id: neueId('el'),
        vorlageId: m.vorlage.id,
        ebeneId: STANDARD_EBENE_ID,
        name: m.vorlage.name,
        kategorie: m.vorlage.kategorie,
        x: m.x,
        y: m.y,
        breite: m.breite,
        tiefe: m.tiefe,
        hoehe: m.hoehe,
        drehung: m.drehung,
        form: m.vorlage.form,
        farbe: m.vorlage.farbe,
        stufen: m.vorlage.stufen,
        korpustiefe: m.vorlage.korpustiefe,
        achsmass: m.achsmass,
        beidseitig: m.beidseitig,
        beschriftung: m.beschriftung,
        // Aus einem Import kommen Dutzende Elemente auf einmal. Wären alle
        // beschriftet, wäre der Plan unter Text nicht mehr zu sehen.
        beschriftungSichtbar: false,
        schriftgroesse: 12,
        gesperrt: false,
        reihenfolge: reihenfolge++,
      }));
      return { ...p, elemente: [...p.elemente, ...neue] };
    });
  },

  setzeHintergrund(hintergrund) {
    // Über die Historie, damit ein versehentlich eingelegter oder gelöschter
    // Plan mit Strg+Z zurückkommt – das Bild noch einmal einzulesen wäre
    // sonst der einzige Weg zurück.
    aendere(set, get, (p) => ({ ...p, hintergrund }));
  },

  aendereHintergrund(werte) {
    // Deckkraft und Sichtbarkeit sind Ansichtssache und gehören nicht in die
    // Historie – sonst steht nach dem Zurücknehmen einer Regaländerung
    // plötzlich der Schieberegler anders.
    set((s) =>
      s.projekt.hintergrund
        ? { projekt: { ...s.projekt, hintergrund: { ...s.projekt.hintergrund, ...werte } } }
        : s,
    );
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

  // ============================================================== Grundriss
  setzeTauschModus(an) {
    set({ tauschModus: an });
  },

  tauscheVorlage(vorlage) {
    const ids = get().auswahl;
    if (ids.length === 0) return;
    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) => {
        if (!ids.includes(el.id) || el.gesperrt) return el;

        // Bei einem Zug die Feldzahl mitnehmen, sonst die Breite der Vorlage.
        const felder =
          el.achsmass && el.achsmass > 0 ? Math.max(1, Math.round(el.breite / el.achsmass)) : 0;
        const breite =
          felder > 0 && vorlage.achsmass && vorlage.achsmass > 0
            ? Math.round(felder * vorlage.achsmass * 10) / 10
            : vorlage.breite;

        return {
          ...el,
          vorlageId: vorlage.id,
          name: vorlage.name,
          kategorie: vorlage.kategorie,
          breite,
          tiefe: vorlage.tiefe,
          hoehe: vorlage.hoehe,
          form: vorlage.form,
          farbe: vorlage.farbe,
          stufen: vorlage.stufen,
          korpustiefe: vorlage.korpustiefe,
          achsmass: vorlage.achsmass,
          beidseitig: vorlage.beidseitig,
        };
      }),
    }));
    set({ tauschModus: false });
  },

  setzeWerkzeug(werkzeug) {
    // Beim Wechsel ins Zeichnen die Auswahl aufheben: Sonst blieben die
    // Anfasser eines Regals sichtbar, während man am Grundriss arbeitet.
    set(werkzeug === 'auswahl' ? { werkzeug } : { werkzeug, auswahl: [], sonderauswahl: null });
  },

  setzeUmriss(umriss) {
    if (umriss.length < 3) return;
    aendere(set, get, (p) => ({
      ...p,
      grundflaeche: { ...p.grundflaeche, umriss: imUhrzeigersinn(umriss) },
    }));
  },

  // ============================== Räume, Wände und Öffnungen
  waehleSonder(auswahl) {
    // Schließt die Elementauswahl aus – das Eigenschaftenfenster zeigt
    // immer nur eines von beiden.
    set(auswahl ? { sonderauswahl: auswahl, auswahl: [] } : { sonderauswahl: null });
  },

  loescheSonderauswahl() {
    const { sonderauswahl, projekt } = get();
    if (!sonderauswahl) return;
    const { art, id } = sonderauswahl;

    // Gesperrtes bleibt stehen – sonst wäre die Sperre wertlos.
    const gesperrt =
      art === 'raum'
        ? projekt.raeume.find((r) => r.id === id)?.gesperrt
        : art === 'wand'
          ? projekt.waende.find((w) => w.id === id)?.gesperrt
          : art === 'oeffnung'
            ? projekt.oeffnungen.find((o) => o.id === id)?.gesperrt
            : projekt.masslinien.find((m) => m.id === id)?.gesperrt;
    if (gesperrt) return;

    aendere(set, get, (p) => ({
      ...p,
      raeume: art === 'raum' ? p.raeume.filter((r) => r.id !== id) : p.raeume,
      waende: art === 'wand' ? p.waende.filter((w) => w.id !== id) : p.waende,
      oeffnungen: art === 'oeffnung' ? p.oeffnungen.filter((o) => o.id !== id) : p.oeffnungen,
      masslinien: art === 'masslinie' ? p.masslinien.filter((m) => m.id !== id) : p.masslinien,
    }));
    set({ sonderauswahl: null });
  },

  fuegeRaumHinzu(umriss, art = 'lager') {
    const id = neueId('raum');
    const vorlage = raumart(art);
    aendere(set, get, (p) => ({
      ...p,
      raeume: [
        ...p.raeume,
        {
          id,
          name: vorlage.name,
          umriss: imUhrzeigersinn(umriss),
          art,
          wandstaerke: 15,
          farbe: vorlage.farbe,
          beschriftungSichtbar: true,
          gesperrt: false,
        },
      ],
    }));
    set({ sonderauswahl: { art: 'raum', id }, auswahl: [] });
    return id;
  },

  aendereRaum(id, werte, mitHistorie = true) {
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      raeume: p.raeume.map((r) => (r.id === id ? { ...r, ...werte } : r)),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  verschiebeRaum(id, dx, dy, mitHistorie = false) {
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      raeume: p.raeume.map((r) =>
        r.id === id && !r.gesperrt ? { ...r, umriss: verschiebe(r.umriss, dx, dy) } : r,
      ),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  // ---------------------------------------------------------------- Wände
  fuegeWandHinzu(von, bis, staerke = 12) {
    const id = neueId('wand');
    aendere(set, get, (p) => ({
      ...p,
      waende: [...p.waende, { id, von, bis, staerke, art: 'trennwand', gesperrt: false }],
    }));
    set({ sonderauswahl: { art: 'wand', id }, auswahl: [] });
    return id;
  },

  aendereWand(id, werte, mitHistorie = true) {
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      waende: p.waende.map((w) => (w.id === id ? { ...w, ...werte } : w)),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  verschiebeWand(id, dx, dy, mitHistorie = false) {
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      waende: p.waende.map((w) =>
        w.id === id && !w.gesperrt
          ? {
              ...w,
              von: { x: w.von.x + dx, y: w.von.y + dy },
              bis: { x: w.bis.x + dx, y: w.bis.y + dy },
            }
          : w,
      ),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  // ------------------------------------------------------------ Öffnungen
  fuegeOeffnungHinzu(werte) {
    const id = neueId('oeffnung');
    aendere(set, get, (p) => ({
      ...p,
      oeffnungen: [...p.oeffnungen, { ...werte, id, beschriftung: '', gesperrt: false }],
    }));
    set({ sonderauswahl: { art: 'oeffnung', id }, auswahl: [] });
    return id;
  },

  aendereOeffnung(id, werte, mitHistorie = true) {
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      oeffnungen: p.oeffnungen.map((o) => (o.id === id ? { ...o, ...werte } : o)),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  // ----------------------------------------------------------- Maßlinien
  fuegeMasslinieHinzu(von, bis) {
    const id = neueId('mass');
    aendere(set, get, (p) => ({
      ...p,
      masslinien: [...p.masslinien, { id, von, bis, text: '', versatz: 0, gesperrt: false }],
    }));
    set({ sonderauswahl: { art: 'masslinie', id }, auswahl: [] });
    return id;
  },

  aendereMasslinie(id, werte, mitHistorie = true) {
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      masslinien: p.masslinien.map((m) => (m.id === id ? { ...m, ...werte } : m)),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  // ============================================================== Gruppen
  gruppiere(art) {
    const { auswahl } = get();
    // Unter zwei Elementen ergibt eine Gruppe keinen Sinn.
    if (auswahl.length < 2) return;
    const id = neueId('gruppe');
    const menge = new Set(auswahl);
    const name = art === 'gondel' ? 'Gondel' : art === 'zug' ? 'Regalzug' : 'Gruppe';

    aendere(set, get, (p) => ({
      ...p,
      // Bestehende Gruppen der Auswahl fallen weg – sie gehen in der neuen auf.
      gruppen: [
        ...p.gruppen.filter((g) =>
          p.elemente.some((el) => el.gruppeId === g.id && !menge.has(el.id)),
        ),
        { id, name: `${name} (${auswahl.length})`, art },
      ],
      elemente: p.elemente.map((el) => (menge.has(el.id) ? { ...el, gruppeId: id } : el)),
    }));
  },

  hebeGruppeAuf() {
    const { auswahl, projekt } = get();
    const betroffen = new Set(
      projekt.elemente.filter((el) => auswahl.includes(el.id) && el.gruppeId).map((el) => el.gruppeId!),
    );
    if (betroffen.size === 0) return;

    aendere(set, get, (p) => ({
      ...p,
      gruppen: p.gruppen.filter((g) => !betroffen.has(g.id)),
      elemente: p.elemente.map((el) =>
        el.gruppeId && betroffen.has(el.gruppeId) ? { ...el, gruppeId: undefined } : el,
      ),
    }));
  },

  reiheAneinanderAus(achse) {
    const { auswahl, projekt } = get();
    const ausgewaehlt = projekt.elemente.filter((el) => auswahl.includes(el.id));
    if (ausgewaehlt.length < 2) return;

    const richtung = achse ?? hauptrichtung(ausgewaehlt);
    const neue = reiheAneinander(ausgewaehlt, richtung);
    if (neue.length === 0) return;

    const karte = new Map(neue.map((n) => [n.id, n]));
    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) => {
        const ziel = karte.get(el.id);
        return ziel ? { ...el, x: runde(ziel.x), y: runde(ziel.y) } : el;
      }),
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
          stufen: vorlage.stufen,
          korpustiefe: vorlage.korpustiefe,
          achsmass: vorlage.achsmass,
          beidseitig: vorlage.beidseitig,
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
    // Ein Element auszuwählen hebt die Raumauswahl auf – siehe `waehleSonder`.
    if (ids.length > 0) set({ sonderauswahl: null });
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
    set({ auswahl: [], sonderauswahl: null });
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
