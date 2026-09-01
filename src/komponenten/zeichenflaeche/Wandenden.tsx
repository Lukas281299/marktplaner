import { Circle, Group, Text } from 'react-konva';
import { formatiereLaenge } from '../../logik/masse';
import type { Massinheit, Punkt, Wand } from '../../typen/modell';

/**
 * Die Anfasser an den beiden Enden einer ausgewählten Wand.
 *
 * Eine Wand wächst und schrumpft im Plan, nicht im Zahlenfeld: Man zieht sie
 * bis an das Regal heran, das daneben stehen soll, und liest das Maß dabei
 * ab. Es steht **während** des Ziehens da – die Zahl hinterher abzulesen
 * wäre die falsche Reihenfolge, denn man zieht ja, bis sie stimmt.
 *
 * Gezogen wird immer nur ein Ende; das andere bleibt, wo es ist. Und die
 * Richtung bleibt erhalten: Eine waagerechte Wand bleibt waagerecht, auch
 * wenn die Maus beim Ziehen verrutscht. Wer die Richtung ändern will,
 * verschiebt die ganze Wand oder zieht sie neu.
 */
interface Props {
  wand: Wand;
  zoom: number;
  einheit: Massinheit;
  /** Rastet einen Punkt ein, wenn der Nutzer das eingestellt hat. */
  einrasten: (p: Punkt) => Punkt;
  beiZiehStart: () => void;
  /** `ende` ist 0 für `von` und 1 für `bis`. */
  beiZiehen: (ende: 0 | 1, ziel: Punkt) => void;
  beiZiehEnde: () => void;
}

export function Wandenden({
  wand,
  zoom,
  einheit,
  einrasten,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: Props) {
  // Gleichbleibend groß auf dem Bildschirm, egal wie weit man hineinzoomt.
  const griff = 7 / zoom;
  const schrift = 11 / zoom;
  /** Abstand zwischen Wandkante und Zahl. */
  const luft = 5 / zoom;

  const laenge = Math.hypot(wand.bis.x - wand.von.x, wand.bis.y - wand.von.y);
  const mitte = { x: (wand.von.x + wand.bis.x) / 2, y: (wand.von.y + wand.bis.y) / 2 };
  const waagerecht = Math.abs(wand.bis.x - wand.von.x) >= Math.abs(wand.bis.y - wand.von.y);

  const enden: { punkt: Punkt; index: 0 | 1 }[] = [
    { punkt: wand.von, index: 0 },
    { punkt: wand.bis, index: 1 },
  ];

  return (
    <Group listening>
      {/* Das Maß **neben** der Wand, nicht darin.
          Eine senkrechte Wand bekam die Zahl bisher linksbündig eine
          Wandstärke links der Achse – von dort lief sie nach rechts quer
          über die Wand. Jetzt endet sie an der Wandkante. */}
      {waagerecht ? (
        <Text
          x={mitte.x - laenge / 2}
          y={mitte.y - wand.staerke / 2 - luft - schrift}
          width={laenge}
          align="center"
          text={formatiereLaenge(laenge, einheit)}
          fontSize={schrift}
          fontStyle="600"
          fill="#1d4ed8"
          listening={false}
        />
      ) : (
        <Text
          x={mitte.x - wand.staerke / 2 - luft - schrift * 6}
          y={mitte.y - schrift / 2}
          width={schrift * 6}
          align="right"
          text={formatiereLaenge(laenge, einheit)}
          fontSize={schrift}
          fontStyle="600"
          fill="#1d4ed8"
          listening={false}
        />
      )}

      {enden.map(({ punkt, index }) => (
        <Circle
          key={index}
          x={punkt.x}
          y={punkt.y}
          radius={griff}
          fill="#ffffff"
          stroke="#1d4ed8"
          strokeWidth={2 / zoom}
          draggable
          onDragStart={(e) => {
            e.cancelBubble = true;
            beiZiehStart();
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const roh = einrasten({ x: e.target.x(), y: e.target.y() });
            // Die Richtung halten: Nur entlang der Wandachse wird gezogen.
            const fest = index === 0 ? wand.bis : wand.von;
            const ziel = waagerecht ? { x: roh.x, y: fest.y } : { x: fest.x, y: roh.y };
            e.target.position(ziel);
            beiZiehen(index, ziel);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            beiZiehEnde();
          }}
          onMouseEnter={(e) => {
            const buehne = e.target.getStage();
            if (buehne) buehne.container().style.cursor = waagerecht ? 'ew-resize' : 'ns-resize';
          }}
          onMouseLeave={(e) => {
            const buehne = e.target.getStage();
            if (buehne) buehne.container().style.cursor = '';
          }}
        />
      ))}
    </Group>
  );
}
