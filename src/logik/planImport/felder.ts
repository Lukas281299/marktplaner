import type { Punkt } from '../../typen/modell';
import type { PlanText, Sicherheit } from './typen';

/**
 * Regalzüge aus den Etagenzahlen erkennen.
 *
 * In einem Wanzl-Plan trägt jedes Regalfeld seine Etagenzahl: „5+", „6+".
 * Die Legende sagt dazu „n = Anzahl der Etagen". Das ist ein vollständiges
 * Raster über alle Regale des Marktes – im Plan Fuldabrück 368 Stück.
 *
 * Daraus lässt sich mehr ablesen als aus der Zeichnung selbst. Ein Regal aus
 * den Linienstücken zusammenzusetzen hieße raten: Der Plan besteht aus
 * 160.000 einzelnen Strecken, und ein Regalkörper unterscheidet sich darin
 * nicht von einer Schraffur. Die Etagenzahlen dagegen stehen genau einmal je
 * Feld, in dessen Mitte. Ihr Abstand ist das Achsmaß, ihre Reihung die
 * Laufrichtung, ihre Anzahl die Länge des Zuges.
 *
 * Zwei Dinge machen die Sache heikel und sind hier berücksichtigt:
 * Züge laufen nicht immer waagerecht – im Plan stehen mehrere schräg im
 * Raum. Und bei einer Gondel trägt jede Seite ihre eigene Zahlenreihe, die
 * beiden Reihen liegen dicht nebeneinander.
 */

/** Die Achsmaße des Systems in Millimetern. */
const ACHSMASSE = [625, 800, 1000, 1250, 1333];

/** Wie weit ein gemessenes Achsmaß danebenliegen darf. */
const ACHS_TOLERANZ = 0.06;

/** Größter Abstand zweier Felder desselben Zuges, in Millimetern. */
const MAX_FELDABSTAND = 1500;

/** Wie stark die Richtung von Feld zu Feld schwanken darf, in Grad. */
const MAX_KNICK = 8;

export interface ErkanntesFeld {
  /** Mittelpunkt in PDF-Punkten. */
  punkt: Punkt;
  etagen: number;
}

export interface ErkannterZug {
  felder: ErkanntesFeld[];
  /** Achsmaß in Millimetern, auf ein Maß des Systems gerundet. */
  achsmassMm: number;
  /** Was tatsächlich gemessen wurde, vor dem Runden. */
  gemessenMm: number;
  /** Laufrichtung in Grad, 0 = nach rechts. */
  winkel: number;
  laengeMm: number;
  sicherheit: Sicherheit;
  /** Ein Satz für die Prüfliste. */
  anmerkung?: string;
}

/** Liest die Etagenzahlen aus den Texten der Seite. */
export function etagenzahlen(texte: PlanText[]): ErkanntesFeld[] {
  const felder: ErkanntesFeld[] = [];
  for (const t of texte) {
    const treffer = t.text.trim().match(/^(\d)\s*\+$/);
    if (treffer) felder.push({ punkt: { x: t.x, y: t.y }, etagen: Number(treffer[1]) });
  }
  return felder;
}

