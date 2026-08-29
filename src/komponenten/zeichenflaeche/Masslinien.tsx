import { Group, Line, Text } from 'react-konva';
import { SCHRIFT_MASS, lesbar, textbreite } from '../../logik/beschriftung';
import { formatiereLaenge } from '../../logik/masse';
import { masslaenge, massWinkel, versetzteLinie } from '../../logik/messen';
import type { Masslinie, Massinheit } from '../../typen/modell';

/**
 * Dauerhaft eingezeichnete Maße.
 *
 * Gezeichnet wie eine Bemaßung von Hand: zwei Hilfslinien von den gemessenen
 * Punkten zur Maßlinie, an den Enden je ein Pfeil nach außen, und dazwischen
 * die Zahl – auf der Linie, nicht darüber. Die Linie macht dafür in der Mitte
 * Platz.
 *
 * Ist das Maß kürzer als die Zahl, rücken die Pfeile nach außen und zeigen
 * nach innen: `>|--|<` statt `|<--->|`. Sonst stünde die Zahl über den Pfeilen
 * und man läse beides schlechter.
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
  const schrift = SCHRIFT_MASS;
  const winkel = massWinkel(mass);

  const richtungX = (linie.bis.x - linie.von.x) / laenge;
  const richtungY = (linie.bis.y - linie.von.y) / laenge;
  const mitte = { x: (linie.von.x + linie.bis.x) / 2, y: (linie.von.y + linie.bis.y) / 2 };

  const beschriftung = mass.text || formatiereLaenge(laenge, einheit);
  // Wie viel Platz die Zahl auf der Linie braucht, samt etwas Luft.
  const zahlbreite = textbreite(beschriftung, schrift) + 10 / zoom;
  // Passt sie zwischen die Pfeile? Sonst wird von außen bemaßt.
  const innen = laenge > zahlbreite + 40 / zoom;

  /**
   * Eine Pfeilspitze an `p`, zeigend in Richtung `zeichen`.
   *
   * Zwei kurze Striche im Winkel zur Maßlinie – schlicht, weil eine
   * ausgefüllte Spitze bei kleinem Zoom nur ein Fleck wäre.
   */
  const spitze = (p: { x: number; y: number }, zeichen: 1 | -1) => {
    const lang = 9 / zoom;
    const quer = 3.4 / zoom;
    // Der Fußpunkt der Spitze, ein Stück in Zeichenrichtung.
    const fx = p.x + richtungX * lang * zeichen;
    const fy = p.y + richtungY * lang * zeichen;
    // Und quer dazu die beiden Flügel.
    return [
      fx - richtungY * quer,
      fy + richtungX * quer,
      p.x,
      p.y,
      fx + richtungY * quer,
      fy - richtungX * quer,
    ];
  };

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

      {/* Die Maßlinie – in der Mitte unterbrochen, dort steht die Zahl. */}
      {innen && lesbar(schrift, zoom) ? (
        <>
          <Line
            points={[
              linie.von.x,
              linie.von.y,
              mitte.x - richtungX * (zahlbreite / 2),
              mitte.y - richtungY * (zahlbreite / 2),
            ]}
            stroke={farbe}
            strokeWidth={strich}
          />
          <Line
            points={[
              mitte.x + richtungX * (zahlbreite / 2),
              mitte.y + richtungY * (zahlbreite / 2),
              linie.bis.x,
              linie.bis.y,
            ]}
            stroke={farbe}
            strokeWidth={strich}
          />
        </>
      ) : (
        <Line
          points={[linie.von.x, linie.von.y, linie.bis.x, linie.bis.y]}
          stroke={farbe}
          strokeWidth={strich}
        />
      )}

      {/* Die Pfeile an den Enden. Nach außen, solange das Maß dafür lang
          genug ist – bei einem kurzen zeigen sie von außen herein. */}
      <Line points={spitze(linie.von, innen ? 1 : -1)} stroke={farbe} strokeWidth={strich} />
      <Line points={spitze(linie.bis, innen ? -1 : 1)} stroke={farbe} strokeWidth={strich} />

      {/* Die Maßzahl, mittig über der Linie. Zu klein zum Lesen wird sie
          weggelassen – ein Fleck aus vier Bildpunkten ist keine Zahl. */}
      {lesbar(schrift, zoom) && (
        <Text
          listening={false}
          x={mitte.x}
          y={mitte.y}
          width={Math.max(laenge, 260 / zoom)}
          offsetX={Math.max(laenge, 260 / zoom) / 2}
          /* Auf der Linie, wenn sie dafür Platz gemacht hat – sonst darüber. */
          offsetY={innen ? schrift / 2 : schrift + 4 / zoom}
          rotation={winkel}
          align="center"
          text={beschriftung}
          fontSize={schrift}
          fill={farbe}
          fontStyle="bold"
        />
      )}

      {/* Breiterer, unsichtbarer Streifen zum Anfassen */}
      <Line
        points={[linie.von.x, linie.von.y, linie.bis.x, linie.bis.y]}
        stroke="transparent"
        strokeWidth={16 / zoom}
      />
    </Group>
  );
}
