import { KISTE } from '../../getraenkekisten';
import { quader, zylinder, type Bauteil, type Materialname } from '../bauteile';

/**
 * Ein Getränkekasten – gebaut, nicht angedeutet.
 *
 * **Warum das eigene Teile braucht.** Ein Kasten war bisher ein farbiger
 * Quader. Gestapelt ergab das eine glatte Wand, an der man weder sah, wo ein
 * Kasten aufhört und der nächste anfängt, noch dass darin Flaschen stehen.
 * Ein Getränkekasten ist aber ein sehr charakteristisches Ding, und drei
 * Kleinigkeiten machen ihn aus:
 *
 *  1. Der **umlaufende Rand oben**, ein Stück breiter als der Korpus. Er
 *     zieht zwischen zwei gestapelten Kästen eine sichtbare Linie – ohne ihn
 *     verschwimmt der Stapel zu einem Block.
 *  2. Die **Grifföffnungen** an den beiden Stirnseiten, dunkel und in der
 *     oberen Hälfte. Daran erkennt man einen Kasten, auch von weitem.
 *  3. Die **Flaschenhälse** obendrauf. Nur beim obersten Kasten eines
 *     Stapels: Bei allen darunter steckte die Ware im Boden des nächsten.
 *
 * **Zwölf Flaschen**, vier mal drei. Das ist der übliche Kasten für 0,7 und
 * 1,0 Liter und passt auf die 40 × 30 cm, mit denen `logik/getraenkekisten.ts`
 * rechnet. Ein 20er-Kasten hätte doppelt so viele Teile und sähe aus zwei
 * Metern Entfernung genauso aus.
 */

/** Wie hoch der Kasten wirklich baut – knapp unter dem Stapelmaß. */
const KORPUS_H = KISTE.hoehe - 1;
/** Der Rand steht rundum vor und trennt die Kästen im Stapel. */
const RAND_H = 3;
const RAND_UEBER = 0.5;
/** Die Grifföffnung: dunkel, in der oberen Hälfte der Stirnseite. */
const GRIFF_H = 5;
const GRIFF_ANTEIL = 0.45;

/** Der dunkle Flaschenboden unter den Hälsen. */
const FLASCHENFELD = 1.5;
const FLASCHE_R = 3.4;
const FLASCHE_H = 4.5;

/** Die Glasfarben, die im Kasten stehen – braun und grün, nicht bunt. */
const GLAS = ['#4a3520', '#2f4a28', '#4a3520', '#3b2f1c'];

/**
 * Die Farben, die es wirklich gibt.
 *
 * Getränkekästen sind rot, blau, grün oder gelb – kein Beige und kein Grau.
 * Die Farbe hängt an der Spalte, nicht am Zufall: So steht neben einem roten
 * Stapel ein blauer, und der Block bekommt den Rhythmus, den er im Markt auch
 * hat.
 */
const KASTENFARBEN = ['#b0281f', '#1f5697', '#2c7233', '#c39a12'];

/** Die Farbe des Kastens Nummer `nummer`. */
export function kastenfarbe(nummer: number): string {
  return KASTENFARBEN[((nummer % KASTENFARBEN.length) + KASTENFARBEN.length) % KASTENFARBEN.length];
}

/**
 * Ein Kasten an seiner hinteren linken unteren Ecke.
 *
 * `obenauf` sagt, ob er der oberste seines Stapels ist – nur dann bekommt er
 * Flaschen. `nummer` streut die Glasfarben, damit nicht jeder Kasten dasselbe
 * trägt.
 */
export function getraenkekasten(
  x: number,
  y: number,
  z: number,
  b: number,
  t: number,
  nummer: number,
  obenauf: boolean,
): Bauteil[] {
  if (b <= 0 || t <= 0) return [];
  const material: Materialname = 'kisteRot';
  const farbe = kastenfarbe(nummer);
  const teile: Bauteil[] = [quader(x, y, z, b, t, KORPUS_H, material, { farbe })];

  // Der Rand oben, rundum ein halbes Zentimeter vorstehend.
  teile.push(
    quader(
      x - RAND_UEBER,
      y - RAND_UEBER,
      z + KORPUS_H - RAND_H,
      b + 2 * RAND_UEBER,
      t + 2 * RAND_UEBER,
      RAND_H,
      material,
      { farbe },
    ),
  );

  // Die Grifföffnungen an den beiden Stirnseiten. Sie stehen minimal vor,
  // damit sie nicht mit der Korpusfläche um dieselbe Ebene streiten.
  const griffB = b * GRIFF_ANTEIL;
  const griffZ = z + KORPUS_H - RAND_H - GRIFF_H - 1.5;
  for (const yy of [y - 0.2, y + t - 0.4]) {
    teile.push(quader(x + (b - griffB) / 2, yy, griffZ, griffB, 0.6, GRIFF_H, 'schwarz'));
  }

  if (!obenauf) return teile;

  // Der dunkle Blick in den Kasten, und darauf die Flaschenhälse.
  const oben = z + KORPUS_H;
  teile.push(quader(x + 1.5, y + 1.5, oben - FLASCHENFELD, b - 3, t - 3, FLASCHENFELD, 'schwarz'));

  const spalten = Math.max(1, Math.round((b - 4) / 9));
  const reihen = Math.max(1, Math.round((t - 4) / 9));
  const dx = (b - 4) / spalten;
  const dy = (t - 4) / reihen;
  for (let i = 0; i < spalten; i++) {
    for (let k = 0; k < reihen; k++) {
      const glas = GLAS[(i + k + nummer) % GLAS.length];
      teile.push(
        zylinder(
          x + 2 + (i + 0.5) * dx,
          y + 2 + (k + 0.5) * dy,
          oben - 1,
          Math.min(FLASCHE_R, dx / 2 - 0.4, dy / 2 - 0.4),
          FLASCHE_H,
          'z',
          'ware',
          glas,
        ),
      );
    }
  }
  return teile;
}
