import { describe, expect, it } from 'vitest';
import type { Punkt } from '../typen/modell';
import {
  aussenmasse,
  flaeche,
  imUhrzeigersinn,
  kanten,
  kantenVersatz,
  punktInnerhalb,
  rahmen,
  rechteck,
  rechteckAusEcken,
  umfang,
  vereinfache,
  vereinige,
  verschiebe,
  vorzeichenFlaeche,
  ziehAb,
} from './polygon';

/**
 * Prüfungen für die Umriss-Rechnerei.
 *
 * Alle Maße in Zentimetern. Ein Markt von 40 × 25 m sind 4000 × 2500 cm und
 * damit 10.000.000 cm² – die Zahlen sehen groß aus, sind aber genau die, mit
 * denen der Marktplaner rechnet.
 */

/** 10 × 20 m, an der linken oberen Ecke. */
const HALLE = rechteck(0, 0, 1000, 2000);

describe('Fläche', () => {
  it('rechnet ein Rechteck aus', () => {
    expect(flaeche(HALLE)).toBe(1000 * 2000);
  });

  it('rechnet ein Dreieck aus', () => {
    const dreieck: Punkt[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(flaeche(dreieck)).toBe(5000);
  });

  it('kümmert sich nicht um den Umlaufsinn', () => {
    expect(flaeche([...HALLE].reverse())).toBe(flaeche(HALLE));
  });

  it('rechnet eine L-Form aus', () => {
    // Ein 1000 × 1000 großes Quadrat mit einem 400 × 400 großen Eck weg.
    const l: Punkt[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 600 },
      { x: 600, y: 600 },
      { x: 600, y: 1000 },
      { x: 0, y: 1000 },
    ];
    expect(flaeche(l)).toBe(1000 * 1000 - 400 * 400);
  });

  it('liefert für weniger als drei Punkte null', () => {
    expect(flaeche([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(0);
  });
});

describe('Umlaufsinn', () => {
  it('erkennt den Uhrzeigersinn', () => {
    // Auf dem Bildschirm zeigt y nach unten, deshalb ist diese Reihenfolge
    // im Uhrzeigersinn und die Fläche positiv.
    expect(vorzeichenFlaeche(HALLE)).toBeGreaterThan(0);
  });

  it('dreht einen gegenläufigen Umriss um', () => {
    const gegen = [...HALLE].reverse();
    expect(vorzeichenFlaeche(imUhrzeigersinn(gegen))).toBeGreaterThan(0);
  });

  it('lässt einen bereits passenden Umriss in Ruhe', () => {
    expect(imUhrzeigersinn(HALLE)).toEqual(HALLE);
  });
});

describe('Umgrenzung und Maße', () => {
  it('findet die Umgrenzung', () => {
    expect(rahmen(verschiebe(HALLE, 500, 300))).toEqual({
      links: 500,
      oben: 300,
      rechts: 1500,
      unten: 2300,
    });
  });

  it('liefert Breite und Länge auch für eine schiefe Form', () => {
    const schief: Punkt[] = [
      { x: 0, y: 0 },
      { x: 800, y: 200 },
      { x: 600, y: 900 },
    ];
    expect(aussenmasse(schief)).toEqual({ breite: 800, laenge: 900 });
  });

  it('rechnet den Umfang aus', () => {
    expect(umfang(HALLE)).toBe(2 * (1000 + 2000));
  });
});

describe('Punkt im Umriss', () => {
  it('erkennt innen und außen', () => {
    expect(punktInnerhalb({ x: 500, y: 1000 }, HALLE)).toBe(true);
    expect(punktInnerhalb({ x: 1500, y: 1000 }, HALLE)).toBe(false);
    expect(punktInnerhalb({ x: 500, y: -10 }, HALLE)).toBe(false);
  });

  it('erkennt die Aussparung einer L-Form', () => {
    const l: Punkt[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 600 },
      { x: 600, y: 600 },
      { x: 600, y: 1000 },
      { x: 0, y: 1000 },
    ];
    expect(punktInnerhalb({ x: 300, y: 300 }, l)).toBe(true);
    // Genau im weggeschnittenen Eck:
    expect(punktInnerhalb({ x: 800, y: 800 }, l)).toBe(false);
  });
});

describe('Kanten', () => {
  it('liefert für ein Rechteck vier Kanten mit Richtung', () => {
    const k = kanten(HALLE);
    expect(k).toHaveLength(4);
    expect(k.map((e) => e.richtung)).toEqual([
      'waagerecht',
      'senkrecht',
      'waagerecht',
      'senkrecht',
    ]);
    expect(k[0].laenge).toBe(1000);
    expect(k[1].laenge).toBe(2000);
  });

  it('erkennt eine schräge Kante', () => {
    const dreieck: Punkt[] = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 0, y: 400 },
    ];
    const k = kanten(dreieck);
    expect(k[1].richtung).toBe('schraeg');
    expect(k[1].laenge).toBe(500);
  });

  it('setzt die Maßzahl außerhalb der Fläche', () => {
    // Die obere Kante eines im Uhrzeigersinn umlaufenden Rechtecks: Die
    // Maßzahl gehört oberhalb, also auf ein kleineres y.
    const oben = kanten(HALLE)[0];
    const versatz = kantenVersatz(oben, 50, HALLE);
    expect(versatz.y).toBeLessThan(0);
    expect(punktInnerhalb(versatz, HALLE)).toBe(false);
  });
});

