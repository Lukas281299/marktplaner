import { useEffect, useState, type ReactNode } from 'react';
import type { Massinheit } from '../typen/modell';
import { anzeigeInCm, cmInAnzeige } from '../logik/masse';

/**
 * Wiederverwendbare Eingabefelder für das Eigenschaftenfenster.
 *
 * Besonderheit bei Zahlen: Während getippt wird, darf der Text auch kurzzeitig
 * unvollständig sein (z. B. "12," oder "-"). Deshalb merkt sich das Feld den
 * eingegebenen Text und meldet nur gültige Zahlen nach oben.
 *
 * `beiStart` wird beim ersten Antippen eines Feldes aufgerufen. Darüber legt das
 * Eigenschaftenfenster einen Punkt für "Rückgängig" an – so wird eine ganze
 * Eingabe mit einem einzigen Strg+Z zurückgenommen und nicht Ziffer für Ziffer.
 */

interface FeldRahmenProps {
  label: string;
  children: ReactNode;
  titel?: string;
}

export function FeldRahmen({ label, children, titel }: FeldRahmenProps) {
  return (
    <div className="feld" title={titel}>
      <label>{label}</label>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ Text

export function Textfeld({
  label,
  wert,
  aendern,
  beiStart,
  platzhalter,
  vorschlaege,
}: {
  label: string;
  wert: string;
  aendern: (wert: string) => void;
  beiStart?: () => void;
  platzhalter?: string;
  /** Auswahlvorschläge, die beim Tippen erscheinen. */
  vorschlaege?: string[];
}) {
  // Eine eindeutige Kennung für die Vorschlagsliste, abgeleitet aus der Beschriftung.
  const listenId = vorschlaege ? `vorschlaege-${label.replace(/\s+/g, '-')}` : undefined;
  return (
    <FeldRahmen label={label}>
      <input
        type="text"
        value={wert}
        placeholder={platzhalter}
        list={listenId}
        onFocus={beiStart}
        onChange={(e) => aendern(e.target.value)}
      />
      {vorschlaege && (
        <datalist id={listenId}>
          {vorschlaege.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
    </FeldRahmen>
  );
}

export function Textbereich({
  label,
  wert,
  aendern,
  beiStart,
}: {
  label: string;
  wert: string;
  aendern: (wert: string) => void;
  beiStart?: () => void;
}) {
  return (
    <FeldRahmen label={label}>
      <textarea value={wert} onFocus={beiStart} onChange={(e) => aendern(e.target.value)} />
    </FeldRahmen>
  );
}

// ----------------------------------------------------------------- Zahlen

interface ZahlfeldProps {
  label: string;
  wert: number;
  aendern: (wert: number) => void;
  beiStart?: () => void;
  /** Schrittweite für die Pfeiltasten. */
  schritt?: number;
  min?: number;
  max?: number;
  /** Wird hinter der Zahl angezeigt, z. B. "°". */
  einheit?: string;
  nachkommastellen?: number;
  titel?: string;
}

export function Zahlfeld({
  label,
  wert,
  aendern,
  beiStart,
  schritt = 1,
  min,
  max,
  einheit,
  nachkommastellen = 0,
  titel,
}: ZahlfeldProps) {
  const anzeigen = (z: number) =>
    z.toLocaleString('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: nachkommastellen,
    });

  const [text, setText] = useState(() => anzeigen(wert));
  const [imFokus, setImFokus] = useState(false);

  // Solange nicht getippt wird, folgt das Feld dem Wert aus dem Datenspeicher
  // (wichtig, wenn ein Element mit der Maus verschoben wird).
  useEffect(() => {
    if (!imFokus) setText(anzeigen(wert));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wert, imFokus, nachkommastellen]);

  const begrenzen = (z: number) => {
    let ergebnis = z;
    if (min !== undefined) ergebnis = Math.max(min, ergebnis);
    if (max !== undefined) ergebnis = Math.min(max, ergebnis);
    return ergebnis;
  };

  const uebernehmen = (roh: string) => {
    setText(roh);
    const zahl = Number.parseFloat(roh.replace(',', '.'));
    if (Number.isFinite(zahl)) aendern(begrenzen(zahl));
  };

  return (
    <FeldRahmen label={einheit ? `${label} (${einheit})` : label} titel={titel}>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={() => {
          setImFokus(true);
          beiStart?.();
        }}
        onBlur={() => {
          setImFokus(false);
          setText(anzeigen(wert));
        }}
        onChange={(e) => uebernehmen(e.target.value)}
        onKeyDown={(e) => {
          // Mit den Pfeiltasten lässt sich der Wert schrittweise ändern.
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const richtung = e.key === 'ArrowUp' ? 1 : -1;
          const gross = e.shiftKey ? 10 : 1;
          const neu = begrenzen(wert + richtung * schritt * gross);
          setText(anzeigen(neu));
          aendern(neu);
        }}
      />
    </FeldRahmen>
  );
}

/**
 * Ein Maßfeld: Intern immer Zentimeter, angezeigt in der gewählten Einheit.
 */
export function Massfeld({
  label,
  cm,
  einheit,
  aendern,
  beiStart,
  min = 0,
  titel,
}: {
  label: string;
  cm: number;
  einheit: Massinheit;
  aendern: (cm: number) => void;
  beiStart?: () => void;
  min?: number;
  titel?: string;
}) {
  return (
    <Zahlfeld
      label={label}
      einheit={einheit}
      wert={cmInAnzeige(cm, einheit)}
      schritt={einheit === 'm' ? 0.05 : 5}
      nachkommastellen={einheit === 'm' ? 2 : 0}
      min={cmInAnzeige(min, einheit)}
      titel={titel}
      beiStart={beiStart}
      aendern={(wert) => aendern(Math.round(anzeigeInCm(wert, einheit) * 10) / 10)}
    />
  );
}

// ------------------------------------------------------------------ Farbe

export function Farbfeld({
  label,
  wert,
  aendern,
  beiStart,
}: {
  label: string;
  wert: string;
  aendern: (wert: string) => void;
  beiStart?: () => void;
}) {
  return (
    <FeldRahmen label={label}>
      <input
        type="color"
        value={wert}
        onFocus={beiStart}
        onChange={(e) => aendern(e.target.value)}
      />
    </FeldRahmen>
  );
}

// ------------------------------------------------------------- Ja/Nein

export function Schalter({
  label,
  wert,
  aendern,
  titel,
}: {
  label: string;
  wert: boolean;
  aendern: (wert: boolean) => void;
  titel?: string;
}) {
  return (
    <label className="schalter" title={titel}>
      <input type="checkbox" checked={wert} onChange={(e) => aendern(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// ------------------------------------------------------------- Auswahl

export function Auswahlfeld<T extends string>({
  label,
  wert,
  moeglichkeiten,
  aendern,
  beiStart,
}: {
  label: string;
  wert: T;
  moeglichkeiten: { wert: T; text: string }[];
  aendern: (wert: T) => void;
  beiStart?: () => void;
}) {
  return (
    <FeldRahmen label={label}>
      <select
        value={wert}
        onFocus={beiStart}
        onChange={(e) => aendern(e.target.value as T)}
      >
        {moeglichkeiten.map((m) => (
          <option key={m.wert} value={m.wert}>
            {m.text}
          </option>
        ))}
      </select>
    </FeldRahmen>
  );
}
