import { describe, expect, it } from 'vitest';
import type { Grundflaeche, Raum, Wand } from '../typen/modell';
import { rechteck } from './polygon';
import {
  alleWandachsen,
  aufStrecke,
  fangbereich,
  findeWand,
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
