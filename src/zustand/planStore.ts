import { create } from 'zustand';
import { modulsatzFuer } from '../daten/module';
import { STANDARD_EBENE_ID, neuesProjekt } from '../daten/standardProjekt';
import { laeuftRueckwaerts } from '../logik/beschriftung';
import { feinRunde, gesamtUmgrenzung, runde, umgrenzung } from '../logik/geometrie';
import { hauptrichtung, reiheAneinander } from '../logik/gruppen';
import { neueId } from '../logik/id';
import { flaechenwandmasse } from '../logik/waende';
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
import { bezeichnungFuer } from '../logik/regalbezeichnung';
import {
  setzeSortimentsliste as speichereSortiment,
  setzeFavoriten as speichereFavoriten,
  setzeMoebelkennzahlen as speichereKennzahlen,
  type Moebelkennzahl,
} from '../speicher/projektArchiv';
import { STANDARD_SORTIMENT, type Sortimentsliste } from '../daten/warengruppen';
import {
  mitAbgehaktemNamen,
  mitsamtZugeordneten,
  mitAufgenommenem,
  mitStand,
  pfadeUnter,
  type Standwert,
  mitZuordnung,
} from '../logik/sortiment';
import {
  mitWarengruppen,
  mitZugeordnetenFeldern,
  ohneZugeordneteFelder,
  umgeschaltet,
  warengruppenVon,
} from '../logik/warengruppenzuordnung';
import { geordnet, mitVerschobenerKante } from '../logik/warengruppe';
import { mitUmbenanntemPfad } from '../logik/pfadumbenennung';
import { feldUnterPunkt } from '../logik/feldtreffer';
import { warengruppeUnterPunkt } from '../logik/warengruppentreffer';
import type {
  BibliothekEintrag,
  Einstellungen,
  Grundflaeche,
  Gruppenart,
  Hintergrund,
  Masslinie,
  Oeffnung,
  Oeffnungsart,
  PlanElement,
  Projekt,
  Feldbezug,
  Punkt,
  Regalfeld,
  Warengruppenabschnitt,
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
/**
 * Gaengige Wandstaerken in Zentimetern.
 *
 * Mauerwerk kommt in festen Massen: 11,5 fuer eine leichte Trennwand, 24 fuer
 * tragendes Mauerwerk, 36,5 fuer die Aussenwand. Genau diese Zahlen stehen
 * auch in den Bauplaenen.
 */
const WANDSTAERKEN = [10, 11.5, 15, 17.5, 20, 24, 30, 36.5, 42.5, 49];

/**
 * Die naechstliegende gaengige Wandstaerke zu einem aufgezogenen Mass.
 *
 * Beim Aufziehen laesst sich die Dicke nicht auf den Zentimeter treffen -
 * und das Raster steht meist auf einem halben Meter, womit die duennste
 * ziehbare Wand 50 cm waere. Deshalb rastet die kurze Seite auf ein
 * Mauerwerksmass ein statt aufs Raster.
 *
 * Unterhalb von 5 cm war es kein Ziehen, sondern ein Strich: Dann gilt, was
 * im Feld eingestellt ist.
 */
function naechsteWandstaerke(gezogen: number, voreinstellung: number): number {
  if (gezogen < 5) return voreinstellung;
  // Ueber dem groessten Mass ist es Absicht - eine Vormauerung etwa.
  const groesstes = WANDSTAERKEN[WANDSTAERKEN.length - 1];
  if (gezogen > groesstes * 1.3) return Math.round(gezogen);
  // Bei Gleichstand gewinnt das dickere Mass: Zwischen 20 und 24 ist das
  // 24er Mauerwerk das ueblichere, und eine Wand zu duenn zu zeichnen faellt
  // spaeter mehr auf als eine zu dicke.
  return WANDSTAERKEN.reduce((beste, s) =>
    Math.abs(s - gezogen) <= Math.abs(beste - gezogen) ? s : beste,
  );
}

/**
 * Den Verlauf eines Foerderbands mitziehen, wenn das Element skaliert wird.
 *
 * Ohne das bliebe der Zug stehen, waehrend sein Kasten waechst - im Plan ein
 * Band, das nicht mehr fuellt, was es belegt, und eine graue Flaeche
 * daneben. Der Verlauf liegt relativ zum Mittelpunkt; skaliert wird deshalb
 * einfach mit dem Verhaeltnis der Kastenmasse.
 */
/**
 * Die Bezeichnung nachziehen, wenn sich die Maße geaendert haben.
 *
 * Nur solange sie automatisch ist: Wer einen eigenen Text hinschreibt, hat
 * sich etwas dabei gedacht, und der bleibt stehen.
 */
/**
 * Ein geänderter Wandumriss samt neu gerechneter Achse und Dicke.
 *
 * Beides hängt am Umriss und darf nicht auseinanderlaufen: Wer eine Ecke
 * zieht, ändert die Wand, und die Zahlen daneben müssen das mitmachen.
 */
function mitAbgeleiteterAchse(umriss: Punkt[]): Partial<Wand> {
  const masse = flaechenwandmasse(umriss);
  if (!masse) return { umriss };
  return { umriss, von: masse.von, bis: masse.bis, staerke: masse.dicke };
}

function mitNachgezogenerBezeichnung(el: PlanElement): PlanElement {
  if (el.beschriftungAutomatisch === false) return el;
  const neu = bezeichnungFuer(el);
  if (!neu || neu === el.beschriftung) return el;
  return { ...el, beschriftung: neu };
}

function mitSkaliertemVerlauf(
  neu: PlanElement,
  alt: PlanElement,
  werte: Partial<PlanElement>,
): PlanElement {
  if (!alt.verlauf || alt.verlauf.length < 2) return neu;
  const aendertMass = typeof werte.breite === 'number' || typeof werte.tiefe === 'number';
  if (!aendertMass) return neu;
  if (alt.breite <= 0 || alt.tiefe <= 0) return neu;

  const fx = neu.breite / alt.breite;
  const fy = neu.tiefe / alt.tiefe;
  if (fx === 1 && fy === 1) return neu;

  return {
    ...neu,
    verlauf: alt.verlauf.map((p) => ({ x: p.x * fx, y: p.y * fy })),
    // Die Bandbreite folgt der kleineren Richtung: Ein Band, das doppelt so
    // lang wird, wird nicht doppelt so breit.
    bandbreite: alt.bandbreite ? alt.bandbreite * Math.min(fx, fy) : undefined,
  };
}

/** Welche der beiden Seitenleisten gemeint ist. */
export type Spaltenseite = 'links' | 'rechts';

/** Breite und Zustand beider Seitenleisten – das, was gemerkt wird. */
export interface Spaltenstand {
  links: number;
  rechts: number;
  linksOffen: boolean;
  rechtsOffen: boolean;
}

/**
 * Wie breit die Seitenleisten anfangs sind – dieselben Werte wie im Stil.
 *
 * Sie stehen hier **und** in `global.css`, weil beide Seiten sie brauchen:
 * die Anwendung, um sie zu verstellen, und der Stil, damit das Fenster schon
 * richtig steht, bevor der gemerkte Wert aus der Datenbank da ist.
 */
export const SPALTE_STANDARD = { links: 264, rechts: 304 } as const;

/** Grenzen fürs Ziehen. Schmaler wird unleserlich, breiter frisst den Plan. */
export const SPALTE_MIN = 190;
export const SPALTE_MAX = 620;

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
  | 'raumZeichnen'
  | 'foerderband'
  | 'wandZeichnen'
  | 'elementZeichnen'
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

export interface PlanStore {
  // ------------------------------------------------------------------ Daten
  projekt: Projekt;
  /** Kennungen der ausgewählten Elemente. */
  auswahl: string[];
  /** Ausgewählter Raum, ausgewählte Wand oder Öffnung. */
  sonderauswahl: Sonderauswahl;
  werkzeug: Werkzeug;
  /**
   * Wie stark die naechste gezeichnete Wand wird, in Zentimetern.
   *
   * Wer einen Grundriss nachzeichnet, zieht zwanzig Waende hintereinander -
   * und die haben fast immer dieselbe Staerke. Ohne diesen Wert muesste jede
   * einzeln nachgestellt werden. Er merkt sich auch, was zuletzt an einer
   * fertigen Wand eingestellt wurde: Wer eine Wand auf 24 stellt, meint
   * meistens auch die naechste so.
   */
  wandstaerkeNeu: number;
  /**
   * Ob eine gezogene Wand eine Linie ist oder ein Rechteck.
   *
   * Beim Abzeichnen eines Grundrisses sind die meisten Waende Teil eines
   * geschlossenen Zuges: vier Seiten eines Lagers, eines Sozialraums, eines
   * Kuehlhauses. Einzeln gezogen sind das vier Striche, die an den Ecken
   * genau aufeinandertreffen muessen - mit `rechteck` ist es einer.
   */
  wandmodus: 'linie' | 'rechteck';
  /**
   * Was beim naechsten Klick in eine Wand gesetzt wird.
   *
   * Wer eine Reihe Fenster in die Aussenwand setzt, will nicht nach jedem
   * einzelnen die Art umstellen. Wie die Wandstaerke merkt sich der Wert,
   * was zuletzt gewaehlt war.
   */
  oeffnungsartNeu: Oeffnungsart;
  /** Lichte Breite der naechsten Oeffnung, in Zentimetern. */
  oeffnungsbreiteNeu: number;
  /**
   * Richtung der naechsten frei gesetzten Oeffnung, in Grad.
   *
   * Wer die Waende selbst zieht, laesst an den Tueren Luecken - dort liegt
   * keine Wand, aus der sich die Richtung ergaebe. Sie merkt sich deshalb,
   * was zuletzt eingestellt war: Eine Reihe Tueren in derselben Wandflucht
   * hat dieselbe Richtung.
   */
  oeffnungsdrehungNeu: number;
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
   * Was jeder Möbeltyp an Auslagen und grünen Kisten fasst.
   *
   * Nach Vorlagenkennung, einmal eingetragen und danach für jedes weitere
   * Möbel derselben Art gültig – siehe `speicher/projektArchiv.ts`.
   */
  moebelkennzahlen: Record<string, Moebelkennzahl>;
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
  /**
   * Der aufgenommene Name samt seinem Platz in der Sortimentsliste.
   *
   * Der Pfad kommt mit, weil der Name allein nicht eindeutig ist: „Kuchen"
   * steht in der Liste fünfmal. Wer aus der Liste links aufnimmt, soll genau
   * das treffen, was er angeklickt hat.
   */
  warengruppenPinsel: { name: string; pfad: string } | null;

  /**
   * Der Name, für den gerade ein Ziel gesucht wird – „zählt zu".
   *
   * Solange er steht, ist das Programm im Zuordnen: Ein Klick auf einen
   * Namen in der Liste oder auf einen beschrifteten Meter im Plan setzt das
   * Ziel. Vorher fragte ein Eingabefeld nach dem Namen – abgetippt, und ein
   * Tippfehler blieb unsichtbar.
   */
  zuordnungslauf: string | null;
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
   * Ist die Suche über der Zeichenfläche offen?
   *
   * Gehört nicht zur Planung, sondern zur Sitzung: Nach dem Neuladen fängt
   * man ohne offene Suche an, und das ist richtig so.
   */
  sucheOffen: boolean;
  /**
   * Ist die Projektleiste rechts aufgeklappt?
   *
   * Sie ist gut dreihundert Punkte breit, und beim Zeichnen eines großen
   * Grundrisses will man diese dreihundert Punkte lieber für den Plan.
   */
  /**
   * Sind die beiden Seitenleisten aufgeklappt, und wie breit sind sie?
   *
   * Beides gehört zusammen und beides hält: Wer die Elementliste breiter
   * zieht, weil er lange Möbelnamen lesen will, will sie morgen genauso
   * breit wiederfinden. Gespeichert wird deshalb neben der Planung, nicht
   * darin – es ist eine Einstellung des Arbeitsplatzes und keine des Marktes.
   */
  linkeSpalteOffen: boolean;
  rechteSpalteOffen: boolean;
  spaltenbreite: { links: number; rechts: number };
  /**
   * Die Vorlage, die in der Liste angeklickt wurde – zum Ansehen.
   *
   * Ein Klick setzt kein Möbel mehr in den Plan (das tut erst der
   * Doppelklick). Damit der Klick trotzdem etwas bewirkt, zeigt das
   * Eigenschaftenfenster daraufhin die Maße der Vorlage: Man kann eine
   * Liste durchgehen und nachsehen, ohne den Plan anzufassen.
   */
  vorschau: BibliothekEintrag | null;
  /**
   * Die Vorlage, deren Umriss gerade gezeichnet wird.
   *
   * Ein Eckstück passt selten so, wie es der Katalog führt: Zwischen zwei
   * BakeOff-Türmen steht kein 45-Grad-Dreieck, sondern der Zwickel, der
   * eben übrig ist. Deshalb lässt sich der Umriss vor dem Setzen zeichnen,
   * Ecke für Ecke, statt ihn danach an den Punkten zurechtzuziehen.
   */
  zeichenvorlage: BibliothekEintrag | null;
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
  /**
   * Wie viele Klammern gerade offen sind (siehe `klammereZusammen`).
   *
   * Solange hier etwas steht, legt keine Änderung einen eigenen
   * Historieneintrag an – der erste deckt alles bis zum Schließen ab.
   */
  klammertiefe: number;
  /**
   * Steht in der offenen Klammer noch kein Eintrag?
   *
   * Die Klammer trägt **faul** ein: nicht beim Öffnen, sondern bei der ersten
   * Änderung. Sonst legte jede Runde des Assistenten einen Schritt an, auch
   * eine, die nur eine Frage beantwortet hat – und Strg+Z liefe ins Leere.
   */
  klammerFrisch: boolean;

  // --------------------------------------------------------------- Projekt
  setzeProjekt(projekt: Projekt, alsGeladen?: boolean): void;
  setzeEigeneVorlagen(vorlagen: BibliothekEintrag[]): void;
  /** Übernimmt eine geladene oder gespeicherte Sortimentsliste. */
  setzeSortimentsliste(liste: Sortimentsliste, speichern?: boolean): void;
  /** Nimmt einen Namen in die Liste auf – tut nichts, wenn er schon drinsteht. */
  nimmSortimentAuf(name: string): void;
  /** Nimmt eine Warengruppe zum Zuordnen auf – oder legt sie wieder weg. */
  setzeWarengruppenPinsel(pinsel: { name: string; pfad: string } | null): void;
  /** Schaltet die linke Spalte zwischen Möbeln und Warengruppen um. */
  setzeLinkenReiter(reiter: 'bibliothek' | 'warengruppen'): void;
  /** Öffnet oder schließt die Suche über der Zeichenfläche. */
  setzeSucheOffen(offen: boolean): void;
  /** Klappt eine Abteilung im Warengruppen-Reiter auf oder zu. */
  schalteAbteilung(name: string): void;
  /** Beginnt das Zuordnen – `null` bricht ab. */
  starteZuordnung(name: string | null): void;
  /**
   * Nimmt das Ziel aus dem Plan: die Warengruppe unter diesem Punkt.
   *
   * `false` heißt, dort stand nichts – dann bleibt der Lauf offen, statt
   * eine Zuordnung auf nichts zu setzen.
   */
  zuordneAusPlan(elementId: string, punkt: Punkt): boolean;
  /** Ordnet eine Warengruppe einer anderen zu – `null` hebt es auf. */
  setzeZuordnung(name: string, ziel: string | null): void;
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
   * Benennt einen Eintrag der Sortimentsliste um – samt der Planung.
   *
   * `alt` und `neu` sind volle Pfade. Ohne das Nachziehen zeigten die
   * Pfade an den Warengruppenstrecken und die grünen Haken auf einen
   * Namen, den die Liste nicht mehr kennt.
   */
  benenneSortimentUm(liste: Sortimentsliste, alt: string, neu: string): void;
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
  setzeFavoriten(ids: string[]): void;

  /** Übernimmt die am Gerät gemerkten Kennzahlen beim Start. */
  setzeMoebelkennzahlen(kennzahlen: Record<string, Moebelkennzahl>): void;

  /**
   * Legt fest, was ein Möbeltyp fasst – für alle seine Stücke.
   *
   * Die Zahl gilt rückwirkend: Wer sie ändert, ändert sie an jedem Möbel
   * dieser Vorlage im Plan. Alles andere wäre eine Falle – man trägt sie
   * einmal ein und übersieht die zwölf, die schon stehen.
   */
  setzeMoebelkennzahl(vorlageId: string, werte: Moebelkennzahl): void;

  /**
   * Legt fest, was **dieses eine** Möbel fasst.
   *
   * Für den Sonderfall: ein halbrundes Kopfstück, eine Ecke, ein frei
   * gezogenes Möbel. Die Zahl bleibt danach stehen, auch wenn jemand die
   * Typvorgabe ändert.
   */
  setzeElementkennzahl(elementId: string, werte: Moebelkennzahl): void;

  /** Nimmt die eigene Zahl zurück – das Möbel folgt wieder seinem Typ. */
  loeseElementkennzahl(elementId: string): void;
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

  /** Legt fest, wie stark neue Waende und Raumtrennwaende werden. */
  setzeWandstaerkeNeu(cm: number): void;

  /** Legt fest, ob eine gezogene Wand eine Linie ist oder ein Rechteck. */
  setzeWandmodus(modus: 'linie' | 'rechteck'): void;

  /** Legt fest, was beim naechsten Klick in eine Wand gesetzt wird. */
  setzeOeffnungsartNeu(art: Oeffnungsart): void;
  /** Legt die lichte Breite der naechsten Oeffnung fest. */
  setzeOeffnungsbreiteNeu(cm: number): void;
  /** Legt die Richtung der naechsten frei gesetzten Oeffnung fest. */
  setzeOeffnungsdrehungNeu(grad: number): void;

  /**
   * Eine Wand aus einem aufgezogenen Rechteck.
   *
   * Die lange Seite wird die Wand, die kurze ihre Staerke. So sieht man die
   * Wand beim Ziehen schon in ihrer wirklichen Dicke, statt sie als Strich
   * zu setzen und die Staerke danach einzutippen.
   */
  fuegeWandAusRechteck(rechteck: Punkt[]): string | null;

  /**
   * Ein Förderband entlang eines frei geklickten Zuges.
   *
   * Der Zug kommt in Plankoordinaten herein; gespeichert wird er relativ zum
   * Mittelpunkt, wie jeder eigene Umriss. Dadurch wandert der Verlauf beim
   * Verschieben von selbst mit und alles Übrige – Auswählen, Löschen,
   * Drehen – arbeitet wie bei jedem anderen Möbel.
   */
  fuegeFoerderbandHinzu(zug: Punkt[], bandbreite?: number): string | null;
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
  /**
   * Legt eine Wand als **Fläche** an – Ecke für Ecke gesetzt wie ein Raum.
   *
   * Länge, Dicke und Achse werden aus dem Umriss gerechnet. Damit baut man
   * einen trapezförmigen Zwickel oder eine abgeschrägte Ecke, für die eine
   * Achse mit einer Stärke zu wenig ist.
   */
  fuegeWandflaecheHinzu(umriss: Punkt[]): string | null;
  /** Zieht eine Ecke einer Flächenwand, ohne Eintrag in die Historie. */
  verschiebeWandEcke(id: string, index: number, punkt: Punkt): void;
  /** Setzt den ganzen Umriss neu – für Ecke einfügen und entfernen. */
  setzeWandumriss(id: string, umriss: Punkt[]): void;
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
  /**
   * Fasst alles, was `arbeit` anstellt, zu **einem** Schritt zusammen.
   *
   * Der Assistent stellt auf einen Satz hin zwanzig Dinge um. Ohne diese
   * Klammer bräuchte man zwanzigmal Strg+Z, um ihn zurückzunehmen – und sähe
   * zwischendurch Zustände, die niemand wollte.
   *
   * Verschachtelt sich das (eine geklammerte Aktion ruft eine andere auf),
   * zählt nur die äußerste; deshalb eine Tiefe und kein Schalter.
   */
  klammereZusammen<T>(arbeit: () => T): T;
  /**
   * Dasselbe für Abläufe mit Wartezeit dazwischen.
   *
   * Eine Runde des Assistenten wartet zwischen den Handgriffen auf die
   * Antwort der API; `klammereZusammen` mit seinem try/finally passt darauf
   * nicht. Wer öffnet, **muss** schließen – am besten in einem `finally`.
   */
  oeffneKlammer(): void;
  schliesseKlammer(): void;

  // ------------------------------------------------------------- Elemente
  fuegeElementHinzu(vorlage: BibliothekEintrag, x: number, y: number): string;
  aendereElemente(ids: string[], werte: Partial<PlanElement>, mitHistorie?: boolean): void;
  /** Setzt die Feldaufteilung eines Zugs; die Breite folgt der Summe. */
  setzeSeitenfelder(id: string, seite: Seite, felder: Regalfeld[]): void;

  /**
   * Setzt die Warengruppen-Abschnitte einer Seite.
   *
   * Getrennt von `setzeSeitenfelder`, weil es verschiedene Dinge sind: Die
   * Felder sagen, wie das Möbel gebaut ist, die Abschnitte, was darauf steht.
   * Eine Grenze zwischen zwei Sortimenten darf mitten durch ein Feld laufen.
   */
  setzeWarengruppen(id: string, seite: Seite, abschnitte: Warengruppenabschnitt[]): void;

  /**
   * Zieht eine Kante eines Abschnitts an eine neue Stelle.
   *
   * `ziel` ist ein Zentimeterwert in der **gespeicherten** Achse des Möbels.
   * Was daraus wird, entscheidet `mitVerschobenerKante`: Grenzt die Kante an
   * einen Nachbarn, wandern beide gemeinsam.
   */
  verschiebeWarengruppenkante(
    id: string,
    seite: Seite,
    index: number,
    kante: 'von' | 'bis',
    ziel: number,
    mitHistorie?: boolean,
  ): void;
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
  /** Klappt eine der beiden Seitenleisten auf oder zu. */
  schalteSpalte(seite: Spaltenseite): void;
  /** Zieht eine Seitenleiste breiter oder schmaler, in Bildpunkten. */
  setzeSpaltenbreite(seite: Spaltenseite, breite: number): void;
  /** Setzt den gemerkten Stand beim Start – ohne ihn gleich wieder zu sichern. */
  setzeSpaltenstand(stand: Partial<Spaltenstand>): void;
  /** Zeigt eine Vorlage im Eigenschaftenfenster an, ohne sie zu setzen. */
  zeigeVorlage(vorlage: BibliothekEintrag | null): void;
  /** Beginnt, den Umriss einer Vorlage von Hand zu zeichnen. */
  beginneUmrissZeichnen(vorlage: BibliothekEintrag): void;
  /** Setzt die Vorlage mit dem gezeichneten Umriss in den Plan. */
  fuegeElementAusUmrissHinzu(vorlage: BibliothekEintrag, umriss: Punkt[]): string | null;
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
  // 24 cm - das uebliche Mauerwerk, und die Staerke, in der die Plaene
  // ihre Aussenwaende zeichnen.
  wandstaerkeNeu: 24,
  wandmodus: 'linie',
  oeffnungsartNeu: 'tuer',
  oeffnungsbreiteNeu: 100,
  oeffnungsdrehungNeu: 0,
  tauschModus: false,
  zwischenablage: [],
  eigeneVorlagen: [],
  favoriten: [],
  moebelkennzahlen: {},
  sortiment: STANDARD_SORTIMENT,
  warengruppenPinsel: null,
  zuordnungslauf: null,
  warengruppenMarkierung: [],
  linkerReiter: 'bibliothek',
  sucheOffen: false,
  linkeSpalteOffen: true,
  rechteSpalteOffen: true,
  spaltenbreite: { links: SPALTE_STANDARD.links, rechts: SPALTE_STANDARD.rechts },
  vorschau: null,
  zeichenvorlage: null,
  offeneAbteilungen: [],
  ansicht: { x: 60, y: 60, zoom: 0.25 },
  geladen: false,
  geladenerStand: null,
  seitenverhaeltnisHalten: false,
  vergangenheit: [],
  zukunft: [],
  klammertiefe: 0,
  klammerFrisch: true,

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

  setzeMoebelkennzahlen(kennzahlen) {
    set({ moebelkennzahlen: kennzahlen });
  },

  setzeMoebelkennzahl(vorlageId, werte) {
    const neu = { ...get().moebelkennzahlen, [vorlageId]: werte };
    set({ moebelkennzahlen: neu });
    void speichereKennzahlen(neu);

    // Und an jedem Stück dieser Vorlage im Plan nachziehen – außer an denen,
    // die von Hand eine eigene Zahl bekommen haben. Ein halbrundes Kopfstück
    // oder eine Ecke mit zwei Kisten weniger soll nicht stillschweigend
    // wieder auf die Typvorgabe zurückspringen.
    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) =>
        el.vorlageId === vorlageId && !el.kennzahlEigen
          ? { ...el, auslagen: werte.auslagen, ifkoKisten: werte.ifkoKisten }
          : el,
      ),
    }));
  },

  setzeElementkennzahl(elementId, werte) {
    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) =>
        el.id === elementId ? { ...el, ...werte, kennzahlEigen: true } : el,
      ),
    }));
  },

  loeseElementkennzahl(elementId) {
    const kennzahlen = get().moebelkennzahlen;
    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) => {
        if (el.id !== elementId) return el;
        const vorgabe = kennzahlen[el.vorlageId];
        return {
          ...el,
          auslagen: vorgabe?.auslagen,
          ifkoKisten: vorgabe?.ifkoKisten,
          kennzahlEigen: undefined,
        };
      }),
    }));
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

  setzeSucheOffen(offen) {
    set({ sucheOffen: offen });
  },

  schalteAbteilung(name) {
    const offen = get().offeneAbteilungen;
    set({
      offeneAbteilungen: offen.includes(name)
        ? offen.filter((n) => n !== name)
        : [...offen, name],
    });
  },

  starteZuordnung(name) {
    // Das Aufnehmen und das Zuordnen schließen sich aus: Beide warten auf
    // einen Klick, und zwei Erwartungen an denselben Klick sind eine zu viel.
    set({ zuordnungslauf: name, warengruppenPinsel: null, warengruppenMarkierung: [] });
  },

  zuordneAusPlan(elementId, punkt) {
    const quelle = get().zuordnungslauf;
    if (!quelle) return false;
    const element = get().projekt.elemente.find((el) => el.id === elementId);
    if (!element) return false;
    const treffer = warengruppeUnterPunkt(element, punkt);
    if (!treffer) return false;
    // Auf sich selbst zuzuordnen wäre keine Aussage, sondern ein Versehen.
    if (treffer.name.trim().toLocaleLowerCase('de-DE') === quelle.trim().toLocaleLowerCase('de-DE')) {
      return false;
    }
    get().setzeZuordnung(quelle, treffer.name);
    set({ zuordnungslauf: null });
    return true;
  },

  setzeZuordnung(name, ziel) {
    aendere(set, get, (p) => ({ ...p, zuordnungen: mitZuordnung(p.zuordnungen, name, ziel) }));
  },

  setzeSortimentsstand(pfad, wert) {
    const pfade = pfadeUnter(get().sortiment, pfad);
    aendere(set, get, (p) => ({ ...p, sortimentsstand: mitStand(p.sortimentsstand, pfade, wert) }));
  },

  pflegeSortiment(liste) {
    set({ sortiment: liste });
    void speichereSortiment(liste);
  },

  benenneSortimentUm(liste, alt, neu) {
    set({ sortiment: liste });
    void speichereSortiment(liste);
    // Und die Pfade in der Planung mitziehen: Sie sind Zeichenketten und
    // zeigten sonst auf einen Namen, den es nicht mehr gibt – siehe
    // `logik/pfadumbenennung.ts`.
    aendere(set, get, (p) => mitUmbenanntemPfad(p, alt, neu));
  },

  setzeWarengruppenPinsel(pinsel) {
    // Beim Weglegen verschwindet auch die Markierung: Sie gehört zum
    // Zuordnen und hat ohne Namen keinen Sinn.
    set(
      pinsel
        ? { warengruppenPinsel: pinsel }
        : { warengruppenPinsel: null, warengruppenMarkierung: [] },
    );
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
    const pinsel = get().warengruppenPinsel;
    const markierung = get().warengruppenMarkierung;
    if (!pinsel || markierung.length === 0) return false;
    const text = pinsel.name;

    // Kein eigener Schnappschuss: `aendere` legt ihn schon an. Zwei Einträge
    // hießen, dass der zweite Strg+Z nichts täte.
    aendere(set, get, (p) => ({
      ...p,
      // Geschrieben wird in dieselben Felder, die man in der Gondelübersicht
      // von Hand füllt: Es gibt nur eine Sorte Beschriftung.
      elemente: mitZugeordnetenFeldern(p.elemente, markierung, text, pinsel.pfad),
      // Zugeordnet heißt abgehakt: Hier ist der Name genau der Name und nicht
      // ein Teil eines anderen – anders als beim früheren Textabgleich.
      // Ein zugeordneter Name gilt mit ab: Wer „Kuchen" malt, hat auch die
      // Waffeln untergebracht, wenn er sie dem Kuchen zugeschlagen hat.
      sortimentsstand: mitsamtZugeordneten(text, p.zuordnungen).reduce(
        (stand, name) => mitAbgehaktemNamen(get().sortiment, stand, name),
        p.sortimentsstand,
      ),
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

  setzeWandstaerkeNeu(cm) {
    set({ wandstaerkeNeu: Math.max(2, Math.round(cm)) });
  },

  setzeWandmodus(modus) {
    set({ wandmodus: modus });
  },

  setzeOeffnungsartNeu(art) {
    set({ oeffnungsartNeu: art });
  },

  setzeOeffnungsbreiteNeu(cm) {
    set({ oeffnungsbreiteNeu: Math.max(20, Math.round(cm)) });
  },

  setzeOeffnungsdrehungNeu(grad) {
    set({ oeffnungsdrehungNeu: grad });
  },

  fuegeWandAusRechteck(rechteck) {
    if (rechteck.length < 3) return null;
    const xs = rechteck.map((p) => p.x);
    const ys = rechteck.map((p) => p.y);
    const links = Math.min(...xs);
    const rechts = Math.max(...xs);
    const oben = Math.min(...ys);
    const unten = Math.max(...ys);
    const breite = rechts - links;
    const hoehe = unten - oben;
    if (breite < 1 && hoehe < 1) return null;

    // Die lange Seite ist die Wand, die kurze ihre Staerke. Die Achse liegt
    // in der Mitte - dort, wo `Waende` sie auch zeichnet.
    const laengs = breite >= hoehe;
    const staerke = naechsteWandstaerke(laengs ? hoehe : breite, get().wandstaerkeNeu);
    const mitte = laengs ? (oben + unten) / 2 : (links + rechts) / 2;
    const von = laengs ? { x: links, y: mitte } : { x: mitte, y: oben };
    const bis = laengs ? { x: rechts, y: mitte } : { x: mitte, y: unten };

    const id = neueId('wand');
    aendere(set, get, (p) => ({
      ...p,
      waende: [...p.waende, { id, von, bis, staerke, art: 'trennwand' as const, gesperrt: false }],
    }));
    // Die aufgezogene Staerke gilt auch fuer die naechste Wand.
    set({ wandstaerkeNeu: staerke, sonderauswahl: { art: 'wand', id }, auswahl: [] });
    return id;
  },

  fuegeFoerderbandHinzu(zug, bandbreite = 40) {
    if (zug.length < 2) return null;
    const halb = bandbreite / 2;
    // Der Kasten umfasst das Band samt seiner Breite – sonst ragte es an den
    // Enden und in den Kurven über die eigene Auswahl hinaus.
    const xs = zug.map((p) => p.x);
    const ys = zug.map((p) => p.y);
    const links = Math.min(...xs) - halb;
    const oben = Math.min(...ys) - halb;
    const breite = Math.max(...xs) + halb - links;
    const tiefe = Math.max(...ys) + halb - oben;
    const mitte = { x: links + breite / 2, y: oben + tiefe / 2 };

    const id = neueId('el');
    aendere(set, get, (p) => ({
      ...p,
      elemente: [
        ...p.elemente,
        {
          id,
          vorlageId: 'foerderband',
          name: 'Förderband',
          kategorie: 'kassen' as const,
          form: 'foerderband' as const,
          x: links,
          y: oben,
          breite,
          tiefe,
          hoehe: 25,
          drehung: 0,
          farbe: '#c9cdd2',
          ebeneId: STANDARD_EBENE_ID,
          gesperrt: false,
          reihenfolge: naechsteReihenfolge(p.elemente),
          beschriftung: 'Förderband',
          beschriftungSichtbar: false,
          schriftgroesse: 12,
          verlauf: zug.map((q) => ({ x: q.x - mitte.x, y: q.y - mitte.y })),
          bandbreite,
        },
      ],
    }));
    set({ auswahl: [id], sonderauswahl: null });
    return id;
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
    set(
      auswahl
        ? { sonderauswahl: auswahl, auswahl: [], vorschau: null }
        : { sonderauswahl: null, vorschau: null },
    );
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
          // Ein abgetrennter Raum markiert die Fläche; die Wände zieht
          // der Planer selbst mit dem Wandwerkzeug. Zwei Wände an
          // derselben Stelle - eine gezogene und eine vom Raum - sind im
          // Plan nicht zu unterscheiden und in der Rechnung doppelt.
          wandstaerke: 0,
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
    if (typeof werte.wandstaerke === 'number') set({ wandstaerkeNeu: werte.wandstaerke });
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
  fuegeWandHinzu(von, bis, staerke = get().wandstaerkeNeu) {
    const id = neueId('wand');
    aendere(set, get, (p) => ({
      ...p,
      waende: [...p.waende, { id, von, bis, staerke, art: 'trennwand', gesperrt: false }],
    }));
    set({ sonderauswahl: { art: 'wand', id }, auswahl: [] });
    return id;
  },

  fuegeWandflaecheHinzu(umriss) {
    const masse = flaechenwandmasse(umriss);
    if (!masse) return null;

    const id = neueId('wand');
    const wand: Wand = {
      id,
      umriss,
      // Achse und Dicke sind hier abgeleitet und nicht eingestellt. Sie
      // stehen trotzdem im Datensatz: Türen, Bemaßung und Einrasten rechnen
      // damit weiter, ohne von der Fläche wissen zu müssen.
      von: masse.von,
      bis: masse.bis,
      staerke: masse.dicke,
      art: 'trennwand',
      gesperrt: false,
    };
    aendere(set, get, (p) => ({ ...p, waende: [...p.waende, wand] }));
    set({ sonderauswahl: { art: 'wand', id }, auswahl: [] });
    return id;
  },

  /**
   * Verschiebt eine Ecke einer als Fläche gezeichneten Wand.
   *
   * Achse und Dicke werden dabei neu gerechnet – sonst zeigte das
   * Eigenschaftenfenster die Maße von vorhin, und eine Tür säße daneben.
   */
  verschiebeWandEcke(id, index, punkt) {
    const wand = get().projekt.waende.find((w) => w.id === id);
    if (!wand?.umriss || wand.gesperrt) return;
    const umriss = wand.umriss.map((p, i) => (i === index ? punkt : p));
    get().aendereWand(id, mitAbgeleiteterAchse(umriss), false);
  },

  setzeWandumriss(id, umriss) {
    const wand = get().projekt.waende.find((w) => w.id === id);
    if (!wand?.umriss || wand.gesperrt || umriss.length < 3) return;
    get().aendereWand(id, mitAbgeleiteterAchse(umriss), true);
  },

  aendereWand(id, werte, mitHistorie = true) {
    // Eine geaenderte Staerke gilt auch fuer die naechste Wand - sonst
    // stellt man beim Nachzeichnen jede einzeln nach.
    if (typeof werte.staerke === 'number') set({ wandstaerkeNeu: werte.staerke });
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
              // Eine Flächenwand wandert mit ihrem Umriss – sonst bliebe der
              // Körper stehen und nur die gedachte Achse zöge weiter.
              umriss: w.umriss?.map((p2) => ({ x: p2.x + dx, y: p2.y + dy })),
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
    // Eine geaenderte Art oder Breite gilt auch fuer die naechste Oeffnung -
    // wer ein Fenster einsetzt, setzt meist gleich das naechste.
    if (werte.art) set({ oeffnungsartNeu: werte.art });
    if (typeof werte.breite === 'number') set({ oeffnungsbreiteNeu: werte.breite });
    if (typeof werte.drehung === 'number') set({ oeffnungsdrehungNeu: werte.drehung });
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
    // „Regalzug" nur, wo wirklich Regale stehen. Drei Blumentreppen sind
    // eine Reihe, und im Gruppennamen soll stehen, was man vor sich hat.
    const ausgewaehlt = get().projekt.elemente.filter((el) => get().auswahl.includes(el.id));
    const regalig = ausgewaehlt.some((el) => el.kategorie === 'regale' || el.kategorie === 'kuehlung');
    const name =
      art === 'gondel' ? 'Gondel' : art === 'zug' ? (regalig ? 'Regalzug' : 'Reihe') : 'Gruppe';

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
    // In einer angebrochenen Klammer steht der Eintrag schon; ein zweiter
    // wäre ein zusätzliches Strg+Z mitten in einer Aktion, die eine ist.
    const { klammertiefe, klammerFrisch } = get();
    if (klammertiefe > 0 && !klammerFrisch) return;
    set((s) => ({
      vergangenheit: [...s.vergangenheit, structuredClone(s.projekt)].slice(-HISTORIE_TIEFE),
      zukunft: [],
      klammerFrisch: false,
    }));
  },

  oeffneKlammer() {
    const tiefe = get().klammertiefe;
    // Nur die äußerste Klammer setzt zurück – eine innere darf den schon
    // gelegten Eintrag nicht für frisch erklären.
    set(tiefe === 0 ? { klammertiefe: 1, klammerFrisch: true } : { klammertiefe: tiefe + 1 });
  },

  schliesseKlammer() {
    set({ klammertiefe: Math.max(0, get().klammertiefe - 1) });
  },

  klammereZusammen(arbeit) {
    get().oeffneKlammer();
    try {
      return arbeit();
    } finally {
      // Auch wenn die Arbeit mit einem Fehler abbricht: Bliebe die Klammer
      // offen, käme ab da nichts mehr in die Historie.
      get().schliesseKlammer();
    }
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
          // Solange niemand einen eigenen Text hinschreibt, folgt sie den
          // Maßen – siehe `mitNachgezogenerBezeichnung`.
          beschriftungAutomatisch: true,
          beschriftungSichtbar: true,
          schriftgroesse: 12,
          gesperrt: false,
          reihenfolge: naechsteReihenfolge(p.elemente),
          // Was dieser Möbeltyp fasst, wurde einmal eingetragen und gilt für
          // jedes weitere Stück. Ohne das müsste man es bei jedem Tisch neu
          // hinschreiben – und bei einer Abteilung aus zwanzig Tischen wird
          // daraus zwanzigmal dieselbe Zahl.
          ...(get().moebelkennzahlen[vorlage.id] ?? {}),
        },
      ],
    }));
    set({ auswahl: [id] });
    return id;
  },

  aendereElemente(ids, werte, mitHistorie = true) {
    const menge = new Set(ids);
    // Ein von Hand geschriebener Text bleibt stehen – ab jetzt zieht die
    // Bezeichnung nicht mehr mit.
    if (typeof werte.beschriftung === 'string') werte = { ...werte, beschriftungAutomatisch: false };
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      elemente: p.elemente.map((el) =>
        menge.has(el.id)
          ? mitNachgezogenerBezeichnung(mitSkaliertemVerlauf({ ...el, ...werte }, el, werte))
          : el,
      ),
    });
    if (mitHistorie) aendere(set, get, wandeln);
    else set((s) => ({ projekt: wandeln(s.projekt) }));
  },

  setzeWarengruppen(id, seite, abschnitte) {
    aendere(set, get, (p) => ({
      ...p,
      elemente: p.elemente.map((el) => {
        if (el.id !== id) return el;
        const breite = seitenbreite(felderVon(el, seite));
        return mitWarengruppen(el, seite, geordnet(abschnitte, breite));
      }),
    }));
  },

  verschiebeWarengruppenkante(id, seite, index, kante, ziel, mitHistorie = true) {
    const wandeln = (p: Projekt): Projekt => ({
      ...p,
      elemente: p.elemente.map((el) => {
        if (el.id !== id) return el;
        const breite = seitenbreite(felderVon(el, seite));
        return mitWarengruppen(
          el,
          seite,
          mitVerschobenerKante(warengruppenVon(el, seite), breite, index, kante, ziel),
        );
      }),
    });

    // Beim Ziehen ohne Historie: Sonst läge nach einer Bewegung für jeden
    // Mausschritt ein eigener Schritt darin. Der Schnappschuss kommt vom
    // Anfasser, bevor er losläuft.
    if (mitHistorie) aendere(set, get, wandeln);
    else set({ projekt: { ...wandeln(get().projekt), geaendertAm: Date.now() } });
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
      // Mit den Feldern ändern sich die Achsmaße – und damit die
      // Bezeichnung, aus der man beim Bestellen abschreibt.
      return { ...p, elemente: richteKoepfeAus(p.elemente, mitNachgezogenerBezeichnung(gewachsen)) };
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
        if (el.form === 'wt100') return mitNachgezogenerBezeichnung(aufBaubareLaenge(el, gezogen));
        // Ein Förderband nimmt seinen Verlauf mit: Sonst bliebe der Zug
        // stehen, während sein Kasten wächst – im Plan eine graue Fläche
        // statt der Rollen. Hier und nicht nur in `aendereElemente`, denn
        // gezogen wird über den Rahmen, und der geht diesen Weg.
        return mitNachgezogenerBezeichnung(
          mitSkaliertemVerlauf(gezogen, el, { breite: neu.breite, tiefe: neu.tiefe }),
        );
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
    if (ids.length > 0) set({ sonderauswahl: null, vorschau: null });
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
    set({ auswahl: [], sonderauswahl: null, vorschau: null });
  },

  schalteSpalte(seite) {
    set((s) =>
      seite === 'links'
        ? { linkeSpalteOffen: !s.linkeSpalteOffen }
        : { rechteSpalteOffen: !s.rechteSpalteOffen },
    );
  },

  setzeSpaltenbreite(seite, breite) {
    const begrenzt = Math.round(Math.min(SPALTE_MAX, Math.max(SPALTE_MIN, breite)));
    set((s) => ({ spaltenbreite: { ...s.spaltenbreite, [seite]: begrenzt } }));
  },

  setzeSpaltenstand(stand) {
    set((s) => ({
      linkeSpalteOffen: stand.linksOffen ?? s.linkeSpalteOffen,
      rechteSpalteOffen: stand.rechtsOffen ?? s.rechteSpalteOffen,
      spaltenbreite: {
        links: stand.links ?? s.spaltenbreite.links,
        rechts: stand.rechts ?? s.spaltenbreite.rechts,
      },
    }));
  },

  beginneUmrissZeichnen(vorlage) {
    set({
      zeichenvorlage: vorlage,
      werkzeug: 'elementZeichnen',
      vorschau: vorlage,
      auswahl: [],
      sonderauswahl: null,
    });
  },

  fuegeElementAusUmrissHinzu(vorlage, umriss) {
    if (umriss.length < 3) return null;
    const xs = umriss.map((p) => p.x);
    const ys = umriss.map((p) => p.y);
    const links = Math.min(...xs);
    const rechts = Math.max(...xs);
    const oben = Math.min(...ys);
    const unten = Math.max(...ys);
    const breite = rechts - links;
    const tiefe = unten - oben;
    if (breite < 1 || tiefe < 1) return null;

    // Das Polygon liegt am Element **relativ zu seiner Mitte** – so wie bei
    // jeder anderen Umrissvorlage auch. Sonst stünde das Möbel woanders als
    // seine Form.
    const mx = (links + rechts) / 2;
    const my = (oben + unten) / 2;
    const id = get().fuegeElementHinzu(
      {
        ...vorlage,
        form: 'umriss',
        breite,
        tiefe,
        polygon: umriss.map((p) => ({ x: p.x - mx, y: p.y - my })),
      },
      mx,
      my,
    );
    set({ zeichenvorlage: null, vorschau: null });
    return id;
  },

  zeigeVorlage(vorlage) {
    // Die Vorschau tritt an die Stelle der Auswahl: Das Eigenschaftenfenster
    // zeigt immer nur eines, und was man gerade nachschlägt, geht vor.
    set({ vorschau: vorlage, auswahl: [], sonderauswahl: null });
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
  const { projekt, vergangenheit, klammertiefe, klammerFrisch } = get();
  const naechstes = { ...wandeln(projekt), geaendertAm: Date.now() };

  // In einer angebrochenen Klammer nichts eintragen: Dort steht schon der
  // Stand von vor der ganzen Aktion, und der ist es, auf den Strg+Z führen
  // soll. Die **erste** Änderung in einer Klammer legt ihn an – vorher nicht,
  // sonst bekäme auch eine Runde ohne Änderung einen leeren Schritt.
  if (klammertiefe > 0 && !klammerFrisch) {
    set({ projekt: naechstes });
    return;
  }

  set({
    vergangenheit: [...vergangenheit, structuredClone(projekt)].slice(-HISTORIE_TIEFE),
    zukunft: [],
    projekt: naechstes,
    klammerFrisch: false,
  });
}