function abstand(a: Punkt, b: Punkt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function winkelGrad(a: Punkt, b: Punkt): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Winkelunterschied, immer als kleinster Wert zwischen 0 und 180. */
function winkelDifferenz(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Verkettet die Felder zu Zügen.
 *
 * Gearbeitet wird von jedem noch freien Feld aus: Der nächste Nachbar gibt
 * Schrittweite und Richtung vor, danach wird in genau dieser Richtung
 * weitergesucht. Dadurch bleiben schräge Züge zusammen, und zwei Züge, die
 * sich über Eck treffen, laufen nicht ineinander – dort knickt die Richtung.
 */
export function findeZuege(felder: ErkanntesFeld[], mmJePunkt: number): ErkannterZug[] {
  const frei = new Set(felder.keys());
  const maxSchritt = MAX_FELDABSTAND / mmJePunkt;
  const zuege: ErkannterZug[] = [];

  /**
   * Baut von einem Feld aus die Kette in einer vorgegebenen Richtung.
   *
   * Verändert nichts – die Kette ist nur ein Vorschlag, damit sich mehrere
   * Richtungen vergleichen lassen.
   */
  const baueKette = (start: number, richtung: number): number[] => {
    const benutzt = new Set<number>([start]);
    const weiter = (von: Punkt, rich: number) => {
      let besterIndex = -1;
      let besteEntfernung = Infinity;
      for (const i of frei) {
        if (benutzt.has(i)) continue;
        const d = abstand(von, felder[i].punkt);
        if (d < 1 || d > maxSchritt) continue;
        if (winkelDifferenz(winkelGrad(von, felder[i].punkt), rich) > MAX_KNICK) continue;
        if (d < besteEntfernung) {
          besteEntfernung = d;
          besterIndex = i;
        }
      }
      return besterIndex;
    };

    const kette = [start];
    for (;;) {
      const n = weiter(felder[kette[kette.length - 1]].punkt, richtung);
      if (n < 0) break;
      benutzt.add(n);
      kette.push(n);
    }
    for (;;) {
      const n = weiter(felder[kette[0]].punkt, richtung + 180);
      if (n < 0) break;
      benutzt.add(n);
      kette.unshift(n);
    }
    return kette;
  };

  while (frei.size > 0) {
    const start = frei.values().next().value as number;

    // Es genügt nicht, den nächsten Nachbarn als Richtung zu nehmen. Bei
    // einer Gondel liegen die beiden Seiten oft dichter beieinander als die
    // Felder einer Reihe – im Plan sind das 1070 mm quer gegen 1250 mm
    // längs. Der nächste Nachbar zeigt dann quer, und die Kette liefe über
    // die Gondel statt an ihr entlang.
    //
    // Deshalb werden alle in Frage kommenden Richtungen durchprobiert und
    // die längste Kette behalten. Bei gleicher Länge gewinnt die Richtung,
    // deren Schrittweite am besten zu einem Systemmaß passt.
    let beste = [start];
    let besteGuete = Infinity;
    for (const kandidat of frei) {
      if (kandidat === start) continue;
      const d = abstand(felder[start].punkt, felder[kandidat].punkt);
      if (d < 1 || d > maxSchritt) continue;
      const kette = baueKette(start, winkelGrad(felder[start].punkt, felder[kandidat].punkt));
      const guete = abweichungVomSystemmass(kette.map((i) => felder[i]), mmJePunkt);
      if (kette.length > beste.length || (kette.length === beste.length && guete < besteGuete)) {
        beste = kette;
        besteGuete = guete;
      }
    }

    for (const i of beste) frei.delete(i);
    if (beste.length === 1) {
      zuege.push(einzelfeld(felder[start]));
      continue;
    }
    zuege.push(ausKette(beste.map((i) => felder[i]), mmJePunkt));
  }

  return zuege;
}

/** Mittlere Schrittweite einer Kette in Millimetern. */
function medianSchritt(kette: ErkanntesFeld[], mmJePunkt: number): number {
  const schritte: number[] = [];
  for (let i = 1; i < kette.length; i++) {
    schritte.push(abstand(kette[i - 1].punkt, kette[i].punkt) * mmJePunkt);
  }
  if (schritte.length === 0) return 0;
  schritte.sort((a, b) => a - b);
  // Der Median, nicht der Mittelwert: Ein einzelner zu großer Schritt – etwa
  // über eine Gangunterbrechung hinweg – darf das Achsmaß nicht verziehen.
  return schritte[Math.floor(schritte.length / 2)];
}

/** Wie weit die Schrittweite vom nächsten Systemmaß entfernt ist, anteilig. */
function abweichungVomSystemmass(kette: ErkanntesFeld[], mmJePunkt: number): number {
  const schritt = medianSchritt(kette, mmJePunkt);
  if (schritt <= 0) return Infinity;
  return Math.min(...ACHSMASSE.map((a) => Math.abs(schritt - a) / a));
}

/** Ein Feld, das zu keinem Zug gehört – kommt bei Kopfgondeln vor. */
function einzelfeld(feld: ErkanntesFeld): ErkannterZug {
  return {
    felder: [feld],
    achsmassMm: 0,
    gemessenMm: 0,
    winkel: 0,
    laengeMm: 0,
    sicherheit: 'geraten',
    anmerkung: 'Einzelnes Feld ohne Nachbarn – Achsmaß nicht bestimmbar',
  };
}

/** Rechnet aus einer Kette von Feldern den Zug aus. */
function ausKette(kette: ErkanntesFeld[], mmJePunkt: number): ErkannterZug {
  const gemessen = medianSchritt(kette, mmJePunkt);

  let achsmass = 0;
  let abweichung = Infinity;
  for (const kandidat of ACHSMASSE) {
    const d = Math.abs(gemessen - kandidat) / kandidat;
    if (d < abweichung) {
      abweichung = d;
      achsmass = kandidat;
    }
  }

  const passt = abweichung <= ACHS_TOLERANZ;
  const winkel = winkelGrad(kette[0].punkt, kette[kette.length - 1].punkt);

  return {
    felder: kette,
    achsmassMm: passt ? achsmass : Math.round(gemessen),
    gemessenMm: Math.round(gemessen),
    winkel,
    laengeMm: (passt ? achsmass : gemessen) * kette.length,
    sicherheit: passt ? (abweichung < 0.03 ? 'sicher' : 'wahrscheinlich') : 'geraten',
    anmerkung: passt
      ? undefined
      : `Gemessenes Achsmaß ${Math.round(gemessen)} mm passt zu keinem Systemmaß – bitte prüfen`,
  };
}

/**
 * Sucht zu jedem Zug den Gegenzug einer Gondel.
 *
 * Eine Gondel trägt auf jeder Seite eine eigene Zahlenreihe. Beide laufen
 * parallel und decken sich der Länge nach.
 *
 * Der Abstand der beiden Reihen ist NICHT die Gondeltiefe – das war die
 * falsche Annahme, mit der hier zuerst keine einzige Gondel gefunden wurde.
 * Im Plan Fuldabrück liegen die Reihen 307 bis 446 mm auseinander, während
 * die Gondeln 1070 und 1270 mm tief sind: Die Zahlen stehen beidseits der
 * Mittellinie, nicht an den Außenkanten. Das Fenster ist deshalb weit
 * gefasst, und ausgesiebt wird über die Überdeckung.
 *
 * Auf gleiche Feldzahl wird bewusst nicht bestanden. Im echten Plan hat eine
 * Seite oft ein Feld weniger, weil dort ein Kopfregal sitzt.
 */
export function findeGondelpaare(
  zuege: ErkannterZug[],
  mmJePunkt: number,
  maxTiefeMm = 1500,
): [number, number][] {
  /** Richtung einer Geraden – 0 und 180 Grad sind dieselbe Richtung. */
  const geradenwinkel = (grad: number) => ((grad % 180) + 180) % 180;

  /** Wie weit zwei Geradenrichtungen auseinanderliegen, höchstens 90 Grad. */
  const geradenDifferenz = (a: number, b: number) => {
    const d = Math.abs(geradenwinkel(a) - geradenwinkel(b));
    return Math.min(d, 180 - d);
  };

  interface Anwaerter {
    j: number;
    abstand: number;
  }

  const paare: [number, number][] = [];
  const vergeben = new Set<number>();

  for (let i = 0; i < zuege.length; i++) {
    if (vergeben.has(i) || zuege[i].felder.length < 2) continue;
    const a = zuege[i];
    let bester: Anwaerter | undefined;

    for (let j = i + 1; j < zuege.length; j++) {
      if (vergeben.has(j) || zuege[j].felder.length < 2) continue;
      const b = zuege[j];

      if (geradenDifferenz(a.winkel, b.winkel) > MAX_KNICK) continue;
      if (a.achsmassMm !== b.achsmassMm) continue;

      // In das Koordinatensystem des ersten Zuges umrechnen.
      const bogen = (a.winkel * Math.PI) / 180;
      const quer = (p: Punkt) => -p.x * Math.sin(bogen) + p.y * Math.cos(bogen);
      const laengs = (p: Punkt) => p.x * Math.cos(bogen) + p.y * Math.sin(bogen);

      const querA = a.felder.map((f) => quer(f.punkt));
      const querB = b.felder.map((f) => quer(f.punkt));
      const dQuer =
        Math.abs(
          querA.reduce((s, v) => s + v, 0) / querA.length -
            querB.reduce((s, v) => s + v, 0) / querB.length,
        ) * mmJePunkt;
      if (dQuer > maxTiefeMm || dQuer < 50) continue;

      // Wie weit sich die beiden Züge längs überdecken.
      const laengsA = a.felder.map((f) => laengs(f.punkt));
      const laengsB = b.felder.map((f) => laengs(f.punkt));
      const vonA = Math.min(...laengsA);
      const bisA = Math.max(...laengsA);
      const vonB = Math.min(...laengsB);
      const bisB = Math.max(...laengsB);
      const ueberdeckung = Math.min(bisA, bisB) - Math.max(vonA, vonB);
      const kuerzere = Math.min(bisA - vonA, bisB - vonB);
      if (kuerzere <= 0 || ueberdeckung / kuerzere < 0.6) continue;

      if (!bester || dQuer < bester.abstand) bester = { j, abstand: dQuer };
    }

    if (bester) {
      paare.push([i, bester.j]);
      vergeben.add(i);
      vergeben.add(bester.j);
    }
  }

  return paare;
}
