import { describe, expect, it } from 'vitest';
import { palettenplaetze } from './palettenplatz';

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
