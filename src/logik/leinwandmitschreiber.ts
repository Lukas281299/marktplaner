import { Pfadschreiber } from './pfadschreiber';
import { textbreite } from './pdfVektor';

/**
 * Ein Mitschreiber für eine **ganze** Zeichnung, nicht nur für einen Pfad.
 *
 * Der `Pfadschreiber` konnte die Umrisse der Möbel aufnehmen. Was drumherum
 * passiert, konnte er nicht: die Paletten unter den Böden, die Schwenkbögen
 * der Türen, der Ausschwenkweg der Eingangsbügel, die hellen Stufenkanten und
 * die Beschriftung der einzelnen Felder. Diese Dinge werden in eigenen
 * Durchgängen gemalt, mit eigenen Farben und Strichbreiten – und genau das
 * bildet dieses Objekt nach.
 *
 * Es gibt sich als Zeichenleinwand aus und merkt sich, **was** gemalt wurde
 * und **womit**: `save`/`restore` für den Zustand, `setAttr` für Farbe,
 * Strichbreite und Schrift, `fill`/`stroke`/`fillStrokeShape` als die drei
 * Zeitpunkte, an denen etwas wirklich aufs Blatt kommt. Heraus kommt eine
 * Liste von Schritten, die SVG und PDF gleichermaßen ausgeben können.
 *
 * **Warum das der richtige Weg ist:** Es gibt weiterhin genau eine Quelle je
 * Symbol. Wer ein Möbel ändert oder ein neues baut, ändert nichts an der
 * Ausgabe – sie folgt von selbst.
 *
 * **Die Strichbreiten werden umgerechnet, nicht übernommen.** Die Zeichnung
 * schreibt sie als `1 / zoom`, `1.1 / zoom`, `1.6 / zoom` – also relativ zur
 * Bildschirmauflösung. Auf Papier ist das sinnlos. Deshalb wird der Faktor
 * zurückgerechnet (`breite × zoom`) und mit der gewünschten Druckbreite
 * multipliziert: Die Verhältnisse bleiben, die absoluten Werte stimmen.
 */

/** Ein einzelner Schritt: eine Fläche, ein Strich oder ein Text. */
export interface Zeichenschritt {
  art: 'flaeche' | 'strich' | 'text';
  /** Der Pfad, bei Flächen und Strichen. */
  d?: string;
  /** Die Farbe – Füllfarbe bei Flächen und Text, Strichfarbe bei Strichen. */
  farbe: string;
  /**
   * Die Strichbreite als **Vielfaches der Grundbreite**.
   *
   * Nicht in Zentimetern: Was „dünn" heißt, hängt vom Maßstab ab. Ein Faktor
   * überträgt sich dagegen von 1:50 bis 1:500 unverändert.
   */
  breitenfaktor?: number;
  /** Bei Texten. */
  text?: string;
  x?: number;
  y?: number;
  /** Schrifthöhe in Zentimetern des Marktes. */
  schrift?: number;
  fett?: boolean;
  ausrichtung?: 'left' | 'center' | 'right';
  grundlinie?: 'top' | 'middle' | 'alphabetic';
  /** Drehung in Grad, falls beim Aufzeichnen eine Drehung galt. */
  drehung?: number;
}

/** Der Zustand, den `save`/`restore` sichert. */
interface Zustand {
  fuellfarbe: string;
  strichfarbe: string;
  strichbreite: number;
  schrift: number;
  fett: boolean;
  ausrichtung: 'left' | 'center' | 'right';
  grundlinie: 'top' | 'middle' | 'alphabetic';
  /** a, b, c, d, e, f – die Umformung, die gerade gilt. */
  matrix: [number, number, number, number, number, number];
}

const EINHEIT: Zustand['matrix'] = [1, 0, 0, 1, 0, 0];

