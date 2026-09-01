import type { Projekt, Punkt } from '../typen/modell';
import type { Hilfslinie } from './einrasten';
import { richteWandAus } from './waende';

/**
 * Wände aneinander einrasten lassen.
 *
 * Ein Grundriss besteht aus Wänden, die sich berühren: Die Trennwand des
 * Lagers stößt an die Außenwand, die Rückwand des Sozialraums fluchtet mit der
 * des Kühlraums. Von Hand trifft man das nie – zwischen 5,00 m und 5,03 m
 * sieht man am Bildschirm keinen Unterschied, im Plan wird daraus eine Fuge,
 * die beim Ausdrucken auffällt und beim Rechnen der Fläche fehlt.
 *
 * Deshalb rasten Wände an drei Dingen ein, in dieser Reihenfolge:
 *
 *  1. **Ecke auf Ecke** – ein Wandende trifft ein anderes Wandende oder eine
 *     Gebäudeecke. Beide Achsen auf einmal, das schließt die Ecke wirklich.
 *  2. **Flucht** – die Wand richtet sich an einer parallelen aus, ohne sie zu
 *     berühren. Nur eine Achse.
 *  3. **Stoß** – ein Wandende landet auf der Achse einer kreuzenden Wand.
 *     Ebenfalls nur eine Achse, ergibt sich aus denselben Punkten.
 *
 * Was nicht mitmacht: Regale und Möbel. Wer eine Wand an ein Regal einrastet,
 * hat den Plan verkehrt herum gebaut – erst steht das Haus, dann die Ware.
 */

/** Wie weit ein Fang danebengreifen darf, bezogen auf Bildschirmpixel. */
export const FANGWEITE_PIXEL = 10;

/**
 * Alle Ecken des Grundrisses, an denen eine Wand einrasten darf.
 *
 * `ausserWandId` lässt die gezogene Wand selbst aus – sonst rastete sie an
 * ihren eigenen Enden ein und ließe sich nicht mehr bewegen.
 */
export function grundrissEcken(projekt: Projekt, ausserWandId?: string): Punkt[] {
  const punkte: Punkt[] = [...projekt.grundflaeche.umriss];
  for (const raum of projekt.raeume) punkte.push(...raum.umriss);
  for (const wand of projekt.waende) {
    if (wand.id === ausserWandId) continue;
    punkte.push(wand.von, wand.bis);
  }
  return punkte;
}

/** Was beim Einrasten herauskam. */
export interface Wandfang {
  /** Der berichtigte Versatz in cm. */
  dx: number;
  dy: number;
  /** Ob in dieser Achse eingerastet wurde – sonst darf das Raster ran. */
  gefangenX: boolean;
  gefangenY: boolean;
  hilfslinien: Hilfslinie[];
}

/** Die kleinste Korrektur, die einen der Werte auf ein Ziel schiebt. */
function naechsteKorrektur(
  achse: 'x' | 'y',
  enden: Punkt[],
  ziele: Punkt[],
  toleranz: number,
): { korrektur: number; ziel: Punkt } | null {
  let beste: { korrektur: number; ziel: Punkt } | null = null;
  for (const ende of enden) {
    for (const ziel of ziele) {
      const korrektur = ziel[achse] - ende[achse];
      if (Math.abs(korrektur) > toleranz) continue;
      if (!beste || Math.abs(korrektur) < Math.abs(beste.korrektur)) beste = { korrektur, ziel };
    }
  }
  return beste;
}

/** Eine Hilfslinie, die vom Fangziel bis zur eingerasteten Wand reicht. */
function hilfslinie(
  richtung: Hilfslinie['richtung'],
  position: number,
  laengs: number[],
): Hilfslinie {
  return {
    richtung,
    position,
    von: Math.min(...laengs),
    bis: Math.max(...laengs),
  };
}

/**
 * Rastet eine verschobene Wand an den Grundriss ein.
 *
 * Übergeben wird der rohe Versatz aus der Mausbewegung; zurück kommt der
 * berichtigte. Was in einer Achse nicht einrastet, meldet die Funktion als
 * `gefangenX`/`gefangenY` gleich `false` – dann bleibt das Raster zuständig.
 */
