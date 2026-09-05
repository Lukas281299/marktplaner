import { felderVon } from '../../regalseiten';
import { KISTE } from '../../getraenkekisten';
import { getraenkekasten } from './kasten';
import { unterbauAnzahl, unterbaumass, unterbauReihen } from '../../unterbau';
import {
  halbellipse,
  halbellipseInnen,
  platte,
  prisma,
  quader,
  seitenplatte,
  spiegele,
  verteileHoehen,
  wandplatte,
  zylinder,
  type Bauteil,
} from '../bauteile';
import { hoeheVon } from '../moebel';
import type {
  Ausstattungslage,
  Feldausstattung,
  PlanElement,
  Regalfeld,
  Unterbauart,
  Unterbauplatz,
} from '../../../typen/modell';

/**
 * Regale – Wanzl wire tech 100, aus dem Workbook Version 77 (12/2025).
 *
 * Was man sieht, von unten nach oben: Stellfüße unter einem flachen
 * **Fußrohr** (100 × 30 mm) je Säule, das von der Säule nach vorn bis zur
 * Nenntiefe reicht. An jeder Feldgrenze eine **Säule** 100 × 30 mm, ein Zug
 * mit n Feldern hat n + 1. Zwischen den Säulen hängt mittig die
 * **Gitter-Rückwand** (Maschen 100 × 50), vom Sockel bis zur Säulenoberkante.
 * Auf den Füßen liegt der **Grundboden** (Sockel-Blechetage), davor die
 * **Sockelblende** (ca. 10 hoch) und – wenn bestellt – das verzinkte
 * **Führungsrohr** (Ø 27 mm) ein paar Zentimeter vor der Front. Darüber die
 * **Drahtetagen** auf Konsolen, 5–6 Stück, nach oben flacher, jede vorn mit
 * einer transparenten Preisschiene (30–40 mm).
 *
 * **Der Grundboden ist die erste Etage.** Wer sieben Böden einträgt, bekommt
 * sieben Ebenen: das Sockelblech und darüber sechs Drahtetagen. Das ist
 * dieselbe Zählweise wie in der Rechnung (`logik/auslagen.ts`), und sie ist
 * die des Marktes — dort zählt man, worauf Ware liegt, und auf dem
 * Sockelblech liegt welche.
 *
 * **Die Etagen hängen hinten.** Sie werden in die Säule eingehängt, also ist
 * die hintere Kante fest und die vordere wandert mit der Tiefe: Eine flachere
 * Etage endet weiter vorn, sie beginnt nicht weiter hinten. Andersherum
 * gebaut sähe sie aus, als schwebte sie vor der Rückwand.
 *
 * Maße, die der Katalog nicht hergibt und die hier geschätzt sind: die
 * Oberkante des Grundbodens (ca. 12 cm) und die Dicke einer Drahtetage
 * samt Konsole (ca. 2,5 cm). Beides steht im Workbook nicht bemaßt.
 *
 * Die **Gondel** ist das Wandregal an der Rückwand gespiegelt: Säule und
 * Gitter in der Mitte, auf jeder Seite ein eigener Grundboden, eigene Etagen,
 * eigene Blende und eigenes Rohr. Genau so wird sie hier gebaut – eine Seite
 * als Rezept, die andere als Spiegelbild.
 */

/** Säule 100 × 30 mm – im Plan 10 tief, 3 breit. */
const SAEULE_T = 10;
const SAEULE_B = 3;
/** Fußrohr 100 mm hoch. */
const FUSS_H = 10;
/** Oberkante des Grundbodens über dem Fußboden – geschätzt, nicht bemaßt. */
const SOCKEL = 12;
/** Drahtetage mit Konsole. */
const ETAGE = 2.5;
/** Preisschiene an der Vorderkante. */
const PREISSCHIENE = 3.5;
/** Die tote Zone hinter dem Grundboden, wie sie das Programm rechnet. */
const TOTE_ZONE = 7;
/** Wie weit das Führungsrohr vor der Front läuft – wie im Grundriss. */
const ROHR_ABSTAND = 4;
const ROHR_RADIUS = 1.35;
/** Wie viele Böden ein Feld hat, wenn niemand etwas eingetragen hat. */
const ERSATZ_BOEDEN = 5;

