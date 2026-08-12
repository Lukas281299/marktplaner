import { useMemo, useState } from 'react';
import { BIBLIOTHEK } from '../daten/bibliothek';
import { KATEGORIEN } from '../daten/kategorien';
import { formatiereLaenge } from '../logik/masse';
import { rahmen } from '../logik/polygon';
import type { BibliothekEintrag, KategorieId } from '../typen/modell';
import { usePlanStore } from '../zustand/planStore';
import { SymbolPfeilAb, SymbolPfeilAuf, SymbolSuche } from './Symbole';

/**
 * Die Elementbibliothek auf der linken Seite.
 *
 * Elemente werden per Ziehen auf die Fläche gebracht. Ein einfacher Klick
 * setzt das Element in die Mitte der aktuellen Ansicht – das ist oft schneller.
 */
export function Elementbibliothek() {
  const eigeneVorlagen = usePlanStore((s) => s.eigeneVorlagen);
  const einheit = usePlanStore((s) => s.projekt.einstellungen.anzeigeEinheit);
  const [suche, setSuche] = useState('');
  const [zugeklappt, setZugeklappt] = useState<Set<KategorieId>>(new Set());

  const alleVorlagen = useMemo(
    () => [...BIBLIOTHEK, ...eigeneVorlagen],
    [eigeneVorlagen],
  );

  /** Nach dem Suchbegriff gefiltert – Groß- und Kleinschreibung egal. */
  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    if (!begriff) return alleVorlagen;
    return alleVorlagen.filter((v) => v.name.toLowerCase().includes(begriff));
  }, [alleVorlagen, suche]);

  const klappen = (id: KategorieId) => {
    setZugeklappt((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  };

  /** Setzt eine Vorlage in die Mitte der Grundfläche. */
  const inDieMitte = (vorlage: BibliothekEintrag) => {
    const store = usePlanStore.getState();
    const bereich = rahmen(store.projekt.grundflaeche.umriss);
    store.fuegeElementHinzu(
      vorlage,
      Math.round((bereich.links + bereich.rechts) / 2),
      Math.round((bereich.oben + bereich.unten) / 2),
    );
  };

  return (
    <aside className="spalte spalte-links">
      <div className="spalte-kopf">Elemente</div>

      <div className="suchfeld">
        <SymbolSuche />
        <input
          type="text"
          value={suche}
          placeholder="Element suchen …"
          onChange={(e) => setSuche(e.target.value)}
        />
      </div>

      <div className="spalte-inhalt">
        {KATEGORIEN.map((kategorie) => {
          const eintraege = gefiltert.filter((v) => v.kategorie === kategorie.id);
          // Leere Kategorien werden nur beim Suchen ausgeblendet.
          if (eintraege.length === 0 && (suche || kategorie.id === 'eigene')) return null;
          const offen = !zugeklappt.has(kategorie.id) || Boolean(suche);

          return (
            <section key={kategorie.id}>
              <button
                className="kategorie-kopf"
                onClick={() => klappen(kategorie.id)}
                title={kategorie.beschreibung}
              >
                <span className="kategorie-punkt" style={{ background: kategorie.farbe }} />
                {kategorie.name}
                <span className="kategorie-anzahl">{eintraege.length}</span>
                <span style={{ width: 14, height: 14, marginLeft: 4, color: '#5d6874' }}>
                  {offen ? <SymbolPfeilAuf /> : <SymbolPfeilAb />}
                </span>
              </button>

              {offen && (
                <div className="vorlagen-liste">
                  {eintraege.map((vorlage) => (
                    <div
                      key={vorlage.id}
                      className="vorlage"
                      draggable
                      title={
                        vorlage.hinweis
                          ? `${vorlage.hinweis} — Ziehen oder klicken zum Einfügen`
                          : 'Ziehen oder klicken zum Einfügen'
                      }
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', vorlage.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => inDieMitte(vorlage)}
                    >
                      <span
                        className={`vorlage-bild${
                          vorlage.form === 'kreis' || vorlage.form === 'halbkreis' ? ' rund' : ''
                        }`}
                        style={{ background: vorlage.farbe }}
                      />
                      <span className="vorlage-text">
                        <span className="vorlage-name">{vorlage.name}</span>
                        <span className="vorlage-mass">
                          {formatiereLaenge(vorlage.breite, einheit)} ×{' '}
                          {formatiereLaenge(vorlage.tiefe, einheit)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {gefiltert.length === 0 && (
          <p className="hinweis" style={{ padding: '16px' }}>
            Kein Element gefunden. Versuche einen anderen Suchbegriff.
          </p>
        )}
      </div>
    </aside>
  );
}
