import { useEffect, useState, type ReactNode } from 'react';
import { neuesProjekt } from '../daten/standardProjekt';
import { anzeigeInCm } from '../logik/masse';
import {
  kopiereProjekt,
  ladeProjekt,
  listeProjekte,
  loescheProjekt,
  speichereProjekt,
  type ProjektInfo,
} from '../speicher/projektArchiv';
import { usePlanStore } from '../zustand/planStore';
import { Zahlfeld } from './Feld';

/**
 * Die beiden Dialoge für die Projektverwaltung:
 * "Neue Marktplanung" und "Marktplanung öffnen".
 */

// -------------------------------------------------------------- Grundgerüst

function Dialog({
  titel,
  children,
  fuss,
  schliessen,
}: {
  titel: string;
  children: ReactNode;
  fuss: ReactNode;
  schliessen: () => void;
}) {
  // Mit Escape lässt sich jeder Dialog schließen.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [schliessen]);

  return (
    <div className="dialog-hintergrund" onMouseDown={schliessen}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-kopf">{titel}</div>
        <div className="dialog-inhalt">{children}</div>
        <div className="dialog-fuss">{fuss}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Neues Projekt

export function NeuesProjektDialog({ schliessen }: { schliessen: () => void }) {
  const [name, setName] = useState('Neue Marktplanung');
  // Eingabe in Metern – das ist beim Anlegen am anschaulichsten.
  const [breite, setBreite] = useState(40);
  const [laenge, setLaenge] = useState(25);

  const anlegen = async () => {
    const projekt = neuesProjekt(
      name.trim() || 'Neue Marktplanung',
      anzeigeInCm(breite, 'm'),
      anzeigeInCm(laenge, 'm'),
    );
    await speichereProjekt(projekt);
    usePlanStore.getState().setzeProjekt(projekt);
    schliessen();
  };

  return (
    <Dialog
      titel="Neue Marktplanung"
      schliessen={schliessen}
      fuss={
        <>
          <button className="knopf" onClick={schliessen}>
            Abbrechen
          </button>
          <button className="knopf knopf-haupt" onClick={anlegen}>
            Anlegen
          </button>
        </>
      }
    >
      <div className="feld-zeile einspaltig">
        <div className="feld">
          <label>Name der Planung</label>
          <input
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void anlegen();
            }}
          />
        </div>
      </div>
      <div className="feld-zeile">
        <Zahlfeld
          label="Breite"
          einheit="m"
          wert={breite}
          min={2}
          max={500}
          schritt={0.5}
          nachkommastellen={2}
          aendern={setBreite}
        />
        <Zahlfeld
          label="Länge"
          einheit="m"
          wert={laenge}
          min={2}
          max={500}
          schritt={0.5}
          nachkommastellen={2}
          aendern={setLaenge}
        />
      </div>
      <p className="hinweis">
        Die Maße lassen sich später jederzeit ändern – rechts im Eigenschaftenfenster, wenn nichts
        ausgewählt ist.
      </p>
    </Dialog>
  );
}

// ---------------------------------------------------------- Projekt öffnen

export function ProjekteDialog({ schliessen }: { schliessen: () => void }) {
  const [liste, setListe] = useState<ProjektInfo[]>([]);
  const aktuelleId = usePlanStore((s) => s.projekt.id);

  const neuLaden = async () => setListe(await listeProjekte());
  useEffect(() => {
    void neuLaden();
  }, []);

  const oeffnen = async (id: string) => {
    const projekt = await ladeProjekt(id);
    if (projekt) {
      usePlanStore.getState().setzeProjekt(projekt);
      schliessen();
    }
  };

  const loeschen = async (info: ProjektInfo) => {
    if (!window.confirm(`„${info.name}" wirklich löschen? Das lässt sich nicht rückgängig machen.`))
      return;
    await loescheProjekt(info.id);
    await neuLaden();
  };

  const kopieren = async (id: string) => {
    await kopiereProjekt(id);
    await neuLaden();
  };

  return (
    <Dialog
      titel="Marktplanung öffnen"
      schliessen={schliessen}
      fuss={
        <button className="knopf" onClick={schliessen}>
          Schließen
        </button>
      }
    >
      {liste.length === 0 && <p className="hinweis">Es ist noch keine Planung gespeichert.</p>}
      {liste.map((info) => (
        <div className="projektzeile" key={info.id}>
          <div>
            <div className="projektzeile-name">
              {info.name}
              {info.id === aktuelleId && (
                <span className="kategorie-anzahl"> · gerade geöffnet</span>
              )}
            </div>
            <div className="projektzeile-info">
              {info.anzahlElemente} Elemente · zuletzt geändert{' '}
              {new Date(info.geaendertAm).toLocaleString('de-DE', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </div>
          </div>
          <div className="knopfreihe">
            <button className="knopf" onClick={() => void oeffnen(info.id)}>
              Öffnen
            </button>
            <button className="knopf" onClick={() => void kopieren(info.id)}>
              Kopie
            </button>
            <button
              className="knopf knopf-gefahr"
              onClick={() => void loeschen(info)}
              disabled={info.id === aktuelleId}
              title={
                info.id === aktuelleId
                  ? 'Die geöffnete Planung kann nicht gelöscht werden.'
                  : 'Planung löschen'
              }
            >
              Löschen
            </button>
          </div>
        </div>
      ))}
    </Dialog>
  );
}
