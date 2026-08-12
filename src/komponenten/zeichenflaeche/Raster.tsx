import { Shape } from 'react-konva';
import type Konva from 'konva';
import type { Rahmen } from '../../logik/geometrie';

/**
 * Das Hilfsraster auf der Zeichenfläche.
 *
 * Aus Geschwindigkeitsgründen werden alle Linien in einer einzigen Zeichnung
 * gebündelt (ein sogenannter "Pfad"), statt für jede Linie ein eigenes Objekt
 * anzulegen. Selbst bei einem 60-m-Markt bleibt das flüssig.
 *
 * Gezeichnet wird über die Umgrenzung des Grundrisses, nicht über den Umriss
 * selbst: Bei einer L-Form soll das Raster auch in der einspringenden Ecke
 * weiterlaufen, weil man dort ja ebenfalls plant.
 */
interface Props {
  bereich: Rahmen;
  /** Abstand der feinen Linien in cm. */
  weite: number;
  /** Bildschirmpunkte pro Zentimeter – bestimmt die Strichstärke. */
  zoom: number;
}

/** Zeichnet ein Liniennetz mit dem angegebenen Abstand. */
function Linien({
  bereich,
  weite,
  farbe,
  staerke,
}: {
  bereich: Rahmen;
  weite: number;
  farbe: string;
  staerke: number;
}) {
  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      stroke={farbe}
      strokeWidth={staerke}
      sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
        ctx.beginPath();
        // Am Nullpunkt ausgerichtet, damit die Linien auch dann auf runden
        // Maßen liegen, wenn der Grundriss nicht bei 0/0 anfängt.
        const ersterX = Math.ceil(bereich.links / weite) * weite;
        const ersterY = Math.ceil(bereich.oben / weite) * weite;
        for (let x = ersterX; x <= bereich.rechts + 0.01; x += weite) {
          ctx.moveTo(x, bereich.oben);
          ctx.lineTo(x, bereich.unten);
        }
        for (let y = ersterY; y <= bereich.unten + 0.01; y += weite) {
          ctx.moveTo(bereich.links, y);
          ctx.lineTo(bereich.rechts, y);
        }
        ctx.strokeShape(shape);
      }}
    />
  );
}

export function Raster({ bereich, weite, zoom }: Props) {
  // Wenn die feinen Linien enger als vier Bildschirmpunkte stehen, werden sie
  // weggelassen – sonst entsteht nur eine graue Fläche.
  const feineSichtbar = weite * zoom >= 4;
  // Die kräftigen Linien stehen alle 5 Rasterschritte, mindestens aber alle 1 m.
  const grobeWeite = Math.max(100, weite * 5);

  return (
    <>
      {feineSichtbar && (
        <Linien bereich={bereich} weite={weite} farbe="#d6dbe0" staerke={1 / zoom} />
      )}
      <Linien bereich={bereich} weite={grobeWeite} farbe="#bcc4cc" staerke={1 / zoom} />
    </>
  );
}
