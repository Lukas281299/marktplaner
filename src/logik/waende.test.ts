import { describe, expect, it } from 'vitest';
import type { Grundflaeche, Punkt, Raum, Wand } from '../typen/modell';
import { rechteck } from './polygon';
import {
  alleWandachsen,
  aufStrecke,
  fangbereich,
  findeWand,
  flaechenwandmasse,
  wandstaerkeAufKante,
  type Wandachse,
  richteWandAus,
  wandlaenge,
  wandwinkel,
} from './waende';

/**
 * Prüfungen für die Wandsuche.
 *
 * Der Kern: Eine Tür, die man auf die Außenwand setzt, muss **in** der Wand
 * sitzen – nicht auf ihrer Außenkante. Der Umriss ist das Außenmaß, die Achse
 * liegt eine halbe Wandstärke weiter innen. Geht das schief, sitzt jede Tür
 * um 15 cm daneben, und das fällt auf dem Bildschirm kaum auf.
 */

/** 40 × 25 m mit 30 cm Außenwand. */
const GEBAEUDE: Grundflaeche = { umriss: rechteck(0, 0, 4000, 2500), wandstaerke: 30 };

const LAGER: Raum = {
  id: 'raum-1',
  name: 'Lager',
  umriss: rechteck(3000, 0, 1000, 800),
  art: 'lager',
  wandstaerke: 20,
  farbe: '#eee',
  beschriftungSichtbar: true,
  gesperrt: false,
};

const INNENWAND: Wand = {
  id: 'wand-1',
  von: { x: 500, y: 1000 },
  bis: { x: 2000, y: 1000 },
  staerke: 12,
  art: 'trennwand',
  gesperrt: false,
};

describe('Wandachsen sammeln', () => {
  it('legt die Achse der Außenwand eine halbe Wandstärke nach innen', () => {
    const achsen = alleWandachsen(GEBAEUDE, [], []);
    const obere = achsen.find((a) => a.quelle === 'aussen' && a.von.y === 15);

    expect(obere).toBeDefined();
    // Der Umriss läuft bei y = 0, die Wandachse also bei y = 15.
    expect(obere?.von).toEqual({ x: 0, y: 15 });
    expect(obere?.bis).toEqual({ x: 4000, y: 15 });
    expect(obere?.staerke).toBe(30);
  });

  it('verschiebt auch die rechte Außenwand nach innen', () => {
    const achsen = alleWandachsen(GEBAEUDE, [], []);
    const rechte = achsen.find((a) => a.quelle === 'aussen' && a.von.x === 3985);

    expect(rechte).toBeDefined();
    expect(rechte?.bis.x).toBe(3985);
  });

  it('liefert vier Achsen je Rechteck', () => {
    expect(alleWandachsen(GEBAEUDE, [LAGER], [])).toHaveLength(8);
  });

  it('nimmt die Achse einer Innenwand unverändert', () => {
    const achsen = alleWandachsen(GEBAEUDE, [], [INNENWAND]);
    const innen = achsen.find((a) => a.quelle === 'innen');

    expect(innen?.von).toEqual({ x: 500, y: 1000 });
    expect(innen?.bis).toEqual({ x: 2000, y: 1000 });
    expect(innen?.id).toBe('wand-1');
  });

  it('lässt Räume ohne Wand weg', () => {
    const ohneWand: Raum = { ...LAGER, wandstaerke: 0 };
    expect(alleWandachsen(GEBAEUDE, [ohneWand], [])).toHaveLength(4);
  });
});

describe('Punkt auf eine Strecke setzen', () => {
  it('fällt das Lot', () => {
    expect(aufStrecke({ x: 500, y: 300 }, { x: 0, y: 0 }, { x: 1000, y: 0 })).toEqual({
      x: 500,
      y: 0,
    });
  });

  it('bleibt am Ende hängen, wenn der Punkt daneben liegt', () => {
    expect(aufStrecke({ x: 1500, y: 50 }, { x: 0, y: 0 }, { x: 1000, y: 0 })).toEqual({
      x: 1000,
      y: 0,
    });
  });
});

