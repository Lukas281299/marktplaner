import { describe, expect, it } from 'vitest';
import type { PlanElement } from '../typen/modell';
import { hauptrichtung, mitGruppen, mitgliederVon, reiheAneinander } from './gruppen';

/** Ein Regal, 125 cm breit und 60 cm tief – ein übliches Feld. */
function regal(id: string, x: number, y: number, zusatz: Partial<PlanElement> = {}): PlanElement {
  return {
    id,
    vorlageId: 'regal-trocken',
    ebeneId: 'einrichtung',
    name: 'Regal',
    kategorie: 'regale',
    x,
    y,
    breite: 125,
    tiefe: 60,
    drehung: 0,
    form: 'rechteck',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
    ...zusatz,
  };
}

describe('Gruppenmitglieder', () => {
  const elemente = [
    regal('a', 0, 0, { gruppeId: 'g1' }),
    regal('b', 200, 0, { gruppeId: 'g1' }),
    regal('c', 400, 0),
  ];

  it('liefert bei einem Element ohne Gruppe nur dieses', () => {
    expect(mitgliederVon(elemente, 'c')).toEqual(['c']);
  });

  it('liefert bei einer Gruppe alle Mitglieder', () => {
    expect(mitgliederVon(elemente, 'a').sort()).toEqual(['a', 'b']);
  });

  it('liefert für ein unbekanntes Element nichts', () => {
    expect(mitgliederVon(elemente, 'gibtsnicht')).toEqual([]);
  });

  it('erweitert eine Auswahl um die Gruppen', () => {
    expect(mitGruppen(elemente, ['a', 'c']).sort()).toEqual(['a', 'b', 'c']);
  });

  it('zählt kein Element doppelt', () => {
    expect(mitGruppen(elemente, ['a', 'b'])).toHaveLength(2);
  });
});

describe('Aneinanderreihen', () => {
  it('schließt eine Lücke zwischen zwei Regalen', () => {
    // Zwei 125 breite Regale: Mitte bei 0 und bei 500 – zu weit auseinander.
    const neu = reiheAneinander([regal('a', 100, 50), regal('b', 500, 50)], 'waagerecht');

    expect(neu).toEqual([{ id: 'b', x: 225, y: 50 }]);
    // Rechte Kante von a: 100 + 62,5 = 162,5. Linke Kante von b danach:
    // 225 - 62,5 = 162,5. Bündig, ohne Lücke.
  });

  it('lässt das erste Regal stehen', () => {
    const neu = reiheAneinander([regal('a', 100, 50), regal('b', 500, 50)], 'waagerecht');
    expect(neu.some((e) => e.id === 'a')).toBe(false);
  });

  it('reiht drei Regale lückenlos', () => {
    const neu = reiheAneinander(
      [regal('a', 0, 0), regal('b', 900, 0), regal('c', 1800, 0)],
      'waagerecht',
    );
    expect(neu.map((e) => e.x)).toEqual([125, 250]);
  });

  it('reiht auch senkrecht', () => {
    const neu = reiheAneinander(
      [regal('a', 0, 0), regal('b', 0, 800)],
      'senkrecht',
    );
    // Tiefe 60, also rückt b auf y = 60.
    expect(neu).toEqual([{ id: 'b', x: 0, y: 60 }]);
  });

  it('rechnet bei gedrehten Regalen mit der Umgrenzung', () => {
    // Um 90° gedreht ist das Regal in X-Richtung nur noch 60 breit.
    const neu = reiheAneinander(
      [regal('a', 0, 0, { drehung: 90 }), regal('b', 500, 0, { drehung: 90 })],
      'waagerecht',
    );
    expect(neu[0].x).toBeCloseTo(60, 5);
  });

  it('geht nach der Lage vor, nicht nach der Reihenfolge in der Liste', () => {
    const neu = reiheAneinander([regal('b', 900, 0), regal('a', 0, 0)], 'waagerecht');
    // a steht links, bleibt also stehen; b rückt heran.
    expect(neu.map((e) => e.id)).toEqual(['b']);
  });

  it('lässt gesperrte Regale außen vor', () => {
    const neu = reiheAneinander(
      [regal('a', 0, 0), regal('b', 900, 0, { gesperrt: true })],
      'waagerecht',
    );
    expect(neu).toEqual([]);
  });

  it('tut bei einem einzelnen Regal nichts', () => {
    expect(reiheAneinander([regal('a', 0, 0)], 'waagerecht')).toEqual([]);
  });
});

describe('Hauptrichtung', () => {
  it('erkennt einen waagerechten Zug', () => {
    expect(hauptrichtung([regal('a', 0, 0), regal('b', 900, 20)])).toBe('waagerecht');
  });

  it('erkennt einen senkrechten Zug', () => {
    expect(hauptrichtung([regal('a', 0, 0), regal('b', 20, 900)])).toBe('senkrecht');
  });

  it('nimmt bei einem einzelnen Element waagerecht an', () => {
    expect(hauptrichtung([regal('a', 0, 0)])).toBe('waagerecht');
  });
});
