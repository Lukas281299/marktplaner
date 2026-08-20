import { Group, Line, Shape, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { formatiereFlaeche } from '../../logik/masse';
import { flaeche, rahmen } from '../../logik/polygon';
import type { Verkaufsflaeche } from '../../typen/modell';
import { flach } from './Gebaeude';

/**
 * Die eingezeichnete Verkaufsfläche.
 *
 * Anders als ein Raum ist das **keine Bodenfläche, sondern eine Markierung**:
 * Sie liegt über dem Boden und den Räumen, aber unter der Einrichtung. Die
 * Regale müssen darauf stehen können – sonst wäre die Markierung genau dort
 * im Weg, wo man hinsieht.
 *
 * Gezeichnet wird sie deshalb durchscheinend und schraffiert. Eine deckende
 * Fläche würde man für einen Raum halten; die Schraffur sagt: hier ist etwas
 * markiert, nicht gebaut.
 */
interface Props {
  flaechen: Verkaufsflaeche[];
  ausgewaehlt: string | null;
  zoom: number;
  /** Anklickbar? Beim Zeichnen sollen die fertigen Flächen nicht stören. */
  anklickbar: boolean;
  beiKlick: (id: string, e: KonvaEventObject<MouseEvent>) => void;
  beiZiehStart: (id: string) => void;
  beiZiehen: (id: string, dx: number, dy: number) => void;
  beiZiehEnde: () => void;
}

/**
 * Abstand der Schraffurlinien in cm.
 *
 * Fest im Planmaß wäre die Schraffur beim Herauszoomen ein grauer Brei und
 * beim Hineinzoomen kaum zu sehen. Deshalb wird sie nach unten hin am
 * Bildschirmabstand festgehalten: nie enger als rund 13 Bildpunkte.
 */
function schraffurabstand(zoom: number): number {
  return Math.max(60, 13 / Math.max(zoom, 0.001));
}

export function Verkaufsflaechen({
  flaechen,
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
      {flaechen.map((f) => (
        <VerkaufsflaecheBild
          key={f.id}
          flaeche={f}
          ausgewaehlt={f.id === ausgewaehlt}
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

function VerkaufsflaecheBild({
  flaeche: markierung,
  ausgewaehlt,
  zoom,
  anklickbar,
  beiKlick,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: {
  flaeche: Verkaufsflaeche;
  ausgewaehlt: boolean;
  zoom: number;
  anklickbar: boolean;
  beiKlick: Props['beiKlick'];
  beiZiehStart: Props['beiZiehStart'];
  beiZiehen: Props['beiZiehen'];
  beiZiehEnde: Props['beiZiehEnde'];
}) {
  if (markierung.umriss.length < 3) return null;

  const punkte = flach(markierung.umriss);
  const kasten = rahmen(markierung.umriss);
  const schrift = 14 / zoom;
  const ziehbar = anklickbar && !markierung.gesperrt;

  const pfad = (ctx: Konva.Context) => {
    ctx.beginPath();
    ctx.moveTo(markierung.umriss[0].x, markierung.umriss[0].y);
    for (const p of markierung.umriss.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  };

  return (
    <Group
      draggable={ziehbar}
      listening={anklickbar}
      onMouseDown={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        beiKlick(markierung.id, e);
      }}
      onDragStart={() => beiZiehStart(markierung.id)}
      onDragMove={(e) => beiZiehen(markierung.id, e.target.x(), e.target.y())}
      onDragEnd={(e) => {
        // Die Verschiebung steckt jetzt in den Punkten – die Gruppe selbst
        // muss wieder auf null, sonst käme sie doppelt zur Wirkung.
        e.target.position({ x: 0, y: 0 });
        beiZiehEnde();
      }}
    >
      {/* Durchscheinender Grund */}
      <Line points={punkte} closed fill={markierung.farbe} opacity={0.1} listening={anklickbar} />

      {/* Schraffur, am Umriss beschnitten */}
      <Group clipFunc={pfad} listening={false}>
        <Shape
          listening={false}
          stroke={markierung.farbe}
          strokeWidth={1 / zoom}
          opacity={0.45}
          sceneFunc={(ctx, form) => {
            const abstand = schraffurabstand(zoom);
            const breite = kasten.rechts - kasten.links;
            const hoehe = kasten.unten - kasten.oben;
            ctx.beginPath();
            // Linien unter 45 Grad: alle liegen auf x + y = c.
            for (let c = 0; c <= breite + hoehe; c += abstand) {
              const x1 = kasten.links + Math.max(0, c - hoehe);
              const x2 = kasten.links + Math.min(breite, c);
              if (x2 - x1 < 0.01) continue;
              ctx.moveTo(x1, kasten.oben + c - (x1 - kasten.links));
              ctx.lineTo(x2, kasten.oben + c - (x2 - kasten.links));
            }
            ctx.strokeShape(form);
          }}
        />
      </Group>

      {/* Rand: die Linie, um die es beim Markieren geht */}
      <Line
        points={punkte}
        closed
        listening={false}
        stroke={markierung.farbe}
        strokeWidth={2 / zoom}
      />

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
      {markierung.beschriftungSichtbar && (
        <Text
          listening={false}
          x={kasten.links}
          y={(kasten.oben + kasten.unten) / 2 - schrift}
          width={kasten.rechts - kasten.links}
          align="center"
          text={`${markierung.name}\n${formatiereFlaeche(flaeche(markierung.umriss))}`}
          fontSize={schrift}
          lineHeight={1.3}
          fill={markierung.farbe}
          fontStyle="bold"
        />
      )}
    </Group>
  );
}
