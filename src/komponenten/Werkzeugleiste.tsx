import { useRef, useState } from 'react';
import { exportierePng } from '../logik/bildExport';
import { buehneSteuerung } from '../logik/buehne';
import {
  exportiereAlsJson,
  importiereAusJson,
  speichereProjekt,
  speichereVorlage,
} from '../speicher/projektArchiv';
import { usePlanStore } from '../zustand/planStore';
import { useSyncStore } from '../zustand/syncStore';
import { NeuesProjektDialog, ProjekteDialog } from './ProjektDialog';
import { PlanImportDialog } from './PlanImportDialog';
import { SyncDialog } from './SyncDialog';
import {
  SymbolAbgleich,
  SymbolAneinander,
  SymbolBild,
  SymbolFlaecheMinus,
  SymbolFlaechePlus,
  SymbolGruppeAufheben,
  SymbolGruppieren,
  SymbolMassband,
  SymbolTextfeld,
  SymbolRaum,
  SymbolTuer,
  SymbolUmriss,
  SymbolVerkaufsflaeche,
  SymbolWand,
  SymbolZeiger,
  SymbolDrehenLinks,
  SymbolDrehenRechts,
  SymbolDuplizieren,
  SymbolEinfuegen,
  SymbolEinpassen,
  SymbolExport,
  SymbolImport,
  SymbolKopieren,
  SymbolLoeschen,
  SymbolMagnet,
  SymbolNeu,
  SymbolOeffnen,
  SymbolRaster,
  SymbolRueckgaengig,
  SymbolSpeichern,
  SymbolWiederholen,
  SymbolZoomMinus,
  SymbolZoomPlus,
} from './Symbole';

/**
 * Die Werkzeugleiste am oberen Rand.
 *
 * Sie enthält keine eigene Logik – jeder Knopf ruft nur eine Aktion aus dem
 * Datenspeicher oder eine der Speicher-Funktionen auf.
 */
