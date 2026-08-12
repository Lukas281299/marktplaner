import { useEffect, useState } from 'react';
import { jetztAbgleichen } from '../logik/abgleichSteuerung';
import {
  codeFormatieren,
  codeGueltig,
  codeNormalisieren,
  neuerKopplungscode,
} from '../speicher/krypto';
import {
  holeGeraeteName,
  loescheSyncZugang,
  setzeGeraeteName,
  speichereSyncZugang,
} from '../speicher/projektArchiv';
import { serverPruefen } from '../speicher/syncClient';
import { useSyncStore } from '../zustand/syncStore';
import { Dialog } from './Dialog';

/**
 * Der Dialog für die Synchronisation.
 *
 * Er hat zwei Gesichter: das Einrichten (Adresse und Kopplungscode) und den
 * laufenden Betrieb (Stand anzeigen, von Hand abgleichen, Verbindung lösen).
 *
 * Der wichtigste Satz steht beim Kopplungscode: Am **zweiten** Rechner muss
 * der Code des ersten eingetragen werden. Wer dort auf „Neuen Code erzeugen"
 * drückt, legt sich ein zweites, leeres Fach an und wundert sich dann, dass
 * nichts ankommt. Genau dagegen gibt es unten auch die Warnung „bisher nur
 * dieser Rechner".
 */
