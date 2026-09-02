import { useEffect, useRef } from 'react';
import { SPALTE_STANDARD, usePlanStore, type Spaltenseite } from '../zustand/planStore';
import { SymbolPfeilLinks, SymbolPfeilRechts } from './Symbole';

/**
 * Die beiden Seitenleisten breiter und schmaler ziehen.
 *
 * Wie eine Spalte in einer Tabelle: An der inneren Kante liegt ein schmaler
 * Streifen, den man greift und verschiebt. Er ist unsichtbar, bis der Zeiger
 * darüber steht – eine ständig sichtbare Leiste wäre ein Strich mehr im Bild,
 * und davon hat ein Plan schon genug.
 *
 * Die Breite hält, bis man sie wieder ändert: Sie liegt neben den Planungen
 * in der Datenbank, nicht darin. Wer die Elementliste breiter zieht, weil er
 * lange Möbelnamen lesen will, findet sie morgen genauso breit wieder.
 */

/** Wie breit der Greifstreifen ist, in Bildpunkten. */
const GRIFF_BREITE = 7;

/**
 * Wie viel vom Fenster einer Leiste höchstens gehört.
 *
 * Der Store begrenzt die Breite absolut; das reicht auf einem großen
 * Bildschirm. Auf einem kleinen nicht: Zwei Leisten zu je 620 Punkten passen
 * in ein Fenster von 1200 – und dann ist vom Plan nichts mehr übrig. Deshalb
 * hört das Ziehen zusätzlich bei einem Drittel des Fensters auf, und für den
 * Plan bleibt immer mindestens ein Drittel.
 */
const ANTEIL_MAX = 0.34;

export function Spaltengriff({ seite }: { seite: Spaltenseite }) {
  const breite = usePlanStore((s) => s.spaltenbreite[seite]);
  const zugRef = useRef<{ start: number; breite: number } | null>(null);

  /*
   * Gezogen wird über das ganze Fenster, nicht über den Streifen.
   *
   * Wer schnell zieht, ist mit dem Zeiger längst neben dem Griff, bevor das
   * nächste Bild steht. Hinge das Ziehen am Streifen, bliebe die Spalte auf
   * halbem Weg stehen.
   */
  useEffect(() => {
    const bewegen = (e: PointerEvent) => {
      const zug = zugRef.current;
      if (!zug) return;
      e.preventDefault();
      // Links wächst die Spalte nach rechts, rechts andersherum.
      const weg = seite === 'links' ? e.clientX - zug.start : zug.start - e.clientX;
      // Nur bei einem Fenster, das diesen Namen verdient. Steht die
      // Anwendung in einem Rahmen, der gerade zusammengeklappt ist, ist
      // `innerWidth` null – und ein Drittel von null würde jede Leiste auf
      // ihr Mindestmaß drücken, ohne dass jemand daran gezogen hätte.
      const grenze = window.innerWidth > 600 ? window.innerWidth * ANTEIL_MAX : Infinity;
      usePlanStore.getState().setzeSpaltenbreite(seite, Math.min(grenze, zug.breite + weg));
    };
    const loslassen = () => {
      if (!zugRef.current) return;
      zugRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', loslassen);
    window.addEventListener('pointercancel', loslassen);
    return () => {
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', loslassen);
      window.removeEventListener('pointercancel', loslassen);
    };
  }, [seite]);

  return (
    <div
      className={`spaltengriff spaltengriff-${seite}`}
      style={seite === 'links' ? { left: breite - GRIFF_BREITE / 2 } : { right: breite - GRIFF_BREITE / 2 }}
      title="Ziehen macht die Leiste breiter oder schmaler · Doppelklick setzt sie zurück"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        zugRef.current = { start: e.clientX, breite };
        // Während des Ziehens überall der Pfeil, und nichts markieren: Sonst
        // schleift man den Text der halben Oberfläche mit.
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
      onDoubleClick={() =>
        usePlanStore
          .getState()
          .setzeSpaltenbreite(seite, SPALTE_STANDARD[seite])
      }
    />
  );
}

/**
 * Der Pfeil im Kopf einer Leiste, der sie zuklappt.
 *
 * Er zeigt nach außen: Man sieht, wohin die Leiste verschwindet.
 */
export function Spaltenschalter({ seite }: { seite: Spaltenseite }) {
  return (
    <button
      className="spalten-schalter"
      title={seite === 'links' ? 'Elementliste ausblenden' : 'Projektleiste ausblenden'}
      onClick={() => usePlanStore.getState().schalteSpalte(seite)}
    >
      {seite === 'links' ? <SymbolPfeilLinks /> : <SymbolPfeilRechts />}
    </button>
  );
}

/**
 * Was von einer zugeklappten Leiste übrig bleibt.
 *
 * Ein schmaler Streifen mit dem Pfeil zurück. Ganz verschwinden darf sie
 * nicht – sonst fände niemand den Weg zurück.
 */
export function Spaltenstreifen({ seite }: { seite: Spaltenseite }) {
  return (
    <aside className={`spalte spalte-${seite} spalte-zu`}>
      <button
        className="spalten-schalter"
        title={seite === 'links' ? 'Elementliste einblenden' : 'Projektleiste einblenden'}
        onClick={() => usePlanStore.getState().schalteSpalte(seite)}
      >
        {seite === 'links' ? <SymbolPfeilRechts /> : <SymbolPfeilLinks />}
      </button>
    </aside>
  );
}
