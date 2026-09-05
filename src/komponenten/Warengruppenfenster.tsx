import { useMemo, useState } from 'react';
import {
  abteilungsstand,
  gefiltert,
  gruppenstand,
  istAbgedeckt,
  leseSortimentsliste,
  naechsterStand,
  pfadVon,
  standVon,
  zuordnungVon,
  umfang,
  vereinigt,
  type Standwert,
} from '../logik/sortiment';
import { pfadeImPlan } from '../logik/planstand';
import {
  pruefeAllePlanungen,
  ziehePlanungNach,
  type Planbericht,
} from '../speicher/sortimentsabgleich';
import { usePlanStore } from '../zustand/planStore';
import { Listenpflege } from './Listenpflege';
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
 *  - **Zuschlagen.** Über den **→** zählt eine Warengruppe zu einer anderen,
 *    ohne dass man sie im Plan setzen müsste.
 *
 * **Bearbeitet wird woanders.** Umbenennen, verschieben und ergänzen sind
 * seltener, dafür folgenreich, und sie brauchen Platz. Der Stift oben öffnet
 * dafür ein eigenes Fenster (`Listenpflege`). Beides in dieser schmalen
 * Spalte übereinanderzulegen hieß, dass an jeder Zeile sechs Knöpfe standen
 * und man den Namen kaum noch las.
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
  const zugeklappteGruppen = usePlanStore((s) => s.zugeklappteGruppen);

  const [suche, setSuche] = useState('');
  const [pflege, setPflege] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  /**
   * Was die neue Liste in den Planungen nicht mehr kennt – je Planung.
   *
   * Steht nur nach dem Ersetzen da, und nur, wenn es etwas zu sagen gibt.
   * Die Pläne selbst sind unversehrt – gerissen ist die Verbindung zur Liste.
   * Geprüft werden **alle** gespeicherten Planungen, nicht nur die offene:
   * Die Liste gilt am Gerät für jede.
   */
  const [verwaist, setVerwaist] = useState<Planbericht[] | null>(null);
  const [prueft, setPrueft] = useState(false);

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

  /**
   * Zieht die Pfade in allen gemeldeten Planungen nach.
   *
   * Die geöffnete über den Datenspeicher – dort können ungespeicherte
   * Änderungen liegen, die eine Fassung aus der Datenbank überschriebe. Die
   * übrigen werden geladen, umgehängt und wieder abgelegt. Was keinen
   * eindeutigen Nachfolger hat, bleibt stehen und wird weiter gezeigt.
   */
  const zieheNach = async () => {
    if (!verwaist) return;
    let zahl = 0;
    const rest: Planbericht[] = [];
    for (const bericht of verwaist) {
      const umzug = new Map(
        bericht.eintraege.filter((e) => e.neu).map((e) => [e.alt, e.neu!] as const),
      );
      if (umzug.size > 0) {
        zahl += bericht.offen
          ? usePlanStore.getState().ziehePfadeNach(umzug)
          : await ziehePlanungNach(bericht.id, umzug);
      }
      const bleibt = bericht.eintraege.filter((e) => !e.neu);
      if (bleibt.length > 0) rest.push({ ...bericht, eintraege: bleibt });
    }
    const offen = rest.reduce((n, b) => n + b.eintraege.length, 0);
    setMeldung(
      `${zahl} ${zahl === 1 ? 'Eintrag' : 'Einträge'} nachgezogen.` +
        (offen > 0 ? ` ${offen} bleiben offen — dort ist der Name nicht eindeutig.` : ''),
    );
    setVerwaist(rest.length > 0 ? rest : null);
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
        // Nachsehen, was die Planungen benutzen und die neue Liste nicht mehr
        // führt. Angefasst wird dabei nichts – nur gezeigt.
        setPrueft(true);
        try {
          const berichte = await pruefeAllePlanungen(gelesen, usePlanStore.getState().projekt);
          setVerwaist(berichte.length > 0 ? berichte : null);
        } finally {
          setPrueft(false);
        }
        return;
      }
      setVerwaist(null);

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
            className="knopf"
            onClick={() => setPflege(true)}
            title="Sortimentsliste bearbeiten — umbenennen, verschieben, ergänzen"
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
              </div>

              {offen &&
                abteilung.warengruppen.map((gruppe) => {
                  const eigen = pfadVon(abteilung.name, gruppe.name);
                  const gStand = gruppenstand(stand, abteilung.name, gruppe, zuordnungen, imPlan);
                  // Zugeklappt wird die einzelne Warengruppe, nicht die
                  // Abteilung: Wer sucht, will alles sehen.
                  const gruppeOffen = sucht || !zugeklappteGruppen.includes(eigen);
                  return (
                    <div key={gruppe.name}>
                      <div className="wg-zeile">
                        <button
                          className="wg-klappe"
                          title={gruppeOffen ? 'Warengruppe zuklappen' : 'Warengruppe aufklappen'}
                          onClick={() => usePlanStore.getState().schalteWarengruppe(eigen)}
                        >
                          {gruppeOffen ? '▾' : '▸'}
                        </button>
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
                      </div>

                      {gruppeOffen &&
                        gruppe.sortimente.map((name) => {
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

      </div>

      {pflege && <Listenpflege schliessen={() => setPflege(false)} />}

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

        {prueft && (
          <p className="hinweis" style={{ marginTop: 6 }}>
            Alle Planungen werden gegen die neue Liste geprüft …
          </p>
        )}

        {/* Der Bericht nach dem Ersetzen. Er sagt zuerst, dass nichts
            verloren ist – das ist die Frage, die man in dem Moment hat. */}
        {verwaist && (
          <div className="listenabgleich">
            <p className="hinweis" style={{ marginTop: 6 }}>
              <strong>
                {verwaist.reduce((n, b) => n + b.eintraege.length, 0) === 1
                  ? '1 Eintrag'
                  : `${verwaist.reduce((n, b) => n + b.eintraege.length, 0)} Einträge`}
              </strong>{' '}
              in {verwaist.length === 1 ? 'einer Planung' : `${verwaist.length} Planungen`} kennt
              die neue Liste nicht mehr. Die Meter stehen weiter im Markt und sind richtig gerechnet —
              es fehlt nur die Verbindung zur Liste, und deshalb sind sie dort nicht abgehakt.
            </p>
            <div className="verwaistliste">
              {verwaist.map((bericht) => (
                <div key={bericht.id} className="verwaistplan">
                  <div className="verwaistplan-name">
                    {bericht.name}
                    {bericht.offen && <span className="kategorie-anzahl"> · geöffnet</span>}
                  </div>
                  {bericht.eintraege.slice(0, 8).map((eintrag) => (
                    <div className="kennzahl" key={eintrag.alt}>
                      <span style={{ overflowWrap: 'anywhere' }}>
                        {eintrag.alt}
                        {eintrag.neu ? (
                          <span className="pinselpfad">↳ neu: {eintrag.neu}</span>
                        ) : (
                          <span className="pinselpfad">
                            kein eindeutiger Nachfolger — am Möbel über ▾ wählen
                          </span>
                        )}
                      </span>
                      <span className="kennzahl-wert">
                        {(eintrag.meter / 100).toLocaleString('de-DE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        m
                      </span>
                    </div>
                  ))}
                  {bericht.eintraege.length > 8 && (
                    <p className="hinweis" style={{ margin: '2px 0 0' }}>
                      … und {bericht.eintraege.length - 8} weitere.
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="knopfreihe" style={{ marginTop: 6 }}>
              {verwaist.some((b) => b.eintraege.some((e) => e.neu)) && (
                <button
                  className="knopf knopf-haupt"
                  style={{ flex: 1 }}
                  title="Die Pfade in allen Planungen dort umhängen, wo der Name in der neuen Liste eindeutig ist. Der Text im Plan bleibt stehen."
                  onClick={() => void zieheNach()}
                >
                  {verwaist.reduce((n, b) => n + b.eintraege.filter((e) => e.neu).length, 0)}{' '}
                  nachziehen
                </button>
              )}
              <button className="knopf" onClick={() => setVerwaist(null)}>
                Schließen
              </button>
            </div>
          </div>
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
