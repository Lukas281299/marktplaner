import { berechneMassstab, formatiereLaenge } from '../logik/masse';
import { usePlanStore } from '../zustand/planStore';
import { useStatusStore } from '../zustand/statusStore';
import { useSyncStore } from '../zustand/syncStore';

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
  const syncZustand = useSyncStore((s) => s.zustand);
  const letzterAbgleich = useSyncStore((s) => s.letzterAbgleich);

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
        {syncZustand !== 'aus' && (
          <span
            style={syncZustand === 'fehler' ? { color: 'var(--hilfslinie)', fontWeight: 600 } : undefined}
          >
            {abgleichText(syncZustand, letzterAbgleich)}
          </span>
        )}
      </span>
    </footer>
  );
}

/** Kurzer Stand des Abgleichs für die Statusleiste. */
function abgleichText(zustand: string, letzterAbgleich: number): string {
  if (zustand === 'laeuft') return 'Abgleich läuft …';
  if (zustand === 'fehler') return 'Abgleich fehlgeschlagen';
  if (!letzterAbgleich) return 'Abgleich bereit';
  const minuten = Math.floor((Date.now() - letzterAbgleich) / 60_000);
  if (minuten < 1) return 'Abgeglichen: gerade eben';
  if (minuten < 60) return `Abgeglichen: vor ${minuten} min`;
  return `Abgeglichen: ${new Date(letzterAbgleich).toLocaleTimeString('de-DE', { timeStyle: 'short' })}`;
}
