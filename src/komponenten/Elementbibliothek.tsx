import { useMemo, useState } from 'react';
import { BIBLIOTHEK } from '../daten/bibliothek';
import { KATEGORIEN } from '../daten/kategorien';
import { formatiereLaenge } from '../logik/masse';
import { rahmen } from '../logik/polygon';
import type { BibliothekEintrag, KategorieId, Massinheit } from '../typen/modell';
import { usePlanStore } from '../zustand/planStore';
import { SymbolPfeilAb, SymbolPfeilAuf, SymbolStern, SymbolSuche } from './Symbole';

/**
 * Die Elementbibliothek auf der linken Seite.
 *
 * Elemente werden per Ziehen auf die Fläche gebracht. Ein einfacher Klick
 * setzt das Element in die Mitte der aktuellen Ansicht – das ist oft schneller.
 */
export function Elementbibliothek() {
  const eigeneVorlagen = usePlanStore((s) => s.eigeneVorlagen);
  const tauschModus = usePlanStore((s) => s.tauschModus);
  const favoriten = usePlanStore((s) => s.favoriten);
  const auswahl = usePlanStore((s) => s.auswahl);
  const einheit = usePlanStore((s) => s.projekt.einstellungen.anzeigeEinheit);
  const [suche, setSuche] = useState('');
  /**
   * Zugeklappte Abteilungen. Beim Start sind **alle** zu.
   *
   * Die Bibliothek ist inzwischen mehrere hundert Vorlagen lang. Alles
   * aufgeklappt zu zeigen hieße, jedes Mal an einer meterlangen Liste
   * vorbeizuscrollen. Wer eine Abteilung braucht, klappt sie auf – oder
   * benutzt die Suche, die alles aufklappt.
   */
  const [zugeklappt, setZugeklappt] = useState<Set<KategorieId>>(
    () => new Set(KATEGORIEN.map((k) => k.id)),
  );
  /**
   * Zugeklappte Untergruppen, gemerkt als „Kategorie|Gruppe".
   *
   * Untergruppen starten **zu**: Eine Abteilung mit vierzig Vorlagen wäre
   * sonst genauso unübersichtlich wie ohne Gruppen. Wer eine Höhe aufklappt,
   * sieht genau die Möbel, die er sucht.
   */
  const [offeneGruppen, setOffeneGruppen] = useState<Set<string>>(new Set());

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

  const klappeGruppe = (schluessel: string) => {
    setOffeneGruppen((alt) => {
      const neu = new Set(alt);
      if (neu.has(schluessel)) neu.delete(schluessel);
      else neu.add(schluessel);
      return neu;
    });
  };

  /**
   * Teilt die Vorlagen einer Kategorie in Untergruppen auf.
   *
   * Vorlagen ohne Gruppe kommen zuerst und ohne Überschrift – bei einer
   * Abteilung mit fünf Einträgen wäre eine Gruppierung nur im Weg.
   */
  const nachGruppen = (eintraege: BibliothekEintrag[]) => {
    const ohne = eintraege.filter((v) => !v.gruppe);
    const mit = new Map<string, BibliothekEintrag[]>();
    for (const eintrag of eintraege) {
      if (!eintrag.gruppe) continue;
      if (!mit.has(eintrag.gruppe)) mit.set(eintrag.gruppe, []);
      mit.get(eintrag.gruppe)!.push(eintrag);
    }
    // Die Reihenfolge folgt der Bibliothek – nur „Frei" rutscht ans Ende.
    // Dort stehen Sonderfälle, nach denen man erst greift, wenn im Katalog
    // nichts Passendes steht.
    const gruppen = [...mit.entries()].sort(([a], [b]) => {
      const rang = (name: string) => (name.startsWith('Frei') ? 1 : 0);
      return rang(a) - rang(b);
    });
    return { ohne, gruppen };
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

  /**
   * Wartet die Anwendung gerade auf eine Vorlage zum Austauschen?
   *
   * Dann genügt ein einzelner Klick: Der Nutzer hat „Austauschen" gedrückt,
   * das Banner fragt ihn nach einer Vorlage, und die Antwort darauf ist ein
   * Klick. Sonst wird eingefügt – und dafür braucht es mehr als einen Klick,
   * siehe unten.
   */
  const tauschbereit = tauschModus && auswahl.length > 0;

  /**
   * Was das Anwählen einer Vorlage bewirkt.
   *
   * Im Regelfall wird eingefügt. Im Tauschmodus ersetzt dieselbe Geste die
   * Auswahl – das ist der schnellste Weg, einen ganzen Zug auf ein anderes
   * Regal umzustellen.
   */
  const waehlen = (vorlage: BibliothekEintrag) => {
    const store = usePlanStore.getState();
    if (store.tauschModus && store.auswahl.length > 0) store.tauscheVorlage(vorlage);
    else inDieMitte(vorlage);
  };

  return (
    <aside className="spalte spalte-links">
      <div className="spalte-kopf">Elemente</div>

      {tauschModus && (
        <div className="tausch-banner">
          <span>
            {auswahl.length === 1
              ? 'Vorlage wählen, die das Element ersetzen soll'
              : `Vorlage wählen, die die ${auswahl.length} Elemente ersetzen soll`}
          </span>
          <button className="knopf" onClick={() => usePlanStore.getState().setzeTauschModus(false)}>
            Abbrechen
          </button>
        </div>
      )}

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

              {offen &&
                (() => {
                  const { ohne, gruppen } = nachGruppen(eintraege);
                  return (
                    <>
                      {ohne.length > 0 && (
                        <Vorlagenliste
                          eintraege={ohne}
                          favoriten={favoriten}
                          einheit={einheit}
                          einfuegen={waehlen}
                          sofort={tauschbereit}
                        />
                      )}

                      {gruppen.map(([name, inhalt]) => {
                        const schluessel = `${kategorie.id}|${name}`;
                        // Beim Suchen alles aufklappen – sonst sucht man
                        // etwas und sieht nur zugeklappte Überschriften.
                        const gruppeOffen = offeneGruppen.has(schluessel) || Boolean(suche);
                        return (
                          <div key={schluessel}>
                            <button
                              className="gruppe-kopf"
                              onClick={() => klappeGruppe(schluessel)}
                            >
                              <span style={{ width: 12, height: 12, color: '#5d6874' }}>
                                {gruppeOffen ? <SymbolPfeilAuf /> : <SymbolPfeilAb />}
                              </span>
                              {name}
                              <span className="kategorie-anzahl">{inhalt.length}</span>
                            </button>
                            {gruppeOffen && (
                              <Vorlagenliste
                                eintraege={inhalt}
                                favoriten={favoriten}
                                einheit={einheit}
                                einfuegen={waehlen}
                                sofort={tauschbereit}
                              />
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
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

/**
 * Eine Vorlagenliste mit ihren Favoriten obenauf.
 *
 * Angeheftet wird **innerhalb der Untergruppe**, nicht am Kopf der ganzen
 * Abteilung: Ein angehefteter 1800er gehört zu den 1800ern. Stünde er oben
 * bei „Regale", läge er neben Vorlagen, mit denen er nichts zu tun hat, und
 * die Höhe – das Erste, wonach man greift – wäre aus der Liste verschwunden.
 *
 * Die Favoriten stehen zusätzlich, nicht stattdessen: Wer eine Vorlage an
 * ihrem gewohnten Platz sucht, findet sie dort auch weiterhin.
 */
function Vorlagenliste({
  eintraege,
  favoriten,
  einheit,
  einfuegen,
  sofort,
}: {
  eintraege: BibliothekEintrag[];
  favoriten: string[];
  einheit: Massinheit;
  einfuegen: (vorlage: BibliothekEintrag) => void;
  /** Genügt ein einzelner Klick? Nur im Tauschmodus. */
  sofort: boolean;
}) {
  const angeheftet = eintraege.filter((v) => favoriten.includes(v.id));
  return (
    <>
      {angeheftet.length > 0 && (
        <div className="vorlagen-liste favoritenblock">
          {angeheftet.map((vorlage) => (
            <Vorlage
              key={`fav-${vorlage.id}`}
              vorlage={vorlage}
              einheit={einheit}
              einfuegen={einfuegen}
              sofort={sofort}
              favorit
            />
          ))}
        </div>
      )}
      <div className="vorlagen-liste">
        {eintraege.map((vorlage) => (
          <Vorlage
            key={vorlage.id}
            vorlage={vorlage}
            einheit={einheit}
            einfuegen={einfuegen}
            sofort={sofort}
            favorit={favoriten.includes(vorlage.id)}
          />
        ))}
      </div>
    </>
  );
}

/**
 * Eine einzelne Vorlage in der Liste.
 *
 * **Ein Klick setzt nichts.** Beim Suchen fährt man die Liste entlang und
 * klickt dabei auf Zeilen, um sie zu lesen – jede davon legte vorher ein
 * Möbel in die Mitte des Marktes, das man hinterher wieder wegräumen musste.
 * Eingefügt wird deshalb mit einem Doppelklick oder, genauer, indem man die
 * Vorlage an ihre Stelle zieht.
 *
 * Wirkungslos ist der Klick trotzdem nicht: Er zeigt die Vorlage rechts im
 * Eigenschaftenfenster an. So geht man eine Liste durch und liest Maße nach,
 * ohne den Plan anzufassen.
 *
 * Im Tauschmodus bleibt der einzelne Klick: Dort fragt das Banner nach einer
 * Vorlage, und die Antwort darauf ist ein Klick.
 */
function Vorlage({
  vorlage,
  einheit,
  einfuegen,
  sofort,
  favorit = false,
}: {
  vorlage: BibliothekEintrag;
  einheit: Massinheit;
  einfuegen: (vorlage: BibliothekEintrag) => void;
  sofort: boolean;
  favorit?: boolean;
}) {
  const geste = sofort
    ? 'Klicken stellt die Auswahl auf diese Vorlage um'
    : 'Klicken zeigt die Maße rechts · auf den Plan ziehen oder Doppelklick setzt es';
  return (
    <div
      className="vorlage"
      draggable
      title={vorlage.hinweis ? `${vorlage.hinweis} — ${geste}` : geste}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', vorlage.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={
        sofort
          ? () => einfuegen(vorlage)
          : () => usePlanStore.getState().zeigeVorlage(vorlage)
      }
      onDoubleClick={sofort ? undefined : () => einfuegen(vorlage)}
    >
      <button
        className={`sternknopf${favorit ? ' aktiv' : ''}`}
        title={favorit ? 'Aus den Favoriten nehmen' : 'Als Favorit oben anheften'}
        aria-pressed={favorit}
        onClick={(e) => {
          // Der Stern sitzt in der Zeile, die im Tauschmodus selbst wirkt.
          // Ohne das Anhalten würde ein Klick auf den Stern dort zusätzlich
          // die Auswahl umstellen.
          e.stopPropagation();
          usePlanStore.getState().schalteFavorit(vorlage.id);
        }}
      >
        <SymbolStern gefuellt={favorit} />
      </button>
      <span
        className={`vorlage-bild${
          vorlage.form === 'kreis' || vorlage.form === 'halbkreis' ? ' rund' : ''
        }`}
        style={{ background: vorlage.farbe }}
      />
      <span className="vorlage-text">
        <span className="vorlage-name">{vorlage.name}</span>
        <span className="vorlage-mass">
          {formatiereLaenge(vorlage.breite, einheit)} × {formatiereLaenge(vorlage.tiefe, einheit)}
        </span>
      </span>
    </div>
  );
}
