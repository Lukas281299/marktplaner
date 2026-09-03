import { describe, expect, it } from 'vitest';
import { getraenkezahlen } from './getraenkezahlen';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Prüfungen für die Getränkeabteilung.
 *
 * Zwei Zahlen, die auseinandergehalten werden müssen: Die Facings sagen, wie
 * **breit** das Sortiment ist, die Reihen, wie **tief** es steht. Fielen sie
 * zusammen, sähe man nicht mehr, ob die Gasse eng oder die Auswahl groß ist.
 */

function gestell(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'g1',
    vorlageId: 'getraenke-gestell-200',
    ebeneId: 'einrichtung',
    name: 'Getränkegestell',
    kategorie: 'getraenke',
    x: 0,
    y: 0,
    breite: 200,
    tiefe: 66,
    drehung: 0,
    form: 'getraenkegestell',
    farbe: '#999',
    beschriftung: '',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
    beidseitig: true,
    ...teil,
  } as PlanElement;
}

function projekt(elemente: PlanElement[], sichtbar = true): Projekt {
  return {
    id: 'p1',
    name: 'Testmarkt',
    version: 20,
    erstelltAm: 0,
    geaendertAm: 0,
    grundflaeche: { umriss: [], wandstaerke: 30 },
    einstellungen: {} as Projekt['einstellungen'],
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar, gesperrt: false }],
    raeume: [],
    waende: [],
    oeffnungen: [],
    elemente,
    gruppen: [],
    masslinien: [],
    verkaufsflaechen: [],
  } as unknown as Projekt;
}

describe('Getränkezahlen', () => {
  it('zählt die vordere Reihe je Seite', () => {
    // 2,00 m, Kisten längs (40 cm breit): 5 je Reihe, zwei Seiten = 10.
    const z = getraenkezahlen(projekt([gestell({ kisten: { lage: 'laengs', reihen: 2 } })]));
    expect(z.gestelle).toBe(1);
    expect(z.facings).toBe(10);
    // Alle Kisten: 5 je Reihe × 2 Reihen × 2 Seiten.
    expect(z.kisten).toBe(20);
  });

  it('unterscheidet längs und quer', () => {
    // Quer ist die Kiste 30 cm breit – auf 2,00 m passen sechs statt fünf.
    const quer = getraenkezahlen(projekt([gestell({ kisten: { lage: 'quer', reihen: 1 } })]));
    expect(quer.facings).toBe(12);
  });

  it('führt Tiefe und Reihen als eigene Zahl', () => {
    // Zur Gasse hin drei Reihen längs (je 30 cm tief), zur Wand hin eine.
    const z = getraenkezahlen(
      projekt([
        gestell({ kisten: { lage: 'laengs', reihen: 3, rueckseite: { lage: 'laengs', reihen: 1 } } }),
      ]),
    );
    expect(z.reihenMindestens).toBe(1);
    expect(z.reihenHoechstens).toBe(3);
    expect(z.tiefeHoechstens).toBe(90);
  });

  it('lässt eine Seite an der Wand weg', () => {
    const z = getraenkezahlen(
      projekt([gestell({ kisten: { lage: 'laengs', reihen: 2, einseitig: true } })]),
    );
    expect(z.facings).toBe(5);
    expect(z.laenge).toBe(200);
  });

  it('zählt eine ausgeblendete Ebene nicht mit', () => {
    const z = getraenkezahlen(projekt([gestell({ kisten: { lage: 'laengs', reihen: 2 } })], false));
    expect(z.gestelle).toBe(0);
    expect(z.facings).toBe(0);
  });

  it('kommt mit einem Markt ohne Getränke zurecht', () => {
    const z = getraenkezahlen(projekt([]));
    expect(z).toMatchObject({ gestelle: 0, facings: 0, kisten: 0, reihenMindestens: 0 });
  });
});
