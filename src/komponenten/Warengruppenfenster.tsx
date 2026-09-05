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
  umgehaengtesSortiment,
  umgehaengteWarengruppe,
  verschobeneAbteilung,
  verschobeneWarengruppe,
  verschobenesSortiment,
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
import { alsTabellenblob } from '../logik/sortimentsausgabe';
import { ladeDateiHerunter } from '../speicher/projektArchiv';
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
  const zugeklappteGruppen = usePlanStore((s) => s.zugeklappteGruppen);

  const [suche, setSuche] = useState('');
  const [pflege, setPflege] = useState(false);
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

  /**
   * Die beiden Pfeile, mit denen ein Eintrag seine Stelle wechselt.
   *
   * **Die Reihenfolge der Liste ist die des Marktes** – sie folgt dem Weg
   * durch den Laden, und die Auswertung übernimmt sie. Alphabetisch wäre eine
   * Ordnung, die niemand im Kopf hat.
   */
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

  /**
   * Ein Umzug beginnt oder wird abgebrochen.
   *
   * Läuft schon einer, hebt derselbe Knopf ihn wieder auf – sonst bliebe die
   * Liste in einem Zustand, aus dem man nur mit Raten herauskommt.
   */
  const starteUmzug = (neu: NonNullable<typeof umzug>) => {
    setUmzug(
      umzug && umzug.art === neu.art && umzug.name === neu.name && umzug.gruppe === neu.gruppe
        ? null
        : neu,
    );
  };

  /** Das Ziel eines Umzugs ist angeklickt – jetzt wird umgehängt. */
  const hierhin = (abteilung: string, gruppe?: string) => {
    if (!umzug) return false;
    if (umzug.art === 'sortiment') {
      if (!gruppe || !umzug.gruppe) return false;
      if (umzug.abteilung === abteilung && umzug.gruppe === gruppe) {
        setUmzug(null);
        return true;
      }
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
      setUmzug(null);
      return true;
    }
    if (umzug.abteilung === abteilung) {
      setUmzug(null);
      return true;
    }
    umbenennen(
      umgehaengteWarengruppe(sortiment, umzug.abteilung, umzug.name, abteilung),
      pfadVon(umzug.abteilung, umzug.name),
      pfadVon(abteilung, umzug.name),
    );
    setUmzug(null);
    return true;
  };

  /** Fragt nach einem Namen. Leer oder abgebrochen heißt: nichts tun. */
  const frage = (text: string, vorgabe = '') => {
    const antwort = window.prompt(text, vorgabe);
    return antwort?.trim() ? antwort.trim() : null;
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
                  className={`wg-titel${umzug?.art === 'warengruppe' ? ' wg-ziel' : ''}`}
                  title={
                    umzug?.art === 'warengruppe'
                      ? `„${umzug.name}" hierher verschieben`
                      : undefined
                  }
                  onClick={() => {
                    if (hierhin(abteilung.name)) return;
                    usePlanStore.getState().schalteAbteilung(abteilung.name);
                  }}
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
                    <Rang
                      hoch={() => pflegen(verschobeneAbteilung(sortiment, abteilung.name, -1))}
                      runter={() => pflegen(verschobeneAbteilung(sortiment, abteilung.name, 1))}
                    />
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
                  // Zugeklappt wird die einzelne Warengruppe, nicht die
                  // Abteilung: Wer sucht, will alles sehen.
                  const gruppeOffen = sucht || !zugeklappteGruppen.includes(eigen);
                  const zielFuerSortiment = umzug?.art === 'sortiment';
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
                          className={`wg-name${pinsel?.pfad === eigen ? ' aktiv' : ''}${zielFuerSortiment ? ' wg-ziel' : ''}`}
                          onClick={() => {
                            if (hierhin(abteilung.name, gruppe.name)) return;
                            nimm(gruppe.name, eigen);
                          }}
                          title={
                            zielFuerSortiment
                              ? `„${umzug?.name}“ hierher verschieben`
                              : 'Aufnehmen — dann im Plan die Meter anklicken und Enter drücken'
                          }
                        >
                          {gruppe.name}
                        </button>
                        {zuordnungsmarke(gruppe.name)}
                        {pflege && (
                          <>
                            <Rang
                              hoch={() =>
                                pflegen(
                                  verschobeneWarengruppe(sortiment, abteilung.name, gruppe.name, -1),
                                )
                              }
                              runter={() =>
                                pflegen(
                                  verschobeneWarengruppe(sortiment, abteilung.name, gruppe.name, 1),
                                )
                              }
                            />
                            <button
                              className={`wg-werkzeug${umzug?.art === 'warengruppe' && umzug.name === gruppe.name ? ' aktiv' : ''}`}
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
                          {pflege && (
                            <>
                              <Rang
                                hoch={() =>
                                  pflegen(
                                    verschobenesSortiment(
                                      sortiment,
                                      abteilung.name,
                                      gruppe.name,
                                      name,
                                      -1,
                                    ),
                                  )
                                }
                                runter={() =>
                                  pflegen(
                                    verschobenesSortiment(
                                      sortiment,
                                      abteilung.name,
                                      gruppe.name,
                                      name,
                                      1,
                                    ),
                                  )
                                }
                              />
                              <button
                                className={`wg-werkzeug${umzug?.art === 'sortiment' && umzug.name === name && umzug.gruppe === gruppe.name ? ' aktiv' : ''}`}
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
        {sortiment.abteilungen.length > 0 && (
          <button
            className="knopf"
            style={{ width: '100%', marginTop: 4 }}
            title={
              'Die Liste als Tabelle ausgeben — drei Spalten, so gegliedert wie hier. ' +
              'Excel öffnet sie mit einem Doppelklick, und dieselbe Datei liest der ' +
              'Marktplaner wieder ein.'
            }
            onClick={() => {
              ladeDateiHerunter(alsTabellenblob(sortiment), 'Sortimentsliste.csv');
              setMeldung('Sortimentsliste ausgegeben — die Datei liegt bei deinen Downloads.');
            }}
          >
            ↓ Nach Excel ausgeben
          </button>
        )}
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
