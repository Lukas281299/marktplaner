import type { Regalfeld } from '../typen/modell';

/**
 * Die Warengruppen-Beschriftung unter einem Regalzug.
 *
 * Auf einem Ladenbauplan steht unter dem Zug, was dort verkauft wird –
 * „Mayonnaise", „Senf", „Ketchup". Diese Beschriftung gehört nicht zu einem
 * einzelnen Feld, sondern zu einer Strecke: Ketchup bekommt drei laufende
 * Meter, und dann steht es einmal da und nicht dreimal.
 *
 * Deshalb hängt sie am **ersten** Feld ihrer Strecke und weiß, über wie viele
 * Felder sie reicht. Die folgenden Felder bleiben leer – sie gehören dazu.
 *
 * Nicht zu verwechseln mit der Warengruppe am Element (`PlanElement.
 * warengruppe`): Die ist eine grobe Einordnung fürs Rechnen – Regalmeter je
 * Warengruppe –, diese hier ist Beschriftung im Bild.
 */

/**
 * Eine Beschriftung mit den Feldern, über die sie reicht.
 *
 * `von` und `bis` sind Feldnummern und beide einschließlich: Eine Strecke aus
 * einem einzigen Feld hat `von === bis`.
 */
export interface Gruppenspanne {
  von: number;
  bis: number;
  text: string;
}

/**
 * Die Beschriftungen einer Seite, jede mit ihrer Strecke.
 *
 * Eine Strecke endet spätestens dort, wo die nächste anfängt. Sonst stünden
 * zwei Beschriftungen übereinander, und man müsste raten, welche gilt –
 * schlimmer als eine zu kurze Strecke, denn die sieht man.
 *
 * Genauso endet sie am letzten Feld: Eine Angabe von fünf Feldern an einem
 * Zug mit dreien ist kein Fehler, den man dem Nutzer vorhalten müsste. Er hat
 * den Zug hinterher gekürzt.
 */
export function gruppenspannen(felder: Regalfeld[]): Gruppenspanne[] {
  const naechste = (ab: number) => {
    for (let i = ab; i < felder.length; i++) {
      if (felder[i].warengruppe?.text.trim()) return i;
    }
    return felder.length;
  };

  const spannen: Gruppenspanne[] = [];
  for (let i = 0; i < felder.length; i++) {
    const gruppe = felder[i].warengruppe;
    const text = gruppe?.text.trim();
    if (!text) continue;

    const gewuenscht = i + Math.max(1, Math.round(gruppe?.felder ?? 1)) - 1;
    const grenze = Math.min(felder.length - 1, naechste(i + 1) - 1);
    spannen.push({ von: i, bis: Math.min(gewuenscht, grenze), text });
  }
  return spannen;
}

/**
 * Bricht eine Beschriftung auf die Breite ihrer Strecke um.
 *
 * Umbrüche von Hand gelten unverändert – wer selbst trennt, weiß besser, wo.
 * Was danach immer noch zu breit ist, wird an den Wortgrenzen weiter geteilt.
 *
 * Ein einzelnes zu langes Wort bleibt stehen und steht über. Getrennt würde
 * es unleserlich, und ein abgeschnittenes Wort wäre eine falsche Angabe: Aus
 * „Grillsoßen" würde „Grillso".
 *
 * `messen` kommt von außen, weil die Breite eines Textes nur die Leinwand
 * kennt – und die gibt es beim Prüfen nicht.
 */
export function gruppenZeilen(
  text: string,
  breite: number,
  messen: (text: string) => number,
): string[] {
  const zeilen: string[] = [];

  for (const absatz of text.split('\n')) {
    const worte = absatz.trim().split(/\s+/).filter(Boolean);
    if (worte.length === 0) {
      // Eine Leerzeile von Hand ist ein gewollter Abstand.
      if (zeilen.length > 0) zeilen.push('');
      continue;
    }

    let zeile = worte[0];
    for (const wort of worte.slice(1)) {
      const versuch = `${zeile} ${wort}`;
      if (breite > 0 && messen(versuch) > breite) {
        zeilen.push(zeile);
        zeile = wort;
      } else {
        zeile = versuch;
      }
    }
    zeilen.push(zeile);
  }

  // Ein leerer Text ergibt keine Zeile, nicht eine leere.
  while (zeilen.length > 0 && zeilen[zeilen.length - 1] === '') zeilen.pop();
  return zeilen;
}
