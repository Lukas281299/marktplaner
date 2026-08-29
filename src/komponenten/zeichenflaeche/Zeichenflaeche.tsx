import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';

import { TEXTFELD_VORLAGE, findeVorlage } from '../../daten/bibliothek';
import { bogenPunkte, entdoppele, taugtAlsUmriss } from '../../logik/bogen';
import { buehneSteuerung } from '../../logik/buehne';
import {
  berechneAbstaende,
  bestimmeEinrastung,
  type Abstandsmass,
  type Hilfslinie,
} from '../../logik/einrasten';
import { hatEcken } from '../../logik/elementEcken';
import { runde, ueberschneiden, umgrenzung } from '../../logik/geometrie';
import { auswahlFuerKlick, mitGruppen, mitgliederVon } from '../../logik/gruppen';
import { formatiereLaenge } from '../../logik/masse';
import { fangePunkt, fangpunkte } from '../../logik/messen';
import { rahmen as umrissRahmen, rechteckAusEcken, vereinige, ziehAb } from '../../logik/polygon';
import { punktEinfuegen, punktEntfernen, punktVerschieben } from '../../logik/umrissBearbeiten';
import { alleWandachsen, fangbereich, findeWand, richteWandAus } from '../../logik/waende';
import type { Punkt } from '../../typen/modell';
import { usePlanStore, type Werkzeug } from '../../zustand/planStore';
import { useStatusStore } from '../../zustand/statusStore';
import { ElementBeschriftung, ElementSymbol } from './ElementSymbol';
import { Warengruppenmarkierung } from './Warengruppenmarkierung';
import { Warengruppengriffe } from './Warengruppengriffe';
import { Eckanfasser } from './Eckanfasser';
import { Wandenden } from './Wandenden';
import { Gebaeude } from './Gebaeude';
import { Planvorlage } from './Planvorlage';
import { Masslinien } from './Masslinien';
import { Oeffnungen } from './Oeffnungen';
import { Raeume } from './Raeume';
import { Verkaufsflaechen } from './Verkaufsflaechen';
import { Raster } from './Raster';
import { UmrissBearbeitung } from './UmrissBearbeitung';
import { Waende } from './Waende';

/** Grenzen für den Zoom: 1 Bildpunkt pro 50 cm bis 4 Bildpunkte pro cm. */
const ZOOM_MIN = 0.02;
const ZOOM_MAX = 4;

/**
 * Werkzeuge, die einen freien Polygonzug zeichnen.
 *
 * Grundriss und Verkaufsfläche werden auf genau dieselbe Weise gezeichnet –
 * Ecken setzen, ziehen ergibt einen Bogen, Klick auf den Anfang schließt.
 * Nur was am Ende daraus wird, unterscheidet sich; das entscheidet
 * `schliesseZug`.
 */
