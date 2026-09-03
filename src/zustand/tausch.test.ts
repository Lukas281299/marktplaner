import { beforeEach, describe, expect, it } from 'vitest';
import { BIBLIOTHEK } from '../daten/bibliothek';
import { neuesProjekt } from '../daten/standardProjekt';
import { usePlanStore } from './planStore';

/**
 * Prüfungen für den Vorlagentausch.
 *
 * Der heikle Teil ist die Breite. Ein Regalzug ist ein Element mit vielen
 * Feldern; tauscht man ihn gegen eine Vorlage, darf nicht die Breite eines
 * einzelnen Felds herauskommen. Aus sechs Feldern zu 1,00 m müssen sechs
 * Felder zu 1,25 m werden – sonst schrumpft beim Umplanen ein Zwölfmeterzug
 * unbemerkt auf einen Meter.
 */

const vorlage = (id: string) => {
  const treffer = BIBLIOTHEK.find((v) => v.id === id);
  if (!treffer) throw new Error(`Vorlage ${id} gibt es nicht`);
  return treffer;
};

function lege(id: string, x = 500, y = 500) {
  const store = usePlanStore.getState();
  store.fuegeElementHinzu(vorlage(id), x, y);
  const elemente = usePlanStore.getState().projekt.elemente;
  return elemente[elemente.length - 1];
}

describe('Vorlagentausch', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('behält bei einem Zug die Feldzahl und rechnet die Breite um', () => {
    const zug = lege('wt-zug-1000-6-600');
    expect(zug.breite).toBe(600);
    expect(zug.achsmass).toBe(100);

    usePlanStore.getState().waehleAus([zug.id]);
    usePlanStore.getState().tauscheVorlage(vorlage('wt-gondel-1250-600-1800'));

    const nachher = usePlanStore.getState().projekt.elemente[0];
    // Sechs Felder, jetzt zu 1,25 m.
    expect(nachher.achsmass).toBe(125);
    expect(nachher.breite).toBe(750);
  });

  it('nimmt bei einem Möbel ohne Achsmaß die Maße der Vorlage', () => {
    const kasse = lege('kasse-steh');
    usePlanStore.getState().waehleAus([kasse.id]);
    usePlanStore.getState().tauscheVorlage(vorlage('kasse-sb'));

    const nachher = usePlanStore.getState().projekt.elemente[0];
    expect(nachher.breite).toBe(90);
    expect(nachher.tiefe).toBe(80);
    expect(nachher.form).toBe('sbKasse');
  });

  it('lässt Lage, Drehung und Beschriftung stehen', () => {
    const regal = lege('wt-wand-1250-600-1800', 320, 480);
    usePlanStore.getState().aendereElemente([regal.id], { drehung: 90, beschriftung: 'Nudeln' });
    usePlanStore.getState().waehleAus([regal.id]);
    usePlanStore.getState().tauscheVorlage(vorlage('wt-wand-1250-500-2000'));

    const nachher = usePlanStore.getState().projekt.elemente[0];
    expect(nachher.x).toBe(320);
    expect(nachher.y).toBe(480);
    expect(nachher.drehung).toBe(90);
    expect(nachher.beschriftung).toBe('Nudeln');
    // Getauscht wurde, was das Möbel ausmacht.
    expect(nachher.tiefe).toBe(57);
    expect(nachher.hoehe).toBe(200);
  });

  it('tauscht mehrere Elemente auf einmal', () => {
    const a = lege('wt-wand-1000-600-1800', 200, 200);
    const b = lege('wt-wand-1000-600-1800', 400, 200);
    usePlanStore.getState().waehleAus([a.id]);
    usePlanStore.getState().waehleAus([b.id], 'umschalten');
    usePlanStore.getState().tauscheVorlage(vorlage('wt-wand-1000-500-1600'));

    for (const el of usePlanStore.getState().projekt.elemente) {
      expect(el.tiefe).toBe(57);
      expect(el.hoehe).toBe(160);
    }
  });

  it('rührt gesperrte Elemente nicht an', () => {
    const regal = lege('wt-wand-1250-600-1800');
    usePlanStore.getState().aendereElemente([regal.id], { gesperrt: true });
    usePlanStore.getState().waehleAus([regal.id]);
    usePlanStore.getState().tauscheVorlage(vorlage('wt-wand-1250-300-1400'));

    expect(usePlanStore.getState().projekt.elemente[0].tiefe).toBe(67);
  });

  it('schaltet den Tauschmodus danach wieder ab', () => {
    const regal = lege('wt-wand-1250-600-1800');
    usePlanStore.getState().waehleAus([regal.id]);
    usePlanStore.getState().setzeTauschModus(true);
    usePlanStore.getState().tauscheVorlage(vorlage('wt-wand-1250-500-1800'));
    expect(usePlanStore.getState().tauschModus).toBe(false);
  });

  it('lässt sich mit einem Schritt zurücknehmen', () => {
    const zug = lege('wt-zug-1250-5-600');
    usePlanStore.getState().waehleAus([zug.id]);
    usePlanStore.getState().tauscheVorlage(vorlage('wt-gondel-625-500-1800'));
    expect(usePlanStore.getState().projekt.elemente[0].achsmass).toBe(62.5);

    usePlanStore.getState().rueckgaengig();
    expect(usePlanStore.getState().projekt.elemente[0].achsmass).toBe(125);
  });
});