/**
 * Wie hoch der Unterbau baut, in cm — **geschätzt**.
 *
 * Der Katalog kennt die Grundfläche einer Palette, nicht die Höhe des
 * Stapels darauf. Gezeichnet wird deshalb die Zone, die im Markt üblich ist:
 * eine Palette mit Ware darauf reicht knapp einen Meter hoch, eine
 * Kartoffelkiste steht hüfthoch, eine eingebaute Kühlvitrine gut 1,25 m.
 *
 * Über dieser Zone beginnen die Böden. Das ist der Fall, um den es geht:
 * oben ein, zwei Böden für die Sichtware, darunter der Nachschub.
 */
const UNTERBAU_ZONE: Record<Unterbauart, number> = {
  euro: 100,
  chep: 100,
  halb: 90,
  viertel: 70,
  kiste: 3 * KISTE.hoehe,
  kartoffelkiste: 80,
  kuehlmoebel: 125,
};

/**
 * Bis wohin der Unterbau reicht — nie mehr als drei Fünftel des Möbels.
 *
 * Ein niedriges Regal von 1,40 m hat unter einer Europalette sonst keinen
 * Platz mehr für einen einzigen Boden, und dann stimmt die Bodenzahl nicht
 * mehr mit dem überein, was man sieht.
 */
function unterbauzone(platz: Unterbauplatz, hoehe: number): number {
  return Math.min(UNTERBAU_ZONE[platz.art], hoehe * 0.6);
}

/** Eine Palette: Bodenbrett, drei Klötze, Decklage. */
function palette(x: number, y: number, b: number, t: number): Bauteil[] {
  const teile: Bauteil[] = [];
  teile.push(platte(x, y, 0, b, t, 'palette', 2.2));
  for (let i = 0; i < 3; i++) {
    teile.push(quader(x + (i * (b - 10)) / 2, y, 2.2, 10, t, 10, 'palette'));
  }
  teile.push(platte(x, y, 12.2, b, t, 'palette', 2.2));
  return teile;
}

/**
 * Was unter den Böden steht, räumlich.
 *
 * Verteilt wie im Grundriss (siehe `unterbauflaechen` in `ElementSymbol`):
 * an der Rückwand, gleichmäßig über die Feldbreite, und wenn es tiefer ist
 * als das Möbel, steht es eben vorn über. Das ist im Markt so, und im Plan
 * soll man es sehen.
 */
function unterbauTeile(
  platz: Unterbauplatz,
  x0: number,
  feldbreite: number,
  zone: number,
): Bauteil[] {
  const mass = unterbaumass(platz);
  const anzahl = unterbauAnzahl(platz, feldbreite);
  const gesamt = anzahl * mass.breite;
  const luecke = anzahl > 1 ? Math.max(0, (feldbreite - gesamt) / (anzahl + 1)) : 0;
  const start = anzahl > 1 ? luecke : Math.max(0, (feldbreite - mass.breite) / 2);

  const reihen = unterbauReihen(platz);
  const teile: Bauteil[] = [];
  for (let i = 0; i < anzahl; i++) {
    for (let reihe = 0; reihe < reihen; reihe++) {
      teile.push(...einStueck(platz, x0 + start + i * (mass.breite + luecke), reihe * mass.tiefe, mass, zone));
    }
  }
  return teile;
}

/**
 * Ein einzelnes Stück des Unterbaus, an seinem Platz.
 *
 * `y0` ist die Reihe: die vorderste steht an der Rückwand, jede weitere eine
 * Kistentiefe davor. Ragt die letzte über das Möbel hinaus, steht sie im
 * Gang — im Markt ist das der Normalfall, und der Plan zeigt es.
 */
