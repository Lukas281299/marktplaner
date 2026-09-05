import { useCallback, useEffect, useState } from 'react';
import { beschriftungsschluessel, type Beschriftungsentscheidung } from '../logik/listenabgleich';
import {
  gleicheBeschriftungenAnIn,
  pruefeBeschriftungen,
  type Beschriftungsbericht,
} from '../speicher/sortimentsabgleich';
import { usePlanStore } from '../zustand/planStore';

/**
 * Wo Plan und Sortimentsliste auseinandergelaufen sind – und der Weg zurück.
 *
 * **Eine Strecke trägt zwei Namen.** Der eine sagt, wohin die Meter zählen
 * (der Pfad); der andere steht unter dem Möbel im Plan (der Text). Beim
 * Aufnehmen aus der Liste sind sie derselbe. Danach ist der Text eine Kopie,
 * die für sich lebt – und eine Kopie kann veralten.
 *
 * Genau das war der Fall: Wer eine Warengruppe umbenannte, bekam den Pfad
 * nachgezogen, die Beschriftung aber nicht. Die Auswertung führte „Aufbackware",
 * im Plan stand weiter „Aufbackware Brötchen". Gerechnet richtig, gelesen
 * falsch – und der Plan ist das, was ausgedruckt an der Wand hängt.
 *
 * Seit dem Nachziehen der Beschriftung entsteht das nicht mehr neu. Was
 * vorher entstanden ist, holt dieser Abgleich nach: **in allen Planungen**,
 * denn die Sortimentsliste gilt am Gerät und nicht am einzelnen Markt.
 *
 * **Gefragt wird, nicht geraten.** Ein Text, der in der Rechnung nicht
 * vorkommt, kann zweierlei sein: ein alter Name – oder ein eigener Satz wie
 * „Marmorkuchen Aktion", den der Planer bewusst hingeschrieben hat. Welcher
 * von beiden, weiß nur er. Deshalb steht neben jeder Zeile beides: angleichen
 * oder so lassen. „So lassen" merkt sich der Plan (`eigenerText`) – dieselbe
 * Zeile kommt danach nicht wieder.
 */
