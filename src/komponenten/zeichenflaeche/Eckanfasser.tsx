import { Circle, Group, Line, Text } from 'react-konva';
import { eckenVon, kantenlaengen } from '../../logik/elementEcken';
import { formatiereLaenge } from '../../logik/masse';
import type { Massinheit, PlanElement } from '../../typen/modell';

/**
 * Die Anfasser an den Ecken eines frei geformten Elements.
 *
 * Für Möbel, die in keine Vorlage passen – eine Ecklösung im Obst und Gemüse
 * etwa, die in jedem Markt anders zugeschnitten ist. Jede Ecke lässt sich
 * einzeln ziehen; die Kantenlängen ändern sich dabei mit und stehen an den
 * Kanten.
 *
 * Die Maße stehen **während des Ziehens** da und nicht nur danach. Ein Trapez
 * nach Augenmaß hinzuschieben und die Zahlen erst hinterher abzulesen wäre
 * genau die falsche Reihenfolge: Man zieht ja, bis das Maß stimmt.
 */
interface Props {
  element: PlanElement;
  zoom: number;
  einheit: Massinheit;
  /** Rastet einen Punkt ein, wenn der Nutzer das eingestellt hat. */
  einrasten: (p: { x: number; y: number }) => { x: number; y: number };
  beiZiehStart: () => void;
  beiZiehen: (index: number, ziel: { x: number; y: number }) => void;
  beiZiehEnde: () => void;
}

export function Eckanfasser({
  element,
  zoom,
  einheit,
  einrasten,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: Props) {
  const ecken = eckenVon(element);
  if (ecken.length < 3) return null;

  const laengen = kantenlaengen(element);
  const radius = 7 / zoom;
  const schrift = 12 / zoom;

  return (
    <Group>
      {/* Der Umriss noch einmal deutlich hervorgehoben */}
      <Line
        listening={false}
        points={ecken.flatMap((p) => [p.x, p.y])}
        closed
        stroke="#0a84ff"
        strokeWidth={1.5 / zoom}
        dash={[10 / zoom, 6 / zoom]}
      />

      {/* Die Kantenlängen, jeweils an der Mitte ihrer Kante */}
      {laengen.map((laenge, i) => {
        const a = ecken[i];
        const b = ecken[(i + 1) % ecken.length];
        return (
          <Text
            key={`kante-${i}`}
            listening={false}
            x={(a.x + b.x) / 2 - 40 / zoom}
            y={(a.y + b.y) / 2 - schrift / 2}
            width={80 / zoom}
            align="center"
            text={formatiereLaenge(laenge, einheit)}
            fontSize={schrift}
            fill="#0a84ff"
            fontStyle="bold"
          />
        );
      })}

      {/* Die Ecken selbst */}
      {ecken.map((p, i) => (
        <Circle
          key={`ecke-${i}`}
          x={p.x}
          y={p.y}
          radius={radius}
          fill="#ffffff"
          stroke="#0a84ff"
          strokeWidth={2 / zoom}
          draggable
          onDragStart={beiZiehStart}
          onDragMove={(e) => {
            const ziel = einrasten({ x: e.target.x(), y: e.target.y() });
            e.target.position(ziel);
            beiZiehen(i, ziel);
          }}
          onDragEnd={beiZiehEnde}
          onMouseDown={(e) => {
            // Sonst würde der Klick durchschlagen und das Element selbst
            // anfassen – man zöge dann die ganze Fläche statt der Ecke.
            e.cancelBubble = true;
          }}
        />
      ))}
    </Group>
  );
}