function malNimm(
  m: Zustand['matrix'],
  n: Zustand['matrix'],
): Zustand['matrix'] {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export interface Mitschreiberoptionen {
  /**
   * Der Zoomwert, mit dem die Zeichenfunktion aufgerufen wird.
   *
   * Er steuert zweierlei in der Zeichnung: die Strichbreiten (`1 / zoom`) und
   * die Frage, ob eine Beschriftung noch lesbar wäre. Für die Ausgabe zählt
   * nur das zweite – die Breiten werden hinterher umgerechnet. Deshalb wird
   * hier der Wert eingesetzt, der zum **Druck** passt.
   */
  zoom: number;
  /** Füllfarbe des Möbels, für `fillStrokeShape`. */
  fuellung?: string;
  /** Linienfarbe des Möbels, für `fillStrokeShape`. */
  linie?: string;
}

export class Leinwandmitschreiber {
  readonly schritte: Zeichenschritt[] = [];
  private pfad = new Pfadschreiber();
  private stapel: Zustand[] = [];
  private jetzt: Zustand = {
    fuellfarbe: '#000000',
    strichfarbe: '#000000',
    strichbreite: 1,
    schrift: 10,
    fett: false,
    ausrichtung: 'left',
    grundlinie: 'alphabetic',
    matrix: [...EINHEIT] as Zustand['matrix'],
  };

  constructor(private optionen: Mitschreiberoptionen) {}

  // ------------------------------------------------------------- Umformung

  /** Einen Punkt durch die geltende Umformung schicken. */
  private punkt(x: number, y: number): [number, number] {
    const [a, b, c, d, e, f] = this.jetzt.matrix;
    return [a * x + c * y + e, b * x + d * y + f];
  }

  /** Der Drehwinkel, der gerade gilt – in Grad. */
  private get winkel(): number {
    const [a, b] = this.jetzt.matrix;
    return (Math.atan2(b, a) * 180) / Math.PI;
  }

  translate(x: number, y: number): void {
    this.jetzt.matrix = malNimm(this.jetzt.matrix, [1, 0, 0, 1, x, y]);
  }

  rotate(bogenmass: number): void {
    const cos = Math.cos(bogenmass);
    const sin = Math.sin(bogenmass);
    this.jetzt.matrix = malNimm(this.jetzt.matrix, [cos, sin, -sin, cos, 0, 0]);
  }

  scale(x: number, y: number): void {
    this.jetzt.matrix = malNimm(this.jetzt.matrix, [x, 0, 0, y, 0, 0]);
  }

  // ---------------------------------------------------------------- Pfade

  beginPath(): void {
    this.pfad = new Pfadschreiber();
  }

  moveTo(x: number, y: number): void {
    this.pfad.moveTo(...this.punkt(x, y));
  }

  lineTo(x: number, y: number): void {
    this.pfad.lineTo(...this.punkt(x, y));
  }

  rect(x: number, y: number, breite: number, tiefe: number): void {
    // Über die Ecken statt über `rect`: Bei einer Drehung wäre ein Rechteck
    // sonst achsenparallel geblieben und stünde im Plan schief zum Möbel.
    const ecken: [number, number][] = [
      this.punkt(x, y),
      this.punkt(x + breite, y),
      this.punkt(x + breite, y + tiefe),
      this.punkt(x, y + tiefe),
    ];
    this.pfad.moveTo(...ecken[0]);
    for (const ecke of ecken.slice(1)) this.pfad.lineTo(...ecke);
    this.pfad.closePath();
  }

  closePath(): void {
    this.pfad.closePath();
  }

  arc(cx: number, cy: number, r: number, von: number, bis: number, gegen = false): void {
    this.ellipse(cx, cy, r, r, 0, von, bis, gegen);
  }

  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    drehung = 0,
    von = 0,
    bis = Math.PI * 2,
    gegen = false,
  ): void {
    const [x, y] = this.punkt(cx, cy);
    // Nur Drehung und Verschiebung kommen vor; ein Maßstab würde die
    // Halbmesser ändern und ist deshalb ausdrücklich nicht vorgesehen.
    const zusatz = (this.winkel * Math.PI) / 180;
    this.pfad.ellipse(x, y, rx, ry, drehung + zusatz, von, bis, gegen);
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void {
    const [ax, ay] = this.punkt(x1, y1);
    const [bx, by] = this.punkt(x2, y2);
    this.pfad.arcTo(ax, ay, bx, by, r);
  }

  // -------------------------------------------------------------- Zustand

  save(): void {
    this.stapel.push({ ...this.jetzt, matrix: [...this.jetzt.matrix] as Zustand['matrix'] });
  }

  restore(): void {
    const vorher = this.stapel.pop();
    if (vorher) this.jetzt = vorher;
  }

  setAttr(name: string, wert: unknown): void {
    switch (name) {
      case 'fillStyle':
        this.jetzt.fuellfarbe = String(wert);
        break;
      case 'strokeStyle':
        this.jetzt.strichfarbe = String(wert);
        break;
      case 'lineWidth':
        this.jetzt.strichbreite = Number(wert) || 0;
        break;
      case 'textAlign':
        this.jetzt.ausrichtung = wert as Zustand['ausrichtung'];
        break;
      case 'textBaseline':
        this.jetzt.grundlinie = wert as Zustand['grundlinie'];
        break;
      case 'font': {
        // Kommt als `600 22px sans-serif` oder `22px sans-serif`.
        const text = String(wert);
        const groesse = text.match(/(\d+(?:\.\d+)?)px/);
        this.jetzt.schrift = groesse ? Number(groesse[1]) : this.jetzt.schrift;
        this.jetzt.fett = /^\s*(bold|[5-9]00)\b/.test(text);
        break;
      }
      default:
        // Alles andere (Schatten, Linienenden …) beeinflusst die Ausgabe
        // nicht und wird stillschweigend übergangen.
        break;
    }
  }

  // -------------------------------------------------------------- Ausgabe

  /** Der Faktor, um den diese Breite von der Grundbreite abweicht. */
  private faktor(): number {
    const k = this.jetzt.strichbreite * this.optionen.zoom;
    // Ohne brauchbaren Wert die Grundbreite – ein Strich ohne Breite wäre
    // unsichtbar, und ein unsichtbarer Strich ist schlimmer als ein dünner.
    return Number.isFinite(k) && k > 0 ? k : 1;
  }

  fill(): void {
    if (this.pfad.leer) return;
    this.schritte.push({ art: 'flaeche', d: this.pfad.d, farbe: this.jetzt.fuellfarbe });
  }

  stroke(): void {
    if (this.pfad.leer) return;
    this.schritte.push({
      art: 'strich',
      d: this.pfad.d,
      farbe: this.jetzt.strichfarbe,
      breitenfaktor: this.faktor(),
    });
  }

  /**
   * Der Hauptdurchgang: Möbelfüllung und Möbelkontur in einem.
   *
   * Konva nimmt Farbe und Strichbreite dafür vom Element und nicht vom
   * Zeichenzustand – deshalb stehen sie in den Optionen.
   */
  fillStrokeShape(): void {
    if (this.pfad.leer) return;
    const d = this.pfad.d;
    if (this.optionen.fuellung) {
      this.schritte.push({ art: 'flaeche', d, farbe: this.optionen.fuellung });
    }
    if (this.optionen.linie) {
      this.schritte.push({ art: 'strich', d, farbe: this.optionen.linie, breitenfaktor: 1 });
    }
  }

  fillText(text: string, x: number, y: number): void {
    if (!text) return;
    const [px, py] = this.punkt(x, y);
    this.schritte.push({
      art: 'text',
      text,
      x: px,
      y: py,
      farbe: this.jetzt.fuellfarbe,
      schrift: this.jetzt.schrift,
      fett: this.jetzt.fett,
      ausrichtung: this.jetzt.ausrichtung,
      grundlinie: this.jetzt.grundlinie,
      drehung: this.winkel || undefined,
    });
  }

  /**
   * Wie breit ein Text würde.
   *
   * Die Zeichnung fragt das, um zu entscheiden, ob eine Beschriftung ins Feld
   * passt oder umbrochen werden muss. Gemessen wird nach den echten
   * Zeichenbreiten von Helvetica – über die Zeichenzahl geschätzt bräche der
   * Text an der falschen Stelle um.
   */
  measureText(text: string): { width: number } {
    return { width: textbreite(text, this.jetzt.schrift) };
  }

  // Was Konva sonst noch anfassen könnte, ohne Wirkung auf die Ausgabe.
  setLineDash(): void {}
  clip(): void {}
  quadraticCurveTo(): void {}
  bezierCurveTo(): void {}
}
