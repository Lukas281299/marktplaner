import { Group, Line } from 'react-konva';
import type { Punkt, Wand } from '../../typen/modell';

/**
 * Freistehende Wände.
 *
 * Eine Wand ist eine dicke Linie auf ihrer Achse – anders als beim Gebäude
 * und bei Räumen wird hier nichts beschnitten: Eine freistehende Wand hat
 * keine Innen- und Außenseite, sie steht mittig auf ihrer Linie.
 *
 * `lineCap="butt"` ist wichtig: Mit abgerundeten Enden ragte jede Wand um eine
 * halbe Wandstärke über ihren Endpunkt hinaus, und zwei rechtwinklig
 * aneinanderstoßende Wände hätten eine sichtbare Beule in der Ecke.
 *
 * **Zum Verschieben:** Während des Ziehens wandert allein die Konva-Gruppe;
 * die Wand im Projekt bleibt liegen, wo sie war, und bekommt den Versatz erst
 * beim Loslassen in einem Zug. Vorher wurde beides zugleich verschoben – die
 * Gruppe *und* die Punkte darin – und die Wand lief mit doppelter
 * Geschwindigkeit davon, um beim Loslassen wieder zurückzuspringen.
 */
interface Props {
  waende: Wand[];
  ausgewaehlt: string | null;
  zoom: number;
  anklickbar: boolean;
  beiKlick: (id: string) => void;
  /**
   * Rastet den Zug ein. Bekommt die Wunschlage der Gruppe in Bildschirmmaß
   * und gibt zurück, wo sie wirklich landen darf.
   */
  fangen: (id: string, lage: Punkt) => Punkt;
  /** Der endgültige Versatz in Planmaß, einmal beim Loslassen. */
  beiZiehEnde: (id: string, dx: number, dy: number) => void;
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
  fangen,
  beiZiehEnde,
}: Props) {
  return (
    <>
      {waende.map((wand) => {
        // Eine Flächenwand bringt ihren Umriss mit; sie wird gefüllt statt
        // als dicker Strich gezeichnet. Nur so bekommt ein Zwickel seine
        // beiden verschiedenen Dicken.
        const flaeche = wand.umriss && wand.umriss.length >= 3 ? wand.umriss : null;
        const punkte = flaeche
          ? flaeche.flatMap((p) => [p.x, p.y])
          : [wand.von.x, wand.von.y, wand.bis.x, wand.bis.y];
        return (
          <Group
            key={wand.id}
            draggable={anklickbar && !wand.gesperrt}
            listening={anklickbar}
            dragBoundFunc={(lage) => fangen(wand.id, lage)}
            onMouseDown={(e) => {
              if (e.evt.button !== 0) return;
              e.cancelBubble = true;
              beiKlick(wand.id);
            }}
            onDragEnd={(e) => {
              // Die Gruppe steht jetzt auf dem eingerasteten Versatz. Der
              // wandert in einem Zug ins Projekt, die Gruppe zurück auf null –
              // sonst wirkte er doppelt.
              const { x, y } = e.target.position();
              e.target.position({ x: 0, y: 0 });
              beiZiehEnde(wand.id, x, y);
            }}
          >
            {flaeche ? (
              <Line
                points={punkte}
                closed
                fill={FARBEN[wand.art]}
                stroke={FARBEN[wand.art]}
                strokeWidth={1 / zoom}
              />
            ) : (
              <Line
                points={punkte}
                stroke={FARBEN[wand.art]}
                strokeWidth={wand.staerke}
                lineCap="butt"
              />
            )}
            {/* Unsichtbarer, dickerer Streifen zum Anfassen: Eine 10 cm
                dünne Wand trifft man sonst bei kleinem Zoom nicht. Bei einer
                Fläche liegt er auf ihrem Rand – die Fläche selbst trifft
                man ohnehin. */}
            <Line
              points={punkte}
              closed={Boolean(flaeche)}
              fill={flaeche ? 'transparent' : undefined}
              stroke="transparent"
              strokeWidth={flaeche ? 14 / zoom : Math.max(wand.staerke, 14 / zoom)}
            />
            {wand.id === ausgewaehlt && (
              <Line
                listening={false}
                points={punkte}
                closed={Boolean(flaeche)}
                stroke="#0a84ff"
                strokeWidth={flaeche ? 3 / zoom : wand.staerke + 4 / zoom}
                opacity={flaeche ? 0.9 : 0.35}
                lineCap="butt"
              />
            )}
          </Group>
        );
      })}
    </>
  );
}
