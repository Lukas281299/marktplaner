import type { Grundform } from '../typen/modell';

/**
 * Welche Einheiten sich in welcher Abteilung anhängen lassen.
 *
 * Jede Abteilung hat ihr eigenes Raster, und keines davon ist frei gewählt:
 * Die Maße stehen in den Katalogen, aus denen auch die Bibliothek gebaut ist.
 * Ein Kühlregal gibt es in 0,94 / 1,25 / 1,88 / 2,50 / 3,75 m und sonst gar
 * nicht — wer daraus 2,10 m macht, plant etwas, das niemand liefert.
 *
 * Der Sinn ist derselbe wie beim Trockensortiment: hinten eine Einheit
 * anhängen, ohne rechnen zu müssen. Nur die Maße unterscheiden sich.
 *
 * **Bewusst nicht enthalten** sind die Freihand-Formen (`regal`, `rechteck`
 * und alles, was in der Bibliothek unter „Frei" steht). Sie sind genau dafür
 * da, dass man sich um kein Raster kümmern muss.
 */
export interface Modulsatz {
  /** Wie die Einheit in dieser Abteilung heißt – Einzahl. */
  einheit: string;
  /** Dieselbe Einheit in der Mehrzahl. Ausgeschrieben, weil Deutsch. */
  mehrzahl: string;
  /** Die anhängbaren Längen in cm, aufsteigend. */
  laengen: number[];
  /** Woher die Maße stammen. Steht als Hinweis unter den Knöpfen. */
  herkunft: string;
  /** Beschriftung eines Knopfes, z. B. „A1250" oder „1,25 m". */
  knopf?: (laenge: number) => string;
}

/** Schreibt eine Länge als Meterangabe: 187,5 → „1,88 m". */
function meter(laenge: number): string {
  return `${(laenge / 100).toFixed(2).replace('.', ',')} m`;
}

/**
 * Die Modulsätze, nach Grundform.
 *
 * Die Form und nicht die Kategorie entscheidet: In „Kühlung" stehen
 * Hochkühlregale und Truhen nebeneinander, und die haben verschiedene
 * Raster. Die Form sagt genau, um welches Möbel es geht.
 */
const SAETZE: { formen: Grundform[]; satz: Modulsatz }[] = [
  {
    // wire tech 100 – die vier Achsmaße aus dem Workbook, Seite 24.
    formen: ['wt100', 'wt100Rund', 'wt100Eck'],
    satz: {
      einheit: 'Feld',
      mehrzahl: 'Felder',
      laengen: [62.5, 100, 125, 133.3],
      herkunft: 'Achsmaße wire tech 100 · Workbook Seite 24',
      knopf: (l) => `A${Math.round(l * 10)}`,
    },
  },
  {
    // Normalkühlung: die Kataloglängen, aus denen die Bibliothek gebaut ist.
    formen: ['kuehlSchrank', 'kuehlOffen', 'kuehlStufen'],
    satz: {
      einheit: 'Möbel',
      mehrzahl: 'Möbel',
      laengen: [93.7, 125, 187.5, 250, 375],
      herkunft: 'Kataloglängen der Normalkühlung',
    },
  },
  {
    // Tiefkühlschränke: die Längen des WSL-Katalogs, 2 bis 5 Türen.
    // Sie folgen keinem Modulraster – 1562, 2343, 3124 und 3898 mm sind
    // schlicht die vier Geräte, die es gibt.
    formen: ['tkSchrank'],
    satz: {
      einheit: 'Schrank',
      mehrzahl: 'Schränke',
      laengen: [156.2, 234.3, 312.4, 389.8],
      herkunft: 'Kataloglängen WSL · 2 bis 5 Türen',
    },
  },
  {
    // Kombigeräte: hinten Schrank, vorn Wanne. Eigene Längen.
    formen: ['tkKombi'],
    satz: {
      einheit: 'Gerät',
      mehrzahl: 'Geräte',
      laengen: [187.5, 250, 375],
      herkunft: 'Kataloglängen der Kombigeräte',
    },
  },
  {
    // Bedientheken (Blink). Dieselben Längen wie die Kühlung, dazu die
    // 3,13 m – die Bedienung baut man ohnehin aus Modulen zusammen.
    formen: ['blinkTheke', 'blinkSelf', 'blinkSv'],
    satz: {
      einheit: 'Modul',
      mehrzahl: 'Module',
      laengen: [93.7, 125, 187.5, 250, 312.5, 375],
      herkunft: 'Kataloglängen Blink · Katalog 2026 Seite 32/33',
    },
  },
  {
    // Tiefkühlinseln bestehen aus Modulen à 625 mm – so steht es am Möbel.
    formen: ['tkTruhe'],
    satz: {
      einheit: 'Modul',
      mehrzahl: 'Module',
      laengen: [62.5],
      herkunft: 'Module à 625 mm · Single und Double Island',
    },
  },
  {
    // Obst und Gemüse (Vitable). Die 2,00 m sind zwei Achsmaße A1000 in
    // einem Möbel – die Bibliothek führt sie als eigene Größe, deshalb
    // steht sie auch hier.
    //
    // Die Abschlüsse fehlen mit Absicht: Ein Abschluss beendet den Zug,
    // zwei hintereinander gibt es nicht.
    formen: ['vitable'],
    satz: {
      einheit: 'Einheit',
      mehrzahl: 'Einheiten',
      laengen: [100, 125, 200],
      herkunft: 'Achsmaße Vitable',
    },
  },
  {
    // BakeOff 3.0: das Grundmodul ist 1000 mm breit, daneben gibt es die
    // doppelte Einheit.
    formen: ['bakeoff'],
    satz: {
      einheit: 'Turm',
      mehrzahl: 'Türme',
      laengen: [100, 200],
      herkunft: 'Grundmodul BO3.0 · 1000 mm',
    },
  },
];

