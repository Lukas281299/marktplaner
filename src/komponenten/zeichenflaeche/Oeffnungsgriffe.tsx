import { useState } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import { formatiereLaenge } from '../../logik/masse';
import { rasteGrad } from '../../logik/wandfang';
import type { Massinheit, Oeffnung } from '../../typen/modell';

/**
 * Die Anfasser an einer ausgewählten Öffnung.
 *
 * Vier Stück: zwei an den Schmalseiten für die lichte Breite, zwei an den
 * Längsseiten für die Tiefe. Ein Tor zieht man auf, bis es zum Lieferwagen
 * passt – das geht am Stück schneller als über zwei Regler am Bildschirmrand,
 * und man sieht dabei, wogegen es stößt.
 *
 * Gezogen wird immer nur eine Seite; die gegenüberliegende bleibt stehen.
 * Eine Tür, die beim Verbreitern nach beiden Seiten wächst, rutscht aus der
 * Laibung, in die man sie gerade gesetzt hat.
 *
 * Die Griffe liegen im gedrehten Maß der Öffnung – dadurch zieht man immer
 * längs und quer zu ihr, gleich wie sie im Plan steht.
 *
 * Dazu kommt der **Drehregler** über der Öffnung. Eine Tür sitzt nicht immer
 * in einer waagerechten Wand: In einem abgeschrägten Windfang steht sie
 * schief, und dann muss sie sich auch schief stellen lassen. Gerastet wird
 * auf Vielfache von 15° – wer einen krummen Winkel braucht, hält beim Drehen
 * **Alt** und bekommt jeden.
 */
interface Props {
  oeffnung: Oeffnung;
  zoom: number;
  einheit: Massinheit;
  beiZiehStart: () => void;
  /** Neue Werte, schon fertig gerechnet. */
  beiZiehen: (werte: Partial<Oeffnung>) => void;
  beiZiehEnde: () => void;
}

