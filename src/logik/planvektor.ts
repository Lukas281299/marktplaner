import { zeichneElement } from '../komponenten/zeichenflaeche/ElementSymbol';
import { Leinwandmitschreiber, type Zeichenschritt } from './leinwandmitschreiber';
import { Pfadschreiber } from './pfadschreiber';
import { kanten, kantenVersatz, rahmen } from './polygon';
import { formatiereLaenge } from './masse';
import { SCHRIFT_FLAECHE, SCHRIFT_MASS } from './beschriftung';
import type { Massinheit, PlanElement, Projekt, Punkt } from '../typen/modell';
import type { Rahmen } from './geometrie';

/**
 * Der ganze Plan als Vektor – Formen und Texte in Zentimetern des Marktes.
 *
 * **Warum das die Mühe wert ist.** Bisher waren PDF und SVG ein eingebettetes
 * Rasterbild: so scharf wie der Bildschirm im Augenblick des Exports, und
 * keinen Punkt schärfer. Auf einem A1-Plan sieht man das sofort – die Maße an
 * den Regalen werden matschig, und wer hineinzoomt, sieht Bildpunkte statt
 * Linien. Ein Plan, den ein Ladenbauer ausdruckt und an die Wand hängt, muss
 * bei jeder Größe scharf sein.
 *
 * **Wo die Zeichnungen herkommen.** Die Möbel zeichnet weiterhin
 * `zeichneForm` – dieselbe Funktion wie auf dem Bildschirm, nur in einen
 * `Pfadschreiber` statt auf eine Leinwand. Es gibt also keine zweite Fassung
 * der Symbole, die veralten könnte. Die übrigen Ebenen sind Polygone und
 * Strecken; die stehen hier, weil sie in den Zeichenkomponenten mit
 * React-Bausteinen gebaut sind und sich nicht mitschreiben lassen.
 *
 * **Die Maßeinheit ist der Zentimeter des Marktes**, nicht der Bildpunkt.
 * Damit ist die Ausgabe unabhängig davon, wie weit gerade hineingezoomt war –
 * genau der Fehler, den das Rasterbild hatte.
 */

/** Eine Fläche oder ein Linienzug. */
export interface Vektorform {
  /** Der Pfad, in Zentimetern des Marktes. */
  d: string;
  fuellung?: string;
  linie?: string;
  /** Strichbreite in **Millimetern auf dem Papier** – nicht im Markt. */
  strichMm?: number;
  /** Strichbreite in Zentimetern des Marktes – für echte Bauteile wie Wände. */
  strichCm?: number;
  deckkraft?: number;
  /** Beschneidet die Form auf den Gebäudeumriss. */
  beschnitten?: boolean;
  gestrichelt?: boolean;
  /**
   * Eine Umformung, die vor dem Zeichnen gilt – „an diese Stelle, so gedreht".
   *
   * Sie steht am Pfad statt in jeder Koordinate: Ein Regal wird einmal in
   * seinem eigenen System gezeichnet und dann als Ganzes gesetzt. So bleibt
   * der Pfad derselbe wie auf dem Bildschirm, und man kann beide vergleichen.
   */
  umformung?: string;
}

/** Ein Text im Plan. */
export interface Vektortext {
  text: string;
  x: number;
  y: number;
  /** Schriftgröße in Zentimetern des Marktes. */
  groesse: number;
  drehung?: number;
  farbe?: string;
  /** Waagerechte Ausrichtung um den Punkt herum. */
  anker?: 'mitte' | 'anfang';
  /** Rechtsbündig – der Punkt ist dann das Ende der Zeile. */
  rechtsbuendig?: boolean;
  /**
   * Woran die Höhe hängt.
   *
   * Die Zeichnung setzt ihre Feldnotizen mit `textBaseline: 'top'` – der
   * Punkt ist dann die **Oberkante** der Zeile, nicht ihre Mitte. Wer das
   * übergeht, schiebt jede Feldbeschriftung um eine halbe Zeile nach oben.
   */
  grundlinie?: 'top' | 'middle' | 'alphabetic';
  fett?: boolean;
  /** Dieselbe Umformung wie an den Formen des Möbels. */
  umformung?: string;
}

