/**
 * Getränkekisten vor einem Preisgestell.
 *
 * Die Getränkeabteilung besteht nicht aus Regalen. Sie besteht aus schmalen
 * **Gestellen**, die nur die Preisschilder tragen – und aus Kisten, die
 * beidseitig davorgestapelt werden. Das Gestell selbst nimmt kaum Platz weg;
 * den Platz brauchen die Kisten.
 *
 * Deshalb rechnet der Plan hier andersherum als beim Regal: Nicht das Möbel
 * gibt seine Tiefe vor, sondern die Kisten geben sie ihm. Wer eine Reihe
 * anhängt, macht die Gasse schmaler – und genau das will man beim Planen
 * sehen, bevor der Stapler nicht mehr durchkommt.
 */

/**
 * Das Grundmaß einer Getränkekiste, in Zentimetern.
 *
 * **Eine Größe für alles.** Es gibt genormte Kästen in mehreren Maßen –
 * 35,5 × 27 beim Mineralwasser, 40 × 27 beim Longneck –, aber im Plan zählt
 * der Stellplatz, und der wird nach dem verbreitetsten Kasten gerechnet:
 * 400 × 300 mm, dem Bierkasten mit 20 × 0,5 l. Wer mit einem Maß plant, das
 * für den halben Markt gilt, plant genauer als einer, der pro Gestell ein
 * anderes einstellt und am Ende nicht mehr weiß, welches wo galt.
 */
export const KISTE = {
  /** Die lange Seite. */
  laenge: 40,
  /** Die kurze Seite. */
  breite: 30,
  /** Höhe eines Kastens, gestapelt gerechnet. */
  hoehe: 30,
} as const;

/**
 * Wie die Kisten vor dem Gestell stehen.
 *
 * `laengs` heißt: Die **lange** Seite der Kiste liegt parallel zum Gestell.
 * So passen weniger nebeneinander, dafür ragt die Reihe weniger in die Gasse.
 * `quer` ist das Gegenteil – mehr Kisten auf derselben Länge, dafür tiefer.
 *
 * Das ist die Entscheidung, um die es beim Einräumen geht, und deshalb steht
 * sie am Möbel und nicht in einer Voreinstellung.
 */
export type Kistenlage = 'laengs' | 'quer';

/** Was ein Gestell mit seinen Kisten belegt. */
export interface Kistenbelegung {
  /** Wie viele Kisten nebeneinander passen, je Reihe. */
  jeReihe: number;
  /** Die Breite einer Kiste in Laufrichtung des Gestells. */
  kistenbreite: number;
  /** Wie tief eine Reihe ist. */
  reihentiefe: number;
  /** Wie tief die Kisten **einer** Seite bauen. */
  seitentiefe: number;
  /** Wie viele Kisten insgesamt stehen – alle bestückten Seiten zusammen. */
  gesamt: number;
  /** Was auf der Gestelllänge übrig bleibt. */
  rest: number;
}

/**
 * Rechnet aus, was vor ein Gestell passt.
 *
 * **Wie viele nebeneinander, ergibt sich** – das ist der Punkt. Der Nutzer
 * wählt die Länge des Gestells, die Lage der Kisten und die Zahl der Reihen;
 * alles andere folgt daraus. Eine Kiste, die nicht mehr ganz draufpasst,
 * wird nicht gezeichnet: Ein halber Kasten steht auch im Markt nicht da.
 */
export function kistenbelegung(
  gestelllaenge: number,
  lage: Kistenlage,
  reihen: number,
  seiten: 1 | 2 = 2,
): Kistenbelegung {
  const kistenbreite = lage === 'laengs' ? KISTE.laenge : KISTE.breite;
  const reihentiefe = lage === 'laengs' ? KISTE.breite : KISTE.laenge;
  const anzahlReihen = Math.max(0, Math.round(reihen));

  // Das Rundungsfeld: Ein Gestell von 200 cm nimmt fünf Kästen à 40 auf, und
  // daran soll kein Rechenrest im letzten Bit etwas ändern.
  const jeReihe = Math.floor((gestelllaenge + 0.01) / kistenbreite);
  return {
    jeReihe,
    kistenbreite,
    reihentiefe,
    seitentiefe: anzahlReihen * reihentiefe,
    gesamt: jeReihe * anzahlReihen * seiten,
    rest: gestelllaenge - jeReihe * kistenbreite,
  };
}

