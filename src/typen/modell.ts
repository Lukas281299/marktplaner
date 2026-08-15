/**
 * Das Datenmodell des Marktplaners.
 *
 * WICHTIG – die interne Maßeinheit:
 * Intern wird ALLES in Zentimetern gerechnet und gespeichert. Ob dir Meter oder
 * Zentimeter angezeigt werden, ist reine Anzeigesache (siehe `anzeigeEinheit`).
 * Das vermeidet Rundungsfehler und passt zur Praxis im Ladenbau
 * (ein Regalfeld ist z. B. 125 cm breit).
 *
 * Positionen (`x`, `y`) beziehen sich immer auf den MITTELPUNKT eines Elements.
 * Gedreht wird ebenfalls um den Mittelpunkt – so bleibt ein Regal beim Drehen
 * an seinem Platz und wandert nicht weg.
 */

/** In welcher Einheit werden Zahlen angezeigt? Gespeichert wird immer in cm. */
export type Massinheit = 'm' | 'cm';

/** Ein Punkt auf dem Plan, in cm ab der linken oberen Ecke. */
export interface Punkt {
  x: number;
  y: number;
}

/** Oberkategorien der Elementbibliothek. */
export type KategorieId =
  | 'regale'
  | 'kuehlung'
  | 'frische'
  | 'kassen'
  | 'aktion'
  | 'ausstattung'
  | 'eigene';

/** Grundformen, aus denen ein Element gezeichnet werden kann. */
export type Grundform =
  | 'rechteck'
  | 'abgerundet'
  | 'kreis'
  | 'halbkreis'
  | 'linie'
  | 'pfeil';

/** Ein Eintrag in der Elementbibliothek (die "Vorlage" links im Fenster). */
export interface BibliothekEintrag {
  /** Eindeutige Kennung der Vorlage, z. B. "regal-trocken". */
  id: string;
  name: string;
  kategorie: KategorieId;
  /** Standardbreite in cm (Ausdehnung in X-Richtung, ungedreht). */
  breite: number;
  /** Standardtiefe in cm (Ausdehnung in Y-Richtung, ungedreht). */
  tiefe: number;
  /** Höhe in cm – nur eine Zusatzinformation, wird im Grundriss nicht gezeichnet. */
  hoehe?: number;
  form: Grundform;
  /** Füllfarbe als Hex-Wert, z. B. "#d8cfc0". */
  farbe: string;
  /** Text, der standardmäßig im Element steht. Leer = Name verwenden. */
  standardBeschriftung?: string;
  /** Kurzer Hinweis für den Mauszeiger-Tooltip. */
  hinweis?: string;
  /** Selbst angelegte Vorlage (nicht mitgeliefert). */
  eigene?: boolean;
}

/** Eine Ebene, z. B. "Regale" oder "Beschriftungen". */
export interface Ebene {
  id: string;
  name: string;
  sichtbar: boolean;
  gesperrt: boolean;
}

/** Ein tatsächlich auf dem Plan platziertes Element. */
export interface PlanElement {
  id: string;
  /** Aus welcher Bibliotheksvorlage stammt das Element? */
  vorlageId: string;
  /** Auf welcher Ebene liegt es? */
  ebeneId: string;
  name: string;
  kategorie: KategorieId;
  /** Mittelpunkt in cm, gemessen ab der linken oberen Ecke der Grundfläche. */
  x: number;
  y: number;
  breite: number;
  tiefe: number;
  /** Nur Information (Möbelhöhe), beeinflusst die Zeichnung nicht. */
  hoehe?: number;
  /** Drehwinkel in Grad, im Uhrzeigersinn, um den Mittelpunkt. */
  drehung: number;
  form: Grundform;
  farbe: string;
  beschriftung: string;
  beschriftungSichtbar: boolean;
  /** Schriftgröße der Beschriftung in Bildschirmpunkten. */
  schriftgroesse: number;
  /** Optionale Zusatzangaben. */
  hersteller?: string;
  warengruppe?: string;
  notiz?: string;
  /** Gesperrte Elemente lassen sich nicht mehr aus Versehen verschieben. */
  gesperrt: boolean;
  /** Zeichenreihenfolge: größere Zahl liegt weiter oben. */
  reihenfolge: number;
  /**
   * Zu welcher Gruppe gehört das Element? Leer = zu keiner.
   *
   * Ein Klick wählt die ganze Gruppe aus, Alt-Klick nur dieses eine Regal.
   */
  gruppeId?: string;
  /**
   * Wird das Regal von beiden Seiten bestückt (Gondel)?
   *
   * Zählt bei den Regalmetern doppelt. Steht am Element und nicht an der
   * Gruppe: Eine Wanzl-Gondel ist **ein** Möbel mit zwei Seiten, während zwei
   * Rücken an Rücken gestellte Wandregale zwei Möbel sind, die schon von
   * selbst zweimal gezählt werden.
   */
  beidseitig?: boolean;
}