export function Planabgleich() {
  const sortiment = usePlanStore((s) => s.sortiment);
  const nachgezogene = usePlanStore((s) => s.nachgezogenePlanungen);

  const [berichte, setBerichte] = useState<Beschriftungsbericht[] | null>(null);
  const [prueft, setPrueft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  // Beim Öffnen einmal nachsehen. Die offene Planung ist sofort da, die
  // übrigen kommen aus der Datenbank – deshalb läuft es nebenher.
  const pruefe = useCallback(async () => {
    setPrueft(true);
    try {
      const gefunden = await pruefeBeschriftungen(sortiment, usePlanStore.getState().projekt);
      setBerichte(gefunden);
    } finally {
      setPrueft(false);
    }
    // `projekt` steht bewusst nicht in den Abhängigkeiten: Sonst liefe die
    // Prüfung nach jedem Angleichen sofort wieder los und überschriebe die
    // Meldung, bevor man sie gelesen hat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortiment, nachgezogene]);

  useEffect(() => {
    void pruefe();
  }, [pruefe]);

  const zahl = (berichte ?? []).reduce((n, b) => n + b.eintraege.length, 0);

  /** Eine Entscheidung ausführen – für eine Zeile oder für alle einer Planung. */
  const entscheide = async (
    bericht: Beschriftungsbericht,
    schluessel: string[],
    wahl: Beschriftungsentscheidung,
  ) => {
    const entscheidungen = new Map<string, Beschriftungsentscheidung>(
      schluessel.map((s) => [s, wahl] as const),
    );
    const getan = bericht.offen
      ? usePlanStore.getState().gleicheBeschriftungenAn(entscheidungen)
      : await gleicheBeschriftungenAnIn(bericht.id, entscheidungen);

    setBerichte((vorher) =>
      (vorher ?? [])
        .map((b) =>
          b.id === bericht.id
            ? {
                ...b,
                eintraege: b.eintraege.filter(
                  (e) => !schluessel.includes(beschriftungsschluessel(e.pfad, e.alt)),
                ),
              }
            : b,
        )
        .filter((b) => b.eintraege.length > 0),
    );
    setMeldung(
      wahl === 'angleichen'
        ? `${getan} ${getan === 1 ? 'Beschriftung' : 'Beschriftungen'} angeglichen.`
        : 'Bleibt stehen — die Zeile kommt nicht wieder.',
    );
    return getan;
  };

  /**
   * Alles auf einmal: der Knopf, den man nach einem Umbenennen drückt.
   *
   * **Mit einer Rückfrage.** In der offenen Planung holt Strg+Z alles zurück
   * – in den übrigen nicht, dort ist es geschrieben. Und unter den Zeilen
   * kann ein eigener Satz stehen, den nur der Planer als solchen erkennt.
   * Wer das in einem Zug über alle Märkte laufen lässt, soll es einmal
   * bejaht haben.
   */
  const alleAngleichen = async () => {
    const andere = (berichte ?? []).filter((b) => !b.offen).length;
    if (
      !window.confirm(
        `${zahl} ${zahl === 1 ? 'Beschriftung' : 'Beschriftungen'} auf den Namen aus der Liste setzen?` +
          (andere > 0
            ? `\n\nDavon liegen welche in ${andere === 1 ? 'einer anderen Planung' : `${andere} anderen Planungen`} — dort lässt sich das nicht mit Strg+Z zurücknehmen.`
            : '') +
          `\n\nSteht unter den Zeilen ein Satz, den du selbst geschrieben hast, wird er überschrieben. Einzeln geht es über ✓ und ✕.`,
      )
    ) {
      return;
    }
    let getan = 0;
    for (const bericht of berichte ?? []) {
      getan += await entscheide(
        bericht,
        bericht.eintraege.map((e) => beschriftungsschluessel(e.pfad, e.alt)),
        'angleichen',
      );
    }
    setMeldung(`${getan} ${getan === 1 ? 'Beschriftung' : 'Beschriftungen'} angeglichen.`);
  };

  // Nichts zu melden: dann steht hier auch nichts. Ein Kasten „alles in
  // Ordnung" wäre bei jedem Öffnen im Weg.
  if (!prueft && zahl === 0 && nachgezogene === 0 && !meldung) return null;

  return (
    <div className="planabgleich">
      {nachgezogene > 0 && (
        <p className="hinweis" style={{ margin: '0 0 4px' }}>
          Das Umbenennen ist auch in{' '}
          <strong>
            {nachgezogene} {nachgezogene === 1 ? 'weiterer Planung' : 'weiteren Planungen'}
          </strong>{' '}
          angekommen.
        </p>
      )}

      {prueft && (
        <p className="hinweis" style={{ margin: 0 }}>
          Alle Planungen werden mit der Liste verglichen …
        </p>
      )}

      {zahl > 0 && (
        <>
          <p className="hinweis warnung" style={{ margin: '0 0 4px' }}>
            <strong>
              {zahl} {zahl === 1 ? 'Beschriftung' : 'Beschriftungen'}
            </strong>{' '}
            im Plan {zahl === 1 ? 'heißt' : 'heißen'} noch anders als in der Liste. Gerechnet wird
            schon richtig — es steht nur der alte Name am Möbel.
          </p>

          <div className="abgleichliste">
            {(berichte ?? []).map((bericht) => (
              <div key={bericht.id} className="verwaistplan">
                <div className="verwaistplan-name">
                  {bericht.name}
                  {bericht.offen && <span className="kategorie-anzahl"> · geöffnet</span>}
                </div>
                {bericht.eintraege.map((eintrag) => {
                  const schluessel = beschriftungsschluessel(eintrag.pfad, eintrag.alt);
                  return (
                    <div className="abgleichzeile" key={schluessel}>
                      <span className="abgleichnamen">
                        „{eintrag.alt}" <span className="abgleichpfeil">→</span> „{eintrag.neu}"
                        <span className="pinselpfad">{eintrag.pfad}</span>
                      </span>
                      <span className="kennzahl-wert">
                        {(eintrag.meter / 100).toLocaleString('de-DE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        m
                      </span>
                      <button
                        className="knopf knopf-nur-symbol"
                        title={`Im Plan „${eintrag.neu}" schreiben`}
                        onClick={() => void entscheide(bericht, [schluessel], 'angleichen')}
                      >
                        ✓
                      </button>
                      <button
                        className="knopf knopf-nur-symbol"
                        title="Das ist ein eigener Text — so lassen und nicht wieder fragen"
                        onClick={() => void entscheide(bericht, [schluessel], 'behalten')}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="knopfreihe" style={{ marginTop: 4 }}>
            <button
              className="knopf knopf-haupt"
              style={{ flex: 1 }}
              title="Überall den Namen aus der Sortimentsliste in den Plan schreiben"
              onClick={() => void alleAngleichen()}
            >
              Alle {zahl} angleichen
            </button>
          </div>
        </>
      )}

      {meldung && zahl === 0 && (
        <p className="hinweis" style={{ margin: 0 }}>
          {meldung} Der Plan und die Liste sagen jetzt dasselbe.
        </p>
      )}
    </div>
  );
}
