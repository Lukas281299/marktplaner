import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gefiltert, gruppenstand, standVon, pfadVon } from '../logik/sortiment';
import { pfadeImPlan } from '../logik/planstand';
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

export function Warengruppenwahl({
  waehle,
  fuegeHinzu,
  titel,
}: {
  /** Bekommt den Namen und den vollen Pfad – der macht ihn eindeutig. */
  waehle: (name: string, pfad: string) => void;
  /**
   * Was der Knopf verspricht.
   *
   * Neben dem Textfeld wählt das Menü die Beschriftung; an einer
   * Sonderplatzierung wählt es nur, **wohin die Meter zählen**, und dann muss
   * das auch dranstehen.
   */
  titel?: string;
  /**
   * Nimmt den Namen als **weiteres** Sortiment auf dieselbe Strecke.
   *
   * Zwei Sortimente auf einem Meter schreibt man mit Komma: „Nüsse,
   * Trockenobst". Das Komma soll niemand selbst tippen müssen – neben jedem
   * Namen steht ein „+", das ihn anhängt, statt den ersten zu ersetzen.
   * Steht nichts im Feld, gibt es nichts anzuhängen; dann fehlt der Knopf.
   */
  fuegeHinzu?: (name: string, pfad: string) => void;
}) {
  const sortiment = usePlanStore((s) => s.sortiment);
  const stand = usePlanStore((s) => s.projekt.sortimentsstand);
  const projekt = usePlanStore((s) => s.projekt);
  const elemente = usePlanStore((s) => s.projekt.elemente);
  // Dieselbe Frage wie links: Was im Plan steht, ist grün.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const imPlan = useMemo(() => pfadeImPlan(projekt, sortiment), [elemente, sortiment]);
  const zuordnungen = usePlanStore((s) => s.projekt.zuordnungen);
  const offeneAbteilungen = usePlanStore((s) => s.offeneAbteilungen);

  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState('');
  const knopf = useRef<HTMLButtonElement | null>(null);
  const feld = useRef<HTMLInputElement | null>(null);

  /**
   * Die Lage des Menüs, nachgeführt.
   *
   * Es hängt am Fenster und nicht am Knopf – scrollt jemand das
   * Eigenschaftenfenster, wandert der Knopf und das Menü bliebe stehen. Bei
   * einer Liste mit 364 Sortimenten scrollt man, und dann darf das Menü nicht
   * neben seinem Knopf hängen bleiben.
   */
  const [lage, setLage] = useState(() => lageAm(null));

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

  // Und die Lage nachführen, solange es offen ist. `true` als drittes
  // Argument fängt auch das Scrollen **innerhalb** des Eigenschaftenfensters:
  // Ein Scroll-Ereignis steigt nicht auf, es wird nur eingefangen.
  useEffect(() => {
    if (!offen) return;
    const messen = () => setLage(lageAm(knopf.current));
    messen();
    window.addEventListener('scroll', messen, true);
    window.addEventListener('resize', messen);
    return () => {
      window.removeEventListener('scroll', messen, true);
      window.removeEventListener('resize', messen);
    };
  }, [offen]);

  if (sortiment.abteilungen.length === 0) return null;

  const nimm = (name: string, pfad: string) => {
    waehle(name, pfad);
    setOffen(false);
    setSuche('');
  };

  const dazu = (name: string, pfad: string) => {
    fuegeHinzu?.(name, pfad);
    setOffen(false);
    setSuche('');
  };

  /** Ein Eintrag im Menü: der Name, und daneben das „+", wenn es eins gibt. */
  const Eintrag = ({
    name,
    pfad,
    tief,
    wert,
  }: {
    name: string;
    pfad: string;
    tief: boolean;
    wert: string;
  }) => (
    <div className="wg-menue-zeile">
      <button
        type="button"
        className={`wg-menue-name${tief ? ' wg-tief' : ''}`}
        onClick={() => nimm(name, pfad)}
      >
        <span className={`wg-punkt ${wert}`} />
        {name}
      </button>
      {fuegeHinzu && (
        <button
          type="button"
          className="wg-menue-dazu"
          title={`„${name}" als weiteres Sortiment auf dieselbe Strecke – dazu, nicht statt`}
          onClick={() => dazu(name, pfad)}
        >
          +
        </button>
      )}
    </div>
  );

  const sucht = suche.trim() !== '';
  const gezeigt = gefiltert(sortiment, suche);

  return (
    <>
      <button
        ref={knopf}
        type="button"
        className="wg-wahl"
        title={titel ?? 'Aus der Sortimentsliste wählen'}
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
                        const g = gruppenstand(stand, abteilung.name, gruppe, zuordnungen, imPlan);
                        return (
                          <div key={gruppe.name}>
                            <Eintrag
                              name={gruppe.name}
                              pfad={pfadVon(abteilung.name, gruppe.name)}
                              tief={false}
                              wert={g.wert}
                            />
                            {gruppe.sortimente.map((name) => (
                              <Eintrag
                                key={name}
                                name={name}
                                pfad={pfadVon(abteilung.name, gruppe.name, name)}
                                tief
                                wert={standVon(
                                  stand,
                                  pfadVon(abteilung.name, gruppe.name, name),
                                  zuordnungen,
                                  imPlan,
                                )}
                              />
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
