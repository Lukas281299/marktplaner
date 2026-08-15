import { Shape, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { achsmassZeichen } from '../../logik/achsmass';
import type { Grundform, PlanElement } from '../../typen/modell';

/**
 * Ein einzelnes Element auf dem Plan.
 *
 * Gezeichnet wird mit einer eigenen Zeichenfunktion (`sceneFunc`). Der Vorteil:
 * Für eine neue Grundform muss unten nur ein weiterer Fall in `zeichneForm`
 * ergänzt werden – am Rest der Anwendung ändert sich nichts. Genauso lassen
 * sich später fertige Symbole einsetzen.
 *
 * Der Bezugspunkt (x/y) ist der MITTELPUNKT. Deshalb wird der Zeichenursprung
 * über `offsetX`/`offsetY` um die halbe Größe verschoben. Dadurch dreht sich
 * jedes Element um die eigene Mitte.
 */

/**
 * Zeichnet die gewählte Grundform in ein Rechteck der Größe b × t.
 *
 * `beidseitig` ändert bei manchen Möbeln die Zeichnung: Eine Doppeltruhe hat
 * einen Steg in der Mitte, eine Einzeltruhe eine Rückwand.
 */
function zeichneForm(
  ctx: Konva.Context,
  form: Grundform,
  b: number,
  t: number,
  beidseitig = false,
) {
  switch (form) {
    case 'abgerundet': {
      const r = Math.min(b, t) * 0.18;
      ctx.moveTo(r, 0);
      ctx.arcTo(b, 0, b, t, r);
      ctx.arcTo(b, t, 0, t, r);
      ctx.arcTo(0, t, 0, 0, r);
      ctx.arcTo(0, 0, b, 0, r);
      ctx.closePath();
      break;
    }
    case 'kreis':
      ctx.ellipse(b / 2, t / 2, b / 2, t / 2, 0, 0, Math.PI * 2);
      break;
    case 'halbkreis':
      // Flache Seite unten.
      ctx.ellipse(b / 2, t, b / 2, t, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      break;
    case 'linie': {
      // Ein schmaler Balken in der Mitte des Rahmens.
      const dicke = Math.max(t * 0.25, 4);
      ctx.rect(0, t / 2 - dicke / 2, b, dicke);
      break;
    }
    case 'pfeil': {
      const schaft = t * 0.35;
      const spitze = Math.min(b * 0.3, t);
      ctx.moveTo(0, t / 2 - schaft / 2);
      ctx.lineTo(b - spitze, t / 2 - schaft / 2);
      ctx.lineTo(b - spitze, 0);
      ctx.lineTo(b, t / 2);
      ctx.lineTo(b - spitze, t);
      ctx.lineTo(b - spitze, t / 2 + schaft / 2);
      ctx.lineTo(0, t / 2 + schaft / 2);
      ctx.closePath();
      break;
    }
    case 'bakeoff': {
      // Ein BakeOff-Turm von oben, nachgezeichnet aus dem Wanzl-Plan.
      //
      // Der Turm zeigt im Grundriss vier Bänder: hinten die Rückwand, davor
      // ein schmaler Streifen, dann die große Warenfläche und vorn die
      // Ablage. Genau diese Gliederung macht die Zeile auf dem Plan
      // wiedererkennbar – ein leeres Rechteck wäre nur ein Kasten.
      //
      // Die Trennlinien liegen als eigene Teilpfade im selben Pfad: Sie haben
      // keine Fläche, werden also nur gestrichelt gezeichnet und nicht gefüllt.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.23, 0.32, 0.83]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;
    }
    case 'bakeoffEcke': {
      // Das Eckstück: ein Keil, der die Lücke füllt, wenn die Zeile abknickt.
      // Bei gleicher Breite und Tiefe steht die Schräge genau auf 45°.
      ctx.moveTo(0, 0);
      ctx.lineTo(b, 0);
      ctx.lineTo(0, t);
      ctx.closePath();
      break;
    }
    case 'vitable':
      // Der Obst- und Gemüsetisch von oben. Die Stufenkanten kommen als
      // helle Linien in einem zweiten Durchgang dazu (siehe `helleLinien`) –
      // sie sind im Plan weiß und heben sich so vom Grün ab.
      ctx.rect(0, 0, b, t);
      break;

    case 'vitableAbschluss':
      // Gerader Abschluss („Abschluss 90°"): schließt den Zug stumpf ab.
      ctx.rect(0, 0, b, t);
      break;

    case 'vitableAbschlussRund': {
      // Runder Abschluss („Abschluss 180°") am Kopf einer Gondel:
      // vorn halbrund, hinten gerade am Zug anschließend.
      const r = t / 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(b - r, 0);
      ctx.arc(b - r, r, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(0, t);
      ctx.closePath();
      break;
    }

    case 'vitableEckInnen':
      // Inneneck 45°: Die Front läuft schräg, die Rückseite bleibt gerade.
      // Zwei davon ergeben laut Workbook ein Inneneck 90°.
      ctx.moveTo(0, 0);
      ctx.lineTo(b, 0);
      ctx.lineTo(b, t);
      ctx.closePath();
      break;

    case 'vitableEckAussen':
      // Außeneck 90°: füllt die Ecke, um die der Zug außen herumgeführt wird.
      ctx.moveTo(0, 0);
      ctx.lineTo(b, 0);
      ctx.lineTo(0, t);
      ctx.closePath();
      break;

    case 'tkTruhe': {
      // Tiefkühlinsel von oben, unterteilt in Module von 62,5 cm. Genau
      // diese Teilung macht die Truhe im Plan erkennbar und zeigt, wie lang
      // sie sich bauen lässt.
      ctx.rect(0, 0, b, t);
      for (let x = TRUHENMODUL; x < b - 0.1; x += TRUHENMODUL) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, t);
      }
      if (beidseitig) {
        // Doppeltruhe: der Steg in der Mitte, an dem beide Seiten
        // aufeinandertreffen.
        ctx.moveTo(0, t * 0.46);
        ctx.lineTo(b, t * 0.46);
        ctx.moveTo(0, t * 0.54);
        ctx.lineTo(b, t * 0.54);
      } else {
        // Einzeltruhe: nur eine Auslage, dahinter die Rückwand.
        ctx.moveTo(0, t * 0.18);
        ctx.lineTo(b, t * 0.18);
      }
      break;
    }

    case 'tkSchrank': {
      // Tiefkühlschrank: ein Feld je Tür, dazu die Türen selbst als
      // Schwenkbogen davor – so sieht man im Plan sofort, wie weit sie
      // aufgehen und ob der Gang dafür reicht.
      ctx.rect(0, 0, b, t);
      const tueren = tuerAnzahl(b);
      const breiteJeTuer = b / tueren;
      for (let i = 1; i < tueren; i++) {
        ctx.moveTo(i * breiteJeTuer, 0);
        ctx.lineTo(i * breiteJeTuer, t);
      }
      break;
    }

    case 'tkKombi': {
      // Kombigerät: hinten der Schrankteil mit Türen, vorn die offene Wanne.
      // Die Trennlinie liegt bei der Tiefe der oberen Etagen (400 von 1145).
      ctx.rect(0, 0, b, t);
      const grenze = t * 0.35;
      ctx.moveTo(0, grenze);
      ctx.lineTo(b, grenze);
      const tueren = tuerAnzahl(b);
      const breiteJeTuer = b / tueren;
      for (let i = 1; i < tueren; i++) {
        ctx.moveTo(i * breiteJeTuer, 0);
        ctx.lineTo(i * breiteJeTuer, grenze);
      }
      // Die Wanne davor ist wie die Truhe in 62,5er-Module geteilt.
      for (let x = TRUHENMODUL; x < b - 0.1; x += TRUHENMODUL) {
        ctx.moveTo(x, grenze);
        ctx.lineTo(x, t);
      }
      break;
    }

    // Die drei Blink-Möbel unterscheiden sich im Grundriss durch ihre
    // Längslinien. Das ist ihr einziges sichtbares Merkmal – die Umrisse
    // sind fast gleich groß, und nur daran erkennt man auf dem Plan, ob
    // dort bedient wird oder der Kunde selbst zugreift.
    case 'blinkTheke':
      // Bedientheke: hinten der Arbeitsbereich, vorn die Glasfront.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.2, 0.78, 0.9]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;

    case 'blinkSelf':
      // SB flach: kein Arbeitsbereich, dafür zwei gleich große Auslagen,
      // an die der Kunde von vorn herankommt.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.16, 0.58]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;

    case 'blinkSv':
      // SB halbhoch: mehrere übereinanderliegende Etagen, von oben als
      // schmale Bänder sichtbar – wie bei einem Wandregal.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.22, 0.42, 0.62, 0.82]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;

    case 'rechteck':
    default:
      ctx.rect(0, 0, b, t);
      break;
  }
}

/** Modulbreite einer Tiefkühltruhe in cm – daraus setzt sich ihre Länge zusammen. */
const TRUHENMODUL = 62.5;

/**
 * Übliche Türbreite eines Tiefkühlschranks in cm.
 *
 * Der Katalog führt Längen von 1562, 2343, 3124 und 3898 mm mit zwei bis
 * fünf Türen – das sind rund 781 mm je Tür. Die Zahl der Türen wird daraus
 * berechnet statt gespeichert: Zieht jemand den Schrank länger, kommen Türen
 * dazu, und genau so wird er auch bestellt.
 */
const TUERBREITE = 78.1;

function tuerAnzahl(breite: number): number {
  return Math.max(1, Math.round(breite / TUERBREITE));
}

/** Formen, vor deren Front Türen gezeichnet werden. */
const MIT_TUEREN = new Set<Grundform>(['tkSchrank', 'tkKombi']);

/**
 * Zeichnet die Schwenkbögen der Türen vor die Front.
 *
 * Bewusst in einem eigenen Durchgang und nur als Strich: Türbögen sind
 * Linien, keine Flächen. Lägen sie im Hauptpfad, würde die Füllung des
 * Möbels sie mit ausfüllen und aus jedem Bogen ein farbiges Tortenstück
 * machen.
 *
 * Alle Türen schlagen in dieselbe Richtung auf. Im Plan sieht man dadurch auf
 * einen Blick, wie viel Gang eine geöffnete Tür braucht.
 */
function zeichneTuerboegen(ctx: Konva.Context, b: number, t: number) {
  const tueren = tuerAnzahl(b);
  const breiteJeTuer = b / tueren;
  for (let i = 0; i < tueren; i++) {
    const angel = i * breiteJeTuer;
    // Das Türblatt, im rechten Winkel offen.
    ctx.moveTo(angel, t);
    ctx.lineTo(angel, t + breiteJeTuer);
    // Der Bogen von der offenen Tür bis zur gegenüberliegenden Zarge.
    ctx.moveTo(angel, t + breiteJeTuer);
    ctx.arc(angel, t, breiteJeTuer, Math.PI / 2, 0, true);
  }
}

/**
 * Formen, die ein Möbel darstellen und deshalb das Achsmaß-Zeichen tragen.
 *
 * Die Regel gilt laut Ladenbau für alle Möbel. Reine Zeichenhilfen wie Linie
 * und Pfeil bekommen es nicht – dort wäre eine Diagonale nur Verwirrung.
 */
const MIT_ACHSMASS = new Set<Grundform>([
  'rechteck',
  'abgerundet',
  'bakeoff',
  'vitable',
  'vitableAbschluss',
]);

/** Zeichnet das Achsmaß-Zeichen: Diagonale oder Kreuz, siehe `achsmass.ts`. */
function zeichneAchsmass(ctx: Konva.Context, form: Grundform, breite: number, b: number, t: number) {
  if (!MIT_ACHSMASS.has(form)) return;
  const zeichen = achsmassZeichen(breite);
  if (zeichen === 'keins') return;

  // Von unten links nach oben rechts – y zeigt auf dem Bildschirm nach unten.
  ctx.moveTo(0, t);
  ctx.lineTo(b, 0);
  if (zeichen === 'kreuz') {
    ctx.moveTo(0, 0);
    ctx.lineTo(b, t);
  }
}

/**
 * Die hellen Linien, die in einem zweiten Durchgang gezeichnet werden.
 *
 * Bisher sind das die Stufenkanten der Obst- und Gemüsetische. Von oben
 * gesehen verdeckt jede Auflage die darunterliegende – sichtbar bleibt je ein
 * Band, und dessen Kante liegt genau bei der Tiefe der darüberliegenden
 * Auflage. Deshalb wird die tiefste Auflage übersprungen: Sie ist die
 * Vorderkante des Möbels und schon vom Umriss gezeichnet.
 */
function helleLinien(element: PlanElement, b: number, t: number): number[][] {
  const tiefe = element.tiefe;
  if (tiefe <= 0) return [];

  // Eine beidseitige Gondel ist an der Mitte gespiegelt: Jede Seite bekommt
  // die halbe Tiefe, und jede Linie erscheint zweimal.
  const seiten = element.beidseitig ? 2 : 1;
  const korpus = element.korpustiefe ?? tiefe;
  const halberKorpus = korpus / seiten;

  const stellen: number[] = [];

  // Die Kanten der Auflagen, gemessen ab der Rückwand.
  const stufen = element.stufen;
  if (stufen && stufen.length >= 2) {
    const tiefste = Math.max(...stufen);
    if (tiefste > 0) {
      for (const stufe of stufen) {
        if (stufe >= tiefste) continue;
        stellen.push((stufe / tiefste) * halberKorpus);
      }
    }
  }

  // Die Vorderkante des Korpus – ab hier kragt die Front über.
  if (element.korpustiefe && element.korpustiefe < tiefe) stellen.push(halberKorpus);

  const linien: number[][] = [];
  // Zwei gleich tiefe Auflagen (etwa „T800 + 2x T600") liegen von oben
  // gesehen übereinander und ergeben nur eine Kante.
  for (const stelle of [...new Set(stellen)]) {
    const y = (stelle / tiefe) * t;
    linien.push([0, y, b, y]);
    if (element.beidseitig) linien.push([0, t - y, b, t - y]);
  }
  return linien;
}

interface Props {
  element: PlanElement;
  ausgewaehlt: boolean;
  ziehbar: boolean;
  zoom: number;
  /** Meldet den gezeichneten Knoten an die Zeichenfläche (für die Anfasser). */
  merkeKnoten: (id: string, knoten: Konva.Shape | null) => void;
  beiMausTaste: (e: KonvaEventObject<MouseEvent>, id: string) => void;
  beiZiehStart: (e: KonvaEventObject<DragEvent>, id: string) => void;
  beiZiehen: (e: KonvaEventObject<DragEvent>, id: string) => void;
  beiZiehEnde: () => void;
}

export function ElementSymbol({
  element,
  ausgewaehlt,
  ziehbar,
  zoom,
  merkeKnoten,
  beiMausTaste,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: Props) {
  return (
    <Shape
      id={element.id}
      name="planelement"
      ref={(knoten) => merkeKnoten(element.id, knoten)}
      x={element.x}
      y={element.y}
      width={element.breite}
      height={element.tiefe}
      offsetX={element.breite / 2}
      offsetY={element.tiefe / 2}
      rotation={element.drehung}
      draggable={ziehbar}
      fill={element.farbe}
      stroke={ausgewaehlt ? '#0a84ff' : 'rgba(30,40,52,0.55)'}
      strokeWidth={(ausgewaehlt ? 2 : 1) / zoom}
      opacity={element.gesperrt ? 0.7 : 1}
      shadowForStrokeEnabled={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx, shape) => {
        const b = shape.width();
        const t = shape.height();

        // 1. Umriss und Achsmaß-Zeichen in einem Zug – beides in der
        //    Linienfarbe des Elements.
        ctx.beginPath();
        zeichneForm(ctx, element.form, b, t, Boolean(element.beidseitig));
        zeichneAchsmass(ctx, element.form, element.breite, b, t);
        ctx.fillStrokeShape(shape);

        // 2. Die hellen Stufenkanten darüber. Sie brauchen eine eigene Farbe
        //    und deshalb einen zweiten Durchgang.
        const hell = helleLinien(element, b, t);
        if (hell.length > 0) {
          ctx.save();
          ctx.setAttr('strokeStyle', '#ffffff');
          ctx.setAttr('lineWidth', 1.6 / zoom);
          ctx.beginPath();
          for (const [x1, y1, x2, y2] of hell) {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.stroke();
          ctx.restore();
        }

        // 3. Die Türbögen – ebenfalls nur Strich, siehe `zeichneTuerboegen`.
        if (MIT_TUEREN.has(element.form)) {
          ctx.save();
          ctx.setAttr('strokeStyle', 'rgba(30,40,52,0.65)');
          ctx.setAttr('lineWidth', 1.1 / zoom);
          ctx.beginPath();
          zeichneTuerboegen(ctx, b, t);
          ctx.stroke();
          ctx.restore();
        }
      }}
      onMouseDown={(e) => beiMausTaste(e, element.id)}
      onDragStart={(e) => beiZiehStart(e, element.id)}
      onDragMove={(e) => beiZiehen(e, element.id)}
      onDragEnd={beiZiehEnde}
    />
  );
}

/**
 * Die Beschriftung eines Elements.
 * Sie ist bewusst ein eigenes Objekt: So bleibt die Schrift beim Vergrößern
 * des Elements immer gleich groß und wird nicht mitgedehnt.
 */
export function ElementBeschriftung({ element, zoom }: { element: PlanElement; zoom: number }) {
  if (!element.beschriftungSichtbar || !element.beschriftung.trim()) return null;

  const schrift = element.schriftgroesse / zoom;
  // Zu kleine Schrift auf dem Bildschirm ist unleserlich – dann lieber weglassen.
  if (element.schriftgroesse < 4) return null;

  return (
    <Text
      listening={false}
      x={element.x}
      y={element.y}
      width={element.breite}
      offsetX={element.breite / 2}
      offsetY={schrift * 0.6}
      rotation={element.drehung}
      text={element.beschriftung}
      fontSize={schrift}
      fontFamily="Segoe UI, system-ui, sans-serif"
      fill="#1c2530"
      align="center"
      ellipsis
      wrap="none"
      perfectDrawEnabled={false}
    />
  );
}