describe('Wandwinkel', () => {
  it('liefert 0 für eine waagerechte Wand', () => {
    expect(wandwinkel({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(0);
  });

  it('liefert 90 für eine senkrechte Wand', () => {
    expect(wandwinkel({ x: 0, y: 0 }, { x: 0, y: 100 })).toBe(90);
  });

  it('dreht eine rückwärts laufende Wand nicht auf den Kopf', () => {
    // Sonst stünde jede zweite Tür verkehrt herum in der Wand.
    expect(wandwinkel({ x: 100, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(wandwinkel({ x: 0, y: 100 }, { x: 0, y: 0 })).toBe(90);
  });
});

describe('Wand unter dem Mauszeiger', () => {
  const achsen = alleWandachsen(GEBAEUDE, [LAGER], [INNENWAND]);

  it('findet die Außenwand und setzt den Punkt genau hinein', () => {
    // Irgendwo an der oberen Außenwand geklickt, ein paar Zentimeter daneben.
    const treffer = findeWand({ x: 1200, y: 8 }, achsen, 50);

    expect(treffer?.quelle).toBe('aussen');
    expect(treffer?.punkt).toEqual({ x: 1200, y: 15 });
    expect(treffer?.winkel).toBe(0);
    expect(treffer?.staerke).toBe(30);
  });

  it('findet die Innenwand mit ihrer Stärke', () => {
    const treffer = findeWand({ x: 1000, y: 1004 }, achsen, 50);

    expect(treffer?.quelle).toBe('innen');
    expect(treffer?.id).toBe('wand-1');
    expect(treffer?.staerke).toBe(12);
    expect(treffer?.punkt).toEqual({ x: 1000, y: 1000 });
  });

  it('nimmt die nähere von zwei Wänden', () => {
    // Nahe der Ecke, wo Lagerwand und Außenwand dicht beieinanderliegen.
    const treffer = findeWand({ x: 3200, y: 400 }, achsen, 500);
    expect(treffer?.quelle).toBe('raum');
    expect(treffer?.id).toBe('raum-1');
  });

  it('findet nichts, wenn weit daneben geklickt wurde', () => {
    expect(findeWand({ x: 1500, y: 1500 }, achsen, 50)).toBeUndefined();
  });

  it('liefert für eine senkrechte Wand 90 Grad', () => {
    const treffer = findeWand({ x: 12, y: 1500 }, achsen, 50);
    expect(treffer?.winkel).toBe(90);
  });
});

describe('Wand ausrichten', () => {
  it('zieht eine fast waagerechte Wand gerade', () => {
    expect(richteWandAus({ x: 0, y: 0 }, { x: 1000, y: 40 })).toEqual({ x: 1000, y: 0 });
  });

  it('zieht eine fast senkrechte Wand gerade', () => {
    expect(richteWandAus({ x: 0, y: 0 }, { x: 40, y: 1000 })).toEqual({ x: 0, y: 1000 });
  });

  it('lässt eine deutlich schräge Wand in Ruhe', () => {
    // 45 Grad ist gewollt und darf nicht begradigt werden.
    expect(richteWandAus({ x: 0, y: 0 }, { x: 1000, y: 1000 })).toEqual({ x: 1000, y: 1000 });
  });

  it('kommt auch mit rückwärts gezogenen Wänden zurecht', () => {
    expect(richteWandAus({ x: 1000, y: 500 }, { x: 0, y: 530 })).toEqual({ x: 0, y: 500 });
  });

  it('gibt bei einem Punkt ohne Ausdehnung denselben Punkt zurück', () => {
    expect(richteWandAus({ x: 10, y: 10 }, { x: 10, y: 10 })).toEqual({ x: 10, y: 10 });
  });
});

describe('Wandlänge', () => {
  it('rechnet die Länge aus', () => {
    expect(wandlaenge(INNENWAND)).toBe(1500);
  });
});

describe('Fangbereich', () => {
  it('entspricht bei mittlerer Vergrößerung wenigen Bildpunkten', () => {
    // Bei 0,25 Bildpunkten je Zentimeter sind 14 Punkte 56 cm.
    expect(fangbereich(0.25)).toBe(56);
  });

  it('bleibt beim Hineinzoomen benutzbar', () => {
    // Sonst träfe man beim starken Vergrößern die Wand nicht mehr.
    expect(fangbereich(2)).toBe(25);
  });

  it('wächst beim Herauszoomen mit – aber nicht ins Uferlose', () => {
    // Ein weit herausgezoomter Plan: 14 Bildpunkte sind hier gut anderthalb
    // Meter. Mehr darf es nicht werden, sonst springt eine Tür an eine Wand,
    // an die niemand gedacht hat.
    expect(fangbereich(0.1)).toBe(140);
  });
});

/**
 * Prüfungen für das Verschieben einer Öffnung in ihrer Wand.
 *
 * Beim Ziehen wird die Maus auf die nächste Wandachse gelotet. Damit gleitet
 * eine Tür an der Wand entlang, statt aus ihr herauszufallen – und sie
 * übernimmt dabei Richtung und Stärke der Wand, in der sie landet.
 */
describe('Öffnung in der Wand verschieben', () => {
  const ACHSEN = alleWandachsen(GEBAEUDE, [], []);

  it('lotet einen Punkt neben der Wand auf die Wand', () => {
    // 60 cm unterhalb der oberen Außenwand gezogen.
    const treffer = findeWand({ x: 1600, y: 75 }, ACHSEN, fangbereich(1) * 4)!;
    expect(treffer).toBeDefined();
    // Die Achse der oberen Wand liegt eine halbe Wandstärke innen.
    expect(treffer.punkt.y).toBeCloseTo(15, 6);
    // Längs bleibt die Tür da, wo die Maus steht.
    expect(treffer.punkt.x).toBeCloseTo(1600, 6);
    expect(treffer.winkel).toBeCloseTo(0, 6);
    expect(treffer.staerke).toBe(30);
  });

  it('lässt die Tür längs der Wand wandern', () => {
    const a = findeWand({ x: 800, y: 40 }, ACHSEN, fangbereich(1) * 4)!;
    const b = findeWand({ x: 2400, y: 40 }, ACHSEN, fangbereich(1) * 4)!;
    expect(a.punkt.y).toBeCloseTo(b.punkt.y, 6);
    expect(b.punkt.x - a.punkt.x).toBeCloseTo(1600, 6);
  });

  it('übernimmt die Richtung der Wand, in die sie gezogen wird', () => {
    // An die linke Wand gezogen: dort steht die Tür senkrecht.
    const treffer = findeWand({ x: 60, y: 1200 }, ACHSEN, fangbereich(1) * 4)!;
    expect(treffer.punkt.x).toBeCloseTo(15, 6);
    expect(Math.abs(treffer.winkel)).toBeCloseTo(90, 6);
  });

  it('gibt weit außerhalb nichts zurück, damit sich die Tür versetzen lässt', () => {
    // Mitten im Raum ist keine Wand – dort bleibt die Öffnung frei liegen,
    // damit man sie überhaupt in eine andere Wand bringen kann.
    expect(findeWand({ x: 2000, y: 1250 }, ACHSEN, fangbereich(1) * 4)).toBeUndefined();
  });

  it('fängt beim Ziehen großzügiger als beim Setzen', () => {
    // 80 cm neben der Wand: zum Setzen zu weit, zum Weiterschieben nicht.
    const punkt = { x: 1600, y: 95 };
    expect(findeWand(punkt, ACHSEN, fangbereich(1))).toBeUndefined();
    expect(findeWand(punkt, ACHSEN, fangbereich(1) * 4)).toBeDefined();
  });
});

describe('Wandstärke auf einer Raumkante', () => {
  const achse = (
    von: Punkt,
    bis: Punkt,
    staerke: number,
  ): Wandachse => ({ von, bis, staerke, quelle: 'innen' });

  it('findet die Wand, die auf der Kante liegt', () => {
    const waende = [achse({ x: 0, y: 0 }, { x: 1000, y: 0 }, 24)];
    expect(wandstaerkeAufKante({ x: 0, y: 0 }, { x: 1000, y: 0 }, waende)).toBe(24);
  });

  it('nimmt die dickste, wenn mehrere darauf liegen', () => {
    const waende = [
      achse({ x: 0, y: 0 }, { x: 500, y: 0 }, 11.5),
      achse({ x: 500, y: 0 }, { x: 1000, y: 0 }, 36.5),
    ];
    expect(wandstaerkeAufKante({ x: 0, y: 0 }, { x: 1000, y: 0 }, waende)).toBe(36.5);
  });

  it('zählt eine Wand nicht mit, die die Kante nur kreuzt', () => {
    // Sie steht quer im Raum – dort, wo die Zahl steht, ist sie nicht.
    const quer = [achse({ x: 500, y: -200 }, { x: 500, y: 400 }, 24)];
    expect(wandstaerkeAufKante({ x: 0, y: 0 }, { x: 1000, y: 0 }, quer)).toBe(0);
  });

  it('zählt eine parallele Wand weiter drinnen nicht mit', () => {
    const weiter = [achse({ x: 0, y: 300 }, { x: 1000, y: 300 }, 24)];
    expect(wandstaerkeAufKante({ x: 0, y: 0 }, { x: 1000, y: 0 }, weiter)).toBe(0);
  });

  it('lässt eine Wand gelten, die neben der Achse auf der Kante liegt', () => {
    // Der Umriss kann auf der Achse liegen oder auf einer ihrer Seiten.
    const versetzt = [achse({ x: 0, y: 12 }, { x: 1000, y: 12 }, 24)];
    expect(wandstaerkeAufKante({ x: 0, y: 0 }, { x: 1000, y: 0 }, versetzt)).toBe(24);
  });

  it('zählt eine Wand nicht mit, die nur daneben endet', () => {
    const daneben = [achse({ x: 1200, y: 0 }, { x: 1800, y: 0 }, 24)];
    expect(wandstaerkeAufKante({ x: 0, y: 0 }, { x: 1000, y: 0 }, daneben)).toBe(0);
  });
});

describe('Wand als Fläche', () => {
  it('liest Länge und Dicke aus einem liegenden Rechteck', () => {
    const m = flaechenwandmasse(rechteck(100, 200, 500, 24))!;
    expect(Math.round(m.laenge)).toBe(500);
    expect(Math.round(m.dicke)).toBe(24);
    expect(Math.round(m.flaeche)).toBe(500 * 24);
    // Die Achse liegt mittig auf der langen Seite.
    expect(m.von).toEqual({ x: 100, y: 212 });
    expect(m.bis).toEqual({ x: 600, y: 212 });
  });

  it('erkennt auch eine stehende Wand', () => {
    const m = flaechenwandmasse(rechteck(500, 100, 30, 800))!;
    expect(Math.round(m.laenge)).toBe(800);
    expect(Math.round(m.dicke)).toBe(30);
  });

  it('kommt mit einer Schräge zurecht', () => {
    // Ein um 45 Grad gedrehtes Rechteck, 400 lang und 20 dick.
    const w = 45 * (Math.PI / 180);
    const dreh = (x: number, y: number) => ({
      x: x * Math.cos(w) - y * Math.sin(w),
      y: x * Math.sin(w) + y * Math.cos(w),
    });
    const m = flaechenwandmasse([dreh(0, 0), dreh(400, 0), dreh(400, 20), dreh(0, 20)])!;
    expect(Math.round(m.laenge)).toBe(400);
    expect(Math.round(m.dicke)).toBe(20);
    expect(Math.round(wandwinkel(m.von, m.bis))).toBe(45);
  });

  it('gibt bei einem Trapez die mittlere Dicke', () => {
    // Vorn 20 dick, hinten 40 – im Mittel 30.
    const m = flaechenwandmasse([
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 40 },
      { x: 0, y: 20 },
    ])!;
    // Die schmalste Richtung läuft hier haarscharf an der schrägen Kante
    // entlang und wäre einen Zentimeter länger. Unter den fast gleich
    // schmalen Richtungen gewinnt die kürzeste – die gerade Unterkante, die
    // der Planer gezogen hat.
    expect(Math.round(m.laenge)).toBe(600);
    expect(Math.round(m.dicke)).toBe(30);
  });

  it('meldet nichts bei einem entarteten Umriss', () => {
    expect(flaechenwandmasse([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBeNull();
    expect(
      flaechenwandmasse([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]),
    ).toBeNull();
  });
});
