import { describe, expect, it } from 'vitest';
import {
  BANDLAENGEN,
  BAND_STANDARD,
  bandlaenge,
  bandlaengeLieferbar,
  FUELLSTUECK_LAENGEN,
  gesamtlaenge,
  hatBand,
  KASSE_FEST,
  naechsteBandlaenge,
} from './kassen';
import { BIBLIOTHEK } from '../daten/bibliothek';

/**
 * Die Kassenzeile.
 *
 * Hier hängt etwas dran, das man im Plan nicht sieht: ob die Kasse
 * **bestellbar** ist. ITAB liefert Warenbänder nur in Schritten von 300 mm;
 * jede andere Länge ist eine Kasse, die es nicht gibt. Genau so ein Maß stand
 * vorher in der Bibliothek.
 */

describe('Bandlängen', () => {
  it('folgt dem Raster von 300 mm', () => {
    for (let i = 1; i < BANDLAENGEN.length; i++) {
      expect(BANDLAENGEN[i] - BANDLAENGEN[i - 1]).toBeCloseTo(30, 5);
    }
    expect(BANDLAENGEN[0]).toBe(90);
    expect(BANDLAENGEN[BANDLAENGEN.length - 1]).toBe(390);
  });

  it('kennt die 2000 mm nicht, die vorher in der Bibliothek standen', () => {
    // Der eigentliche Grund für diese Datei: Die alte Bibliothek führte eine
    // Kasse mit 2000er Band. Die gibt es bei ITAB nicht.
    expect(bandlaengeLieferbar(200)).toBe(false);
    expect(bandlaengeLieferbar(210)).toBe(true);
    expect(bandlaengeLieferbar(180)).toBe(true);
  });

  it('nennt zu einer krummen Länge die nächste lieferbare', () => {
    expect(naechsteBandlaenge(200)).toBe(210);
    expect(naechsteBandlaenge(197)).toBe(210);
    expect(naechsteBandlaenge(100)).toBe(90);
    // Weit außerhalb: die Grenze des Lieferbaren.
    expect(naechsteBandlaenge(1000)).toBe(390);
    expect(naechsteBandlaenge(10)).toBe(90);
  });
});

describe('Länge und Band', () => {
  it('rechnet Band und Gesamtlänge ineinander um', () => {
    // 428 + 1800 + 618 + 1067 = 3913 mm, gemessen an der ITAB-Zeichnung.
    expect(gesamtlaenge(180)).toBeCloseTo(391.3, 5);
    expect(KASSE_FEST).toBeCloseTo(211.3, 5);
  });

  it('liest die Bandlänge aus der Gesamtbreite zurück', () => {
    const kasse = { form: 'kasse' as const, breite: gesamtlaenge(240) };
    expect(bandlaenge(kasse)).toBeCloseTo(240, 5);
  });

  it('lässt kein negatives Band zu', () => {
    // Ein Element lässt sich beliebig kurz ziehen. Ein Band von minus einem
    // Meter wäre keine Angabe, sondern ein Fehler im Plan.
    expect(bandlaenge({ form: 'kasse', breite: 50 })).toBe(0);
  });

  it('gibt Möbeln ohne Band gar keins', () => {
    expect(hatBand('kasse')).toBe(true);
    expect(hatBand('kasseSitz')).toBe(true);
    expect(hatBand('kasseDoppel')).toBe(true);
    // Die Expresskasse hat keins – das ist ihr Wesen, nicht ihre Länge.
    expect(hatBand('kasseExpress')).toBe(false);
    expect(hatBand('sbKasse')).toBe(false);
    expect(hatBand('regal')).toBe(false);
    expect(bandlaenge({ form: 'kasseExpress', breite: 400 })).toBe(0);
  });
});

describe('Füllstücke', () => {
  it('folgen dem Raster von 295 mm', () => {
    expect(FUELLSTUECK_LAENGEN[0]).toBeCloseTo(29.5, 5);
    expect(FUELLSTUECK_LAENGEN[FUELLSTUECK_LAENGEN.length - 1]).toBeCloseTo(206.5, 5);
    for (let i = 1; i < FUELLSTUECK_LAENGEN.length; i++) {
      expect(FUELLSTUECK_LAENGEN[i] - FUELLSTUECK_LAENGEN[i - 1]).toBeCloseTo(29.5, 5);
    }
  });
});

describe('Die Kassenzeile in der Bibliothek', () => {
  const zeile = BIBLIOTHEK.filter((e) => e.gruppe === 'Kassenzeile');

  it('bleibt überschaubar', () => {
    // Die ITAB-Zeichnung führt 646 Blöcke – das sind dieselben Bauteile in
    // allen Längen, beiden Anschlägen und vier Ansichten. Eine Bibliothek,
    // die das nachbaut, kann niemand mehr benutzen.
    expect(zeile.length).toBeLessThanOrEqual(8);
    expect(zeile.length).toBeGreaterThanOrEqual(6);
  });

  it('führt jede Bauart genau einmal', () => {
    const formen = zeile.map((e) => e.form);
    expect(new Set(formen).size).toBe(formen.length);
  });

  it('kommt mit einer lieferbaren Bandlänge aus der Bibliothek', () => {
    for (const eintrag of zeile) {
      if (!hatBand(eintrag.form)) continue;
      const band = bandlaenge({ form: eintrag.form, breite: eintrag.breite });
      expect(bandlaengeLieferbar(band), `${eintrag.name}: Band ${band * 10} mm`).toBe(true);
      expect(band).toBe(BAND_STANDARD);
    }
  });

  it('hat für jede Bauart einen Hinweis, woher die Maße kommen', () => {
    for (const eintrag of zeile) {
      expect(eintrag.hinweis, eintrag.name).toBeTruthy();
    }
  });
});
