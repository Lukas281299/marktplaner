import { GESTELL_HOEHE, GESTELL_STAERKE, KISTE, kistenseiten, seitentiefe } from '../../getraenkekisten';
import { quader, zylinder, type Bauteil } from '../bauteile';
import { getraenkekasten } from './kasten';
import type { PlanElement } from '../../../typen/modell';

/**
 * Getränke – das Preisgestell mit den Kästen davor.
 *
 * Das Gestell selbst ist nur ein Strich: zwei senkrechte Standrohre auf
 * Fußplatten und ein waagerechtes Rohr mit der Preisschiene, zusammen 6 cm
 * stark und 160 cm hoch. Es trägt **nichts** – die Kästen stehen davor auf
 * dem Boden und werden gestapelt, 40 × 30 cm je Kasten, gut 30 cm hoch, vier
 * bis fünf hoch. Genau so rechnet auch `logik/getraenkekisten.ts`, und genau
 * so wird es hier gebaut: Lage (längs oder quer) und Reihen kommen aus dem
 * Element.
 *
 * Die Gasse liegt bei diesem Möbel **oben** (y = 0) – anders als bei allen
 * anderen. Das ist im Grundriss so, und die Kisten folgen dem.
 */

/** Wie hoch die Kästen gestapelt werden. */
const STAPEL = 4;

function kistenSeite(
  element: PlanElement,
  seite: { lage: 'laengs' | 'quer'; reihen: number },
  yStart: number,
  richtung: 1 | -1,
  teile: Bauteil[],
) {
  const laengs = seite.lage === 'laengs';
  const kb = laengs ? KISTE.laenge : KISTE.breite;
  const kt = laengs ? KISTE.breite : KISTE.laenge;
  const anzahl = Math.floor(element.breite / kb);
  if (anzahl <= 0) return;
  const rand = (element.breite - anzahl * kb) / 2;

  for (let reihe = 0; reihe < seite.reihen; reihe++) {
    const y = richtung > 0 ? yStart + reihe * kt : yStart - (reihe + 1) * kt;
    for (let i = 0; i < anzahl; i++) {
      for (let stapel = 0; stapel < STAPEL; stapel++) {
        // Die Farbe wechselt je Spalte – Getränkekästen sind bunt.
        teile.push(
          ...getraenkekasten(
            rand + i * kb + 1,
            y + 1,
            stapel * KISTE.hoehe,
            kb - 2,
            kt - 2,
            i + reihe,
            stapel === STAPEL - 1,
          ),
        );
      }
    }
  }
}

export function getraenkeBauteile(element: PlanElement): Bauteil[] {
  const teile: Bauteil[] = [];
  const b = element.breite;
  const { vorne, hinten } = kistenseiten(element.kisten);

  // Das Gestell liegt zwischen den beiden Kistenblöcken. „Vorne" ist beim
  // Getränkegestell die Gasse und damit y = 0.
  const gestellVon = seitentiefe(vorne);
  const teileTiefe = GESTELL_STAERKE;

  // Zwei Standrohre und der Querholm mit der Preisschiene.
  teile.push(zylinder(3, gestellVon + teileTiefe / 2, 0, 2.5, GESTELL_HOEHE, 'z', 'hellgrau'));
  teile.push(zylinder(b - 3, gestellVon + teileTiefe / 2, 0, 2.5, GESTELL_HOEHE, 'z', 'hellgrau'));
  teile.push(zylinder(3, gestellVon + teileTiefe / 2, 0, 8, 1.5, 'z', 'hellgrau'));
  teile.push(zylinder(b - 3, gestellVon + teileTiefe / 2, 0, 8, 1.5, 'z', 'hellgrau'));
  teile.push(zylinder(0, gestellVon + teileTiefe / 2, GESTELL_HOEHE - 6, 2, b, 'x', 'hellgrau'));
  teile.push(quader(0, gestellVon + 1, GESTELL_HOEHE - 12, b, 1.5, 6, 'preisschiene'));

  // Die Kästen: zur Gasse hin (nach y = 0) und auf der Rückseite.
  kistenSeite(element, vorne, gestellVon, -1, teile);
  if (hinten) kistenSeite(element, hinten, gestellVon + teileTiefe, 1, teile);
  return teile;
}