function einStueck(
  platz: Unterbauplatz,
  x: number,
  y0: number,
  mass: { breite: number; tiefe: number },
  zone: number,
): Bauteil[] {
  const teile: Bauteil[] = [];
  {
    const b = mass.breite;
    const t = mass.tiefe;

    switch (platz.art) {
      case 'kiste': {
        // Getränkekisten, vor dem untersten Boden gestapelt.
        const stapel = Math.max(1, Math.floor(zone / KISTE.hoehe));
        for (let k = 0; k < stapel; k++) {
          teile.push(
            ...getraenkekasten(x + 1, y0 + 1, k * KISTE.hoehe, b - 2, t - 2, k, k === stapel - 1),
          );
        }
        break;
      }
      case 'kartoffelkiste': {
        // Ein Holzkasten mit offenem Oberteil, darin die Ware.
        const wand = 2.5;
        teile.push(quader(x, y0, 0, b, t, 10, 'holzDunkel'));
        teile.push(wandplatte(x, y0, 10, b, zone - 10, 'holzHell', wand));
        teile.push(wandplatte(x, y0 + t - wand, 10, b, zone - 10, 'holzHell', wand));
        teile.push(seitenplatte(x, y0, 10, t, zone - 10, 'holzHell', wand));
        teile.push(seitenplatte(x + b - wand, y0, 10, t, zone - 10, 'holzHell', wand));
        teile.push(quader(x + wand, y0 + wand, 10, b - 2 * wand, t - 2 * wand, zone - 22, 'ware'));
        break;
      }
      case 'kuehlmoebel': {
        // Eine Vitrine in der Regalzeile: Korpus, Glasfront, Sockel.
        teile.push(quader(x, y0, 0, b, t, 10, 'anthrazit'));
        teile.push(quader(x, y0, 10, b, t, zone - 10, 'hellgrau'));
        teile.push(wandplatte(x + 2, y0 + t - 1.2, 18, b - 4, zone - 30, 'glas', 1.2));
        teile.push(platte(x + 2, y0 + 4, zone - 3, b - 4, t - 8, 'edelstahl'));
        break;
      }
      default: {
        // Die vier Paletten: Ladungsträger mit einem Warenblock darauf.
        teile.push(...palette(x, y0, b, t));
        const ware = Math.max(0, zone - 16);
        if (ware > 2) teile.push(quader(x + 2, y0 + 2, 14.4, b - 4, t - 4, ware, 'ware'));
        break;
      }
    }
  }
  return teile;
}

/**
 * Der Einhängekorb — Wanzl WT100 08.010, „Einhängekorb H=190/75".
 *
 * Hinten 19 hoch, vorn 7,5: Das ist das Maß, das ihm seinen Katalognamen gibt,
 * und es ist zugleich das, woran man ihn erkennt. Der Boden liegt
 * **waagerecht** — geneigt hängt im ganzen Werk nur der Baguettekorb (08.013,
 * 15 Grad).
 *
 * Es ist **ein** Korb je Feld und nicht mehrere: Der Katalog führt ihn in den
 * Breiten 100 und 125, also im Achsmaß. Was im Markt wie zwei Körbe
 * nebeneinander aussieht, sind die **Trenngitter** (08.012), die innen
 * eingehängt werden.
 *
 * Die beiden Stirnseiten sind Bleche und keine Drähte — sie sind zugleich die
 * Konsolen und tragen die Haken in die Säule. Vorn läuft die eigene
 * Scannerpreisschiene (08.011), 4 cm hoch statt der 3,5 einer Etage.
 */
const KORB_H_HINTEN = 19;
const KORB_H_VORN = 7.5;
/** Das Bodengitter ist feiner und dünner als eine Drahtetage. */
const KORB_BODEN = 1.5;
/** Die Seitenwange: ein Blech, zugleich die Konsole. */
const KORB_WANGE = 1.2;
/** Scannerpreisschiene für den Einhängekorb (WT100 08.011). */
const KORB_PREISSCHIENE = 4;
/** Wie weit die Frontlippe nach außen kippt – aus der Zeichnung, nicht bemaßt. */
const KORB_NEIGUNG = 20;

