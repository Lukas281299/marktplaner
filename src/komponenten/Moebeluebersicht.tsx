import { useMemo } from 'react';
import { KATEGORIEN } from '../daten/kategorien';
import { moebelliste, moebelsumme, type Moebelzeile } from '../logik/moebelliste';
import { usePlanStore } from '../zustand/planStore';
import type { KategorieId, Projekt } from '../typen/modell';

/**
 * Die Stückliste des Marktes, ausklappbar in der Projektübersicht.
 *
 * Die Flächenübersicht sagt, wie viele Quadratmeter eine Abteilung belegt.
 * Hier steht, **woraus** sie besteht – fünf Gondeln A1000, zwei Kopfgondeln,
 * ein Stufenmöbel. Das ist die Liste, mit der man in ein Gespräch über Umbau
 * geht, und bis hierher musste man sie im Plan abzählen.
 *
 * Geordnet wie die Bibliothek links: Kategorie für Kategorie, in derselben
 * Reihenfolge. Wer im Plan denkt, denkt in diesen Gruppen.
 */

/** Meter, deutsch, mit zwei Stellen. */
function meter(cm: number): string {
  return (cm / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Moebeluebersicht({ projekt }: { projekt: Projekt }) {
  const eigene = usePlanStore((s) => s.eigeneVorlagen);

  const zeilen = useMemo(() => moebelliste(projekt, eigene), [projekt, eigene]);
  const summe = useMemo(() => moebelsumme(zeilen), [zeilen]);

  /** Nach Kategorien, in der Reihenfolge der Bibliothek. */
  const bloecke = useMemo(() => {
    const nach = new Map<KategorieId, Moebelzeile[]>();
    for (const zeile of zeilen) {
      const vorhanden = nach.get(zeile.kategorie);
      if (vorhanden) vorhanden.push(zeile);
      else nach.set(zeile.kategorie, [zeile]);
    }
    const aus: { name: string; zeilen: Moebelzeile[] }[] = [];
    for (const kategorie of KATEGORIEN) {
      const eigene = nach.get(kategorie.id);
      if (eigene?.length) {
        aus.push({ name: kategorie.name, zeilen: eigene });
        nach.delete(kategorie.id);
      }
    }
    // Was zu keiner bekannten Kategorie gehört, fällt trotzdem nicht weg –
    // sonst wäre die Summe unten größer als die Liste darüber.
    for (const [id, eigene] of nach) aus.push({ name: String(id), zeilen: eigene });
    return aus;
  }, [zeilen]);

  if (zeilen.length === 0) return null;

  return (
    <details className="warengruppenmeter">
      <summary>
        <span>
          Möbelübersicht
          <span className="kategorie-anzahl">
            {' '}
            · {zeilen.length} {zeilen.length === 1 ? 'Art' : 'Arten'}
          </span>
        </span>
        <span className="kennzahl-wert">{summe.anzahl} Stück</span>
      </summary>

      <div className="metertabelle">
        <div className="meterzeile kopf moebelzeile">
          <span>Möbel</span>
          <span>Stück</span>
          <span>lfm</span>
        </div>

        {bloecke.map((block) => (
          <div key={block.name}>
            <div className="meterabteilung">{block.name}</div>
            {block.zeilen.map((zeile) => (
              <div
                className="meterzeile moebelzeile"
                key={`${zeile.vorlageId}|${zeile.name}|${zeile.laenge}`}
                title={`${zeile.flaeche.toLocaleString('de-DE')} m² Grundfläche`}
              >
                <span>{zeile.name}</span>
                <span>{zeile.anzahl}</span>
                <span>{meter(zeile.laenge)}</span>
              </div>
            ))}
          </div>
        ))}

        <div className="meterzeile summe moebelzeile">
          <span>Zusammen</span>
          <span>{summe.anzahl}</span>
          <span>{summe.flaeche.toLocaleString('de-DE')} m²</span>
        </div>
      </div>
    </details>
  );
}
