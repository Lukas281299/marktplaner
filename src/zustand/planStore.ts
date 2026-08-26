import { create } from 'zustand';
import { modulsatzFuer } from '../daten/module';
import { STANDARD_EBENE_ID, neuesProjekt } from '../daten/standardProjekt';
import { laeuftRueckwaerts } from '../logik/beschriftung';
import { feinRunde, gesamtUmgrenzung, runde, umgrenzung } from '../logik/geometrie';
import { hauptrichtung, reiheAneinander } from '../logik/gruppen';
import { neueId } from '../logik/id';
import { verschiebeEcke } from '../logik/elementEcken';
import { vervielfaeltige } from '../logik/vervielfaeltigen';
import {
  breiteAusSeiten,
  felderVon,
  seitenbreite,
  seitenTrennbar,
  uebernehmeBreiten,
  type Seite,
} from '../logik/regalseiten';
import { groesstBaubareLaenge, passeAn } from '../logik/feldaufteilung';
import {
  kannKopfgondel,
  kopflage,
  kopfmasse,
  mitAusgerichtetenKoepfen,
  type Kopfseite,
} from '../logik/kopfgondel';
import { raumart, VERKAUFSFLAECHE_FARBE } from '../daten/raumarten';
import { imUhrzeigersinn, verschiebe } from '../logik/polygon';
import {
  setzeSortimentsliste as speichereSortiment,
  setzeFavoriten as speichereFavoriten,
} from '../speicher/projektArchiv';
import { STANDARD_SORTIMENT, type Sortimentsliste } from '../daten/warengruppen';
import {
  mitAbgehaktemNamen,
  mitAufgenommenem,
  mitStand,
  pfadeUnter,
  type Standwert,
} from '../logik/sortiment';
import {
  mitZugeordnetenFeldern,
  ohneZugeordneteFelder,
  umgeschaltet,
} from '../logik/warengruppenzuordnung';
import { feldUnterPunkt } from '../logik/feldtreffer';
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
  Feldbezug,
  Punkt,
  Regalfeld,
  Raum,
  Raumart,
  Verkaufsflaeche,
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
  | 'grundrissZeichnen'
  | 'verkaufsflaeche'
  | 'textfeld';

/**
 * Was außer Elementen noch ausgewählt sein kann.
 *
 * Räume, Wände und Öffnungen teilen sich einen Platz: Das Eigenschaftenfenster
 * zeigt immer nur eines davon, und drei getrennte Felder wären drei Stellen,
 * an denen man das Aufräumen vergessen kann.
 */
