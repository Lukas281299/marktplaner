import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePlanStore, type Werkzeug } from '../zustand/planStore';

/**
 * Mehrere verwandte Werkzeuge unter einem Knopf.
 *
 * Die Grundrisszeile war auf vierzehn Knöpfe gewachsen und brach um. Dabei
 * greift man von vier Gebäudewerkzeugen fast immer zum selben – die anderen
 * drei kosten nur Platz und Suchzeit.
 *
 * Deshalb dasselbe wie im CAD: Der Knopf zeigt das Werkzeug, das man aus
 * dieser Gruppe **zuletzt** benutzt hat, und ein Klick darauf greift danach.
 * Der Pfeil daneben klappt die übrigen aus. Wer immer dasselbe nimmt, merkt
 * von der Gruppe nichts; wer wechselt, findet den Rest an einer Stelle.
 *
 * Gemerkt wird die Wahl in der Komponente und nicht im Projekt: Sie ist kein
 * Teil der Planung, und nach einem Neuladen wieder beim Naheliegendsten
 * anzufangen ist kein Verlust.
 */

export interface Werkzeugeintrag {
  werkzeug: Werkzeug;
  text: string;
  symbol: ReactNode;
  titel: string;
}

/**
 * Wo das Menü aufgeht.
 *
 * Es hängt am Fenster und nicht am Knopf, weil die Werkzeugleiste
 * `overflow-y: auto` trägt – darin würde ein aufgeklapptes Menü an der
 * Leistenunterkante abgeschnitten. Deshalb die Lage aus dem Knopf ausmessen
 * und das Menü daneben ins Fenster hängen.
 */
function lageAm(knopf: HTMLElement | null): { left: number; top: number } | undefined {
  if (!knopf) return undefined;
  const k = knopf.getBoundingClientRect();
  // Am rechten Rand nach links ausrichten, damit nichts aus dem Fenster ragt.
  const breite = 250;
  const left = Math.max(6, Math.min(k.left, window.innerWidth - breite - 6));
  return { left, top: k.bottom + 4 };
}

/** Schließt beim Klick daneben, bei Escape und wenn sich das Fenster ändert. */
function useSchliessen(
  offen: boolean,
  rahmen: React.RefObject<HTMLElement | null>,
  schliessen: () => void,
) {
  useEffect(() => {
    if (!offen) return;
    const daneben = (e: MouseEvent) => {
      const ziel = e.target as Node;
      if (rahmen.current?.contains(ziel)) return;
      if ((ziel as HTMLElement)?.closest?.('.werkzeugmenue')) return;
      schliessen();
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen();
    };
    // Erst im nächsten Zug lauschen: Sonst schlösse der Klick, der gerade
    // geöffnet hat, das Menü sofort wieder.
    const uhr = window.setTimeout(() => {
      window.addEventListener('mousedown', daneben);
      window.addEventListener('keydown', taste);
      window.addEventListener('resize', schliessen);
      window.addEventListener('scroll', schliessen, true);
    }, 0);
    return () => {
      window.clearTimeout(uhr);
      window.removeEventListener('mousedown', daneben);
      window.removeEventListener('keydown', taste);
      window.removeEventListener('resize', schliessen);
      window.removeEventListener('scroll', schliessen, true);
    };
  }, [offen, rahmen, schliessen]);
}

function Menue({
  gruppe,
  lage,
  kinder,
}: {
  gruppe: string;
  lage: { left: number; top: number } | undefined;
  kinder: ReactNode;
}) {
  if (!lage) return null;
  return createPortal(
    <div className="werkzeugmenue" style={{ left: lage.left, top: lage.top }}>
      <div className="werkzeugmenue-titel">{gruppe}</div>
      {kinder}
    </div>,
    document.body,
  );
}

