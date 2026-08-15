import type { Masslinie, Projekt, Punkt } from '../typen/modell';
import { eckpunkte } from './geometrie';

/**
 * Das Maßband.
 *
 * Ein Maß ist nur so gut wie sein Anfangspunkt. Wer die Gangbreite zwischen
 * zwei Regalzeilen misst, will die Zahl zwischen den **Regalkanten** haben und
 * nicht zwischen zwei Stellen, die zufällig ein paar Zentimeter daneben
 * liegen. Deshalb rastet das Maßband an Ecken und Mitten ein.
 */

/**
 * Alle Punkte, an denen das Maßband einrasten soll.
 *
 * Bewusst nicht jeder denkbare Punkt: Zu viele Fangpunkte machen das Messen
 * unberechenbar, weil man nie weiß, an welchem man gerade hängt.
 */
export function fangpunkte(projekt: Projekt): Punkt[] {
  const punkte: Punkt[] = [];

  // Ecken des Gebäudes
  punkte.push(...projekt.grundflaeche.umriss);
  // Ecken der Räume
  for (const raum of projekt.raeume) punkte.push(...raum.umriss);
  // Enden der Innenwände
  for (const wand of projekt.waende) punkte.push(wand.von, wand.bis);
  // Ecken und Mitten der Elemente
  for (const element of projekt.elemente) {
    punkte.push(...eckpunkte(element));
    punkte.push({ x: element.x, y: element.y });
  }

  return punkte;
}

/**
 * Zieht einen Punkt auf den nächsten Fangpunkt, wenn einer nah genug ist.
 * Sonst bleibt er, wo er ist.
 */
export function fangePunkt(p: Punkt, kandidaten: Punkt[], toleranz: number): Punkt {
  let bester: Punkt | undefined;
  let besterAbstand = toleranz;

  for (const k of kandidaten) {
    const abstand = Math.hypot(p.x - k.x, p.y - k.y);
    if (abstand <= besterAbstand) {
      besterAbstand = abstand;
      bester = k;
    }
  }

  return bester ? { ...bester } : p;
}

/** Die gemessene Länge in cm. */
export function masslaenge(mass: Pick<Masslinie, 'von' | 'bis'>): number {
  return Math.hypot(mass.bis.x - mass.von.x, mass.bis.y - mass.von.y);
}

/**
 * Die um den Versatz verschobene Maßlinie.
 *
 * Der Versatz rückt die Linie senkrecht zur Messrichtung aus dem Weg – sonst
 * läge sie mitten auf dem, was sie bemisst, und man könnte weder das eine
 * noch das andere lesen.
 */
export function versetzteLinie(mass: Masslinie): { von: Punkt; bis: Punkt } {
  const laenge = masslaenge(mass) || 1;
  const nx = -((mass.bis.y - mass.von.y) / laenge) * mass.versatz;
  const ny = ((mass.bis.x - mass.von.x) / laenge) * mass.versatz;
  return {
    von: { x: mass.von.x + nx, y: mass.von.y + ny },
    bis: { x: mass.bis.x + nx, y: mass.bis.y + ny },
  };
}

/**
 * Der Winkel, in dem die Maßzahl steht – nie auf dem Kopf.
 * Im Bauzeichnen liest man Maße von unten oder von rechts.
 */
export function massWinkel(mass: Pick<Masslinie, 'von' | 'bis'>): number {
  const grad = (Math.atan2(mass.bis.y - mass.von.y, mass.bis.x - mass.von.x) * 180) / Math.PI;
  if (grad > 90) return grad - 180;
  if (grad <= -90) return grad + 180;
  return grad;
}
