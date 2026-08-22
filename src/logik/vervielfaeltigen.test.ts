import { describe, expect, it } from 'vitest';
import { vervielfaeltige } from './vervielfaeltigen';
import type { Gruppe, PlanElement } from '../typen/modell';

/**
 * Prüfungen fürs Duplizieren und Einfügen.
 *
 * Der Kern ist nicht das Kopieren selbst, sondern was mit den **Verweisen**
 * geschieht. Ein Element zeigt auf seine Gruppe und auf seine Kopfgondeln.
 * Nimmt eine Kopie diese Verweise mit, hängt sie an fremden Elementen –
 * genau so kam es: Wer ein Regal duplizierte und die Kopie verschob, nahm
 * das Original mit.
 */

const el = (zusatz: Partial<PlanElement> & { id: string }): PlanElement => ({
  vorlageId: 'v',
  ebeneId: 'einrichtung',
  name: 'E',
  kategorie: 'regale',
  x: 100,
  y: 100,
  breite: 125,
  tiefe: 67,
  drehung: 0,
  form: 'wt100',
  farbe: '#c9c5bd',
  beschriftung: '',
  beschriftungSichtbar: false,
  schriftgroesse: 12,
  gesperrt: false,
  reihenfolge: 0,
  ...zusatz,
});

const gruppen: Gruppe[] = [{ id: 'g-1', name: 'Zug Nord', art: 'zug' }];

describe('Kopien anlegen', () => {
  it('gibt jeder Kopie eine eigene Kennung', () => {
    const { elemente } = vervielfaeltige([el({ id: 'a' }), el({ id: 'b' })], { x: 30, y: 30 }, 1);
    expect(elemente).toHaveLength(2);
    expect(new Set(elemente.map((e) => e.id)).size).toBe(2);
    expect(elemente.some((e) => e.id === 'a' || e.id === 'b')).toBe(false);
  });

  it('versetzt die Kopie', () => {
    const { elemente } = vervielfaeltige([el({ id: 'a' })], { x: 30, y: 30 }, 1);
    expect(elemente[0].x).toBe(130);
    expect(elemente[0].y).toBe(130);
  });

  it('löst ein einzeln kopiertes Regal aus seiner Gruppe', () => {
    // Der gemeldete Fehler: Die Kopie lag in derselben Gruppe wie das
    // Original. Ein Klick darauf wählte beide aus, und beim Verschieben
    // wanderte das Original mit.
    const { elemente, gruppen: neu } = vervielfaeltige(
      [el({ id: 'a', gruppeId: 'g-1' })],
      { x: 30, y: 30 },
      1,
      gruppen,
    );
    expect(elemente[0].gruppeId).toBeUndefined();
    expect(neu).toEqual([]);
  });

  it('baut eine ganze Gruppe als eigene Gruppe nach', () => {
    // Kopiert man den ganzen Zug, sollen die Kopien wieder ein Zug sein –
    // aber ein eigener, nicht derselbe.
    const { elemente, gruppen: neu } = vervielfaeltige(
      [el({ id: 'a', gruppeId: 'g-1' }), el({ id: 'b', gruppeId: 'g-1' })],
      { x: 30, y: 30 },
      1,
      gruppen,
    );
    expect(neu).toHaveLength(1);
    expect(neu[0].id).not.toBe('g-1');
    expect(neu[0].name).toBe('Zug Nord');
    expect(elemente[0].gruppeId).toBe(neu[0].id);
    expect(elemente[1].gruppeId).toBe(neu[0].id);
  });

  it('hängt Kopfgondeln an den kopierten Zug', () => {
    // Ohne Umhängen zeigten beide Züge auf dieselben Köpfe – und jeder
    // hätte sie an sein Ende gezogen.
    const { elemente } = vervielfaeltige(
      [
        el({ id: 'zug', kopfgondeln: { anfang: 'k1', ende: 'k2' } }),
        el({ id: 'k1', kopfVon: 'zug' }),
        el({ id: 'k2', kopfVon: 'zug' }),
      ],
      { x: 30, y: 30 },
      1,
    );
    const [zug, k1, k2] = elemente;
    expect(zug.kopfgondeln).toEqual({ anfang: k1.id, ende: k2.id });
    expect(k1.kopfVon).toBe(zug.id);
    expect(k2.kopfVon).toBe(zug.id);
    // Und auf nichts Altes mehr.
    expect([k1.kopfVon, k2.kopfVon]).not.toContain('zug');
  });

  it('lässt einen allein kopierten Kopf los', () => {
    // Ein Kopf ohne seinen Zug gehört zu keinem – sonst zöge ihn der fremde
    // Zug an sein Ende.
    const { elemente } = vervielfaeltige([el({ id: 'k1', kopfVon: 'zug' })], { x: 30, y: 30 }, 1);
    expect(elemente[0].kopfVon).toBeUndefined();
  });

  it('lässt einen allein kopierten Zug ohne Köpfe', () => {
    const { elemente } = vervielfaeltige(
      [el({ id: 'zug', kopfgondeln: { anfang: 'k1', ende: 'k2' } })],
      { x: 30, y: 30 },
      1,
    );
    expect(elemente[0].kopfgondeln).toBeUndefined();
  });

  it('entsperrt die Kopie', () => {
    // Eine gesperrte Vorlage zu kopieren und die Kopie nicht anfassen zu
    // können wäre eine Falle.
    const { elemente } = vervielfaeltige([el({ id: 'a', gesperrt: true })], { x: 30, y: 30 }, 1);
    expect(elemente[0].gesperrt).toBe(false);
  });

  it('legt die Kopien obenauf', () => {
    const { elemente } = vervielfaeltige([el({ id: 'a' }), el({ id: 'b' })], { x: 30, y: 30 }, 7);
    expect(elemente.map((e) => e.reihenfolge)).toEqual([7, 8]);
  });
});
