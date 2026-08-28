import { describe, expect, it } from 'vitest';
import { berechneFlaechen, gruenekisten, vereinigteFlaeche } from './flaechen';
import { neuesProjekt } from '../daten/standardProjekt';
import { rechteck } from './polygon';
import type { PlanElement, Projekt, Punkt, Raum, Verkaufsflaeche } from '../typen/modell';

/**
 * Prüfungen für die Flächenrechnung, vor allem für die eingezeichnete
 * Verkaufsfläche.
 *
 * Warum ausgerechnet hier so genau: Ein Fehler bleibt still. Eine falsche
 * Quadratmeterzahl sieht auf dem Bildschirm genauso aus wie eine richtige –
 * auffallen würde sie erst, wenn jemand danach eine Miete rechnet oder eine
 * Sortimentsfläche plant.
 *
 * Gerechnet wird intern in Quadratzentimetern. 100 m² sind 1 000 000 cm².
 */

const QM = 10_000;

/** Ein Rechteck aus Metern. */
function rechteckM(x: number, y: number, breite: number, hoehe: number): Punkt[] {
  return rechteck(x * 100, y * 100, breite * 100, hoehe * 100);
}

function markierung(id: string, umriss: Punkt[], name = id): Verkaufsflaeche {
  return { id, name, umriss, farbe: '#2f9e44', beschriftungSichtbar: true, gesperrt: false };
}

function raum(id: string, umriss: Punkt[], art: Raum['art']): Raum {
  return {
    id,
    name: id,
    umriss,
    art,
    // Ohne Wandstärke ist die Raumfläche genau die Polygonfläche – sonst
    // müsste jede Erwartung hier den Wandabzug mitrechnen.
    wandstaerke: 0,
    farbe: '#eee',
    beschriftungSichtbar: true,
    gesperrt: false,
  };
}

/** Ein Möbel mit Mittelpunkt in Metern und Grundfläche in Metern. */
function moebel(id: string, xM: number, yM: number, breiteM: number, tiefeM: number): PlanElement {
  return {
    id,
    vorlageId: 'test',
    ebeneId: 'einrichtung',
    name: id,
    kategorie: 'regale',
    x: xM * 100,
    y: yM * 100,
    breite: breiteM * 100,
    tiefe: tiefeM * 100,
    drehung: 0,
    form: 'rechteck',
    farbe: '#888',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
  };
}

/** Ein Projekt von 40 × 25 m ohne Wandstärke – runde Zahlen zum Nachrechnen. */
function projekt(werte: Partial<Projekt> = {}): Projekt {
  const p = neuesProjekt('Prüfung', 4000, 2500);
  return { ...p, grundflaeche: { ...p.grundflaeche, wandstaerke: 0 }, ...werte };
}

describe('Vereinigte Fläche', () => {
  it('nimmt ein einzelnes Rechteck, wie es ist', () => {
    expect(vereinigteFlaeche([rechteckM(0, 0, 10, 5)])).toBeCloseTo(50 * QM, 3);
  });

  it('zählt zwei getrennte Flächen zusammen', () => {
    const summe = vereinigteFlaeche([rechteckM(0, 0, 10, 5), rechteckM(20, 0, 4, 5)]);
    expect(summe).toBeCloseTo(70 * QM, 3);
  });

  it('zählt die Überschneidung nur einmal', () => {
    // 10 × 5 und 10 × 5, um 5 m versetzt: zusammen 15 × 5 = 75 m², nicht 100.
    const summe = vereinigteFlaeche([rechteckM(0, 0, 10, 5), rechteckM(5, 0, 10, 5)]);
    expect(summe).toBeCloseTo(75 * QM, 3);
  });

  it('zieht ein Loch ab, das beim Vereinigen entsteht', () => {
    // Vier Streifen als Rahmen um ein Loch von 10 × 10 m. Der Rahmen misst
    // außen 30 × 30 = 900 m², das Loch 100 m² – bleiben 800 m².
    const rahmenteile = [
      rechteckM(0, 0, 30, 10),
      rechteckM(0, 20, 30, 10),
      rechteckM(0, 10, 10, 10),
      rechteckM(20, 10, 10, 10),
    ];
    expect(vereinigteFlaeche(rahmenteile)).toBeCloseTo(800 * QM, 2);
  });

  it('kommt mit nichts und mit Bruchstücken zurecht', () => {
    expect(vereinigteFlaeche([])).toBe(0);
    // Zwei Punkte sind noch keine Fläche.
    expect(vereinigteFlaeche([[{ x: 0, y: 0 }, { x: 100, y: 0 }]])).toBe(0);
  });
});

