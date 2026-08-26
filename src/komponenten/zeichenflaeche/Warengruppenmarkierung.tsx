import { Shape } from 'react-konva';
import { feldlage } from '../../logik/warengruppenzuordnung';
import type { Feldbezug, PlanElement } from '../../typen/modell';

/**
 * Die markierten Meter, damit man sieht, was Enter treffen wird.
 *
 * Ein farbiger Streifen an der Vorderkante – dort, wo gleich die Schrift
 * steht. Über das ganze Feld gelegt verdeckte er die Notizen darin.
 *
 * Ein eigener Durchgang und nicht Teil eines Möbels: Die Markierung gehört
 * zum Arbeiten und nicht zur Zeichnung, und sie steht mal an diesem und mal
 * an jenem Möbel.
 */

/** Wie weit der Streifen vor sein Möbel reicht, in cm. */
const MARKE_TIEFE = 5;

export function Warengruppenmarkierung({
  markierung,
  elemente,
  zoom,
}: {
  markierung: Feldbezug[];
  elemente: PlanElement[];
  zoom: number;
}) {
  if (markierung.length === 0) return null;

  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx) => {
        ctx.setAttr('fillStyle', 'rgba(43,122,190,0.55)');
        ctx.setAttr('strokeStyle', 'rgba(43,122,190,0.9)');
        ctx.setAttr('lineWidth', 1.2 / zoom);

        for (const bezug of markierung) {
          const element = elemente.find((el) => el.id === bezug.element);
          if (!element) continue;
          const lage = feldlage(element, bezug.seite, bezug.feld);
          if (!lage) continue;

          ctx.save();
          ctx.translate(lage.x, lage.y);
          ctx.rotate((lage.drehung * Math.PI) / 180);
          // Der Streifen liegt vor der Kante. Bei der Rückseite einer Gondel
          // zeigt „vorn" in die andere Richtung.
          const hoehe = lage.seite === 'oben' ? -MARKE_TIEFE : MARKE_TIEFE;
          ctx.beginPath();
          ctx.rect(-lage.breite / 2, 0, lage.breite, hoehe);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }}
    />
  );
}
