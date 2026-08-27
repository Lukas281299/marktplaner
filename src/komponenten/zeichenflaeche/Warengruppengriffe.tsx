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
 * Nur am **ausgewählten** Möbel: Über einem ganzen Markt gelegt wären das
 * hunderte Punkte, und der Plan wäre nicht mehr zu lesen.
 */

/** Radius des Griffs auf dem Bildschirm, in Punkten. */
const GRIFF = 5;

/** Wie weit ein Rastpunkt zieht, in Bildschirmpunkten. */
const RAST_NAEHE = 12;

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

  // Nur bei genau einem ausgewählten Möbel. Bei mehreren gehören die Griffe
  // niemandem sichtbar, und man verschöbe eine Grenze am falschen Zug.
  if (auswahl.length !== 1) return null;
  const element = elemente.find((el) => el.id === auswahl[0]);
  if (!element || element.gesperrt) return null;

  const griffe = grenzgriffe(element);
  if (griffe.length === 0) return null;

  return (
    <Group>
      {griffe.map((griff) => (
        <Circle
          key={`${griff.seite}-${griff.index}-${griff.kante}`}
          x={griff.x}
          y={griff.y}
          radius={GRIFF / zoom}
          fill="#ffffff"
          stroke="#005ca9"
          strokeWidth={1.6 / zoom}
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
  const zoom = buehne.scaleX() || 1;
  const ziel = eingerastet(roh, rastpunkte(felderVon(element, griff.seite)), RAST_NAEHE / zoom);

  usePlanStore
    .getState()
    .verschiebeWarengruppenkante(element.id, griff.seite, griff.index, griff.kante, ziel, false);
}
