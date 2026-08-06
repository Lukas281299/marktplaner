import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';

import { findeVorlage } from '../../daten/bibliothek';
import { buehneSteuerung } from '../../logik/buehne';
import {
  berechneAbstaende,
  bestimmeEinrastung,
  type Abstandsmass,
  type Hilfslinie,
} from '../../logik/einrasten';
import { runde, ueberschneiden, umgrenzung } from '../../logik/geometrie';
import { formatiereLaenge } from '../../logik/masse';
import { usePlanStore } from '../../zustand/planStore';
import { useStatusStore } from '../../zustand/statusStore';
import { ElementBeschriftung, ElementSymbol } from './ElementSymbol';
import { Gebaeude } from './Gebaeude';
import { Raster } from './Raster';

/** Grenzen für den Zoom: 1 Bildpunkt pro 50 cm bis 4 Bildpunkte pro cm. */
const ZOOM_MIN = 0.02;
const ZOOM_MAX = 4;

/**
 * Die Planungsfläche.
 *
 * Hier passiert alles, was mit der Maus auf dem Plan geschieht:
 * Zoomen, Verschieben der Ansicht, Auswählen, Ziehen, Größe ändern und Drehen.
 * Die Daten selbst werden nie direkt geändert – dafür ruft diese Komponente
 * immer Aktionen aus `planStore` auf.
 */
