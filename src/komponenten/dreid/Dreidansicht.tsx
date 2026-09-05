import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MATERIAL } from '../../logik/dreid/material';
import { szeneAus, type Koerper, type Szene } from '../../logik/dreid/szene';
import { hoeheVon } from '../../logik/dreid/moebel';
import type { Bauteil } from '../../logik/dreid/bauteile';
import { usePlanStore } from '../../zustand/planStore';

/**
 * Die 3D-Ansicht.
 *
 * Sie zeigt den Markt räumlich – zum Schauen, nicht zum Planen. Geplant wird
 * im Grundriss; hier sieht man, was dabei herauskommt: wie hoch ein Wandregal
 * über einem Zug steht, ob eine Kopfgondel den Blick auf die Bäckerei
 * verdeckt, wie die Tiefkühlinseln im Gang wirken.
 *
 * **Die Geometrie kommt fertig aus `logik/dreid`.** Hier werden aus den
 * Bauteilen three.js-Netze, dazu Licht, Kamera und Maus. Dieser Teil kennt
 * kein einziges Möbel.
 *
 * **Geladen wird sie erst beim ersten Aufruf.** three.js ist groß, und wer
 * nur plant, soll es nicht mitladen müssen – deshalb liegt die Ansicht in
 * einem eigenen Paket, das `App.tsx` nachlädt.
 *
 * Achsen: Der Plan hat x nach rechts und y nach unten (Bildschirm). In
 * three.js ist y die Höhe – also wird Plan-y zu three-z, die Höhe zu three-y.
 * Eine Drehung im Uhrzeigersinn des Plans ist in three.js eine negative
 * Drehung um die Hochachse.
 */

const GRAD = Math.PI / 180;

/** Ein Material je Name und Farbe – geteilt zwischen allen Netzen. */
class Materialvorrat {
  private vorrat = new Map<string, THREE.Material>();

  hole(teil: Bauteil): THREE.Material {
    const schluessel = `${teil.material}|${teil.farbe ?? ''}`;
    let m = this.vorrat.get(schluessel);
    if (m) return m;
    const b = MATERIAL[teil.material];
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(teil.farbe ?? b.farbe),
      metalness: b.metall,
      roughness: b.rauheit,
      transparent: b.deckung !== undefined && b.deckung < 1,
      opacity: b.deckung ?? 1,
      depthWrite: !(b.deckung !== undefined && b.deckung < 0.6),
      side: THREE.DoubleSide,
    });
    this.vorrat.set(schluessel, m);
    return m;
  }

  entsorge() {
    for (const m of this.vorrat.values()) m.dispose();
    this.vorrat.clear();
  }
}

/** Baut ein Netz aus einem Bauteil – in den Koordinaten seines Körpers. */
function netzAus(teil: Bauteil, material: THREE.Material): THREE.Mesh {
  let geometrie: THREE.BufferGeometry;
  const netz = new THREE.Mesh();
  netz.material = material;

  switch (teil.art) {
    case 'quader': {
      geometrie = new THREE.BoxGeometry(teil.b, teil.h, teil.t);
      const neigung = (teil.neigung ?? 0) * GRAD;
      if (teil.gespiegelt) {
        // Drehpunkt an der vorderen unteren Kante.
        geometrie.translate(teil.b / 2, teil.h / 2, -teil.t / 2);
        netz.position.set(teil.x, teil.z, teil.y + teil.t);
        netz.rotation.x = -neigung;
      } else {
        geometrie.translate(teil.b / 2, teil.h / 2, teil.t / 2);
        netz.position.set(teil.x, teil.z, teil.y);
        netz.rotation.x = neigung;
      }
      break;
    }
    case 'zylinder': {
      geometrie = new THREE.CylinderGeometry(teil.radius, teil.radius, teil.laenge, 16);
      if (teil.achse === 'z') {
        geometrie.translate(0, teil.laenge / 2, 0);
      } else if (teil.achse === 'x') {
        geometrie.rotateZ(-Math.PI / 2);
        geometrie.translate(teil.laenge / 2, 0, 0);
      } else {
        geometrie.rotateX(Math.PI / 2);
        geometrie.translate(0, 0, teil.laenge / 2);
      }
      netz.position.set(teil.x, teil.z, teil.y);
      break;
    }
    case 'prisma': {
      // Die Form liegt in x/y des Möbels; extrudiert wird nach oben. Die
      // Drehung um -90° legt die Extrusion auf die Höhe und kehrt dabei y um –
      // deshalb kommen die Punkte mit -y hinein.
      const form = new THREE.Shape(teil.punkte.map((p) => new THREE.Vector2(p.x, -p.y)));
      geometrie = new THREE.ExtrudeGeometry(form, { depth: teil.h, bevelEnabled: false });
      geometrie.rotateX(-Math.PI / 2);
      netz.position.set(0, teil.z, 0);
      break;
    }
    case 'kugel': {
      geometrie = new THREE.SphereGeometry(teil.radius, 14, 10);
      netz.position.set(teil.x, teil.z, teil.y);
      break;
    }
  }

  netz.geometry = geometrie;
  const durchsichtig = teil.material === 'glas' || teil.material === 'markierung' || teil.material === 'gitter';
  netz.castShadow = !durchsichtig;
  netz.receiveShadow = true;
  return netz;
}