/** Wie eine Seite eines Gestells bestückt ist. */
export interface Kistenseite {
  lage: Kistenlage;
  reihen: number;
}

/** Was am Möbel über seine Kisten steht. */
export interface Kistenangabe {
  lage: Kistenlage;
  reihen: number;
  einseitig?: boolean;
  rueckseite?: Kistenseite;
}

/**
 * Die beiden Seiten eines Gestells, aufgelöst.
 *
 * `vorne` ist die Seite zur Gasse, `hinten` die dahinter – oder `null`, wenn
 * das Gestell an der Wand steht. Fehlt die Angabe zur Rückseite, ist sie wie
 * die Vorderseite: Das ist der Regelfall, und ihn zweimal einzutragen wäre
 * eine Gelegenheit, sich zu widersprechen.
 */
export function kistenseiten(kisten?: Kistenangabe): {
  vorne: Kistenseite;
  hinten: Kistenseite | null;
} {
  const vorne: Kistenseite = {
    lage: kisten?.lage ?? 'laengs',
    reihen: Math.max(0, Math.round(kisten?.reihen ?? 1)),
  };
  if (kisten?.einseitig) return { vorne, hinten: null };
  const roh = kisten?.rueckseite;
  return {
    vorne,
    hinten: roh
      ? { lage: roh.lage, reihen: Math.max(0, Math.round(roh.reihen)) }
      : { ...vorne },
  };
}

/** Wie tief die Kisten **einer** Seite bauen, in cm. */
export function seitentiefe(seite: Kistenseite): number {
  return seite.reihen * (seite.lage === 'laengs' ? KISTE.breite : KISTE.laenge);
}

/**
 * Die Tiefe, die ein Gestell samt Kisten im Plan einnimmt.
 *
 * Gestell dazwischen, Kisten davor und dahinter. Das ist die Zahl, die im
 * Plan zählt: Sie sagt, wie breit die Gasse daneben noch ist. Beide Seiten
 * werden einzeln gerechnet – sie müssen nicht gleich sein.
 */
export function gestelltiefe(kisten?: Kistenangabe): number {
  const { vorne, hinten } = kistenseiten(kisten);
  return GESTELL_STAERKE + seitentiefe(vorne) + (hinten ? seitentiefe(hinten) : 0);
}

/** Wie viele Kisten insgesamt stehen – beide Seiten zusammen. */
export function kistenzahl(gestelllaenge: number, kisten?: Kistenangabe): number {
  const { vorne, hinten } = kistenseiten(kisten);
  const je = (seite: Kistenseite) =>
    kistenbelegung(gestelllaenge, seite.lage, seite.reihen, 1).jeReihe * seite.reihen;
  return je(vorne) + (hinten ? je(hinten) : 0);
}

/**
 * Wie tief das Gestell selbst baut, in cm.
 *
 * Zwei Rohre mit Fußplatten – im Grundriss kaum mehr als ein Strich. Es steht
 * trotzdem in der Rechnung, weil die Kisten es nicht durchdringen: Sie stehen
 * davor, nicht darin.
 */
export const GESTELL_STAERKE = 6;

/** Die Längen, in denen es die Gestelle gibt, in cm. */
export const GESTELL_LAENGEN = [150, 200, 250];

/**
 * Die Höhe des Gestells über dem Boden, in cm.
 *
 * Es trägt nur die Preisschiene; gestapelt wird davor. Die Höhe steht im Plan
 * als Angabe am Möbel und beeinflusst nichts an der Fläche.
 */
export const GESTELL_HOEHE = 160;