/** Wozu mehrere Elemente zusammengefasst sind. */
export type Gruppenart = 'zug' | 'gondel' | 'frei';

/**
 * Eine Gruppe zusammengehörender Elemente.
 *
 * Sie hält nur zusammen, was gemeinsam bewegt werden soll – sie verändert die
 * Elemente nicht. Deshalb steht in ihr auch keine Geometrie: Wo die Regale
 * stehen, wissen die Regale selbst.
 */
export interface Gruppe {
  id: string;
  name: string;
  art: Gruppenart;
}

/**
 * Eine dauerhaft eingezeichnete Maßlinie.
 *
 * Anders als die Abstände, die beim Verschieben kurz aufblitzen, bleibt sie
 * stehen – für alles, was im Plan dokumentiert sein muss: Gangbreiten,
 * Fluchtwege, Abstand zur Wand.
 */
export interface Masslinie {
  id: string;
  von: Punkt;
  bis: Punkt;
  /**
   * Eigener Text statt des gemessenen Maßes. Leer = das Maß anzeigen.
   * Gedacht für Fälle wie „min. 1,20 m" – eine Vorgabe statt eines Istwertes.
   */
  text: string;
  /** Abstand der Maßlinie von der gemessenen Strecke, in cm. */
  versatz: number;
  gesperrt: boolean;
}

/**
 * Wozu ein Raum dient.
 *
 * Die Art entscheidet nicht nur über die Farbe, sondern auch darüber, ob der
 * Raum in der Auswertung zur Verkaufsfläche zählt. Im Ladenbau ist das die
 * Trennlinie, auf die es ankommt: Ein Kühlhaus ist Nebenfläche, auch wenn es
 * mitten im Gebäude liegt.
 */
export type Raumart = 'verkauf' | 'lager' | 'kuehlung' | 'sozial' | 'technik' | 'sonstige';

/** Ein Raum bzw. abgetrennter Bereich innerhalb des Marktes. */
export interface Raum {
  id: string;
  name: string;
  /** Umriss als Polygon in cm. Mindestens drei Punkte. */
  umriss: Punkt[];
  art: Raumart;
  /** Stärke der Trennwände in cm. 0 = nur eine farbige Fläche ohne Wand. */
  wandstaerke: number;
  farbe: string;
  beschriftungSichtbar: boolean;
  /** Gesperrte Räume lassen sich nicht aus Versehen verschieben. */
  gesperrt: boolean;
}

/** Wozu eine Innenwand dient – bestimmt nur die Darstellung. */
export type Wandart = 'tragend' | 'trennwand' | 'leicht';

/**
 * Eine einzelne Innenwand.
 *
 * Anders als bei Raum und Gebäude ist `von`/`bis` hier die **Achse** der Wand,
 * nicht ihre Außenkante: Eine freistehende Wand hat keine Innen- und
 * Außenseite, sie steht in der Mitte auf ihrer Linie. Beim Bemaßen ist das
 * auch die Linie, die man im Ladenbau angibt.
 */
export interface Wand {
  id: string;
  von: Punkt;
  bis: Punkt;
  staerke: number;
  art: Wandart;
  gesperrt: boolean;
}

/** Welche Art von Durchbruch in einer Wand sitzt. */
export type Oeffnungsart =
  | 'tuer'
  | 'doppeltuer'
  | 'schiebetuer'
  | 'durchgang'
  | 'rolltor'
  | 'fenster';