/** Ein Körper als Gruppe: an seinen Ort gestellt und gedreht. */
function gruppeAus(koerper: Koerper, vorrat: Materialvorrat): THREE.Group {
  const aussen = new THREE.Group();
  aussen.position.set(koerper.x, 0, koerper.y);
  aussen.rotation.y = -koerper.drehung * GRAD;
  if (koerper.elementId) aussen.userData.elementId = koerper.elementId;

  // Die Bauteile liegen in 0…breite / 0…tiefe; der Körper dreht um seine Mitte.
  const innen = new THREE.Group();
  innen.position.set(-koerper.breite / 2, 0, -koerper.tiefe / 2);
  for (const teil of koerper.bauteile) innen.add(netzAus(teil, vorrat.hole(teil)));
  aussen.add(innen);
  return aussen;
}

/**
 * Räumt eine Gruppe samt Geometrien ab – die Materialien gehören dem Vorrat.
 *
 * **Auch das, was keine Fläche ist.** Der Auswahlrahmen ist ein `BoxHelper`
 * und damit `LineSegments`, kein `Mesh`; er fiel durch die Prüfung und ließ
 * bei jedem Klick eine Geometrie und ein Material im Grafikspeicher zurück.
 * Wer sich durch hundert Möbel klickt, sammelt hundert davon an.
 */
function entsorge(objekt: THREE.Object3D) {
  objekt.traverse((kind) => {
    const teil = kind as THREE.Mesh | THREE.LineSegments;
    if (teil.geometry) teil.geometry.dispose();
    // Der Vorrat hält die Möbelmaterialien; ein Helfer bringt sein eigenes mit
    // und muss es deshalb selbst wieder hergeben.
    if (kind instanceof THREE.LineSegments) {
      const stoff = kind.material;
      if (Array.isArray(stoff)) stoff.forEach((m) => m.dispose());
      else stoff?.dispose();
    }
  });
  objekt.removeFromParent();
}

interface Buehne {
  renderer: THREE.WebGLRenderer;
  szene: THREE.Scene;
  kamera: THREE.PerspectiveCamera;
  steuerung: OrbitControls;
  licht: THREE.DirectionalLight;
  markt: THREE.Group;
  auswahl: THREE.Group;
  vorrat: Materialvorrat;
  bedarf: boolean;
  laeuft: boolean;
  /**
   * Die Ansicht auf den ganzen Markt stellen.
   *
   * Wird von der Größenüberwachung aufgerufen, sobald die Fläche zum ersten
   * Mal eine brauchbare Größe hat: Beim Aufbau ist sie noch 0 × 0, und eine
   * Kamera, die auf ein Nichts eingepasst wird, steht danach in der Wand.
   */
  passeEin: (() => void) | null;
  eingepasst: boolean;
}

