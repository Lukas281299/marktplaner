import { Shape } from 'react-konva';
import type Konva from 'konva';

/**
 * Das Hilfsraster auf der Zeichenfläche.
 *
 * Aus Geschwindigkeitsgründen werden alle Linien in einer einzigen Zeichnung
 * gebündelt (ein sogenannter "Pfad"), statt für jede Linie ein eigenes Objekt
 * anzulegen. Selbst bei einem 60-m-Markt bleibt das flüssig.
 */
interface Props {
  breite: number;
  laenge: number;
  /** Abstand der feinen Linien in cm. */
  weite: number;
  /** Bildschirmpunkte pro Zentimeter – bestimmt die Strichstärke. */
  zoom: number;
}

/** Zeichnet ein Liniennetz mit dem angegebenen Abstand. */
function Linien({
  breite,
  laenge,
  weite,
  farbe,
  staerke,
}: {
  breite: number;
  laenge: number;
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
        // Senkrechte Linien
        for (let x = 0; x <= breite + 0.01; x += weite) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, laenge);
        }
        // Waagerechte Linien
        for (let y = 0; y <= laenge + 0.01; y += weite) {
          ctx.moveTo(0, y);
          ctx.lineTo(breite, y);
        }
        ctx.strokeShape(shape);
      }}
    />
  );
}

export function Raster({ breite, laenge, weite, zoom }: Props) {
  // Wenn die feinen Linien enger als vier Bildschirmpunkte stehen, werden sie
  // weggelassen – sonst entsteht nur eine graue Fläche.
  const feineSichtbar = weite * zoom >= 4;
  // Die kräftigen Linien stehen alle 5 Rasterschritte, mindestens aber alle 1 m.
  const grobeWeite = Math.max(100, weite * 5);

  return (
    <>
      {feineSichtbar && (
        <Linien
          breite={breite}
          laenge={laenge}
          weite={weite}
          farbe="#d6dbe0"
          staerke={1 / zoom}
        />
      )}
      <Linien
        breite={breite}
        laenge={laenge}
        weite={grobeWeite}
        farbe="#bcc4cc"
        staerke={1 / zoom}
      />
    </>
  );
}