/**
 * Der Modulsatz zu einer Grundform – oder nichts, wenn die Form kein Raster
 * kennt.
 *
 * Ohne Satz bleibt am Element alles wie bisher: freie Breite, kein
 * Feld-Abschnitt im Eigenschaftenfenster.
 */
export function modulsatzFuer(form: Grundform): Modulsatz | undefined {
  return SAETZE.find((e) => e.formen.includes(form))?.satz;
}

/** Beschriftung eines Knopfes im jeweiligen Satz. */
export function modulName(satz: Modulsatz, laenge: number): string {
  return satz.knopf ? satz.knopf(laenge) : meter(laenge);
}

/**
 * Zerlegt eine vorhandene Breite in möglichst wenige Einheiten des Satzes.
 *
 * Nötig, weil die Bibliothek fertige Größen führt und nicht Listen: Eine
 * TK-Truhe von 2,50 m ist am Möbel als „4 Module à 625 mm" ausgewiesen, und
 * genau so soll sie auch im Eigenschaftenfenster stehen – nicht als ein
 * Klotz von 2,50 m.
 *
 * „Möglichst wenige" ist die richtige Regel: Ein Kühlregal von 1,88 m ist
 * ein Möbel dieser Länge und nicht zwei kleinere, die zufällig dieselbe
 * Summe ergeben.
 *
 * Geht die Breite nicht auf – etwa weil jemand ein Möbel frei gezogen hat –
 * bleibt sie als eine Einheit stehen. Das ist ehrlicher, als sie in Stücke
 * zu zerlegen, die es so nie gab.
 */
export function zerlegeInModule(breite: number, satz: Modulsatz): number[] {
  // Gerechnet in Zehntelzentimetern; darin sind alle Längen ganzzahlig.
  const ziel = Math.round(breite * 10);
  const laengen = satz.laengen.map((l) => Math.round(l * 10));
  if (ziel < Math.min(...laengen)) return [breite];

  // Für jede Teilsumme die Länge merken, mit der sie am günstigsten
  // erreicht wird – das klassische Münzproblem.
  //
  // `UNERREICHBAR` ist bewusst kein MAX_SAFE_INTEGER: In einem Int32Array
  // kippt der Wert auf −1, und dann gilt jede Summe als erreichbar.
  const UNERREICHBAR = 0x7fffffff;
  const zahl = new Int32Array(ziel + 1).fill(UNERREICHBAR);
  const zuletzt = new Int32Array(ziel + 1).fill(-1);
  zahl[0] = 0;
  for (let wert = 1; wert <= ziel; wert++) {
    for (const laenge of laengen) {
      if (wert < laenge || zahl[wert - laenge] === UNERREICHBAR) continue;
      if (zahl[wert - laenge] + 1 < zahl[wert]) {
        zahl[wert] = zahl[wert - laenge] + 1;
        zuletzt[wert] = laenge;
      }
    }
  }
  if (zahl[ziel] === UNERREICHBAR) return [breite];

  const teile: number[] = [];
  for (let wert = ziel; wert > 0; ) {
    const laenge = zuletzt[wert];
    if (laenge <= 0) return [breite];
    teile.push(laenge / 10);
    wert -= laenge;
  }
  return teile.sort((a, b) => b - a);
}

/**
 * Ein Satz aus dem eigenen Achsmaß eines Möbels.
 *
 * Für Möbel, die keinem System mit festen Rastern angehören, sich aber
 * trotzdem in Reihe stellen lassen: Blumenmöbel etwa stehen zu dritt
 * nebeneinander, und dann will man sie am Möbel verlängern statt drei
 * einzelne hinzustellen und auszurichten.
 *
 * Der Satz hat genau **eine** Länge – die des Möbels selbst. Etwas anderes
 * gäbe es auch nicht: Ein Pflanzregal ist 65,7 cm breit, und ein zweites
 * daneben ist wieder 65,7 cm breit. Ein Satz mit allen Blumenmaßen darin
 * würde anbieten, an ein Pflanzregal eine Blumeninsel anzuhängen.
 */
export function satzAusAchsmass(achsmass: number | undefined): Modulsatz | undefined {
  if (!achsmass || achsmass <= 0) return undefined;
  return {
    einheit: 'Element',
    mehrzahl: 'Elemente',
    laengen: [achsmass],
    herkunft: 'Das Möbel selbst – ein weiteres derselben Breite',
    knopf: meter,
  };
}
