import { useEffect, useState } from 'react';
import { neuesProjekt } from '../daten/standardProjekt';
import { Dialog } from './Dialog';
import { anzeigeInCm } from '../logik/masse';
import {
  benenneProjektUm,
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

// ------------------------------------------------------------- Neues Projekt

export function NeuesProjektDialog({ schliessen }: { schliessen: () => void }) {
  const [name, setName] = useState('Neue Marktplanung');
  // Eingabe in Metern – das ist beim Anlegen am anschaulichsten.
  const [breite, setBreite] = useState(40);
  const [laenge, setLaenge] = useState(25);
  const [selbstZeichnen, setSelbstZeichnen] = useState(false);

  const anlegen = async () => {
    const projekt = neuesProjekt(
      name.trim() || 'Neue Marktplanung',
      anzeigeInCm(breite, 'm'),
      anzeigeInCm(laenge, 'm'),
    );
    await speichereProjekt(projekt);
    usePlanStore.getState().setzeProjekt(projekt);
    // Wer den Grundriss selbst zeichnen will, soll nicht erst das vorgegebene
    // Rechteck wegräumen müssen. Das Werkzeug steht deshalb gleich bereit;
    // der erste gezeichnete Umriss ersetzt das Rechteck ohnehin.
    if (selbstZeichnen) usePlanStore.getState().setzeWerkzeug('grundrissZeichnen');
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
    
      <label className="schalter" style={{ marginTop: 4 }}>
        <input
          type="checkbox"
          checked={selbstZeichnen}
          onChange={(e) => setSelbstZeichnen(e.target.checked)}
        />
        <span>Grundriss selbst zeichnen</span>
      </label>
      <p className="hinweis" style={{ marginTop: 4 }}>
        Dann geht es gleich mit dem Zeichenwerkzeug los: Ecken klicken, ziehen
        ergibt einen Bogen, Enter schließt den Umriss. Die Maße oben dienen
        dabei nur als Startgröße für das Raster.
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

  const umbenennen = async (info: ProjektInfo) => {
    const name = window.prompt('Neuer Name der Planung:', info.name);
    if (name === null) return;
    const neu = await benenneProjektUm(info.id, name);
    // Ist es die geoeffnete Planung, muss auch der Bildschirm nachziehen -
    // sonst steht oben links noch der alte Name.
    if (neu && info.id === usePlanStore.getState().projekt.id) {
      usePlanStore.getState().benenneProjektUm(neu.name);
    }
    await neuLaden();
  };

  const kopieren = async (id: string) => {
    await kopiereProjekt(id);
    await neuLaden();
  };

  return (
    <Dialog
      titel="Gespeicherte Planungen"
      schliessen={schliessen}
      fuss={
        <button className="knopf" onClick={schliessen}>
          Schließen
        </button>
      }
    >
      {liste.length === 0 && (
        <p className="hinweis">
          Es ist noch keine Planung gespeichert. Jede Planung wird beim Arbeiten
          von selbst gesichert und erscheint dann hier.
        </p>
      )}
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
            <button className="knopf" onClick={() => void umbenennen(info)}>
              Umbenennen
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
