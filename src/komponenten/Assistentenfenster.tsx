import { useEffect, useRef, useState } from 'react';
import {
  AssistentFehler,
  MODELLE,
  stelleFrage,
  type Beitrag,
  type ModellId,
  type Tat,
} from '../assistent/gespraech';
import { holeAssistentZugang } from '../speicher/projektArchiv';
import { useAssistentStore } from '../zustand/assistentStore';
import { AssistentDialog } from './AssistentDialog';

/**
 * Die Spalte des Assistenten.
 *
 * Sie steht rechts neben den Eigenschaften, weil man beim Zusehen den Plan
 * im Blick behalten muss: Was der Assistent tut, geschieht daneben und nicht
 * in einem Fenster darüber.
 */
export function Assistentenfenster() {
  const verlauf = useAssistentStore((s) => s.verlauf);
  const laeuft = useAssistentStore((s) => s.laeuft);
  const laufendeTaten = useAssistentStore((s) => s.laufendeTaten);
  const modell = useAssistentStore((s) => s.modell);
  const kontingent = useAssistentStore((s) => s.kontingent);

  const [text, setText] = useState('');
  const [eingerichtet, setEingerichtet] = useState<boolean | null>(null);
  const [dialogOffen, setDialogOffen] = useState(false);

  const endeRef = useRef<HTMLDivElement>(null);
  const feldRef = useRef<HTMLTextAreaElement>(null);

  // Ist der Worker hinterlegt? Ohne ihn hat das Eingabefeld keinen Sinn.
  useEffect(() => {
    void holeAssistentZugang().then((z) => setEingerichtet(!!z));
  }, [dialogOffen]);

  // Immer ans Ende scrollen – während einer Runde wächst der Verlauf.
  useEffect(() => {
    endeRef.current?.scrollIntoView({ block: 'end' });
  }, [verlauf, laufendeTaten, laeuft]);

  const senden = async () => {
    const frage = text.trim();
    if (!frage || laeuft) return;

    const laden = useAssistentStore.getState();
    setText('');
    laden.haengeAn({ rolle: 'nutzer', text: frage });

    const abbruch = new AbortController();
    laden.starte(abbruch);

    try {
      const lauf = await stelleFrage(
        laden.verlauf,
        frage,
        modell,
        (taten) => useAssistentStore.getState().meldeTaten(taten),
        abbruch.signal,
      );
      useAssistentStore.getState().haengeAn({
        rolle: 'assistent',
        text: lauf.text,
        taten: lauf.taten,
      });
      useAssistentStore.getState().beende(lauf.kontingent);
    } catch (fehler) {
      if (fehler instanceof DOMException && fehler.name === 'AbortError') {
        useAssistentStore.getState().haengeAn({
          rolle: 'assistent',
          text: '',
          taten: useAssistentStore.getState().laufendeTaten,
          fehler: 'Abgebrochen. Was bis dahin geschah, nimmt Strg+Z zurück.',
        });
      } else {
        const meldung =
          fehler instanceof AssistentFehler
            ? fehler.message
            : 'Da ist etwas schiefgegangen. Mehr steht in der Entwicklerkonsole.';
        if (!(fehler instanceof AssistentFehler)) console.error('Marktplaner: Assistent', fehler);
        useAssistentStore.getState().haengeAn({
          rolle: 'assistent',
          text: '',
          taten: useAssistentStore.getState().laufendeTaten,
          fehler: meldung,
        });
      }
      useAssistentStore.getState().beende();
    }
    feldRef.current?.focus();
  };

  const taste = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter schickt ab, Umschalt+Enter macht eine neue Zeile. Wie überall.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void senden();
    }
    // Damit die Tastenkürzel des Plans nicht mitfeuern, während man tippt.
    e.stopPropagation();
  };

  return (
    <aside className="spalte spalte-rechts spalte-assistent">
      <div className="spalte-kopf assistent-kopf">
        <span>Assistent</span>
        <div className="assistent-kopf-knoepfe">
          <select
            className="assistent-modell"
            value={modell}
            onChange={(e) => useAssistentStore.getState().setzeModell(e.target.value as ModellId)}
            title="Welches Modell antwortet"
            disabled={laeuft}
          >
            {MODELLE.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            className="knopf knopf-nur-symbol"
            onClick={() => useAssistentStore.getState().leere()}
            title="Gespräch von vorn beginnen"
            disabled={verlauf.length === 0}
          >
            ⟲
          </button>
          <button
            className="knopf knopf-nur-symbol"
            onClick={() => useAssistentStore.getState().schalteOffen(false)}
            title="Assistent schließen"
          >
            ×
          </button>
        </div>
      </div>

      <div className="spalte-inhalt assistent-verlauf">
        {eingerichtet === false && <NochNichtEingerichtet oeffnen={() => setDialogOffen(true)} />}

        {eingerichtet && verlauf.length === 0 && !laeuft && <Anfang />}

        {verlauf.map((beitrag, i) => (
          <BeitragAnzeige key={i} beitrag={beitrag} />
        ))}

        {laeuft && (
          <div className="assistent-beitrag assistent-von-ihm">
            {laufendeTaten.length > 0 && <Taten taten={laufendeTaten} />}
            <div className="assistent-arbeitet">
              <span className="assistent-punkte">
                <i />
                <i />
                <i />
              </span>
              {laufendeTaten.length > 0 ? 'arbeitet weiter …' : 'denkt nach …'}
              <button
                className="knopf assistent-stopp"
                onClick={() => useAssistentStore.getState().brichAb()}
              >
                Anhalten
              </button>
            </div>
          </div>
        )}
        <div ref={endeRef} />
      </div>

      <div className="assistent-eingabe">
        <textarea
          ref={feldRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={taste}
          placeholder={
            eingerichtet === false
              ? 'Erst einrichten …'
              : 'Was soll ich tun? (Umschalt+Eingabe für eine neue Zeile)'
          }
          rows={3}
          disabled={eingerichtet === false}
        />
        <div className="assistent-fuss">
          <button className="knopf assistent-klein" onClick={() => setDialogOffen(true)}>
            Einrichten
          </button>
          {kontingent && (
            <span className="hinweis" title="Anfragen heute – eine Kostenbremse am Worker">
              {kontingent.verbraucht}/{kontingent.grenze} heute
            </span>
          )}
          <button
            className="knopf knopf-haupt"
            onClick={() => void senden()}
            disabled={laeuft || !text.trim() || eingerichtet === false}
          >
            Senden
          </button>
        </div>
      </div>

      {dialogOffen && <AssistentDialog schliessen={() => setDialogOffen(false)} />}
    </aside>
  );
}

/* ------------------------------------------------------------- Bausteine */

function NochNichtEingerichtet({ oeffnen }: { oeffnen: () => void }) {
  return (
    <div className="assistent-leer">
      <p>
        <strong>Der Assistent ist noch nicht eingerichtet.</strong>
      </p>
      <p>
        Er spricht über ein kleines Programm bei Cloudflare mit Claude. Dort liegt der Schlüssel –
        nicht hier im Browser, denn diese Seite ist öffentlich.
      </p>
      <p>
        <button className="knopf knopf-haupt" onClick={oeffnen}>
          Jetzt einrichten
        </button>
      </p>
    </div>
  );
}

function Anfang() {
  const beispiele = [
    'Was steht alles in der Molkerei?',
    'Setz mir eine Gondel mit 6 Metern an Position 1200/800.',
    'Schieb die Kassen zwei Meter nach unten.',
    'Welche Warengruppen fehlen noch im Markt?',
    'Beschrifte den Zug bei den Konserven: Meter 1–3 Suppen, 4–6 Fertiggerichte.',
  ];
  return (
    <div className="assistent-leer">
      <p>
        Sag mir, was du brauchst. Ich kann alles, was du auch kannst – nachsehen, einsetzen,
        verschieben, beschriften.
      </p>
      <p className="hinweis">
        Eine ganze Antwort ist <strong>ein</strong> Strg+Z. Wenn dir nicht gefällt, was ich tue,
        ist es mit einem Druck wieder weg.
      </p>
      <ul className="assistent-beispiele">
        {beispiele.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

function BeitragAnzeige({ beitrag }: { beitrag: Beitrag }) {
  if (beitrag.rolle === 'nutzer') {
    return <div className="assistent-beitrag assistent-von-mir">{beitrag.text}</div>;
  }
  return (
    <div className="assistent-beitrag assistent-von-ihm">
      {beitrag.taten && beitrag.taten.length > 0 && <Taten taten={beitrag.taten} />}
      {beitrag.fehler ? (
        <div className="assistent-fehler">{beitrag.fehler}</div>
      ) : (
        <div className="assistent-text">{beitrag.text}</div>
      )}
    </div>
  );
}

/**
 * Was der Assistent getan hat.
 *
 * Steht **über** der Antwort und nicht darunter: In der Reihenfolge ist es
 * geschehen, und wer mitliest, sieht die Handgriffe wachsen und danach das
 * Fazit. Ein fehlgeschlagener Aufruf wird ausgeschrieben – er ist die
 * wichtigste Zeile im ganzen Block.
 */
function Taten({ taten }: { taten: Tat[] }) {
  return (
    <ul className="assistent-taten">
      {taten.map((tat, i) => (
        <li key={i} className={tat.fehlgeschlagen ? 'assistent-tat-fehler' : undefined}>
          <code>{tat.werkzeug}</code>
          <span>{tat.fehlgeschlagen ? tat.ergebnis : kurz(tat.ergebnis)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Die erste Zeile eines Ergebnisses – der Rest ist Stoff fürs Modell. */
function kurz(text: string): string {
  const zeile = text.split('\n')[0];
  return zeile.length > 90 ? zeile.slice(0, 88) + ' …' : zeile;
}

/**
 * Der Knopf in der Werkzeugleiste.
 *
 * Steht hier und nicht in `Werkzeugleiste.tsx`, damit alles zum Assistenten
 * beieinander liegt.
 */
export function AssistentKnopf() {
  const offen = useAssistentStore((s) => s.offen);
  const laeuft = useAssistentStore((s) => s.laeuft);
  return (
    <button
      className={`knopf${offen ? ' aktiv' : ''}`}
      onClick={() => useAssistentStore.getState().schalteOffen()}
      title="Den Assistenten fragen – er kann alles, was du auch kannst"
    >
      {laeuft ? '◐' : '✳'} Assistent
    </button>
  );
}
