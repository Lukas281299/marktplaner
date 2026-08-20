import type { Punkt } from '../../typen/modell';
import type { Farbe, Sicherheit } from './typen';

/**
 * Wandkörper aus einem Plan-PDF.
 *
 * Der erste Anlauf suchte nach langen Linien. Das war der falsche Ansatz:
 * Die längsten Linien eines Plans sind der Zeichnungsrahmen und die Linien im
 * Schriftfeld, und eine Wand besteht ohnehin aus zwei Linien, nicht aus einer.
 *
 * Ein CAD-Plan zeichnet Wände als **gefüllte Flächen** in einer eigenen Farbe.
 * Im Plan Dörnhagen ist das ein Grau von #696969, und darin stecken alle
 * Wände, Pfeiler und Stützen des Marktes – als geschlossene Polygone mit
 * ihrer echten Stärke. Das ist keine Schätzung mehr, sondern die Zeichnung
 * selbst.
 *
 * Was in derselben Farbe daneben liegt, sind Möbel: Im Plan Dörnhagen sind 24
 * der 66 grauen Flächen Obst-und-Gemüse-Tische, vier sind Aktions-Kopfregale
 * und drei sind Bruchstücke aus den Schnittzeichnungen unter dem Grundriss.
 * Auseinanderhalten lassen sie sich am Füllgrad: Ein Wandkörper ist ein
 * dünner Ring um eine große Fläche und füllt seine Bounding-Box nur zu ein
 * paar Prozent, ein Möbel ist ein massiver Block.
 */

/** Ein geschlossenes, gefülltes Polygon aus dem PDF. */
export interface Fuellflaeche {
  punkte: Punkt[];
  fuellung: Farbe;
}

export type Koerperart = 'wand' | 'stuetze' | 'fremd';

export interface Wandkoerper {
  punkte: Punkt[];
  art: Koerperart;
  /** Bounding-Box in Millimetern. */
  breiteMm: number;
  hoeheMm: number;
  /** Fläche des Polygons in Quadratmillimetern. */
  flaecheMm2: number;
  /** Anteil der Bounding-Box, den das Polygon wirklich ausfüllt. */
  fuellgrad: number;
  sicherheit: Sicherheit;
  begruendung: string;
}

/**
 * Grenzwerte der Einteilung.
 *
 * Abgelesen an einem Plan mit 66 grauen Flächen, von denen 35 baulich sind.
 * Sie sind bewusst großzügig gewählt: Ein zu Unrecht mitgenommener Pfeiler
 * ist ein Klick zum Löschen, eine übersehene Wand ein Loch im Grundriss.
 */
const RING_GRENZE = 0.35;
const STUETZE_MAX_MM = 1000;
const WINZIG_MM = 200;
/** Ab dieser Kantenlänge zählt eine Serie gleicher Größen als Möbel. */
const SERIEN_GRENZE_MM = 700;

/** Fläche eines Polygons nach der Trapezformel, immer positiv. */
export function polygonflaeche(punkte: Punkt[]): number {
  let summe = 0;
  for (let i = 0; i < punkte.length; i++) {
    const a = punkte[i];
    const b = punkte[(i + 1) % punkte.length];
    summe += a.x * b.y - b.x * a.y;
  }
  return Math.abs(summe) / 2;
}

/** Bounding-Box eines Polygons. */
export function rahmenVon(punkte: Punkt[]) {
  const xs = punkte.map((p) => p.x);
  const ys = punkte.map((p) => p.y);
  return {
    links: Math.min(...xs),
    rechts: Math.max(...xs),
    oben: Math.min(...ys),
    unten: Math.max(...ys),
  };
}

/**
 * Sucht die Farbe, in der die Wände gezeichnet sind.
 *
 * Verlassen wird sich nicht auf einen festen Wert – jedes Büro zeichnet
 * anders. Gesucht wird die Farbe, deren Flächen zusammen den größten Teil des
 * Blattes umspannen **und** dabei überwiegend Ringe sind. Beides zusammen
 * trifft nur auf Wände zu: Möbel sind massiv, und Schraffuren decken zwar
 * viel ab, sind aber nicht ringförmig.
 */
