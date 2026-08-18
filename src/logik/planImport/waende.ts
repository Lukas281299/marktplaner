import type { Punkt } from '../../typen/modell';
import type { Sicherheit } from './typen';

/**
 * Wände aus den Linien eines Plan-PDFs.
 *
 * Anders als bei den Regalen hilft hier kein Text: Eine Wand trägt keine
 * Beschriftung. Sie muss aus der Zeichnung selbst kommen – und die besteht
 * im Plan Fuldabrück aus 160.000 einzelnen Strecken, von denen die meisten
 * Schraffuren, Etagenkanten und Möbelumrisse sind.
 *
 * Was eine Wand von alldem unterscheidet, ist ihre Länge. Ein Regalfeld ist
 * 1,25 m breit, eine Etagenkante 60 cm, eine Schraffurlinie noch kürzer.
 * Eine Wand läuft über mehrere Meter. Deshalb wird nach langen Strecken
 * gesucht, und kurze bleiben liegen.
 *
 * Das ist bewusst grob. Der Anspruch ist nicht, den Grundriss fertig zu
 * liefern, sondern die langen Linien als Vorschlag hinzulegen, damit man
 * nicht jede Wand von Hand nachzieht. Was zu viel ist, wird gelöscht – das
 * geht schneller, als es zu zeichnen.
 */

export interface Strecke {
  von: Punkt;
  bis: Punkt;
}

export interface Wandvorschlag extends Strecke {
  laengeMm: number;
  sicherheit: Sicherheit;
}

/** Länge einer Strecke in Punkten. */
function laenge(s: Strecke): number {
  return Math.hypot(s.bis.x - s.von.x, s.bis.y - s.von.y);
}

/** Richtung einer Strecke als Gerade, 0 bis unter 180 Grad. */
export function geradenwinkel(s: Strecke): number {
  const grad = (Math.atan2(s.bis.y - s.von.y, s.bis.x - s.von.x) * 180) / Math.PI;
  return ((grad % 180) + 180) % 180;
}

/**
 * Fasst Strecken zusammen, die auf derselben Geraden liegen und sich
 * berühren oder überlappen.
 *
 * Ein CAD-Programm zerlegt eine durchgehende Wand gern in viele kurze
 * Stücke – an jeder Tür, an jedem Anschluss. Ohne dieses Zusammenfassen
 * fiele eine zwanzig Meter lange Wand durch das Längenraster, weil sie als
 * dreißig Einzelstücke vorliegt.
 */
export function fasseZusammen(strecken: Strecke[], toleranzPt = 1.2): Strecke[] {
  interface Gerade {
    winkel: number;
    /** Abstand der Geraden vom Ursprung. */
    lot: number;
    stuecke: { von: number; bis: number }[];
  }

  const geraden: Gerade[] = [];

  for (const s of strecken) {
    if (laenge(s) < 0.01) continue;
    const winkel = geradenwinkel(s);
    const bogen = (winkel * Math.PI) / 180;
    // Lage entlang und quer zur Geraden.
    const laengs = (p: Punkt) => p.x * Math.cos(bogen) + p.y * Math.sin(bogen);
    const quer = (p: Punkt) => -p.x * Math.sin(bogen) + p.y * Math.cos(bogen);
    const lot = quer(s.von);

    let ziel = geraden.find(
      (g) =>
        Math.abs(g.winkel - winkel) < 1.5 ||
        Math.abs(Math.abs(g.winkel - winkel) - 180) < 1.5,
    );
    if (ziel && Math.abs(ziel.lot - lot) > toleranzPt) ziel = undefined;
    if (!ziel) {
      ziel = { winkel, lot, stuecke: [] };
      geraden.push(ziel);
    }

    const a = laengs(s.von);
    const b = laengs(s.bis);
    ziel.stuecke.push({ von: Math.min(a, b), bis: Math.max(a, b) });
  }

  const zusammen: Strecke[] = [];
  for (const g of geraden) {
    g.stuecke.sort((x, y) => x.von - y.von);
    const bogen = (g.winkel * Math.PI) / 180;
    const zuPunkt = (l: number): Punkt => ({
      x: l * Math.cos(bogen) - g.lot * Math.sin(bogen),
      y: l * Math.sin(bogen) + g.lot * Math.cos(bogen),
    });

    let offen = g.stuecke[0];
    for (let i = 1; i < g.stuecke.length; i++) {
      const naechstes = g.stuecke[i];
      // Kleine Lücken überbrücken – dort sitzt im Plan eine Tür.
      if (naechstes.von <= offen.bis + toleranzPt * 3) {
        offen = { von: offen.von, bis: Math.max(offen.bis, naechstes.bis) };
      } else {
        zusammen.push({ von: zuPunkt(offen.von), bis: zuPunkt(offen.bis) });
        offen = naechstes;
      }
    }
    if (offen) zusammen.push({ von: zuPunkt(offen.von), bis: zuPunkt(offen.bis) });
  }

  return zusammen;
}

