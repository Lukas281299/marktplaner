import { Group, Line, Rect, Shape, Text } from 'react-konva';
import type { Oeffnung } from '../../typen/modell';

/**
 * Türen, Durchgänge und Tore.
 *
 * Eine Öffnung tut zweierlei: Sie **unterbricht** die Wand darunter, indem sie
 * ein Stück Bodenfarbe darüberlegt, und sie zeichnet darauf ihr Symbol. Weil
 * sie in einer eigenen Ebene über Gebäude, Räumen und Wänden liegt, wirkt das
 * bei allen dreien gleich – ohne dass eine Öffnung wissen müsste, in welcher
 * Wand sie eigentlich sitzt.
 *
 * Alles wird in örtlichen Koordinaten um den Nullpunkt gezeichnet: x nach
 * rechts entlang der Wand, y quer dazu. Die Gruppe erledigt Verschieben und
 * Drehen. Dadurch sieht jedes Symbol gleich aus, egal wie die Wand liegt.
 */
interface Props {
  oeffnungen: Oeffnung[];
  ausgewaehlt: string | null;
  zoom: number;
  anklickbar: boolean;
  /** Farbe des Bodens – damit wird die Wand ausgestanzt. */
  bodenfarbe: string;
  beiKlick: (id: string) => void;
  beiZiehStart: (id: string) => void;
  /**
   * Meldet die neue Lage und gibt zurück, wo die Öffnung wirklich landet.
   *
   * Der Rückgabewert ist nötig, weil Konva den gezogenen Knoten selbst
   * weiterbewegt. Wird die Lage nur im Speicher berichtigt, läuft der Knoten
   * der Maus hinterher und die Wand darunter zuckt.
   */
  beiZiehen: (id: string, x: number, y: number) => { x: number; y: number };
  beiZiehEnde: (id: string) => void;
}

