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
}

/** Ein Raum bzw. Bereich innerhalb des Marktes (ab Phase 2 im Einsatz). */
export interface Raum {
  id: string;
  name: string;
  /** Linke obere Ecke in cm. */
  x: number;
  y: number;
  breite: number;
  laenge: number;
  wandstaerke: number;
  farbe: string;
  beschriftungSichtbar: boolean;
}

/** Die Außenmaße des Gebäudes. */
export interface Grundflaeche {
  /** Außenmaß in X-Richtung, in cm. */
  breite: number;
  /** Außenmaß in Y-Richtung, in cm. */
  laenge: number;
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
  elemente: PlanElement[];
}

/** Aktuelle Schemaversion. Bei Änderungen am Modell hochzählen. */
export const SCHEMA_VERSION = 1;
