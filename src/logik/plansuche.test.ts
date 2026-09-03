import { describe, expect, it } from 'vitest';
import { passgenauigkeit, suchtreffer, vergleichsform } from './plansuche';
import type { PlanElement, Projekt, Raum } from '../typen/modell';

/**
 * Die Suche im Plan.
 *
 * Geprüft wird vor allem die Reihenfolge: Eine Trefferliste, die das
 * Naheliegende nicht oben hat, ist so gut wie keine.
 */

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'v1',
    ebeneId: 'einrichtung',
    name: 'Wandregal',
    kategorie: 'regale',
    x: 100,
    y: 200,
    breite: 100,
    tiefe: 60,
    drehung: 0,
    form: 'rechteck',
    farbe: '#888',
    beschriftung: '',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
    ...teil,
  } as PlanElement;
}

function projekt(teil: Partial<Projekt>): Projekt {
  return {
    id: 'p1',
    name: 'Testmarkt',
    version: 19,
    erstelltAm: 0,
    geaendertAm: 0,
    grundflaeche: { umriss: [] },
    einstellungen: {},
    ebenen: [
      { id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false },
      { id: 'beschriftung', name: 'Beschriftung', sichtbar: false, gesperrt: false },
    ],
    raeume: [],
    verkaufsflaechen: [],
    waende: [],
    oeffnungen: [],
    elemente: [],
    gruppen: [],
    masslinien: [],
    ...teil,
  } as unknown as Projekt;
}

describe('vergleichsform', () => {
  it('loest Umlaute auf, damit schnelles Tippen trotzdem trifft', () => {
    expect(vergleichsform('Kühlregal')).toBe('kuhlregal');
    expect(vergleichsform('Öl & Essig')).toBe('ol & essig');
    expect(vergleichsform('Weißwurst')).toBe('weisswurst');
  });

  it('nimmt auch fremde Akzente mit', () => {
    expect(vergleichsform('Crème fraîche')).toBe('creme fraiche');
  });
});

describe('passgenauigkeit', () => {
  it('ordnet genau, am Anfang, am Wortanfang, irgendwo', () => {
    expect(passgenauigkeit('Kaffee', 'kaffee')).toBe(0);
    expect(passgenauigkeit('Kaffeegondel', 'kaffee')).toBe(1);
    expect(passgenauigkeit('Bio Kaffee', 'kaffee')).toBe(2);
    expect(passgenauigkeit('Bohnenkaffee', 'kaffee')).toBe(3);
  });

  it('meldet nichts, wenn nichts passt', () => {
    expect(passgenauigkeit('Wandregal', 'kaffee')).toBeNull();
    expect(passgenauigkeit('', 'kaffee')).toBeNull();
  });

  it('behandelt Sonderzeichen im Suchwort als Text, nicht als Muster', () => {
    // Ohne Maskierung wäre „O&G (roh)" ein kaputter regulärer Ausdruck.
    expect(() => passgenauigkeit('Regal O&G (roh)', 'o&g (roh)')).not.toThrow();
    expect(passgenauigkeit('Regal O&G (roh)', 'o&g (roh)')).not.toBeNull();
  });
});