/**
 * Eine Öffnung in einer Wand: Tür, Durchgang, Rolltor.
 *
 * Sie hängt bewusst **nicht** an einer bestimmten Wand, sondern liegt frei auf
 * dem Plan und unterbricht optisch, was unter ihr liegt. Der Grund ist
 * praktisch: Eine Tür sitzt oft genau dort, wo eine Raumwand auf die Außenwand
 * trifft. Müsste sie sich für eine der beiden entscheiden, ginge sie beim
 * Verschieben der anderen kaputt.
 *
 * Beim Setzen wird sie trotzdem automatisch an der Wand darunter ausgerichtet –
 * siehe `logik/waende.ts`.
 */
export interface Oeffnung {
  id: string;
  art: Oeffnungsart;
  /** Mittelpunkt der Öffnung in cm. */
  x: number;
  y: number;
  /** Lichte Breite in cm. */
  breite: number;
  /** Stärke der Wand, die durchbrochen wird. */
  tiefe: number;
  /** Drehung in Grad. 0 = die Wand verläuft waagerecht. */
  drehung: number;
  /** Anschlagseite: Auf welche Seite schlägt die Tür auf? */
  gespiegelt: boolean;
  beschriftung: string;
  gesperrt: boolean;
}

/**
 * Die Grundfläche des Gebäudes.
 *
 * Der Umriss ist ein Polygon, kein Rechteck: Ein Markt ist selten ein
 * sauberer Kasten – es kommen Anbauten dazu, Ecken werden ausgespart, und
 * gelegentlich ist die Fläche schlicht schief. Ein Rechteck ist davon nur der
 * einfachste Fall.
 *
 * Der Umriss hat kein Loch. Wäre mitten in der Fläche etwas ausgespart, wäre
 * das in der Praxis ein Raum (Technikzentrale, Innenhof) – und dafür gibt es
 * `Raum`.
 */
export interface Grundflaeche {
  /** Die Eckpunkte im Uhrzeigersinn, in cm. */
  umriss: Punkt[];
  /** Stärke der Außenwand in cm. */
  wandstaerke: number;
}

/** Einstellungen, die das Zeichnen und die Anzeige betreffen. */
export interface Einstellungen {
  anzeigeEinheit: Massinheit;
  rasterSichtbar: boolean;
  /** Abstand der Rasterlinien in cm. */
  rasterWeite: number;
  amRasterEinrasten: boolean;
  /** Automatische Hilfslinien und Einrasten an anderen Elementen. */
  hilfslinienAktiv: boolean;
  /** Abstandsmaße beim Verschieben anzeigen. */
  masseAnzeigen: boolean;
}

/** Ein komplettes Marktprojekt – das ist genau das, was gespeichert wird. */
export interface Projekt {
  id: string;
  name: string;
  /** Schemaversion, damit spätere Versionen alte Dateien umwandeln können. */
  version: number;
  erstelltAm: number;
  geaendertAm: number;
  grundflaeche: Grundflaeche;
  einstellungen: Einstellungen;
  ebenen: Ebene[];
  raeume: Raum[];
  /** Freistehende Innenwände, die keinen ganzen Raum abtrennen. */
  waende: Wand[];
  /** Türen, Durchgänge und Tore. */
  oeffnungen: Oeffnung[];
  elemente: PlanElement[];
  /** Zusammengefasste Regale – Züge und Gondeln. */
  gruppen: Gruppe[];
  /** Dauerhaft eingezeichnete Maße. */
  masslinien: Masslinie[];
}

/**
 * Aktuelle Schemaversion. Bei Änderungen am Modell hochzählen – und in
 * `speicher/wandlung.ts` einen Schritt ergänzen, der ältere Planungen
 * nachzieht.
 *
 *   1 – erste Fassung, Grundfläche als Rechteck (Breite × Länge)
 *   2 – Grundfläche und Räume als Polygon, Räume mit Art
 *   3 – einzelne Innenwände und Öffnungen (Türen, Durchgänge)
 *   4 – Gruppen, beidseitige Regale, dauerhafte Maßlinien
 */
export const SCHEMA_VERSION = 4;
