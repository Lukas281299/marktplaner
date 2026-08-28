import { useEffect, useRef } from 'react';
import { Assistentenfenster } from './komponenten/Assistentenfenster';
import { Eigenschaftenfenster } from './komponenten/Eigenschaftenfenster';
import { Elementbibliothek } from './komponenten/Elementbibliothek';
import { Warengruppenfenster } from './komponenten/Warengruppenfenster';
import { Statusleiste } from './komponenten/Statusleiste';
import { Werkzeugleiste } from './komponenten/Werkzeugleiste';
import { Zeichenflaeche } from './komponenten/zeichenflaeche/Zeichenflaeche';
import { neuesProjekt } from './daten/standardProjekt';
import { useAbgleich } from './logik/abgleichSteuerung';
import { useTastatur } from './logik/tastatur';
import {
  holeZuletztGeoeffnet,
  ladeProjekt,
  listeVorlagen,
  holeSortimentsliste,
  holeFavoriten,
  holeMoebelkennzahlen,
  merkeZuletztGeoeffnet,
  speichereProjekt,
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

  const linkerReiter = usePlanStore((s) => s.linkerReiter);
  const assistentOffen = useAssistentStore((s) => s.offen);

  return (
    <div className="app">
      <Werkzeugleiste />
      <div className={`arbeitsbereich${assistentOffen ? ' mit-assistent' : ''}`}>
        {linkerReiter === 'warengruppen' ? <Warengruppenfenster /> : <Elementbibliothek />}
        <Zeichenflaeche />
        <Eigenschaftenfenster />
        {assistentOffen && <Assistentenfenster />}
      </div>
      <Statusleiste />
    </div>
  );
}
