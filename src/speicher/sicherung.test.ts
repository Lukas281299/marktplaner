import { describe, expect, it } from 'vitest';
import { neuesProjekt } from '../daten/standardProjekt';
import { SCHEMA_VERSION } from '../typen/modell';
import { leseProjektdatei } from './projektArchiv';

/**
 * Das Einlesen von Sicherungen und einzelnen Planungen.
 *
 * Beides landet in derselben Anwendung, also liest es dieselbe Funktion.
 * Wichtig ist, dass eine Sicherung nichts überschreibt, was schon dasteht:
 * Wer sie einliest, will seine Arbeit zurück und nicht die vorhandene
 * verlieren. Deshalb bekommt jede eingelesene Planung eine frische Kennung.
 */

const alsDatei = (inhalt: unknown) =>
  new File([JSON.stringify(inhalt)], 'probe.json', { type: 'application/json' });

const austausch = (name: string) => ({
  format: 'marktplaner',
  version: SCHEMA_VERSION,
  exportiertAm: new Date().toISOString(),
  projekt: { ...neuesProjekt(name), id: 'immer-dieselbe' },
  eigeneVorlagen: [],
});

describe('Planungen einlesen', () => {
  it('liest eine einzelne Planung', async () => {
    const gelesen = await leseProjektdatei(alsDatei(austausch('Ein Markt')));
    expect(gelesen.projekte).toHaveLength(1);
    expect(gelesen.projekte[0].name).toBe('Ein Markt');
  });

  it('liest eine Sicherung mit mehreren Planungen', async () => {
    const sicherung = {
      format: 'marktplaner-sicherung',
      version: SCHEMA_VERSION,
      exportiertAm: new Date().toISOString(),
      projekte: [neuesProjekt('Erster'), neuesProjekt('Zweiter'), neuesProjekt('Dritter')],
      eigeneVorlagen: [],
    };
    const gelesen = await leseProjektdatei(alsDatei(sicherung));
    expect(gelesen.projekte.map((p) => p.name)).toEqual(['Erster', 'Zweiter', 'Dritter']);
  });

  it('vergibt frische Kennungen, damit nichts überschrieben wird', async () => {
    const einmal = await leseProjektdatei(alsDatei(austausch('Markt')));
    const nochmal = await leseProjektdatei(alsDatei(austausch('Markt')));
    expect(einmal.projekte[0].id).not.toBe('immer-dieselbe');
    expect(einmal.projekte[0].id).not.toBe(nochmal.projekte[0].id);
  });

  it('vervollständigt dabei die Ebenen', async () => {
    const kaputt = {
      ...austausch('Markt'),
      projekt: {
        ...neuesProjekt('Markt'),
        ebenen: [{ id: 'ebene-grund', name: 'Grundriss', sichtbar: true, gesperrt: false }],
      },
    };
    const gelesen = await leseProjektdatei(alsDatei(kaputt));
    expect(gelesen.projekte[0].ebenen.map((e) => e.id)).toContain('einrichtung');
  });

  it('sagt deutlich, wenn die Datei nicht dazugehört', async () => {
    await expect(leseProjektdatei(alsDatei({ irgendwas: true }))).rejects.toThrow(
      /nicht aus dem Marktplaner/,
    );
    await expect(leseProjektdatei(new File(['kein json'], 'x.json'))).rejects.toThrow(
      /keine gültige JSON-Datei/,
    );
  });
});
