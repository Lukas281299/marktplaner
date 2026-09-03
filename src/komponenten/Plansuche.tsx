import { useEffect, useMemo, useRef, useState } from 'react';
import { buehneSteuerung } from '../logik/buehne';
import { formatiereLaenge } from '../logik/masse';
import { suchtreffer, type Treffer } from '../logik/plansuche';
import { usePlanStore } from '../zustand/planStore';

/**
 * Die Suche über der Zeichenfläche.
 *
 * Ein ausgebauter Markt hat zweihundert Möbel, und der Plan passt selten
 * ganz auf den Schirm. Wer wissen will, wo die Kaffeegondel steht, hat
 * bisher gescrollt und geguckt.
 *
 * Bewusst wie die Suchleiste eines Browsers gebaut: Strg+F, tippen,
 * Pfeiltasten, Enter, Escape. Das muss niemand lernen. Sie schwebt über der
 * Fläche, statt eine Spalte zu belegen – Platz, den der Plan besser
 * gebrauchen kann.
 *
 * Der Treffer wird **ausgewählt und angefahren**, nicht nur eingefärbt: Wer
 * etwas sucht, will meistens gleich etwas damit tun, und die Auswahl ist der
 * Weg dorthin.
 */

/** Ab wann hineingezoomt wird, damit ein Treffer erkennbar ist. */
const MINDEST_ZOOM = 0.45;

export function Plansuche() {
  const offen = usePlanStore((s) => s.sucheOffen);
  const projekt = usePlanStore((s) => s.projekt);
  const einheit = projekt.einstellungen.anzeigeEinheit;
  const [eingabe, setEingabe] = useState('');
  const [aktiv, setAktiv] = useState(0);
  const feldRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);

  const treffer = useMemo(
    () => (offen ? suchtreffer(projekt, eingabe) : []),
    [offen, projekt, eingabe],
  );

  // Beim Öffnen ins Feld springen und das Vorhandene markieren – so ersetzt
  // das nächste Wort die alte Suche, statt sich daranzuhängen.
  useEffect(() => {
    if (offen) feldRef.current?.select();
  }, [offen]);

  // Neue Eingabe, neue Liste: wieder oben anfangen.
  useEffect(() => setAktiv(0), [eingabe]);

  // Den hervorgehobenen Treffer im Blick behalten, auch wenn man sich mit
  // den Pfeiltasten aus dem sichtbaren Teil der Liste bewegt.
  //
  // `scrollIntoView` wird vorsichtig aufgerufen: Es ist reine Bequemlichkeit,
  // und wo es fehlt, darf nicht die halbe Suche mit ausfallen. Genau das ist
  // beim ersten Oberflächentest passiert – die Liste zeichnete sich, aber
  // Pfeiltasten und Enter warfen einen Fehler.
  useEffect(() => {
    listeRef.current?.children[aktiv]?.scrollIntoView?.({ block: 'nearest' });
  }, [aktiv]);

  if (!offen) return null;

  const schliessen = () => {
    usePlanStore.getState().setzeSucheOffen(false);
    // Die Tastatur zurück an die Zeichenfläche geben, sonst laufen R, S und
    // Entf weiter ins Suchfeld.
    feldRef.current?.blur();
  };

  /** Einen Treffer auswählen und hinfahren. */
  const hingehen = (t: Treffer) => {
    const store = usePlanStore.getState();
    if (t.art === 'element') store.waehleAus([t.id]);
    else if (t.art === 'raum') store.waehleSonder({ art: 'raum', id: t.id });
    else if (t.art === 'masslinie') store.waehleSonder({ art: 'masslinie', id: t.id });
    buehneSteuerung.zeigeAuf?.(t.punkt, MINDEST_ZOOM);
  };

  const beiTaste = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      schliessen();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (treffer.length > 0) setAktiv((i) => (i + 1) % treffer.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (treffer.length > 0) setAktiv((i) => (i - 1 + treffer.length) % treffer.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const ziel = treffer[aktiv];
      if (!ziel) return;
      hingehen(ziel);
      // Enter geht weiter zum nächsten Treffer – so klappert man mit einer
      // Taste alle Kaffeeregale ab, ohne zwischendurch zu zielen.
      if (treffer.length > 1) setAktiv((i) => (i + 1) % treffer.length);
    }
  };

  /** Wo der Treffer im Plan steht – „bei 12,4 / 8,1 m". */
  const standort = (t: Treffer) =>
    `bei ${formatiereLaenge(t.punkt.x, einheit)} / ${formatiereLaenge(t.punkt.y, einheit)}`;

  const suchtGerade = eingabe.trim().length >= 2;

  return (
    <div className="plansuche" onKeyDown={beiTaste}>
      <div className="plansuche-kopf">
        <input
          ref={feldRef}
          className="plansuche-feld"
          value={eingabe}
          autoFocus
          placeholder="Im Plan suchen: Name, Warengruppe, Notiz …"
          onChange={(e) => setEingabe(e.target.value)}
        />
        <span className="plansuche-zahl">
          {suchtGerade ? (treffer.length === 0 ? 'nichts' : `${treffer.length}`) : ''}
        </span>
        <button className="knopf knopf-nur-symbol" onClick={schliessen} title="Suche schließen (Esc)">
          ✕
        </button>
      </div>

      {suchtGerade && treffer.length > 0 && (
        <div className="plansuche-liste" ref={listeRef}>
          {treffer.map((t, i) => (
            <button
              key={`${t.art}-${t.id}`}
              className={`plansuche-zeile${i === aktiv ? ' aktiv' : ''}`}
              // Damit ein Klick nicht erst den Fokus aus dem Feld nimmt – sonst
              // wäre die Tastatursteuerung nach dem ersten Klick weg.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setAktiv(i);
                hingehen(t);
              }}
            >
              <span className="plansuche-titel">
                {t.titel}
                {t.verborgen && (
                  <span className="plansuche-merker" title="Die Ebene dieses Treffers ist ausgeblendet">
                    ausgeblendet
                  </span>
                )}
              </span>
              {/* Zweite Zeile: wo es hingehört und – wenn im Titel selbst
                  gefunden wurde – wo es steht. Zwei gleich benannte Gondeln
                  unterscheiden sich sonst durch nichts. */}
              <span className="plansuche-fund">
                {[t.bereich, t.fund || standort(t)].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))}
        </div>
      )}

      {suchtGerade && treffer.length === 0 && (
        <div className="plansuche-leer">
          Nichts gefunden. Gesucht wird in Beschriftung, Name, Warengruppe, Sortiment und Notiz.
        </div>
      )}
    </div>
  );
}
