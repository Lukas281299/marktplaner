import { useMemo, useState } from 'react';
import {
  abteilungsstand,
  gefiltert,
  gruppenstand,
  istAbgedeckt,
  leseSortimentsliste,
  mitAbteilung,
  mitSortiment,
  mitWarengruppe,
  ohneAbteilung,
  ohneSortiment,
  naechsterStand,
  ohneWarengruppe,
  pfadVon,
  standVon,
  umbenannteAbteilung,
  umbenannteWarengruppe,
  umbenanntesSortiment,
  zuordnungVon,
  umfang,
  vereinigt,
  type Standwert,
} from '../logik/sortiment';
import { pfadeImPlan } from '../logik/planstand';
import { usePlanStore } from '../zustand/planStore';
import { Spaltenschalter } from './Spaltengriffe';

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
  const stand = usePlanStore((s) => s.projekt.sortimentsstand);
  const zuordnungen = usePlanStore((s) => s.projekt.zuordnungen);
  const zuordnungslauf = usePlanStore((s) => s.zuordnungslauf);
  const elemente = usePlanStore((s) => s.projekt.elemente);
  const ebenen = usePlanStore((s) => s.projekt.ebenen);
  const projekt = usePlanStore((s) => s.projekt);

  /**
   * Was im Plan steht, ist grün – jedes Mal frisch gelesen.
   *
   * Über `elemente` und `ebenen` gemerkt und nicht über das ganze Projekt:
   * Sonst liefe die Rechnung bei jedem Verschieben eines Möbels erneut.
   */
  const imPlan = useMemo(
    () => pfadeImPlan(projekt, sortiment),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elemente, ebenen, sortiment],
  );
  const pinsel = usePlanStore((s) => s.warengruppenPinsel);

  const offeneAbteilungen = usePlanStore((s) => s.offeneAbteilungen);

  const [suche, setSuche] = useState('');
  const [pflege, setPflege] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const gezeigt = gefiltert(sortiment, suche);
  const zahlen = umfang(sortiment);
  const sucht = suche.trim() !== '';

  /**
   * Ein Klick auf den Punkt schaltet weiter: rot → grün → grau → rot.
   *
   * Was im Plan steht, überspringt der Speicher dabei: Es ist gezeichnet, und
   * daran ändert kein Klick in der Liste etwas. Auf einer Sammelzeile wirkt
   * der Klick trotzdem – auf alles darunter, was **nicht** gezeichnet ist.
   */
  const schalte = (pfad: string, jetzt: Standwert) =>
    usePlanStore.getState().setzeSortimentsstand(pfad, naechsterStand(jetzt));

  const titel = (wert: Standwert, pfad?: string) =>
    pfad && imPlan.has(pfad)
      ? 'Steht im Plan — zum Ändern die Meter am Möbel ändern'
      : pfad && istAbgedeckt(imPlan, pfad)
      ? 'Die Stufe darüber steht als Ganzes im Plan — damit ist es untergebracht'
      : wert === 'gruen'
        ? 'Steht im Markt — anklicken für „nicht vorgesehen"'
        : wert === 'grau'
          ? 'In diesem Markt nicht vorgesehen — anklicken für „offen"'
        : wert === 'zugeordnet'
          ? 'Zählt zu einer anderen Warengruppe — gilt damit als untergebracht'
          : 'Offen — anklicken für „steht im Markt"';

  const pflegen = (liste: typeof sortiment) => usePlanStore.getState().pflegeSortiment(liste);

  /**
   * Umbenennen – und die Planung mitnehmen.
   *
   * Die Strecken im Plan merken sich ihren Pfad als Zeichenkette, ebenso die
   * grünen Haken. Wer nur die Liste änderte, ließe beide auf einen Namen
   * zeigen, den es nicht mehr gibt.
   */
  const umbenennen = (liste: typeof sortiment, altPfad: string, neuPfad: string) =>
    usePlanStore.getState().benenneSortimentUm(liste, altPfad, neuPfad);
  /**
   * Einen Namen aufnehmen – mit seinem Platz in der Liste.
   *
   * Der Pfad kommt mit, weil der Name allein nicht eindeutig ist: „Kuchen"
   * steht in dieser Liste fünfmal. Wer hier klickt, meint genau diesen
   * Eintrag, und genau der landet später im Plan.
   */
  const nimm = (name: string, pfad: string) => {
    // Läuft gerade eine Zuordnung, ist dieser Klick die Antwort darauf:
    // „Waffeln zählt zu **diesem** hier."
    if (zuordnungslauf) {
      if (zuordnungslauf !== name) usePlanStore.getState().setzeZuordnung(zuordnungslauf, name);
      usePlanStore.getState().starteZuordnung(null);
      return;
    }
    usePlanStore
      .getState()
      .setzeWarengruppenPinsel(pinsel?.pfad === pfad ? null : { name, pfad });
  };

  /**
   * „Zählt zu" – eine Warengruppe schlägt ihre Meter einer anderen zu.
   *
   * Wer vier Meter „Kuchen" einzeichnet, obwohl dort auch Waffeln liegen,
   * ordnet Waffeln dem Kuchen zu. Die Meter laufen dann über Kuchen, und in
   * der Auswertung sieht es nicht so aus, als sei Waffeln vergessen worden.
   *
   * Eine Entscheidung über **diesen** Markt und nicht über die Liste –
   * deshalb steht sie in der Planung, wie der Haken davor auch.
   */
  const ordneZu = (name: string) => {
    // Steht schon eine Zuordnung, nimmt der Klick sie weg – das ist der
    // zweite Handgriff, den man an dieser Stelle braucht.
    if (zuordnungVon(zuordnungen, name)) {
      usePlanStore.getState().setzeZuordnung(name, null);
      return;
    }
    // Sonst beginnt der Lauf: Das Ziel wird geklickt, nicht getippt. Ein
    // abgetippter Name kann sich vertippen, und der Fehler bliebe unsichtbar –
    // die Meter liefen auf einen Namen, den es nicht gibt.
    usePlanStore.getState().starteZuordnung(name);
  };

  /** Die Marke „→ Kuchen" hinter einem zugeordneten Namen. */
  const zuordnungsmarke = (name: string) => {
    const ziel = zuordnungVon(zuordnungen, name);
    if (!ziel) return null;
    return (
      <button
        className="wg-zuordnung"
        title={`Die Meter zählen zu „${ziel}" — anklicken zum Ändern`}
        onClick={() => ordneZu(name)}
      >
        → {ziel}
      </button>
    );
  };

  /** Fragt nach einem Namen. Leer oder abgebrochen heißt: nichts tun. */
  const frage = (text: string, vorgabe = '') => {
    const antwort = window.prompt(text, vorgabe);
    return antwort?.trim() ? antwort.trim() : null;
  };

  /**
   * Eine Datei einlesen – ergänzend oder ersetzend.
   *
   * Ergänzen ist der übliche Weg: Die Sortimentsliste des Marktes wurde
   * überarbeitet, ein paar Sortimente sind dazugekommen. Ersetzen wirft alles
   * weg, auch die eigenen Ergänzungen – deshalb fragt es vorher nach.
   */
  const laden = async (datei: File | undefined, ersetzen: boolean) => {
    if (!datei) return;
    try {
      const gelesen = leseSortimentsliste(await datei.text());
      setFehler(null);

      if (ersetzen) {
        usePlanStore.getState().setzeSortimentsliste(gelesen, true);
        const z = umfang(gelesen);
        setMeldung(
          `Liste ersetzt: ${z.abteilungen} Abteilungen, ${z.warengruppen} Warengruppen, ${z.sortimente} Sortimente.`,
        );
        return;
      }

      const { liste, zuwachs } = vereinigt(sortiment, gelesen);
      usePlanStore.getState().setzeSortimentsliste(liste, true);
      const teile = [
        zuwachs.abteilungen > 0 ? `${zuwachs.abteilungen} Abteilungen` : null,
        zuwachs.warengruppen > 0 ? `${zuwachs.warengruppen} Warengruppen` : null,
        zuwachs.sortimente > 0 ? `${zuwachs.sortimente} Sortimente` : null,
      ].filter(Boolean);
      setMeldung(teile.length > 0 ? `Ergänzt: ${teile.join(', ')}.` : 'Nichts Neues dabei.');
    } catch (e) {
      setMeldung(null);
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
          <Spaltenschalter seite="links" />
        </div>

        <input
          type="text"
          className="wg-suche"
          placeholder="Warengruppe oder Sortiment suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />

        {zuordnungslauf && (
          <div className="pinsel zuordnen">
            <span>
              <strong>{zuordnungslauf}</strong> zählt zu …
              <span className="pinselpfad">
                Ziel unten in der Liste anklicken — oder im Plan einen Meter, auf dem es schon
                steht.
              </span>
            </span>
            <button
              className="knopf knopf-nur-symbol"
              title="Abbrechen (Esc)"
              onClick={() => usePlanStore.getState().starteZuordnung(null)}
            >
              ×
            </button>
          </div>
        )}

        {pinsel ? (
          <div className="pinsel">
            <span>
              <strong>{pinsel.name}</strong> — Meter anklicken, dann <strong>Enter</strong>.{' '}
              <strong>Entf</strong> nimmt sie wieder weg.
              {/* Der volle Pfad darunter: Bei „Kuchen" ist erst daran zu
                  sehen, welches der fünf gemeint ist. */}
              <span className="pinselpfad">{pinsel.pfad}</span>
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
            Namen anklicken, im Plan die Meter anklicken, <strong>Enter</strong> schreibt,
            <strong> Entf</strong> löscht. Der Punkt davor:
            <span className="wg-punkt rot" /> offen,
            <span className="wg-punkt gruen" /> steht,
            <span className="wg-punkt grau" /> nicht vorgesehen.
          </p>
        )}
      </div>

      <div className="spalte-inhalt">
        {gezeigt.abteilungen.map((abteilung) => {
          // Zugeklappt ist der Anfang; beim Suchen geht alles auf, sonst
          // sähe man die Treffer nicht.
          const offen = sucht || offeneAbteilungen.includes(abteilung.name);
          const zahl = abteilungsstand(stand, abteilung, zuordnungen, imPlan);
          return (
            <div key={abteilung.name} className="wg-abteilung">
              <div className="wg-kopf">
                <button
                  className="wg-titel"
                  onClick={() => usePlanStore.getState().schalteAbteilung(abteilung.name)}
                >
                  <span className="wg-pfeil">{offen ? '▾' : '▸'}</span>
                  {abteilung.name}
                </button>
                <span className={`wg-zahl ${zahl.wert}`}>
                  {zahl.zahlen.gruen}/{zahl.zahlen.gruen + zahl.zahlen.offen}
                  {zahl.zahlen.grau > 0 ? ` (${zahl.zahlen.grau})` : ''}
                </span>
                <button
                  className={`wg-punkt ${zahl.wert}`}
                  title={titel(zahl.wert, pfadVon(abteilung.name))}
                  onClick={() => schalte(pfadVon(abteilung.name), zahl.wert)}
                />
                {pflege && (
                  <>
                    <button
                      className="wg-werkzeug"
                      title="Abteilung umbenennen"
                      onClick={() => {
                        const name = frage('Abteilung umbenennen:', abteilung.name);
                        if (name) {
                          umbenennen(
                            umbenannteAbteilung(sortiment, abteilung.name, name),
                            pfadVon(abteilung.name),
                            pfadVon(name),
                          );
                        }
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
                  const eigen = pfadVon(abteilung.name, gruppe.name);
                  const gStand = gruppenstand(stand, abteilung.name, gruppe, zuordnungen, imPlan);
                  return (
                    <div key={gruppe.name}>
                      <div className="wg-zeile">
                        <button
                          className={`wg-punkt ${gStand.wert}`}
                          title={titel(gStand.wert, eigen)}
                          onClick={() => schalte(eigen, gStand.wert)}
                        />
                        <button
                          className={`wg-name${pinsel?.pfad === eigen ? ' aktiv' : ''}`}
                          onClick={() => nimm(gruppe.name, eigen)}
                          title="Aufnehmen — dann im Plan die Meter anklicken und Enter drücken"
                        >
                          {gruppe.name}
                        </button>
                        {zuordnungsmarke(gruppe.name)}
                        {pflege && (
                          <>
                            <button
                              className="wg-werkzeug"
                              title={
                                zuordnungVon(zuordnungen, gruppe.name)
                                  ? `Die Zuordnung von „${gruppe.name}" lösen`
                                  : `Die Meter von „${gruppe.name}" einer anderen Warengruppe zuschlagen`
                              }
                              onClick={() => ordneZu(gruppe.name)}
                            >
                              →
                            </button>
                            <button
                              className="wg-werkzeug"
                              title="Warengruppe umbenennen"
                              onClick={() => {
                                const name = frage('Warengruppe umbenennen:', gruppe.name);
                                if (name) {
                                  umbenennen(
                                    umbenannteWarengruppe(
                                      sortiment,
                                      abteilung.name,
                                      gruppe.name,
                                      name,
                                    ),
                                    pfadVon(abteilung.name, gruppe.name),
                                    pfadVon(abteilung.name, name),
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

                      {gruppe.sortimente.map((name) => {
                        const pfad = pfadVon(abteilung.name, gruppe.name, name);
                        const wert = standVon(stand, pfad, zuordnungen, imPlan);
                        return (
                        <div className="wg-zeile wg-tief" key={name}>
                          <button
                            className={`wg-punkt ${wert}`}
                            title={titel(wert, pfad)}
                            onClick={() => schalte(pfad, wert)}
                          />
                          <button
                            className={`wg-name${pinsel?.pfad === pfad ? ' aktiv' : ''}`}
                            onClick={() => nimm(name, pfad)}
                            title="Aufnehmen — dann im Plan die Meter anklicken und Enter drücken"
                          >
                            {name}
                          </button>
                          {zuordnungsmarke(name)}
                          {pflege && (
                            <>
                              <button
                                className="wg-werkzeug"
                                title={
                                  zuordnungVon(zuordnungen, name)
                                    ? `Die Zuordnung von „${name}" lösen`
                                    : `Die Meter von „${name}" einer anderen Warengruppe zuschlagen`
                                }
                                onClick={() => ordneZu(name)}
                              >
                                →
                              </button>
                              <button
                                className="wg-werkzeug"
                                title="Sortiment umbenennen"
                                onClick={() => {
                                  const neu = frage('Sortiment umbenennen:', name);
                                  if (neu) {
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
                        );
                      })}
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
        <div className="knopfreihe">
          <label className="knopf" style={{ flex: 1, textAlign: 'center' }}>
            {sortiment.abteilungen.length === 0 ? 'Sortimentsliste laden' : 'Liste ergänzen'}
            <input
              type="file"
              accept=".json,.csv,.txt,.tsv"
              style={{ display: 'none' }}
              onChange={(e) => {
                void laden(e.target.files?.[0], false);
                e.target.value = '';
              }}
            />
          </label>
          {sortiment.abteilungen.length > 0 && (
            <label
              className="knopf"
              title="Die ganze Liste durch die Datei ersetzen – eigene Ergänzungen gehen dabei verloren"
            >
              ersetzen
              <input
                type="file"
                accept=".json,.csv,.txt,.tsv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const datei = e.target.files?.[0];
                  e.target.value = '';
                  if (datei && window.confirm('Die ganze Liste ersetzen? Eigene Ergänzungen gehen dabei verloren.')) {
                    void laden(datei, true);
                  }
                }}
              />
            </label>
          )}
        </div>
        {meldung && (
          <p className="hinweis" style={{ marginTop: 6 }}>
            {meldung}
          </p>
        )}
        {fehler && (
          <p className="hinweis" style={{ marginTop: 6, color: 'var(--rot, #b3372a)' }}>
            {fehler}
          </p>
        )}
      </div>
    </aside>
  );
}
