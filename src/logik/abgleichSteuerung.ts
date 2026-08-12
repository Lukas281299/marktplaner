import { useEffect, useRef } from 'react';
import { neuesProjekt } from '../daten/standardProjekt';
import {
  holeLetztenAbgleich,
  holeSyncZugang,
  ladeProjekt,
  listeProjekte,
  listeVorlagen,
  speichereProjekt,
} from '../speicher/projektArchiv';
import { abgleichen } from '../speicher/syncClient';
import { usePlanStore } from '../zustand/planStore';
import { useSyncStore } from '../zustand/syncStore';

/**
 * Wann von selbst abgeglichen wird.
 *
 * Der Marktplaner soll sich nicht wie ein Programm anfühlen, bei dem man ans
 * Speichern denken muss. Gleichzeitig darf er nicht bei jedem verschobenen
 * Regal ans Netz gehen. Deshalb: einmal beim Start, kurz nachdem Ruhe
 * eingekehrt ist, und wenn das Fenster nach längerer Zeit wieder in den
 * Vordergrund kommt.
 */
const RUHE_BIS_ABGLEICH = 20_000;
const MINDESTABSTAND_BEI_RUECKKEHR = 60_000;

/**
 * Sorgt dafür, dass immer nur ein Abgleich gleichzeitig läuft.
 *
 * Zwei parallele Läufe würden sich gegenseitig die Verzeichnisfassung unter
 * den Füßen wegziehen und sich endlos mit „Zwischenzeitlich geändert"
 * abwechseln.
 */
let laeuftGerade: Promise<void> | null = null;

export interface AbgleichOptionen {
  /**
   * Darf der Abgleich die angezeigte Planung wechseln? Nur beim ersten Lauf
   * nach dem Start sinnvoll – dann ist genau das der Zweck: am zweiten
   * Rechner dort weitermachen, wo man am ersten aufgehört hat.
   */
  darfWechseln?: boolean;
}

/**
 * Führt einen Abgleich durch und bringt die Oberfläche hinterher auf Stand.
 *
 * Gibt es keinen Zugang, passiert schlicht nichts – der Marktplaner
 * funktioniert ohne Synchronisation genauso.
 */
export async function jetztAbgleichen(optionen: AbgleichOptionen = {}): Promise<void> {
  if (laeuftGerade) return laeuftGerade;

  const zugang = useSyncStore.getState().zugang;
  if (!zugang) return;

  const sync = useSyncStore.getState();
  sync.setzeZustand('laeuft', 'Abgleich läuft …');

  laeuftGerade = (async () => {
    try {
      const ergebnis = await abgleichen(zugang);
      await nachbereiten(ergebnis.aktualisiert, ergebnis.entfernt, {
        wechselnZu: optionen.darfWechseln ? ergebnis.zuletztGeoeffnet : undefined,
      });
      useSyncStore.getState().setzeErgebnis(ergebnis);
    } catch (fehler) {
      useSyncStore
        .getState()
        .setzeZustand(
          'fehler',
          fehler instanceof Error ? fehler.message : 'Der Abgleich ist fehlgeschlagen.',
        );
    } finally {
      laeuftGerade = null;
    }
  })();

  return laeuftGerade;
}

/**
 * Bringt die angezeigte Planung nach dem Abgleich in Ordnung.
 *
 * Drei Fälle können die geöffnete Planung betreffen: Sie wurde vom anderen
 * Rechner überschrieben, sie wurde dort gelöscht, oder dort wurde zuletzt an
 * einer anderen gearbeitet. In allen dreien zeigt der Bildschirm sonst einen
 * überholten Stand – und der nächste Tastendruck würde ihn zurückschreiben.
 */
async function nachbereiten(
  aktualisiert: string[],
  entfernt: string[],
  { wechselnZu }: { wechselnZu?: string },
): Promise<void> {
  const store = usePlanStore.getState();
  const aktuelleId = store.projekt.id;

  // Die eigenen Vorlagen können dazugekommen sein.
  store.setzeEigeneVorlagen(await listeVorlagen());

  // ---------------------------------------- die geöffnete Planung ist weg
  if (entfernt.includes(aktuelleId)) {
    const uebrig = await listeProjekte();
    const ersatz = uebrig[0] ? await ladeProjekt(uebrig[0].id) : undefined;
    if (ersatz) {
      usePlanStore.getState().setzeProjekt(ersatz);
    } else {
      const frisch = neuesProjekt();
      await speichereProjekt(frisch);
      usePlanStore.getState().setzeProjekt(frisch);
    }
    return;
  }

  // ------------------------------ woanders wurde zuletzt an etwas anderem
  // gearbeitet – aber nur wechseln, solange hier noch nichts angefasst wurde.
  const unberuehrt = store.projekt === store.geladenerStand;
  if (wechselnZu && wechselnZu !== aktuelleId && unberuehrt) {
    const andere = await ladeProjekt(wechselnZu);
    if (andere) {
      usePlanStore.getState().setzeProjekt(andere);
      return;
    }
  }

  // ------------------------------------- die geöffnete Planung ist neuer
  if (aktualisiert.includes(aktuelleId)) {
    const frisch = await ladeProjekt(aktuelleId);
    if (frisch) usePlanStore.getState().setzeProjekt(frisch);
  }
}

/**
 * Hängt den Abgleich an den Lebenslauf der Anwendung.
 *
 * Wird einmal in `App` aufgerufen.
 */
export function useAbgleich(): void {
  const zugang = useSyncStore((s) => s.zugang);
  const projekt = usePlanStore((s) => s.projekt);
  const geladen = usePlanStore((s) => s.geladen);

  // ----------------------------------------- Zugang beim Start einlesen
  useEffect(() => {
    void (async () => {
      const [gespeichert, letzter] = await Promise.all([holeSyncZugang(), holeLetztenAbgleich()]);
      useSyncStore.getState().setzeLetztenAbgleich(letzter);
      if (gespeichert) useSyncStore.getState().setzeZugang(gespeichert);
    })();
  }, []);

  // ------------------------------------------------ einmal nach dem Start
  const startErledigt = useRef(false);
  useEffect(() => {
    if (!zugang || !geladen || startErledigt.current) return;
    startErledigt.current = true;
    void jetztAbgleichen({ darfWechseln: true });
  }, [zugang, geladen]);

  // --------------------------------------------- nachdem Ruhe eingekehrt ist
  const uhr = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!zugang || !geladen) return;
    window.clearTimeout(uhr.current);
    uhr.current = window.setTimeout(() => void jetztAbgleichen(), RUHE_BIS_ABGLEICH);
    return () => window.clearTimeout(uhr.current);
  }, [projekt, zugang, geladen]);

  // -------------------------------------- wenn das Fenster zurückkommt
  useEffect(() => {
    if (!zugang) return;
    const zurueck = () => {
      if (document.visibilityState !== 'visible') return;
      const her = Date.now() - useSyncStore.getState().letzterAbgleich;
      if (her > MINDESTABSTAND_BEI_RUECKKEHR) void jetztAbgleichen();
    };
    document.addEventListener('visibilitychange', zurueck);
    window.addEventListener('focus', zurueck);
    return () => {
      document.removeEventListener('visibilitychange', zurueck);
      window.removeEventListener('focus', zurueck);
    };
  }, [zugang]);
}
