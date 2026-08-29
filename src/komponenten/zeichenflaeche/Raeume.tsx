import { Group, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { SCHRIFT_FLAECHE, lesbar } from '../../logik/beschriftung';
import { raumflaeche } from '../../logik/flaechen';
import { formatiereFlaeche, formatiereLaenge } from '../../logik/masse';
import { rahmen } from '../../logik/polygon';
import type { Massinheit, Raum } from '../../typen/modell';
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
  /** Für die Kantenmaße – Meter oder Zentimeter. */
  einheit: Massinheit;
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
  einheit,
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
          einheit={einheit}
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

/**
 * Für jede Kante des Raums ihr Maß, samt Lage und Drehung.
 *
 * Der Text läuft an der Kante entlang und wird nach innen gerückt – außen
 * läge er in der Wand oder im Nachbarraum. Kopfstehende Zahlen werden
 * umgedreht: Ein Maß, das man nur mit geneigtem Kopf liest, ist keins.
 */
export function kantenmasse(raum: Raum) {
  const mitte = raum.umriss.reduce(
    (s, p) => ({ x: s.x + p.x / raum.umriss.length, y: s.y + p.y / raum.umriss.length }),
    { x: 0, y: 0 },
  );

  return raum.umriss
    .map((a, i) => {
      const b = raum.umriss[(i + 1) % raum.umriss.length];
      const laenge = Math.hypot(b.x - a.x, b.y - a.y);
      // Unter 30 cm wäre die Zahl länger als die Kante, an der sie steht.
      if (laenge < 30) return null;

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const zurMitte = Math.hypot(mitte.x - mx, mitte.y - my);
      const ein = Math.min(raum.wandstaerke + 14, zurMitte * 0.5);
      const x = mx + (zurMitte > 0 ? ((mitte.x - mx) / zurMitte) * ein : 0);
      const y = my + (zurMitte > 0 ? ((mitte.y - my) / zurMitte) * ein : 0);

      let drehung = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (drehung > 90) drehung -= 180;
      if (drehung < -90) drehung += 180;

      return { x, y, laenge, drehung };
    })
    .filter((k): k is { x: number; y: number; laenge: number; drehung: number } => k !== null);
}

/**
 * Wo Name und Fläche stehen und wie groß.
 *
 * Die Schrift richtet sich nach dem Raum: In einem WC von 1,20 m Breite ist
 * dieselbe Größe wie im Lager schlicht zu groß, und der Text stünde quer
 * über der Wand. Passt gar nichts mehr hinein, bleibt die Beschriftung weg –
 * lieber kein Text als einer im Nachbarraum.
 */
export function beschriftungsplatz(raum: Raum, kasten: ReturnType<typeof rahmen>) {
  // Innen heißt: ohne die Wand, die nach innen gezeichnet wird.
  const rand = raum.wandstaerke + 8;
  const breite = kasten.rechts - kasten.links - 2 * rand;
  const hoehe = kasten.unten - kasten.oben - 2 * rand;
  if (breite < 40 || hoehe < 30) return null;

  const text = `${raum.name}\n${formatiereFlaeche(raumflaeche(raum))}`;
  const laengste = Math.max(...text.split('\n').map((z) => z.length));
  // Grob 0,55 Zeichenbreiten je Schriftgröße – genau genug, um zu verhindern,
  // dass der Text über den Rand läuft.
  const nachBreite = breite / (laengste * 0.55);
  const nachHoehe = hoehe / 2.6;
  const schrift = Math.min(SCHRIFT_FLAECHE, nachBreite, nachHoehe);

  return {
    schrift,
    x: kasten.links + rand,
    y: (kasten.oben + kasten.unten) / 2 - schrift * 1.25,
    breite,
    text,
  };
}

function RaumBild({
  raum,
  einheit,
  ausgewaehlt,
  zoom,
  anklickbar,
  beiKlick,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: {
  raum: Raum;
  einheit: Massinheit;
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
  const ziehbar = anklickbar && !raum.gesperrt;
  const kanten = kantenmasse(raum);
  const kantenschrift = SCHRIFT_FLAECHE * 0.62;
  const beschriftung = beschriftungsplatz(raum, kasten);

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
      {/* Bodenfläche – durchscheinend, damit das Raster darunter sichtbar
          bleibt. Die Farbe ordnet den Raum zu; sie soll ihn nicht zudecken,
          und beim Einpassen von Möbeln braucht man das Raster gerade da,
          wo eine Fläche liegt. */}
      <Line points={punkte} closed fill={raum.farbe} opacity={0.4} />

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

      {/* Kantenmaße: an jeder Kante ihre Länge, klein und nach innen
          gerückt. Beim Abzeichnen eines Bestandsplans zieht man den Raum
          auf, bis die Zahl stimmt – und dafür muss sie an der Kante stehen,
          nicht in einem Feld am Bildschirmrand. */}
      {lesbar(kantenschrift, zoom) &&
        kanten.map((kante, i) => (
          <Text
            key={i}
            listening={false}
            x={kante.x}
            y={kante.y}
            rotation={kante.drehung}
            offsetX={kante.laenge / 2}
            offsetY={kantenschrift * 1.15}
            width={kante.laenge}
            align="center"
            text={formatiereLaenge(kante.laenge, einheit)}
            fontSize={kantenschrift}
            fill="#7a8794"
          />
        ))}

      {/* Name und Fläche – mittig im Inneren, in einer Größe, die
          hineinpasst. Ein Text, der in die Wand oder in den Nachbarraum
          ragt, gehört sichtbar zum falschen Raum. */}
      {raum.beschriftungSichtbar && beschriftung && lesbar(beschriftung.schrift, zoom) && (
        <Text
          listening={false}
          x={beschriftung.x}
          y={beschriftung.y}
          width={beschriftung.breite}
          align="center"
          text={beschriftung.text}
          fontSize={beschriftung.schrift}
          lineHeight={1.25}
          fill="#42505f"
          fontStyle="bold"
        />
      )}
    </Group>
  );
}