function korb(x0: number, b: number, hinten: number, z: number, tiefe: number): Bauteil[] {
  const vorn = hinten + tiefe;
  const teile: Bauteil[] = [
    platte(x0, hinten, z, b, tiefe, 'draht', KORB_BODEN),
    wandplatte(x0, hinten, z, b, KORB_H_HINTEN, 'draht', 0.8),
    quader(x0, vorn - 1.2, z, b, 1.2, KORB_H_VORN, 'draht', { neigung: KORB_NEIGUNG }),
    seitenplatte(x0, hinten, z, tiefe, KORB_H_HINTEN, 'regal', KORB_WANGE),
    seitenplatte(x0 + b - KORB_WANGE, hinten, z, tiefe, KORB_H_HINTEN, 'regal', KORB_WANGE),
    zylinder(x0, hinten + 0.4, z + KORB_H_HINTEN, 0.5, b, 'x', 'chrom'),
    quader(
      x0,
      vorn - 0.8,
      z + KORB_H_VORN - KORB_PREISSCHIENE,
      b,
      0.8,
      KORB_PREISSCHIENE,
      'preisschiene',
    ),
  ];
  // Die Trenngitter — sie sind es, die im Markt wie mehrere Körbe aussehen.
  for (const anteil of [1 / 3, 2 / 3]) {
    teile.push(seitenplatte(x0 + b * anteil, hinten, z, tiefe, KORB_H_HINTEN, 'draht', 0.6));
  }
  return teile;
}

/**
 * Die Blister-Rückwand — Wanzl WT100 02.009 und 02.010/02.011.
 *
 * Ein **Feingewebe**, kein Lochblech: Der Katalog nennt für sie als einziges
 * Rückwandteil kein Raster, und die Zeichnung zeigt dicht liegende waagerechte
 * Drähte, über die der Haken einfach gehängt wird. Sie hängt **vor** der
 * Säule, nicht mittig wie die Gitter-Rückwand — das ist der Unterschied, an
 * dem man sie erkennt, und deshalb steht davor kein Boden mehr.
 *
 * **Gezeichnet wird das Gitter und die Haken, sonst nichts.** Was daran
 * hängt, ist Ware und keine Einrichtung; sie zu zeichnen machte aus der Wand
 * einen Warenblock, und man sähe nicht mehr, worum es geht. Die Haken ragen
 * 30 cm heraus — das ist die Länge, mit der geplant wird.
 */
const BLISTER_STAERKE = 0.6;
/** Wie weit die Haken aus der Wand ragen, in cm. */
const HAKEN_L = 30;
/** Waagerechter Abstand zweier Haken. */
const HAKEN_ABSTAND = 12.5;
/** Senkrechter Abstand zweier Hakenreihen. */
const HAKEN_REIHE = 30;
/** Mehr Reihen baut niemand, und mehr Bauteile will die Ansicht nicht. */
const REIHEN_MAX = 7;

function blisterwand(
  x0: number,
  b: number,
  saeulenfront: number,
  z1: number,
  z2: number,
): Bauteil[] {
  if (z2 - z1 < 10) return [];
  const teile: Bauteil[] = [
    wandplatte(x0, saeulenfront, z1, b, z2 - z1, 'gitter', BLISTER_STAERKE),
  ];

  const reihen = Math.max(1, Math.min(REIHEN_MAX, Math.floor((z2 - z1) / HAKEN_REIHE)));
  const jeReihe = Math.max(1, Math.round(b / HAKEN_ABSTAND));
  const schritt = b / jeReihe;

  for (let r = 0; r < reihen; r++) {
    const z = z2 - 8 - r * HAKEN_REIHE;
    if (z < z1 + 4) break;
    for (let i = 0; i < jeReihe; i++) {
      teile.push(
        zylinder(
          x0 + schritt * (i + 0.5),
          saeulenfront + BLISTER_STAERKE,
          z,
          0.3,
          HAKEN_L,
          'y',
          'chrom',
        ),
      );
    }
  }
  return teile;
}

/**
 * Welche Ebenen Körbe sind.
 *
 * **Gezählt wird über alle Ebenen, den Grundboden eingeschlossen.** Wer von
 * unten aufstockt, fängt beim untersten Boden an — dort steht der erste Korb,
 * und nicht erst eine Etage darüber. Ebene 0 ist deshalb der Grundboden,
 * Ebene 1 die erste Drahtetage.
 */
function korbebenen(anzahl: number, lage: Ausstattungslage, ebenen: number): Set<number> {
  const wieViele = Math.max(0, Math.min(anzahl, ebenen));
  if (wieViele === 0) return new Set();
  const erste =
    lage === 'unten'
      ? 0
      : lage === 'oben'
        ? ebenen - wieViele
        : Math.floor((ebenen - wieViele) / 2);
  const aus = new Set<number>();
  for (let i = 0; i < wieViele; i++) aus.add(erste + i);
  return aus;
}

