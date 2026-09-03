import { useMemo, useState } from 'react';
import { meterauswertung, OHNE_ABTEILUNG, type Meterknoten } from '../logik/meterbaum';
import { OHNE_WARENGRUPPE } from '../logik/warengruppenmeter';
import { usePlanStore } from '../zustand/planStore';
import type { Projekt } from '../typen/modell';

/**
 * Die Meter je Warengruppe, ausklappbar in der Projektübersicht.
 *
 * Die Frage, um die es beim Planen geht: Wie viel Platz bekommt welches
 * Sortiment?
 *
 * **Geordnet wie die Liste links** – Abteilung, Warengruppe, Sortiment, mit
 * aufklappbaren Abteilungen und Summen auf jeder Stufe. Eine flache Liste
 * war beim Durchgehen unbrauchbar: 73 Namen hintereinander sind kein Bild
 * vom Markt. Wer die Auswertung liest, denkt in Abteilungen, so wie er auch
 * durch den Laden geht.
 *
 * **Zwei Spalten, und sie messen Verschiedenes.** Laufende Meter sind die
 * waagerechte Länge; tatsächliche Meter sind dieselbe Länge mal Auslagen.
 * Ein Meter Regal mit fünf Böden ist ein laufender und fünf tatsächliche.
 * Beim Bestellen zählt die zweite Zahl, beim Aufteilen des Ladens die erste.
 *
 * **Was fehlt, steht da.** Wo keine Bodenzahl eingetragen ist, bleibt die
 * zweite Spalte leer und die Zeile sagt, auf wie vielen Metern. Eine
 * geschätzte Zahl wanderte sonst in eine Bestellung.
 */

