import { describe, expect, it } from 'vitest';
import { wandleProjekt } from './wandlung';

/**
 * Was passiert, wenn die Datei kaputt ist.
 *
 * `wandleProjekt` ist das Tor: Alles, was aus einer Datei, aus dem Abgleich
 * oder aus der Datenbank kommt, geht hier hindurch. Wenn es hier durchrutscht,
 * steckt der Schaden danach in der Planung – und der Planer merkt es
 * frühestens, wenn ein Möbel im Nichts steht oder der ganze Plan weiß bleibt.
 *
 * Deshalb wird hier nicht geprüft, ob heile Daten heil ankommen – das tun die
 * Tests in `wandlung.test.ts`. Hier steht das Gegenteil: absichtlich
 * beschädigte Dateien. Der Anspruch ist bescheiden und dafür belastbar –
 * **es darf nichts fliegen, und es muss etwas Benutzbares herauskommen.**
 * Eine Fehlermeldung ist besser als ein halber Plan, aber ein Absturz beim
 * Öffnen ist das Schlimmste: Dann kommt man an die anderen Planungen auch
 * nicht mehr heran.
 */

/** Ein Projekt, das nach jedem Umbau noch benutzbar sein muss. */
function istBenutzbar(p: ReturnType<typeof wandleProjekt>) {
  expect(typeof p.id).toBe('string');
  expect(typeof p.name).toBe('string');
  expect(Array.isArray(p.elemente)).toBe(true);
  expect(Array.isArray(p.raeume)).toBe(true);
  expect(Array.isArray(p.waende)).toBe(true);
  expect(Array.isArray(p.ebenen)).toBe(true);
  expect(Array.isArray(p.masslinien)).toBe(true);
  expect(Array.isArray(p.gruppen)).toBe(true);
  expect(Array.isArray(p.verkaufsflaechen)).toBe(true);
  expect(Array.isArray(p.oeffnungen)).toBe(true);
  expect(Array.isArray(p.grundflaeche?.umriss)).toBe(true);
  // Die festen Ebenen müssen da sein, sonst hat kein Element ein Zuhause.
  for (const id of ['gebaeude', 'raeume', 'verkaufsflaeche', 'einrichtung', 'beschriftung']) {
    expect(p.ebenen.some((e) => e.id === id), `Ebene ${id}`).toBe(true);
  }
}

describe('Beschädigte Dateien einlesen', () => {
  it('macht aus gar nichts eine leere Planung', () => {
    for (const nichts of [null, undefined, 0, '', false]) {
      istBenutzbar(wandleProjekt(nichts));
    }
  });

  it('verträgt einen Text statt eines Projekts', () => {
    istBenutzbar(wandleProjekt('das ist kein Projekt'));
  });

  it('verträgt eine Liste statt eines Projekts', () => {
    istBenutzbar(wandleProjekt([1, 2, 3]));
  });

  it('verträgt ein leeres Objekt', () => {
    istBenutzbar(wandleProjekt({}));
  });

  it('verträgt Listen, die keine sind', () => {
    // Kommt vor, wenn jemand eine Datei von Hand bearbeitet hat.
    istBenutzbar(
      wandleProjekt({
        id: 'p1',
        name: 'Kaputt',
        elemente: 'keine Liste',
        raeume: 42,
        waende: null,
        ebenen: { id: 'nanu' },
        masslinien: 'nein',
        gruppen: false,
        oeffnungen: 0,
        verkaufsflaechen: 'nichts',
        grundflaeche: 'auch nicht',
      }),
    );
  });

  it('verträgt eine Versionsnummer aus der Zukunft', () => {
    // Eine Planung, die auf einem neueren Stand gespeichert wurde. Wir können
    // sie nicht rückwärts wandeln, aber öffnen muss sie sich.
    const p = wandleProjekt({ id: 'p1', name: 'Zukunft', version: 9999, elemente: [] });
    istBenutzbar(p);
  });

  it('verträgt eine Versionsnummer, die keine Zahl ist', () => {
    for (const version of ['drei', null, NaN, -1, {}]) {
      istBenutzbar(wandleProjekt({ id: 'p1', name: 'X', version, elemente: [] }));
    }
  });

  it('verträgt Elemente, die keine Objekte sind', () => {
    const p = wandleProjekt({
      id: 'p1',
      name: 'X',
      elemente: [null, 'Regal', 7, undefined, { id: 'gut', name: 'Regal' }],
    });
    istBenutzbar(p);
  });

  it('verträgt einen Umriss aus unbrauchbaren Punkten', () => {
    const p = wandleProjekt({
      id: 'p1',
      name: 'X',
      grundflaeche: { umriss: [null, { x: 'links', y: 3 }, { x: 1 }, { x: 2, y: 4 }] },
    });
    istBenutzbar(p);
  });

  it('behält eine tief verschachtelte Planung heil', () => {
    // Der Regelfall neben all dem Unfug: Was heil hereinkommt, muss heil
    // wieder heraus – sonst hätte die Härtung die Daten beschädigt.
    const roh = {
      id: 'p1',
      name: 'Testmarkt',
      version: 1,
      elemente: [
        {
          id: 'e1',
          name: 'Wandregal',
          x: 10,
          y: 20,
          breite: 125,
          tiefe: 60,
          form: 'regal',
          kategorie: 'regale',
          felderUnten: [{ breite: 125, tiefe: 60 }],
          notiz: 'Rückwand fehlt',
        },
      ],
      raeume: [{ id: 'r1', name: 'Lager', umriss: [{ x: 0, y: 0 }], art: 'lager' }],
    };
    const p = wandleProjekt(roh);
    istBenutzbar(p);
    expect(p.elemente).toHaveLength(1);
    expect(p.elemente[0].notiz).toBe('Rückwand fehlt');
    expect(p.elemente[0].breite).toBe(125);
    expect(p.raeume[0].name).toBe('Lager');
  });

  it('wandelt zweimal hintereinander zum selben Ergebnis', () => {
    // Eine Planung wird beim Öffnen gewandelt, beim Abgleich noch einmal.
    // Käme dabei etwas anderes heraus, wanderte sie mit jedem Öffnen weiter.
    const roh = {
      id: 'p1',
      name: 'Testmarkt',
      elemente: [{ id: 'e1', name: 'Gondel', x: 5, y: 5, breite: 125, tiefe: 120 }],
    };
    const einmal = wandleProjekt(roh);
    const zweimal = wandleProjekt(structuredClone(einmal));
    expect(zweimal).toEqual(einmal);
  });
});
