import { lazy, Suspense, useEffect, useRef } from 'react';
import { Assistentenfenster } from './komponenten/Assistentenfenster';
import { Eigenschaftenfenster } from './komponenten/Eigenschaftenfenster';
import { Elementbibliothek } from './komponenten/Elementbibliothek';
import { Warengruppenfenster } from './komponenten/Warengruppenfenster';
import { Spaltengriff, Spaltenstreifen } from './komponenten/Spaltengriffe';
import { Statusleiste } from './komponenten/Statusleiste';
import { Werkzeugleiste } from './komponenten/Werkzeugleiste';
import { Zeichenflaeche } from './komponenten/zeichenflaeche/Zeichenflaeche';

/**
 * Die 3D-Ansicht wird erst geladen, wenn jemand sie aufruft.
 *
 * three.js wiegt so viel wie der Rest der Anwendung zusammen. Wer nur plant,
 * soll das nicht mitladen – deshalb ein eigenes Paket, das erst beim ersten
 * Klick auf „3D" nachkommt.
 */
const Dreidansicht = lazy(() => import('./komponenten/dreid/Dreidansicht'));
import { neuesProjekt } from './daten/standardProjekt';
import { useAbgleich } from './logik/abgleichSteuerung';
import { useTastatur } from './logik/tastatur';
import {
  holeZuletztGeoeffnet,
  ladeProjekt,
  listeVorlagen,
  holeSortimentsliste,
  holeFavoriten,
  holeSpaltenstand,
  holeMoebelkennzahlen,
  merkeZuletztGeoeffnet,
  speichereProjekt,
  speichereSpaltenstand,
} from './speicher/projektArchiv';
import { useAssistentStore } from './zustand/assistentStore';
import { usePlanStore } from './zustand/planStore';

/** Wartezeit, bevor nach einer Änderung automatisch gespeichert wird. */
const SPEICHER_VERZOEGERUNG = 900;

/**
 * Die Anwendung als Ganzes.
 *
 * Aufgaben dieser Datei:
 *  1. beim Start die zuletzt geöffnete Planung laden (oder eine neue anlegen),
 *  2. Änderungen automatisch speichern,
 *  3. den Abgleich mit den anderen Rechnern anstoßen,
 *  4. die vier Bereiche der Oberfläche zusammensetzen.
 */
