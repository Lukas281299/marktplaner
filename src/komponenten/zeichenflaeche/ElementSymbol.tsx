import { Shape, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
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

/** Zeichnet die gewählte Grundform in ein Rechteck der Größe b × t. */
function zeichneForm(ctx: Konva.Context, form: Grundform, b: number, t: number) {
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
    case 'rechteck':
    default:
      ctx.rect(0, 0, b, t);
      break;
  }
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
        ctx.beginPath();
        zeichneForm(ctx, element.form, shape.width(), shape.height());
        ctx.fillStrokeShape(shape);
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