/** Zwei Nachkommastellen, deutsch – die Meter sind auf den Zentimeter genau. */
function meter(wert: number): string {
  return wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Alle Pfade des Baums – für „alles aufklappen". */
function alleWege(knoten: Meterknoten[]): string[] {
  return knoten.flatMap((k) => [k.pfad, ...alleWege(k.kinder)]);
}

/** Eine Zeile des Baums, mit allem, was darunter hängt. */
function Zweig({
  knoten,
  offen,
  schalte,
}: {
  knoten: Meterknoten;
  offen: Set<string>;
  schalte: (pfad: string) => void;
}) {
  const auf = offen.has(knoten.pfad);
  const hatKinder = knoten.kinder.length > 0;
  const namenlos = knoten.name === OHNE_WARENGRUPPE || knoten.name === OHNE_ABTEILUNG;

  return (
    <>
      <div
        className={`meterzeile stufe${knoten.stufe}${namenlos ? ' namenlos' : ''}`}
        title={
          knoten.ohneAuslagen > 0
            ? `Auf ${meter(knoten.ohneAuslagen)} m fehlt die Bodenzahl – ` +
              'die tatsächlichen Meter sind so weit unvollständig.'
            : knoten.nurLaufend > 0
              ? 'Hier zählen nur laufende Meter – Blumen und Pflanzen haben ' +
                'kaum klassische Böden.'
              : `${knoten.strecken} Möbelseite${knoten.strecken === 1 ? '' : 'n'}`
        }
      >
        <span className="metername">
          {hatKinder ? (
            <button className="meterpfeil" onClick={() => schalte(knoten.pfad)}>
              {auf ? '▾' : '▸'}
            </button>
          ) : (
            <span className="meterpfeil" />
          )}
          <span className="metertext">{knoten.name}</span>
          {/* Die Kistenzahl steht am Namen und nicht in einer eigenen Spalte:
              Sie gilt nur für Obst und Gemüse, und eine Spalte, die überall
              sonst leer bliebe, verengt die anderen. */}
          {knoten.kisten > 0 && <span className="meterkisten">{knoten.kisten} iK</span>}
          {knoten.ohneAuslagen > 0 && !namenlos && (
            <span className="meterluecke">{meter(knoten.ohneAuslagen)} offen</span>
          )}
        </span>
        <span>{meter(knoten.laufend)}</span>
        <span>
          {knoten.tatsaechlich !== undefined
            ? meter(knoten.tatsaechlich)
            : knoten.nurLaufend > 0
              ? 'nur lfm'
              : '–'}
        </span>
      </div>

      {auf &&
        knoten.kinder.map((kind) => (
          <Zweig key={kind.pfad} knoten={kind} offen={offen} schalte={schalte} />
        ))}
    </>
  );
}

export function Warengruppenmeter({ projekt }: { projekt: Projekt }) {
  const sortiment = usePlanStore((s) => s.sortiment);

  const { baum, gesamt } = useMemo(
    () => meterauswertung(projekt, sortiment),
    [projekt, sortiment],
  );

  /**
   * Welche Abteilungen aufgeklappt sind.
   *
   * In der Komponente gemerkt und nicht in der Planung: Es ist kein Teil des
   * Plans, und nach dem Neuladen wieder zusammengeklappt anzufangen ist kein
   * Verlust. Bewusst **nicht** an die Liste links gekoppelt – dort klappt man
   * beim Zuordnen auf, hier beim Prüfen, und das sind zwei Vorgänge.
   */
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const schalte = (pfad: string) =>
    setOffen((alt) => {
      const neu = new Set(alt);
      if (neu.has(pfad)) neu.delete(pfad);
      else neu.add(pfad);
      return neu;
    });

  if (baum.length === 0) return null;

  return (
    <details className="warengruppenmeter">
      <summary>
        <span>
          Meter je Warengruppe
          <span className="kategorie-anzahl"> · {gesamt.posten}</span>
        </span>
        <span className="kennzahl-wert">
          {meter(gesamt.laufend)} lfm
          {gesamt.tatsaechlich > 0 && <> · {meter(gesamt.tatsaechlich)} tm</>}
        </span>
      </summary>

      <div className="metertabelle">
        <div className="meterzeile kopf">
          <span className="metername">
            <button
              className="meterpfeil"
              title={offen.size > 0 ? 'Alles zuklappen' : 'Alles aufklappen'}
              onClick={() => setOffen(offen.size > 0 ? new Set() : new Set(alleWege(baum)))}
            >
              {offen.size > 0 ? '▾' : '▸'}
            </button>
            <span className="metertext">Warengruppe</span>
          </span>
          <span title="Laufende Meter: die waagerechte Länge im Markt">lfm</span>
          <span title="Tatsächliche Meter: laufende Meter mal Auslagen">tm</span>
        </div>

        {baum.map((knoten) => (
          <Zweig key={knoten.pfad} knoten={knoten} offen={offen} schalte={schalte} />
        ))}

        <div className="meterzeile summe">
          <span className="metername">
            <span className="meterpfeil" />
            <span className="metertext">Zusammen</span>
            {gesamt.kisten > 0 && <span className="meterkisten">{gesamt.kisten} iK</span>}
          </span>
          <span>{meter(gesamt.laufend)}</span>
          <span>{gesamt.tatsaechlich > 0 ? meter(gesamt.tatsaechlich) : '–'}</span>
        </div>
      </div>

      {gesamt.ohneAuslagen > 0 && (
        <div className="meterhinweis">
          Auf <strong>{meter(gesamt.ohneAuslagen)} m</strong> fehlt die Bodenzahl. Sie steht am
          Feld, links neben der Notiz – solange sie fehlt, bleiben die tatsächlichen Meter
          unvollständig.
        </div>
      )}

      {gesamt.nurLaufend > 0 && (
        <div className="meterhinweis">
          <strong>{meter(gesamt.nurLaufend)} m</strong> zählen nur laufend – Blumen und Pflanzen
          haben kaum klassische Böden. Das ist keine Lücke und muss nicht nachgetragen werden.
        </div>
      )}
    </details>
  );
}