export default function Dreidansicht() {
  const behaelter = useRef<HTMLDivElement>(null);
  const buehne = useRef<Buehne | null>(null);

  const projekt = usePlanStore((s) => s.projekt);
  const auswahl = usePlanStore((s) => s.auswahl);

  // Die Szene neu rechnen, wenn sich etwas am Bau ändert – nicht bei jedem
  // Klick auf ein Möbel.
  const szene: Szene = useMemo(
    () => szeneAus(projekt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projekt.elemente, projekt.waende, projekt.raeume, projekt.oeffnungen, projekt.grundflaeche, projekt.ebenen],
  );

  // ------------------------------------------------------------ Aufbau
  useEffect(() => {
    const el = behaelter.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const dreiSzene = new THREE.Scene();
    dreiSzene.background = new THREE.Color('#e9edf1');

    const kamera = new THREE.PerspectiveCamera(50, 1, 5, 40000);
    const steuerung = new OrbitControls(kamera, renderer.domElement);
    steuerung.enableDamping = true;
    steuerung.dampingFactor = 0.08;
    steuerung.maxPolarAngle = Math.PI / 2 - 0.03;
    steuerung.minDistance = 40;
    steuerung.screenSpacePanning = false;

    // Licht: ein weicher Himmel und eine Sonne mit Schatten.
    dreiSzene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a95, 1.1));
    const licht = new THREE.DirectionalLight(0xffffff, 1.6);
    licht.castShadow = true;
    licht.shadow.mapSize.set(2048, 2048);
    licht.shadow.bias = -0.0006;
    dreiSzene.add(licht);
    dreiSzene.add(licht.target);

    const markt = new THREE.Group();
    const auswahlGruppe = new THREE.Group();
    dreiSzene.add(markt, auswahlGruppe);

    const b: Buehne = {
      renderer,
      szene: dreiSzene,
      kamera,
      steuerung,
      licht,
      markt,
      auswahl: auswahlGruppe,
      vorrat: new Materialvorrat(),
      bedarf: true,
      laeuft: true,
      passeEin: null,
      eingepasst: false,
    };
    buehne.current = b;

    const groesse = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 10 || h < 10) return;
      renderer.setSize(w, h, false);
      kamera.aspect = w / h;
      kamera.updateProjectionMatrix();
      b.bedarf = true;
      // Der erste brauchbare Zuschnitt ist der Moment für die Übersicht.
      if (!b.eingepasst && b.passeEin) {
        b.eingepasst = true;
        b.passeEin();
      }
    };
    groesse();
    const beobachter = new ResizeObserver(groesse);
    beobachter.observe(el);

    steuerung.addEventListener('change', () => {
      b.bedarf = true;
    });

    // Gezeichnet wird nur, wenn sich etwas bewegt hat.
    const schleife = () => {
      if (!b.laeuft) return;
      const bewegt = steuerung.update();
      if (bewegt || b.bedarf) {
        renderer.render(dreiSzene, kamera);
        b.bedarf = false;
      }
      requestAnimationFrame(schleife);
    };
    requestAnimationFrame(schleife);

    // Klick wählt aus – aber nur ein Klick, kein Ziehen.
    let start: { x: number; y: number } | null = null;
    const zeiger = new THREE.Vector2();
    const strahl = new THREE.Raycaster();
    const runter = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY };
    };
    const hoch = (e: PointerEvent) => {
      if (!start || e.button !== 0) return;
      const weg = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      start = null;
      if (weg > 4) return;
      const r = renderer.domElement.getBoundingClientRect();
      zeiger.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      strahl.setFromCamera(zeiger, kamera);
      const treffer = strahl.intersectObjects(markt.children, true);
      let id: string | undefined;
      for (const t of treffer) {
        let o: THREE.Object3D | null = t.object;
        while (o && !o.userData.elementId) o = o.parent;
        if (o?.userData.elementId) {
          id = o.userData.elementId as string;
          break;
        }
        // Boden oder Wand getroffen: dahinter liegt nichts mehr.
        break;
      }
      const store = usePlanStore.getState();
      if (id) store.waehleAus([id], e.shiftKey || e.ctrlKey ? 'umschalten' : undefined);
      else if (!e.shiftKey) store.hebeAuswahlAuf();
    };
    renderer.domElement.addEventListener('pointerdown', runter);
    renderer.domElement.addEventListener('pointerup', hoch);

    return () => {
      b.laeuft = false;
      beobachter.disconnect();
      renderer.domElement.removeEventListener('pointerdown', runter);
      renderer.domElement.removeEventListener('pointerup', hoch);
      steuerung.dispose();
      entsorge(markt);
      entsorge(auswahlGruppe);
      b.vorrat.entsorge();
      renderer.dispose();
      renderer.domElement.remove();
      buehne.current = null;
    };
  }, []);

  // ------------------------------------------------------- Der Markt
  useEffect(() => {
    const b = buehne.current;
    if (!b) return;
    for (const kind of [...b.markt.children]) entsorge(kind);
    for (const koerper of szene.koerper) b.markt.add(gruppeAus(koerper, b.vorrat));

    // Die Sonne über den Markt stellen, den Schatten passend beschneiden.
    const { links, oben, rechts, unten } = szene.rahmen;
    const w = rechts - links;
    const d = unten - oben;
    const cx = links + w / 2;
    const cz = oben + d / 2;
    b.licht.position.set(cx - w * 0.35, Math.max(w, d) * 0.9, cz - d * 0.25);
    b.licht.target.position.set(cx, 0, cz);
    const s = b.licht.shadow.camera;
    const halb = Math.max(w, d) * 0.75;
    s.left = -halb;
    s.right = halb;
    s.top = halb;
    s.bottom = -halb;
    s.near = 10;
    s.far = Math.max(w, d) * 3;
    s.updateProjectionMatrix();
    b.steuerung.maxDistance = Math.max(w, d) * 3;

    // Die Übersicht bleibt an der Bühne hängen: Sie kennt den neuen Rahmen,
    // und die Größenüberwachung ruft sie auf, sobald es etwas zu sehen gibt.
    b.passeEin = vogelperspektive;
    if (!b.eingepasst && behaelter.current && behaelter.current.clientWidth > 10) {
      b.eingepasst = true;
      vogelperspektive();
    }
    b.bedarf = true;
  }, [szene]);

  // ---------------------------------------------------------- Auswahl
  useEffect(() => {
    const b = buehne.current;
    if (!b) return;
    for (const kind of [...b.auswahl.children]) entsorge(kind);
    for (const id of auswahl) {
      const gruppe = b.markt.children.find((k) => k.userData.elementId === id);
      if (!gruppe) continue;
      const rahmen = new THREE.BoxHelper(gruppe, 0x1a73e8);
      b.auswahl.add(rahmen);
    }
    b.bedarf = true;
  }, [auswahl, szene]);

  // ----------------------------------------------------------- Kamera
  const mitte = () => {
    const { links, oben, rechts, unten } = szene.rahmen;
    return { x: (links + rechts) / 2, z: (oben + unten) / 2, w: rechts - links, d: unten - oben };
  };

  const setzeKamera = (pos: THREE.Vector3, ziel: THREE.Vector3) => {
    const b = buehne.current;
    if (!b) return;
    b.kamera.position.copy(pos);
    b.steuerung.target.copy(ziel);
    b.steuerung.update();
    b.bedarf = true;
  };

  const vogelperspektive = () => {
    const m = mitte();
    const weite = Math.max(m.w, m.d);
    setzeKamera(new THREE.Vector3(m.x, weite * 0.8, m.z + m.d * 0.55 + weite * 0.15), new THREE.Vector3(m.x, 0, m.z));
  };

  const augenhoehe = () => {
    const m = mitte();
    setzeKamera(new THREE.Vector3(m.x, 165, m.z + m.d / 2 + 250), new THREE.Vector3(m.x, 120, m.z));
  };

  const zurAuswahl = () => {
    const store = usePlanStore.getState();
    const gewaehlt = store.projekt.elemente.filter((el) => store.auswahl.includes(el.id));
    if (gewaehlt.length === 0) {
      vogelperspektive();
      return;
    }
    const x = gewaehlt.reduce((s, el) => s + el.x, 0) / gewaehlt.length;
    const z = gewaehlt.reduce((s, el) => s + el.y, 0) / gewaehlt.length;
    const h = Math.max(...gewaehlt.map(hoeheVon));
    const weite = Math.max(...gewaehlt.map((el) => Math.max(el.breite, el.tiefe)), 200);
    setzeKamera(new THREE.Vector3(x + weite * 0.9, h * 0.6 + weite * 0.7, z + weite * 1.1), new THREE.Vector3(x, h / 2, z));
  };

  return (
    <div className="dreid" ref={behaelter}>
      <div className="dreid-leiste">
        <button className="knopf" onClick={vogelperspektive} title="Von schräg oben auf den ganzen Markt">
          Übersicht
        </button>
        <button className="knopf" onClick={augenhoehe} title="Wie ein Kunde am Eingang steht – 1,65 m über dem Boden">
          Augenhöhe
        </button>
        <button className="knopf" onClick={zurAuswahl} title="Zu den ausgewählten Möbeln (ohne Auswahl: Übersicht)">
          Zur Auswahl
        </button>
        <span className="dreid-hinweis">
          Ziehen dreht · Rad zoomt · rechte Taste verschiebt · Klick wählt aus
        </span>
        <button
          className="knopf knopf-haupt"
          onClick={() => usePlanStore.getState().setzeAnsicht3d(false)}
          title="Zurück in den Grundriss"
        >
          Zum Plan
        </button>
      </div>
      {szene.koerper.length <= 2 && (
        <div className="dreid-leer">
          Noch nichts geplant – im Grundriss Möbel setzen, dann hier ansehen.
        </div>
      )}
    </div>
  );
}
