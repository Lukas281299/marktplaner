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
  verschiebeProjekt,
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

/** Wohin eine Planung gehört, wenn kein Ordner gesetzt ist. */
const OHNE_ORDNER = 'Ohne Ordner';

/**
 * Die Planungen nach Ordnern sortiert.
 *
 * Innerhalb eines Ordners bleibt die zuletzt geänderte oben – so wie vorher
 * in der flachen Liste. Die Ordner selbst stehen alphabetisch, „Ohne Ordner"
 * zuletzt: Was noch nicht einsortiert ist, soll nicht über dem stehen, was
 * schon aufgeräumt wurde.
 */
export function nachOrdnern(liste: ProjektInfo[]): { ordner: string; planungen: ProjektInfo[] }[] {
  const gruppen = new Map<string, ProjektInfo[]>();
  for (const info of liste) {
    const ordner = info.ordner?.trim() || OHNE_ORDNER;
    if (!gruppen.has(ordner)) gruppen.set(ordner, []);
    gruppen.get(ordner)!.push(info);
  }
  return [...gruppen.entries()]
    .map(([ordner, planungen]) => ({
      ordner,
      planungen: [...planungen].sort((a, b) => b.geaendertAm - a.geaendertAm),
    }))
    .sort((a, b) => {
      if (a.ordner === OHNE_ORDNER) return 1;
      if (b.ordner === OHNE_ORDNER) return -1;
      return a.ordner.localeCompare(b.ordner, 'de');
    });
}

/**
 * Die Liste der gespeicherten Planungen, nach Ordnern.
 *
 * **Warum Ordner.** Ein Markt bringt mit der Zeit mehrere Planungen mit:
 * Bestand, Umbau, Varianten, der Stand vor zwei Jahren. Bei drei Märkten sind
 * das zwölf Zeilen, bei zehn Märkten vierzig – und die zuletzt geänderte
 * steht oben, egal zu welchem Markt sie gehört. Man sucht dann jedes Mal.
 *
 * Eine Ebene reicht: ein Ordner je Markt. Verschachtelte Ordner würden das
 * Suchen nicht kürzer machen, sondern nur das Anlegen länger.
 *
 * Der Ordner ist bloß ein Name am Projekt – es wird nichts umkopiert, und
 * eine Planung ohne Ordner ist kein Fehler, sondern der Normalfall für alles,
 * was man schnell anlegt.
 */
export function ProjekteDialog({ schliessen }: { schliessen: () => void }) {
  const [liste, setListe] = useState<ProjektInfo[]>([]);
  const [zu, setZu] = useState<Set<string>>(new Set());
  const aktuelleId = usePlanStore((s) => s.projekt.id);

  const neuLaden = async () => setListe(await listeProjekte());
  useEffect(() => {
    void neuLaden();
  }, []);

  const gruppen = nachOrdnern(liste);
  const ordnernamen = gruppen.map((g) => g.ordner).filter((o) => o !== OHNE_ORDNER);

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

  /** Eine Planung in einen Ordner legen – oder wieder herausnehmen. */
  const verschieben = async (info: ProjektInfo, wahl: string) => {
    if (wahl === '__neu__') {
      const name = window.prompt('Name des neuen Ordners:', info.name);
      if (name === null || !name.trim()) return;
      await verschiebeProjekt(info.id, name.trim());
    } else {
      await verschiebeProjekt(info.id, wahl === OHNE_ORDNER ? undefined : wahl);
    }
    await neuLaden();
  };

  /** Einen ganzen Ordner umbenennen: alle Planungen darin bekommen den Namen. */
  const ordnerUmbenennen = async (ordner: string, planungen: ProjektInfo[]) => {
    const name = window.prompt('Neuer Name des Ordners:', ordner);
    if (name === null || !name.trim()) return;
    for (const info of planungen) await verschiebeProjekt(info.id, name.trim());
    await neuLaden();
  };

  const schalten = (ordner: string) =>
    setZu((vorher) => {
      const neu = new Set(vorher);
      if (neu.has(ordner)) neu.delete(ordner);
      else neu.add(ordner);
      return neu;
    });

  return (
    <Dialog
      titel="Gespeicherte Planungen"
      breit
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

      {gruppen.map(({ ordner, planungen }) => {
        const offen = !zu.has(ordner);
        return (
          <div key={ordner} className="ordner">
            {/* Der Ordner ist nur dann eine eigene Zeile, wenn es überhaupt
                mehr als einen gibt – bei einer einzelnen Planung wäre die
                Überschrift nur eine Zeile mehr zu lesen. */}
            {(gruppen.length > 1 || ordner !== OHNE_ORDNER) && (
              <div className="ordner-kopf">
                <button
                  className="knopf ordner-name"
                  onClick={() => schalten(ordner)}
                  title={offen ? 'Ordner zuklappen' : 'Ordner aufklappen'}
                >
                  <span className="ordner-pfeil">{offen ? '▾' : '▸'}</span>
                  {ordner}
                  <span className="kategorie-anzahl">{planungen.length}</span>
                </button>
                {ordner !== OHNE_ORDNER && (
                  <button
                    className="knopf"
                    onClick={() => void ordnerUmbenennen(ordner, planungen)}
                    title="Alle Planungen in diesem Ordner umsortieren"
                  >
                    Ordner umbenennen
                  </button>
                )}
              </div>
            )}

            {offen &&
              planungen.map((info) => (
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
                    <select
                      className="ordner-wahl"
                      value={info.ordner?.trim() || OHNE_ORDNER}
                      onChange={(e) => void verschieben(info, e.target.value)}
                      title="In welchen Ordner diese Planung gehört"
                    >
                      <option value={OHNE_ORDNER}>{OHNE_ORDNER}</option>
                      {ordnernamen.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value="__neu__">Neuer Ordner …</option>
                    </select>
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
          </div>
        );
      })}
    </Dialog>
  );
}