/**
 * Die Höhe, über die sich die Böden verteilen, und die Zone der Hängeware.
 *
 * Wo die Lochwand hängt, gibt es keine Böden. Sie nimmt ihren Prozentsatz vom
 * nutzbaren Bereich, oben oder unten, und die Böden teilen sich den Rest.
 */
function zonen(ausstattung: Feldausstattung | undefined, von: number, bis: number) {
  const haenge = ausstattung?.haengeware;
  const anteil = Math.max(0, Math.min(95, haenge?.anteil ?? 0)) / 100;
  if (!haenge || anteil <= 0 || bis <= von) return { boden: { von, bis }, wand: undefined };

  const hoehe = (bis - von) * anteil;
  return haenge.lage === 'unten'
    ? { boden: { von: von + hoehe, bis }, wand: { von, bis: von + hoehe } }
    : { boden: { von, bis: bis - hoehe }, wand: { von: bis - hoehe, bis } };
}

/** Die Feldgrenzen als x-Werte, von 0 an. */
function grenzen(felder: Regalfeld[]): number[] {
  const aus = [0];
  let x = 0;
  for (const feld of felder) {
    x += feld.breite;
    aus.push(x);
  }
  return aus;
}

/**
 * Eine Regalseite: Grundboden, Blende, Rohr und Etagen für alle Felder.
 *
 * Die Säule steht hinten bei `y = 0 … SAEULE_T`, der Grundboden reicht bis
 * zur Front bei `y = tiefe`. Säulen und Rückwand baut der Aufrufer – bei
 * der Gondel gibt es sie nur einmal in der Mitte.
 */