describe('suchtreffer', () => {
  it('schweigt bei zu kurzer Eingabe', () => {
    const p = projekt({ elemente: [element({ beschriftung: 'Kaffee' })] });
    expect(suchtreffer(p, '')).toEqual([]);
    expect(suchtreffer(p, 'k')).toEqual([]);
  });

  it('findet über Beschriftung, Warengruppe und Notiz', () => {
    const p = projekt({
      elemente: [
        element({ id: 'a', beschriftung: 'Gondel A1000', warengruppe: 'Kaffee' }),
        element({ id: 'b', beschriftung: 'Kaffee & Tee' }),
        element({ id: 'c', beschriftung: 'Wandregal', notiz: 'Kaffee umräumen' }),
        element({ id: 'd', beschriftung: 'Konserven' }),
      ],
    });
    const treffer = suchtreffer(p, 'Kaffee');
    expect(treffer.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('nennt das Feld, in dem gefunden wurde', () => {
    const p = projekt({ elemente: [element({ beschriftung: 'Regal', notiz: 'Rückwand fehlt' })] });
    expect(suchtreffer(p, 'Rückwand')[0].fund).toBe('Notiz: Rückwand fehlt');
  });

  it('zeigt je Element nur den besten Fund', () => {
    const p = projekt({
      elemente: [element({ beschriftung: 'Kaffee', warengruppe: 'Kaffee', notiz: 'Kaffee' })],
    });
    const treffer = suchtreffer(p, 'Kaffee');
    expect(treffer).toHaveLength(1);
    // Im Titel gefunden: Die zweite Zeile wiederholt ihn nicht.
    expect(treffer[0].fund).toBe('');
    expect(treffer[0].bereich).toBe('Regale');
  });

  it('sucht auch in den Feldbeschriftungen eines Regals', () => {
    const p = projekt({
      elemente: [
        element({
          beschriftung: 'Gondel 3',
          warengruppenUnten: [{ von: 0, bis: 100, text: 'Nudeln' }],
        }),
      ],
    });
    expect(suchtreffer(p, 'Nudeln')[0].fund).toBe('Sortiment: Nudeln');
  });

  it('springt auf die Mitte des Elements', () => {
    const p = projekt({ elemente: [element({ x: 250, y: 480, beschriftung: 'Kaffee' })] });
    expect(suchtreffer(p, 'Kaffee')[0].punkt).toEqual({ x: 250, y: 480 });
  });

  it('findet Räume und springt in ihre Mitte', () => {
    const raum: Raum = {
      id: 'r1',
      name: 'Kühlraum',
      umriss: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ],
      art: 'lager',
      wandstaerke: 10,
      farbe: '#eee',
      beschriftungSichtbar: true,
      gesperrt: false,
    } as Raum;
    const treffer = suchtreffer(projekt({ raeume: [raum] }), 'Kuhlraum');
    expect(treffer).toHaveLength(1);
    expect(treffer[0].art).toBe('raum');
    expect(treffer[0].bereich).toBe('Raum');
    expect(treffer[0].punkt).toEqual({ x: 50, y: 25 });
  });

  it('lässt Treffer auf ausgeblendeten Ebenen nicht weg, kennzeichnet sie aber', () => {
    // Wegzulassen hieße zu behaupten, es gebe das Möbel nicht.
    const p = projekt({
      elemente: [
        element({ id: 'sichtbar', beschriftung: 'Kaffee' }),
        element({ id: 'weg', ebeneId: 'beschriftung', beschriftung: 'Kaffee' }),
      ],
    });
    const treffer = suchtreffer(p, 'Kaffee');
    expect(treffer).toHaveLength(2);
    expect(treffer.find((t) => t.id === 'weg')?.verborgen).toBe(true);
    expect(treffer.find((t) => t.id === 'sichtbar')?.verborgen).toBe(false);
  });

  it('hält die Reihenfolge bei Gleichstand fest', () => {
    // Sonst springt die Liste zwischen zwei Tastendrücken um, und man kann
    // sie nicht mit den Pfeiltasten durchgehen.
    const p = projekt({
      elemente: [
        element({ id: 'c', beschriftung: 'Kaffee Zucker' }),
        element({ id: 'a', beschriftung: 'Kaffee Bohnen' }),
        element({ id: 'b', beschriftung: 'Kaffee Filter' }),
      ],
    });
    expect(suchtreffer(p, 'Kaffee').map((t) => t.titel)).toEqual([
      'Kaffee Bohnen',
      'Kaffee Filter',
      'Kaffee Zucker',
    ]);
  });

  it('nimmt den Namen, wenn keine Beschriftung dasteht', () => {
    const p = projekt({ elemente: [element({ name: 'Kaffeegondel', beschriftung: '' })] });
    expect(suchtreffer(p, 'Kaffee')[0].titel).toBe('Kaffeegondel');
  });

  it('findet eine Notiz, die am Feld steht', () => {
    // Sie stand einmal in `feldnotizen` am Element und zog dann ans Feld.
    // Wer nur am alten Ort suchte, fand seit Fassung 9 nichts mehr.
    const p = projekt({
      elemente: [
        element({
          beschriftung: 'Zug 12',
          felderUnten: [{ breite: 100, notiz: 'Aktionspalette' }],
        }),
      ],
    });
    const treffer = suchtreffer(p, 'Aktionspalette');
    expect(treffer).toHaveLength(1);
    expect(treffer[0].titel).toBe('Zug 12');
  });

  it('findet eine Notiz auch am alten Ort', () => {
    // Eine Planung, die noch nicht durch die Umwandlung gelaufen ist.
    const p = projekt({
      elemente: [
        element({ beschriftung: 'Zug 13', feldnotizen: [{ unten: 'Kartoffelkiste' }] }),
      ],
    });
    expect(suchtreffer(p, 'Kartoffelkiste')).toHaveLength(1);
  });

  it('findet die Teilsortimente einer Strecke', () => {
    // Sie stehen bewusst nicht im Plan – umso mehr muss die Suche sie finden.
    const p = projekt({
      elemente: [
        element({
          beschriftung: 'Zug 14',
          warengruppenUnten: [{ von: 0, bis: 100, text: 'Kaffee', notiz: 'Bohnen, Pads' }],
        }),
      ],
    });
    expect(suchtreffer(p, 'Pads')).toHaveLength(1);
  });

  it('gibt nicht mehr zurück als verlangt', () => {
    const p = projekt({
      elemente: Array.from({ length: 80 }, (_, i) =>
        element({ id: `e${i}`, beschriftung: `Kaffee ${i}` }),
      ),
    });
    expect(suchtreffer(p, 'Kaffee')).toHaveLength(50);
    expect(suchtreffer(p, 'Kaffee', 5)).toHaveLength(5);
  });
});
