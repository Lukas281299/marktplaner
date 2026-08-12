import { describe, expect, it } from 'vitest';
import { flaeche, rechteck, vorzeichenFlaeche } from './polygon';
import { punktEinfuegen, punktEntfernen, punktVerschieben } from './umrissBearbeiten';

/** 10 × 10 m an der linken oberen Ecke. */
const QUADRAT = rechteck(0, 0, 1000, 1000);

describe('Ecke verschieben', () => {
  it('setzt die Ecke an die neue Stelle', () => {
    const neu = punktVerschieben(QUADRAT, 2, { x: 600, y: 600 });
    expect(neu[2]).toEqual({ x: 600, y: 600 });
    expect(neu).toHaveLength(4);
    // Aus dem Quadrat wird ein Viereck mit kleinerer Fläche.
    expect(flaeche(neu)).toBeLessThan(flaeche(QUADRAT));
  });

  it('lässt die übrigen Ecken in Ruhe', () => {
    const neu = punktVerschieben(QUADRAT, 0, { x: -200, y: -200 });
    expect(neu.slice(1)).toEqual(QUADRAT.slice(1));
  });

  it('ignoriert eine Nummer, die es nicht gibt', () => {
    expect(punktVerschieben(QUADRAT, 9, { x: 0, y: 0 })).toBe(QUADRAT);
    expect(punktVerschieben(QUADRAT, -1, { x: 0, y: 0 })).toBe(QUADRAT);
  });
});

describe('Ecke einfügen', () => {
  it('setzt die neue Ecke hinter die angegebene', () => {
    const neu = punktEinfuegen(QUADRAT, 0, { x: 500, y: 0 });
    expect(neu).toHaveLength(5);
    expect(neu[1]).toEqual({ x: 500, y: 0 });
  });

  it('behält den Umlaufsinn bei', () => {
    // Sonst schlüge der Umriss beim nächsten Ziehen um.
    const neu = punktEinfuegen(QUADRAT, 2, { x: 1000, y: 500 });
    expect(Math.sign(vorzeichenFlaeche(neu))).toBe(Math.sign(vorzeichenFlaeche(QUADRAT)));
  });

  it('ändert die Fläche nicht, wenn die Ecke auf der Kante liegt', () => {
    const neu = punktEinfuegen(QUADRAT, 0, { x: 500, y: 0 });
    expect(flaeche(neu)).toBe(flaeche(QUADRAT));
  });

  it('kommt auch an der letzten Kante zurecht', () => {
    const neu = punktEinfuegen(QUADRAT, 3, { x: 0, y: 500 });
    expect(neu).toHaveLength(5);
    expect(neu[4]).toEqual({ x: 0, y: 500 });
  });
});

describe('Ecke entfernen', () => {
  it('entfernt die Ecke', () => {
    const fuenfeck = punktEinfuegen(QUADRAT, 0, { x: 500, y: -300 });
    const neu = punktEntfernen(fuenfeck, 1);
    expect(neu).toEqual(QUADRAT);
  });

  it('weigert sich bei einem Dreieck', () => {
    // Weniger als drei Ecken wären keine Fläche mehr.
    const dreieck = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(punktEntfernen(dreieck, 0)).toBeNull();
  });

  it('räumt Ecken mit weg, die dadurch überflüssig werden', () => {
    // Nach dem Entfernen der Spitze liegt die eingefügte Ecke genau auf der
    // Geraden zwischen ihren Nachbarn – sie hat dann keine Wirkung mehr.
    const mitSpitze = punktEinfuegen(
      punktEinfuegen(QUADRAT, 0, { x: 300, y: 0 }),
      1,
      { x: 500, y: -300 },
    );
    expect(mitSpitze).toHaveLength(6);

    const neu = punktEntfernen(mitSpitze, 2);
    expect(neu).not.toBeNull();
    expect(neu).toHaveLength(4);
  });

  it('ignoriert eine Nummer, die es nicht gibt', () => {
    expect(punktEntfernen(QUADRAT, 9)).toBeNull();
  });
});
