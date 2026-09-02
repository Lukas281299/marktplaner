import { KISTE } from './getraenkekisten';
import type { Unterbauart, Unterbauplatz } from '../typen/modell';

/**
 * Was unter den Böden eines Regalfelds steht.
 *
 * Oben ein, zwei Böden für die Sichtware, darunter der Nachschub – das ist
 * im Markt die Regel und nicht die Ausnahme. Angefangen hat es mit der
 * Palette; inzwischen steht dort genauso oft etwas anderes:
 *
 *  - **Paletten**, aus denen nachgefüllt wird
 *  - **Getränkekisten**, vor dem untersten Boden gestapelt
 *  - ein **Kühlmöbel**, das in die Regalzeile eingebaut ist – eine
 *    Kühlvitrine für Backwaren etwa, über der die Drahtböden weiterlaufen
 *
 * Für den Plan ist das dieselbe Frage: Was belegt den Platz unter den Böden,
 * wie breit ist es, und steht es in den Gang? Deshalb rechnet alles hier
 * über einen Kamm – nur die Maße und die Zeichnung unterscheiden sich.
 *
 * Die Maße sind Norm und keine Einstellung: Eine Europalette misst 1200 ×
 * 800 mm, ein Bierkasten 400 × 300. Wer eine andere Größe braucht, braucht
 * eine andere Art und keine andere Zahl. Nur das Kühlmöbel hat kein
 * Normmaß – dort trägt man es ein.
 */

/** Länge und Breite in Zentimetern, lange Seite zuerst. */
export const UNTERBAUTEN: Record<
  Unterbauart,
  { lang: number; kurz: number; name: string; frei?: boolean }
> = {
  euro: { lang: 120, kurz: 80, name: 'Europalette' },
  chep: { lang: 120, kurz: 100, name: 'CHEP' },
  halb: { lang: 80, kurz: 60, name: 'Halbe (Düsseldorfer)' },
  viertel: { lang: 60, kurz: 40, name: 'Viertel' },
  kiste: { lang: KISTE.laenge, kurz: KISTE.breite, name: 'Getränkekiste' },
  // Kühlmöbel gibt es in jeder Länge. 1250 × 800 ist die Größe, die in eine
  // Regalzeile passt, ohne die Gasse zu fressen – als Anfangswert taugt sie,
  // verstellt wird sie am Feld.
  kuehlmoebel: { lang: 125, kurz: 80, name: 'Kühlmöbel', frei: true },
};

/** Hat diese Art ein Normmaß, oder trägt man es selbst ein? */
export function freiesMass(art: Unterbauart): boolean {
  return Boolean(UNTERBAUTEN[art].frei);
}

/**
 * Wie der Unterbau im Feld liegt, in Zentimetern.
 *
 * `laengs` heißt: die lange Seite parallel zur Regalfront. So steht eine
 * Europalette 120 breit und ragt 80 tief ins Regal – das passt in ein Regal
 * mit 80 cm Korpustiefe. Quer wäre sie 80 breit und 120 tief und stünde
 * vorne über.
 *
 * Beim Kühlmöbel gilt, was am Feld steht: Es ist ein Gerät und kein
 * Ladungsträger, und man dreht es nicht, man wählt es.
 */
export function unterbaumass(platz: Unterbauplatz) {
  const p = UNTERBAUTEN[platz.art];
  if (p.frei) {
    return { breite: platz.breite ?? p.lang, tiefe: platz.tiefe ?? p.kurz };
  }
  const laengs = platz.laengs ?? true;
  return laengs ? { breite: p.lang, tiefe: p.kurz } : { breite: p.kurz, tiefe: p.lang };
}

/**
 * Wie viele nebeneinander in ein Feld passen.
 *
 * Ohne ausdrückliche Angabe so viele, wie hineingehen – mindestens aber
 * eines. Ein Feld, das für keine ganze Palette reicht, bekommt trotzdem eine
 * gezeichnet: Der Planer hat sie dort hingestellt, und im Plan zu sehen,
 * dass sie übersteht, ist nützlicher als sie wegzulassen.
 *
 * Ein Kühlmöbel steht immer einzeln. Zwei davon in einem Feld wären zwei
 * Geräte, und die stellt man als zwei Felder hin.
 */
export function unterbauAnzahl(platz: Unterbauplatz, feldbreite: number): number {
  if (freiesMass(platz.art)) return 1;
  if (platz.anzahl && platz.anzahl > 0) return platz.anzahl;
  const { breite } = unterbaumass(platz);
  return Math.max(1, Math.floor(feldbreite / breite));
}

/**
 * Steht der Unterbau tiefer als das Möbel – und wenn ja, wie weit?
 *
 * Nur ein Hinweis, keine Sperre: Eine Palette, die 20 cm übersteht, stellt
 * man im Markt trotzdem hin – man will es nur wissen. Beim Kühlmöbel ist es
 * sogar die Regel; die Vitrine steht vor der Zeile und nicht darin.
 */
export function stehtUeber(platz: Unterbauplatz, moebeltiefe: number): number {
  return Math.max(0, unterbaumass(platz).tiefe - moebeltiefe);
}