export function Zeichenflaeche() {
  const projekt = usePlanStore((s) => s.projekt);
  const auswahl = usePlanStore((s) => s.auswahl);
  const ansicht = usePlanStore((s) => s.ansicht);
  const seitenverhaeltnisHalten = usePlanStore((s) => s.seitenverhaeltnisHalten);
  const setzeAnsicht = usePlanStore((s) => s.setzeAnsicht);
  const setzeMaus = useStatusStore((s) => s.setzeMaus);

  const behaelterRef = useRef<HTMLDivElement>(null);
  const buehneRef = useRef<Konva.Stage>(null);
  const trafoRef = useRef<Konva.Transformer>(null);
  /** Alle gezeichneten Element-Objekte, damit die Anfasser sie finden. */
  const knotenRef = useRef(new Map<string, Konva.Shape>());

  /** Startpositionen beim Ziehen – nötig, um mehrere Elemente gemeinsam zu bewegen. */
  const ziehRef = useRef<{ start: Map<string, { x: number; y: number }> } | null>(null);
  /** Läuft gerade ein Verschieben der Ansicht? */
  const schiebeRef = useRef<{ mausX: number; mausY: number; x: number; y: number } | null>(null);
  /** Aufgezogener Auswahlrahmen (in Planmaßen). */
  const rahmenRef = useRef<{ x1: number; y1: number; x2: number; y2: number; shift: boolean } | null>(
    null,
  );
  const leertasteRef = useRef(false);

  const [groesse, setGroesse] = useState({ breite: 900, hoehe: 600 });
  const [hilfslinien, setHilfslinien] = useState<Hilfslinie[]>([]);
  const [abstaende, setAbstaende] = useState<Abstandsmass[]>([]);
  const [auswahlrahmen, setAuswahlrahmen] = useState<{
    x: number;
    y: number;
    breite: number;
    hoehe: number;
  } | null>(null);
  const [zeiger, setZeiger] = useState<'default' | 'grab' | 'grabbing'>('default');
  const [istAblageziel, setIstAblageziel] = useState(false);

  // ------------------------------------------------------ Größe des Bereichs
  useLayoutEffect(() => {
    const behaelter = behaelterRef.current;
    if (!behaelter) return;

    const messen = () => {
      const breite = behaelter.clientWidth;
      const hoehe = behaelter.clientHeight;
      // Nur echte Werte übernehmen. Direkt nach dem Start steht das Layout
      // manchmal noch nicht, dann wäre die Höhe kurzzeitig 0.
      setGroesse((alt) =>
        alt.breite === breite && alt.hoehe === hoehe ? alt : { breite, hoehe },
      );
    };

    messen();
    // Sicherheitsnetz: einmal im nächsten Bilddurchlauf nachmessen, falls die
    // Gestaltung beim ersten Messen noch nicht vollständig geladen war.
    const bild = window.requestAnimationFrame(messen);
    const uhr = window.setTimeout(messen, 200);

    const beobachter = new ResizeObserver(messen);
    beobachter.observe(behaelter);
    window.addEventListener('resize', messen);
    return () => {
      window.cancelAnimationFrame(bild);
      window.clearTimeout(uhr);
      beobachter.disconnect();
      window.removeEventListener('resize', messen);
    };
  }, []);

  // -------------------------------------------------------- Ansicht einpassen
  const einpassen = useCallback(() => {
    const { breite, laenge } = usePlanStore.getState().projekt.grundflaeche;
    // Ohne belastbare Größe der Zeichenfläche lässt sich nichts einpassen.
    if (groesse.breite < 200 || groesse.hoehe < 200 || breite <= 0 || laenge <= 0) return;
    const rand = 90;
    const zoom = Math.min(
      ZOOM_MAX,
      Math.max(
        ZOOM_MIN,
        Math.min((groesse.breite - rand * 2) / breite, (groesse.hoehe - rand * 2) / laenge),
      ),
    );
    setzeAnsicht({
      zoom,
      x: (groesse.breite - breite * zoom) / 2,
      y: (groesse.hoehe - laenge * zoom) / 2,
    });
  }, [groesse, setzeAnsicht]);

  // Werkzeugleiste und Bild-Export brauchen Zugriff auf diese Funktionen.
  useEffect(() => {
    buehneSteuerung.buehne = buehneRef.current;
    buehneSteuerung.einpassen = einpassen;
  }, [einpassen]);

  // Beim Öffnen eines anderen Projekts die Ansicht neu ausrichten.
  // Das geschieht erst, wenn die Zeichenfläche eine brauchbare Größe hat.
  const projektIdRef = useRef('');
  useEffect(() => {
    if (groesse.breite < 200 || groesse.hoehe < 200) return;
    if (projekt.id === projektIdRef.current) return;
    projektIdRef.current = projekt.id;
    einpassen();
  }, [projekt.id, groesse.breite, groesse.hoehe, einpassen]);

  // --------------------------------------------------------- Leertaste (Hand)
  useEffect(() => {
    const runter = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !leertasteRef.current) {
        const ziel = e.target as HTMLElement | null;
        // Nicht eingreifen, während in ein Feld getippt wird.
        if (ziel && /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName)) return;
        e.preventDefault();
        leertasteRef.current = true;
        setZeiger('grab');
      }
    };
    const hoch = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        leertasteRef.current = false;
        setZeiger('default');
      }
    };
    window.addEventListener('keydown', runter);
    window.addEventListener('keyup', hoch);
    return () => {
      window.removeEventListener('keydown', runter);
      window.removeEventListener('keyup', hoch);
    };
  }, []);

  /** Rechnet einen Bildschirmpunkt in Planmaße (cm) um. */
  const planPunkt = useCallback((clientX: number, clientY: number) => {
    const behaelter = behaelterRef.current;
    if (!behaelter) return { x: 0, y: 0 };
    const kasten = behaelter.getBoundingClientRect();
    const a = usePlanStore.getState().ansicht;
    return {
      x: (clientX - kasten.left - a.x) / a.zoom,
      y: (clientY - kasten.top - a.y) / a.zoom,
    };
  }, []);

  // ------------------------------------------------------------------- Zoomen
  const beiRad = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const a = usePlanStore.getState().ansicht;
    const behaelter = behaelterRef.current;
    if (!behaelter) return;
    const kasten = behaelter.getBoundingClientRect();
    const mausX = e.evt.clientX - kasten.left;
    const mausY = e.evt.clientY - kasten.top;

    const faktor = e.evt.deltaY > 0 ? 1 / 1.12 : 1.12;
    const neuerZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, a.zoom * faktor));
    // Der Punkt unter dem Mauszeiger soll an Ort und Stelle bleiben.
    const planX = (mausX - a.x) / a.zoom;
    const planY = (mausY - a.y) / a.zoom;
    setzeAnsicht({
      zoom: neuerZoom,
      x: mausX - planX * neuerZoom,
      y: mausY - planY * neuerZoom,
    });
  };

  // ------------------------------------------- Maustaste auf der Zeichenfläche
  const beiMausTasteBuehne = (e: KonvaEventObject<MouseEvent>) => {
    const buehne = buehneRef.current;
    if (!buehne) return;

    // Mittlere Maustaste oder Leertaste + linke Taste: Ansicht verschieben.
    if (e.evt.button === 1 || (e.evt.button === 0 && leertasteRef.current)) {
      e.evt.preventDefault();
      const a = usePlanStore.getState().ansicht;
      schiebeRef.current = { mausX: e.evt.clientX, mausY: e.evt.clientY, x: a.x, y: a.y };
      setZeiger('grabbing');
      return;
    }
    if (e.evt.button !== 0) return;

    // Klick ins Leere: bisherige Auswahl aufheben und Auswahlrahmen beginnen.
    if (e.target === buehne) {
      const store = usePlanStore.getState();
      if (!e.evt.shiftKey) store.hebeAuswahlAuf();
      const p = planPunkt(e.evt.clientX, e.evt.clientY);
      rahmenRef.current = { x1: p.x, y1: p.y, x2: p.x, y2: p.y, shift: e.evt.shiftKey };
      setAuswahlrahmen({ x: p.x, y: p.y, breite: 0, hoehe: 0 });
    }
  };

  // Maus bewegen und loslassen laufen über das ganze Fenster, damit das Ziehen
  // auch dann sauber endet, wenn die Maus die Zeichenfläche verlässt.
  useEffect(() => {
    const bewegen = (ev: MouseEvent) => {
      // Ansicht verschieben
      const schieben = schiebeRef.current;
      if (schieben) {
        setzeAnsicht({
          x: schieben.x + (ev.clientX - schieben.mausX),
          y: schieben.y + (ev.clientY - schieben.mausY),
        });
        return;
      }
      // Auswahlrahmen aufziehen
      const rahmen = rahmenRef.current;
      if (rahmen) {
        const p = planPunkt(ev.clientX, ev.clientY);
        rahmen.x2 = p.x;
        rahmen.y2 = p.y;
        setAuswahlrahmen({
          x: Math.min(rahmen.x1, rahmen.x2),
          y: Math.min(rahmen.y1, rahmen.y2),
          breite: Math.abs(rahmen.x2 - rahmen.x1),
          hoehe: Math.abs(rahmen.y2 - rahmen.y1),
        });
      }
    };

    const loslassen = () => {
      if (schiebeRef.current) {
        schiebeRef.current = null;
        setZeiger(leertasteRef.current ? 'grab' : 'default');
      }
      const rahmen = rahmenRef.current;
      if (rahmen) {
        rahmenRef.current = null;
        setAuswahlrahmen(null);
        const breite = Math.abs(rahmen.x2 - rahmen.x1);
        const hoehe = Math.abs(rahmen.y2 - rahmen.y1);
        // Ein winziger Rahmen war nur ein Klick – dann nichts auswählen.
        if (breite < 3 && hoehe < 3) return;
        const bereich = {
          links: Math.min(rahmen.x1, rahmen.x2),
          oben: Math.min(rahmen.y1, rahmen.y2),
          rechts: Math.max(rahmen.x1, rahmen.x2),
          unten: Math.max(rahmen.y1, rahmen.y2),
        };
        const store = usePlanStore.getState();
        const offeneEbenen = new Set(
          store.projekt.ebenen.filter((eb) => eb.sichtbar && !eb.gesperrt).map((eb) => eb.id),
        );
        const treffer = store.projekt.elemente
          .filter((el) => offeneEbenen.has(el.ebeneId))
          .filter((el) => ueberschneiden(umgrenzung(el), bereich))
          .map((el) => el.id);
        store.waehleAus(treffer, rahmen.shift ? 'umschalten' : 'ersetzen');
      }
    };

    window.addEventListener('mousemove', bewegen);
    window.addEventListener('mouseup', loslassen);
    return () => {
      window.removeEventListener('mousemove', bewegen);
      window.removeEventListener('mouseup', loslassen);
    };
  }, [planPunkt, setzeAnsicht]);

  // ------------------------------------------------------ Element ausgewählt
  const beiElementMausTaste = (e: KonvaEventObject<MouseEvent>, id: string) => {
    if (e.evt.button !== 0 || leertasteRef.current) return;
    e.cancelBubble = true;
    const store = usePlanStore.getState();
    if (e.evt.shiftKey || e.evt.ctrlKey) {
      store.waehleAus([id], 'umschalten');
    } else if (!store.auswahl.includes(id)) {
      store.waehleAus([id]);
    }
  };

  // ------------------------------------------------------------ Ziehen (Maus)
  const beiZiehStart = (_e: KonvaEventObject<DragEvent>, id: string) => {
    const store = usePlanStore.getState();
    if (!store.auswahl.includes(id)) store.waehleAus([id]);
    store.schnappschuss();
    const aktuell = usePlanStore.getState();
    const start = new Map<string, { x: number; y: number }>();
    for (const el of aktuell.projekt.elemente) {
      if (aktuell.auswahl.includes(el.id) && !el.gesperrt) start.set(el.id, { x: el.x, y: el.y });
    }
    ziehRef.current = { start };
  };

  const beiZiehen = (e: KonvaEventObject<DragEvent>, id: string) => {
    const daten = ziehRef.current;
    if (!daten) return;
    const knoten = e.target as Konva.Shape;
    const store = usePlanStore.getState();
    const element = store.projekt.elemente.find((el) => el.id === id);
    const start = daten.start.get(id);
    if (!element || !start) return;

    // 1. Wunschposition aus der Mausbewegung
    let zielX = knoten.x();
    let zielY = knoten.y();

    // 2. Einrasten an Raster, Wänden und Nachbarn
    const probe = { ...element, x: zielX, y: zielY };
    const rahmen = umgrenzung(probe);
    const andere = store.projekt.elemente.filter((el) => !daten.start.has(el.id));
    const toleranz = 8 / store.ansicht.zoom;
    const ergebnis = bestimmeEinrastung(
      rahmen,
      andere,
      store.projekt.grundflaeche,
      store.projekt.einstellungen,
      toleranz,
    );
    zielX = ergebnis.x;
    zielY = ergebnis.y;
    setHilfslinien(ergebnis.hilfslinien);
    knoten.position({ x: zielX, y: zielY });

    // 3. Die gleiche Verschiebung auf alle ausgewählten Elemente übertragen
    const dx = zielX - start.x;
    const dy = zielY - start.y;
    const neuePositionen = [...daten.start.entries()].map(([elId, pos]) => ({
      id: elId,
      x: runde(pos.x + dx),
      y: runde(pos.y + dy),
    }));
    store.setzePositionen(neuePositionen);

    // 4. Abstände zu Wand und Nachbarn einblenden
    if (store.projekt.einstellungen.masseAnzeigen) {
      setAbstaende(
        berechneAbstaende(
          umgrenzung({ ...element, x: zielX, y: zielY }),
          andere,
          store.projekt.grundflaeche,
        ),
      );
    }
  };

  const beiZiehEnde = () => {
    ziehRef.current = null;
    setHilfslinien([]);
    setAbstaende([]);
  };

  // ------------------------------------------ Anfasser (Größe ändern, Drehen)
  useEffect(() => {
    const trafo = trafoRef.current;
    if (!trafo || ziehRef.current) return;
    const knoten = auswahl
      .map((id) => knotenRef.current.get(id))
      .filter((k): k is Konva.Shape => Boolean(k))
      .filter((k) => {
        const el = projekt.elemente.find((e) => e.id === k.id());
        return el ? !el.gesperrt : false;
      });
    trafo.nodes(knoten);
  }, [auswahl, projekt.elemente]);

  const beiTransformStart = () => {
    usePlanStore.getState().schnappschuss();
  };

  const beiTransformEnde = () => {
    const trafo = trafoRef.current;
    if (!trafo) return;
    const werte = trafo.nodes().map((n) => {
      const knoten = n as Konva.Shape;
      const breite = Math.max(2, Math.abs(knoten.width() * knoten.scaleX()));
      const tiefe = Math.max(2, Math.abs(knoten.height() * knoten.scaleY()));
      knoten.scaleX(1);
      knoten.scaleY(1);
      return {
        id: knoten.id(),
        x: runde(knoten.x()),
        y: runde(knoten.y()),
        breite: runde(breite),
        tiefe: runde(tiefe),
        drehung: Math.round(knoten.rotation() * 10) / 10,
      };
    });
    usePlanStore.getState().setzeGeometrien(werte);
  };

  // ---------------------------------------------------- Ablegen aus der Liste
  const beiDarueber = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!istAblageziel) setIstAblageziel(true);
  };

  const beiAblegen = (e: React.DragEvent) => {
    e.preventDefault();
    setIstAblageziel(false);
    const vorlageId = e.dataTransfer.getData('text/plain');
    if (!vorlageId) return;
    const store = usePlanStore.getState();
    const vorlage = findeVorlage(vorlageId, store.eigeneVorlagen);
    if (!vorlage) return;

    const p = planPunkt(e.clientX, e.clientY);
    let x = p.x;
    let y = p.y;
    // Beim Ablegen gleich sauber am Raster ausrichten.
    if (store.projekt.einstellungen.amRasterEinrasten) {
      const w = store.projekt.einstellungen.rasterWeite;
      x = Math.round((x - vorlage.breite / 2) / w) * w + vorlage.breite / 2;
      y = Math.round((y - vorlage.tiefe / 2) / w) * w + vorlage.tiefe / 2;
    }
    store.fuegeElementHinzu(vorlage, runde(x), runde(y));
  };

  // ------------------------------------------------------- was gezeichnet wird
  const sichtbareEbenen = new Set(projekt.ebenen.filter((e) => e.sichtbar).map((e) => e.id));
  const gesperrteEbenen = new Set(projekt.ebenen.filter((e) => e.gesperrt).map((e) => e.id));
  const sichtbareElemente = projekt.elemente
    .filter((el) => sichtbareEbenen.has(el.ebeneId))
    .sort((a, b) => a.reihenfolge - b.reihenfolge);

  const einheit = projekt.einstellungen.anzeigeEinheit;
  const zoom = ansicht.zoom;

  return (
    <div
      ref={behaelterRef}
      className={`zeichenflaeche${istAblageziel ? ' ablageziel' : ''}`}
      style={{ cursor: zeiger === 'default' ? 'default' : zeiger }}
      onDragOver={beiDarueber}
      onDragLeave={() => setIstAblageziel(false)}
      onDrop={beiAblegen}
      onMouseMove={(e) => setzeMaus(planPunkt(e.clientX, e.clientY))}
      onMouseLeave={() => setzeMaus(null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={buehneRef}
        width={groesse.breite}
        height={groesse.hoehe}
        scaleX={zoom}
        scaleY={zoom}
        x={ansicht.x}
        y={ansicht.y}
        onWheel={beiRad}
        onMouseDown={beiMausTasteBuehne}
      >
        {/* ---------------------------------------------------- Hintergrund */}
        <Layer listening={false}>
          <Gebaeude grundflaeche={projekt.grundflaeche} einheit={einheit} zoom={zoom} />
          {projekt.einstellungen.rasterSichtbar && (
            <Raster
              breite={projekt.grundflaeche.breite}
              laenge={projekt.grundflaeche.laenge}
              weite={projekt.einstellungen.rasterWeite}
              zoom={zoom}
            />
          )}
        </Layer>

        {/* ------------------------------------------------------- Elemente */}
        <Layer>
          {sichtbareElemente.map((el) => (
            <ElementSymbol
              key={el.id}
              element={el}
              ausgewaehlt={auswahl.includes(el.id)}
              ziehbar={!el.gesperrt && !gesperrteEbenen.has(el.ebeneId)}
              zoom={zoom}
              merkeKnoten={(id, knoten) => {
                if (knoten) knotenRef.current.set(id, knoten);
                else knotenRef.current.delete(id);
              }}
              beiMausTaste={beiElementMausTaste}
              beiZiehStart={beiZiehStart}
              beiZiehen={beiZiehen}
              beiZiehEnde={beiZiehEnde}
            />
          ))}
          {sichtbareElemente.map((el) => (
            <ElementBeschriftung key={`text-${el.id}`} element={el} zoom={zoom} />
          ))}
        </Layer>

        {/* -------------------------------------- Anfasser, Hilfslinien, Maße */}
        <Layer>
          <Transformer
            ref={trafoRef}
            keepRatio={seitenverhaeltnisHalten}
            rotateEnabled
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={5}
            borderStroke="#0a84ff"
            borderStrokeWidth={1 / zoom}
            anchorStroke="#0a84ff"
            anchorFill="#ffffff"
            anchorSize={9 / zoom}
            anchorStrokeWidth={1.4 / zoom}
            anchorCornerRadius={2 / zoom}
            rotateAnchorOffset={28 / zoom}
            padding={2 / zoom}
            ignoreStroke
            flipEnabled={false}
            onTransformStart={beiTransformStart}
            onTransformEnd={beiTransformEnde}
            boundBoxFunc={(alt, neu) => {
              // Kleiner als 2 cm ergibt keinen Sinn.
              const min = 2 * zoom;
              if (Math.abs(neu.width) < min || Math.abs(neu.height) < min) return alt;
              return neu;
            }}
          />

          {/* Hilfslinien beim Ausrichten */}
          {hilfslinien.map((linie, i) => (
            <Line
              key={`hilfe-${i}`}
              listening={false}
              points={
                linie.richtung === 'senkrecht'
                  ? [linie.position, linie.von, linie.position, linie.bis]
                  : [linie.von, linie.position, linie.bis, linie.position]
              }
              stroke="#e5484d"
              strokeWidth={1 / zoom}
              dash={[6 / zoom, 4 / zoom]}
            />
          ))}

          {/* Abstände zu Wand und Nachbarn */}
          {abstaende.map((mass, i) => (
            <AbstandsAnzeige key={`mass-${i}`} mass={mass} zoom={zoom} einheit={einheit} />
          ))}

          {/* Aufgezogener Auswahlrahmen */}
          {auswahlrahmen && (
            <Rect
              listening={false}
              x={auswahlrahmen.x}
              y={auswahlrahmen.y}
              width={auswahlrahmen.breite}
              height={auswahlrahmen.hoehe}
              fill="rgba(10,132,255,0.12)"
              stroke="#0a84ff"
              strokeWidth={1 / zoom}
            />
          )}
        </Layer>
      </Stage>

      {projekt.elemente.length === 0 && (
        <div className="leer-hinweis">
          <strong>Noch nichts geplant.</strong>
          <br />
          Ziehe links ein Element auf die Fläche.
          <br />
          Mausrad = Zoomen · Leertaste + Ziehen = Ansicht verschieben
        </div>
      )}

      <div className="zoom-leiste">
        <button
          className="knopf knopf-nur-symbol"
          title="Verkleinern"
          onClick={() =>
            setzeAnsicht({ zoom: Math.max(ZOOM_MIN, usePlanStore.getState().ansicht.zoom / 1.25) })
          }
        >
          −
        </button>
        <button
          className="knopf"
          title="Ansicht einpassen"
          onClick={einpassen}
          style={{ minWidth: 52, justifyContent: 'center' }}
        >
          {Math.round(zoom * 100)} %
        </button>
        <button
          className="knopf knopf-nur-symbol"
          title="Vergrößern"
          onClick={() =>
            setzeAnsicht({ zoom: Math.min(ZOOM_MAX, usePlanStore.getState().ansicht.zoom * 1.25) })
          }
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Eine Maßlinie mit Zahl – wird beim Verschieben eingeblendet. */
function AbstandsAnzeige({
  mass,
  zoom,
  einheit,
}: {
  mass: Abstandsmass;
  zoom: number;
  einheit: 'm' | 'cm';
}) {
  const schrift = 11 / zoom;
  const mitteX = (mass.x1 + mass.x2) / 2;
  const mitteY = (mass.y1 + mass.y2) / 2;
  const waagerecht = Math.abs(mass.x2 - mass.x1) > Math.abs(mass.y2 - mass.y1);
  const text = formatiereLaenge(mass.wert, einheit);

  return (
    <>
      <Line
        listening={false}
        points={[mass.x1, mass.y1, mass.x2, mass.y2]}
        stroke="#0a84ff"
        strokeWidth={1 / zoom}
      />
      {/* Endstriche */}
      <Line
        listening={false}
        points={
          waagerecht
            ? [mass.x1, mass.y1 - 5 / zoom, mass.x1, mass.y1 + 5 / zoom]
            : [mass.x1 - 5 / zoom, mass.y1, mass.x1 + 5 / zoom, mass.y1]
        }
        stroke="#0a84ff"
        strokeWidth={1 / zoom}
      />
      <Line
        listening={false}
        points={
          waagerecht
            ? [mass.x2, mass.y2 - 5 / zoom, mass.x2, mass.y2 + 5 / zoom]
            : [mass.x2 - 5 / zoom, mass.y2, mass.x2 + 5 / zoom, mass.y2]
        }
        stroke="#0a84ff"
        strokeWidth={1 / zoom}
      />
      <Text
        listening={false}
        x={mitteX - 60 / zoom}
        y={mitteY - (waagerecht ? schrift + 3 / zoom : schrift / 2)}
        width={120 / zoom}
        align="center"
        text={text}
        fontSize={schrift}
        fill="#0a5fbf"
      />
    </>
  );
}