export function SyncDialog({ schliessen }: { schliessen: () => void }) {
  const zugang = useSyncStore((s) => s.zugang);
  const zustand = useSyncStore((s) => s.zustand);
  const meldung = useSyncStore((s) => s.meldung);
  const letzterAbgleich = useSyncStore((s) => s.letzterAbgleich);
  const ergebnis = useSyncStore((s) => s.letztesErgebnis);

  const [adresse, setAdresse] = useState(zugang?.adresse ?? '');
  const [code, setCode] = useState(zugang ? codeFormatieren(zugang.code) : '');
  const [geraet, setGeraet] = useState('');
  const [codeZeigen, setCodeZeigen] = useState(!zugang);
  const [fehler, setFehler] = useState('');
  const [pruefe, setPruefe] = useState(false);

  useEffect(() => {
    void holeGeraeteName().then(setGeraet);
  }, []);

  const verbinden = async () => {
    setFehler('');
    if (!adresse.trim()) {
      setFehler('Bitte die Adresse des Worker eintragen.');
      return;
    }
    if (!codeGueltig(code)) {
      setFehler('Der Kopplungscode besteht aus 16 Zeichen, z. B. K7NP-2XQF-8MTR-WD4H.');
      return;
    }

    setPruefe(true);
    try {
      await serverPruefen(adresse);
      const neuerZugang = { adresse: adresse.trim().replace(/\/+$/, ''), code: codeNormalisieren(code) };
      await speichereSyncZugang(neuerZugang);
      await setzeGeraeteName(geraet);
      useSyncStore.getState().setzeZugang(neuerZugang);
      setCodeZeigen(false);
      // Gleich loslegen – so sieht man sofort, ob es wirklich funktioniert.
      await jetztAbgleichen({ darfWechseln: true });
    } catch (f) {
      setFehler(f instanceof Error ? f.message : 'Die Verbindung ließ sich nicht herstellen.');
    } finally {
      setPruefe(false);
    }
  };

  const trennen = async () => {
    if (
      !window.confirm(
        'Verbindung wirklich lösen? Die Planungen auf diesem Rechner bleiben erhalten, sie werden nur nicht mehr abgeglichen.',
      )
    )
      return;
    await loescheSyncZugang();
    useSyncStore.getState().setzeZugang(null);
    setCodeZeigen(true);
  };

  const codeKopieren = async () => {
    await navigator.clipboard.writeText(codeFormatieren(code)).catch(() => undefined);
  };

  const eingerichtet = Boolean(zugang);

  return (
    <Dialog
      titel="Abgleich zwischen mehreren Rechnern"
      schliessen={schliessen}
      breit
      fuss={
        <>
          {eingerichtet && (
            <button className="knopf knopf-gefahr" onClick={() => void trennen()}>
              Verbindung lösen
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="knopf" onClick={schliessen}>
            Schließen
          </button>
          {eingerichtet ? (
            <button
              className="knopf knopf-haupt"
              disabled={zustand === 'laeuft'}
              onClick={() => void jetztAbgleichen()}
            >
              {zustand === 'laeuft' ? 'Abgleich läuft …' : 'Jetzt abgleichen'}
            </button>
          ) : (
            <button className="knopf knopf-haupt" disabled={pruefe} onClick={() => void verbinden()}>
              {pruefe ? 'Prüfe …' : 'Verbinden'}
            </button>
          )}
        </>
      }
    >
      {!eingerichtet && (
        <p className="hinweis" style={{ marginTop: 0 }}>
          Damit du an einem Rechner anfängst und am anderen dort weitermachst. Die Planungen werden
          verschlüsselt, bevor sie den Rechner verlassen – lesen kann sie nur, wer den Kopplungscode
          hat. Die Einrichtung des Servers steht Schritt für Schritt in der Datei{' '}
          <code>sync/LIESMICH.md</code> im Projektordner.
        </p>
      )}

      <div className="feld-zeile einspaltig">
        <div className="feld">
          <label>Adresse des Worker</label>
          <input
            type="text"
            value={adresse}
            placeholder="https://marktplaner-sync.dein-name.workers.dev"
            disabled={eingerichtet}
            onChange={(e) => setAdresse(e.target.value)}
          />
        </div>
      </div>

      <div className="feld-zeile einspaltig">
        <div className="feld">
          <label>Kopplungscode</label>
          <div className="knopfreihe" style={{ gap: 'var(--abstand-2)' }}>
            <input
              type={codeZeigen ? 'text' : 'password'}
              value={code}
              placeholder="K7NP-2XQF-8MTR-WD4H"
              spellCheck={false}
              autoComplete="off"
              style={{ flex: 1, fontFamily: 'ui-monospace, Consolas, monospace', letterSpacing: '0.05em' }}
              onChange={(e) => setCode(codeFormatieren(e.target.value))}
            />
            <button
              className="knopf"
              onClick={() => setCodeZeigen((z) => !z)}
              title={codeZeigen ? 'Code verbergen' : 'Code anzeigen'}
            >
              {codeZeigen ? 'Verbergen' : 'Anzeigen'}
            </button>
            <button className="knopf" onClick={() => void codeKopieren()} disabled={!code}>
              Kopieren
            </button>
            {!eingerichtet && (
              <button className="knopf" onClick={() => setCode(neuerKopplungscode())}>
                Neu erzeugen
              </button>
            )}
          </div>
        </div>
      </div>

      {!eingerichtet && (
        <p className="hinweis">
          <strong>Erster Rechner:</strong> auf „Neu erzeugen" drücken und den Code notieren.
          <br />
          <strong>Jeder weitere Rechner:</strong> genau diesen Code eintragen – keinen neuen
          erzeugen. Der Code ist zugleich der Schlüssel: Geht er verloren, kommt niemand mehr an den
          Serverstand heran, auch du nicht.
        </p>
      )}

      <div className="feld-zeile einspaltig">
        <div className="feld">
          <label>Name dieses Rechners</label>
          <input
            type="text"
            value={geraet}
            placeholder="Büro-PC"
            onChange={(e) => setGeraet(e.target.value)}
            onBlur={() => void setzeGeraeteName(geraet)}
          />
        </div>
      </div>

      {fehler && (
        <p className="hinweis" style={{ color: 'var(--hilfslinie)', fontWeight: 600 }}>
          {fehler}
        </p>
      )}

      {eingerichtet && (
        <>
          <div className="gruppe">
            <div className="gruppe-titel">Stand</div>
            <div className="kennzahl">
              <span>Zuletzt abgeglichen</span>
              <span className="kennzahl-wert">
                {letzterAbgleich
                  ? new Date(letzterAbgleich).toLocaleString('de-DE', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : 'noch nie'}
              </span>
            </div>
            {ergebnis && (
              <div className="kennzahl">
                <span>Planungen im Fach</span>
                <span className="kennzahl-wert">{ergebnis.planungen}</span>
              </div>
            )}
            {ergebnis && (
              <div className="kennzahl">
                <span>Beteiligte Rechner</span>
                <span className="kennzahl-wert">{ergebnis.geraete.join(', ')}</span>
              </div>
            )}
          </div>

          {meldung && (
            <p
              className="hinweis"
              style={{
                color: zustand === 'fehler' ? 'var(--hilfslinie)' : 'var(--blau)',
                fontWeight: 600,
              }}
            >
              {meldung}
            </p>
          )}

          {ergebnis?.alleinImFach && (
            <p className="hinweis" style={{ color: 'var(--hilfslinie)' }}>
              In diesem Fach war bisher nur dieser Rechner. Falls du eigentlich einen zweiten
              anbinden wolltest: Dort muss <em>derselbe</em> Kopplungscode eingetragen sein, nicht
              ein neu erzeugter.
            </p>
          )}

          {ergebnis && ergebnis.gabelungen.length > 0 && (
            <p className="hinweis">
              An diesen Planungen wurde an zwei Rechnern gleichzeitig gearbeitet. Die neuere gilt
              jetzt, die ältere wurde gesichert als:
              <br />
              {ergebnis.gabelungen.map((name) => (
                <span key={name}>
                  „{name}"
                  <br />
                </span>
              ))}
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}