function regalseite(
  felder: Regalfeld[],
  tiefe: number,
  grundbodenTiefe: number,
  hoehe: number,
  fuehrungsrohr: boolean,
  /**
   * Wo die Vorderfläche der Säule liegt.
   *
   * Beim Wandregal steht die Säule bei y = 0 … SAEULE_T, bei einer
   * Gondelseite rechnet diese Funktion im Mittelrahmen, und die Säule läuft
   * von −SAEULE_T/2 bis +SAEULE_T/2. Die Blister-Rückwand hängt davor — ohne
   * diese Angabe hinge sie in der Gondel fünf Zentimeter zu weit vorn.
   */
  saeulenfront: number,
): Bauteil[] {
  const teile: Bauteil[] = [];
  const kanten = grenzen(felder);
  const gesamt = kanten[kanten.length - 1];
  if (gesamt <= 0) return teile;

  const T = Math.max(20, Math.min(grundbodenTiefe, tiefe - 2));
  const front = tiefe;
  // **Die hintere Kante aller Auflagen.** Dort hängen sie in der Säule, und
  // deshalb steht sie fest: Eine flachere Etage endet weiter vorn, sie
  // beginnt nicht weiter hinten.
  const hinten = Math.max(0, front - T);

  // Füße: an jeder Feldgrenze, von der Säule bis zur Front.
  for (const x of kanten) {
    teile.push(quader(x - SAEULE_B / 2, 0, 0, SAEULE_B, front, FUSS_H, 'regal'));
  }

  felder.forEach((feld, i) => {
    if (feld.leer) return;
    const x0 = kanten[i];
    const b = feld.breite;

    // Was unter den Böden steht – Palette, Kisten, Kühlmöbel. Es bestimmt
    // zugleich, ab welcher Höhe die Böden überhaupt anfangen können.
    const zone = feld.unterbau ? unterbauzone(feld.unterbau, hoehe) : 0;
    if (feld.unterbau) teile.push(...unterbauTeile(feld.unterbau, x0, b, zone));

    const n = feld.boeden ?? ERSATZ_BOEDEN;
    if (n <= 0) return;

    // **Der Grundboden ist die erste Etage.** Steht etwas darunter, rückt er
    // über den Unterbau; sonst liegt er auf den Füßen.
    const unterkante = Math.max(SOCKEL, zone);
    teile.push(platte(x0, hinten, unterkante - 2, b, T, 'regal', 2));
    // Die Sockelblende gehört zum Fuß und entfällt, wo der Unterbau steht.
    if (zone <= 0) teile.push(quader(x0, front - 1.5, 1.5, b, 1, SOCKEL - 3, 'regal'));

    // Wo eine Blisterrückwand hängt, gibt es keine Böden. Sie nimmt ihren
    // Anteil, die Böden teilen sich den Rest.
    const { boden, wand } = zonen(feld.ausstattung, unterkante, hoehe - 20);
    if (wand) teile.push(...blisterwand(x0, b, saeulenfront, wand.von, wand.bis));

    // Und darüber die übrigen n − 1: nach oben flacher, die oberste bleibt
    // eine gute Handbreit unter der Säulenoberkante.
    const hoehen = verteileHoehen(boden.von, boden.bis, n - 1);
    const koerbe = feld.ausstattung?.koerbe;
    // Ebene 0 ist der Grundboden, danach die Drahtetagen.
    const alsKorb = koerbe
      ? korbebenen(koerbe.anzahl, koerbe.lage, n)
      : new Set<number>();
    if (alsKorb.has(0)) teile.push(...korb(x0, b, hinten, unterkante, T));
    const unten = Math.max(20, T - 10);
    const oben = Math.max(20, Math.min(30, unten));
    hoehen.forEach((z, k) => {
      const anteil = hoehen.length > 1 ? k / (hoehen.length - 1) : 0;
      const d = Math.round(unten - (unten - oben) * anteil);
      teile.push(platte(x0, hinten, z, b, d, 'draht', ETAGE));
      // Ein Korb steht auf der Etage; eine Preisschiene braucht er nicht,
      // seine Vorderkante trägt sie selbst.
      if (alsKorb.has(k + 1)) {
        // **So tief wie die Etage, so breit wie das Feld.** Der Katalog führt
        // den Korb in denselben Breiten wie das Regal; im Markt sitzt er
        // bündig in seiner Ebene.
        teile.push(...korb(x0, b, hinten, z + ETAGE, d));
      } else {
        teile.push(quader(x0, hinten + d - 0.6, z, b, 0.6, PREISSCHIENE, 'preisschiene'));
      }
      // Konsolen unter der Etage, keilförmig – hier ein kurzer Klotz an der Säule.
      teile.push(quader(x0 + 0.5, hinten, z - 4, 2, Math.min(15, d), 4, 'regal'));
      teile.push(quader(x0 + b - 2.5, hinten, z - 4, 2, Math.min(15, d), 4, 'regal'));
    });
  });

  if (fuehrungsrohr) {
    teile.push(zylinder(0, front + ROHR_ABSTAND, FUSS_H - 1, ROHR_RADIUS, gesamt, 'x', 'chrom'));
  }
  return teile;
}

/** Säulen und Gitter-Rückwand an einer Linie `y`. */
function saeulenreihe(felder: Regalfeld[], y: number, hoehe: number): Bauteil[] {
  const teile: Bauteil[] = [];
  const kanten = grenzen(felder);
  const gesamt = kanten[kanten.length - 1];
  for (const x of kanten) {
    teile.push(quader(x - SAEULE_B / 2, y, 0, SAEULE_B, SAEULE_T, hoehe, 'regal'));
    // Die Kappe oben – schwarz, wie im Katalog.
    teile.push(quader(x - SAEULE_B / 2, y, hoehe, SAEULE_B, SAEULE_T, 1, 'schwarz'));
  }
  teile.push(wandplatte(0, y + SAEULE_T / 2 - 0.4, SOCKEL, gesamt, hoehe - SOCKEL, 'gitter', 0.8));
  return teile;
}

/** Wandregal: Säulen hinten, eine Seite nach vorn. */
function wandregal(element: PlanElement): Bauteil[] {
  const felder = felderVon(element, 'unten');
  const hoehe = hoeheVon(element);
  const grundboden = element.grundboden ?? element.tiefe - TOTE_ZONE;
  return [
    ...saeulenreihe(felder, 0, hoehe),
    ...regalseite(felder, element.tiefe, grundboden, hoehe, Boolean(element.fuehrungsrohr), SAEULE_T),
  ];
}

/**
 * Gondel: Säulen in der Mitte, zwei Seiten.
 *
 * Die Vorderseite (`unten`) läuft von der Mitte zur Front, die Rückseite
 * (`oben`) ist ihr Spiegelbild – mit ihren eigenen Feldern, wenn sie welche
 * hat.
 */