export interface Planvektor {
  /** Die Umgrenzung von allem, in Zentimetern des Marktes. */
  rahmen: Rahmen;
  formen: Vektorform[];
  texte: Vektortext[];
  /** Der Umriss des Gebäudes – zum Beschneiden der Außenwand. */
  umriss: Punkt[];
}

/** Ein geschlossener Linienzug als Pfad. */
function polygonPfad(punkte: Punkt[]): string {
  if (punkte.length < 2) return '';
  const s = new Pfadschreiber();
  s.moveTo(punkte[0].x, punkte[0].y);
  for (const p of punkte.slice(1)) s.lineTo(p.x, p.y);
  s.closePath();
  return s.d;
}

/** Eine Strecke als Pfad. */
function streckePfad(von: Punkt, bis: Punkt): string {
  const s = new Pfadschreiber();
  s.moveTo(von.x, von.y);
  s.lineTo(bis.x, bis.y);
  return s.d;
}

/**
 * Die Umgrenzung eines gedrehten Möbels.
 *
 * Ein Regal ist an seiner Mitte aufgehängt und um `drehung` gedreht. Für den
 * Rahmen zählen die vier Ecken nach der Drehung – sonst fiele ein schräg
 * stehender Zug beim Zuschneiden des Blattes halb heraus.
 */
function elementecken(el: PlanElement): Punkt[] {
  const w = ((el.drehung ?? 0) * Math.PI) / 180;
  const cos = Math.cos(w);
  const sin = Math.sin(w);
  const hb = el.breite / 2;
  const ht = el.tiefe / 2;
  return [
    [-hb, -ht],
    [hb, -ht],
    [hb, ht],
    [-hb, ht],
  ].map(([x, y]) => ({ x: el.x + x * cos - y * sin, y: el.y + x * sin + y * cos }));
}

/** Alles zusammenfassen, was der Plan an Punkten hat. */
function gesamtrahmen(punkte: Punkt[]): Rahmen {
  if (punkte.length === 0) return { links: 0, oben: 0, rechts: 100, unten: 100 };
  return {
    links: Math.min(...punkte.map((p) => p.x)),
    oben: Math.min(...punkte.map((p) => p.y)),
    rechts: Math.max(...punkte.map((p) => p.x)),
    unten: Math.max(...punkte.map((p) => p.y)),
  };
}

/**
 * Alles, was ein Möbel zeichnet – Schritt für Schritt mitgeschrieben.
 *
 * Nicht nur der Umriss: Auch die Paletten unter den Böden, die Schwenkbögen
 * der Türen, der Ausschwenkweg der Eingangsbügel, die hellen Stufenkanten und
 * die Beschriftung der einzelnen Felder. Sie alle entstehen in eigenen
 * Durchgängen mit eigenen Farben, und genau die nimmt der
 * `Leinwandmitschreiber` auf.
 *
 * Der Ersatzzoom ist der Kniff: Die Zeichnung entscheidet an ihm zweierlei –
 * wie dick ein Strich wird (`1 / zoom`) und ob eine Beschriftung überhaupt
 * noch lesbar wäre (`planHoehe * zoom >= 5`). Für die Ausgabe zählt nur das
 * zweite; die Strichbreiten werden hinterher aus dem Verhältnis
 * zurückgerechnet. Deshalb steht hier der Wert, der zum **Druck** passt.
 */
