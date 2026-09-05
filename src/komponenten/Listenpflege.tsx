import { useState } from 'react';
import {
  gefiltert,
  mitAbteilung,
  mitSortiment,
  mitWarengruppe,
  ohneAbteilung,
  ohneSortiment,
  ohneWarengruppe,
  pfadVon,
  umbenannteAbteilung,
  umbenannteWarengruppe,
  umbenanntesSortiment,
  umfang,
  umgehaengteWarengruppe,
  umgehaengtesSortiment,
  verschobeneAbteilung,
  verschobeneWarengruppe,
  verschobenesSortiment,
} from '../logik/sortiment';
import { alsTabellenblob } from '../logik/sortimentsausgabe';
import { ladeDateiHerunter } from '../speicher/projektArchiv';
import { metersAmEintrag } from '../speicher/sortimentsabgleich';
import { usePlanStore } from '../zustand/planStore';
import { Dialog } from './Dialog';
import { Planabgleich } from './Planabgleich';

/**
 * Die Sortimentsliste bearbeiten – in einem eigenen Fenster.
 *
 * **Warum getrennt vom Zuordnen.** Links in der Spalte wird geplant: einen
 * Namen aufnehmen, im Plan die Meter anklicken, fertig. Das ist ein Handgriff,
 * den man hundertmal am Tag macht. Umbenennen, verschieben und ergänzen sind
 * etwas anderes: seltener, dafür folgenreich, und sie brauchen Platz. Beides
 * in einer schmalen Spalte übereinanderzulegen hieß, dass an jeder Zeile sechs
 * Knöpfe standen und man den Namen kaum noch las.
 *
 * Hier ist deshalb nur die Pflege, und dafür in voller Breite: drei Stufen,
 * an jeder dieselben Werkzeuge.
 *
 * **Was hier geändert wird, kommt im Plan an.** Umbenennen und Umhängen gehen
 * über `benenneSortimentUm`; die Pfade an den Strecken, die Beschriftungen im
 * Plan, die grünen Haken und die Zuordnungen ziehen mit (siehe
 * `logik/pfadumbenennung.ts`). Nachträglich anzufassen ist nichts.
 */
