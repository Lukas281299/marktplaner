import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gefiltert, gruppenstand, standVon, pfadVon } from '../logik/sortiment';
import { usePlanStore } from '../zustand/planStore';

/**
 * Ein Auswahlmenü über die geladene Sortimentsliste.
 *
 * Neben dem Eingabefeld für eine Warengruppe. Getippt wird weiter – ein Name,
 * den die Liste nicht kennt, muss sich schreiben lassen, sonst wäre die Liste
 * eine Fessel statt einer Hilfe. Aber wer den Namen nicht auswendig weiß,
 * soll ihn nicht raten müssen.
 *
 * **Es ist dieselbe Liste wie links**, mit denselben drei Stufen, denselben
 * aufklappbaren Abteilungen und derselben Suche. Ein Auswahlfeld hätte das
 * nicht gekonnt: Es kennt nur zwei Ebenen, klappt immer alles auf einmal auf
 * und lässt sich nicht durchsuchen. Bei elf Abteilungen und 364 Sortimenten
 * ist das der Unterschied zwischen Nachschlagen und Scrollen.
 *
 * Auch der Zustand ist derselbe: Was im Markt schon steht, ist grün. So sieht
 * man beim Zuordnen, was noch fehlt, ohne die Spalte zu wechseln.
 *
 * Ohne geladene Liste erscheint das Menü nicht. Ein leeres Menü wäre ein
 * Knopf, der nichts tut.
 */

/**
 * Wo das Menü aufgeht.
 *
 * Am Fenster und nicht am Knopf: Das Eigenschaftenfenster trägt
 * `overflow-y: auto`, darin würde ein aufgeklapptes Menü an der Unterkante
 * abgeschnitten. Also die Lage aus dem Knopf ausmessen und danebenhängen.
 */
function lageAm(knopf: HTMLElement | null): { left: number; top: number; maxHeight: number } {
  if (!knopf) return { left: 8, top: 8, maxHeight: 400 };
  const k = knopf.getBoundingClientRect();
  const breite = 260;
  const left = Math.max(6, Math.min(k.right - breite, window.innerWidth - breite - 6));
  const platz = window.innerHeight - k.bottom - 12;
  // Passt darunter zu wenig, geht es nach oben auf.
  const nachOben = platz < 200 && k.top > platz;
  return {
    left,
    top: nachOben ? Math.max(6, k.top - Math.min(420, k.top - 12) - 4) : k.bottom + 4,
    maxHeight: nachOben ? Math.min(420, k.top - 18) : Math.max(160, Math.min(420, platz)),
  };
}

export function Warengruppenwahl({ waehle }: { waehle: (name: string) => void }) {
  const sortiment = usePlanStore((s) => s.sortiment);
  const stand = usePlanStore((s) => s.projekt.sortimentsstand);
  const zuordnungen = usePlanStore((s) => s.projekt.zuordnungen);
  const offeneAbteilungen = usePlanStore((s) => s.offeneAbteilungen);

  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState('');
  const knopf = useRef<HTMLButtonElement | null>(null);
  const feld = useRef<HTMLInputElement | null>(null);

  // Schließt beim Klick daneben und bei Escape.
  useEffect(() => {
    if (!offen) return;
    const daneben = (e: MouseEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (knopf.current?.contains(ziel as Node)) return;
      if (ziel?.closest?.('.wg-menue')) return;
      setOffen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOffen(false);
      }
    };
    document.addEventListener('mousedown', daneben);
    document.addEventListener('keydown', taste, true);
    return () => {
      document.removeEventListener('mousedown', daneben);
      document.removeEventListener('keydown', taste, true);
    };
  }, [offen]);

  // Der Cursor steht sofort im Suchfeld: Tippen ist schneller als Scrollen.
  useEffect(() => {
    if (offen) feld.current?.focus();
  }, [offen]);

  if (sortiment.abteilungen.length === 0) return null;

  const nimm = (name: string) => {
    waehle(name);
    setOffen(false);
    setSuche('');
  };

  const sucht = suche.trim() !== '';
  const gezeigt = gefiltert(sortiment, suche);
  const lage = lageAm(knopf.current);

  return (
    <>
      <button
        ref={knopf}
        type="button"
        className="wg-wahl"
        title="Aus der Sortimentsliste wählen"
        onClick={() => setOffen((o) => !o)}
      >
        ▾
      </button>

      {offen &&
        createPortal(
          <div
            className="wg-menue"
            style={{ left: lage.left, top: lage.top, maxHeight: lage.maxHeight }}
          >
            <input
              ref={feld}
              type="text"
              className="wg-menue-suche"
              value={suche}
              placeholder="Suchen …"
              onChange={(e) => setSuche(e.target.value)}
            />

            <div className="wg-menue-liste">
              {gezeigt.abteilungen.map((abteilung) => {
                // Beim Suchen ist alles offen – sonst müsste man den Treffer
                // erst noch aufklappen, den man gerade gefunden hat.
                const auf = sucht || offeneAbteilungen.includes(abteilung.name);
                return (
                  <div key={abteilung.name}>
                    <button
                      type="button"
                      className="wg-menue-abteilung"
                      onClick={() => usePlanStore.getState().schalteAbteilung(abteilung.name)}
                    >
                      <span className="wg-pfeil">{auf ? '▾' : '▸'}</span>
                      {abteilung.name}
                      <span className="kategorie-anzahl">{abteilung.warengruppen.length}</span>
                    </button>

                    {auf &&
                      abteilung.warengruppen.map((gruppe) => {
                        const g = gruppenstand(stand, abteilung.name, gruppe, zuordnungen);
                        return (
                          <div key={gruppe.name}>
                            <button
                              type="button"
                              className="wg-menue-name"
                              onClick={() => nimm(gruppe.name)}
                            >
                              <span className={`wg-punkt ${g.wert}`} />
                              {gruppe.name}
                            </button>
                            {gruppe.sortimente.map((name) => (
                              <button
                                type="button"
                                className="wg-menue-name wg-tief"
                                key={name}
                                onClick={() => nimm(name)}
                              >
                                <span
                                  className={`wg-punkt ${standVon(
                                    stand,
                                    pfadVon(abteilung.name, gruppe.name, name),
                                    zuordnungen,
                                  )}`}
                                />
                                {name}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                  </div>
                );
              })}

              {gezeigt.abteilungen.length === 0 && (
                <p className="hinweis" style={{ margin: 8 }}>
                  Nichts gefunden. Der Name lässt sich trotzdem eintippen — die Liste ist eine
                  Hilfe und keine Vorschrift.
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
