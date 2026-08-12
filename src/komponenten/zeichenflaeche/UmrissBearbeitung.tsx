import { Circle, Group, Line } from 'react-konva';
import type { Punkt } from '../../typen/modell';
import { kantenMitte, kanten } from '../../logik/polygon';

/**
 * Die Anfasser zum Umformen eines Umrisses.
 *
 * Zwei Sorten Anfasser:
 *  - **volle Kreise auf den Ecken** – ziehen verschiebt die Ecke,
 *    Doppelklick entfernt sie
 *  - **kleine hohle Kreise auf den Kantenmitten** – anklicken setzt dort eine
 *    neue Ecke ein
 *
 * Das ist die Bedienung, die man aus Zeichenprogrammen kennt. Eine Ecke wird
 * bewusst nicht durch Ziehen eingefügt: Wer die Kantenmitte anfasst, will
 * meistens die ganze Wand verschieben – und würde sich über einen plötzlich
 * entstehenden Knick wundern.
 */
interface Props {
  umriss: Punkt[];
  zoom: number;
  /** Rastet einen Punkt ein, wenn der Nutzer das eingestellt hat. */
  einrasten: (p: Punkt) => Punkt;
  /** Wird beim Ziehen laufend aufgerufen (ohne Eintrag in die Historie). */
  beiPunktZiehen: (index: number, punkt: Punkt) => void;
  /** Einmal beim Beginn – legt den Punkt für "Rückgängig" fest. */
  beiZiehStart: () => void;
  beiZiehEnde: () => void;
  beiPunktEinfuegen: (nachIndex: number, punkt: Punkt) => void;
  beiPunktEntfernen: (index: number) => void;
}

export function UmrissBearbeitung({
  umriss,
  zoom,
  einrasten,
  beiPunktZiehen,
  beiZiehStart,
  beiZiehEnde,
  beiPunktEinfuegen,
  beiPunktEntfernen,
}: Props) {
  if (umriss.length < 3) return null;

  const eckRadius = 7 / zoom;
  const kantenRadius = 4.5 / zoom;

  return (
    <Group>
      {/* Die Umrisslinie noch einmal deutlich hervorgehoben */}
      <Line
        listening={false}
        points={umriss.flatMap((p) => [p.x, p.y])}
        closed
        stroke="#0a84ff"
        strokeWidth={1.5 / zoom}
        dash={[10 / zoom, 6 / zoom]}
      />

      {/* Neue Ecke einfügen */}
      {kanten(umriss).map((kante) => {
        if (kante.laenge * zoom < 40) return null;
        const mitte = kantenMitte(kante);
        return (
          <Circle
            key={`mitte-${kante.index}`}
            x={mitte.x}
            y={mitte.y}
            radius={kantenRadius}
            fill="#ffffff"
            stroke="#0a84ff"
            strokeWidth={1.4 / zoom}
            opacity={0.85}
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onClick={(e) => {
              e.cancelBubble = true;
              beiPunktEinfuegen(kante.index, mitte);
            }}
          />
        );
      })}

      {/* Ecken verschieben */}
      {umriss.map((p, i) => (
        <Circle
          key={`ecke-${i}`}
          x={p.x}
          y={p.y}
          radius={eckRadius}
          fill="#0a84ff"
          stroke="#ffffff"
          strokeWidth={1.8 / zoom}
          draggable
          onMouseDown={(e) => {
            e.cancelBubble = true;
          }}
          onDragStart={beiZiehStart}
          onDragMove={(e) => {
            const ziel = einrasten({ x: e.target.x(), y: e.target.y() });
            e.target.position(ziel);
            beiPunktZiehen(i, ziel);
          }}
          onDragEnd={beiZiehEnde}
          onDblClick={(e) => {
            e.cancelBubble = true;
            beiPunktEntfernen(i);
          }}
        />
      ))}
    </Group>
  );
}
