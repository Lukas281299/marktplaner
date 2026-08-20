import { describe, expect, it } from 'vitest';
import { flaeche, rahmen } from '../logik/polygon';
import { SCHEMA_VERSION } from '../typen/modell';
import { wandleProjekt } from './wandlung';

/**
 * Prüfungen für die Umwandlung älterer Planungen.
 *
 * Der Ernstfall: Jemand hat vor Wochen eine Planung angelegt, das Modell hat
 * sich seither geändert, und beim Öffnen muss trotzdem genau das dastehen, was
 * er damals gezeichnet hat. Was hier durchrutscht, merkt niemand sofort – nur
 * dass irgendwann etwas fehlt.
 */

/** Eine Planung, wie sie Fassung 1 abgelegt hat. */
function alteFassung(zusatz: Record<string, unknown> = {}) {
  return {
    id: 'projekt-alt',
    name: 'Markt Nord',
    version: 1,
    erstelltAm: 1000,
    geaendertAm: 2000,
    grundflaeche: { breite: 4000, laenge: 2500, wandstaerke: 30 },
    einstellungen: {
      anzeigeEinheit: 'm',
      rasterSichtbar: true,
      rasterWeite: 50,
      amRasterEinrasten: true,
      hilfslinienAktiv: true,
      masseAnzeigen: true,
    },
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
    raeume: [],
    elemente: [],
    ...zusatz,
  };
}

describe('Grundfläche', () => {
  it('macht aus Breite und Länge ein Rechteck', () => {
    const neu = wandleProjekt(alteFassung());

    expect(neu.version).toBe(SCHEMA_VERSION);
    expect(neu.grundflaeche.umriss).toHaveLength(4);
    expect(rahmen(neu.grundflaeche.umriss)).toEqual({
      links: 0,
      oben: 0,
      rechts: 4000,
      unten: 2500,
    });
    expect(neu.grundflaeche.wandstaerke).toBe(30);
  });

  it('behält die Fläche bei', () => {
    const neu = wandleProjekt(alteFassung());
    expect(flaeche(neu.grundflaeche.umriss)).toBe(4000 * 2500);
  });

  it('lässt alles andere unangetastet', () => {
    const alt = alteFassung({
      elemente: [{ id: 'el-1', name: 'Regal', x: 100, y: 200 }],
    });
    const neu = wandleProjekt(alt);

    expect(neu.name).toBe('Markt Nord');
    expect(neu.erstelltAm).toBe(1000);
    expect(neu.elemente).toHaveLength(1);
    expect(neu.ebenen).toHaveLength(1);
  });
});

describe('Räume', () => {
  it('macht aus einem Raum-Rechteck ein Polygon', () => {
    const neu = wandleProjekt(
      alteFassung({
        raeume: [
          {
            id: 'raum-1',
            name: 'Lager',
            x: 3000,
            y: 0,
            breite: 1000,
            laenge: 800,
            wandstaerke: 20,
            farbe: '#dddddd',
            beschriftungSichtbar: true,
          },
        ],
      }),
    );

    const raum = neu.raeume[0];
    expect(raum.id).toBe('raum-1');
    expect(raum.name).toBe('Lager');
    expect(rahmen(raum.umriss)).toEqual({ links: 3000, oben: 0, rechts: 4000, unten: 800 });
    expect(raum.wandstaerke).toBe(20);
    expect(raum.farbe).toBe('#dddddd');
  });

  it('setzt die Art auf „sonstige" statt zu raten', () => {
    // Ein falsch einsortierter Raum würde die Verkaufsfläche verfälschen.
    const neu = wandleProjekt(
      alteFassung({ raeume: [{ id: 'r', name: 'Lager', x: 0, y: 0, breite: 100, laenge: 100 }] }),
    );
    expect(neu.raeume[0].art).toBe('sonstige');
  });
});

describe('beschädigte Dateien', () => {
  it('kommt ohne Grundfläche zurecht', () => {
    const neu = wandleProjekt(alteFassung({ grundflaeche: undefined }));
    expect(flaeche(neu.grundflaeche.umriss)).toBeGreaterThan(0);
  });

  it('kommt mit unsinnigen Maßen zurecht', () => {
    const neu = wandleProjekt(alteFassung({ grundflaeche: { breite: 0, laenge: -5 } }));
    expect(flaeche(neu.grundflaeche.umriss)).toBeGreaterThan(0);
  });

  it('kommt ohne Raumliste zurecht', () => {
    const neu = wandleProjekt(alteFassung({ raeume: undefined }));
    expect(neu.raeume).toEqual([]);
  });

  it('vergibt einem Raum ohne Kennung eine neue', () => {
    const neu = wandleProjekt(alteFassung({ raeume: [{ name: 'Ohne Kennung' }] }));
    expect(neu.raeume[0].id).toMatch(/^raum-/);
  });
});

describe('Fassung 6: eingezeichnete Verkaufsflächen', () => {
  it('gibt einer alten Planung eine leere Liste', () => {
    // Leer ist die richtige Bedeutung: In einer alten Planung ist nichts
    // eingezeichnet, also bleibt es bei der gerechneten Verkaufsfläche.
    expect(wandleProjekt(alteFassung()).verkaufsflaechen).toEqual([]);
  });

  it('lässt vorhandene Flächen stehen', () => {
    const flaeche = {
      id: 'verkaufsflaeche-1',
      name: 'Vorkasse',
      umriss: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 400 },
      ],
      farbe: '#2f9e44',
      beschriftungSichtbar: true,
      gesperrt: false,
    };
    const neu = wandleProjekt(alteFassung({ verkaufsflaechen: [flaeche] }));
    expect(neu.verkaufsflaechen).toEqual([flaeche]);
  });
});

describe('neue Fassung', () => {
  it('lässt eine bereits aktuelle Planung unverändert', () => {
    const aktuell = {
      ...alteFassung(),
      version: SCHEMA_VERSION,
      grundflaeche: {
        umriss: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
        wandstaerke: 25,
      },
    };
    expect(wandleProjekt(aktuell)).toBe(aktuell);
  });

  it('wandelt nicht zweimal', () => {
    const einmal = wandleProjekt(alteFassung());
    const zweimal = wandleProjekt(einmal);
    expect(zweimal.grundflaeche.umriss).toEqual(einmal.grundflaeche.umriss);
  });
});
