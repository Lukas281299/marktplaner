import { Group, Line, Text } from 'react-konva';
import { formatiereLaenge } from '../../logik/masse';
import { masslaenge, massWinkel, versetzteLinie } from '../../logik/messen';
import type { Masslinie, Massinheit } from '../../typen/modell';

/**
 * Dauerhaft eingezeichnete Maße.
 *
 * Gezeichnet wie im Bauplan: zwei Hilfslinien von den gemessenen Punkten zur
 * Maßlinie, die Maßlinie selbst mit Schrägstrichen an den Enden, und die Zahl
 * darüber. Die Schrägstriche statt Pfeilen sind Absicht – so macht es die
 * Bauzeichnung, und bei kurzen Maßen bleibt es lesbar.
 */
interface Props {
  masslinien: Masslinie[];
  ausgewaehlt: string | null;
  einheit: Massinheit;
  zoom: number;
  anklickbar: boolean;
  beiKlick: (id: string) => void;
  beiZiehStart: () => void;
  beiZiehen: (id: string, dx: number, dy: number) => void;
  beiZiehEnde: () => void;
}

export function Masslinien({
  masslinien,
  ausgewaehlt,
  einheit,
  zoom,
  anklickbar,
  beiKlick,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: Props) {
  return (
    <>
      {masslinien.map((mass) => (
        <MassBild
          key={mass.id}
          mass={mass}
          ausgewaehlt={mass.id === ausgewaehlt}
          einheit={einheit}
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

function MassBild({
  mass,
  ausgewaehlt,
  einheit,
  zoom,
  anklickbar,
  beiKlick,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: {
  mass: Masslinie;
  ausgewaehlt: boolean;
  einheit: Massinheit;
  zoom: number;
  anklickbar: boolean;
  beiKlick: Props['beiKlick'];
  beiZiehStart: Props['beiZiehStart'];
  beiZiehen: Props['beiZiehen'];
  beiZiehEnde: Props['beiZiehEnde'];
}) {
  const laenge = masslaenge(mass);
  if (laenge < 0.5) return null;

  const linie = versetzteLinie(mass);
  const farbe = ausgewaehlt ? '#0a84ff' : '#2f3b49';
  const strich = 1.2 / zoom;
  const schrift = 13 / zoom;
  const winkel = massWinkel(mass);

  // Die Schrägstriche an den Enden – 45° zur Maßlinie.
  const richtungX = (linie.bis.x - linie.von.x) / laenge;
  const richtungY = (linie.bis.y - linie.von.y) / laenge;
  const halb = 7 / zoom;
  const schraeg = (p: { x: number; y: number }) => [
    p.x - (richtungX + richtungY) * halb,
    p.y - (richtungY - richtungX) * halb,
    p.x + (richtungX + richtungY) * halb,
    p.y + (richtungY - richtungX) * halb,
  ];

  const mitte = { x: (linie.von.x + linie.bis.x) / 2, y: (linie.von.y + linie.bis.y) / 2 };

  return (
    <Group
      draggable={anklickbar && !mass.gesperrt}
      listening={anklickbar}
      onMouseDown={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        beiKlick(mass.id);
      }}
      onDragStart={beiZiehStart}
      onDragMove={(e) => beiZiehen(mass.id, e.target.x(), e.target.y())}
      onDragEnd={(e) => {
        e.target.position({ x: 0, y: 0 });
        beiZiehEnde();
      }}
    >
      {/* Hilfslinien von den gemessenen Punkten zur Maßlinie */}
      {mass.versatz !== 0 && (
        <>
          <Line
            points={[mass.von.x, mass.von.y, linie.von.x, linie.von.y]}
            stroke={farbe}
            strokeWidth={strich * 0.7}
            dash={[5 / zoom, 4 / zoom]}
          />
          <Line
            points={[mass.bis.x, mass.bis.y, linie.bis.x, linie.bis.y]}
            stroke={farbe}
            strokeWidth={strich * 0.7}
            dash={[5 / zoom, 4 / zoom]}
          />
        </>
      )}

      {/* Die Maßlinie */}
      <Line
        points={[linie.von.x, linie.von.y, linie.bis.x, linie.bis.y]}
        stroke={farbe}
        strokeWidth={strich}
      />
      <Line points={schraeg(linie.von)} stroke={farbe} strokeWidth={strich} />
      <Line points={schraeg(linie.bis)} stroke={farbe} strokeWidth={strich} />

      {/* Die Maßzahl, mittig über der Linie */}
      <Text
        listening={false}
        x={mitte.x}
        y={mitte.y}
        width={Math.max(laenge, 260 / zoom)}
        offsetX={Math.max(laenge, 260 / zoom) / 2}
        offsetY={schrift + 4 / zoom}
        rotation={winkel}
        align="center"
        text={mass.text || formatiereLaenge(laenge, einheit)}
        fontSize={schrift}
        fill={farbe}
        fontStyle="bold"
      />

      {/* Breiterer, unsichtbarer Streifen zum Anfassen */}
      <Line
        points={[linie.von.x, linie.von.y, linie.bis.x, linie.bis.y]}
        stroke="transparent"
        strokeWidth={16 / zoom}
      />
    </Group>
  );
}