export function findeWandfarbe(flaechen: Fuellflaeche[]): Farbe | undefined {
  const nachFarbe = new Map<string, { farbe: Farbe; ringflaeche: number; anzahl: number }>();

  for (const f of flaechen) {
    if (f.punkte.length < 3) continue;
    const r = rahmenVon(f.punkte);
    const kasten = (r.rechts - r.links) * (r.unten - r.oben);
    if (kasten <= 0) continue;
    const grad = polygonflaeche(f.punkte) / kasten;
    // Nur Ringe zählen für die Bewertung.
    if (grad > RING_GRENZE) continue;

    const schluessel = f.fuellung.map((v) => Math.round(v * 100)).join(',');
    const eintrag = nachFarbe.get(schluessel) ?? { farbe: f.fuellung, ringflaeche: 0, anzahl: 0 };
    eintrag.ringflaeche += kasten;
    eintrag.anzahl += 1;
    nachFarbe.set(schluessel, eintrag);
  }

  let beste: { farbe: Farbe; ringflaeche: number; anzahl: number } | undefined;
  for (const eintrag of nachFarbe.values()) {
    // Eine einzelne Fläche ist noch kein Gebäude.
    if (eintrag.anzahl < 3) continue;
    if (!beste || eintrag.ringflaeche > beste.ringflaeche) beste = eintrag;
  }
  return beste?.farbe;
}

/** Zwei Farben sind gleich, wenn sie sich in keinem Kanal merklich unterscheiden. */
export function farbeGleich(a: Farbe, b: Farbe, toleranz = 0.03): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) <= toleranz);
}

/**
 * Teilt die Flächen einer Farbe in Wände, Stützen und Fremdkörper ein.
 *
 * `mmJePunkt` rechnet die PDF-Koordinaten in Millimeter um; `punkte` sind
 * bereits in PDF-Punkten.
 */
export function teileEin(flaechen: Fuellflaeche[], mmJePunkt: number): Wandkoerper[] {
  const koerper: Wandkoerper[] = [];

  // Wie oft dieselbe Groesse vorkommt.
  //
  // Das ist das einzige verlässliche Merkmal, um ein Möbel von einer Stütze
  // zu unterscheiden, wenn beide massiv und ungefähr gleich groß sind: Im
  // Plan Dörnhagen steht ein Obst-und-Gemüse-Tisch von 891 × 931 mm neben
  // einer echten Stütze von 925 × 960 mm. Geometrisch sind die nicht zu
  // trennen – aber Möbel stehen in Serie, Stützen nicht. Fünf Tische zu
  // 1244 × 790 sind fünf Tische; fünf gleiche Stützen wären ein Zufall.
  const wieOft = new Map<string, number>();
  const groessenschluessel = (b: number, h: number) => {
    const [klein, gross] = b <= h ? [b, h] : [h, b];
    return `${Math.round(klein / 50)}x${Math.round(gross / 50)}`;
  };
  for (const f of flaechen) {
    if (f.punkte.length < 3) continue;
    const r = rahmenVon(f.punkte);
    const b = (r.rechts - r.links) * mmJePunkt;
    const h = (r.unten - r.oben) * mmJePunkt;
    const s = groessenschluessel(b, h);
    wieOft.set(s, (wieOft.get(s) ?? 0) + 1);
  }

  for (const f of flaechen) {
    if (f.punkte.length < 3) continue;
    const r = rahmenVon(f.punkte);
    const breiteMm = (r.rechts - r.links) * mmJePunkt;
    const hoeheMm = (r.unten - r.oben) * mmJePunkt;
    const kastenMm2 = breiteMm * hoeheMm;
    if (kastenMm2 <= 0) continue;
    const flaecheMm2 = polygonflaeche(f.punkte) * mmJePunkt * mmJePunkt;
    const fuellgrad = flaecheMm2 / kastenMm2;

    let art: Koerperart;
    let sicherheit: Sicherheit;
    let begruendung: string;

    if (breiteMm < WINZIG_MM && hoeheMm < WINZIG_MM) {
      // Bruchstücke aus den Schnittzeichnungen und Legenden.
      art = 'fremd';
      sicherheit = 'sicher';
      begruendung = `Nur ${Math.round(breiteMm)} × ${Math.round(hoeheMm)} mm – zu klein für ein Bauteil`;
    } else if (fuellgrad <= RING_GRENZE) {
      // Ein dünner Umriss um viel Luft: So sieht ein Wandzug aus.
      art = 'wand';
      sicherheit = fuellgrad < 0.2 ? 'sicher' : 'wahrscheinlich';
      begruendung = `Ringförmig, füllt nur ${Math.round(fuellgrad * 100)} % der Bounding-Box`;
    } else if (breiteMm <= STUETZE_MAX_MM && hoeheMm <= STUETZE_MAX_MM) {
      const gleiche = wieOft.get(groessenschluessel(breiteMm, hoeheMm)) ?? 1;
      const gross = Math.max(breiteMm, hoeheMm) > SERIEN_GRENZE_MM;
      if (gleiche >= 2 && gross) {
        art = 'fremd';
        sicherheit = 'wahrscheinlich';
        begruendung = `${gleiche}× dieselbe Größe ${Math.round(breiteMm)} × ${Math.round(hoeheMm)} mm – Möbel stehen in Serie, Stützen nicht`;
      } else {
        art = 'stuetze';
        sicherheit = gross ? 'wahrscheinlich' : 'sicher';
        begruendung = `Massiv und klein (${Math.round(breiteMm)} × ${Math.round(hoeheMm)} mm) – Stütze oder Pfeiler`;
      }
    } else {
      // Massiv und groß: In der Wandfarbe gezeichnet, aber kein Bauteil.
      art = 'fremd';
      sicherheit = 'wahrscheinlich';
      begruendung = `Massiver Block ${Math.round(breiteMm)} × ${Math.round(hoeheMm)} mm – vermutlich ein Möbel in der Wandfarbe`;
    }

    koerper.push({
      punkte: f.punkte,
      art,
      breiteMm,
      hoeheMm,
      flaecheMm2,
      fuellgrad,
      sicherheit,
      begruendung,
    });
  }

  return koerper;
}

