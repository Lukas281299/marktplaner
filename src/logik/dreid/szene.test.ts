import { describe, expect, it } from 'vitest';
import { szeneAus, WANDHOEHE } from './szene';
import type { PlanElement, Projekt } from '../../typen/modell';

/**
 * Prüfungen für die Szene der 3D-Ansicht.
 *
 * Sie muss zeigen, was der Grundriss zeigt – nicht mehr und nicht weniger:
 * ausgeblendete Ebenen fehlen, Türen sind Löcher in der Wand, jedes Möbel
 * steht an seinem Ort und trägt seine Kennung, damit ein Klick es findet.
 */

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'wt-wand-1000-300-1400',
    ebeneId: 'einrichtung',
    name: 'Regal',
    kategorie: 'regale',
    x: 500,
    y: 400,
    breite: 100,
    tiefe: 37,
    hoehe: 140,
    drehung: 0,
    form: 'wt100',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
    beidseitig: false,
    achsmass: 100,
    felderUnten: [{ breite: 100, boeden: 5 }],
    ...teil,
  } as PlanElement;
}

const projekt = (teil: Partial<Projekt> = {}): Projekt =>
  ({
    id: 'p1',
    name: 'Prüfung',
    elemente: [],
    raeume: [],
    waende: [],
    oeffnungen: [],
    verkaufsflaechen: [],
    masslinien: [],
    gruppen: [],
    ebenen: [
      { id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false },
      { id: 'gebaeude', name: 'Gebäude', sichtbar: true, gesperrt: false },
    ],
    grundflaeche: {
      umriss: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 2500 },
        { x: 0, y: 2500 },
      ],
      wandstaerke: 30,
    },
    ...teil,
  }) as Projekt;

/** Die Körper, die zu einem Element gehören. */
const moebel = (szene: ReturnType<typeof szeneAus>) => szene.koerper.filter((k) => k.elementId);

describe('Die Szene', () => {
  it('nimmt den Rahmen aus der Grundfläche', () => {
    const s = szeneAus(projekt());
    expect(s.rahmen).toEqual({ links: 0, oben: 0, rechts: 4000, unten: 2500 });
  });

  it('stellt jedes Möbel an seinen Ort und behält seine Kennung', () => {
    const s = szeneAus(projekt({ elemente: [element({ x: 800, y: 600, drehung: 90 })] }));
    expect(moebel(s)).toHaveLength(1);
    expect(moebel(s)[0]).toMatchObject({ elementId: 'e1', x: 800, y: 600, drehung: 90 });
  });

  it('lässt aus, was auf einer ausgeblendeten Ebene liegt', () => {
    const p = projekt({
      elemente: [element({}), element({ id: 'e2', ebeneId: 'versteckt' })],
      ebenen: [
        { id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false },
        { id: 'versteckt', name: 'Versteckt', sichtbar: false, gesperrt: false },
      ],
    });
    expect(moebel(szeneAus(p)).map((k) => k.elementId)).toEqual(['e1']);
  });

  it('hat immer einen Fußboden, auch ohne Möbel', () => {
    const s = szeneAus(projekt());
    expect(s.koerper.some((k) => !k.elementId)).toBe(true);
  });
});

describe('Wände und Öffnungen', () => {
  const mitWand = (oeffnungen: Projekt['oeffnungen'] = []) =>
    projekt({
      waende: [
        {
          id: 'w1',
          von: { x: 500, y: 1000 },
          bis: { x: 1500, y: 1000 },
          staerke: 20,
          art: 'trennwand',
          gesperrt: false,
        },
      ],
      oeffnungen,
    });

  /** Die Stücke der Innenwand – der Körper, der 1000 lang und 20 tief ist. */
  const wandstuecke = (p: Projekt) =>
    szeneAus(p).koerper.find((k) => !k.elementId && Math.round(k.breite) === 1000 && k.tiefe === 20);

  it('zieht eine Innenwand über ihre volle Länge hoch', () => {
    const w = wandstuecke(mitWand());
    expect(w).toBeDefined();
    expect(w!.bauteile).toHaveLength(1);
    expect(w!.bauteile[0]).toMatchObject({ x: 0, b: 1000, h: WANDHOEHE });
  });

  it('lässt für eine Tür ein Loch und setzt den Sturz darüber', () => {
    const w = wandstuecke(
      mitWand([
        {
          id: 'o1',
          art: 'tuer',
          x: 1000,
          y: 1000,
          breite: 100,
          tiefe: 20,
          drehung: 0,
          gespiegelt: false,
          beschriftung: '',
          gesperrt: false,
        },
      ]),
    );
    expect(w).toBeDefined();
    // Links, Sturz, rechts – drei Stücke.
    expect(w!.bauteile).toHaveLength(3);
    const sturz = w!.bauteile.find((t) => t.art === 'quader' && t.z === 210);
    expect(sturz).toBeDefined();
    expect(sturz).toMatchObject({ b: 100, h: WANDHOEHE - 210 });
  });

  it('lässt unter einem Fenster die Brüstung stehen', () => {
    const w = wandstuecke(
      mitWand([
        {
          id: 'o2',
          art: 'fenster',
          x: 1000,
          y: 1000,
          breite: 150,
          tiefe: 20,
          drehung: 0,
          gespiegelt: false,
          beschriftung: '',
          gesperrt: false,
        },
      ]),
    );
    // Links, Brüstung, Sturz, rechts.
    expect(w!.bauteile).toHaveLength(4);
    expect(w!.bauteile.some((t) => t.art === 'quader' && t.z === 0 && t.b === 150)).toBe(true);
  });

  it('lässt eine Öffnung weg, die zu einer anderen Wand gehört', () => {
    const w = wandstuecke(
      mitWand([
        {
          id: 'o3',
          art: 'tuer',
          x: 1000,
          y: 2000,
          breite: 100,
          tiefe: 20,
          drehung: 0,
          gespiegelt: false,
          beschriftung: '',
          gesperrt: false,
        },
      ]),
    );
    expect(w!.bauteile).toHaveLength(1);
  });
});
