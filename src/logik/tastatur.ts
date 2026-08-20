import { useEffect } from 'react';
import { buehneSteuerung } from './buehne';
import { speichereProjekt } from '../speicher/projektArchiv';
import { usePlanStore } from '../zustand/planStore';

/**
 * Alle Tastenkombinationen an einer Stelle.
 *
 * Wichtig: Sobald in einem Eingabefeld getippt wird, hält sich diese Funktion
 * komplett heraus – sonst würde z. B. "s" beim Schreiben eines Namens das
 * Einrasten umschalten.
 */
/** Wie weit eine Taste die Ansicht schiebt, in Bildschirmpunkten. */
const SCHRITT = 70;

/**
 * Verschiebt den Ausschnitt.
 *
 * Gerechnet wird in Bildschirmpunkten und nicht in Planmaßen: Ein Druck soll
 * die Ansicht immer gleich weit rücken, egal wie weit hineingezoomt ist.
 * Mit Umschalt geht es in größeren Sprüngen über den Plan.
 */
function schiebeAnsicht(dx: number, dy: number, gross: boolean) {
  const store = usePlanStore.getState();
  const weite = SCHRITT * (gross ? 4 : 1);
  store.setzeAnsicht({
    x: store.ansicht.x + dx * weite,
    y: store.ansicht.y + dy * weite,
  });
}

export function useTastatur(): void {
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName)) return;

      const store = usePlanStore.getState();
      const strg = e.ctrlKey || e.metaKey;

      // ------------------------------------------------ mit Steuerungstaste
      if (strg) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) store.wiederholen();
            else store.rueckgaengig();
            return;
          case 'y':
            e.preventDefault();
            store.wiederholen();
            return;
          case 'c':
            e.preventDefault();
            store.kopiereAuswahl();
            return;
          case 'v':
            e.preventDefault();
            store.fuegeEin();
            return;
          case 'd':
            e.preventDefault();
            store.dupliziereAuswahl();
            return;
          case 'a':
            e.preventDefault();
            store.waehleAlle();
            return;
          case 'g':
            e.preventDefault();
            // Strg+G gruppiert, Strg+Umschalt+G löst wieder auf – so kennt
            // man es aus jedem Zeichenprogramm.
            if (e.shiftKey) store.hebeGruppeAuf();
            else store.gruppiere('zug');
            return;
          case 's':
            e.preventDefault();
            void speichereProjekt(usePlanStore.getState().projekt);
            return;
          case '0':
            e.preventDefault();
            buehneSteuerung.einpassen?.();
            return;
          default:
            return;
        }
      }

      // ------------------------------------------------ ohne Steuerungstaste
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          // Räume, Wände und Öffnungen liegen in einer eigenen Auswahl –
          // sonst löschte Entf hier nichts, obwohl sichtbar etwas markiert ist.
          if (store.sonderauswahl) store.loescheSonderauswahl();
          else store.loescheAuswahl();
          return;
        case 'Escape':
          // Escape ist der Weg zurück ins normale Arbeiten: erst das
          // Zeichenwerkzeug weglegen, dann die Auswahl aufheben.
          if (store.werkzeug !== 'auswahl') store.setzeWerkzeug('auswahl');
          else store.hebeAuswahlAuf();
          return;
        case 'r':
        case 'R':
          store.dreheAuswahl(e.shiftKey ? -90 : 90);
          return;
        case 'g':
        case 'G':
          store.setzeEinstellung({
            rasterSichtbar: !store.projekt.einstellungen.rasterSichtbar,
          });
          return;
        case 'e':
        case 'E':
          // Einrasten lag früher auf S. Das musste weichen, als W A S D zum
          // Bewegen im Plan dazukam – eine Navigationstaste kann nicht
          // nebenbei eine Einstellung umschalten.
          store.setzeEinstellung({
            amRasterEinrasten: !store.projekt.einstellungen.amRasterEinrasten,
          });
          return;
        case 'm':
        case 'M':
          // Das Maßband ein- und wieder ausschalten. Ein zweiter Druck legt
          // es weg, damit man nicht erst Escape suchen muss.
          store.setzeWerkzeug(store.werkzeug === 'messen' ? 'auswahl' : 'messen');
          return;
        // ------------------------------------------------ Im Plan bewegen
        case 'w':
        case 'W':
        case 'a':
        case 'A':
        case 's':
        case 'S':
        case 'd':
        case 'D': {
          e.preventDefault();
          const richtung = e.key.toLowerCase();
          schiebeAnsicht(
            richtung === 'a' ? 1 : richtung === 'd' ? -1 : 0,
            richtung === 'w' ? 1 : richtung === 's' ? -1 : 0,
            e.shiftKey,
          );
          return;
        }

        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          // Ist etwas ausgewählt, verschieben die Pfeiltasten die Auswahl.
          // Ist nichts ausgewählt, gibt es nichts zu verschieben – dann
          // bewegen sie die Ansicht, genau wie W A S D.
          if (store.auswahl.length === 0) {
            e.preventDefault();
            schiebeAnsicht(
              e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0,
              e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0,
              e.shiftKey,
            );
            return;
          }
          e.preventDefault();
          // Ohne Zusatztaste um eine Rasterweite, mit Alt um genau 1 cm,
          // mit Umschalt um das Zehnfache.
          const raster = store.projekt.einstellungen.rasterWeite;
          let schritt = e.altKey ? 1 : raster;
          if (e.shiftKey) schritt *= 10;
          const dx = e.key === 'ArrowLeft' ? -schritt : e.key === 'ArrowRight' ? schritt : 0;
          const dy = e.key === 'ArrowUp' ? -schritt : e.key === 'ArrowDown' ? schritt : 0;
          // Beim Gedrückthalten nicht für jede Wiederholung einen eigenen
          // Rückgängig-Schritt anlegen.
          if (!e.repeat) store.schnappschuss();
          store.verschiebeAuswahl(dx, dy, false);
          return;
        }
        default:
          return;
      }
    };

    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, []);
}
