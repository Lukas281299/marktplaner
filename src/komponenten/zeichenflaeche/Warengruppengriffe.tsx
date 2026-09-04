import { useRef } from 'react';
import { Circle, Group } from 'react-konva';
import type Konva from 'konva';
import { felderVon } from '../../logik/regalseiten';
import { eingerastet, rastpunkte } from '../../logik/warengruppe';
import { cmAufSeite, grenzgriffe } from '../../logik/warengruppenzuordnung';
import { usePlanStore } from '../../zustand/planStore';
import type { PlanElement } from '../../typen/modell';

/**
 * Die Griffe, mit denen sich die Grenzen zwischen Warengruppen ziehen lassen.
 *
 * Seit die Beschriftungen in Zentimetern messen, kann eine Grenze überall
 * liegen – auch mitten in einem Feld. Sie über zwei Zahlenfelder einzustellen
 * ginge, wäre aber mühsam: Man sieht ja im Plan, wo sie hingehört.
 *
 * Deshalb ein Griff auf jeder Grenze. Er rastet auf Feldgrenzen, Hälften und
 * Vierteln ein, sodass die üblichen Fälle ohne Zielen sitzen – drei Meter zu
 * zweit geteilt sind anderthalb, und anderthalb ist je nach Bau eine
 * Feldgrenze oder die Mitte eines Feldes.
 *
 * Nur an den **ausgewählten** Möbeln: Über einen ganzen Markt gelegt wären das
 * hunderte Punkte, und der Plan wäre nicht mehr zu lesen.
 */

/**
 * Radius des Griffs auf dem Bildschirm, in Punkten.
 *
 * Lieber etwas zu groß: Ein Punkt, den man erst suchen muss, wird nicht
 * benutzt — und dann bleibt die Grenze da, wo das Anklicken sie hingesetzt
 * hat, statt da, wo sie hingehört.
 */
const GRIFF = 6.5;

/**
 * So viele Griffe höchstens – darüber wird der Plan unlesbar.
 *
 * Eine Zahl und keine Begrenzung auf ein Möbel: Ein Klick auf eine gruppierte
 * Gondel wählt die **ganze Gruppe**, also Zug und Kopfgondeln zusammen. Wer
 * die Griffe nur bei genau einem ausgewählten Möbel zeigte, zeigte sie an
 * gruppierten Möbeln nie – und das ist bei Gondeln der Normalfall.
 */
const MAX_GRIFFE = 60;

export function Warengruppengriffe({
  elemente,
  auswahl,
  zoom,
}: {
  elemente: PlanElement[];
  auswahl: string[];
  zoom: number;
}) {
  // Beim Ziehen wird ohne Historie geschrieben; der eine Schritt entsteht
  // hier, bevor es losgeht.
  const zieht = useRef(false);

  if (auswahl.length === 0) return null;

  const gemeint = elemente.filter((el) => auswahl.includes(el.id) && !el.gesperrt);
  const griffe = gemeint.flatMap((el) => grenzgriffe(el).map((g) => ({ griff: g, element: el })));
  // Bei einer großen Auswahl wären es hunderte Punkte. Dann lieber keine:
  // Wer den halben Markt auswählt, will ihn verschieben und nicht beschriften.
  if (griffe.length === 0 || griffe.length > MAX_GRIFFE) return null;

  return (
    <Group>
      {griffe.map(({ griff, element }) => (
        <Circle
          key={`${element.id}-${griff.seite}-${griff.index}-${griff.kante}`}
          x={griff.x}
          y={griff.y}
          radius={GRIFF / zoom}
          fill="#ffffff"
          stroke="#005ca9"
          shadowColor="rgba(0,0,0,0.35)"
          shadowBlur={3 / zoom}
          shadowOpacity={1}
          strokeWidth={2 / zoom}
          draggable
          // Der Griff selbst bleibt, wo der Store ihn hinsetzt – gezogen wird
          // die Grenze, nicht der Kreis. Ohne das liefe er der Grenze davon,
          // sobald sie irgendwo anstößt.
          dragBoundFunc={(pos) => pos}
          onMouseEnter={(e) => {
            const buehne = e.target.getStage();
            if (buehne) buehne.container().style.cursor = 'ew-resize';
          }}
          onMouseLeave={(e) => {
            const buehne = e.target.getStage();
            if (buehne) buehne.container().style.cursor = '';
          }}
          onDragStart={() => {
            usePlanStore.getState().schnappschuss();
            zieht.current = true;
          }}
          onDragMove={(e) => ziehe(e, element, griff)}
          onDragEnd={(e) => {
            ziehe(e, element, griff);
            zieht.current = false;
            // Zurück auf die Stelle, die der Store bestimmt hat: Konva hat den
            // Kreis mitgeschleppt, aber gültig ist die eingerastete Grenze.
            e.target.position({ x: griff.x, y: griff.y });
          }}
        />
      ))}
    </Group>
  );
}

/** Rechnet die Mausposition auf einen Zentimeterwert um und schreibt ihn. */
function ziehe(
  e: Konva.KonvaEventObject<DragEvent>,
  element: PlanElement,
  griff: ReturnType<typeof grenzgriffe>[number],
): void {
  const buehne = e.target.getStage();
  if (!buehne) return;
  const zeiger = buehne.getRelativePointerPosition();
  if (!zeiger) return;

  const roh = cmAufSeite(element, griff.seite, zeiger);
  // **Immer** einrasten, nicht nur in der Nähe: Der Regler kennt 25-cm-Stufen
  // und die Feldgrenzen, dazwischen gibt es nichts. Feiner einzustellen lohnt
  // sich nicht, und wer es doch braucht, tippt „von" und „bis" am Möbel ein.
  const ziel = eingerastet(roh, rastpunkte(felderVon(element, griff.seite)), Infinity);

  usePlanStore
    .getState()
    .verschiebeWarengruppenkante(element.id, griff.seite, griff.index, griff.kante, ziel, false);
}