describe('Aufräumen', () => {
  it('entfernt doppelte Punkte', () => {
    const mitDoppel: Punkt[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(vereinfache(mitDoppel)).toHaveLength(3);
  });

  it('entfernt Punkte mitten auf einer geraden Kante', () => {
    const mitPunktAufKante: Punkt[] = [
      { x: 0, y: 0 },
      { x: 500, y: 0 }, // liegt auf der Strecke 0,0 → 1000,0
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ];
    expect(vereinfache(mitPunktAufKante)).toHaveLength(4);
  });

  it('lässt eine echte Ecke stehen', () => {
    expect(vereinfache(HALLE)).toHaveLength(4);
  });
});

describe('Flächen zusammenfügen', () => {
  it('setzt zwei aneinandergrenzende Rechtecke zu einem zusammen', () => {
    // Der klassische Fall: ein Anbau an der rechten Seite.
    const anbau = rechteck(1000, 0, 500, 2000);
    const ergebnis = vereinige(HALLE, anbau);

    expect(ergebnis.hinweis).toBeUndefined();
    expect(flaeche(ergebnis.umriss)).toBe(1500 * 2000);
    // Aus zwei Rechtecken wird eines – die Naht in der Mitte fällt weg.
    expect(ergebnis.umriss).toHaveLength(4);
  });

  it('setzt überlappende Rechtecke zu einer L-Form zusammen', () => {
    const zweiter = rechteck(800, 1800, 1000, 800);
    const ergebnis = vereinige(HALLE, zweiter);

    expect(ergebnis.hinweis).toBeUndefined();
    // Gesamtfläche minus der doppelt gezählten Überlappung.
    const ueberlappung = 200 * 200;
    expect(flaeche(ergebnis.umriss)).toBe(1000 * 2000 + 1000 * 800 - ueberlappung);
  });

  it('sagt Bescheid, wenn die Teile sich nicht berühren', () => {
    const weitWeg = rechteck(5000, 5000, 500, 500);
    const ergebnis = vereinige(HALLE, weitWeg);

    expect(ergebnis.hinweis).toContain('getrennte Teile');
    // Übernommen wird der größere – die Halle.
    expect(flaeche(ergebnis.umriss)).toBe(1000 * 2000);
  });

  it('nimmt den Zusatz, wenn noch kein Umriss da ist', () => {
    expect(flaeche(vereinige([], HALLE).umriss)).toBe(1000 * 2000);
  });
});

describe('Flächen abziehen', () => {
  it('schneidet ein Eck heraus', () => {
    const eck = rechteck(600, 1600, 400, 400);
    const ergebnis = ziehAb(HALLE, eck);

    expect(ergebnis.hinweis).toBeUndefined();
    expect(flaeche(ergebnis.umriss)).toBe(1000 * 2000 - 400 * 400);
    expect(ergebnis.umriss).toHaveLength(6);
  });

  it('schneidet eine Kerbe an der Kante heraus', () => {
    const kerbe = rechteck(400, -100, 200, 400);
    const ergebnis = ziehAb(HALLE, kerbe);

    expect(ergebnis.hinweis).toBeUndefined();
    // Nur der Teil innerhalb der Halle zählt: 200 breit, 300 tief.
    expect(flaeche(ergebnis.umriss)).toBe(1000 * 2000 - 200 * 300);
  });

  it('weigert sich nicht, warnt aber bei einem Loch mitten in der Fläche', () => {
    const lochInDerMitte = rechteck(400, 900, 200, 200);
    const ergebnis = ziehAb(HALLE, lochInDerMitte);

    expect(ergebnis.hinweis).toContain('Aussparung');
    // Der äußere Umriss bleibt unverändert – das Loch wird nicht abgebildet.
    expect(flaeche(ergebnis.umriss)).toBe(1000 * 2000);
  });

  it('sagt Bescheid, wenn nichts übrig bliebe', () => {
    const alles = rechteck(-100, -100, 5000, 5000);
    const ergebnis = ziehAb(HALLE, alles);

    expect(ergebnis.umriss).toEqual([]);
    expect(ergebnis.hinweis).toContain('nichts übrig');
  });

  it('lässt den Umriss in Ruhe, wenn der Abzug ihn nicht berührt', () => {
    const daneben = rechteck(5000, 5000, 300, 300);
    const ergebnis = ziehAb(HALLE, daneben);

    expect(flaeche(ergebnis.umriss)).toBe(1000 * 2000);
    expect(ergebnis.hinweis).toBeUndefined();
  });
});

describe('Rechteck aus zwei Ecken', () => {
  it('kommt mit jeder Ziehrichtung zurecht', () => {
    const vonRechtsUnten = rechteckAusEcken({ x: 500, y: 400 }, { x: 100, y: 200 });
    expect(rahmen(vonRechtsUnten)).toEqual({ links: 100, oben: 200, rechts: 500, unten: 400 });
    expect(vorzeichenFlaeche(vonRechtsUnten)).toBeGreaterThan(0);
  });
});
