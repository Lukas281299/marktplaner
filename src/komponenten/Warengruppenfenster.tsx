import { useState } from 'react';
import {
  abdeckung,
  abteilungsstand,
  gefiltert,
  leseSortimentsliste,
  mitAbteilung,
  mitSortiment,
  mitWarengruppe,
  ohneAbteilung,
  ohneSortiment,
  ohneWarengruppe,
  platzierteTexte,
  schluesselVon,
  umbenannteAbteilung,
  umbenannteWarengruppe,
  umbenanntesSortiment,
  umfang,
} from '../logik/sortiment';
import { usePlanStore } from '../zustand/planStore';

/**
 * Die Sortimentsliste als Reiter neben der Bibliothek.
 *
 * Drei Stufen, so wie die Liste des Marktes aufgebaut ist: Abteilung,
 * Warengruppe, Sortiment. Zwei Dinge tut man hier:
 *
 *  - **Zuordnen.** Ein Klick auf einen Namen nimmt ihn auf; danach schreibt
 *    jeder Klick auf einen Meter im Plan ihn dort hinein. So lassen sich
 *    mehrere Meter hintereinander bestreichen, ohne zwischendurch ins
 *    Eigenschaftenfenster zu wechseln.
 *  - **Pflegen.** Über den Stift lässt sich jeder Name ändern, entfernen oder
 *    ein neuer anlegen. Ein Sortiment ändert sich, das Programm soll dem
 *    nicht im Weg stehen.
 *
 * **Grün steht schon im Plan, rot fehlt noch** – damit man am Ende sieht, ob
 * etwas vergessen wurde.
 */