/**
 * Wirft weg, was weit außerhalb des Gebäudes liegt.
 *
 * Ein Plan trägt unter dem Grundriss Schnittzeichnungen und neben ihm eine
 * Legende. Was dort in der Wandfarbe steht, gehört nicht zum Gebäude. Der
 * Bezugspunkt sind die Wandkörper selbst: Wo die meisten liegen, steht das
 * Gebäude.
 */
export function nurImGebaeude(koerper: Wandkoerper[], luftMm = 2000, mmJePunkt = 1): Wandkoerper[] {
  const waende = koerper.filter((k) => k.art === 'wand');
  if (waende.length === 0) return koerper;

  const alle = waende.flatMap((k) => k.punkte);
  const r = rahmenVon(alle);
  const luft = luftMm / mmJePunkt;

  return koerper.filter((k) => {
    const eigen = rahmenVon(k.punkte);
    return (
      eigen.links >= r.links - luft &&
      eigen.rechts <= r.rechts + luft &&
      eigen.oben >= r.oben - luft &&
      eigen.unten <= r.unten + luft
    );
  });
}

/**
 * Der Rahmen um alle baulichen Körper, als Grundfläche.
 *
 * Bewusst ein Rechteck und nicht die verschmolzene Außenkante. Der Versuch,
 * die Wandkörper zu vereinigen, ist an der Wirklichkeit gescheitert: Ein
 * CAD-Plan zeichnet jeden Wandzug als eigenes Polygon, und die stoßen
 * kantengenau aneinander, ohne sich zu überlappen. Eine strenge Vereinigung
 * liefert deshalb siebzehn Einzelteile statt einer Umrisslinie – um sie
 * wirklich zu verschmelzen, müsste man jedes Polygon vorher um ein paar
 * Millimeter aufblasen, und das ist ein eigenes Problem.
 *
 * Der Rahmen ist ehrlich ungenau und in zwei Zügen zurechtgezogen. Die
 * wirkliche Form steht ohnehin im Plan: Die Wandkörper werden mitgezeichnet,
 * mit ihrer echten Stärke.
 *
 * Zurück kommen Zentimeter – so rechnet die Anwendung.
 */
export function rahmenAlsUmriss(koerper: Wandkoerper[], mmJePunkt: number): Punkt[] {
  const baulich = koerper.filter((k) => k.art !== 'fremd');
  if (baulich.length === 0) return [];
  const jeCm = mmJePunkt / 10;
  const r = rahmenVon(baulich.flatMap((k) => k.punkte));
  return [
    { x: r.links * jeCm, y: r.oben * jeCm },
    { x: r.rechts * jeCm, y: r.oben * jeCm },
    { x: r.rechts * jeCm, y: r.unten * jeCm },
    { x: r.links * jeCm, y: r.unten * jeCm },
  ];
}

/** Rechnet ein Polygon von PDF-Punkten in Zentimeter um. */
export function inZentimeter(punkte: Punkt[], mmJePunkt: number): Punkt[] {
  const jeCm = mmJePunkt / 10;
  return punkte.map((p) => ({ x: p.x * jeCm, y: p.y * jeCm }));
}

/**
 * Der Mittelpunkt eines Körpers – dort wird eine Stütze gesetzt.
 */
export function mittelpunkt(punkte: Punkt[]): Punkt {
  const r = rahmenVon(punkte);
  return { x: (r.links + r.rechts) / 2, y: (r.oben + r.unten) / 2 };
}