export function Listenpflege({ schliessen }: { schliessen: () => void }) {
  const sortiment = usePlanStore((s) => s.sortiment);
  const [suche, setSuche] = useState('');
  const [meldung, setMeldung] = useState<string | null>(null);
  /**
   * Was gerade umgehängt wird – ein Sortiment oder eine ganze Warengruppe.
   *
   * Wie beim Zuordnen wird das **Ziel geklickt** und nicht getippt: Ein
   * abgetippter Name kann sich vertippen, und dann stünde der Eintrag in
   * einer Warengruppe, die es nicht gibt.
   */
  const [umzug, setUmzug] = useState<{
    art: 'sortiment' | 'warengruppe';
    abteilung: string;
    gruppe?: string;
    name: string;
  } | null>(null);

  const offeneAbteilungen = usePlanStore((s) => s.offeneAbteilungen);
  const zugeklappteGruppen = usePlanStore((s) => s.zugeklappteGruppen);

  const gezeigt = gefiltert(sortiment, suche);
  const sucht = suche.trim() !== '';
  const zahlen = umfang(sortiment);

  /**
   * Auf- und zugeklappt wird über denselben Zustand wie in der Spalte links.
   *
   * Wer eine Abteilung hier zuklappt, findet sie auch dort zugeklappt — es
   * ist dieselbe Liste, und zwei Zustände dafür wären eine Falle.
   *
   * Beim Suchen ist alles offen: Man will die Treffer sehen und nicht erst
   * aufklappen, was man gerade gefunden hat.
   */
  const abteilungOffen = (name: string) => sucht || offeneAbteilungen.includes(name);
  const gruppeOffen = (pfad: string) => sucht || !zugeklappteGruppen.includes(pfad);

  const pflegen = (liste: typeof sortiment) => usePlanStore.getState().pflegeSortiment(liste);

  /** Umbenennen und Umhängen – und die Planung mitnehmen. */
  const umbenennen = (liste: typeof sortiment, altPfad: string, neuPfad: string) =>
    usePlanStore.getState().benenneSortimentUm(liste, altPfad, neuPfad);

  /**
   * Vor dem Entfernen sagen, was daran hängt.
   *
   * **Löschen ist nicht Umbenennen.** Wer einen Eintrag aus der Liste nimmt,
   * nimmt ihn nicht aus dem Markt: Die Meter stehen weiter am Möbel, gehören
   * aber zu nichts mehr. In der Auswertung rutschen sie ans Ende, unter einen
   * Namen, den die Liste nicht mehr kennt, und der grüne Haken ist weg.
   *
   * Das darf man wollen. Man soll es nur wissen – und dafür braucht es eine
   * Zahl. „steht auf 12,40 m in 2 Planungen" ist eine Antwort; „bist du
   * sicher?" ist keine.
   */
  const entferne = async (was: string, pfad: string, ohne: () => typeof sortiment) => {
    const { meter, planungen } = await metersAmEintrag(pfad, usePlanStore.getState().projekt);
    const anhang =
      meter > 0
        ? `\n\nEs steht auf ${(meter / 100).toLocaleString('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} m in ${planungen === 1 ? 'einer Planung' : `${planungen} Planungen`}. ` +
          'Die Meter bleiben im Plan stehen, gehören danach aber zu keinem Eintrag mehr.'
        : '';
    if (window.confirm(`${was}${anhang}`)) pflegen(ohne());
  };

  /** Fragt nach einem Namen. Leer oder abgebrochen heißt: nichts tun. */
  const frage = (text: string, vorgabe = '') => {
    const antwort = window.prompt(text, vorgabe);
    return antwort?.trim() ? antwort.trim() : null;
  };

  const Rang = ({ hoch, runter }: { hoch: () => void; runter: () => void }) => (
    <>
      <button className="wg-werkzeug" title="Eine Stelle nach oben" onClick={hoch}>
        ↑
      </button>
      <button className="wg-werkzeug" title="Eine Stelle nach unten" onClick={runter}>
        ↓
      </button>
    </>
  );

  /** Ein Umzug beginnt – oder wird durch denselben Knopf wieder aufgehoben. */
  const starteUmzug = (neu: NonNullable<typeof umzug>) =>
    setUmzug(
      umzug && umzug.art === neu.art && umzug.name === neu.name && umzug.gruppe === neu.gruppe
        ? null
        : neu,
    );

  /** Das Ziel eines Umzugs ist angeklickt – jetzt wird umgehängt. */
  const hierhin = (abteilung: string, gruppe?: string) => {
    if (!umzug) return false;

    if (umzug.art === 'sortiment') {
      if (!gruppe || !umzug.gruppe) return false;
      if (umzug.abteilung !== abteilung || umzug.gruppe !== gruppe) {
        umbenennen(
          umgehaengtesSortiment(
            sortiment,
            umzug.abteilung,
            umzug.gruppe,
            umzug.name,
            abteilung,
            gruppe,
          ),
          pfadVon(umzug.abteilung, umzug.gruppe, umzug.name),
          pfadVon(abteilung, gruppe, umzug.name),
        );
        setMeldung(`„${umzug.name}" steht jetzt unter „${gruppe}".`);
      }
      setUmzug(null);
      return true;
    }

    if (umzug.abteilung !== abteilung) {
      umbenennen(
        umgehaengteWarengruppe(sortiment, umzug.abteilung, umzug.name, abteilung),
        pfadVon(umzug.abteilung, umzug.name),
        pfadVon(abteilung, umzug.name),
      );
      setMeldung(`„${umzug.name}" steht jetzt in „${abteilung}".`);
    }
    setUmzug(null);
    return true;
  };

  return (
    <Dialog
      titel="Sortimentsliste bearbeiten"
      breit
      schliessen={schliessen}
      fuss={
        <>
          <span className="hinweis" style={{ flex: 1 }}>
            {meldung ??
              `${zahlen.abteilungen} Abteilungen · ${zahlen.warengruppen} Warengruppen · ${zahlen.sortimente} Sortimente`}
          </span>
          <button
            className="knopf"
            title="Die Liste als Tabelle ausgeben — Excel öffnet sie mit einem Doppelklick"
            onClick={() => {
              ladeDateiHerunter(alsTabellenblob(sortiment), 'Sortimentsliste.csv');
              setMeldung('Ausgegeben — die Datei liegt bei deinen Downloads.');
            }}
          >
            ↓ Nach Excel ausgeben
          </button>
          <button className="knopf aktiv" onClick={schliessen}>
            Fertig
          </button>
        </>
      }
    >
      <p className="hinweis" style={{ marginTop: 0 }}>
        Umbenennen und Verschieben kommen im Plan an — in <strong>allen</strong> Planungen, denn die
        Liste gilt für alle Märkte. Die Meter ziehen mit, ebenso die Beschriftung am Möbel, die
        grünen Haken und die Auswertung. Nachträglich anzufassen ist nichts.
      </p>

      {/* Was aus der Zeit vor dem Nachziehen stehen geblieben ist, steht
          hier — siehe `Planabgleich`. Ist nichts offen, zeigt sich nichts. */}
      <Planabgleich />

      <input
        type="text"
        className="wg-suche"
        placeholder="Warengruppe oder Sortiment suchen …"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
      />

      {umzug && (
        <p className="hinweis warnung" style={{ margin: '6px 0 0' }}>
          „{umzug.name}" wartet auf sein Ziel —{' '}
          {umzug.art === 'sortiment' ? 'eine Warengruppe' : 'eine Abteilung'} anklicken.{' '}
          <button className="knopf-flach" onClick={() => setUmzug(null)}>
            Abbrechen
          </button>
        </p>
      )}

      <div className="pflege-liste">
        {gezeigt.abteilungen.map((abteilung) => (
          <div key={abteilung.name} className="pflege-abteilung">
            <div className="wg-zeile">
              <button
                className="wg-klappe"
                title={abteilungOffen(abteilung.name) ? 'Abteilung zuklappen' : 'Abteilung aufklappen'}
                onClick={() => usePlanStore.getState().schalteAbteilung(abteilung.name)}
              >
                {abteilungOffen(abteilung.name) ? '▾' : '▸'}
              </button>
              <button
                className={`wg-name stark${umzug?.art === 'warengruppe' ? ' wg-ziel' : ''}`}
                title={
                  umzug?.art === 'warengruppe'
                    ? `„${umzug.name}" hierher verschieben`
                    : 'Abteilung auf- und zuklappen oder als Ziel anklicken'
                }
                onClick={() => {
                  if (hierhin(abteilung.name)) return;
                  usePlanStore.getState().schalteAbteilung(abteilung.name);
                }}
              >
                {abteilung.name}
                <span className="kategorie-anzahl"> {abteilung.warengruppen.length}</span>
              </button>
              <Rang
                hoch={() => pflegen(verschobeneAbteilung(sortiment, abteilung.name, -1))}
                runter={() => pflegen(verschobeneAbteilung(sortiment, abteilung.name, 1))}
              />
              <button
                className="wg-werkzeug"
                title="Abteilung umbenennen"
                onClick={() => {
                  const name = frage('Abteilung umbenennen:', abteilung.name);
                  if (name)
                    umbenennen(
                      umbenannteAbteilung(sortiment, abteilung.name, name),
                      pfadVon(abteilung.name),
                      pfadVon(name),
                    );
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
                onClick={() =>
                  void entferne(
                    `„${abteilung.name}" mit allen Warengruppen entfernen?`,
                    pfadVon(abteilung.name),
                    () => ohneAbteilung(sortiment, abteilung.name),
                  )
                }
              >
                ×
              </button>
            </div>

            {abteilungOffen(abteilung.name) &&
              abteilung.warengruppen.map((gruppe) => (
              <div key={gruppe.name}>
                <div className="wg-zeile wg-tief">
                  <button
                    className="wg-klappe"
                    title={
                      gruppeOffen(pfadVon(abteilung.name, gruppe.name))
                        ? 'Warengruppe zuklappen'
                        : 'Warengruppe aufklappen'
                    }
                    onClick={() =>
                      usePlanStore
                        .getState()
                        .schalteWarengruppe(pfadVon(abteilung.name, gruppe.name))
                    }
                  >
                    {gruppeOffen(pfadVon(abteilung.name, gruppe.name)) ? '▾' : '▸'}
                  </button>
                  <button
                    className={`wg-name${umzug?.art === 'sortiment' ? ' wg-ziel' : ''}`}
                    title={
                      umzug?.art === 'sortiment'
                        ? `„${umzug.name}" hierher verschieben`
                        : 'Warengruppe auf- und zuklappen oder als Ziel anklicken'
                    }
                    onClick={() => {
                      if (hierhin(abteilung.name, gruppe.name)) return;
                      usePlanStore
                        .getState()
                        .schalteWarengruppe(pfadVon(abteilung.name, gruppe.name));
                    }}
                  >
                    {gruppe.name}
                    <span className="kategorie-anzahl"> {gruppe.sortimente.length}</span>
                  </button>
                  <Rang
                    hoch={() =>
                      pflegen(verschobeneWarengruppe(sortiment, abteilung.name, gruppe.name, -1))
                    }
                    runter={() =>
                      pflegen(verschobeneWarengruppe(sortiment, abteilung.name, gruppe.name, 1))
                    }
                  />
                  <button
                    className={`wg-werkzeug${
                      umzug?.art === 'warengruppe' && umzug.name === gruppe.name ? ' aktiv' : ''
                    }`}
                    title="In eine andere Abteilung verschieben — danach die Abteilung anklicken"
                    onClick={() =>
                      starteUmzug({
                        art: 'warengruppe',
                        abteilung: abteilung.name,
                        name: gruppe.name,
                      })
                    }
                  >
                    ⇄
                  </button>
                  <button
                    className="wg-werkzeug"
                    title="Warengruppe umbenennen"
                    onClick={() => {
                      const name = frage('Warengruppe umbenennen:', gruppe.name);
                      if (name)
                        umbenennen(
                          umbenannteWarengruppe(sortiment, abteilung.name, gruppe.name, name),
                          pfadVon(abteilung.name, gruppe.name),
                          pfadVon(abteilung.name, name),
                        );
                    }}
                  >
                    ✎
                  </button>
                  <button
                    className="wg-werkzeug"
                    title="Sortiment anlegen"
                    onClick={() => {
                      const name = frage(`Neues Sortiment in „${gruppe.name}":`);
                      if (name)
                        pflegen(mitSortiment(sortiment, abteilung.name, gruppe.name, name));
                    }}
                  >
                    +
                  </button>
                  <button
                    className="wg-werkzeug gefahr"
                    title="Warengruppe mit ihren Sortimenten entfernen"
                    onClick={() =>
                      void entferne(
                        `„${gruppe.name}" entfernen?`,
                        pfadVon(abteilung.name, gruppe.name),
                        () => ohneWarengruppe(sortiment, abteilung.name, gruppe.name),
                      )
                    }
                  >
                    ×
                  </button>
                </div>

                {gruppeOffen(pfadVon(abteilung.name, gruppe.name)) &&
                  gruppe.sortimente.map((name) => (
                  <div className="wg-zeile wg-tiefer" key={name}>
                    <span className="wg-name still">{name}</span>
                    <Rang
                      hoch={() =>
                        pflegen(
                          verschobenesSortiment(sortiment, abteilung.name, gruppe.name, name, -1),
                        )
                      }
                      runter={() =>
                        pflegen(
                          verschobenesSortiment(sortiment, abteilung.name, gruppe.name, name, 1),
                        )
                      }
                    />
                    <button
                      className={`wg-werkzeug${
                        umzug?.art === 'sortiment' &&
                        umzug.name === name &&
                        umzug.gruppe === gruppe.name
                          ? ' aktiv'
                          : ''
                      }`}
                      title="In eine andere Warengruppe verschieben — danach die Warengruppe anklicken"
                      onClick={() =>
                        starteUmzug({
                          art: 'sortiment',
                          abteilung: abteilung.name,
                          gruppe: gruppe.name,
                          name,
                        })
                      }
                    >
                      ⇄
                    </button>
                    <button
                      className="wg-werkzeug"
                      title="Sortiment umbenennen"
                      onClick={() => {
                        const neu = frage('Sortiment umbenennen:', name);
                        if (neu)
                          umbenennen(
                            umbenanntesSortiment(
                              sortiment,
                              abteilung.name,
                              gruppe.name,
                              name,
                              neu,
                            ),
                            pfadVon(abteilung.name, gruppe.name, name),
                            pfadVon(abteilung.name, gruppe.name, neu),
                          );
                      }}
                    >
                      ✎
                    </button>
                    <button
                      className="wg-werkzeug gefahr"
                      title="Sortiment entfernen"
                      onClick={() =>
                        void entferne(
                          `„${name}" entfernen?`,
                          pfadVon(abteilung.name, gruppe.name, name),
                          () => ohneSortiment(sortiment, abteilung.name, gruppe.name, name),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        {sucht && gezeigt.abteilungen.length === 0 && (
          <p className="hinweis">Nichts gefunden.</p>
        )}

        {sortiment.abteilungen.length === 0 && (
          <p className="hinweis">
            Noch keine Sortimentsliste geladen. Links in der Spalte lädst du sie.
          </p>
        )}
      </div>

      <button
        className="knopf"
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => {
          const name = frage('Neue Abteilung:');
          if (name) pflegen(mitAbteilung(sortiment, name));
        }}
      >
        + Abteilung
      </button>
    </Dialog>
  );
}