export default function App() {
  const geladen = usePlanStore((s) => s.geladen);
  const projekt = usePlanStore((s) => s.projekt);
  const geladenerStand = usePlanStore((s) => s.geladenerStand);

  useTastatur();
  useAbgleich();

  // ------------------------------------------------------------ Erster Start
  useEffect(() => {
    let abgebrochen = false;

    const starten = async () => {
      const vorlagen = await listeVorlagen().catch(() => []);
      const favoriten = await holeFavoriten().catch(() => []);
      const spalten = await holeSpaltenstand().catch(() => ({}));
      const kennzahlen = await holeMoebelkennzahlen().catch(() => ({}));
      const sortiment = await holeSortimentsliste().catch(() => null);

      // Die zuletzt geöffnete Planung darf den Start nicht verhindern.
      //
      // Scheitert das Laden – eine beschädigte Datei, ein Umwandlungsschritt,
      // der stolpert –, hing das Programm bisher im Ladezustand fest und man
      // kam an keine seiner Planungen mehr heran. Jetzt fängt es sich mit
      // einer leeren Planung; die alte bleibt liegen und steht weiter unter
      // „Öffnen".
      let gespeichert;
      try {
        const letzteId = await holeZuletztGeoeffnet();
        gespeichert = letzteId ? await ladeProjekt(letzteId) : undefined;
      } catch (fehler) {
        console.error('Marktplaner: Die zuletzt geöffnete Planung ließ sich nicht laden', fehler);
      }
      if (abgebrochen) return;

      usePlanStore.getState().setzeSpaltenstand(spalten);
      usePlanStore.getState().setzeEigeneVorlagen(vorlagen);
      usePlanStore.getState().setzeFavoriten(favoriten);
      usePlanStore.getState().setzeMoebelkennzahlen(kennzahlen);
      if (sortiment) usePlanStore.getState().setzeSortimentsliste(sortiment);
      if (gespeichert) {
        usePlanStore.getState().setzeProjekt(gespeichert);
      } else {
        const frisch = neuesProjekt();
        await speichereProjekt(frisch).catch(() => {});
        usePlanStore.getState().setzeProjekt(frisch);
      }
    };

    void starten();
    return () => {
      abgebrochen = true;
    };
  }, []);

  // ------------------------------------------- Welche Planung ist geöffnet?
  // Getrennt vom Speichern, denn das Öffnen selbst ist keine Änderung –
  // gemerkt werden muss es trotzdem, damit man am anderen Rechner hier
  // weitermachen kann.
  useEffect(() => {
    if (!geladen) return;
    void merkeZuletztGeoeffnet(projekt.id);
  }, [projekt.id, geladen]);

  // -------------------------------------------------- Automatisches Speichern
  const uhrRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!geladen) return;
    // Solange die Planung noch genau das Objekt ist, das geladen wurde, hat
    // niemand etwas angefasst. Ohne diese Prüfung bekäme jede Planung schon
    // beim bloßen Ansehen eine neue Änderungszeit – und der Abgleich hielte
    // sie für bearbeitet, obwohl nichts geschehen ist.
    if (projekt === geladenerStand) return;
    window.clearTimeout(uhrRef.current);
    uhrRef.current = window.setTimeout(() => void speichereProjekt(projekt), SPEICHER_VERZOEGERUNG);
    return () => window.clearTimeout(uhrRef.current);
  }, [projekt, geladenerStand, geladen]);

  // ------------------------------------------- Breite der Seitenleisten merken
  //
  // Verzögert, weil beim Ziehen dreißig Änderungen je Sekunde anfallen und
  // jede einzelne zu schreiben die Datenbank beschäftigt, ohne dass jemand
  // etwas davon hätte.
  const linksOffenJetzt = usePlanStore((s) => s.linkeSpalteOffen);
  const rechtsOffenJetzt = usePlanStore((s) => s.rechteSpalteOffen);
  const breitenJetzt = usePlanStore((s) => s.spaltenbreite);
  useEffect(() => {
    if (!geladen) return;
    const uhr = window.setTimeout(() => {
      void speichereSpaltenstand({
        links: breitenJetzt.links,
        rechts: breitenJetzt.rechts,
        linksOffen: linksOffenJetzt,
        rechtsOffen: rechtsOffenJetzt,
      }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(uhr);
  }, [breitenJetzt, linksOffenJetzt, rechtsOffenJetzt, geladen]);

  const linkerReiter = usePlanStore((s) => s.linkerReiter);

  const ansicht3d = usePlanStore((s) => s.ansicht3d);
  const linksOffen = usePlanStore((s) => s.linkeSpalteOffen);
  const rechtsOffen = usePlanStore((s) => s.rechteSpalteOffen);
  const spaltenbreite = usePlanStore((s) => s.spaltenbreite);
  const assistentOffen = useAssistentStore((s) => s.offen);

  return (
    <div className="app">
      <Werkzeugleiste />
      <div
        className={`arbeitsbereich${assistentOffen ? ' mit-assistent' : ''}${
          rechtsOffen ? '' : ' rechts-zu'
        }${linksOffen ? '' : ' links-zu'}`}
        // Die Breiten stehen als Stilwerte am Raster – so wandert die
        // Trennung mit, ohne dass die Zeichenfläche etwas davon wissen muss.
        style={
          {
            '--spalte-links': `${spaltenbreite.links}px`,
            '--spalte-rechts': `${spaltenbreite.rechts}px`,
          } as React.CSSProperties
        }
      >
        {linksOffen ? (
          linkerReiter === 'warengruppen' ? (
            <Warengruppenfenster />
          ) : (
            <Elementbibliothek />
          )
        ) : (
          <Spaltenstreifen seite="links" />
        )}
        {ansicht3d ? (
          <Suspense fallback={<div className="dreid dreid-laden">3D-Ansicht wird geladen …</div>}>
            <Dreidansicht />
          </Suspense>
        ) : (
          <Zeichenflaeche />
        )}
        <Eigenschaftenfenster />
        {assistentOffen && <Assistentenfenster />}
        {linksOffen && <Spaltengriff seite="links" />}
        {rechtsOffen && !assistentOffen && <Spaltengriff seite="rechts" />}
      </div>
      <Statusleiste />
    </div>
  );
}