/**
 * Sucht in allen Strecken die, die als Wand taugen.
 *
 * `mindestLaengeMm` ist der einzige Regler, der wirklich zählt. Zu klein,
 * und der halbe Plan wird zur Wand; zu groß, und die Trennwände der
 * Nebenräume fehlen. Drei Meter treffen die Mitte: länger als jedes
 * Regalfeld, kürzer als jede echte Wand.
 */
export interface Bereich {
  links: number;
  oben: number;
  rechts: number;
  unten: number;
}

export function findeWaende(
  strecken: Strecke[],
  mmJePunkt: number,
  mindestLaengeMm = 3000,
  hoechstens = 80,
  bereich?: Bereich,
): Wandvorschlag[] {
  // Erst den Blattrand loswerden.
  //
  // Ein Plan besteht nicht nur aus dem Gebäude: Zeichnungsrahmen,
  // Schriftfeld und Legende bringen Dutzende kerzengerade Linien über die
  // volle Blattbreite mit. Ohne diesen Schnitt sind das die längsten
  // Linien überhaupt, und die Wandsuche liefert ausschließlich sie –
  // achtzig Stück zu 84,1 Metern, der Breite eines A1-Blattes bei 1:100.
  //
  // Der Bereich kommt von den erkannten Regalen: Das Gebäude muss seine
  // Einrichtung enthalten. Das ist ein Schluss aus dem Plan selbst und
  // keine geratene Zahl.
  const drin = (p: Punkt) =>
    !bereich ||
    (p.x >= bereich.links && p.x <= bereich.rechts && p.y >= bereich.oben && p.y <= bereich.unten);

  const zusammen = fasseZusammen(strecken.filter((s) => drin(s.von) && drin(s.bis)));

  const vorschlaege: Wandvorschlag[] = [];
  for (const s of zusammen) {
    const laengeMm = laenge(s) * mmJePunkt;
    if (laengeMm < mindestLaengeMm) continue;
    // Sehr lange Linien sind fast sicher Wände, mittlere könnten auch
    // Möbelzüge oder Maßlinien sein.
    const sicherheit: Sicherheit =
      laengeMm > 8000 ? 'sicher' : laengeMm > 5000 ? 'wahrscheinlich' : 'geraten';
    vorschlaege.push({ ...s, laengeMm, sicherheit });
  }

  // Die längsten zuerst, und dann abschneiden. Eine Obergrenze ist nötig:
  // Ein Plan mit tausend Wandvorschlägen wäre unbrauchbarer als einer ohne.
  vorschlaege.sort((a, b) => b.laengeMm - a.laengeMm);
  return vorschlaege.slice(0, hoechstens);
}

/**
 * Der äußere Rahmen aller Wände – als Vorschlag für die Grundfläche.
 *
 * Bewusst nur ein Rechteck und kein nachgezeichneter Umriss: Aus Strecken
 * ein geschlossenes Polygon zu bauen, das auch bei Lücken und Überständen
 * stimmt, ist eine eigene Wissenschaft. Ein Rechteck ist ehrlich falsch und
 * in zwei Zügen zurechtgezogen; ein halb geratener Umriss sähe richtig aus
 * und wäre es nicht.
 */
export function umschliessendesRechteck(waende: Wandvorschlag[]): Punkt[] | undefined {
  if (waende.length === 0) return undefined;
  let links = Infinity;
  let oben = Infinity;
  let rechts = -Infinity;
  let unten = -Infinity;
  for (const w of waende) {
    for (const p of [w.von, w.bis]) {
      links = Math.min(links, p.x);
      rechts = Math.max(rechts, p.x);
      oben = Math.min(oben, p.y);
      unten = Math.max(unten, p.y);
    }
  }
  if (!Number.isFinite(links) || rechts - links < 1 || unten - oben < 1) return undefined;
  return [
    { x: links, y: oben },
    { x: rechts, y: oben },
    { x: rechts, y: unten },
    { x: links, y: unten },
  ];
}
