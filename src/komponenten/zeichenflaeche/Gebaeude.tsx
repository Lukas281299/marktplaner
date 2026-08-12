import { Group, Line, Text } from 'react-konva';
import type { Grundflaeche, Massinheit, Punkt } from '../../typen/modell';
import { formatiereLaenge } from '../../logik/masse';
import { kanten, kantenVersatz } from '../../logik/polygon';

/**
 * Der Gebäudeumriss: Boden, Außenwand und die Maße an jeder Wand.
 *
 * Die Wand liegt vollständig **innerhalb** des Umrisses – der Umriss ist also
 * das Außenmaß, so wie man einen Markt auch aufmisst. Umgesetzt wird das über
 * eine Beschneidung: Gezeichnet wird eine doppelt so dicke Linie auf den
 * Umriss, und was nach außen übersteht, wird weggeschnitten. Das ist der
 * einzige Weg, der auch bei einspringenden Ecken sauber bleibt – ein nach
 * innen versetztes Polygon auszurechnen geht dort regelmäßig schief.
 */
interface Props {
  grundflaeche: Grundflaeche;
  einheit: Massinheit;
  /** Bildschirmpunkte pro Zentimeter – für gleichbleibend große Schrift. */
  zoom: number;
}

/** Wandelt Punkte in die flache Zahlenliste, die Konva erwartet. */
export function flach(punkte: Punkt[]): number[] {
  return punkte.flatMap((p) => [p.x, p.y]);
}

/**
 * Platziert eine Maßzahl neben einer Wandkante.
 *
 * Über `offsetX`/`offsetY` liegt der Drehpunkt genau in der Mitte des
 * Textfeldes – dadurch stimmt die Lage bei jedem Winkel, ohne für waagerecht,
 * senkrecht und schräg drei Sonderfälle zu rechnen.
 *
 * Der Text wird nie auf den Kopf gestellt: Bei einer Kante, die nach links
 * läuft, wird um 180° gedreht. Das ist im Bauzeichnen so üblich und erspart
 * das Kopfdrehen vor dem Bildschirm.
 */
export function massAnKante(
  kante: ReturnType<typeof kanten>[number],
  umriss: Punkt[],
  schrift: number,
  zoom: number,
) {
  const stelle = kantenVersatz(kante, 24 / zoom + schrift / 2, umriss);
  const winkel =
    (Math.atan2(kante.bis.y - kante.von.y, kante.bis.x - kante.von.x) * 180) / Math.PI;
  const lesbar = winkel > 90 || winkel <= -90 ? winkel + 180 : winkel;

  return {
    x: stelle.x,
    y: stelle.y,
    width: kante.laenge,
    offsetX: kante.laenge / 2,
    offsetY: schrift / 2,
    rotation: lesbar,
  };
}

export function Gebaeude({ grundflaeche, einheit, zoom }: Props) {
  const { umriss, wandstaerke } = grundflaeche;
  if (umriss.length < 3) return null;

  const punkte = flach(umriss);
  const schrift = 13 / zoom;

  return (
    <Group listening={false}>
      {/* Bodenfläche mit angedeutetem Schlagschatten */}
      <Line
        points={punkte}
        closed
        fill="#fbfbfa"
        shadowColor="#2b3542"
        shadowBlur={18 / zoom}
        shadowOpacity={0.18}
        shadowOffsetY={4 / zoom}
      />

      {/* Außenwand – nach innen beschnitten */}
      <Group
        clipFunc={(ctx) => {
          ctx.beginPath();
          ctx.moveTo(umriss[0].x, umriss[0].y);
          for (const p of umriss.slice(1)) ctx.lineTo(p.x, p.y);
          ctx.closePath();
        }}
      >
        <Line points={punkte} closed stroke="#3c4650" strokeWidth={wandstaerke * 2} />
      </Group>

      {/* Maß an jeder Wand */}
      {kanten(umriss).map((kante) => {
        // Ganz kurze Kanten würden sich nur gegenseitig überschreiben.
        if (kante.laenge * zoom < 34) return null;
        return (
          <Text
            key={`mass-${kante.index}`}
            {...massAnKante(kante, umriss, schrift, zoom)}
            text={formatiereLaenge(kante.laenge, einheit)}
            fontSize={schrift}
            fill="#5d6874"
            align="center"
          />
        );
      })}
    </Group>
  );
}
