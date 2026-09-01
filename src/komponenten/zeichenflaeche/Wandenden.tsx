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
 * Gezogen wird immer nur ein Ende; das andere bleibt, wo es ist. **Die
 * Richtung darf sich dabei ändern** – so dreht man eine Wand in die Schräge.
 * Vorher war das Ende auf die Achse festgenagelt: Eine waagerechte Wand blieb
 * waagerecht, egal wohin man zog, und eine abgeschrägte Ecke ließ sich
 * überhaupt nicht bauen.
 *
 * Damit trotzdem gerade Winkel herauskommen, rastet `einrasten` das Ende ein –
 * an Grundrissecken, sonst auf Vielfachen von 15°, sonst am Raster.
 */
interface Props {
  wand: Wand;
  zoom: number;
  einheit: Massinheit;
  /**
   * Rastet das gezogene Ende ein. `fest` ist das andere Ende – der
   * Drehpunkt, aus dem sich der Winkel ergibt.
   */
  einrasten: (p: Punkt, fest: Punkt) => Punkt;
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

  /**
   * Der Winkel der Wand, nie auf dem Kopf.
   *
   * Das Maß läuft an der Wand entlang und steht quer daneben – bei einer
   * Schräge genauso wie bei einer waagerechten Wand. Vorher gab es nur zwei
   * Fälle, waagerecht und senkrecht, und eine 45°-Wand bekam ihre Zahl
   * irgendwo an die Seite gestellt.
   */
  let drehung = (Math.atan2(wand.bis.y - wand.von.y, wand.bis.x - wand.von.x) * 180) / Math.PI;
  if (drehung > 90) drehung -= 180;
  if (drehung <= -90) drehung += 180;
  const bogen = (drehung * Math.PI) / 180;
  // Quer zur Wand: die Normale, um die halbe Wandstärke plus Luft nach oben.
  const quer = wand.staerke / 2 + luft + schrift;
  const versatzX = Math.sin(bogen) * quer;
  const versatzY = -Math.cos(bogen) * quer;

  const enden: { punkt: Punkt; index: 0 | 1 }[] = [
    { punkt: wand.von, index: 0 },
    { punkt: wand.bis, index: 1 },
  ];

  return (
    <Group listening>
      {/* Das Maß **neben** der Wand, nicht darin: an ihr entlang gedreht
          und quer zu ihr herausgerückt. Das gilt für jede Richtung – eine
          Schräge bekommt ihre Zahl schräg daneben, so wie im Bauplan. */}
      <Text
        x={mitte.x + versatzX}
        y={mitte.y + versatzY}
        offsetX={laenge / 2}
        offsetY={schrift / 2}
        rotation={drehung}
        width={laenge}
        align="center"
        text={formatiereLaenge(laenge, einheit)}
        fontSize={schrift}
        fontStyle="600"
        fill="#1d4ed8"
        listening={false}
      />

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
            // Das feste Ende ist der Drehpunkt; `einrasten` entscheidet, wo
            // das gezogene landen darf.
            const fest = index === 0 ? wand.bis : wand.von;
            const ziel = einrasten({ x: e.target.x(), y: e.target.y() }, fest);
            e.target.position(ziel);
            beiZiehen(index, ziel);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            beiZiehEnde();
          }}
          onMouseEnter={(e) => {
            const buehne = e.target.getStage();
            if (buehne) buehne.container().style.cursor = 'move';
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