export type Sonderauswahl = {
  art: 'raum' | 'wand' | 'oeffnung' | 'masslinie' | 'verkaufsflaeche';
  id: string;
} | null;

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
  /**
   * Kennungen der als Favorit markierten Vorlagen.
   *
   * Gehört zum Gerät, nicht zur Planung – siehe `holeFavoriten`. Deshalb
   * steht es hier neben dem Projekt und nicht darin, und deshalb läuft es
   * auch nicht über die Historie: Einen Favoriten zu setzen ist keine
   * Änderung am Plan.
   */
  favoriten: string[];
  /**
   * Die Sortimentsliste: Abteilungen, Warengruppen, Sortimente.
   *
   * Gehört zum Gerät, nicht zur Planung – siehe `holeSortimentsliste`. Ohne
   * geladene Liste gilt der allgemeine Anfang aus `daten/warengruppen.ts`.
   */
  sortiment: Sortimentsliste;
  /**
   * Die Warengruppe, die gerade zugeordnet wird – oder nichts.
   *
   * Solange hier ein Name steht, schreibt ein Klick auf ein Möbel ihn in das
   * getroffene Feld, statt das Möbel auszuwählen. Ein Pinsel eben: einmal
   * aufnehmen, dann so viele Meter bestreichen, wie man will.
   */
  warengruppenPinsel: string | null;
  /**
   * Die Meter, die gerade markiert sind.
   *
   * Markiert wird durch Anklicken, geschrieben mit Enter. Dazwischen sieht
   * man, was man erwischt hat – das ist der ganze Zweck des Umwegs.
   *
   * Meter und nicht Möbel: Eine Gondel ist **ein** Element mit sechs Feldern,
   * und die tragen verschiedene Warengruppen.
   */
  warengruppenMarkierung: Feldbezug[];
  /**
   * Welcher Reiter links offen ist: die Möbel oder die Warengruppen.
   *
   * Beides braucht die ganze Spalte – eine Bibliothek mit zehn Abteilungen
   * und eine Sortimentsliste mit dreihundert Namen. Deshalb teilen sie sich
   * den Platz, statt sich zu drängeln.
   */
  linkerReiter: 'bibliothek' | 'warengruppen';
  /**
   * Welche Abteilungen im Warengruppen-Reiter aufgeklappt sind.
   *
   * Zugeklappt ist der Anfang: Elf Abteilungen mit dreihundert Sortimenten
   * sind aufgeklappt keine Liste mehr, sondern eine Wand. Und der Zustand
   * gehört hierher und nicht in die Komponente – sonst stünde nach jedem
   * Wechsel zu den Möbeln wieder alles zu.
   */
  offeneAbteilungen: string[];
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
  /** Übernimmt eine geladene oder gespeicherte Sortimentsliste. */
  setzeSortimentsliste(liste: Sortimentsliste, speichern?: boolean): void;
  /** Nimmt einen Namen in die Liste auf – tut nichts, wenn er schon drinsteht. */
  nimmSortimentAuf(name: string): void;
  /** Nimmt eine Warengruppe zum Zuordnen auf – oder legt sie wieder weg. */
  setzeWarengruppenPinsel(name: string | null): void;
  /** Schaltet die linke Spalte zwischen Möbeln und Warengruppen um. */
  setzeLinkenReiter(reiter: 'bibliothek' | 'warengruppen'): void;
  /** Klappt eine Abteilung im Warengruppen-Reiter auf oder zu. */
  schalteAbteilung(name: string): void;
  /**
   * Hakt einen Eintrag der Sortimentsliste ab – mit allem darunter.
   *
   * Der Zustand gehört zur Planung: Die Liste sagt, was es gibt, der Haken
   * sagt, was in **diesem** Markt daraus geworden ist.
   */
  setzeSortimentsstand(pfad: string, wert: Standwert): void;
  /** Übernimmt eine geänderte Sortimentsliste und schreibt sie ans Gerät. */
  pflegeSortiment(liste: Sortimentsliste): void;
  /**
   * Ordnet die aufgenommene Warengruppe der Auswahl zu.
   *
   * Der Weg dorthin ist Enter: erst die Meter markieren, dann zuordnen. So
   * entsteht **ein** Name über die ganze Strecke statt viermal derselbe über
   * vier Metern – und man sieht vorher, was man erwischt hat.
   *
   * Gibt zurück, ob etwas geschrieben wurde; der Aufrufer sagt es in der
   * Statusleiste weiter.
   */
  ordneMarkierungZu(): boolean;
  /**
   * Nimmt den Meter unter diesem Punkt in die Markierung auf – oder heraus.
   *
   * Gibt zurück, ob dort ein Meter war.
   */
  markiereFeld(elementId: string, punkt: Punkt): boolean;
  /** Hebt die Markierung auf. */
  hebeMarkierungAuf(): void;
  /**
   * Nimmt die Beschriftung von den markierten Metern wieder weg.
   *
   * Damit man einen Fehlgriff loswird, ohne sich in die Gondelübersicht
   * hineinzuklicken und den Text dort von Hand zu löschen.
   */
  loescheMarkierteWarengruppen(): boolean;
  /** Schaltet die linke Spalte zwischen Möbeln und Warengruppen um. */
  setzeLinkenReiter(reiter: 'bibliothek' | 'warengruppen'): void;
  /** Klappt eine Abteilung im Warengruppen-Reiter auf oder zu. */
  schalteAbteilung(name: string): void;
  /**
   * Hakt einen Eintrag der Sortimentsliste ab – mit allem darunter.
   *
   * Der Zustand gehört zur Planung: Die Liste sagt, was es gibt, der Haken
   * sagt, was in **diesem** Markt daraus geworden ist.
   */
  setzeSortimentsstand(pfad: string, wert: Standwert): void;
  /** Übernimmt eine geänderte Sortimentsliste und schreibt sie ans Gerät. */
  pflegeSortiment(liste: Sortimentsliste): void;
  setzeFavoriten(ids: string[]): void;
  /** Markiert eine Vorlage als Favorit oder nimmt die Markierung zurück. */
  schalteFavorit(vorlageId: string): void;
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
      /** Eigener Umriss, zentriert – siehe `PlanElement.polygon`. */
      polygon?: Punkt[];
      form?: PlanElement['form'];
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
  /** Legt die Wandkörper aus einem eingelesenen Plan ab. */
  setzeWandkoerper(koerper: Punkt[][] | undefined): void;

  // ------------------------------------------- Räume, Wände und Öffnungen
  waehleSonder(auswahl: Sonderauswahl): void;
  /** Löscht, was gerade an Raum, Wand oder Öffnung ausgewählt ist. */
  loescheSonderauswahl(): void;

  fuegeRaumHinzu(umriss: Punkt[], art?: Raumart): string;
  aendereRaum(id: string, werte: Partial<Raum>, mitHistorie?: boolean): void;
  verschiebeRaum(id: string, dx: number, dy: number, mitHistorie?: boolean): void;

  /** Zeichnet eine weitere Teilfläche der Verkaufsfläche ein. */
  fuegeVerkaufsflaecheHinzu(umriss: Punkt[]): string;
  aendereVerkaufsflaeche(id: string, werte: Partial<Verkaufsflaeche>, mitHistorie?: boolean): void;
  verschiebeVerkaufsflaeche(id: string, dx: number, dy: number, mitHistorie?: boolean): void;

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
  /** Setzt die Feldaufteilung eines Zugs; die Breite folgt der Summe. */
  setzeSeitenfelder(id: string, seite: Seite, felder: Regalfeld[]): void;
  /** Setzt oder entfernt die Kopfgondel an einem Ende eines Zugs. */
  setzeKopfgondel(id: string, seite: Kopfseite, an: boolean): void;
  /** Zieht eine Ecke eines frei geformten Elements an eine neue Stelle. */
  verschiebeElementEcke(id: string, index: number, ziel: Punkt, mitHistorie?: boolean): void;
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
  favoriten: [],
  sortiment: STANDARD_SORTIMENT,
  warengruppenPinsel: null,
  warengruppenMarkierung: [],
  linkerReiter: 'bibliothek',
  offeneAbteilungen: [],
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

  setzeFavoriten(ids) {
    set({ favoriten: ids });
  },

  schalteFavorit(vorlageId) {
    const jetzt = get().favoriten;
    const neu = jetzt.includes(vorlageId)
      ? jetzt.filter((id) => id !== vorlageId)
      : [...jetzt, vorlageId];
    set({ favoriten: neu });
    void speichereFavoriten(neu);
  },

  setzeEigeneVorlagen(vorlagen) {
    set({ eigeneVorlagen: vorlagen });
  },

  setzeSortimentsliste(liste, speichern = false) {
    set({ sortiment: liste });
    if (speichern) void speichereSortiment(liste);
  },

  setzeLinkenReiter(reiter) {
    // Beim Wegschalten den Pinsel weglegen: Ein Klick auf ein Regal soll
    // nicht Wochen später noch eine Warengruppe schreiben.
    set(reiter === 'warengruppen' ? { linkerReiter: reiter } : { linkerReiter: reiter, warengruppenPinsel: null });
  },

  schalteAbteilung(name) {
    const offen = get().offeneAbteilungen;
    set({
      offeneAbteilungen: offen.includes(name)
        ? offen.filter((n) => n !== name)
        : [...offen, name],
    });
  },

  setzeSortimentsstand(pfad, wert) {
    const pfade = pfadeUnter(get().sortiment, pfad);
    aendere(set, get, (p) => ({ ...p, sortimentsstand: mitStand(p.sortimentsstand, pfade, wert) }));
  },

  pflegeSortiment(liste) {
    set({ sortiment: liste });
    void speichereSortiment(liste);
  },

  setzeWarengruppenPinsel(name) {
    // Beim Weglegen verschwindet auch die Markierung: Sie gehört zum
    // Zuordnen und hat ohne Namen keinen Sinn.
    set(name ? { warengruppenPinsel: name } : { warengruppenPinsel: null, warengruppenMarkierung: [] });
  },

  markiereFeld(elementId, punkt) {
    if (!get().warengruppenPinsel) return false;
    const element = get().projekt.elemente.find((el) => el.id === elementId);
    if (!element) return false;

    const treffer = feldUnterPunkt(element, punkt, 5);
    if (!treffer) return false;

    set({
      warengruppenMarkierung: umgeschaltet(get().warengruppenMarkierung, {
        element: elementId,
        seite: treffer.seite,
        feld: treffer.feld,
      }),
    });
    return true;
  },

  hebeMarkierungAuf() {
    set({ warengruppenMarkierung: [] });
  },

  ordneMarkierungZu() {
    const text = get().warengruppenPinsel;
    const markierung = get().warengruppenMarkierung;
    if (!text || markierung.length === 0) return false;

    // Kein eigener Schnappschuss: `aendere` legt ihn schon an. Zwei Einträge
    // hießen, dass der zweite Strg+Z nichts täte.
    aendere(set, get, (p) => ({
      ...p,
      // Geschrieben wird in dieselben Felder, die man in der Gondelübersicht
      // von Hand füllt: Es gibt nur eine Sorte Beschriftung.
      elemente: mitZugeordnetenFeldern(p.elemente, markierung, text),
      // Zugeordnet heißt abgehakt: Hier ist der Name genau der Name und nicht
      // ein Teil eines anderen – anders als beim früheren Textabgleich.
      sortimentsstand: mitAbgehaktemNamen(get().sortiment, p.sortimentsstand, text),
    }));
    // Die Markierung ist damit erledigt. Wer sie stehen ließe, schriebe beim
    // nächsten Enter versehentlich noch einmal dorthin.
    set({ warengruppenMarkierung: [] });
    return true;
  },

  loescheMarkierteWarengruppen() {
    const markierung = get().warengruppenMarkierung;
    if (markierung.length === 0) return false;

    aendere(set, get, (p) => ({
      ...p,
      elemente: ohneZugeordneteFelder(p.elemente, markierung),
    }));
    set({ warengruppenMarkierung: [] });
    return true;
  },

  nimmSortimentAuf(name) {
    const neu = mitAufgenommenem(get().sortiment, name);
    // Nichts zu tun heißt hier wirklich nichts: Der Name ist leer oder steht
    // schon da. Ein zweiter Eintrag desselben Namens hülfe niemandem.
    if (!neu) return;
    set({ sortiment: neu });
    void speichereSortiment(neu);
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
        form: m.form ?? m.vorlage.form,
        polygon: m.polygon,
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
          grundboden: vorlage.grundboden,
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

  setzeWandkoerper(koerper) {
    aendere(set, get, (p) => ({
      ...p,
      grundflaeche: { ...p.grundflaeche, wandkoerper: koerper },
    }));
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
            : art === 'verkaufsflaeche'
              ? projekt.verkaufsflaechen.find((v) => v.id === id)?.gesperrt
              : projekt.masslinien.find((m) => m.id === id)?.gesperrt;
    if (gesperrt) return;

    aendere(set, get, (p) => ({
      ...p,
      raeume: art === 'raum' ? p.raeume.filter((r) => r.id !== id) : p.raeume,
      waende: art === 'wand' ? p.waende.filter((w) => w.id !== id) : p.waende,
      oeffnungen: art === 'oeffnung' ? p.oeffnungen.filter((o) => o.id !== id) : p.oeffnungen,
      masslinien: art === 'masslinie' ? p.masslinien.filter((m) => m.id !== id) : p.masslinien,
      verkaufsflaechen:
        art === 'verkaufsflaeche'
          ? p.verkaufsflaechen.filter((v) => v.id !== id)
          : p.verkaufsflaechen,
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

  // -------------------------------------------------------- Verkaufsfläche
  fuegeVerkaufsflaecheHinzu(umriss) {
    const id = neueId('verkaufsflaeche');
    aendere(set, get, (p) => ({
      ...p,
      verkaufsflaechen: [
        ...p.verkaufsflaechen,
        {
          id,
          // Durchnummeriert statt „Neue Fläche": Wer drei Teilflächen
          // einzeichnet, findet sie in der Übersicht sonst nicht auseinander.
          name: `Verkaufsfläche ${p.verkaufsflaechen.length + 1}`,
          umriss: imUhrzeigersinn(umriss),
          farbe: VERKAUFSFLAECHE_FARBE,
          beschriftungSichtbar: true,
          gesperrt: false,
        },
      ],
    }));
    set({ sonderauswahl: { art: 'verkaufsflaeche', id }, auswahl: [] });
    return id;
  },

  aendereVerkaufsflaeche(id, werte, mitHistorie = true) {
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      verkaufsflaechen: p.verkaufsflaechen.map((v) => (v.id === id ? { ...v, ...werte } : v)),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  verschiebeVerkaufsflaeche(id, dx, dy, mitHistorie = false) {
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      verkaufsflaechen: p.verkaufsflaechen.map((v) =>
        v.id === id && !v.gesperrt ? { ...v, umriss: verschiebe(v.umriss, dx, dy) } : v,
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
          grundboden: vorlage.grundboden,
          achsmass: vorlage.achsmass,
          beidseitig: vorlage.beidseitig,
          // Kopie, nicht die Vorlage selbst: Sonst zögen zwei Trapeze aus
          // derselben Vorlage an denselben Punkten.
          polygon: vorlage.polygon?.map((punkt) => ({ ...punkt })),
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

  setzeSeitenfelder(id, seite, neueFelder) {
    aendere(set, get, (p) => {
      const zug = p.elemente.find((el) => el.id === id);
      if (!zug || neueFelder.length === 0) return p;

      // Getrennt einteilen lässt sich nur der Regalzug. Bei allem anderen –
      // einer Doppeltruhe etwa – sind die beiden Seiten ein Körper: Die
      // andere Seite übernimmt die Einteilung und behält nur ihre Notizen.
      const andere = seite === 'oben' ? 'unten' : 'oben';
      const mit = seitenTrennbar(zug)
        ? felderVon(zug, andere)
        : uebernehmeBreiten(
            felderVon(zug, andere),
            neueFelder.map((f) => f.breite),
          );

      const oben = seite === 'oben' ? neueFelder : mit;
      const unten = seite === 'unten' ? neueFelder : mit;

      // Ein Möbel ohne Einheiten – ein runder Kopf, eine Ecke, eine Palette –
      // hat keine Feldsumme, aus der sich seine Breite ergäbe. Dort ist das
      // eine Feld nur der Platz für Notiz und Warengruppe, und die Breite
      // bleibt, wie sie eingestellt ist. Sonst zöge das Schreiben einer Notiz
      // das Möbel auf ein Maß von vorhin zurück.
      const nachFeldern = Boolean(modulsatzFuer(zug.form) || zug.achsmass);
      const breite = nachFeldern
        ? breiteAusSeiten(zug, zug.beidseitig ? oben : undefined, unten)
        : zug.breite;
      if (breite <= 0) return p;

      // Der Zug wächst nach hinten, sein Anfang bleibt stehen. Das ist die
      // Richtung, in der man ihn baut: Ein Feld kommt hinten dran, nicht
      // links und rechts je ein halbes.
      //
      // „Hinten" heißt dabei rechts im Plan, nicht rechts in der eigenen
      // Achse. Ein Zug an der unteren Wand ist um 180° gedreht; wüchse er
      // entlang seiner eigenen Achse, liefe er im Plan nach links davon.
      const bogen = (zug.drehung * Math.PI) / 180;
      const wachsrichtung = laeuftRueckwaerts(zug.drehung) ? -1 : 1;
      const versatz = (wachsrichtung * (breite - zug.breite)) / 2;
      const gewachsen: PlanElement = {
        ...zug,
        felderUnten: unten,
        felderOben: zug.beidseitig ? oben : undefined,
        // Die alte Liste bleibt als Spiegel der Vorderseite stehen. Sie kostet
        // nichts und hält alles am Leben, was noch nach ihr greift – etwa eine
        // Planung, die in einer älteren Fassung des Programms geöffnet wird.
        felder: unten.map((f) => f.breite),
        breite,
        x: feinRunde(zug.x + versatz * Math.cos(bogen)),
        y: feinRunde(zug.y + versatz * Math.sin(bogen)),
      };
      return { ...p, elemente: richteKoepfeAus(p.elemente, gewachsen) };
    });
  },
  setzeKopfgondel(id, seite, an) {
    const zug = get().projekt.elemente.find((el) => el.id === id);
    if (!zug || !kannKopfgondel(zug)) return;
    const vorhanden = zug.kopfgondeln?.[seite];

    // ---- abwählen: den Kopf entfernen
    if (!an) {
      if (!vorhanden) return;
      aendere(set, get, (p) => ({
        ...p,
        elemente: p.elemente
          .filter((el) => el.id !== vorhanden)
          .map((el) =>
            el.id === id
              ? { ...el, kopfgondeln: { ...el.kopfgondeln, [seite]: undefined } }
              : el,
          ),
      }));
      set({ auswahl: get().auswahl.filter((a) => a !== vorhanden) });
      return;
    }

    // ---- anwählen: einen Kopf anlegen, falls noch keiner da ist
    if (vorhanden && get().projekt.elemente.some((el) => el.id === vorhanden)) return;

    const masse = kopfmasse(zug.tiefe);
    const lage = kopflage(zug, seite);
    const kopfId = neueId('element');
    // Beide gehören ab jetzt zusammen – dadurch wandert und dreht der Kopf
    // mit dem Zug, ohne dass es dafür einen eigenen Mechanismus braucht.
    const gruppeId = zug.gruppeId ?? neueId('gruppe');

    const kopf: PlanElement = {
      id: kopfId,
      vorlageId: `wt-kopf-gerade-${Math.round(masse.achsmass * 10)}-${Math.round((masse.tiefe - 7) * 10)}`,
      ebeneId: zug.ebeneId,
      name: `Kopfgondel A${Math.round(masse.achsmass * 10)}`,
      kategorie: zug.kategorie,
      // Feinrundung wie überall am Zug: Ein Kopf, der beim Anlegen auf
      // halbe Zentimeter gerastet wird, sitzt von Anfang an einen
      // Millimeter daneben.
      x: feinRunde(lage.x),
      y: feinRunde(lage.y),
      breite: masse.breite,
      tiefe: masse.tiefe,
      hoehe: zug.hoehe,
      drehung: lage.drehung,
      form: 'wt100',
      farbe: zug.farbe,
      beschriftung: '',
      beschriftungSichtbar: false,
      schriftgroesse: zug.schriftgroesse,
      warengruppe: zug.warengruppe,
      gesperrt: false,
      reihenfolge: zug.reihenfolge,
      achsmass: masse.achsmass,
      gruppeId,
      kopfVon: id,
    };

    aendere(set, get, (p) => ({
      ...p,
      gruppen: p.gruppen.some((g) => g.id === gruppeId)
        ? p.gruppen
        : [...p.gruppen, { id: gruppeId, name: zug.name, art: 'gondel' as Gruppenart }],
      elemente: [
        ...p.elemente.map((el) =>
          el.id === id
            ? { ...el, gruppeId, kopfgondeln: { ...el.kopfgondeln, [seite]: kopfId } }
            : el,
        ),
        kopf,
      ],
    }));

    // Der neue Kopf gehört ab jetzt zur Auswahl.
    //
    // Ohne das bliebe nach dem Anhaken nur der Zug ausgewählt – und wer
    // direkt danach auf „drehen" drückt, ließe den frisch gesetzten Kopf
    // stehen. Beim Klick auf dem Plan erweitert die Zeichenfläche die
    // Auswahl von sich aus um die Gruppe; hier muss es der Speicher tun,
    // weil die Gruppe gerade erst entstanden ist.
    const auswahl = get().auswahl;
    if (auswahl.includes(id)) set({ auswahl: [...new Set([...auswahl, kopfId])] });
  },

  verschiebeElementEcke(id, index, ziel, mitHistorie = false) {
    const element = get().projekt.elemente.find((el) => el.id === id);
    if (!element || element.gesperrt) return;
    const werte = verschiebeEcke(element, index, ziel);
    if (!werte) return;

    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      elemente: p.elemente.map((el) => (el.id === id ? { ...el, ...werte } : el)),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  setzePositionen(werte, mitHistorie = false) {
    const karte = new Map(werte.map((w) => [w.id, w]));
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      elemente: mitAusgerichtetenKoepfen(
        p.elemente.map((el) => {
          const neu = karte.get(el.id);
          return neu && !el.gesperrt ? { ...el, x: neu.x, y: neu.y } : el;
        }),
      ),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  setzeGeometrien(werte) {
    const karte = new Map(werte.map((w) => [w.id, w]));
    aendere(set, get, (p) => {
      const elemente = p.elemente.map((el) => {
        const neu = karte.get(el.id);
        if (!neu || el.gesperrt) return el;
        const gezogen: PlanElement = {
          ...el,
          x: neu.x,
          y: neu.y,
          breite: neu.breite,
          tiefe: neu.tiefe,
          drehung: ((neu.drehung % 360) + 360) % 360,
        };
        // Regale des wire-tech-Systems dürfen nur baubare Längen annehmen.
        // Alles andere behält seine freie Größe – ein Kühlmöbel oder eine
        // Freihand-Fläche kennt dieses Raster nicht.
        return el.form === 'wt100' ? aufBaubareLaenge(el, gezogen) : gezogen;
      });

      // Köpfe nachrücken, wo ein Zug seine Länge geändert hat.
      let ergebnis = elemente;
      for (const el of elemente) {
        if (el.kopfgondeln && karte.has(el.id)) ergebnis = richteKoepfeAus(ergebnis, el);
      }
      return { ...p, elemente: ergebnis };
    });
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
    const vorlagen = projekt.elemente.filter((el) => auswahl.includes(el.id));
    if (vorlagen.length === 0) return;

    const { elemente: neue, gruppen } = vervielfaeltige(
      vorlagen,
      { x: 30, y: 30 },
      naechsteReihenfolge(projekt.elemente),
      projekt.gruppen,
    );
    aendere(set, get, (p) => ({
      ...p,
      elemente: [...p.elemente, ...neue],
      gruppen: [...p.gruppen, ...gruppen],
    }));
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

    const { elemente: neue, gruppen } = vervielfaeltige(
      zwischenablage,
      { x: 40, y: 40 },
      naechsteReihenfolge(projekt.elemente),
      projekt.gruppen,
    );
    aendere(set, get, (p) => ({
      ...p,
      elemente: [...p.elemente, ...neue],
      gruppen: [...p.gruppen, ...gruppen],
    }));
    // Die Zwischenablage rückt mit, damit mehrfaches Einfügen nicht übereinander landet.
    set({ auswahl: neue.map((e) => e.id), zwischenablage: neue.map((e) => structuredClone(e)) });
  },

  dreheAuswahl(grad) {
    const { auswahl } = get();
    if (auswahl.length === 0) return;
    const menge = new Set(auswahl);
    aendere(set, get, (p) => {
      const betroffen = p.elemente.filter((el) => menge.has(el.id) && !el.gesperrt);
      if (betroffen.length === 0) return p;

      // Mehrere Elemente drehen sich **gemeinsam um ihre Mitte**, nicht jedes
      // um sich selbst. Vorher tat jedes Regal Letzteres: Ein Sechs-Meter-Zug
      // um 90 Grad gedreht fiel dabei in einen Haufen übereinanderstehender
      // Felder – jedes stand noch an seinem Platz, aber quer.
      //
      // Ein einzelnes Element dreht sich weiter um den eigenen Mittelpunkt.
      // Da ist beides dasselbe, und der kürzere Weg ist der klarere.
      const rahmen = betroffen.length > 1 ? gesamtUmgrenzung(betroffen) : null;
      const mx = rahmen ? (rahmen.links + rahmen.rechts) / 2 : 0;
      const my = rahmen ? (rahmen.oben + rahmen.unten) / 2 : 0;
      const bogen = (grad * Math.PI) / 180;
      const sin = Math.sin(bogen);
      const cos = Math.cos(bogen);

      return {
        ...p,
        elemente: mitAusgerichtetenKoepfen(
          p.elemente.map((el) => {
            if (!menge.has(el.id) || el.gesperrt) return el;
            const gedreht = { ...el, drehung: (((el.drehung + grad) % 360) + 360) % 360 };
            if (!rahmen) return gedreht;
            const dx = el.x - mx;
            const dy = el.y - my;
            return {
              ...gedreht,
              x: feinRunde(mx + dx * cos - dy * sin),
              y: feinRunde(my + dx * sin + dy * cos),
            };
          }),
        ),
      };
    });
  },

  verschiebeAuswahl(dx, dy, mitHistorie = true) {
    const { auswahl } = get();
    if (auswahl.length === 0) return;
    const menge = new Set(auswahl);
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      elemente: mitAusgerichtetenKoepfen(
        p.elemente.map((el) =>
          menge.has(el.id) && !el.gesperrt ? { ...el, x: el.x + dx, y: el.y + dy } : el,
        ),
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
      // Auch hier gilt: Ein Kopf steht dort, wo sein Zug ihn hinstellt.
      elemente: mitAusgerichtetenKoepfen(
        p.elemente.map((el) => {
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
      ),
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
/**
 * Setzt den geänderten Zug ein und rückt seine Kopfgondeln nach.
 *
 * Nötig, sobald sich Länge, Lage oder Drehung des Zugs ändern: Der Kopf steht
 * in dessen Achse, und ein Zug, der um ein Feld gewachsen ist, hat seinen Kopf
 * sonst mittendrin stehen.
 */
function richteKoepfeAus(elemente: PlanElement[], zug: PlanElement): PlanElement[] {
  const koepfe = zug.kopfgondeln;
  return elemente.map((el) => {
    if (el.id === zug.id) return zug;
    if (el.kopfVon !== zug.id) return el;
    const seite: Kopfseite | null =
      koepfe?.anfang === el.id ? 'anfang' : koepfe?.ende === el.id ? 'ende' : null;
    if (!seite) return el;
    const lage = kopflage(zug, seite);
    return { ...el, x: feinRunde(lage.x), y: feinRunde(lage.y), drehung: lage.drehung };
  });
}



/**
 * Rundet die gezogene Länge eines Regalzugs auf ein baubares Maß **ab**.
 *
 * Am Griff entstehen beliebige Zwischenmaße. Ein Regal von 6,37 m gibt es
 * aber nicht – es gibt nur Summen von Achsmaßen. Abgerundet und nicht
 * gerundet, weil ein Regal, das länger würde als die Stelle, an der man
 * losgelassen hat, im Markt eines zu viel ist.
 *
 * Heikel ist dabei die Lage: Wer rechts zieht, erwartet, dass links nichts
 * passiert. Welche Kante stehen bleiben soll, verrät der Vergleich mit dem
 * Zustand vor dem Ziehen – die Kante, die sich kaum bewegt hat, ist die, an
 * der nicht gezogen wurde.
 */
function aufBaubareLaenge(vorher: PlanElement, gezogen: PlanElement): PlanElement {
  const baubar = groesstBaubareLaenge(gezogen.breite);
  if (baubar === null || Math.abs(baubar - gezogen.breite) < 0.01) return gezogen;

  // Beide Seiten mitziehen – aber nur die, die bis an die gezogene Kante
  // reichen. Eine Gondel, deren Rückseite ein Feld kürzer ist, behält diese
  // Stufe: Am Griff wird das Möbel länger, nicht symmetrisch.
  const anpassen = (felder: Regalfeld[]): Regalfeld[] => {
    const laenge = seitenbreite(felder);
    const kuerzer = laenge < vorher.breite - 0.01;
    if (kuerzer && laenge <= baubar + 0.01) return felder;
    const passend = passeAn(
      felder.map((f) => f.breite),
      baubar,
    );
    return passend ? uebernehmeBreiten(felder, passend.felder) : felder;
  };

  const unten = anpassen(felderVon(vorher, 'unten'));
  const oben = vorher.beidseitig ? anpassen(felderVon(vorher, 'oben')) : undefined;
  const breite = breiteAusSeiten(vorher, oben, unten);

  // Längsrichtung des Zugs, vor und nach dem Ziehen.
  const richtung = (grad: number) => {
    const bogen = (grad * Math.PI) / 180;
    return { x: Math.cos(bogen), y: Math.sin(bogen) };
  };
  const uAlt = richtung(vorher.drehung);
  const uNeu = richtung(gezogen.drehung);

  const kante = (el: PlanElement, u: { x: number; y: number }, seite: -1 | 1) => ({
    x: el.x + (seite * el.breite) / 2 * u.x,
    y: el.y + (seite * el.breite) / 2 * u.y,
  });

  const linksAlt = kante(vorher, uAlt, -1);
  const rechtsAlt = kante(vorher, uAlt, 1);
  const linksNeu = kante(gezogen, uNeu, -1);
  const rechtsNeu = kante(gezogen, uNeu, 1);

  const linksBewegt = Math.hypot(linksNeu.x - linksAlt.x, linksNeu.y - linksAlt.y);
  const rechtsBewegt = Math.hypot(rechtsNeu.x - rechtsAlt.x, rechtsNeu.y - rechtsAlt.y);

  // Die ruhige Kante bleibt liegen, die gezogene rückt auf das baubare Maß.
  const fest = linksBewegt <= rechtsBewegt ? linksNeu : rechtsNeu;
  const seite = linksBewegt <= rechtsBewegt ? 1 : -1;

  return {
    ...gezogen,
    breite,
    felderUnten: unten,
    felderOben: oben,
    felder: unten.map((f) => f.breite),
    x: feinRunde(fest.x + (seite * breite) / 2 * uNeu.x),
    y: feinRunde(fest.y + (seite * breite) / 2 * uNeu.y),
  };
}

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