export function moebelschritte(el: PlanElement, ersatzzoom: number): Zeichenschritt[] {
  const mit = new Leinwandmitschreiber({
    zoom: ersatzzoom,
    // Ein Textfeld hat keinen Umriss – im Plan steht dort nur der Text.
    fuellung: el.form === 'textfeld' ? undefined : el.farbe,
    linie: el.form === 'textfeld' ? undefined : MOEBELLINIE,
  });
  const ctx = mit as never;

  zeichneElement(ctx, el, el.breite, el.tiefe, ersatzzoom, () => mit.fillStrokeShape());
  return mit.schritte;
}

/** Die Umformung, die ein Möbel an seinen Platz im Markt bringt. */
export function moebelumformung(el: PlanElement): string {
  const drehung = el.drehung ?? 0;
  const schieben = `translate(${runde(el.x - el.breite / 2)} ${runde(el.y - el.tiefe / 2)})`;
  if (!drehung) return schieben;
  // Gedreht wird um die Mitte – so wie das Möbel auf dem Bildschirm.
  return `${schieben} rotate(${runde(drehung)} ${runde(el.breite / 2)} ${runde(el.tiefe / 2)})`;
}

function runde(wert: number): number {
  return Math.round(wert * 10000) / 10000;
}

/** Die Linienfarbe eines Möbels – dieselbe wie auf dem Bildschirm. */
const MOEBELLINIE = 'rgba(30,40,52,0.55)';

export interface Vektoroptionen {
  einheit?: Massinheit;
  /**
   * Der Ersatzzoom für die Möbelzeichnung – siehe `moebelschritte`.
   *
   * Er entscheidet, welche Beschriftungen mitkommen. Der Vorgabewert
   * entspricht ungefähr 1:100 auf Papier.
   */
  ersatzzoom?: number;
  /** Ob die Maße an den Gebäudekanten mitgeschrieben werden. */
  gebaeudemasse?: boolean;
  /** Ob die Beschriftungen der Möbel mitkommen. */
  beschriftungen?: boolean;
}

/**
 * Baut den ganzen Plan als Vektor.
 *
 * Die Reihenfolge ist die des Bildschirms: Gebäude, Räume, Verkaufsflächen,
 * Wände, dann die Möbel, zuletzt die Maßlinien. Wer sie ändert, ändert, was
 * was verdeckt.
 */