export function Warengruppenfenster() {
  const sortiment = usePlanStore((s) => s.sortiment);
  const elemente = usePlanStore((s) => s.projekt.elemente);
  const pinsel = usePlanStore((s) => s.warengruppenPinsel);

  const [suche, setSuche] = useState('');
  const [zu, setZu] = useState<Set<string>>(new Set());
  const [pflege, setPflege] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const gezeigt = gefiltert(sortiment, suche);
  const stand = abdeckung(sortiment, platzierteTexte({ elemente }));
  const zahlen = umfang(sortiment);
  const sucht = suche.trim() !== '';

  const pflegen = (liste: typeof sortiment) => usePlanStore.getState().pflegeSortiment(liste);
  const nimm = (name: string) =>
    usePlanStore.getState().setzeWarengruppenPinsel(pinsel === name ? null : name);

  /** Fragt nach einem Namen. Leer oder abgebrochen heißt: nichts tun. */
  const frage = (text: string, vorgabe = '') => {
    const antwort = window.prompt(text, vorgabe);
    return antwort?.trim() ? antwort.trim() : null;
  };

  const laden = async (datei: File | undefined) => {
    if (!datei) return;
    try {
      usePlanStore.getState().setzeSortimentsliste(leseSortimentsliste(await datei.text()), true);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Die Datei ließ sich nicht lesen.');
    }
  };

  return (
    <aside className="spalte spalte-links">
      <div className="wg-kopfbereich">
        <div className="knopfreihe">
          <button
            className="knopf aktiv"
            style={{ flex: 1 }}
            onClick={() => usePlanStore.getState().setzeLinkenReiter('bibliothek')}
            title="Zurück zu den Möbeln"
          >
            ← Möbel
          </button>
          <button
            className={`knopf${pflege ? ' aktiv' : ''}`}
            onClick={() => setPflege(!pflege)}
            title="Namen ändern, entfernen und neue anlegen"
          >
            ✎
          </button>
        </div>

        <input
          type="text"
          className="wg-suche"
          placeholder="Warengruppe oder Sortiment suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />

        {pinsel ? (
          <div className="pinsel">
            <span>
              <strong>{pinsel}</strong> — jetzt Meter im Plan anklicken
            </span>
            <button
              className="knopf knopf-nur-symbol"
              title="Weglegen (Esc)"
              onClick={() => usePlanStore.getState().setzeWarengruppenPinsel(null)}
            >
              ×
            </button>
          </div>
        ) : (
          <p className="hinweis" style={{ margin: '4px 2px' }}>
            Namen anklicken, dann die Meter im Plan. ● grün steht schon, ● rot fehlt.
          </p>
        )}
      </div>

      <div className="spalte-inhalt">
        {gezeigt.abteilungen.map((abteilung) => {
          const offen = sucht || !zu.has(abteilung.name);
          const zahl = abteilungsstand(abteilung, stand);
          return (
            <div key={abteilung.name} className="wg-abteilung">
              <div className="wg-kopf">
                <button
                  className="wg-titel"
                  onClick={() => {
                    const neu = new Set(zu);
                    if (offen) neu.add(abteilung.name);
                    else neu.delete(abteilung.name);
                    setZu(neu);
                  }}
                >
                  <span className="wg-pfeil">{offen ? '▾' : '▸'}</span>
                  {abteilung.name}
                </button>
                <span className={zahl.platziert === zahl.gesamt ? 'steht' : 'fehlt'}>
                  {zahl.platziert}/{zahl.gesamt}
                </span>
                {pflege && (
                  <>
                    <button
                      className="wg-werkzeug"
                      title="Abteilung umbenennen"
                      onClick={() => {
                        const name = frage('Abteilung umbenennen:', abteilung.name);
                        if (name) pflegen(umbenannteAbteilung(sortiment, abteilung.name, name));
                      }}
                    >
                      ✎
                    </button>
                    <button
                      className="wg-werkzeug"
                      title="Warengruppe anlegen"
                      onClick={() => {
                        const name = frage(`Neue Warengruppe in „${abteilung.name}":`);
                        if (name) pflegen(mitWarengruppe(sortiment, abteilung.name, name));
                      }}
                    >
                      +
                    </button>
                    <button
                      className="wg-werkzeug gefahr"
                      title="Abteilung mit allem darin entfernen"
                      onClick={() => {
                        if (window.confirm(`„${abteilung.name}" mit allen Warengruppen entfernen?`)) {
                          pflegen(ohneAbteilung(sortiment, abteilung.name));
                        }
                      }}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>

              {offen &&
                abteilung.warengruppen.map((gruppe) => {
                  const eintrag = stand.get(schluesselVon(abteilung.name, gruppe.name));
                  return (
                    <div key={gruppe.name}>
                      <div className="wg-zeile">
                        <button
                          className={`wg-name ${eintrag?.platziert ? 'steht' : 'fehlt'}${
                            pinsel === gruppe.name ? ' aktiv' : ''
                          }`}
                          onClick={() => nimm(gruppe.name)}
                          title="Aufnehmen und im Plan zuordnen"
                        >
                          {gruppe.name}
                        </button>
                        {pflege && (
                          <>
                            <button
                              className="wg-werkzeug"
                              title="Warengruppe umbenennen"
                              onClick={() => {
                                const name = frage('Warengruppe umbenennen:', gruppe.name);
                                if (name) {
                                  pflegen(
                                    umbenannteWarengruppe(sortiment, abteilung.name, gruppe.name, name),
                                  );
                                }
                              }}
                            >
                              ✎
                            </button>
                            <button
                              className="wg-werkzeug"
                              title="Sortiment anlegen"
                              onClick={() => {
                                const name = frage(`Neues Sortiment in „${gruppe.name}":`);
                                if (name) {
                                  pflegen(mitSortiment(sortiment, abteilung.name, gruppe.name, name));
                                }
                              }}
                            >
                              +
                            </button>
                            <button
                              className="wg-werkzeug gefahr"
                              title="Warengruppe mit ihren Sortimenten entfernen"
                              onClick={() => {
                                if (window.confirm(`„${gruppe.name}" entfernen?`)) {
                                  pflegen(ohneWarengruppe(sortiment, abteilung.name, gruppe.name));
                                }
                              }}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>

                      {gruppe.sortimente.map((name) => (
                        <div className="wg-zeile wg-tief" key={name}>
                          <button
                            className={`wg-name ${
                              eintrag?.sortimente.get(name) ? 'steht' : 'fehlt'
                            }${pinsel === name ? ' aktiv' : ''}`}
                            onClick={() => nimm(name)}
                            title="Aufnehmen und im Plan zuordnen"
                          >
                            {name}
                          </button>
                          {pflege && (
                            <>
                              <button
                                className="wg-werkzeug"
                                title="Sortiment umbenennen"
                                onClick={() => {
                                  const neu = frage('Sortiment umbenennen:', name);
                                  if (neu) {
                                    pflegen(
                                      umbenanntesSortiment(
                                        sortiment,
                                        abteilung.name,
                                        gruppe.name,
                                        name,
                                        neu,
                                      ),
                                    );
                                  }
                                }}
                              >
                                ✎
                              </button>
                              <button
                                className="wg-werkzeug gefahr"
                                title="Sortiment entfernen"
                                onClick={() =>
                                  pflegen(
                                    ohneSortiment(sortiment, abteilung.name, gruppe.name, name),
                                  )
                                }
                              >
                                ×
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          );
        })}

        {gezeigt.abteilungen.length === 0 && sortiment.abteilungen.length > 0 && (
          <p className="hinweis" style={{ margin: 8 }}>
            Nichts gefunden.
          </p>
        )}

        {/* Ohne geladene Liste steht hier nichts – und das soll man sehen.
            Eine allgemeine Beispielliste stand einmal hier; sie sah aus wie
            das Sortiment des Marktes, war es aber nicht. */}
        {sortiment.abteilungen.length === 0 && (
          <div style={{ padding: 12 }}>
            <p className="hinweis">
              <strong>Noch keine Sortimentsliste geladen.</strong>
            </p>
            <p className="hinweis">
              Die Liste gehört dem Markt und nicht dem Programm — deshalb liegt sie nicht
              darin. Lade sie unten: eine JSON-Datei oder eine Tabelle mit drei Spalten
              (Abteilung; Warengruppe; Sortiment).
            </p>
            <p className="hinweis">
              Danach bleibt sie auf diesem Rechner. Ändern kannst du sie hier jederzeit über
              den Stift oben.
            </p>
          </div>
        )}

        {pflege && (
          <button
            className="knopf"
            style={{ width: '100%', marginTop: 10 }}
            onClick={() => {
              const name = frage('Neue Abteilung:');
              if (name) pflegen(mitAbteilung(sortiment, name));
            }}
          >
            + Abteilung
          </button>
        )}
      </div>

      <div className="wg-fuss">
        <div className="kennzahl">
          <span>Abteilungen · Warengruppen · Sortimente</span>
          <span className="kennzahl-wert">
            {zahlen.abteilungen} · {zahlen.warengruppen} · {zahlen.sortimente}
          </span>
        </div>
        <label className="knopf" style={{ width: '100%', textAlign: 'center' }}>
          Sortimentsliste laden
          <input
            type="file"
            accept=".json,.csv,.txt,.tsv"
            style={{ display: 'none' }}
            onChange={(e) => {
              void laden(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {fehler && (
          <p className="hinweis" style={{ marginTop: 6, color: 'var(--rot, #b3372a)' }}>
            {fehler}
          </p>
        )}
      </div>
    </aside>
  );
}