export function fangeWand(
  wand: { von: Punkt; bis: Punkt },
  versatz: { dx: number; dy: number },
  ecken: Punkt[],
  toleranz: number,
): Wandfang {
  const enden: Punkt[] = [
    { x: wand.von.x + versatz.dx, y: wand.von.y + versatz.dy },
    { x: wand.bis.x + versatz.dx, y: wand.bis.y + versatz.dy },
  ];

  // 1. Ecke auf Ecke – der stärkste Fang, weil er die Ecke wirklich schließt.
  let ecke: { dx: number; dy: number; ziel: Punkt; weite: number } | null = null;
  for (const ende of enden) {
    for (const ziel of ecken) {
      const dx = ziel.x - ende.x;
      const dy = ziel.y - ende.y;
      if (Math.abs(dx) > toleranz || Math.abs(dy) > toleranz) continue;
      const weite = Math.hypot(dx, dy);
      if (!ecke || weite < ecke.weite) ecke = { dx, dy, ziel, weite };
    }
  }

  if (ecke) {
    const ziel = ecke.ziel;
    return {
      dx: versatz.dx + ecke.dx,
      dy: versatz.dy + ecke.dy,
      gefangenX: true,
      gefangenY: true,
      // Ein Kreuz auf der getroffenen Ecke: So sieht man, woran es hängt.
      hilfslinien: [
        hilfslinie('senkrecht', ziel.x, [ziel.y, enden[0].y + ecke.dy, enden[1].y + ecke.dy]),
        hilfslinie('waagerecht', ziel.y, [ziel.x, enden[0].x + ecke.dx, enden[1].x + ecke.dx]),
      ],
    };
  }

  // 2. Sonst jede Achse für sich – Flucht und Stoß.
  const x = naechsteKorrektur('x', enden, ecken, toleranz);
  const y = naechsteKorrektur('y', enden, ecken, toleranz);
  const dx = versatz.dx + (x?.korrektur ?? 0);
  const dy = versatz.dy + (y?.korrektur ?? 0);

  const hilfslinien: Hilfslinie[] = [];
  if (x) {
    hilfslinien.push(
      hilfslinie('senkrecht', x.ziel.x, [x.ziel.y, enden[0].y + dy, enden[1].y + dy]),
    );
  }
  if (y) {
    hilfslinien.push(
      hilfslinie('waagerecht', y.ziel.y, [y.ziel.x, enden[0].x + dx, enden[1].x + dx]),
    );
  }

  return { dx, dy, gefangenX: x !== null, gefangenY: y !== null, hilfslinien };
}

/**
 * Zieht einen einzelnen Punkt auf die nächste Grundrissecke.
 *
 * Das ist der Fang beim **Zeichnen**: Wer eine neue Wand an einer vorhandenen
 * beginnen lässt, trifft deren Ende auf den Zentimeter, statt es später
 * nachzumessen.
 */
export function fangeAufEcke(p: Punkt, ecken: Punkt[], toleranz: number): Punkt {
  let bester: Punkt | null = null;
  let besteWeite = toleranz;
  for (const ecke of ecken) {
    const weite = Math.hypot(p.x - ecke.x, p.y - ecke.y);
    if (weite <= besteWeite) {
      besteWeite = weite;
      bester = ecke;
    }
  }
  return bester ? { x: bester.x, y: bester.y } : p;
}

/**
 * Anfang und Ende einer **neuen** Wand einrasten.
 *
 * Hier stehen sich zwei Wünsche im Weg: Die Wand soll senkrecht bleiben, und
 * sie soll die Ecke treffen, auf die man zielt. Beides zugleich geht nur,
 * wenn die ganze Wand quer mitwandert – sonst kippt sie um die paar
 * Zentimeter, die zwischen Zeigefinger und Ecke lagen.
 *
 * Wer zuerst da war, gewinnt: Hängt schon der **Anfang** an einer Ecke, bleibt
 * er dort und das Ende richtet sich nach ihm. Sonst darf das Ende ziehen und
 * nimmt den Anfang quer mit.
 */
export function fangeNeueWand(
  von: Punkt,
  bis: Punkt,
  ecken: Punkt[],
  toleranz: number,
): { von: Punkt; bis: Punkt } {
  const anfang = fangeAufEcke(von, ecken, toleranz);
  const gerade = richteWandAus(anfang, bis);

  // Der Anfang hat gefangen – dann ist die Sache entschieden.
  if (anfang !== von) return { von: anfang, bis: gerade };

  const ziel = fangeAufEcke(gerade, ecken, toleranz);
  if (ziel === gerade) return { von: anfang, bis: gerade };

  const senkrecht = Math.abs(gerade.y - anfang.y) >= Math.abs(gerade.x - anfang.x);
  return senkrecht
    ? { von: { x: ziel.x, y: anfang.y }, bis: ziel }
    : { von: { x: anfang.x, y: ziel.y }, bis: ziel };
}