export function planAlsVektor(projekt: Projekt, optionen: Vektoroptionen = {}): Planvektor {
  const einheit = optionen.einheit ?? projekt.einstellungen?.anzeigeEinheit ?? 'm';
  const ersatzzoom = optionen.ersatzzoom ?? 0.33;
  const formen: Vektorform[] = [];
  const texte: Vektortext[] = [];
  const punkte: Punkt[] = [];

  const umriss = projekt.grundflaeche?.umriss ?? [];

  // ------------------------------------------------------------- Gebäude
  if (umriss.length >= 3) {
    punkte.push(...umriss);
    formen.push({ d: polygonPfad(umriss), fuellung: '#fbfbfa' });

    // Eingelesene Wandkörper ersetzen die gezeichnete Außenwand.
    const koerper = projekt.grundflaeche.wandkoerper ?? [];
    for (const k of koerper) {
      if (k.length >= 3) formen.push({ d: polygonPfad(k), fuellung: '#3c4650', linie: '#2b3542', strichMm: 0.2 });
    }

    // Die Außenwand liegt **innerhalb** des Umrisses. Auf dem Bildschirm
    // entsteht das über eine doppelt so dicke Linie, die nach außen
    // weggeschnitten wird – hier genauso, über eine Beschneidung.
    const staerke = projekt.grundflaeche.wandstaerke ?? 30;
    if (staerke > 0) {
      formen.push({
        d: polygonPfad(umriss),
        linie: '#3c4650',
        strichCm: staerke * 2,
        beschnitten: true,
        deckkraft: koerper.length > 0 ? 0.25 : 1,
      });
    }

    if (optionen.gebaeudemasse !== false) {
      for (const kante of kanten(umriss)) {
        // Ganz kurze Kanten würden sich nur gegenseitig überschreiben.
        if (kante.laenge < 60) continue;
        // **Neben** der Wand, nicht darauf: `kantenVersatz` rückt den Text
        // nach außen, dieselbe Funktion wie auf dem Bildschirm. Auf der Wand
        // stünde die Zahl auf dem dunklen Band und wäre unlesbar.
        const stelle = kantenVersatz(kante, SCHRIFT_MASS * 1.1, umriss);
        const winkel = (Math.atan2(kante.bis.y - kante.von.y, kante.bis.x - kante.von.x) * 180) / Math.PI;
        texte.push({
          text: formatiereLaenge(kante.laenge, einheit),
          x: stelle.x,
          y: stelle.y,
          groesse: SCHRIFT_MASS,
          drehung: lesbarerWinkel(winkel),
          farbe: '#5d6874',
          anker: 'mitte',
        });
      }
    }
  }

  // -------------------------------------------------------------- Räume
  for (const raum of projekt.raeume ?? []) {
    if (!raum.umriss || raum.umriss.length < 3) continue;
    punkte.push(...raum.umriss);
    formen.push({ d: polygonPfad(raum.umriss), fuellung: raum.farbe, deckkraft: 0.4 });
    if (raum.wandstaerke > 0) {
      formen.push({ d: polygonPfad(raum.umriss), linie: '#66707c', strichCm: raum.wandstaerke * 2 });
    }
    if (raum.beschriftungSichtbar !== false && raum.name) {
      const r = rahmen(raum.umriss);
      texte.push({
        text: raum.name,
        x: (r.links + r.rechts) / 2,
        y: (r.oben + r.unten) / 2,
        groesse: SCHRIFT_FLAECHE,
        farbe: '#42505f',
        anker: 'mitte',
      });
    }
  }

  // ----------------------------------------------------- Verkaufsflächen
  for (const flaeche of projekt.verkaufsflaechen ?? []) {
    if (!flaeche.umriss || flaeche.umriss.length < 3) continue;
    punkte.push(...flaeche.umriss);
    formen.push({ d: polygonPfad(flaeche.umriss), fuellung: flaeche.farbe, deckkraft: 0.1 });
    formen.push({ d: polygonPfad(flaeche.umriss), linie: flaeche.farbe, strichMm: 0.35, deckkraft: 0.6 });
  }

  // -------------------------------------------------------------- Wände
  for (const wand of projekt.waende ?? []) {
    if (wand.umriss && wand.umriss.length >= 3) {
      punkte.push(...wand.umriss);
      formen.push({ d: polygonPfad(wand.umriss), fuellung: '#66707c', linie: '#66707c', strichMm: 0.2 });
    } else if (wand.von && wand.bis) {
      punkte.push(wand.von, wand.bis);
      formen.push({
        d: streckePfad(wand.von, wand.bis),
        linie: '#66707c',
        strichCm: wand.staerke,
      });
    }
  }

  // -------------------------------------------------------------- Möbel
  const sichtbar = new Set(
    (projekt.ebenen ?? []).filter((e) => e.sichtbar !== false).map((e) => e.id),
  );
  const geordnet = [...(projekt.elemente ?? [])].sort(
    (a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0),
  );
  for (const el of geordnet) {
    if (el.ebeneId && !sichtbar.has(el.ebeneId)) continue;
    punkte.push(...elementecken(el));

    // Jeder Schritt des Möbels wird eine eigene Form oder ein eigener Text.
    // Die Umformung steht an allen dieselbe: Das Möbel wird einmal in seinem
    // eigenen System gezeichnet und dann als Ganzes an seinen Platz gesetzt.
    const umformung = moebelumformung(el);
    for (const schritt of moebelschritte(el, ersatzzoom)) {
      if (schritt.art === 'text') {
        texte.push({
          text: schritt.text ?? '',
          x: schritt.x ?? 0,
          y: schritt.y ?? 0,
          groesse: schritt.schrift ?? 20,
          farbe: schritt.farbe,
          anker: schritt.ausrichtung === 'center' ? 'mitte' : 'anfang',
          drehung: schritt.drehung,
          grundlinie: schritt.grundlinie,
          rechtsbuendig: schritt.ausrichtung === 'right',
          fett: schritt.fett,
          umformung,
        });
        continue;
      }
      formen.push({
        d: schritt.d ?? '',
        fuellung: schritt.art === 'flaeche' ? schritt.farbe : undefined,
        linie: schritt.art === 'strich' ? schritt.farbe : undefined,
        strichMm: schritt.art === 'strich' ? 0.25 * (schritt.breitenfaktor ?? 1) : undefined,
        umformung,
      });
    }

    if (optionen.beschriftungen !== false && el.beschriftungSichtbar !== false) {
      const beschriftung = (el.beschriftung || el.name || '').trim();
      if (beschriftung) {
        texte.push({
          text: beschriftung,
          x: el.x,
          y: el.y,
          groesse: el.schriftgroesse || 12,
          // Schrift quer zum Möbel wäre unlesbar; deshalb dreht sie mit,
          // aber nie über Kopf.
          drehung: lesbarerWinkel(el.drehung ?? 0),
          farbe: '#26313d',
          anker: 'mitte',
        });
      }
    }
  }

  // ---------------------------------------------------------- Öffnungen
  //
  // Eine Tür oder ein Durchgang ist im Grundriss eine Lücke in der Wand.
  // Gezeichnet wird sie als helles Rechteck mit dünnem Rand – das reicht, um
  // zu sehen, wo man hineinkommt. Der Schwenkbogen des Türblatts fehlt noch;
  // er wird auf dem Bildschirm in einem eigenen Durchgang gemalt.
  for (const oeffnung of projekt.oeffnungen ?? []) {
    const b = oeffnung.breite;
    const t = Math.max(oeffnung.tiefe, 4);
    const w = ((oeffnung.drehung ?? 0) * Math.PI) / 180;
    const cos = Math.cos(w);
    const sin = Math.sin(w);
    const ecken = [
      [-b / 2, -t / 2],
      [b / 2, -t / 2],
      [b / 2, t / 2],
      [-b / 2, t / 2],
    ].map(([x, y]) => ({ x: oeffnung.x + x * cos - y * sin, y: oeffnung.y + x * sin + y * cos }));
    punkte.push(...ecken);
    formen.push({ d: polygonPfad(ecken), fuellung: '#ffffff', linie: '#66707c', strichMm: 0.2 });
  }

  // ---------------------------------------------------------- Maßlinien
  for (const linie of projekt.masslinien ?? []) {
    if (!linie.von || !linie.bis) continue;
    punkte.push(linie.von, linie.bis);
    formen.push({ d: streckePfad(linie.von, linie.bis), linie: '#42505f', strichMm: 0.25 });
    const mitte = { x: (linie.von.x + linie.bis.x) / 2, y: (linie.von.y + linie.bis.y) / 2 };
    const laenge = Math.hypot(linie.bis.x - linie.von.x, linie.bis.y - linie.von.y);
    const winkel = (Math.atan2(linie.bis.y - linie.von.y, linie.bis.x - linie.von.x) * 180) / Math.PI;
    texte.push({
      text: linie.text || formatiereLaenge(laenge, einheit),
      x: mitte.x,
      y: mitte.y,
      groesse: SCHRIFT_MASS,
      drehung: lesbarerWinkel(winkel),
      farbe: '#42505f',
      anker: 'mitte',
    });
  }

  return { rahmen: gesamtrahmen(punkte), formen, texte, umriss };
}

/** Ein Winkel, bei dem Schrift nie auf dem Kopf steht. */
export function lesbarerWinkel(grad: number): number {
  const w = ((grad % 360) + 360) % 360;
  return w > 90 && w <= 270 ? w - 180 : w;
}
