import { useEffect, useRef } from 'react';
import { Eigenschaftenfenster } from './komponenten/Eigenschaftenfenster';
import { Elementbibliothek } from './komponenten/Elementbibliothek';
import { Statusleiste } from './komponenten/Statusleiste';
import { Werkzeugleiste } from './komponenten/Werkzeugleiste';
import { Zeichenflaeche } from './komponenten/zeichenflaeche/Zeichenflaeche';
import { neuesProjekt } from './daten/standardProjekt';
import { useTastatur } from './logik/tastatur';
import {
  holeZuletztGeoeffnet,
  ladeProjekt,
  listeVorlagen,
  merkeZuletztGeoeffnet,
  speichereProjekt,
} from './speicher/projektArchiv';
import { usePlanStore } from './zustand/planStore';

/** Wartezeit, bevor nach einer Änderung automatisch gespeichert wird. */
const SPEICHER_VERZOEGERUNG = 900;

/**
 * Die Anwendung als Ganzes.
 *
 * Aufgaben dieser Datei:
 *  1. beim Start die zuletzt geöffnete Planung laden (oder eine neue anlegen),
 *  2. Änderungen automatisch speichern,
 *  3. die vier Bereiche der Oberfläche zusammensetzen.
 */
export default function App() {
  const geladen = usePlanStore((s) => s.geladen);
  const projekt = usePlanStore((s) => s.projekt);

  useTastatur();

  // ------------------------------------------------------------ Erster Start
  useEffect(() => {
    let abgebrochen = false;

    const starten = async () => {
      const vorlagen = await listeVorlagen();
      const letzteId = await holeZuletztGeoeffnet();
      const gespeichert = letzteId ? await ladeProjekt(letzteId) : undefined;
      if (abgebrochen) return;

      usePlanStore.getState().setzeEigeneVorlagen(vorlagen);
      if (gespeichert) {
        usePlanStore.getState().setzeProjekt(gespeichert);
      } else {
        const frisch = neuesProjekt();
        await speichereProjekt(frisch);
        usePlanStore.getState().setzeProjekt(frisch);
      }
    };

    void starten();
    return () => {
      abgebrochen = true;
    };
  }, []);

  // -------------------------------------------------- Automatisches Speichern
  const uhrRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!geladen) return;
    window.clearTimeout(uhrRef.current);
    uhrRef.current = window.setTimeout(() => {
      void speichereProjekt(projekt);
      void merkeZuletztGeoeffnet(projekt.id);
    }, SPEICHER_VERZOEGERUNG);
    return () => window.clearTimeout(uhrRef.current);
  }, [projekt, geladen]);

  return (
    <div className="app">
      <Werkzeugleiste />
      <div className="arbeitsbereich">
        <Elementbibliothek />
        <Zeichenflaeche />
        <Eigenschaftenfenster />
      </div>
      <Statusleiste />
    </div>
  );
}
