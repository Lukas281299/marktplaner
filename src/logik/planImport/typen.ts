import type { Punkt } from '../../typen/modell';

/**
 * Was aus einem Plan-PDF herausgelesen wird, bevor irgendetwas gedeutet wird.
 *
 * Diese Typen stehen bewusst zwischen dem PDF und der Erkennung: Alles
 * darunter (`pdfLesen.ts`) kennt pdf.js, alles darüber kennt nur noch diese
 * Formen. Dadurch lässt sich die ganze Erkennung mit ausgedachten Daten
 * prüfen, ohne je ein PDF zu öffnen.
 *
 * Alle Koordinaten sind PDF-Punkte, so wie sie im Dokument stehen: Ursprung
 * links oben, y nach unten. Umgerechnet wird erst ganz am Schluss, wenn der
 * Maßstab feststeht.
 */

/** Eine Farbe als drei Anteile von 0 bis 1. */
export type Farbe = [number, number, number];

/** Ein Textstück auf dem Plan. */
export interface PlanText {
  text: string;
  /** Mittelpunkt in PDF-Punkten. */
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

/** Ein gezeichneter Linienzug. */
export interface PlanPfad {
  punkte: Punkt[];
  geschlossen: boolean;
  fuellung?: Farbe;
  strich?: Farbe;
}

/** Was eine Seite eines Plan-PDFs hergibt. */
export interface PlanSeite {
  /** Blattbreite und -höhe in Millimetern. */
  blattBreiteMm: number;
  blattHoeheMm: number;
  /** Blattmaße in PDF-Punkten – für das Umrechnen der Koordinaten. */
  breitePt: number;
  hoehePt: number;
  texte: PlanText[];
  pfade: PlanPfad[];
}

/**
 * Womit man es zu tun hat.
 *
 * `vektor` – aus einem CAD-Programm erzeugt, mit Text- und Pfaddaten. Daraus
 * lässt sich der Plan wirklich auslesen.
 * `bild` – eingescannt oder als Bild exportiert. Da geht nur der Hintergrund.
 */
export type Planart = 'vektor' | 'bild';

/** Wie sicher ein Ergebnis ist – das steht so auch in der Prüfliste. */
export type Sicherheit = 'sicher' | 'wahrscheinlich' | 'geraten';
