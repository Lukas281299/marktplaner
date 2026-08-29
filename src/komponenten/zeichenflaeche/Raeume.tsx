import { useMemo } from 'react';
import { Group, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { SCHRIFT_FLAECHE, lesbar, textbreite } from '../../logik/beschriftung';
import { raumflaeche } from '../../logik/flaechen';
import { formatiereFlaeche, formatiereLaenge } from '../../logik/masse';
import { punktInnerhalb, rahmen } from '../../logik/polygon';
import type { Massinheit, Punkt, Raum } from '../../typen/modell';
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
 * Die Stelle wird gesucht, nicht gerechnet. Bei einem zusammengesetzten Raum
 * – einem Hauptlager, das um den Kühlraum herumgreift, einer L-förmigen
 * Metzgerei – hilft weder die Mitte des umschließenden Kastens noch der
 * Schwerpunkt: Beide können in einer Kerbe liegen oder in einem Schenkel,
 * der schmaler ist als der Text. Genau das war der Fehler.
 *
 * Gesucht wird deshalb der Punkt mit dem größten Abstand zur Wand, und dort
 * wird die Schrift so weit verkleinert, bis der **ganze Textkasten** in den
 * Raum passt – nicht nur sein Mittelpunkt. Passt auch die kleinste Schrift
 * nicht mehr, bleibt die Beschriftung weg.
 */
export function beschriftungsplatz(raum: Raum, kasten: ReturnType<typeof rahmen>) {
  const text = `${raum.name}\n${formatiereFlaeche(raumflaeche(raum))}`;
  const zeilen = text.split('\n');
  const stelle = weitesteStelle(raum.umriss, kasten);
  // Der Platz bis zur Wand, abzüglich der Wand selbst und etwas Luft.
  const platz = stelle.abstand - raum.wandstaerke - 6;
  if (platz <= 0) return null;

  // Von der vollen Größe abwärts, bis der Kasten hineinpasst. Zehn Schritte
  // reichen: Darunter wäre die Schrift ohnehin nicht mehr lesbar.
  for (let i = 0; i < 10; i++) {
    const schrift = SCHRIFT_FLAECHE * (1 - i * 0.09);
    const breite = Math.max(...zeilen.map((z) => textbreite(z, schrift)));
    const hoehe = zeilen.length * schrift * 1.25;
    if (
      kastenImRaum(
        { x: stelle.x - breite / 2, y: stelle.y - hoehe / 2, breite, hoehe },
        raum.umriss,
        raum.wandstaerke + 4,
      )
    ) {
      return { schrift, x: stelle.x - breite / 2, y: stelle.y - hoehe / 2, breite, text };
    }
  }
  return null;
}

/**
 * Der Punkt im Raum, der am weitesten von jeder Wand entfernt ist.
 *
 * Über ein Raster gesucht und danach einmal verfeinert – genau genug für
 * eine Beschriftung und schnell genug, um es bei jeder Änderung neu zu
 * rechnen. Für einen L-förmigen Raum landet er im breiteren Schenkel, und
 * das ist die Stelle, an der ein Name Platz hat.
 */
function weitesteStelle(umriss: Punkt[], kasten: ReturnType<typeof rahmen>) {
  const suche = (
    vonX: number,
    bisX: number,
    vonY: number,
    bisY: number,
    schritte: number,
  ) => {
    let beste = { x: (vonX + bisX) / 2, y: (vonY + bisY) / 2, abstand: -1 };
    for (let i = 0; i <= schritte; i++) {
      for (let j = 0; j <= schritte; j++) {
        const p = {
          x: vonX + ((bisX - vonX) * i) / schritte,
          y: vonY + ((bisY - vonY) * j) / schritte,
        };
        if (!punktInnerhalb(p, umriss)) continue;
        const abstand = abstandZumRand(p, umriss);
        if (abstand > beste.abstand) beste = { ...p, abstand };
      }
    }
    return beste;
  };

  const grob = suche(kasten.links, kasten.rechts, kasten.oben, kasten.unten, 22);
  if (grob.abstand < 0) {
    return { x: (kasten.links + kasten.rechts) / 2, y: (kasten.oben + kasten.unten) / 2, abstand: 0 };
  }
  // Noch einmal genauer um die gefundene Stelle herum.
  const feld = Math.max(kasten.rechts - kasten.links, kasten.unten - kasten.oben) / 22;
  return suche(grob.x - feld, grob.x + feld, grob.y - feld, grob.y + feld, 8);
}

/** Kürzester Abstand eines Punkts zu irgendeiner Kante des Umrisses. */
function abstandZumRand(p: Punkt, umriss: Punkt[]): number {
  let kleinster = Infinity;
  for (let i = 0; i < umriss.length; i++) {
    const a = umriss[i];
    const b = umriss[(i + 1) % umriss.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const laenge = dx * dx + dy * dy;
    // Wie weit entlang der Kante der Lotfußpunkt liegt, begrenzt auf sie.
    const t = laenge === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / laenge));
    const abstand = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (abstand < kleinster) kleinster = abstand;
  }
  return kleinster;
}

/**
 * Liegt ein Rechteck ganz im Raum, mit Abstand zur Wand?
 *
 * Geprüft werden die vier Ecken und die Kantenmitten – bei einem Raum mit
 * einem Vorsprung reichen die Ecken allein nicht, weil der Vorsprung
 * mitten in die Kante ragen kann.
 */
function kastenImRaum(
  k: { x: number; y: number; breite: number; hoehe: number },
  umriss: Punkt[],
  abstand: number,
): boolean {
  const punkte: Punkt[] = [
    { x: k.x, y: k.y },
    { x: k.x + k.breite, y: k.y },
    { x: k.x + k.breite, y: k.y + k.hoehe },
    { x: k.x, y: k.y + k.hoehe },
    { x: k.x + k.breite / 2, y: k.y },
    { x: k.x + k.breite / 2, y: k.y + k.hoehe },
    { x: k.x, y: k.y + k.hoehe / 2 },
    { x: k.x + k.breite, y: k.y + k.hoehe / 2 },
  ];
  return punkte.every((p) => punktInnerhalb(p, umriss) && abstandZumRand(p, umriss) >= abstand);
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
  const kasten = useMemo(() => rahmen(raum.umriss), [raum.umriss]);
  const ziehbar = anklickbar && !raum.gesperrt;
  const kanten = useMemo(() => kantenmasse(raum), [raum]);
  const kantenschrift = SCHRIFT_FLAECHE * 0.62;
  // Die Platzsuche legt ein Raster über den Raum und misst zu jeder Kante –
  // das ist zu viel Rechnerei für jeden Bildaufbau. Sie hängt allein am
  // Raum, also reicht sie einmal je Änderung.
  const beschriftung = useMemo(() => beschriftungsplatz(raum, kasten), [raum, kasten]);


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