export function Oeffnungsgriffe({
  oeffnung,
  zoom,
  einheit,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: Props) {
  /** Zeigt den Winkel an, solange gedreht wird. */
  const [dreht, setDreht] = useState(false);
  const griff = 6.5 / zoom;
  const schrift = 12 / zoom;
  const halbB = oeffnung.breite / 2;
  const halbT = oeffnung.tiefe / 2;
  /** Wie weit der Drehknopf über der Öffnung sitzt. */
  const stiel = halbT + 34 / zoom;
  const bogen = (oeffnung.drehung * Math.PI) / 180;
  const cos = Math.cos(bogen);
  const sin = Math.sin(bogen);

  /**
   * Eine Seite verschieben und die Öffnung nachführen.
   *
   * `zeichen` sagt, welche der beiden Seiten gezogen wird. Die neue Größe
   * ergibt sich aus dem Abstand zur festen Gegenseite; der Mittelpunkt
   * wandert dabei um die halbe Änderung mit – im Planmaß, also gedreht.
   */
  const zieheSeite = (
    was: 'breite' | 'tiefe',
    zeichen: 1 | -1,
    lokal: number,
  ) => {
    const alt = was === 'breite' ? oeffnung.breite : oeffnung.tiefe;
    const kleinste = was === 'breite' ? 20 : 4;
    const neu = Math.max(kleinste, Math.round(lokal * zeichen * 2));
    const verschiebung = ((neu - alt) / 2) * zeichen;
    // Längs zur Öffnung für die Breite, quer dazu für die Tiefe.
    const dx = was === 'breite' ? cos * verschiebung : -sin * verschiebung;
    const dy = was === 'breite' ? sin * verschiebung : cos * verschiebung;
    beiZiehen({
      [was]: neu,
      x: oeffnung.x + dx,
      y: oeffnung.y + dy,
    } as Partial<Oeffnung>);
  };

  const anfasser = (
    schluessel: string,
    x: number,
    y: number,
    was: 'breite' | 'tiefe',
    zeichen: 1 | -1,
  ) => (
    <Circle
      key={schluessel}
      x={x}
      y={y}
      radius={griff}
      fill="#ffffff"
      stroke="#0a84ff"
      strokeWidth={2 / zoom}
      draggable
      onDragStart={(e) => {
        e.cancelBubble = true;
        beiZiehStart();
      }}
      onDragMove={(e) => {
        e.cancelBubble = true;
        // Nur längs der eigenen Achse – quer dazu bliebe der Griff sonst
        // irgendwo neben der Öffnung stehen.
        const lokal = was === 'breite' ? e.target.x() : e.target.y();
        e.target.position(was === 'breite' ? { x: lokal, y: 0 } : { x: 0, y: lokal });
        zieheSeite(was, zeichen, lokal);
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        beiZiehEnde();
      }}
      onMouseEnter={(e) => {
        const buehne = e.target.getStage();
        if (buehne) buehne.container().style.cursor = was === 'breite' ? 'ew-resize' : 'ns-resize';
      }}
      onMouseLeave={(e) => {
        const buehne = e.target.getStage();
        if (buehne) buehne.container().style.cursor = '';
      }}
    />
  );

  return (
    <Group x={oeffnung.x} y={oeffnung.y} rotation={oeffnung.drehung} listening>
      {/* Die Maße, während man zieht – man zieht ja, bis sie stimmen. */}
      <Text
        listening={false}
        x={-halbB}
        y={-halbT - schrift * 1.6}
        width={oeffnung.breite}
        align="center"
        text={formatiereLaenge(oeffnung.breite, einheit)}
        fontSize={schrift}
        fontStyle="600"
        fill="#0a84ff"
      />
      <Text
        listening={false}
        x={halbB + schrift * 0.6}
        y={-schrift / 2}
        text={formatiereLaenge(oeffnung.tiefe, einheit)}
        fontSize={schrift}
        fontStyle="600"
        fill="#0a84ff"
      />

      {anfasser('breite-links', -halbB, 0, 'breite', -1)}
      {anfasser('breite-rechts', halbB, 0, 'breite', 1)}
      {anfasser('tiefe-oben', 0, -halbT, 'tiefe', -1)}
      {anfasser('tiefe-unten', 0, halbT, 'tiefe', 1)}

      {/* Der Drehregler: ein Stiel nach oben, ein Knopf am Ende. Er sitzt
          außerhalb der Breitengriffe, damit man ihn nicht mit ihnen
          verwechselt. */}
      <Line
        listening={false}
        points={[0, -halbT, 0, -stiel]}
        stroke="#0a84ff"
        strokeWidth={1.4 / zoom}
      />
      {dreht && (
        <Text
          listening={false}
          x={-schrift * 3}
          y={-stiel - griff - schrift * 1.9}
          width={schrift * 6}
          align="center"
          text={`${oeffnung.drehung.toFixed(1)}°`}
          fontSize={schrift}
          fontStyle="600"
          fill="#0a84ff"
        />
      )}
      <Circle
        x={0}
        y={-stiel}
        radius={griff}
        fill="#0a84ff"
        stroke="#ffffff"
        strokeWidth={2 / zoom}
        hitStrokeWidth={14 / zoom}
        draggable
        onDragStart={(e) => {
          e.cancelBubble = true;
          setDreht(true);
          beiZiehStart();
        }}
        onDragMove={(e) => {
          e.cancelBubble = true;
          const buehne = e.target.getStage();
          if (!buehne) return;
          const zeiger = buehne.getPointerPosition();
          if (!zeiger) return;

          // Gerechnet wird im Planmaß: Der Zeiger kommt in Bildschirmpunkten,
          // und die Öffnung steht in Zentimetern.
          const nachPlan = buehne.getAbsoluteTransform().copy().invert();
          const p = nachPlan.point(zeiger);
          const roh =
            (Math.atan2(p.y - oeffnung.y, p.x - oeffnung.x) * 180) / Math.PI + 90;

          // Der Knopf bleibt an seinem Stiel; gedreht wird die Öffnung.
          e.target.position({ x: 0, y: -stiel });
          // Auf Vielfache von 15° einrasten – Alt hebt das auf.
          beiZiehen({ drehung: rasteGrad(roh, e.evt.altKey) });
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          e.target.position({ x: 0, y: -stiel });
          setDreht(false);
          beiZiehEnde();
        }}
        onMouseEnter={(e) => {
          const buehne = e.target.getStage();
          if (buehne) buehne.container().style.cursor = 'grab';
        }}
        onMouseLeave={(e) => {
          const buehne = e.target.getStage();
          if (buehne) buehne.container().style.cursor = '';
        }}
      />
    </Group>
  );
}