function zeichnetZug(werkzeug: Werkzeug): boolean {
  return (
    werkzeug === 'grundrissZeichnen' ||
    werkzeug === 'verkaufsflaeche' ||
    werkzeug === 'raumZeichnen' ||
    werkzeug === 'foerderband'
  );
}

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
  const warengruppenMarkierung = usePlanStore((s) => s.warengruppenMarkierung);
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
  /**
   * Ist Alt gedrückt?
   *
   * Dann fängt nichts ein. Wer die Wände selbst zieht und an den Türen
   * Lücken lässt, will die Tür genau dort haben und nicht an der nächsten
   * Wandkante.
   */
  const altRef = useRef(false);

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
  /**
   * Der Grundriss, der gerade von Hand gezeichnet wird.
   *
   * `punkte` sind die schon gesetzten Ecken, `maus` die Stelle, an der die
   * Maus gerade steht, und `bogenVon` der Punkt, ab dem gerade ein Bogen
   * gezogen wird. Solange gezeichnet wird, steht davon noch nichts im
   * Projekt – erst der Abschluss macht daraus eine Grundfläche.
   */
  const [zeichenzug, setZeichenzug] = useState<Punkt[]>([]);
  const [zugMaus, setZugMaus] = useState<Punkt | null>(null);
  const zeichenzugRef = useRef<Punkt[]>([]);
  const bogenRef = useRef<{ von: Punkt; gezogen: boolean } | null>(null);
  /**
   * Die Mausposition noch einmal als Ref.
   *
   * Die Ereignisse für Bewegen und Loslassen hängen am Fenster und werden
   * nur einmal eingerichtet. Sie sehen deshalb immer den Zustand von damals –
   * über die Ref kommen sie an den aktuellen Wert.
   */
  const zugMausRef = useRef<Punkt | null>(null);

  useEffect(() => {
    zugMausRef.current = zugMaus;
  }, [zugMaus]);
  useEffect(() => {
    zeichenzugRef.current = zeichenzug;
  }, [zeichenzug]);

  /**
   * Aus dem gezeichneten Zug wird eine Fläche.
   *
   * Welche, hängt am Werkzeug – gezeichnet wird für beide gleich. Beim
   * Grundriss schaltet es danach zurück aufs Auswählen: Der Grundriss ist
   * fertig, und alles Weitere – Räume, Regale – läuft wieder ganz normal.
   *
   * Bei der Verkaufsfläche bleibt das Werkzeug an. Teilflächen kommen selten
   * allein, und nach jeder einzelnen das Werkzeug neu zu greifen wäre die
   * Sorte Kleinarbeit, die einem den Abend verdirbt.
   */
  const schliesseZug = useCallback((zug: Punkt[]) => {
    const sauber = entdoppele(zug);
    const store = usePlanStore.getState();
    const verkauf = store.werkzeug === 'verkaufsflaeche';
    const raum = store.werkzeug === 'raumZeichnen';

    // Ein Förderband ist ein offener Zug: Es endet, wo es endet, und wird
    // nicht geschlossen. Zwei Punkte genügen – eine gerade Bahn ist der
    // Normalfall, die Ecken kommen erst, wenn der Platz sie erzwingt.
    if (store.werkzeug === 'foerderband') {
      if (sauber.length < 2) {
        setMeldung('Zu wenige Punkte – ein Band braucht mindestens zwei.');
        return;
      }
      store.fuegeFoerderbandHinzu(sauber);
      setZugMaus(null);
      const meter = sauber
        .slice(1)
        .reduce((summe, p, i) => summe + Math.hypot(p.x - sauber[i].x, p.y - sauber[i].y), 0);
      setMeldung(
        `Förderband über ${(meter / 100).toFixed(2)} m gelegt. ` +
          `Breite und Höhe stellst du rechts ein.`,
      );
      return;
    }

    if (!taugtAlsUmriss(sauber)) {
      setMeldung(
        verkauf
          ? 'Zu wenige Ecken – eine Teilfläche braucht mindestens drei.'
          : raum
            ? 'Zu wenige Ecken – ein Raum braucht mindestens drei.'
            : 'Zu wenige Ecken – ein Grundriss braucht mindestens drei.',
      );
      return;
    }

    if (verkauf) {
      store.fuegeVerkaufsflaecheHinzu(sauber);
      setZugMaus(null);
      setMeldung(
        `Verkaufsfläche mit ${sauber.length} Ecken markiert. Nächste Teilfläche zeichnen oder Esc.`,
      );
      return;
    }

    // Ein Raum bleibt im Werkzeug: Wer einen Lagerraum abtrennt, trennt
    // meistens gleich noch den Kühlraum daneben ab. Beendet wird mit Esc –
    // wie bei den Teilflächen.
    if (raum) {
      store.fuegeRaumHinzu(sauber);
      setZugMaus(null);
      setMeldung(
        `Raum mit ${sauber.length} Ecken abgetrennt. Nächsten Raum zeichnen oder Esc. ` +
          `Die Art stellst du rechts ein.`,
      );
      return;
    }

    store.schnappschuss();
    store.setzeUmriss(sauber);
    store.setzeWerkzeug('auswahl');
    setZugMaus(null);
    setMeldung(`Grundriss mit ${sauber.length} Ecken übernommen.`);
  }, []);

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

  // ------------------------------------------- Tasten beim Grundrisszeichnen
  useEffect(() => {
    if (!zeichnetZug(werkzeug)) {
      // Werkzeug gewechselt: angefangenen Zug wegräumen.
      if (zeichenzugRef.current.length > 0) setZeichenzug([]);
      return;
    }
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName)) return;

      // Die Ref wird überall mitgeschrieben, nicht nur vom Effekt: Der
      // Mausdruck liest sie unmittelbar, und zwischen Tastendruck und
      // Neuzeichnen kann ein Klick liegen.
      const setzeZug = (zug: Punkt[]) => {
        zeichenzugRef.current = zug;
        setZeichenzug(zug);
      };

      if (e.key === 'Enter') {
        e.preventDefault();
        const zug = zeichenzugRef.current;
        setzeZug([]);
        schliesseZug(zug);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Eine Ecke zurück. Beim Zeichnen von Hand verklickt man sich, und
        // dafür jedes Mal von vorn anzufangen wäre unzumutbar.
        e.preventDefault();
        setzeZug(zeichenzugRef.current.slice(0, -1));
      } else if (e.key === 'Escape') {
        setzeZug([]);
        setZugMaus(null);
      }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [werkzeug, schliesseZug]);

  // --------------------------------------------------------- Leertaste (Hand)
  useEffect(() => {
    const runter = (e: KeyboardEvent) => {
      altRef.current = e.altKey;
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
      if (!e.altKey) altRef.current = false;
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

    // Ansicht verschieben: rechte Maustaste, mittlere Maustaste oder
    // Leertaste mit linker Taste.
    //
    // Die rechte Taste ist der bequemste Weg, weil man sie überall drücken
    // kann – auch mitten auf einem Regal. Deshalb wird sie hier oben
    // abgefangen, bevor irgendetwas ausgewählt wird; das Kontextmenü des
    // Browsers ist auf der Zeichenfläche ohnehin unterdrückt.
    if (
      e.evt.button === 1 ||
      e.evt.button === 2 ||
      (e.evt.button === 0 && leertasteRef.current)
    ) {
      e.evt.preventDefault();
      const a = usePlanStore.getState().ansicht;
      schiebeRef.current = { mausX: e.evt.clientX, mausY: e.evt.clientY, x: a.x, y: a.y };
      setZeiger('grabbing');
      return;
    }
    if (e.evt.button !== 0) return;

    const store = usePlanStore.getState();

    // ------------------------------------------------ Grundriss zeichnen
    //
    // Ein Klick setzt eine Ecke. Zieht man dagegen mit gedrückter Taste,
    // wird aus der letzten Kante ein Bogen, der der Maus folgt – so wie man
    // es von Zeichenprogrammen kennt. Ob es ein Klick oder ein Ziehen war,
    // entscheidet sich erst beim Loslassen.
    if (zeichnetZug(store.werkzeug)) {
      const p = aufRaster(planPunkt(e.evt.clientX, e.evt.clientY));
      bogenRef.current = { von: p, gezogen: false };
      return;
    }

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
      // Grundriss zeichnen: Vorschau der nächsten Kante bzw. des Bogens.
      if (zeichnetZug(usePlanStore.getState().werkzeug)) {
        const p = aufRaster(planPunkt(ev.clientX, ev.clientY));
        setZugMaus(p);
        const bogen = bogenRef.current;
        if (bogen && !bogen.gezogen) {
          // Erst ab einer echten Bewegung gilt es als Ziehen. Sonst würde
          // jedes Zittern der Hand aus einem Klick einen Bogen machen.
          const weg = Math.hypot(p.x - bogen.von.x, p.y - bogen.von.y);
          if (weg > 8 / usePlanStore.getState().ansicht.zoom) bogen.gezogen = true;
        }
        return;
      }

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
      // ------------------------------------------------ Grundriss zeichnen
      const bogen = bogenRef.current;
      if (bogen) {
        bogenRef.current = null;
        // Gerechnet wird auf der Ref, nicht in einem `setZeichenzug`-Updater.
        // Der Grund ist hart erkauft: React ruft Updater in der Entwicklung
        // absichtlich zweimal auf, um unsaubere Seiteneffekte aufzudecken.
        // Lag der Abschluss darin, entstand jede Fläche doppelt – beim
        // Grundriss fiel das nie auf, weil derselbe Umriss zweimal gesetzt
        // gleich aussieht.
        //
        // Die Ref wird gleich mitgeschrieben statt erst vom Effekt: Zwei
        // Klicks können schneller kommen, als React neu zeichnet.
        const zug = zeichenzugRef.current;

        // Auf den ersten Punkt geklickt? Dann ist die Fläche geschlossen.
        if (zug.length >= 3) {
          const erster = zug[0];
          const nah = 12 / usePlanStore.getState().ansicht.zoom;
          if (Math.hypot(bogen.von.x - erster.x, bogen.von.y - erster.y) < nah) {
            zeichenzugRef.current = [];
            setZeichenzug([]);
            schliesseZug(zug);
            return;
          }
        }

        const letzter = zug[zug.length - 1];
        // Gezogen heißt Bogen: Er läuft von der letzten Ecke über die Stelle,
        // an der die Maus jetzt steht, zurück zum Startpunkt des Ziehens.
        const naechster = !letzter
          ? [bogen.von]
          : bogen.gezogen && zugMausRef.current
            ? [...zug, ...bogenPunkte(letzter, zugMausRef.current, bogen.von)]
            : [...zug, bogen.von];
        zeichenzugRef.current = naechster;
        setZeichenzug(naechster);
        return;
      }

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
            // Liegt eine Wand darunter, übernimmt die Öffnung deren Richtung
            // und Stärke – das ist der Regelfall und spart das Ausrichten.
            //
            // Ohne Wand wird sie trotzdem gesetzt: Wer die Wände selbst
            // zieht, lässt an den Türen Lücken und will die Tür genau dort
            // haben. Sie bekommt dann die zuletzt benutzte Richtung und die
            // eingestellte Wandstärke; beides steht rechts zum Nachstellen.
            store0.fuegeOeffnungHinzu({
              art: store0.oeffnungsartNeu,
              x: treffer ? treffer.punkt.x : anfang.x,
              y: treffer ? treffer.punkt.y : anfang.y,
              breite: store0.oeffnungsbreiteNeu,
              tiefe: treffer ? treffer.staerke : store0.wandstaerkeNeu,
              drehung: treffer ? treffer.winkel : store0.oeffnungsdrehungNeu,
              gespiegelt: false,
            });
            // Und gleich zurück ins Auswählen: Die frische Öffnung ist
            // ausgewählt, man kann sie sofort schieben und die Regler
            // benutzen. Bliebe das Werkzeug an, setzte der nächste Klick
            // eine zweite Tür – und man müsste erst Esc drücken.
            store0.setzeWerkzeug('auswahl');
            melde(
              treffer
                ? 'Gesetzt und ausgewählt – ziehen verschiebt sie, die Maße stehen rechts.'
                : 'Frei gesetzt – ziehen verschiebt sie, die Maße stehen rechts. Alt beim Ziehen rastet in eine Wand ein.',
            );
            return;
          }

          // ------------------------------------------------------ Textfeld
          // Ein Klick setzt eine Anmerkung an diese Stelle. Danach zurück
          // zum Auswählen: Der neue Text ist ausgewählt, und rechts steht
          // sein Feld – man will ihn ja sofort schreiben.
          if (store0.werkzeug === 'textfeld') {
            store0.fuegeElementHinzu(TEXTFELD_VORLAGE, anfang.x, anfang.y);
            store0.setzeWerkzeug('auswahl');
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
            // Als Rechteck aufgezogen: Die lange Seite wird die Wand, die
            // kurze ihre Stärke. So sieht man die Wand beim Ziehen schon in
            // ihrer wirklichen Dicke, statt sie als Strich zu setzen und das
            // Maß danach einzutippen.
            if (store0.wandmodus === 'rechteck') {
              if (Math.max(breite, hoehe) < 50) return;
              store0.fuegeWandAusRechteck(rechteckAusEcken(anfang, ende));
              return;
            }
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

  // -------------------------------------------- Verkaufsfläche verschieben
  const verkaufZugRef = useRef<{ id: string; letztesX: number; letztesY: number } | null>(null);

  const verkaufZiehStart = (id: string) => {
    usePlanStore.getState().schnappschuss();
    verkaufZugRef.current = { id, letztesX: 0, letztesY: 0 };
  };

  const verkaufZiehen = (id: string, x: number, y: number) => {
    const zug = verkaufZugRef.current;
    if (!zug || zug.id !== id) return;
    usePlanStore.getState().verschiebeVerkaufsflaeche(id, x - zug.letztesX, y - zug.letztesY);
    zug.letztesX = x;
    zug.letztesY = y;
  };

  const verkaufZiehEnde = () => {
    const zug = verkaufZugRef.current;
    verkaufZugRef.current = null;
    if (!zug) return;
    const store = usePlanStore.getState();
    const flaeche = store.projekt.verkaufsflaechen.find((v) => v.id === zug.id);
    if (!flaeche || flaeche.umriss.length === 0) return;
    const ecke = flaeche.umriss[0];
    const ziel = aufRaster(ecke);
    store.verschiebeVerkaufsflaeche(zug.id, ziel.x - ecke.x, ziel.y - ecke.y);
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

  /**
   * Eine Öffnung ziehen – sie gleitet dabei in ihrer Wand.
   *
   * Vorher wurde die Öffnung frei mitgeschleift und erst beim Loslassen an
   * die nächste Wand geschnappt. Dazwischen hing sie im Nichts, und wer sie
   * nur ein Stück weiterschieben wollte, sah sie aus der Wand fallen.
   *
   * Jetzt wird bei jeder Bewegung auf die nächste Wandachse gelotet: Die
   * Tür folgt der Maus, bleibt aber auf der Wand und übernimmt deren
   * Richtung und Stärke. Der Fangbereich ist dabei großzügiger als beim
   * Setzen – wer eine Tür verschiebt, will sie in aller Regel in derselben
   * Wand behalten und nicht bei jedem Zittern verlieren.
   */
  const oeffnungZiehen = (id: string, x: number, y: number) => {
    const store = usePlanStore.getState();
    // Ziehen ist frei. Das Einrasten in eine Wand kommt auf Wunsch, mit
    // gedrückter Alt-Taste – nicht umgekehrt.
    //
    // Vorher fing es von selbst und zog die Öffnung aus jeder Lücke an die
    // nächste Wandkante. Wer die Wände selbst zieht, lässt an den Türen
    // Lücken; dort ist die Lücke gemeint und nicht die Kante daneben.
    if (!altRef.current) {
      store.aendereOeffnung(id, { x, y }, false);
      return { x, y };
    }
    const achsen = alleWandachsen(
      store.projekt.grundflaeche,
      store.projekt.raeume,
      store.projekt.waende,
    );
    const treffer = findeWand({ x, y }, achsen, fangbereich(store.ansicht.zoom) * 3);
    if (!treffer) {
      // Keine Wand in Reichweite: Dann lässt sich die Öffnung frei
      // versetzen, etwa um sie in eine ganz andere Wand zu bringen.
      store.aendereOeffnung(id, { x, y }, false);
      return { x, y };
    }
    store.aendereOeffnung(
      id,
      {
        x: treffer.punkt.x,
        y: treffer.punkt.y,
        drehung: treffer.winkel,
        tiefe: treffer.staerke,
      },
      false,
    );
    return treffer.punkt;
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

    // Ist eine Warengruppe aufgenommen, markiert der Klick den getroffenen
    // Meter, statt ein Möbel auszuwählen. Eine Gondel ist ein einziges
    // Element mit sechs Feldern – über die Auswahl käme man an den einzelnen
    // Meter nie heran.
    if (store.warengruppenPinsel) {
      const punkt = planPunkt(e.evt.clientX, e.evt.clientY);
      if (!store.markiereFeld(id, punkt)) melde('Hier gibt es keinen Meter zum Beschriften');
      return;
    }

    const ids = auswahlFuerKlick(store.projekt.elemente, id, {
      alt: e.evt.altKey,
      zuordnen: false,
    });

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
    //
    // Bewusst **ohne** Runden: Das angefasste Element steht schon auf dem
    // eingerasteten Wert, und jeder Mitreisende behält seinen Abstand dazu
    // auf den Millimeter. Wurde hier jede Lage einzeln auf halbe Zentimeter
    // gerastet, rutschten die Teile einer Gruppe gegeneinander – bei einem
    // Zug von 633,30 cm liegt der Kopf 350,15 cm entfernt, und beide landen
    // beim Runden auf verschiedenen Rasterpunkten.
    const dx = zielX - start.x;
    const dy = zielY - start.y;
    const neuePositionen = [...daten.start.entries()].map(([elId, pos]) => ({
      id: elId,
      x: pos.x + dx,
      y: pos.y + dy,
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

  /**
   * Das frei geformte Element, das gerade allein ausgewählt ist.
   *
   * Für dieses werden die Eckanfasser gezeigt – und dafür bleibt der
   * Transformer weg. Beides zusammen läge übereinander, und man wüsste bei
   * einem Griff in der Ecke nicht mehr, ob man die Ecke zieht oder die ganze
   * Fläche skaliert. Größe und Drehung stellt man bei diesen Möbeln rechts
   * im Eigenschaftenfenster ein.
   */
  const eckElement =
    auswahl.length === 1
      ? projekt.elemente.find((el) => el.id === auswahl[0] && hatEcken(el) && !el.gesperrt)
      : undefined;

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
    trafo.nodes(eckElement ? [] : knoten);
  }, [auswahl, projekt.elemente, eckElement]);

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

  const verkaufSichtbar = sichtbareEbenen.has('verkaufsflaeche');
  const verkaufGesperrt = gesperrteEbenen.has('verkaufsflaeche');
  // Innenwände und Öffnungen gehören zum Gebäude.
  const gebaeudeSichtbar = sichtbareEbenen.has('gebaeude');
  const gebaeudeGesperrt = gesperrteEbenen.has('gebaeude');

  const einheit = projekt.einstellungen.anzeigeEinheit;
  const zoom = ansicht.zoom;
  // Fehlt die Einstellung in einer älteren Planung, bleibt alles wie bisher.
  const beschriftungen = projekt.einstellungen.beschriftungen ?? 'nachElement';

  /**
   * Wie groß die Anfasser sein dürfen.
   *
   * Sie hatten bisher eine feste Größe von neun Bildschirmpunkten. Das ist
   * richtig gedacht – ein Anfasser soll sich immer gleich gut treffen lassen,
   * egal wie weit man hineingezoomt hat. Es geht aber nur so lange gut, wie
   * das Möbel selbst größer ist als seine Anfasser.
   *
   * Weit herausgezoomt ist ein Regalfeld noch fünfzehn Punkte breit. Acht
   * Anfasser zu neun Punkten verdecken es dann vollständig: Man sieht nur
   * noch blaue Kästchen und nicht mehr, was man da eigentlich auswählt.
   *
   * Deshalb richtet sich die Größe jetzt nach der kürzeren Kante der
   * Auswahl auf dem Bildschirm. Bleibt für den Anfasser nicht genug Platz,
   * schrumpft er mit – bis auf drei Punkte, darunter wäre er nicht mehr zu
   * treffen.
   */
  const auswahlBreiten = projekt.elemente
    .filter((el) => auswahl.includes(el.id))
    .map((el) => Math.min(el.breite, el.tiefe));
  const kuerzesteKanteAufSchirm =
    auswahlBreiten.length > 0 ? Math.min(...auswahlBreiten) * zoom : Infinity;
  const anfasserGroesse = Math.max(3, Math.min(9, kuerzesteKanteAufSchirm / 3.5));
  /** Die ausgewählte Wand – für die Anfasser an ihren Enden. */
  const gewaehlteWand =
    sonderauswahl?.art === 'wand'
      ? projekt.waende.find((w) => w.id === sonderauswahl.id)
      : undefined;

  // Der Drehgriff braucht mehr Platz als ein Eckanfasser. Ist das Möbel zu
  // klein, wäre sein Stiel länger als das Möbel breit – dann bleibt er weg
  // und man dreht über R oder das Eigenschaftenfenster.
  const drehenMoeglich = kuerzesteKanteAufSchirm > 26;


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
          <Gebaeude
            grundflaeche={projekt.grundflaeche}
            einheit={einheit}
            zoom={zoom}
            aufVorlage={Boolean(projekt.hintergrund?.sichtbar)}
          />
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
              einheit={einheit}
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

        {/* ------------------------------------------------- Verkaufsfläche */}
        {/* Über den Räumen, unter der Einrichtung: Die Markierung soll den
            Raum darunter überziehen, aber die Regale nicht verdecken. */}
        <Layer listening={verkaufSichtbar && werkzeug === 'auswahl'}>
          {verkaufSichtbar && (
            <Verkaufsflaechen
              flaechen={projekt.verkaufsflaechen}
              ausgewaehlt={
                sonderauswahl?.art === 'verkaufsflaeche' ? sonderauswahl.id : null
              }
              zoom={zoom}
              anklickbar={werkzeug === 'auswahl' && !verkaufGesperrt}
              beiKlick={(id) =>
                usePlanStore.getState().waehleSonder({ art: 'verkaufsflaeche', id })
              }
              beiZiehStart={verkaufZiehStart}
              beiZiehen={verkaufZiehen}
              beiZiehEnde={verkaufZiehEnde}
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
          {/* Die markierten Meter liegen über den Möbeln: Sie gehören zum
              Arbeiten und stehen mal an diesem, mal an jenem Möbel. */}
          <Warengruppenmarkierung
            markierung={warengruppenMarkierung}
            elemente={projekt.elemente}
            zoom={zoom}
          />

          {beschriftungen !== 'aus' &&
            sichtbareElemente.map((el) => (
              <ElementBeschriftung
                key={`text-${el.id}`}
                element={el}
                zoom={zoom}
                erzwungen={beschriftungen === 'alle'}
              />
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
            rotateEnabled={drehenMoeglich}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={5}
            borderStroke="#0a84ff"
            borderStrokeWidth={1 / zoom}
            anchorStroke="#0a84ff"
            anchorFill="#ffffff"
            anchorSize={anfasserGroesse / zoom}
            anchorStrokeWidth={Math.max(1, anfasserGroesse / 6.5) / zoom}
            anchorCornerRadius={(anfasserGroesse / 4.5) / zoom}
            rotateAnchorOffset={(anfasserGroesse * 3.1) / zoom}
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

          {/* Die Griffe an den Grenzen zwischen zwei Warengruppen – **über**
              dem Auswahlrahmen. Sie sitzen an der Vorderkante des Möbels,
              genau dort, wo der Rahmen verläuft; eine Ebene tiefer fing er
              jeden Klick ab, und Ziehen ging überhaupt nicht.

              Nur am ausgewählten Möbel: über einem ganzen Markt wären es
              hunderte Punkte, und der Plan wäre nicht mehr zu lesen. */}
          {werkzeug === 'auswahl' && (
            <Warengruppengriffe elemente={projekt.elemente} auswahl={auswahl} zoom={zoom} />
          )}

          {/* Der Grundriss, der gerade gezeichnet wird */}
          {zeichnetZug(werkzeug) && zeichenzug.length > 0 && (
            <>
              <Line
                points={[
                  ...zeichenzug.flatMap((p) => [p.x, p.y]),
                  ...(zugMaus ? [zugMaus.x, zugMaus.y] : []),
                ]}
                stroke={zugfarbe(werkzeug)}
                strokeWidth={1.6 / zoom}
                listening={false}
                closed={false}
              />
              {/* Die gesetzten Ecken. Die erste ist größer: Auf sie klickt
                  man, um den Umriss zu schließen. */}
              {zeichenzug.map((p, i) => (
                <Rect
                  key={`ecke-${i}`}
                  x={p.x - (i === 0 ? 6 : 3.5) / zoom}
                  y={p.y - (i === 0 ? 6 : 3.5) / zoom}
                  width={(i === 0 ? 12 : 7) / zoom}
                  height={(i === 0 ? 12 : 7) / zoom}
                  fill={i === 0 ? '#ffffff' : zugfarbe(werkzeug)}
                  stroke={zugfarbe(werkzeug)}
                  strokeWidth={1.4 / zoom}
                  listening={false}
                />
              ))}
            </>
          )}

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

          {/* Anfasser an den Ecken eines frei geformten Möbels */}
          {eckElement && werkzeug === 'auswahl' && (
            <Eckanfasser
              element={eckElement}
              zoom={zoom}
              einheit={einheit}
              einrasten={aufRaster}
              beiZiehStart={() => usePlanStore.getState().schnappschuss()}
              beiZiehen={(index, ziel) =>
                usePlanStore.getState().verschiebeElementEcke(eckElement.id, index, ziel)
              }
              beiZiehEnde={() => {}}
            />
          )}

          {/* Enden der ausgewählten Wand – die Länge zieht man im Plan,
              nicht im Zahlenfeld. */}
          {werkzeug === 'auswahl' && gewaehlteWand && !gewaehlteWand.gesperrt && (
            <Wandenden
              wand={gewaehlteWand}
              zoom={zoom}
              einheit={einheit}
              einrasten={aufRaster}
              beiZiehStart={() => usePlanStore.getState().schnappschuss()}
              beiZiehen={(ende, ziel) =>
                usePlanStore
                  .getState()
                  .aendereWand(gewaehlteWand.id, ende === 0 ? { von: ziel } : { bis: ziel }, false)
              }
              beiZiehEnde={() => {}}
            />
          )}

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
              fill={rahmenfarbe(werkzeug).fuellung}
              stroke={rahmenfarbe(werkzeug).linie}
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
/**
 * Die Farbe des Polygonzugs, den man gerade zeichnet.
 *
 * Sie sagt, was daraus wird – der Raum ist violett wie im fertigen Plan, die
 * Teilfläche grün. Ohne den Unterschied sieht ein halb gezeichneter Raum
 * genauso aus wie ein halb gezeichneter Grundriss, und beim Zeichnen weiß man
 * nicht mehr, in welchem Werkzeug man steckt.
 */
function zugfarbe(werkzeug: Werkzeug): string {
  if (werkzeug === 'raumZeichnen') return '#7b6bc4';
  if (werkzeug === 'foerderband') return '#5b7386';
  if (werkzeug === 'verkaufsflaeche') return '#2ea043';
  return '#0a84ff';
}

/**
 * Die Farbe des Rahmens, den man gerade aufzieht.
 *
 * **Mit Rückfall.** Ein Werkzeug ohne Eintrag riss hier die ganze
 * Zeichenfläche mit: `RAHMENFARBEN[werkzeug].fuellung` ist bei einem
 * unbekannten Werkzeug ein Zugriff auf `undefined`, und React räumt daraufhin
 * den ganzen Baum ab. Genau das passierte beim freien Textfeld – es kam
 * später dazu und wurde hier vergessen. Ein fehlender Eintrag darf höchstens
 * eine falsche Farbe bedeuten.
 */
export function rahmenfarbe(werkzeug: Werkzeug): { fuellung: string; linie: string } {
  return RAHMENFARBEN[werkzeug] ?? RAHMENFARBEN.auswahl;
}

export const RAHMENFARBEN: Record<string, { fuellung: string; linie: string }> = {
  auswahl: { fuellung: 'rgba(10,132,255,0.12)', linie: '#0a84ff' },
  umriss: { fuellung: 'rgba(10,132,255,0.12)', linie: '#0a84ff' },
  flaecheAnfuegen: { fuellung: 'rgba(46,160,67,0.16)', linie: '#2ea043' },
  flaecheAbziehen: { fuellung: 'rgba(229,72,77,0.14)', linie: '#e5484d' },
  raum: { fuellung: 'rgba(140,120,200,0.16)', linie: '#7b6bc4' },
  wand: { fuellung: 'transparent', linie: '#66707c' },
  oeffnung: { fuellung: 'transparent', linie: '#66707c' },
  messen: { fuellung: 'transparent', linie: '#2f3b49' },
  // Das Textfeld wird gesetzt, nicht aufgezogen – der Rahmen blitzt nur kurz
  // auf, während die Taste unten ist.
  textfeld: { fuellung: 'transparent', linie: '#0a84ff' },
  grundrissZeichnen: { fuellung: 'rgba(10,132,255,0.12)', linie: '#0a84ff' },
  verkaufsflaeche: { fuellung: 'rgba(46,160,67,0.16)', linie: '#2ea043' },
  raumZeichnen: { fuellung: 'rgba(140,120,200,0.16)', linie: '#7b6bc4' },
  foerderband: { fuellung: 'rgba(120,140,160,0.16)', linie: '#5b7386' },
};

/**
 * Kurze Anleitung zum jeweils gewählten Werkzeug.
 *
 * Bewusst über `Werkzeug` verschlüsselt und nicht über `string`: Ein neues
 * Werkzeug ohne Eintrag ist damit ein Übersetzungsfehler. Mit `string` war es
 * ein Absturz beim Anklicken – die Zeichenfläche verschwand, weil hier auf
 * `undefined.titel` zugegriffen wurde.
 */
const WERKZEUG_TEXT: Record<Exclude<Werkzeug, 'auswahl'>, { titel: string; hinweis: string }> = {
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
  foerderband: {
    titel: 'Förderband legen',
    hinweis:
      'Klicken setzt einen Knick · Enter beendet das Band · Rückschritt nimmt einen Punkt zurück · Breite und Höhe danach rechts einstellen',
  },
  raumZeichnen: {
    titel: 'Raum frei umfahren',
    hinweis:
      'Klicken setzt eine Ecke · Ziehen macht daraus einen Bogen · auf die erste Ecke klicken oder Enter schließt · Rückschritt nimmt eine Ecke zurück · Art und Name danach rechts einstellen',
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
  grundrissZeichnen: {
    titel: 'Grundriss zeichnen',
    hinweis:
      'Klicken setzt eine Ecke · Ziehen macht daraus einen Bogen · auf die erste Ecke klicken oder Enter schließt · Rückschritt nimmt eine Ecke zurück',
  },
  verkaufsflaeche: {
    titel: 'Verkaufsfläche markieren',
    hinweis:
      'Klicken setzt eine Ecke · Ziehen macht daraus einen Bogen · auf die erste Ecke klicken oder Enter schließt · Rückschritt nimmt eine Ecke zurück · das Werkzeug bleibt an, für die nächste Teilfläche',
  },
  textfeld: {
    titel: 'Text einfügen',
    hinweis:
      'Auf die Stelle klicken – der Text steht danach rechts unter „Beschriftung". Wie groß er im Plan steht, sagt die Größe des Kastens: einfach am Rahmen ziehen.',
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
