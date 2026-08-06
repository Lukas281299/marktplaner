import type { Massinheit } from '../typen/modell';

/**
 * Umrechnung und Anzeige von Maßen.
 * Intern rechnet der Marktplaner immer in Zentimetern. Diese Funktionen
 * übersetzen zwischen "intern" (cm) und "was der Nutzer sieht" (m oder cm).
 */

/** Wandelt einen internen cm-Wert in die Anzeigeeinheit um. */
export function cmInAnzeige(cm: number, einheit: Massinheit): number {
  return einheit === 'm' ? cm / 100 : cm;
}

/** Wandelt einen vom Nutzer eingegebenen Wert zurück in Zentimeter. */
export function anzeigeInCm(wert: number, einheit: Massinheit): number {
  return einheit === 'm' ? wert * 100 : wert;
}

/** Formatiert eine Länge für die Anzeige, z. B. "12,50 m" oder "125 cm". */
export function formatiereLaenge(cm: number, einheit: Massinheit): string {
  if (einheit === 'm') {
    return `${(cm / 100).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} m`;
  }
  return `${Math.round(cm).toLocaleString('de-DE')} cm`;
}

/** Formatiert eine Fläche. Quadratmeter sind hier immer die sinnvollste Einheit. */
export function formatiereFlaeche(quadratZentimeter: number): string {
  const qm = quadratZentimeter / 10_000;
  return `${qm.toLocaleString('de-DE', {
    minimumFractionDigits: qm < 10 ? 2 : 1,
    maximumFractionDigits: qm < 10 ? 2 : 1,
  })} m²`;
}

/**
 * Wie viele Nachkommastellen sind in Eingabefeldern sinnvoll?
 * In Metern zwei (Zentimetergenauigkeit), in Zentimetern keine.
 */
export function schrittweite(einheit: Massinheit): number {
  return einheit === 'm' ? 0.01 : 1;
}

/**
 * Der Maßstab der Bildschirmdarstellung, z. B. "1:100".
 * `zoom` ist die Zahl der Bildschirmpunkte pro Zentimeter Planmaß.
 * Ein CSS-Zentimeter entspricht 96/2,54 ≈ 37,8 Bildschirmpunkten.
 */
export function berechneMassstab(zoom: number): string {
  const punkteProZentimeter = 96 / 2.54;
  const nenner = punkteProZentimeter / zoom;
  if (!isFinite(nenner) || nenner <= 0) return '–';
  return `1:${Math.round(nenner)}`;
}
