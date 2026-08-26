import { useEffect, useState } from 'react';
import { pruefeZugang } from '../assistent/gespraech';
import {
  holeAssistentZugang,
  loescheAssistentZugang,
  speichereAssistentZugang,
} from '../speicher/projektArchiv';
import { Dialog } from './Dialog';

/**
 * Der Dialog, mit dem der Assistent an seinen Worker kommt.
 *
 * Zwei Felder, mehr braucht es nicht: wo das Programm läuft und mit welchem
 * Wort man dort vorgelassen wird. Der Schlüssel selbst steht bewusst **nicht**
 * hier – er liegt beim Worker, weil diese Seite öffentlich ist und alles, was
 * im Browser steht, mitgelesen werden kann.
 *
 * Vor dem Speichern wird die Adresse angefragt. Ein Tippfehler soll hier
 * auffallen und nicht später als „nicht erreichbar" mitten im Gespräch.
 */
export function AssistentDialog({ schliessen }: { schliessen: () => void }) {
  const [adresse, setAdresse] = useState('');
  const [wort, setWort] = useState('');
  const [wortZeigen, setWortZeigen] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [gut, setGut] = useState(false);
  const [pruefe, setPruefe] = useState(false);
  const [verbunden, setVerbunden] = useState(false);

  useEffect(() => {
    void holeAssistentZugang().then((z) => {
      if (!z) return;
      setAdresse(z.adresse);
      setWort(z.wort);
      setVerbunden(true);
    });
  }, []);

  const verbinden = async () => {
    const sauber = adresse.trim();
    if (!sauber) {
      setGut(false);
      setMeldung('Es fehlt die Adresse des Workers.');
      return;
    }
    if (!wort.trim()) {
      setGut(false);
      setMeldung('Es fehlt das Zugangswort.');
      return;
    }

    setPruefe(true);
    setMeldung('');
    const ergebnis = await pruefeZugang(sauber);
    setPruefe(false);
    setGut(ergebnis.gut);
    setMeldung(ergebnis.meldung);
    if (!ergebnis.gut) return;

    await speichereAssistentZugang({ adresse: sauber.replace(/\/+$/, ''), wort: wort.trim() });
    setVerbunden(true);
    setMeldung('Gespeichert. Der Assistent ist bereit.');
  };

  const loesen = async () => {
    await loescheAssistentZugang();
    setVerbunden(false);
    setAdresse('');
    setWort('');
    setGut(false);
    setMeldung('Die Verbindung ist gelöst.');
  };

  return (
    <Dialog
      titel="Assistent einrichten"
      breit
      schliessen={schliessen}
      fuss={
        <>
          {verbunden && (
            <button className="knopf knopf-gefahr" onClick={() => void loesen()}>
              Verbindung lösen
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="knopf" onClick={schliessen}>
            Schließen
          </button>
          <button className="knopf knopf-haupt" onClick={() => void verbinden()} disabled={pruefe}>
            {pruefe ? 'Prüfe …' : verbunden ? 'Übernehmen' : 'Verbinden'}
          </button>
        </>
      }
    >
      <p className="hinweis" style={{ marginTop: 0 }}>
        Der Assistent spricht nicht selbst mit Claude, sondern über ein kleines Programm bei
        Cloudflare. Der Grund ist der Schlüssel: Diese Seite liegt öffentlich im Netz, und was im
        Browser steht, kann ausgelesen werden – beim Worker liegt er sicher. Die Einrichtung steht
        Schritt für Schritt in der Datei <code>assistent/LIESMICH.md</code> im Projektordner.
      </p>

      <div className="feld-zeile einspaltig">
        <div className="feld">
          <label>Adresse des Workers</label>
          <input
            type="text"
            value={adresse}
            placeholder="https://marktplaner-assistent.dein-name.workers.dev"
            spellCheck={false}
            onChange={(e) => setAdresse(e.target.value)}
          />
        </div>
      </div>

      <div className="feld-zeile einspaltig">
        <div className="feld">
          <label>Zugangswort</label>
          <div className="knopfreihe" style={{ gap: 'var(--abstand-2)' }}>
            <input
              type={wortZeigen ? 'text' : 'password'}
              value={wort}
              placeholder="dasselbe Wort wie am Worker unter ASSISTENT_ZUGANG"
              spellCheck={false}
              autoComplete="off"
              style={{ flex: 1 }}
              onChange={(e) => setWort(e.target.value)}
            />
            <button className="knopf" onClick={() => setWortZeigen((z) => !z)}>
              {wortZeigen ? 'Verbergen' : 'Anzeigen'}
            </button>
          </div>
        </div>
      </div>

      {meldung && (
        <p className={gut || verbunden ? 'assistent-meldung-gut' : 'assistent-meldung-schlecht'}>
          {meldung}
        </p>
      )}

      <p className="hinweis">
        Das Zugangswort ist kein Passwort für dich, sondern der Riegel vor dem Schlüssel: Ohne es
        kann niemand, der die Adresse kennt, auf deine Rechnung fragen. Am Worker steckt zusätzlich
        ein Tageslimit als Kostenbremse.
      </p>
    </Dialog>
  );
}
