import { useRef, useState } from 'react';
import { exportierePng } from '../logik/bildExport';
import { buehneSteuerung } from '../logik/buehne';
import {
  exportiereAlsJson,
  leseProjektdatei,
  speichereProjekt,
  sichereAlles,
  speichereVorlage,
} from '../speicher/projektArchiv';
import { usePlanStore } from '../zustand/planStore';
import { useSyncStore } from '../zustand/syncStore';
import { NeuesProjektDialog, ProjekteDialog } from './ProjektDialog';
import { PlanImportDialog } from './PlanImportDialog';
import { ExportDialog } from './ExportDialog';
import { SyncDialog } from './SyncDialog';
import { AssistentKnopf } from './Assistentenfenster';
import {
  SymbolAbgleich,
  SymbolAneinander,
  SymbolBild,
  SymbolFlaecheMinus,
  SymbolFlaechePlus,
  SymbolFoerderband,
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

  const [dialog, setDialog] = useState<
    'neu' | 'oeffnen' | 'abgleich' | 'planImport' | 'ausgeben' | null
  >(null);
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

  /**
   * Alle Planungen wegsichern.
   *
   * Was in der Anwendung steht, liegt allein in der Datenbank dieses
   * Browsers. Wer dort die Websitedaten löscht, löscht die Arbeit von
   * Monaten mit – ohne Rückfrage. Deshalb ein eigener Knopf und nicht nur
   * der Einzelexport: Zehn Planungen einzeln zu sichern macht niemand.
   */
  const allesSichern = async () => {
    // Erst den offenen Stand festschreiben, sonst fehlt die letzte Minute.
    await speichereProjekt(usePlanStore.getState().projekt);
    try {
      const { anzahl, ort } = await sichereAlles();
      if (anzahl === 0) return;
      melde(
        anzahl === 1
          ? `Planung gesichert nach ${ort}`
          : `${anzahl} Planungen gesichert nach ${ort}`,
      );
    } catch (fehler) {
      window.alert(fehler instanceof Error ? fehler.message : 'Die Sicherung ist fehlgeschlagen.');
    }
  };

  /**
   * Eingelesene Planungen übernehmen – auch mehrere auf einmal.
   *
   * Wer fünf Märkte übergeben bekommt, will nicht fünfmal denselben Dialog
   * durchklicken. Geöffnet wird am Ende die letzte; die übrigen stehen in
   * der Liste unter „Öffnen“.
   *
   * Eine kaputte Datei hält die anderen nicht auf: Was sich lesen lässt,
   * wird eingelesen, und am Schluss steht, was nicht ging.
   */
  const dateiEingelesen = async (dateien: FileList | null) => {
    const liste = [...(dateien ?? [])];
    if (liste.length === 0) return;

    let gelungen = 0;
    const gescheitert: string[] = [];
    for (const datei of liste) {
      try {
        const inhalt = await leseProjektdatei(datei);
        for (const vorlage of inhalt.eigeneVorlagen) await speichereVorlage(vorlage);
        for (const projekt of inhalt.projekte) {
          await speichereProjekt(projekt);
          store().setzeProjekt(projekt);
          gelungen++;
        }
      } catch (fehler) {
        gescheitert.push(`${datei.name}: ${fehler instanceof Error ? fehler.message : 'nicht lesbar'}`);
      }
    }

    if (gelungen > 0) {
      melde(gelungen === 1 ? 'Datei eingelesen' : `${gelungen} Planungen eingelesen`);
    }
    if (gescheitert.length > 0) window.alert(gescheitert.join('\n'));
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
            <SymbolNeu /> <span className="knopf-text">Neu</span>
          </button>
          <button className="knopf" onClick={() => setDialog('oeffnen')} title="Gespeicherte Planung öffnen">
            <SymbolOeffnen /> <span className="knopf-text">Öffnen</span>
          </button>
          <button className="knopf" onClick={() => void jetztSpeichern()} title="Jetzt speichern (Strg+S)">
            <SymbolSpeichern /> <span className="knopf-text">Speichern</span>
          </button>
          <button
            className="knopf"
            onClick={() => void allesSichern()}
            title="Alle Planungen als Dateien sichern – die einzige Kopie außerhalb dieses Browsers"
          >
            <SymbolExport /> <span className="knopf-text">Sichern</span>
          </button>
          <button
            className={`knopf${syncZustand === 'laeuft' ? ' aktiv' : ''}`}
            onClick={() => setDialog('abgleich')}
            title={ABGLEICH_HINWEIS[syncZustand]}
          >
            <SymbolAbgleich /> <span className="knopf-text">Abgleich</span>
            {syncZustand === 'fehler' && <span className="punkt-fehler" />}
          </button>

          <span className="trenner" />

          <button
            className="knopf"
            onClick={() => void exportiereAlsJson(projekt)}
            title="Projekt als JSON-Datei sichern – enthält alle Daten"
          >
            <SymbolExport /> <span className="knopf-text">JSON</span>
          </button>
          <button className="knopf" onClick={dateiAuswaehlen} title="Projektdateien einlesen – auch mehrere auf einmal">
            <SymbolImport /> <span className="knopf-text">Import</span>
          </button>
          <button
            className="knopf"
            onClick={() => setDialog('planImport')}
            title="Einen bestehenden Marktplan aus einem PDF einlesen"
          >
            <SymbolImport /> <span className="knopf-text">Plan</span>
          </button>
          <button
            className="knopf"
            onClick={() => exportierePng(projekt, store().ansicht)}
            title="Plan als PNG-Bild speichern"
          >
            <SymbolBild /> <span className="knopf-text">Bild</span>
          </button>
          <button
            className="knopf"
            onClick={() => setDialog('ausgeben')}
            title="Plan als PDF zum Drucken oder als SVG für eine andere Webanwendung"
          >
            <SymbolExport /> <span className="knopf-text">Ausgeben</span>
          </button>

          <span className="trenner" />

          <button
            className="knopf"
            disabled={!kannRueckgaengig}
            onClick={() => store().rueckgaengig()}
            title="Rückgängig (Strg+Z)"
          >
            <SymbolRueckgaengig /> <span className="knopf-text">Zurück</span>
          </button>
          <button
            className="knopf"
            disabled={!kannWiederholen}
            onClick={() => store().wiederholen()}
            title="Wiederholen (Strg+Y)"
          >
            <SymbolWiederholen /> <span className="knopf-text">Vor</span>
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
            <SymbolKopieren /> <span className="knopf-text">Kopieren</span>
          </button>
          <button
            className="knopf"
            disabled={zwischenablage.length === 0}
            onClick={() => store().fuegeEin()}
            title="Einfügen (Strg+V)"
          >
            <SymbolEinfuegen /> <span className="knopf-text">Einfügen</span>
          </button>
          <button
            className="knopf"
            disabled={!hatAuswahl}
            onClick={() => store().dupliziereAuswahl()}
            title="Duplizieren (Strg+D)"
          >
            <SymbolDuplizieren /> <span className="knopf-text">Duplizieren</span>
          </button>
          <button
            className="knopf knopf-gefahr"
            disabled={!hatAuswahl}
            onClick={() => store().loescheAuswahl()}
            title="Löschen (Entf)"
          >
            <SymbolLoeschen /> <span className="knopf-text">Löschen</span>
          </button>
          <button
            className="knopf"
            disabled={auswahl.length < 2}
            onClick={() => store().gruppiere('zug')}
            title="Die ausgewählten Regale zu einem Zug zusammenfassen (Strg+G)"
          >
            <SymbolGruppieren /> <span className="knopf-text">Gruppieren</span>
          </button>
          <button
            className="knopf"
            disabled={!auswahlHatGruppe}
            onClick={() => store().hebeGruppeAuf()}
            title="Gruppierung wieder auflösen (Strg+Umschalt+G)"
          >
            <SymbolGruppeAufheben /> <span className="knopf-text">Lösen</span>
          </button>
          <button
            className="knopf"
            disabled={auswahl.length < 2}
            onClick={() => store().reiheAneinanderAus()}
            title="Die ausgewählten Regale lückenlos aneinanderschieben"
          >
            <SymbolAneinander /> <span className="knopf-text">Reihen</span>
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
            <SymbolRaster /> <span className="knopf-text">Raster</span>
          </button>
          <button
            className={`knopf${einstellungen.amRasterEinrasten ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeEinstellung({ amRasterEinrasten: !einstellungen.amRasterEinrasten })
            }
            title="Am Raster einrasten (S)"
          >
            <SymbolMagnet /> <span className="knopf-text">Einrasten</span>
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
            <SymbolEinpassen /> <span className="knopf-text">Einpassen</span>
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
          <AssistentKnopf />

          <span className="trenner" />
          <span className="leisten-titel">Grundriss</span>

          <button
            className={`knopf${werkzeug === 'auswahl' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug('auswahl')}
            title="Ganz normal planen: Elemente auswählen und verschieben (Esc)"
          >
            <SymbolZeiger /> <span className="knopf-text">Bearbeiten</span>
          </button>
          <button
            className={`knopf${werkzeug === 'umriss' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'umriss' ? 'auswahl' : 'umriss')}
            title="Ecken des Grundrisses ziehen, einfügen und entfernen"
          >
            <SymbolUmriss /> <span className="knopf-text">Umriss</span>
          </button>

          <button
            className={`knopf${werkzeug === 'grundrissZeichnen' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'grundrissZeichnen' ? 'auswahl' : 'grundrissZeichnen')
            }
            title="Einen Grundriss frei zeichnen: Ecken setzen, ziehen ergibt einen Bogen"
          >
            <SymbolUmriss /> <span className="knopf-text">Frei</span>
          </button>
          <button
            className={`knopf${werkzeug === 'flaecheAnfuegen' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'flaecheAnfuegen' ? 'auswahl' : 'flaecheAnfuegen')
            }
            title="Ein Rechteck aufziehen und zur Grundfläche hinzufügen – so entstehen zusammengesetzte Formen"
          >
            <SymbolFlaechePlus /> <span className="knopf-text">Anfügen</span>
          </button>
          <button
            className={`knopf${werkzeug === 'flaecheAbziehen' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'flaecheAbziehen' ? 'auswahl' : 'flaecheAbziehen')
            }
            title="Ein Rechteck aus der Grundfläche herausschneiden"
          >
            <SymbolFlaecheMinus /> <span className="knopf-text">Abziehen</span>
          </button>

          <span className="trenner" />

          <button
            className={`knopf${werkzeug === 'raum' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'raum' ? 'auswahl' : 'raum')}
            title="Einen rechteckigen Raum abtrennen: Lager, Kühlraum, Sozialraum …"
          >
            <SymbolRaum /> <span className="knopf-text">Raum</span>
          </button>
          <button
            className={`knopf${werkzeug === 'raumZeichnen' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'raumZeichnen' ? 'auswahl' : 'raumZeichnen')
            }
            title="Einen Raum frei umfahren: Ecke für Ecke klicken, zum Schließen auf die erste"
          >
            <SymbolUmriss /> <span className="knopf-text">Raum frei</span>
          </button>
          <button
            className={`knopf${werkzeug === 'wand' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'wand' ? 'auswahl' : 'wand')}
            title="Wände ziehen – als Strich oder als Rechteck. Sie rasten an vorhandene Wände und Gebäudeecken ein."
          >
            <SymbolWand /> <span className="knopf-text">Wände</span>
          </button>
          <button
            className={`knopf${werkzeug === 'wandZeichnen' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'wandZeichnen' ? 'auswahl' : 'wandZeichnen')
            }
            title="Eine Wand als Fläche umfahren – Ecke für Ecke wie bei einem Raum. Länge und Dicke ergeben sich aus dem Umriss, deshalb sind auch trapezförmige Zwickel möglich."
          >
            <SymbolUmriss /> <span className="knopf-text">Wandfläche</span>
          </button>
          <button
            className={`knopf${werkzeug === 'foerderband' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'foerderband' ? 'auswahl' : 'foerderband')}
            title="Ein Förderband frei führen: Knick für Knick klicken, Enter beendet"
          >
            <SymbolFoerderband /> <span className="knopf-text">Förderband</span>
          </button>
          <button
            className={`knopf${werkzeug === 'oeffnung' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'oeffnung' ? 'auswahl' : 'oeffnung')}
            title="Tür, Durchgang oder Tor in eine Wand setzen – auf die Wand klicken"
          >
            <SymbolTuer /> <span className="knopf-text">Öffnung</span>
          </button>
          <button
            className={`knopf${werkzeug === 'verkaufsflaeche' ? ' aktiv' : ''}`}
            onClick={() =>
              store().setzeWerkzeug(werkzeug === 'verkaufsflaeche' ? 'auswahl' : 'verkaufsflaeche')
            }
            title="Verkaufsfläche markieren: Ecken setzen, ziehen ergibt einen Bogen, Klick auf den Anfang schließt. Mehrere Teilflächen möglich."
          >
            <SymbolVerkaufsflaeche /> <span className="knopf-text">VK-Fläche</span>
          </button>

          <span className="trenner" />

          <button
            className={`knopf${werkzeug === 'textfeld' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'textfeld' ? 'auswahl' : 'textfeld')}
            title="Freien Text in den Plan setzen – auf die Stelle klicken, Text danach rechts eintragen"
          >
            <SymbolTextfeld /> <span className="knopf-text">Text</span>
          </button>
          <button
            className={`knopf${werkzeug === 'messen' ? ' aktiv' : ''}`}
            onClick={() => store().setzeWerkzeug(werkzeug === 'messen' ? 'auswahl' : 'messen')}
            title="Abstand zwischen zwei Punkten messen und dauerhaft eintragen (M)"
          >
            <SymbolMassband /> <span className="knopf-text">Maß</span>
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
        multiple
        style={{ display: 'none' }}
        onChange={(e) => void dateiEingelesen(e.target.files)}
      />

      {dialog === 'neu' && <NeuesProjektDialog schliessen={() => setDialog(null)} />}
      {dialog === 'oeffnen' && <ProjekteDialog schliessen={() => setDialog(null)} />}
      {dialog === 'abgleich' && <SyncDialog schliessen={() => setDialog(null)} />}
      {dialog === 'planImport' && <PlanImportDialog schliessen={() => setDialog(null)} />}
      {dialog === 'ausgeben' && <ExportDialog schliessen={() => setDialog(null)} />}
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