describe('Verkaufsfläche ohne Markierung', () => {
  it('rechnet wie bisher: Innenfläche minus Nebenräume', () => {
    const f = berechneFlaechen(
      projekt({ raeume: [raum('lager', rechteckM(0, 0, 10, 10), 'lager')] }),
    );
    expect(f.verkaufsflaecheMarkiert).toBe(false);
    expect(f.netto).toBeCloseTo(1000 * QM, 2);
    expect(f.nebenflaeche).toBeCloseTo(100 * QM, 2);
    expect(f.verkaufsflaeche).toBeCloseTo(900 * QM, 2);
    expect(f.verkaufsflaechen).toEqual([]);
  });

  it('zieht einen Verkaufsraum nicht ab', () => {
    const f = berechneFlaechen(
      projekt({ raeume: [raum('markt', rechteckM(0, 0, 10, 10), 'verkauf')] }),
    );
    expect(f.nebenflaeche).toBe(0);
    expect(f.verkaufsflaeche).toBeCloseTo(1000 * QM, 2);
  });
});

describe('Verkaufsfläche mit Markierung', () => {
  it('nimmt die eingezeichnete Fläche statt der gerechneten', () => {
    const f = berechneFlaechen(
      projekt({ verkaufsflaechen: [markierung('v1', rechteckM(0, 0, 20, 15))] }),
    );
    expect(f.verkaufsflaecheMarkiert).toBe(true);
    expect(f.verkaufsflaeche).toBeCloseTo(300 * QM, 2);
    // Die Innenfläche wäre 1000 m² – die Markierung schlägt sie.
    expect(f.netto).toBeCloseTo(1000 * QM, 2);
  });

  it('zählt mehrere Teilflächen zusammen', () => {
    const f = berechneFlaechen(
      projekt({
        verkaufsflaechen: [
          markierung('v1', rechteckM(0, 0, 20, 15)),
          markierung('v2', rechteckM(25, 0, 10, 10)),
        ],
      }),
    );
    expect(f.verkaufsflaeche).toBeCloseTo(400 * QM, 2);
    expect(f.verkaufsflaechen).toHaveLength(2);
    // Sortiert, größte zuerst – so steht die Hauptfläche oben.
    expect(f.verkaufsflaechen[0].id).toBe('v1');
  });

  it('zählt eine Überschneidung zweier Teilflächen nur einmal', () => {
    const f = berechneFlaechen(
      projekt({
        verkaufsflaechen: [
          markierung('v1', rechteckM(0, 0, 20, 10)),
          markierung('v2', rechteckM(10, 0, 20, 10)),
        ],
      }),
    );
    // Zusammen 30 × 10 = 300 m², obwohl die Einzelflächen 200 + 200 ergäben.
    expect(f.verkaufsflaeche).toBeCloseTo(300 * QM, 2);
    // Einzeln steht trotzdem jede mit ihrer eigenen Fläche da – sonst wäre
    // die Liste nicht mehr nachvollziehbar.
    expect(f.verkaufsflaechen[0].flaeche).toBeCloseTo(200 * QM, 2);
  });

  it('lässt die Nebenräume außen vor', () => {
    // Gezeichnet schlägt gerechnet: Wer die Fläche selbst einzeichnet, will
    // nicht, dass ihm daneben noch ein Lagerraum davon abgezogen wird.
    const f = berechneFlaechen(
      projekt({
        raeume: [raum('lager', rechteckM(0, 0, 10, 10), 'lager')],
        verkaufsflaechen: [markierung('v1', rechteckM(0, 0, 20, 15))],
      }),
    );
    expect(f.verkaufsflaeche).toBeCloseTo(300 * QM, 2);
    // Die Nebenfläche wird weiter ausgewiesen, sie greift nur nicht mehr ein.
    expect(f.nebenflaeche).toBeCloseTo(100 * QM, 2);
  });

  it('übergeht eine Teilfläche mit zu wenigen Ecken', () => {
    const kaputt = markierung('kaputt', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const f = berechneFlaechen(
      projekt({ verkaufsflaechen: [kaputt, markierung('v1', rechteckM(0, 0, 20, 15))] }),
    );
    expect(f.verkaufsflaeche).toBeCloseTo(300 * QM, 2);
    expect(f.verkaufsflaechen.map((v) => v.id)).toEqual(['v1']);
  });

  it('fällt auf die Rechnung zurück, wenn die letzte Markierung weg ist', () => {
    const f = berechneFlaechen(projekt({ verkaufsflaechen: [] }));
    expect(f.verkaufsflaecheMarkiert).toBe(false);
    expect(f.verkaufsflaeche).toBeCloseTo(1000 * QM, 2);
  });
});

describe('Belegte und freie Fläche', () => {
  it('zählt ohne Markierung jedes Element mit', () => {
    const f = berechneFlaechen(
      projekt({ elemente: [moebel('a', 5, 5, 2, 1), moebel('b', 35, 20, 2, 1)] }),
    );
    expect(f.belegt).toBeCloseTo(4 * QM, 3);
    expect(f.belegtInVerkauf).toBeCloseTo(f.belegt, 3);
  });

  it('zählt mit Markierung nur, was auch darauf steht', () => {
    // a steht in der Markierung, b weit außerhalb im Lagerbereich.
    const f = berechneFlaechen(
      projekt({
        verkaufsflaechen: [markierung('v1', rechteckM(0, 0, 20, 15))],
        elemente: [moebel('a', 5, 5, 2, 1), moebel('b', 35, 20, 2, 1)],
      }),
    );
    expect(f.belegt).toBeCloseTo(4 * QM, 3);
    expect(f.belegtInVerkauf).toBeCloseTo(2 * QM, 3);
    // Die freie Fläche rechnet mit dem, was wirklich darauf steht.
    expect(f.frei).toBeCloseTo(300 * QM - 2 * QM, 2);
  });

  it('entscheidet am Mittelpunkt des Möbels', () => {
    // Das Regal liegt mit seinem Mittelpunkt 50 cm außerhalb der Kante,
    // ragt aber mit der halben Breite hinein. Es zählt trotzdem nicht mit –
    // die Regel ist der Mittelpunkt, und sie gilt in beide Richtungen.
    const f = berechneFlaechen(
      projekt({
        verkaufsflaechen: [markierung('v1', rechteckM(0, 0, 20, 15))],
        elemente: [moebel('kante', 20.5, 5, 4, 1)],
      }),
    );
    expect(f.belegtInVerkauf).toBe(0);
  });

  it('lässt die freie Fläche nicht unter null rutschen', () => {
    const f = berechneFlaechen(
      projekt({
        verkaufsflaechen: [markierung('v1', rechteckM(0, 0, 2, 2))],
        elemente: [moebel('riese', 1, 1, 30, 20)],
      }),
    );
    expect(f.frei).toBe(0);
  });
});

describe('Grüne Kisten in Obst und Gemüse', () => {
  const moebel = (kategorie: string, auslagen?: number, ifkoKisten?: number) =>
    ({
      id: `el-${Math.random()}`, vorlageId: 'v', ebeneId: 'einrichtung', name: 'M',
      kategorie, x: 0, y: 0, breite: 125, tiefe: 100, drehung: 0, form: 'vitable',
      farbe: '#fff', beschriftung: '', beschriftungSichtbar: false, schriftgroesse: 12,
      gesperrt: false, reihenfolge: 0, auslagen, ifkoKisten,
    }) as unknown as Projekt['elemente'][number];

  const mit = (elemente: Projekt['elemente']): Projekt => ({ ...neuesProjekt(), elemente });

  it('zählt zusammen, was an den Möbeln steht', () => {
    const p = mit([
      moebel('obstgemuese', 3, 12),
      moebel('obstgemuese', 4, 16),
      moebel('obstgemuese', 2, 8),
    ]);
    expect(gruenekisten(p)).toEqual({ moebel: 3, kisten: 36, auslagen: 9 });
  });

  it('lässt Möbel anderer Abteilungen aus', () => {
    // Ein Regal hat keine grünen Kisten – auch nicht, wenn dort eine Zahl steht.
    const p = mit([moebel('obstgemuese', 3, 12), moebel('regale', 5, 99)]);
    expect(gruenekisten(p).kisten).toBe(12);
  });

  it('zählt nur Möbel mit, an denen etwas steht', () => {
    // Ein Tisch ohne Angabe ist keine Null, sondern eine offene Frage – er
    // darf die Zahl „auf wie vielen Möbeln" nicht aufblähen.
    const p = mit([moebel('obstgemuese', 3, 12), moebel('obstgemuese')]);
    expect(gruenekisten(p).moebel).toBe(1);
  });

  it('kommt mit einer leeren Planung zurecht', () => {
    expect(gruenekisten(neuesProjekt())).toEqual({ moebel: 0, kisten: 0, auslagen: 0 });
  });
});
