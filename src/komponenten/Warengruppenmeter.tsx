import { useMemo } from 'react';
import { auslagenAnteil } from '../logik/auslagen';
import { abteilungVon } from '../logik/sortiment';
import {
  metersumme,
  OHNE_WARENGRUPPE,
  warengruppenmeter,
  type Warengruppenzeile,
} from '../logik/warengruppenmeter';
import { usePlanStore } from '../zustand/planStore';
import type { Projekt } from '../typen/modell';

/**
 * Die Meter je Warengruppe, ausklappbar in der Projektübersicht.
 *
 * Die Frage, um die es beim Planen geht: Wie viel Platz bekommt welches
 * Sortiment? Bisher stand darüber eine einzige Zahl – die Regalmeter des
 * ganzen Marktes –, und wer wissen wollte, wie sie sich verteilt, musste am
 * Bildschirm abmessen.
 *
 * **Zwei Spalten, und sie messen Verschiedenes.** Laufende Meter sind die
 * waagerechte Länge; tatsächliche Meter sind dieselbe Länge mal Auslagen.
 * Ein Meter Regal mit fünf Böden ist ein laufender und fünf tatsächliche.
 * Beim Bestellen zählt die zweite Zahl, beim Aufteilen des Ladens die erste.
 *
 * **Was fehlt, steht da.** Wo keine Bodenzahl eingetragen ist, bleibt die
 * zweite Spalte leer und die Zeile sagt, auf wie vielen Metern. Eine
 * geschätzte Zahl wanderte sonst in eine Bestellung.
 *
 * Zugeklappt kostet die Tabelle eine Zeile. Wer sie aufklappt, sieht die
 * Abteilungen des Marktes in der Reihenfolge seiner eigenen Sortimentsliste.
 */

/** Zwei Nachkommastellen, deutsch – die Meter sind auf den Zentimeter genau. */
function meter(wert: number): string {
  return wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Eine Abteilung mit ihren Zeilen. */
interface Abteilungsblock {
  name?: string;
  zeilen: Warengruppenzeile[];
}

export function Warengruppenmeter({ projekt }: { projekt: Projekt }) {
  const sortiment = usePlanStore((s) => s.sortiment);

  const zeilen = useMemo(
    () => warengruppenmeter(projekt, { auslagen: auslagenAnteil }),
    [projekt],
  );
  const summe = useMemo(() => metersumme(zeilen), [zeilen]);

  /**
   * Nach Abteilungen geordnet, in der Reihenfolge der Sortimentsliste.
   *
   * Die Reihenfolge der Liste ist die des Marktes – sie folgt dem Weg durch
   * den Laden. Alphabetisch zu sortieren wäre eine Ordnung, die niemand im
   * Kopf hat. Namen, die in keiner Abteilung stehen, kommen ans Ende: Sie
   * sind von Hand geschrieben und noch nicht eingeordnet.
   */
  const bloecke = useMemo<Abteilungsblock[]>(() => {
    const nach = new Map<string, Warengruppenzeile[]>();
    const ohne: Warengruppenzeile[] = [];

    for (const zeile of zeilen) {
      const abteilung = zeile.name === OHNE_WARENGRUPPE ? undefined : abteilungVon(sortiment, zeile.name);
      if (!abteilung) {
        ohne.push(zeile);
        continue;
      }
      const vorhanden = nach.get(abteilung);
      if (vorhanden) vorhanden.push(zeile);
      else nach.set(abteilung, [zeile]);
    }

    const aus: Abteilungsblock[] = [];
    for (const abteilung of sortiment.abteilungen) {
      const eigene = nach.get(abteilung.name);
      if (eigene?.length) aus.push({ name: abteilung.name, zeilen: eigene });
    }
    if (ohne.length) aus.push({ zeilen: ohne });
    return aus;
  }, [zeilen, sortiment]);

  if (zeilen.length === 0) return null;

  const gruppen = zeilen.filter((z) => z.name !== OHNE_WARENGRUPPE).length;

  return (
    <details className="warengruppenmeter">
      <summary>
        <span>
          Meter je Warengruppe
          <span className="kategorie-anzahl"> · {gruppen}</span>
        </span>
        <span className="kennzahl-wert">
          {meter(summe.laufend)} lfm
          {summe.tatsaechlich > 0 && <> · {meter(summe.tatsaechlich)} tm</>}
        </span>
      </summary>

      <div className="metertabelle">
        <div className="meterzeile kopf">
          <span>Warengruppe</span>
          <span title="Laufende Meter: die waagerechte Länge im Markt">lfm</span>
          <span title="Tatsächliche Meter: laufende Meter mal Auslagen">tm</span>
        </div>

        {bloecke.map((block, i) => (
          <div key={block.name ?? `ohne-${i}`}>
            <div className="meterabteilung">{block.name ?? 'Noch nicht eingeordnet'}</div>
            {block.zeilen.map((zeile) => (
              <div
                className={`meterzeile${zeile.name === OHNE_WARENGRUPPE ? ' namenlos' : ''}`}
                key={zeile.name}
                title={
                  zeile.ohneAuslagen > 0
                    ? `Auf ${meter(zeile.ohneAuslagen)} m fehlt die Bodenzahl – ` +
                      'die tatsächlichen Meter sind so weit unvollständig.'
                    : `${zeile.strecken} Möbelseite${zeile.strecken === 1 ? '' : 'n'}`
                }
              >
                <span>
                  {zeile.name}
                  {zeile.ohneAuslagen > 0 && zeile.name !== OHNE_WARENGRUPPE && (
                    <span className="meterluecke"> · {meter(zeile.ohneAuslagen)} offen</span>
                  )}
                </span>
                <span>{meter(zeile.laufend)}</span>
                <span>{zeile.tatsaechlich === undefined ? '–' : meter(zeile.tatsaechlich)}</span>
              </div>
            ))}
          </div>
        ))}

        <div className="meterzeile summe">
          <span>Zusammen</span>
          <span>{meter(summe.laufend)}</span>
          <span>{summe.tatsaechlich > 0 ? meter(summe.tatsaechlich) : '–'}</span>
        </div>
      </div>

      {summe.ohneAuslagen > 0 && (
        <div className="meterhinweis">
          Auf <strong>{meter(summe.ohneAuslagen)} m</strong> fehlt die Bodenzahl. Sie steht am Feld,
          links neben der Notiz – solange sie fehlt, bleiben die tatsächlichen Meter unvollständig.
        </div>
      )}
    </details>
  );
}
