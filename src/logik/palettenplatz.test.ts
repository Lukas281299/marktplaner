import { describe, expect, it } from 'vitest';
import { aktionsflaechen, palettenplaetze } from './palettenplatz';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Prüfungen für die Palettenplätze einer Aktionsfläche.
 *
 * Der Fehler, um den es geht: Fläche geteilt durch Palettenfläche. Das
 * ergibt eine plausible Zahl, die zu groß ist – und zu groß heißt, dass eine
 * Palette im Gang stehen bleibt.
 */

describe('Palettenplätze', () => {
  it('rechnet den einfachen Fall', () => {
    // 2,40 x 0,80 m: zwei Europaletten längs nebeneinander.
    expect(palettenplaetze(240, 80).ganz).toBe(2);
    // 2,40 x 1,60 m: vier.
    expect(palettenplaetze(240, 160).ganz).toBe(4);
  });

  it('dreht die Palette, wenn es so besser passt', () => {
    // 0,80 x 2,40 m ist dieselbe Fläche hochkant.
    expect(palettenplaetze(80, 240).ganz).toBe(2);
    // 1,60 x 1,20 m: zwei quer, nicht eine längs.
    expect(palettenplaetze(160, 120).ganz).toBe(2);
  });

  it('rechnet nicht nach Fläche', () => {
    // 3,00 x 1,00 m sind 3 m² und damit rund drei Palettenflächen – hin
    // passen aber nur zwei. Genau dieser Fehler kostet eine Bestellung.
    expect(palettenplaetze(300, 100).ganz).toBe(2);
  });

  it('nutzt einen Schnitt, wo ein reines Raster verschenkt', () => {
    // 2,00 x 2,00 m: Ein reines Raster bringt zwei – 1,20 + 0,80 gehen quer
    // nicht auf. Mit einem Schnitt sind es drei: ein Streifen längs, daneben
    // einer quer.
    expect(palettenplaetze(200, 200).ganz).toBe(3);
  });

  it('verspricht nie mehr, als ein gerader Aufbau hergibt', () => {
    // In 2,00 x 2,00 m gehen im Windrad vier Paletten – jede an der nächsten
    // vorbeigedreht. Das rechnet hier niemand aus, und das ist Absicht: Die
    // Zahl soll stimmen, wenn man sie geradeaus hinstellt. Eine zu große
    // Zahl steht am Ende als Palette im Gang.
    expect(palettenplaetze(200, 200).ganz).toBeLessThanOrEqual(4);
  });

  it('zählt die kleineren Größen einzeln', () => {
    // Jede Zahl steht für sich: so viele ganze ODER so viele halbe.
    const p = palettenplaetze(240, 160);
    expect(p.ganz).toBe(4);
    expect(p.halb).toBe(8);
    expect(p.viertel).toBe(16);
  });

  it('kommt mit nichts zurecht', () => {
    expect(palettenplaetze(0, 200)).toEqual({ ganz: 0, halb: 0, viertel: 0 });
    expect(palettenplaetze(50, 30)).toEqual({ ganz: 0, halb: 0, viertel: 0 });
  });

  it('rechnet sich nicht fest', () => {
    // Eine große Fläche darf die Rechnung nicht anhalten – sie läuft über
    // jede mögliche Schnittstelle, und das müssen endlich viele bleiben.
    const anfang = Date.now();
    expect(palettenplaetze(5000, 3000).ganz).toBeGreaterThan(1500);
    expect(Date.now() - anfang).toBeLessThan(500);
  });
});

function flaeche(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'a1',
    vorlageId: 'aktion-2x2',
    ebeneId: 'einrichtung',
    name: 'Aktionsfläche',
    kategorie: 'aktion',
    x: 0,
    y: 0,
    breite: 200,
    tiefe: 200,
    drehung: 0,
    form: 'aktionsflaeche',
    farbe: '#eecc66',
    beschriftung: 'Aktionsfläche',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
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

describe('Aktionsflächen des ganzen Marktes', () => {
  it('rechnet die Fläche in Paletten um', () => {
    // Lukas' eigenes Beispiel: 200 m² Aktionsfläche. Eine CHEP misst
    // 0,96 m², also 208 Stück; halbe 0,48 m² → 416; viertel 0,24 → 833.
    const zehn = Array.from({ length: 50 }, (_, i) =>
      flaeche({ id: `a${i}`, breite: 400, tiefe: 100 }),
    );
    const a = aktionsflaechen(projekt(zehn));
    expect(a.qm).toBe(200);
    expect(a.umrechnung.ganz).toBe(208);
    expect(a.umrechnung.halb).toBe(416);
    expect(a.umrechnung.viertel).toBe(833);
  });

  it('stellt daneben, was ein gerader Aufbau hergibt', () => {
    // 4,00 × 1,00 m: rechnerisch vier CHEP, hinstellen lassen sich drei.
    const a = aktionsflaechen(projekt([flaeche({ breite: 400, tiefe: 100 })]));
    expect(a.umrechnung.ganz).toBe(4);
    expect(a.packung.ganz).toBe(3);
    // Die Packung ist nie größer als die Umrechnung – sonst stimmte eine der
    // beiden Rechnungen nicht.
    expect(a.packung.ganz).toBeLessThanOrEqual(a.umrechnung.ganz);
  });

  it('nimmt nur die Zonen und nicht die Möbel darauf', () => {
    // In derselben Kategorie stehen Paletten, Drehständer und Displays.
    const a = aktionsflaechen(
      projekt([
        flaeche({ breite: 200, tiefe: 200 }),
        flaeche({ id: 'p', form: 'palette', vorlageId: 'palette-chep', breite: 120, tiefe: 80 }),
      ]),
    );
    expect(a.anzahl).toBe(1);
    expect(a.qm).toBe(4);
  });

  it('lässt eine ausgeblendete Ebene weg', () => {
    expect(aktionsflaechen(projekt([flaeche({})], false)).anzahl).toBe(0);
  });
});
