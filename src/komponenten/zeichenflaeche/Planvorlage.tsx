import { useEffect, useState } from 'react';
import { Image as KonvaBild } from 'react-konva';
import type { Hintergrund } from '../../typen/modell';

/**
 * Der eingelesene Plan als Vorlage unter der Zeichnung.
 *
 * Er liegt ganz unten und hört nicht auf die Maus: Man soll darüber
 * zeichnen, nicht ihn anfassen. Verschieben geht über die Zahlenfelder im
 * Eigenschaftenfenster – das ist beim Einpassen ohnehin genauer als Ziehen.
 *
 * Das Bild wird aus der data:-URL geladen, sobald sie sich ändert. Konva
 * braucht ein fertiges `HTMLImageElement`; solange es lädt, wird nichts
 * gezeichnet, statt einen leeren Kasten zu zeigen.
 */
export function Planvorlage({ hintergrund }: { hintergrund: Hintergrund }) {
  const [bild, setzeBild] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    const element = new window.Image();
    element.onload = () => {
      if (!abgebrochen) setzeBild(element);
    };
    element.onerror = () => {
      if (!abgebrochen) setzeBild(null);
    };
    element.src = hintergrund.bild;
    return () => {
      abgebrochen = true;
    };
  }, [hintergrund.bild]);

  if (!bild || !hintergrund.sichtbar) return null;

  return (
    <KonvaBild
      image={bild}
      x={hintergrund.x}
      y={hintergrund.y}
      width={hintergrund.breite}
      height={hintergrund.hoehe}
      opacity={hintergrund.deckkraft}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