function gondel(element: PlanElement): Bauteil[] {
  const hoehe = hoeheVon(element);
  const mitte = element.tiefe / 2;
  const seitentiefe = mitte;
  const grundboden = element.grundboden ?? (element.tiefe - TOTE_ZONE) / 2;
  const vorn = felderVon(element, 'unten');
  const hinten = felderVon(element, 'oben');
  const rohr = Boolean(element.fuehrungsrohr);

  // Jede Seite wird so gebaut, als stünde die Säule bei y = 0 und die Front
  // bei y = seitentiefe – dann um die Mitte verschoben bzw. gespiegelt.
  const vorderseite = regalseite(vorn, seitentiefe, grundboden, hoehe, rohr, SAEULE_T / 2).map(
    (teil) => verschiebeY(teil, mitte),
  );
  const rueckseite = spiegele(
    regalseite(hinten, seitentiefe, grundboden, hoehe, rohr, SAEULE_T / 2).map((teil) =>
      verschiebeY(teil, mitte),
    ),
    element.tiefe,
  );
  return [...saeulenreihe(vorn, mitte - SAEULE_T / 2, hoehe), ...vorderseite, ...rueckseite];
}

function verschiebeY(teil: Bauteil, dy: number): Bauteil {
  if (teil.art === 'prisma') return { ...teil, punkte: teil.punkte.map((p) => ({ x: p.x, y: p.y + dy })) };
  return { ...teil, y: teil.y + dy };
}

/**
 * Die Kopfgondel rund – ein Halbkreis am Ende des Zugs.
 *
 * Sie hat keine eigenen Säulen: Sie hängt an den Endsäulen des Zugs. Unten
 * das Sockelblech als Halbkreis mit eigener Blende, darüber 4–5 halbrunde
 * Drahtetagen mit radialen Drähten, nach oben kleiner. Die gerade Seite liegt
 * am Zug (hinten, `y = 0`), der Bogen zeigt in den Gang.
 */
function kopfgondelRund(element: PlanElement): Bauteil[] {
  const hoehe = hoeheVon(element);
  const b = element.breite;
  const t = element.tiefe - 3;
  const teile: Bauteil[] = [];
  teile.push(prisma(halbellipseInnen(b, t, 1.5), 1.5, SOCKEL - 1.5, 'regal'));
  teile.push(prisma(halbellipse(b, t), SOCKEL - 2, 2, 'regal'));

  // Auch hier ist das Sockelblech die erste Etage – siehe oben.
  const n = felderVon(element, 'unten')[0]?.boeden ?? 4;
  const hoehen = verteileHoehen(SOCKEL, hoehe - 20, n - 1);
  hoehen.forEach((z, k) => {
    const rand = 6 + 7 * k;
    teile.push(prisma(halbellipseInnen(b, t, rand), z, ETAGE, 'draht'));
  });

  if (element.fuehrungsrohr) {
    // Das gebogene Rohr – angenähert durch ein flaches Band knapp vor dem Bogen.
    teile.push(prisma(halbellipse(b + 2 * ROHR_ABSTAND, t + ROHR_ABSTAND).map((p) => ({ x: p.x - ROHR_ABSTAND, y: p.y })), FUSS_H - 2, 2.5, 'chrom'));
  }
  return teile;
}

/**
 * Das Eckfeld: kein Möbel, sondern die Lücke, wo zwei Züge über Eck stoßen.
 *
 * wire tech 100 hat kein Eckbauteil (Workbook, Verzeichnis S. 116–117). In
 * der Praxis bleibt hinten ein Quadrat leer oder wird unten verblendet – hier
 * ein Sockelblech in Regalfarbe, darüber Luft.
 */
function eckfeld(element: PlanElement): Bauteil[] {
  return [quader(0, 0, 0, element.breite, element.tiefe, SOCKEL, 'regal')];
}

export function regalBauteile(element: PlanElement): Bauteil[] {
  switch (element.form) {
    case 'wt100Rund':
      return kopfgondelRund(element);
    case 'wt100Eck':
      return eckfeld(element);
    default:
      return element.beidseitig ? gondel(element) : wandregal(element);
  }
}
