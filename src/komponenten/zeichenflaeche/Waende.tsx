import { Group, Line } from 'react-konva';
import type { Wand } from '../../typen/modell';

/**
 * Freistehende Innenwände.
 *
 * Eine Wand ist eine dicke Linie auf ihrer Achse – anders als beim Gebäude
 * und bei Räumen wird hier nichts beschnitten: Eine freistehende Wand hat
 * keine Innen- und Außenseite, sie steht mittig auf ihrer Linie.
 *
 * `lineCap="butt"` ist wichtig: Mit abgerundeten Enden ragte jede Wand um eine
 * halbe Wandstärke über ihren Endpunkt hinaus, und zwei rechtwinklig
 * aneinanderstoßende Wände hätten eine sichtbare Beule in der Ecke.
 */
interface Props {
  waende: Wand[];
  ausgewaehlt: string | null;
  zoom: number;
  anklickbar: boolean;
  beiKlick: (id: string) => void;
  beiZiehStart: (id: string) => void;
  beiZiehen: (id: string, x: number, y: number) => void;
  beiZiehEnde: () => void;
}

/** Wie eine Wandart aussieht. */
const FARBEN: Record<Wand['art'], string> = {
  tragend: '#3c4650',
  trennwand: '#66707c',
  leicht: '#98a1ab',
};

export function Waende({
  waende,
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
      {waende.map((wand) => {
        const punkte = [wand.von.x, wand.von.y, wand.bis.x, wand.bis.y];
        return (
          <Group
            key={wand.id}
            draggable={anklickbar && !wand.gesperrt}
            listening={anklickbar}
            onMouseDown={(e) => {
              if (e.evt.button !== 0) return;
              e.cancelBubble = true;
              beiKlick(wand.id);
            }}
            onDragStart={() => beiZiehStart(wand.id)}
            onDragMove={(e) => beiZiehen(wand.id, e.target.x(), e.target.y())}
            onDragEnd={(e) => {
              // Die Verschiebung steckt jetzt in den Punkten – die Gruppe
              // selbst muss zurück auf null, sonst wirkt sie doppelt.
              e.target.position({ x: 0, y: 0 });
              beiZiehEnde();
            }}
          >
            <Line
              points={punkte}
              stroke={FARBEN[wand.art]}
              strokeWidth={wand.staerke}
              lineCap="butt"
            />
            {/* Unsichtbarer, dickerer Streifen zum Anfassen: Eine 10 cm
                dünne Wand trifft man sonst bei kleinem Zoom nicht. */}
            <Line points={punkte} stroke="transparent" strokeWidth={Math.max(wand.staerke, 14 / zoom)} />
            {wand.id === ausgewaehlt && (
              <Line
                listening={false}
                points={punkte}
                stroke="#0a84ff"
                strokeWidth={wand.staerke + 4 / zoom}
                opacity={0.35}
                lineCap="butt"
              />
            )}
          </Group>
        );
      })}
    </>
  );
}
