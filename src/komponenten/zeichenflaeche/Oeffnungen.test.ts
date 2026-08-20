import { describe, expect, it } from 'vitest';

/**
 * Prüfung für den Aufschlagbogen einer Tür.
 *
 * Der Bogen wird mit `ctx.arc` gezeichnet, und dort entscheidet ein einziges
 * Wahrheitswert-Argument über die Umlaufrichtung. Steht es falsch, nimmt der
 * Bogen den langen Weg um den Kreis: Die Tür schwenkt dann 270 Grad statt 90,
 * und im Plan sieht es aus, als brauche jede Tür den halben Gang.
 *
 * Genau das war der Fall – in allen vier Anschlagvarianten. Der Fehler fällt
 * beim Zeichnen nicht auf, weil ein 270-Grad-Bogen genauso rund aussieht.
 * Deshalb wird hier die überstrichene Gradzahl nachgerechnet.
 */

/** Dieselbe Rechnung wie in `Tuerblatt`. */
function ueberstrichenerWinkel(seite: number, gespiegeltX: boolean): number {
  const vonWinkel = seite > 0 ? Math.PI / 2 : -Math.PI / 2;
  const bisWinkel = gespiegeltX ? Math.PI : 0;
  const gegenUhrzeiger = (seite > 0) !== gespiegeltX;

  let spanne = gegenUhrzeiger ? vonWinkel - bisWinkel : bisWinkel - vonWinkel;
  spanne = ((spanne % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.round((spanne * 180) / Math.PI);
}

describe('Aufschlagbogen einer Tür', () => {
  it('schwenkt in allen vier Anschlagvarianten genau 90 Grad', () => {
    for (const seite of [1, -1]) {
      for (const gespiegeltX of [false, true]) {
        expect(ueberstrichenerWinkel(seite, gespiegeltX)).toBe(90);
      }
    }
  });
});