export function Werkzeuggruppe({ gruppe, eintraege }: { gruppe: string; eintraege: Werkzeugeintrag[] }) {
  const werkzeug = usePlanStore((s) => s.werkzeug);
  const [offen, setOffen] = useState(false);
  const [zuletzt, setZuletzt] = useState<Werkzeug>(eintraege[0].werkzeug);
  const rahmenRef = useRef<HTMLDivElement>(null);

  // Ist eines der Werkzeuge dieser Gruppe aktiv, zeigt der Knopf genau das –
  // sonst das zuletzt gewählte.
  const aktiv = eintraege.find((e) => e.werkzeug === werkzeug);
  const gezeigt = aktiv ?? eintraege.find((e) => e.werkzeug === zuletzt) ?? eintraege[0];

  const schliessen = useCallback(() => setOffen(false), []);
  useSchliessen(offen, rahmenRef, schliessen);

  const greifen = (w: Werkzeug) => {
    setZuletzt(w);
    setOffen(false);
    const jetzt = usePlanStore.getState();
    jetzt.setzeWerkzeug(jetzt.werkzeug === w ? 'auswahl' : w);
  };

  return (
    <div className="werkzeuggruppe" ref={rahmenRef}>
      <button
        className={`knopf knopf-gruppe${aktiv ? ' aktiv' : ''}`}
        onClick={() => greifen(gezeigt.werkzeug)}
        title={gezeigt.titel}
      >
        {gezeigt.symbol} <span className="knopf-text">{gezeigt.text}</span>
      </button>
      <button
        className={`knopf knopf-gruppenpfeil${aktiv ? ' aktiv' : ''}`}
        onClick={() => setOffen((o) => !o)}
        title={`${gruppe}: weitere Werkzeuge`}
        aria-label={`${gruppe}: weitere Werkzeuge`}
        aria-expanded={offen}
      >
        ▾
      </button>

      {offen && (
        <Menue gruppe={gruppe} lage={lageAm(rahmenRef.current)}
          kinder={eintraege.map((e) => (
            <button
              key={e.werkzeug}
              className={`werkzeugmenue-zeile${e.werkzeug === werkzeug ? ' aktiv' : ''}`}
              onClick={() => greifen(e.werkzeug)}
            >
              <span className="werkzeugmenue-symbol">{e.symbol}</span>
              <span className="werkzeugmenue-text">
                <strong>{e.text}</strong>
                <span>{e.titel}</span>
              </span>
            </button>
          ))}
        />
      )}
    </div>
  );
}

/**
 * Dasselbe für Befehle, die kein Werkzeug einschalten.
 *
 * „Einlesen" und „Ausgeben" waren fünf Knöpfe, die man selten und dann
 * überlegt benutzt. Die gehören nicht dauerhaft in die Leiste – und im Menü
 * steht endlich dabei, was sie unterscheidet.
 */
export function Aktionsgruppe({
  gruppe,
  symbol,
  titel,
  eintraege,
}: {
  gruppe: string;
  symbol: ReactNode;
  titel: string;
  eintraege: { text: string; titel: string; symbol: ReactNode; tun: () => void }[];
}) {
  const [offen, setOffen] = useState(false);
  const rahmenRef = useRef<HTMLDivElement>(null);

  const schliessen = useCallback(() => setOffen(false), []);
  useSchliessen(offen, rahmenRef, schliessen);

  return (
    <div className="werkzeuggruppe" ref={rahmenRef}>
      <button
        className={`knopf${offen ? ' aktiv' : ''}`}
        onClick={() => setOffen((o) => !o)}
        title={titel}
        aria-expanded={offen}
      >
        {symbol} <span className="knopf-text">{gruppe}</span>
        <span className="gruppenpfeil">▾</span>
      </button>
      {offen && (
        <Menue gruppe={gruppe} lage={lageAm(rahmenRef.current)}
          kinder={eintraege.map((e) => (
            <button
              key={e.text}
              className="werkzeugmenue-zeile"
              onClick={() => {
                setOffen(false);
                e.tun();
              }}
            >
              <span className="werkzeugmenue-symbol">{e.symbol}</span>
              <span className="werkzeugmenue-text">
                <strong>{e.text}</strong>
                <span>{e.titel}</span>
              </span>
            </button>
          ))}
        />
      )}
    </div>
  );
}
