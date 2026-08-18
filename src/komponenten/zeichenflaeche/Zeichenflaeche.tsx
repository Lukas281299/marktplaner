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
import { mitGruppen, mitgliederVon } from '../../logik/gruppen';
import { formatiereLaenge } from '../../logik/masse';
import { fangePunkt, fangpunkte } from '../../logik/messen';
import { rahmen as umrissRahmen, rechteckAusEcken, vereinige, ziehAb } from '../../logik/polygon';
import { punktEinfuegen, punktEntfernen, punktVerschieben } from '../../logik/umrissBearbeiten';
import { alleWandachsen, fangbereich, findeWand, richteWandAus } from '../../logik/waende';
import type { Punkt } from '../../typen/modell';
import { usePlanStore } from '../../zustand/planStore';
import { useStatusStore } from '../../zustand/statusStore';
import { ElementBeschriftung, ElementSymbol } from './ElementSymbol';
import { Gebaeude } from './Gebaeude';
import { Planvorlage } from './Planvorlage';
import { Masslinien } from './Masslinien';
import { Oeffnungen } from './Oeffnungen';
import { Raeume } from './Raeume';
import { Raster } from './Raster';
import { UmrissBearbeitung } from './UmrissBearbeitung';
import { Waende } from './Waende';

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
  const sonderauswahl = usePlanStore((s) => s.sonderauswahl);
  const werkzeug = usePlanStore((s) => s.werkzeug);
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
  /** Kurze Rückmeldung beim Umformen des Grundrisses. */
  const [meldung, setMeldung] = useState('');
  /** Vorschau beim Ziehen einer Innenwand – ein Rechteck passt hier nicht. */
  const [wandZug, setWandZug] = useState<{ von: Punkt; bis: Punkt } | null>(null);

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
    const bereich = umrissRahmen(usePlanStore.getState().projekt.grundflaeche.umriss);
    const breite = bereich.rechts - bereich.links;
    const laenge = bereich.unten - bereich.oben;
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
      // Der Umriss muss nicht bei 0/0 anfangen – nach dem Umformen kann er
      // überall liegen. Deshalb wird seine Umgrenzung mit eingerechnet.
      x: (groesse.breite - breite * zoom) / 2 - bereich.links * zoom,
      y: (groesse.hoehe - laenge * zoom) / 2 - bereich.oben * zoom,
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

  /**
   * Rastet einen Punkt am Raster ein – für alles, was am Grundriss gezeichnet
   * wird. Ohne das kämen krumme Wandmaße wie 12,37 m heraus.
   */
  const aufRaster = useCallback((p: Punkt): Punkt => {
    const { einstellungen } = usePlanStore.getState().projekt;
    if (!einstellungen.amRasterEinrasten) return { x: runde(p.x), y: runde(p.y) };
    const w = einstellungen.rasterWeite;
    return { x: Math.round(p.x / w) * w, y: Math.round(p.y / w) * w };
  }, []);

  /** Zeigt kurz eine Rückmeldung über der Zeichenfläche an. */
  const melde = useCallback((text: string) => {
    setMeldung(text);
    window.setTimeout(() => setMeldung((alt) => (alt === text ? '' : alt)), 6000);
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

    const store = usePlanStore.getState();

    // Beim Zeichnen am Grundriss wird immer aufgezogen – auch wenn die Maus
    // dabei über einem Regal startet.
    if (store.werkzeug !== 'auswahl' && store.werkzeug !== 'umriss') {
      const roh = planPunkt(e.evt.clientX, e.evt.clientY);
      // Beim Messen nicht aufs Raster ziehen – dort rastet es an Regalecken
      // ein, und ein vorheriger Rastersprung würde die Ecke verfehlen.
      const p = store.werkzeug === 'messen' ? roh : aufRaster(roh);
      rahmenRef.current = { x1: p.x, y1: p.y, x2: p.x, y2: p.y, shift: false };
      setAuswahlrahmen({ x: p.x, y: p.y, breite: 0, hoehe: 0 });
      return;
    }

    // Klick ins Leere: bisherige Auswahl aufheben und Auswahlrahmen beginnen.
    if (e.target === buehne) {
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
      // Auswahlrahmen bzw. Fläche aufziehen
      const rahmen = rahmenRef.current;
      if (rahmen) {
        const roh = planPunkt(ev.clientX, ev.clientY);
        const werkzeugRoh = usePlanStore.getState().werkzeug;
        const p =
          werkzeugRoh === 'auswahl' || werkzeugRoh === 'messen' ? roh : aufRaster(roh);
        rahmen.x2 = p.x;
        rahmen.y2 = p.y;
        const werkzeugJetzt = usePlanStore.getState().werkzeug;
        if (werkzeugJetzt === 'wand') {
          const von = { x: rahmen.x1, y: rahmen.y1 };
          setWandZug({ von, bis: richteWandAus(von, p) });
        } else if (werkzeugJetzt === 'messen') {
          // Beim Messen zeigt die Vorschau die Strecke selbst, nicht ein
          // Rechteck – und rastet dabei schon an den Ecken ein.
          const store = usePlanStore.getState();
          const kandidaten = fangpunkte(store.projekt);
          const toleranz = 18 / store.ansicht.zoom;
          setWandZug({
            von: fangePunkt({ x: rahmen.x1, y: rahmen.y1 }, kandidaten, toleranz),
            bis: fangePunkt(p, kandidaten, toleranz),
          });
        } else {
          setAuswahlrahmen({
            x: Math.min(rahmen.x1, rahmen.x2),
            y: Math.min(rahmen.y1, rahmen.y2),
            breite: Math.abs(rahmen.x2 - rahmen.x1),
            hoehe: Math.abs(rahmen.y2 - rahmen.y1),
          });
        }
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
        setWandZug(null);
        const breite = Math.abs(rahmen.x2 - rahmen.x1);
        const hoehe = Math.abs(rahmen.y2 - rahmen.y1);

        // ------------------------------------------- Werkzeuge am Grundriss
        const store0 = usePlanStore.getState();
        if (store0.werkzeug !== 'auswahl' && store0.werkzeug !== 'umriss') {
          const anfang = { x: rahmen.x1, y: rahmen.y1 };
          const ende = { x: rahmen.x2, y: rahmen.y2 };

          // ------------------------------------------------------ Öffnung
          // Ein Klick, kein Aufziehen: Die Öffnung setzt sich selbst in die
          // Wand, die darunter liegt – mit deren Richtung und Stärke.
          if (store0.werkzeug === 'oeffnung') {
            const zoomJetzt = store0.ansicht.zoom;
            const achsen = alleWandachsen(
              store0.projekt.grundflaeche,
              store0.projekt.raeume,
              store0.projekt.waende,
            );
            const treffer = findeWand(anfang, achsen, fangbereich(zoomJetzt));
            if (!treffer) {
              melde('Dort ist keine Wand. Eine Öffnung wird auf eine Wand gesetzt – auf die Außenwand, eine Raumwand oder eine Innenwand.');
              return;
            }
            store0.fuegeOeffnungHinzu({
              art: 'tuer',
              x: treffer.punkt.x,
              y: treffer.punkt.y,
              breite: 100,
              tiefe: treffer.staerke,
              drehung: treffer.winkel,
              gespiegelt: false,
            });
            return;
          }

          // ------------------------------------------------------- Maßband
          if (store0.werkzeug === 'messen') {
            const kandidaten = fangpunkte(store0.projekt);
            const toleranz = 18 / store0.ansicht.zoom;
            const a = fangePunkt(anfang, kandidaten, toleranz);
            const b = fangePunkt(ende, kandidaten, toleranz);
            if (Math.hypot(b.x - a.x, b.y - a.y) < 10) return;
            store0.fuegeMasslinieHinzu(a, b);
            return;
          }

          // --------------------------------------------------- Innenwand
          if (store0.werkzeug === 'wand') {
            const ausgerichtet = richteWandAus(anfang, ende);
            const laenge = Math.hypot(ausgerichtet.x - anfang.x, ausgerichtet.y - anfang.y);
            // Unter einem halben Meter war es ein verrutschter Klick.
            if (laenge < 50) return;
            store0.fuegeWandHinzu(anfang, ausgerichtet);
            return;
          }

          // ------------------------------------ Flächen und Räume
          if (breite < 50 || hoehe < 50) return;
          const gezogen = rechteckAusEcken(anfang, ende);

          if (store0.werkzeug === 'raum') {
            store0.fuegeRaumHinzu(gezogen);
            return;
          }

          const umriss = store0.projekt.grundflaeche.umriss;
          const ergebnis =
            store0.werkzeug === 'flaecheAnfuegen'
              ? vereinige(umriss, gezogen)
              : ziehAb(umriss, gezogen);

          if (ergebnis.umriss.length >= 3) store0.setzeUmriss(ergebnis.umriss);
          if (ergebnis.hinweis) melde(ergebnis.hinweis);
          return;
        }

        // ------------------------------------------------------ Auswahlrahmen
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
        // Wer einen Rahmen über eine halbe Gondel zieht, meint die Gondel.
        store.waehleAus(
          mitGruppen(store.projekt.elemente, treffer),
          rahmen.shift ? 'umschalten' : 'ersetzen',
        );
      }
    };

    window.addEventListener('mousemove', bewegen);
    window.addEventListener('mouseup', loslassen);
    return () => {
      window.removeEventListener('mousemove', bewegen);
      window.removeEventListener('mouseup', loslassen);
    };
  }, [planPunkt, setzeAnsicht, aufRaster, melde]);

  // --------------------------------------------------- Umriss umformen
  const umriss = projekt.grundflaeche.umriss;

  const punktZiehen = (index: number, punkt: Punkt) => {
    // Ohne Historie: Sonst läge nach einem einzigen Ziehen ein Dutzend
    // Zwischenschritte in "Rückgängig".
    const neu = punktVerschieben(umriss, index, punkt);
    usePlanStore.setState((s) => ({
      projekt: { ...s.projekt, grundflaeche: { ...s.projekt.grundflaeche, umriss: neu } },
    }));
  };

  const eckeEinfuegen = (nachIndex: number, punkt: Punkt) => {
    usePlanStore.getState().setzeUmriss(punktEinfuegen(umriss, nachIndex, punkt));
  };

  const eckeEntfernen = (index: number) => {
    const neu = punktEntfernen(umriss, index);
    if (!neu) {
      melde('Ein Grundriss braucht mindestens drei Ecken.');
      return;
    }
    usePlanStore.getState().setzeUmriss(neu);
  };

  // ------------------------------------------------------- Raum verschieben
  const raumZugRef = useRef<{ id: string; letztesX: number; letztesY: number } | null>(null);

  const raumZiehStart = (id: string) => {
    usePlanStore.getState().schnappschuss();
    raumZugRef.current = { id, letztesX: 0, letztesY: 0 };
  };

  const raumZiehen = (id: string, x: number, y: number) => {
    const zug = raumZugRef.current;
    if (!zug || zug.id !== id) return;
    // Konva liefert die Gesamtverschiebung der Gruppe; gebraucht wird der
    // Zuwachs seit dem letzten Aufruf, weil die Punkte selbst mitwandern.
    usePlanStore.getState().verschiebeRaum(id, x - zug.letztesX, y - zug.letztesY);
    zug.letztesX = x;
    zug.letztesY = y;
  };

  const raumZiehEnde = () => {
    const zug = raumZugRef.current;
    raumZugRef.current = null;
    if (!zug) return;
    // Zum Schluss sauber aufs Raster setzen.
    const store = usePlanStore.getState();
    const raum = store.projekt.raeume.find((r) => r.id === zug.id);
    if (!raum || raum.umriss.length === 0) return;
    const ecke = raum.umriss[0];
    const ziel = aufRaster(ecke);
    store.verschiebeRaum(zug.id, ziel.x - ecke.x, ziel.y - ecke.y);
  };

  // -------------------------------------------------------- Wand verschieben
  const wandZugRef = useRef<{ id: string; letztesX: number; letztesY: number } | null>(null);

  const wandZiehStart = (id: string) => {
    usePlanStore.getState().schnappschuss();
    wandZugRef.current = { id, letztesX: 0, letztesY: 0 };
  };

  const wandZiehen = (id: string, x: number, y: number) => {
    const zug = wandZugRef.current;
    if (!zug || zug.id !== id) return;
    usePlanStore.getState().verschiebeWand(id, x - zug.letztesX, y - zug.letztesY);
    zug.letztesX = x;
    zug.letztesY = y;
  };

  const wandZiehEnde = () => {
    const zug = wandZugRef.current;
    wandZugRef.current = null;
    if (!zug) return;
    const store = usePlanStore.getState();
    const wand = store.projekt.waende.find((w) => w.id === zug.id);
    if (!wand) return;
    const ziel = aufRaster(wand.von);
    store.verschiebeWand(zug.id, ziel.x - wand.von.x, ziel.y - wand.von.y);
  };

  // ---------------------------------------------------- Maßlinie verschieben
  const massZugRef = useRef({ letztesX: 0, letztesY: 0 });

  const massZiehen = (id: string, x: number, y: number) => {
    const store = usePlanStore.getState();
    const mass = store.projekt.masslinien.find((m) => m.id === id);
    if (!mass) return;
    const dx = x - massZugRef.current.letztesX;
    const dy = y - massZugRef.current.letztesY;
    massZugRef.current = { letztesX: x, letztesY: y };
    store.aendereMasslinie(
      id,
      {
        von: { x: mass.von.x + dx, y: mass.von.y + dy },
        bis: { x: mass.bis.x + dx, y: mass.bis.y + dy },
      },
      false,
    );
  };

  const massZiehEnde = () => {
    massZugRef.current = { letztesX: 0, letztesY: 0 };
  };

  // ----------------------------------------------------- Öffnung verschieben
  const oeffnungZiehStart = () => usePlanStore.getState().schnappschuss();

  const oeffnungZiehen = (id: string, x: number, y: number) => {
    usePlanStore.getState().aendereOeffnung(id, { x, y }, false);
  };

  /**
   * Nach dem Verschieben rastet die Öffnung wieder in einer Wand ein.
   *
   * Das ist der Grund, warum sich eine Tür problemlos an eine andere Wand
   * ziehen lässt: Sie übernimmt dort Richtung und Wandstärke von selbst.
   * Findet sich keine Wand, bleibt sie einfach liegen, wo sie ist.
   */
  const oeffnungZiehEnde = (id: string) => {
    const store = usePlanStore.getState();
    const oeffnung = store.projekt.oeffnungen.find((o) => o.id === id);
    if (!oeffnung) return;
    const achsen = alleWandachsen(
      store.projekt.grundflaeche,
      store.projekt.raeume,
      store.projekt.waende,
    );
    const treffer = findeWand({ x: oeffnung.x, y: oeffnung.y }, achsen, fangbereich(store.ansicht.zoom));
    if (!treffer) return;
    store.aendereOeffnung(id, {
      x: treffer.punkt.x,
      y: treffer.punkt.y,
      drehung: treffer.winkel,
      tiefe: treffer.staerke,
    });
  };

  // ------------------------------------------------------ Element ausgewählt
  const beiElementMausTaste = (e: KonvaEventObject<MouseEvent>, id: string) => {
    if (e.evt.button !== 0 || leertasteRef.current) return;
    e.cancelBubble = true;
    const store = usePlanStore.getState();
    // Ein Klick nimmt die ganze Gruppe – wer eine Gondel anfasst, will sie im
    // Ganzen schieben. Mit Alt greift man ein einzelnes Feld heraus.
    const ids = e.evt.altKey ? [id] : mitgliederVon(store.projekt.elemente, id);

    if (e.evt.shiftKey || e.evt.ctrlKey) {
      store.waehleAus(ids, 'umschalten');
    } else if (!ids.every((k) => store.auswahl.includes(k))) {
      store.waehleAus(ids);
    }
  };

  // ------------------------------------------------------------ Ziehen (Maus)
  const beiZiehStart = (_e: KonvaEventObject<DragEvent>, id: string) => {
    const store = usePlanStore.getState();
    if (!store.auswahl.includes(id)) {
      store.waehleAus(mitgliederVon(store.projekt.elemente, id));
    }
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

  // Räume hängen an der Ebene "Räume" – sie lassen sich damit ausblenden
  // und sperren wie alles andere auch.
  const raeumeSichtbar = sichtbareEbenen.has('raeume');
  const raeumeGesperrt = gesperrteEbenen.has('raeume');
  // Innenwände und Öffnungen gehören zum Gebäude.
  const gebaeudeSichtbar = sichtbareEbenen.has('gebaeude');
  const gebaeudeGesperrt = gesperrteEbenen.has('gebaeude');

  const einheit = projekt.einstellungen.anzeigeEinheit;
  const zoom = ansicht.zoom;

  return (
    <div
      ref={behaelterRef}
      className={`zeichenflaeche${istAblageziel ? ' ablageziel' : ''}`}
      style={{
        cursor:
          zeiger !== 'default'
            ? zeiger
            : werkzeug === 'flaecheAnfuegen' || werkzeug === 'flaecheAbziehen' || werkzeug === 'raum'
              ? 'crosshair'
              : 'default',
      }}
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
          {/* Die eingelesene Vorlage liegt unter allem – auch unter dem
              Raster, damit dessen Linien darauf lesbar bleiben. */}
          {projekt.hintergrund && <Planvorlage hintergrund={projekt.hintergrund} />}
          <Gebaeude grundflaeche={projekt.grundflaeche} einheit={einheit} zoom={zoom} />
          {projekt.einstellungen.rasterSichtbar && (
            <Raster
              bereich={umrissRahmen(umriss)}
              weite={projekt.einstellungen.rasterWeite}
              zoom={zoom}
            />
          )}
        </Layer>

        {/* --------------------------------------------------------- Räume */}
        {/* Zwischen Gebäude und Einrichtung: Die Regale sollen im Raum
            stehen können, der Raum aber den Boden abdecken. */}
        <Layer listening={raeumeSichtbar && werkzeug === 'auswahl'}>
          {raeumeSichtbar && (
            <Raeume
              raeume={projekt.raeume}
              ausgewaehlt={sonderauswahl?.art === 'raum' ? sonderauswahl.id : null}
              zoom={zoom}
              anklickbar={werkzeug === 'auswahl' && !raeumeGesperrt}
              beiKlick={(id) => usePlanStore.getState().waehleSonder({ art: 'raum', id })}
              beiZiehStart={raumZiehStart}
              beiZiehen={raumZiehen}
              beiZiehEnde={raumZiehEnde}
            />
          )}
        </Layer>

        {/* ------------------------------------------- Wände und Öffnungen */}
        {/* Die Öffnungen liegen über allem, was Wand ist – nur so können sie
            Außenwand, Raumwand und Innenwand gleichermaßen unterbrechen. */}
        <Layer listening={gebaeudeSichtbar && werkzeug === 'auswahl'}>
          {gebaeudeSichtbar && (
            <>
              <Waende
                waende={projekt.waende}
                ausgewaehlt={sonderauswahl?.art === 'wand' ? sonderauswahl.id : null}
                zoom={zoom}
                anklickbar={werkzeug === 'auswahl' && !gebaeudeGesperrt}
                beiKlick={(id) => usePlanStore.getState().waehleSonder({ art: 'wand', id })}
                beiZiehStart={wandZiehStart}
                beiZiehen={wandZiehen}
                beiZiehEnde={wandZiehEnde}
              />
              <Oeffnungen
                oeffnungen={projekt.oeffnungen}
                ausgewaehlt={sonderauswahl?.art === 'oeffnung' ? sonderauswahl.id : null}
                zoom={zoom}
                anklickbar={werkzeug === 'auswahl' && !gebaeudeGesperrt}
                bodenfarbe="#fbfbfa"
                beiKlick={(id) => usePlanStore.getState().waehleSonder({ art: 'oeffnung', id })}
                beiZiehStart={oeffnungZiehStart}
                beiZiehen={oeffnungZiehen}
                beiZiehEnde={oeffnungZiehEnde}
              />
            </>
          )}
        </Layer>

        {/* ------------------------------------------------------- Elemente */}
        {/* Solange am Grundriss gearbeitet wird, sind die Regale nicht
            anklickbar – sonst erwischt man sie beim Aufziehen einer Fläche. */}
        <Layer listening={werkzeug === 'auswahl'}>
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

        {/* ------------------------------------------------------ Maßlinien */}
        {/* Über den Elementen: Ein Maß, das hinter einem Regal verschwindet,
            ist nutzlos. */}
        <Layer listening={werkzeug === 'auswahl'}>
          <Masslinien
            masslinien={projekt.masslinien}
            ausgewaehlt={sonderauswahl?.art === 'masslinie' ? sonderauswahl.id : null}
            einheit={einheit}
            zoom={zoom}
            anklickbar={werkzeug === 'auswahl'}
            beiKlick={(id) => usePlanStore.getState().waehleSonder({ art: 'masslinie', id })}
            beiZiehStart={() => usePlanStore.getState().schnappschuss()}
            beiZiehen={massZiehen}
            beiZiehEnde={massZiehEnde}
          />
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

          {/* Anfasser zum Umformen des Grundrisses */}
          {werkzeug === 'umriss' && (
            <UmrissBearbeitung
              umriss={umriss}
              zoom={zoom}
              einrasten={aufRaster}
              beiZiehStart={() => usePlanStore.getState().schnappschuss()}
              beiPunktZiehen={punktZiehen}
              beiZiehEnde={() => usePlanStore.getState().setzeUmriss(umriss)}
              beiPunktEinfuegen={eckeEinfuegen}
              beiPunktEntfernen={eckeEntfernen}
            />
          )}

          {/* Vorschau der Innenwand bzw. des Maßes, das gerade gezogen wird */}
          {wandZug && (
            <>
              <Line
                listening={false}
                points={[wandZug.von.x, wandZug.von.y, wandZug.bis.x, wandZug.bis.y]}
                stroke={werkzeug === 'messen' ? '#2f3b49' : '#66707c'}
                strokeWidth={werkzeug === 'messen' ? 1.4 / zoom : 12}
                lineCap="butt"
                opacity={werkzeug === 'messen' ? 1 : 0.6}
              />
              <Text
                listening={false}
                x={(wandZug.von.x + wandZug.bis.x) / 2 - 100 / zoom}
                y={(wandZug.von.y + wandZug.bis.y) / 2 - 26 / zoom}
                width={200 / zoom}
                align="center"
                text={formatiereLaenge(
                  Math.hypot(wandZug.bis.x - wandZug.von.x, wandZug.bis.y - wandZug.von.y),
                  einheit,
                )}
                fontSize={13 / zoom}
                fill="#0a5fbf"
              />
            </>
          )}

          {/* Aufgezogener Rahmen – Farbe je nachdem, was er bewirkt */}
          {auswahlrahmen && (
            <Rect
              listening={false}
              x={auswahlrahmen.x}
              y={auswahlrahmen.y}
              width={auswahlrahmen.breite}
              height={auswahlrahmen.hoehe}
              fill={RAHMENFARBEN[werkzeug].fuellung}
              stroke={RAHMENFARBEN[werkzeug].linie}
              strokeWidth={1.5 / zoom}
              dash={werkzeug === 'auswahl' ? undefined : [10 / zoom, 6 / zoom]}
            />
          )}
        </Layer>
      </Stage>

      {projekt.elemente.length === 0 && werkzeug === 'auswahl' && (
        <div className="leer-hinweis">
          <strong>Noch nichts geplant.</strong>
          <br />
          Ziehe links ein Element auf die Fläche.
          <br />
          Mausrad = Zoomen · Leertaste + Ziehen = Ansicht verschieben
        </div>
      )}

      {/* Was das gerade gewählte Werkzeug tut */}
      {werkzeug !== 'auswahl' && (
        <div className="werkzeug-fahne">
          <strong>{WERKZEUG_TEXT[werkzeug].titel}</strong>
          {WERKZEUG_TEXT[werkzeug].hinweis}
        </div>
      )}

      {/* Rückmeldung, wenn beim Umformen etwas nicht ging */}
      {meldung && (
        <div className="zeichen-meldung" onClick={() => setMeldung('')}>
          {meldung}
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

/** Die Farbe des aufgezogenen Rahmens sagt, was gleich passiert. */
const RAHMENFARBEN: Record<string, { fuellung: string; linie: string }> = {
  auswahl: { fuellung: 'rgba(10,132,255,0.12)', linie: '#0a84ff' },
  umriss: { fuellung: 'rgba(10,132,255,0.12)', linie: '#0a84ff' },
  flaecheAnfuegen: { fuellung: 'rgba(46,160,67,0.16)', linie: '#2ea043' },
  flaecheAbziehen: { fuellung: 'rgba(229,72,77,0.14)', linie: '#e5484d' },
  raum: { fuellung: 'rgba(140,120,200,0.16)', linie: '#7b6bc4' },
  wand: { fuellung: 'transparent', linie: '#66707c' },
  oeffnung: { fuellung: 'transparent', linie: '#66707c' },
  messen: { fuellung: 'transparent', linie: '#2f3b49' },
};

/** Kurze Anleitung zum jeweils gewählten Werkzeug. */
const WERKZEUG_TEXT: Record<string, { titel: string; hinweis: string }> = {
  umriss: {
    titel: 'Umriss bearbeiten',
    hinweis:
      'Blaue Ecken ziehen · kleine Kreise auf den Wänden anklicken setzt eine neue Ecke · Doppelklick auf eine Ecke entfernt sie',
  },
  flaecheAnfuegen: {
    titel: 'Fläche anfügen',
    hinweis: 'Rechteck aufziehen – es wird zur Grundfläche hinzugerechnet',
  },
  flaecheAbziehen: {
    titel: 'Fläche abziehen',
    hinweis: 'Rechteck aufziehen – dieser Bereich wird aus der Grundfläche herausgeschnitten',
  },
  raum: {
    titel: 'Raum abtrennen',
    hinweis: 'Rechteck aufziehen – Art und Name danach rechts einstellen',
  },
  wand: {
    titel: 'Innenwand ziehen',
    hinweis:
      'Von einem Punkt zum anderen ziehen. Fast waagerechte und fast senkrechte Wände werden gerade gezogen.',
  },
  oeffnung: {
    titel: 'Tür oder Durchgang setzen',
    hinweis:
      'Auf eine Wand klicken – die Öffnung übernimmt Richtung und Wandstärke von selbst. Art und Breite danach rechts einstellen.',
  },
  messen: {
    titel: 'Maß eintragen',
    hinweis:
      'Von einem Punkt zum anderen ziehen. Rastet an Regalecken, Wänden und Raumecken ein. Das Maß bleibt im Plan stehen.',
  },
};

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
