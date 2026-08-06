import { berechneMassstab, formatiereLaenge } from '../logik/masse';
import { usePlanStore } from '../zustand/planStore';
import { useStatusStore } from '../zustand/statusStore';

/**
 * Die schmale Leiste ganz unten: Maßstab, Mausposition und Zoomstufe.
 *
 * Die Mausposition kommt aus einem eigenen kleinen Datenspeicher, damit bei
 * jeder Mausbewegung nur diese Leiste neu gezeichnet wird.
 */
export function Statusleiste() {
  const maus = useStatusStore((s) => s.maus);
  const zoom = usePlanStore((s) => s.ansicht.zoom);
  const einheit = usePlanStore((s) => s.projekt.einstellungen.anzeigeEinheit);
  const anzahl = usePlanStore((s) => s.projekt.elemente.length);
  const auswahl = usePlanStore((s) => s.auswahl.length);

  return (
    <footer className="statusleiste">
      <span>
        Position:{' '}
        {maus
          ? `${formatiereLaenge(maus.x, einheit)} / ${formatiereLaenge(maus.y, einheit)}`
          : '– / –'}
      </span>
      <span>Maßstab: {berechneMassstab(zoom)}</span>
      <span className="rechts">
        <span>
          {anzahl} {anzahl === 1 ? 'Element' : 'Elemente'}
        </span>
        <span>{auswahl > 0 ? `${auswahl} ausgewählt` : 'nichts ausgewählt'}</span>
        <span>Zoom: {Math.round(zoom * 100)} %</span>
      </span>
    </footer>
  );
}