export function Werkzeugleiste() {
  const projekt = usePlanStore((s) => s.projekt);
  const auswahl = usePlanStore((s) => s.auswahl);
  const zwischenablage = usePlanStore((s) => s.zwischenablage);
  const kannRueckgaengig = usePlanStore((s) => s.vergangenheit.length > 0);
  const kannWiederholen = usePlanStore((s) => s.zukunft.length > 0);
  const einstellungen = projekt.einstellungen;

  const syncZustand = useSyncStore((s) => s.zustand);
  const werkzeug = usePlanStore((s) => s.werkzeug);
  const linkerReiter = usePlanStore((s) => s.linkerReiter);
  /** Steckt in der Auswahl mindestens ein Regal, das zu einer Gruppe gehört? */
  const auswahlHatGruppe = usePlanStore((s) =>
    s.projekt.elemente.some((el) => s.auswahl.includes(el.id) && el.gruppeId),
  );

  const [dialog, setDialog] = useState<'neu' | 'oeffnen' | 'abgleich' | 'planImport' | null>(null);
  const [meldung, setMeldung] = useState('');
  const dateiRef = useRef<HTMLInputElement>(null);

  const store = () => usePlanStore.getState();
  const hatAuswahl = auswahl.length > 0;

  /** Zeigt kurz einen Hinweis in der Werkzeugleiste an. */
  const melde = (text: string) => {
    setMeldung(text);
    window.setTimeout(() => setMeldung(''), 2200);
  };

  const jetztSpeichern = async () => {
    await speichereProjekt(usePlanStore.getState().projekt);
    melde('Gespeichert');
  };

  const dateiAuswaehlen = () => dateiRef.current?.click();

  const dateiEingelesen = async (datei: File | undefined) => {
    if (!datei) return;
    try {
      const inhalt = await importiereAusJson(datei);
      for (const vorlage of inhalt.eigeneVorlagen) await speichereVorlage(vorlage);
      await speichereProjekt(inhalt.projekt);
      store().setzeProjekt(inhalt.projekt);
      melde('Datei eingelesen');
    } catch (fehler) {
      window.alert(fehler instanceof Error ? fehler.message : 'Die Datei konnte nicht gelesen werden.');
    }
    if (dateiRef.current) dateiRef.current.value = '';
  };

  const zoomen = (faktor: number) => {
    const a = store().ansicht;
    store().setzeAnsicht({ zoom: Math.min(4, Math.max(0.02, a.zoom * faktor)) });
  };

  return (
    <>
      <header className="werkzeugleiste">
        {/* ------------------------------------------------------- Zeile 1 */}
        <div className="werkzeugleiste-zeile">
          <div className="marke">
            <span className="marke-logo">M</span>
            <span className="marke-name">Marktplaner</span>
          </div>

          <input
            className="projektname"
            value={projekt.name}
            title="Name der Marktplanung"
            onFocus={() => store().schnappschuss()}
            onChange={(e) => store().benenneProjektUm(e.target.value)}
          />

          <span className="trenner" />

          <button className="knopf" onClick={() => setDialog('neu')} title="Neue Marktplanung anlegen">
            <SymbolNeu /> Neu
          </button>
          <button className="knopf" onClick={() => setDialog('oeffnen')} title="Gespeicherte Planung öffnen">
            <SymbolOeffnen /> Öffnen
          </button>
          <button className="knopf" onClick={() => void jetztSpeichern()} title="Jetzt speichern (Strg+S)">
            <SymbolSpeichern /> Speichern
          </button>
          <button
            className={`knopf${syncZustand === 'laeuft' ? ' aktiv' : ''}`}
            onClick={() => setDialog('abgleich')}
            title={ABGLEICH_HINWEIS[syncZustand]}
          >
            <SymbolAbgleich /> Abgleich
            {syncZustand === 'fehler' && <span className="punkt-fehler" />}
          </button>

          <span className="trenner" />

          <button
            className="knopf"
            onClick={() => void exportiereAlsJson(projekt)}
            title="Projekt als JSON-Datei sichern – enthält alle Daten"
          >
            <SymbolExport /> JSON
          </button>
          <button className="knopf" onClick={dateiAuswaehlen} title="JSON-Datei einlesen">
            <SymbolImport /> Import
          </button>
          <button
            className="knopf"
            onClick={() => setDialog('planImport')}
            title="Einen bestehenden Marktplan aus einem PDF einlesen"
          >
            <SymbolImport /> Plan-PDF
          </button>
          <button
            className="knopf"
            onClick={() => exportierePng(projekt, store().ansicht)}
            title="Plan als PNG-Bild speichern"
          >
            <SymbolBild /> Bild
          </button>

          <span className="trenner" />

          <button
            className="knopf"
            disabled={!kannRueckgaengig}
            onClick={() => store().rueckgaengig()}
            title="Rückgängig (Strg+Z)"
          >
            <SymbolRueckgaengig /> Rückgängig
          </button>
          <button
            className="knopf"
            disabled={!kannWiederholen}
            onClick={() => store().wiederholen()}
            title="Wiederholen (Strg+Y)"
          >
            <SymbolWiederholen /> Wiederholen
          </button>

          {meldung && (
            <span style={{ marginLeft: 12, color: 'var(--blau)', fontWeight: 600 }}>{meldung}</span>
          )}
        </div>

        {/* ------------------------------------------------------- Zeile 2 */}
        <div className="werkzeugleiste-zeile">
          <button
            className="knopf"
            disabled={!hatAuswahl}
            onClick={() => store().kopiereAuswahl()}
            title="Kopieren (Strg+C)"
          >
            <SymbolKopieren /> Kopieren
          </button>
          <button
            className="knopf"
            disabled={zwischenablage.length === 0}
            onClick={() => store().fuegeEin()}
            title="Einfügen (Strg+V)"
          >
            <SymbolEinfuegen /> Einfügen
          </button>
          <button
            className="knopf"
            disabled={!hatAuswahl}
            onClick={() => store().dupliziereAuswahl()}
            title="Duplizieren (Strg+D)"
          >
            <SymbolDuplizieren /> Duplizieren
          </button>
          <button
            className="knopf knopf-gefahr"
            disabled={!hatAuswahl}
            onClick={() => store().loescheAuswahl()}
            title="Löschen (Entf)"
          >
            <SymbolLoeschen /> Löschen
          </button>

          <span className="trenner" />

          <button
            className="knopf knopf-nur-symbol"
            disabled={!hatAuswahl}
            onClick={() => store().dreheAuswahl(-90)}
            title="90° gegen den Uhrzeigersinn drehen"
          >
            <SymbolDrehenLinks />
          </button>
          <button
            className="knopf knopf-nur-symbol"
            disabled={!hatAuswahl}
            onClick={() => store().dreheAuswahl(90)}
            title="90° im Uhrzeigersinn drehen (R)"
          >
            <SymbolDrehenRechts />
          </button>

          <span className="trenner" />

          <button
            className={`knopf${einstellungen.rasterSichtbar ? ' aktiv' : ''}`}
            onClick={() => store().setzeEinstellung({ rasterSichtbar: !einstellungen.rasterSichtbar })}
            title="Raster ein- oder ausblenden (G)"
          >
            <SymbolRaster /> Raster
          </button>
          <button
            className={`knopf${einstellungen.amRasterEinrasten ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeEinstellung({ amRasterEinrasten: !einstellungen.amRasterEinrasten })
            }
            title="Am Raster einrasten (S)"
          >
            <SymbolMagnet /> Einrasten
          </button>

          <span className="trenner" />

          <button className="knopf knopf-nur-symbol" onClick={() => zoomen(1 / 1.25)} title="Verkleinern">
            <SymbolZoomMinus />
          </button>
          <button
            className="knopf"
            onClick={() => buehneSteuerung.einpassen?.()}
            title="Ganzen Markt anzeigen (Strg+0)"
          >
            <SymbolEinpassen /> Einpassen
          </button>
          <button className="knopf knopf-nur-symbol" onClick={() => zoomen(1.25)} title="Vergrößern">
            <SymbolZoomPlus />
          </button>

          <span className="trenner" />

          <span className="hinweis" style={{ whiteSpace: 'nowrap' }}>
            Leertaste + Ziehen verschiebt die Ansicht · Umschalt + Klick wählt mehrere aus
          </span>
        </div>

        {/* ------------------------------------------- Zeile 3: Grundriss */}
        <div className="werkzeugleiste-zeile">
          <span className="leisten-titel">Ansicht</span>

          {/* Zwei Reiter für die linke Spalte: die Möbel, aus denen der Markt
              besteht, und die Warengruppen, die darin liegen. Beide brauchen
              die ganze Spalte, gleichzeitig braucht man sie nie. */}
          <button
            className={`knopf${linkerReiter === 'bibliothek' ? ' aktiv' : ''}`}
            onClick={() => store().setzeLinkenReiter('bibliothek')}
            title="Die Möbel, aus denen der Markt besteht"
          >
            Möbel
          </button>
          <button
            className={`knopf${linkerReiter === 'warengruppen' ? ' aktiv' : ''}`}
            onClick={() => store().setzeLinkenReiter('warengruppen')}
            title="Abteilungen, Warengruppen und Sortimente – anklicken und im Plan zuordnen"
          >
            Warengruppen
          </button>

          <span className="trenner" />
          <span className="leisten-titel">Grundriss</span>

          <button
            className={`knopf${werkzeug === 'auswahl' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug('auswahl')}
            title="Ganz normal planen: Elemente auswählen und verschieben (Esc)"
          >
            <SymbolZeiger /> Bearbeiten
          </button>
          <button
            className={`knopf${werkzeug === 'umriss' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'umriss' ? 'auswahl' : 'umriss')}
            title="Ecken des Grundrisses ziehen, einfügen und entfernen"
          >
            <SymbolUmriss /> Umriss
          </button>

          <button
            className={`knopf${werkzeug === 'grundrissZeichnen' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'grundrissZeichnen' ? 'auswahl' : 'grundrissZeichnen')
            }
            title="Einen Grundriss frei zeichnen: Ecken setzen, ziehen ergibt einen Bogen"
          >
            <SymbolUmriss /> Frei zeichnen
          </button>
          <button
            className={`knopf${werkzeug === 'flaecheAnfuegen' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'flaecheAnfuegen' ? 'auswahl' : 'flaecheAnfuegen')
            }
            title="Ein Rechteck aufziehen und zur Grundfläche hinzufügen – so entstehen zusammengesetzte Formen"
          >
            <SymbolFlaechePlus /> Fläche anfügen
          </button>
          <button
            className={`knopf${werkzeug === 'flaecheAbziehen' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'flaecheAbziehen' ? 'auswahl' : 'flaecheAbziehen')
            }
            title="Ein Rechteck aus der Grundfläche herausschneiden"
          >
            <SymbolFlaecheMinus /> Fläche abziehen
          </button>

          <span className="trenner" />

          <button
            className={`knopf${werkzeug === 'raum' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'raum' ? 'auswahl' : 'raum')}
            title="Einen Raum abtrennen: Lager, Kühlraum, Sozialraum …"
          >
            <SymbolRaum /> Raum abtrennen
          </button>
          <button
            className={`knopf${werkzeug === 'wand' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'wand' ? 'auswahl' : 'wand')}
            title="Eine einzelne Innenwand ziehen, ohne gleich einen ganzen Raum abzutrennen"
          >
            <SymbolWand /> Innenwand
          </button>
          <button
            className={`knopf${werkzeug === 'oeffnung' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'oeffnung' ? 'auswahl' : 'oeffnung')}
            title="Tür, Durchgang oder Tor in eine Wand setzen – auf die Wand klicken"
          >
            <SymbolTuer /> Tür / Durchgang
          </button>
          <button
            className={`knopf${werkzeug === 'verkaufsflaeche' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'verkaufsflaeche' ? 'auswahl' : 'verkaufsflaeche')
            }
            title="Verkaufsfläche markieren: Ecken setzen, ziehen ergibt einen Bogen, Klick auf den Anfang schließt. Mehrere Teilflächen möglich."
          >
            <SymbolVerkaufsflaeche /> Verkaufsfläche
          </button>

          <span className="trenner" />

          <button
            className={`knopf${werkzeug === 'textfeld' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'textfeld' ? 'auswahl' : 'textfeld')}
            title="Freien Text in den Plan setzen – auf die Stelle klicken, Text danach rechts eintragen"
          >
            <SymbolTextfeld /> Text
          </button>
          <button
            className={`knopf${werkzeug === 'messen' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'messen' ? 'auswahl' : 'messen')}
            title="Abstand zwischen zwei Punkten messen und dauerhaft eintragen (M)"
          >
            <SymbolMassband /> Maß
          </button>

          <span className="trenner" />

          <button
            className="knopf"
            disabled={auswahl.length < 2}
            onClick={() => store().gruppiere('zug')}
            title="Die ausgewählten Regale zu einem Zug zusammenfassen (Strg+G)"
          >
            <SymbolGruppieren /> Gruppieren
          </button>
          <button
            className="knopf"
            disabled={!auswahlHatGruppe}
            onClick={() => store().hebeGruppeAuf()}
            title="Gruppierung wieder auflösen (Strg+Umschalt+G)"
          >
            <SymbolGruppeAufheben /> Lösen
          </button>
          <button
            className="knopf"
            disabled={auswahl.length < 2}
            onClick={() => store().reiheAneinanderAus()}
            title="Die ausgewählten Regale lückenlos aneinanderschieben"
          >
            <SymbolAneinander /> Aneinanderreihen
          </button>

          {werkzeug !== 'auswahl' && (
            <button className="knopf" onClick={() => store().setzeWerkzeug('auswahl')}>
              Fertig
            </button>
          )}
        </div>
      </header>

      {/* Unsichtbares Feld für den Datei-Import */}
      <input
        ref={dateiRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => void dateiEingelesen(e.target.files?.[0])}
      />

      {dialog === 'neu' && <NeuesProjektDialog schliessen={() => setDialog(null)} />}
      {dialog === 'oeffnen' && <ProjekteDialog schliessen={() => setDialog(null)} />}
      {dialog === 'abgleich' && <SyncDialog schliessen={() => setDialog(null)} />}
      {dialog === 'planImport' && <PlanImportDialog schliessen={() => setDialog(null)} />}
    </>
  );
}

/** Was der Knopf „Abgleich" je nach Lage als Mauszeiger-Hinweis zeigt. */
const ABGLEICH_HINWEIS = {
  aus: 'Planungen zwischen mehreren Rechnern abgleichen – noch nicht eingerichtet',
  bereit: 'Abgleich zwischen mehreren Rechnern',
  laeuft: 'Abgleich läuft gerade …',
  fehler: 'Beim letzten Abgleich ist etwas schiefgegangen – hier klicken',
} as const;
