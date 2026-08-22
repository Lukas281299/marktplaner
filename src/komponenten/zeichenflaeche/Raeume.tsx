import { Group, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { SCHRIFT_FLAECHE, lesbar } from '../../logik/beschriftung';
import { raumflaeche } from '../../logik/flaechen';
import { formatiereFlaeche } from '../../logik/masse';
import { rahmen } from '../../logik/polygon';
import type { Raum } from '../../typen/modell';
import { flach } from './Gebaeude';

/**
 * Die abgetrennten Räume: Lager, Kühlhaus, Sozialräume.
 *
 * Sie liegen zwischen Gebäude und Einrichtung – die Regale sollen darauf
 * stehen können, aber der Raum soll den Boden abdecken.
 *
 * Die Wand wird wie beim Gebäude nach innen beschnitten gezeichnet: Der
 * Umriss ist das Außenmaß des Raums, so wie man ihn im Plan bemaßt.
 */
interface Props {
  raeume: Raum[];
  ausgewaehlt: string | null;
  zoom: number;
  /** Räume anklickbar? Beim Zeichnen von Flächen sollen sie nicht stören. */
  anklickbar: boolean;
  beiKlick: (id: string, e: KonvaEventObject<MouseEvent>) => void;
  beiZiehStart: (id: string) => void;
  beiZiehen: (id: string, dx: number, dy: number) => void;
  beiZiehEnde: () => void;
}

export function Raeume({
  raeume,
  ausgewaehlt,
  zoom,
  anklickbar,
  beiKlick,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: Props) {
  return (
    <>
      {raeume.map((raum) => (
        <RaumBild
          key={raum.id}
          raum={raum}
          ausgewaehlt={raum.id === ausgewaehlt}
          zoom={zoom}
          anklickbar={anklickbar}
          beiKlick={beiKlick}
          beiZiehStart={beiZiehStart}
          beiZiehen={beiZiehen}
          beiZiehEnde={beiZiehEnde}
        />
      ))}
    </>
  );
}

function RaumBild({
  raum,
  ausgewaehlt,
  zoom,
  anklickbar,
  beiKlick,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: {
  raum: Raum;
  ausgewaehlt: boolean;
  zoom: number;
  anklickbar: boolean;
  beiKlick: Props['beiKlick'];
  beiZiehStart: Props['beiZiehStart'];
  beiZiehen: Props['beiZiehen'];
  beiZiehEnde: Props['beiZiehEnde'];
}) {
  if (raum.umriss.length < 3) return null;

  const punkte = flach(raum.umriss);
  const kasten = rahmen(raum.umriss);
  const schrift = SCHRIFT_FLAECHE;
  const ziehbar = anklickbar && !raum.gesperrt;

  return (
    <Group
      draggable={ziehbar}
      listening={anklickbar}
      onMouseDown={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        beiKlick(raum.id, e);
      }}
      onDragStart={() => beiZiehStart(raum.id)}
      onDragMove={(e) => beiZiehen(raum.id, e.target.x(), e.target.y())}
      onDragEnd={(e) => {
        // Die Verschiebung steckt jetzt in den Punkten – die Gruppe selbst
        // muss wieder auf null, sonst käme sie doppelt zur Wirkung.
        e.target.position({ x: 0, y: 0 });
        beiZiehEnde();
      }}
    >
      {/* Bodenfläche */}
      <Line points={punkte} closed fill={raum.farbe} />

      {/* Wand nach innen beschnitten */}
      {raum.wandstaerke > 0 && (
        <Group
          clipFunc={(ctx) => {
            ctx.beginPath();
            ctx.moveTo(raum.umriss[0].x, raum.umriss[0].y);
            for (const p of raum.umriss.slice(1)) ctx.lineTo(p.x, p.y);
            ctx.closePath();
          }}
        >
          <Line points={punkte} closed stroke="#66707c" strokeWidth={raum.wandstaerke * 2} />
        </Group>
      )}

      {/* Auswahlrand */}
      {ausgewaehlt && (
        <Line
          points={punkte}
          closed
          listening={false}
          stroke="#0a84ff"
          strokeWidth={2 / zoom}
          dash={[8 / zoom, 5 / zoom]}
        />
      )}

      {/* Name und Fläche */}
      {raum.beschriftungSichtbar && lesbar(schrift, zoom) && (
        <Text
          listening={false}
          x={kasten.links}
          y={(kasten.oben + kasten.unten) / 2 - schrift}
          width={kasten.rechts - kasten.links}
          align="center"
          text={`${raum.name}\n${formatiereFlaeche(raumflaeche(raum))}`}
          fontSize={schrift}
          lineHeight={1.3}
          fill="#42505f"
          fontStyle="bold"
        />
      )}
    </Group>
  );
}
