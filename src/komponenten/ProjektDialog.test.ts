import { describe, expect, it } from 'vitest';
import { nachOrdnern } from './ProjektDialog';
import type { ProjektInfo } from '../speicher/projektArchiv';

/**
 * Die Einteilung der Planungen in Ordner.
 *
 * Die Reihenfolge ist das Eigentliche: Wer den Öffnen-Dialog aufmacht, sucht
 * einen Markt. Steht „Ohne Ordner" oben, liest man erst an allem vorbei, was
 * noch nicht einsortiert ist.
 */

function info(teil: Partial<ProjektInfo>): ProjektInfo {
  return {
    id: 'p1',
    name: 'Planung',
    erstelltAm: 0,
    geaendertAm: 0,
    anzahlElemente: 0,
    ...teil,
  };
}

describe('nachOrdnern', () => {
  it('gruppiert nach Ordner', () => {
    const gruppen = nachOrdnern([
      info({ id: 'a', name: 'Bestand', ordner: 'Dörnhagen' }),
      info({ id: 'b', name: 'Umbau', ordner: 'Dörnhagen' }),
      info({ id: 'c', name: 'Bestand', ordner: 'Fuldabrück' }),
    ]);
    expect(gruppen.map((g) => g.ordner)).toEqual(['Dörnhagen', 'Fuldabrück']);
    expect(gruppen[0].planungen).toHaveLength(2);
  });

  it('sortiert die Ordner alphabetisch, „Ohne Ordner" zuletzt', () => {
    // Was noch nicht aufgeräumt ist, soll nicht über dem stehen, was schon
    // aufgeräumt wurde.
    const gruppen = nachOrdnern([
      info({ id: 'a', name: 'Skizze' }),
      info({ id: 'b', name: 'X', ordner: 'Zweibrücken' }),
      info({ id: 'c', name: 'Y', ordner: 'Alsfeld' }),
    ]);
    expect(gruppen.map((g) => g.ordner)).toEqual(['Alsfeld', 'Zweibrücken', 'Ohne Ordner']);
  });

  it('hält innerhalb eines Ordners die zuletzt geänderte oben', () => {
    const gruppen = nachOrdnern([
      info({ id: 'alt', name: 'Alt', ordner: 'M', geaendertAm: 100 }),
      info({ id: 'neu', name: 'Neu', ordner: 'M', geaendertAm: 900 }),
    ]);
    expect(gruppen[0].planungen.map((p) => p.id)).toEqual(['neu', 'alt']);
  });

  it('behandelt Leerzeichen als keinen Ordner', () => {
    // Sonst entstünde beim Umbenennen ein Ordner, der aussieht wie keiner.
    const gruppen = nachOrdnern([
      info({ id: 'a', name: 'A', ordner: '   ' }),
      info({ id: 'b', name: 'B' }),
    ]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0].ordner).toBe('Ohne Ordner');
    expect(gruppen[0].planungen).toHaveLength(2);
  });

  it('schneidet Leerzeichen am Rand weg, statt zwei Ordner zu machen', () => {
    const gruppen = nachOrdnern([
      info({ id: 'a', name: 'A', ordner: 'Dörnhagen' }),
      info({ id: 'b', name: 'B', ordner: ' Dörnhagen ' }),
    ]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0].planungen).toHaveLength(2);
  });

  it('kommt mit einer leeren Liste zurecht', () => {
    expect(nachOrdnern([])).toEqual([]);
  });
});