export function Oeffnungen({
  oeffnungen,
  ausgewaehlt,
  zoom,
  anklickbar,
  bodenfarbe,
  beiKlick,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: Props) {
  return (
    <>
      {oeffnungen.map((oeffnung) => (
        <OeffnungBild
          key={oeffnung.id}
          oeffnung={oeffnung}
          ausgewaehlt={oeffnung.id === ausgewaehlt}
          zoom={zoom}
          anklickbar={anklickbar}
          bodenfarbe={bodenfarbe}
          beiKlick={beiKlick}
          beiZiehStart={beiZiehStart}
          beiZiehen={beiZiehen}
          beiZiehEnde={beiZiehEnde}
        />
      ))}
    </>
  );
}

function OeffnungBild({
  oeffnung,
  ausgewaehlt,
  zoom,
  anklickbar,
  bodenfarbe,
  beiKlick,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: {
  oeffnung: Oeffnung;
  ausgewaehlt: boolean;
  zoom: number;
  anklickbar: boolean;
  bodenfarbe: string;
  beiKlick: Props['beiKlick'];
  beiZiehStart: Props['beiZiehStart'];
  beiZiehen: Props['beiZiehen'];
  beiZiehEnde: Props['beiZiehEnde'];
}) {
  const { breite: b, tiefe: t } = oeffnung;
  const halbB = b / 2;
  const halbT = t / 2;
  const strich = 1.4 / zoom;
  // Auf welche Seite die Tür aufschlägt.
  const seite = oeffnung.gespiegelt ? -1 : 1;

  return (
    <Group
      x={oeffnung.x}
      y={oeffnung.y}
      rotation={oeffnung.drehung}
      draggable={anklickbar && !oeffnung.gesperrt}
      listening={anklickbar}
      onMouseDown={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        beiKlick(oeffnung.id);
      }}
      onDragStart={() => beiZiehStart(oeffnung.id)}
      onDragMove={(e) => {
        const lage = beiZiehen(oeffnung.id, e.target.x(), e.target.y());
        e.target.position(lage);
      }}
      onDragEnd={() => beiZiehEnde(oeffnung.id)}
    >
      {/* 1. Die Wand ausstanzen */}
      <Rect x={-halbB} y={-halbT} width={b} height={t} fill={bodenfarbe} />

      {/* 2. Die Laibungen – die beiden Wandenden links und rechts */}
      <Line points={[-halbB, -halbT, -halbB, halbT]} stroke="#3c4650" strokeWidth={strich} />
      <Line points={[halbB, -halbT, halbB, halbT]} stroke="#3c4650" strokeWidth={strich} />

      {/* 3. Das Symbol */}
      {oeffnung.art === 'tuer' && <Tuerblatt breite={b} seite={seite} strich={strich} />}

      {oeffnung.art === 'doppeltuer' && (
        <>
          <Tuerblatt breite={halbB} seite={seite} strich={strich} versatz={-halbB} />
          <Tuerblatt breite={halbB} seite={seite} strich={strich} versatz={halbB} gespiegeltX />
        </>
      )}

      {oeffnung.art === 'schiebetuer' && (
        <>
          {/* Das Blatt liegt neben der Öffnung an der Wand. */}
          <Line
            points={[-halbB, seite * halbT, halbB, seite * halbT]}
            stroke="#3c4650"
            strokeWidth={strich * 2}
          />
          <Line
            points={[0, seite * halbT, halbB * 0.8, seite * halbT]}
            stroke="#3c4650"
            strokeWidth={strich}
          />
          <Line
            points={[halbB * 0.8 - b * 0.08, seite * halbT - b * 0.05, halbB * 0.8, seite * halbT, halbB * 0.8 - b * 0.08, seite * halbT + b * 0.05]}
            stroke="#3c4650"
            strokeWidth={strich}
          />
        </>
      )}

      {oeffnung.art === 'rolltor' && (
        <Shape
          stroke="#3c4650"
          strokeWidth={strich}
          sceneFunc={(ctx, shape) => {
            // Zickzack quer durch die Öffnung – so zeichnet man ein Rolltor.
            ctx.beginPath();
            const schritte = Math.max(4, Math.round(b / 40));
            for (let i = 0; i <= schritte; i++) {
              const x = -halbB + (b * i) / schritte;
              const y = i % 2 === 0 ? -halbT : halbT;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.strokeShape(shape);
          }}
        />
      )}

      {oeffnung.art === 'fenster' && (
        <>
          <Line points={[-halbB, -halbT / 2, halbB, -halbT / 2]} stroke="#3c4650" strokeWidth={strich} />
          <Line points={[-halbB, halbT / 2, halbB, halbT / 2]} stroke="#3c4650" strokeWidth={strich} />
        </>
      )}

      {/* 'durchgang' bekommt bewusst kein Symbol – ein Durchgang ist ein Loch
          in der Wand, mehr nicht. */}

      {/* 4. Auswahl */}
      {ausgewaehlt && (
        <Rect
          listening={false}
          x={-halbB}
          y={-halbT}
          width={b}
          height={t}
          stroke="#0a84ff"
          strokeWidth={2 / zoom}
        />
      )}

      {oeffnung.beschriftung && (
        <Text
          listening={false}
          x={-halbB}
          y={-halbT - 15 / zoom}
          width={b}
          align="center"
          text={oeffnung.beschriftung}
          fontSize={11 / zoom}
          fill="#5d6874"
        />
      )}

      {/* Ein unsichtbarer Streifen zum Anfassen: Eine 30 cm tiefe Öffnung
          trifft man bei kleinem Zoom sonst nicht. */}
      <Rect
        x={-halbB}
        y={-Math.max(halbT, 9 / zoom)}
        width={b}
        height={Math.max(t, 18 / zoom)}
        fill="transparent"
      />
    </Group>
  );
}

/**
 * Ein einzelnes Türblatt mit Aufschlagbogen.
 *
 * Das Scharnier sitzt links (bzw. rechts bei `gespiegeltX`), das Blatt steht
 * im rechten Winkel offen, und der Bogen zeigt, wo die Tür beim Aufgehen
 * hinschwenkt. So zeichnet man Türen im Grundriss – daran erkennt man auf
 * einen Blick, ob eine Tür genug Platz hat.
 */
function Tuerblatt({
  breite,
  seite,
  strich,
  versatz = 0,
  gespiegeltX = false,
}: {
  breite: number;
  seite: number;
  strich: number;
  versatz?: number;
  gespiegeltX?: boolean;
}) {
  const halb = breite / 2;
  // Das Scharnier liegt am äußeren Ende des Blattes.
  const scharnier = versatz + (gespiegeltX ? halb : -halb);
  const richtung = gespiegeltX ? -1 : 1;

  return (
    <>
      {/* Das Blatt, im rechten Winkel offen */}
      <Line
        points={[scharnier, 0, scharnier, seite * breite]}
        stroke="#3c4650"
        strokeWidth={strich * 1.6}
      />
      {/* Der Aufschlagbogen */}
      <Shape
        stroke="#3c4650"
        strokeWidth={strich}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          // Vom offenen Blatt bis zur geschlossenen Lage an der Wand –
          // ein Viertelkreis, nie mehr.
          //
          // Die Umlaufrichtung ist hier der ganze Trick. Sie stand vorher
          // genau falsch herum, und zwar in allen vier Fällen: Der Bogen
          // nahm dann den langen Weg um den Kreis und schwenkte 270 Grad
          // statt 90. Im Plan sah das aus, als brauche jede Tür den halben
          // Gang.
          const vonWinkel = seite > 0 ? Math.PI / 2 : -Math.PI / 2;
          const bisWinkel = gespiegeltX ? Math.PI : 0;
          ctx.arc(scharnier, 0, breite, vonWinkel, bisWinkel, (seite > 0) !== gespiegeltX);
          ctx.strokeShape(shape);
        }}
      />
      {/* Ein Strich vom Scharnier zur Wandkante schließt das Bild ab. */}
      <Line
        points={[scharnier, 0, scharnier + richtung * breite, 0]}
        stroke="#3c4650"
        strokeWidth={strich}
        opacity={0.35}
      />
    </>
  );
}
