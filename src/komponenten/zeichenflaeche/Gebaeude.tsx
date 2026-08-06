import { Group, Rect, Text } from 'react-konva';
import type { Grundflaeche, Massinheit } from '../../typen/modell';
import { formatiereLaenge } from '../../logik/masse';

/**
 * Der Gebäudeumriss: Boden, Außenwand und die beiden Außenmaße.
 *
 * Die Wand wird als Rahmenlinie gezeichnet. Ihre Strichstärke entspricht genau
 * der eingestellten Wandstärke, deshalb liegt das Rechteck um eine halbe
 * Wandstärke nach innen versetzt – so endet die Außenkante exakt beim Maß 0.
 */
interface Props {
  grundflaeche: Grundflaeche;
  einheit: Massinheit;
  /** Bildschirmpunkte pro Zentimeter – für gleichbleibend große Schrift. */
  zoom: number;
}

export function Gebaeude({ grundflaeche, einheit, zoom }: Props) {
  const { breite, laenge, wandstaerke } = grundflaeche;
  // Schriftgröße so umrechnen, dass sie auf dem Bildschirm immer gleich groß ist.
  const schrift = 13 / zoom;
  const abstand = 22 / zoom;

  return (
    <Group listening={false}>
      {/* Bodenfläche */}
      <Rect x={0} y={0} width={breite} height={laenge} fill="#fbfbfa" />

      {/* Schlagschatten-Andeutung für einen ruhigen, plastischen Eindruck */}
      <Rect
        x={0}
        y={0}
        width={breite}
        height={laenge}
        shadowColor="#2b3542"
        shadowBlur={18 / zoom}
        shadowOpacity={0.18}
        shadowOffsetY={4 / zoom}
        listening={false}
      />

      {/* Außenwand */}
      <Rect
        x={wandstaerke / 2}
        y={wandstaerke / 2}
        width={Math.max(0, breite - wandstaerke)}
        height={Math.max(0, laenge - wandstaerke)}
        stroke="#3c4650"
        strokeWidth={wandstaerke}
      />

      {/* Maßangabe Breite (oberhalb des Gebäudes) */}
      <Text
        x={0}
        y={-abstand - schrift}
        width={breite}
        align="center"
        text={`${formatiereLaenge(breite, einheit)}`}
        fontSize={schrift}
        fill="#5d6874"
      />

      {/* Maßangabe Länge (links neben dem Gebäude, um 90° gedreht) */}
      <Text
        x={-abstand - schrift}
        y={laenge}
        width={laenge}
        align="center"
        rotation={-90}
        text={`${formatiereLaenge(laenge, einheit)}`}
        fontSize={schrift}
        fill="#5d6874"
      />
    </Group>
  );
}
