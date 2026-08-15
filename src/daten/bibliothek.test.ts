import { describe, expect, it } from 'vitest';
import { BIBLIOTHEK } from './bibliothek';
import { KATEGORIEN } from './kategorien';

/**
 * Prüfungen für die Elementbibliothek.
 *
 * Sie fangen genau den Fehler ab, der hier schon passiert ist: eine
 * Vorlagenliste von Hand geschrieben, und dann fehlt eine Variante. Ein
 * fehlender Eintrag fällt niemandem auf, bis man ihn braucht.
 */

const OG = BIBLIOTHEK.filter((e) => e.kategorie === 'obstgemuese');
/**
 * Nur die aus der Variantentabelle erzeugten Möbel – nicht das freie Element
 * und nicht die Zonenmarkierung. Erkennbar an der Kennung, die der Erzeuger
 * vergibt: `vt-wand-…` oder `vt-gondel-…`.
 */
const GERADE = OG.filter((e) => /^vt-(wand|gondel)-/.test(e.id));

describe('Bibliothek allgemein', () => {
  it('vergibt jede Kennung nur einmal', () => {
    const gesehen = new Map<string, number>();
    for (const eintrag of BIBLIOTHEK) {
      gesehen.set(eintrag.id, (gesehen.get(eintrag.id) ?? 0) + 1);
    }
    const doppelte = [...gesehen.entries()].filter(([, anzahl]) => anzahl > 1);
    expect(doppelte).toEqual([]);
  });

  it('benutzt nur Kategorien, die es gibt', () => {
    const bekannt = new Set(KATEGORIEN.map((k) => k.id));
    const unbekannt = BIBLIOTHEK.filter((e) => !bekannt.has(e.kategorie)).map((e) => e.id);
    expect(unbekannt).toEqual([]);
  });

  it('gibt jedem Eintrag brauchbare Maße', () => {
    const kaputt = BIBLIOTHEK.filter((e) => e.breite <= 0 || e.tiefe <= 0).map((e) => e.id);
    expect(kaputt).toEqual([]);
  });
});

describe('Obst und Gemüse: die Varianten sind vollständig', () => {
  it('führt jede Variante in beiden Achsmaßen', () => {
    // Der Katalog kennt 1000 und 1250 mm. Eine Variante, die es nur in einer
    // Breite gibt, ist ein Versehen.
    const nachForm = new Map<string, Set<number>>();
    for (const eintrag of GERADE) {
      const schluessel = `${eintrag.hoehe}|${(eintrag.stufen ?? []).join('-')}|${eintrag.beidseitig ? 'gondel' : 'wand'}`;
      if (!nachForm.has(schluessel)) nachForm.set(schluessel, new Set());
      nachForm.get(schluessel)!.add(eintrag.breite);
    }

    const unvollstaendig = [...nachForm.entries()]
      .filter(([, breiten]) => !(breiten.has(100) && breiten.has(125)))
      .map(([schluessel]) => schluessel);

    expect(unvollstaendig).toEqual([]);
  });

  it('enthält die zwanzig Varianten des Workbooks in zwei Breiten', () => {
    expect(GERADE).toHaveLength(40);
  });

  it('kennt H1100 mit T800 + T400', () => {
    // Diese Variante fehlte zuerst – deshalb steht sie hier namentlich.
    const treffer = GERADE.filter(
      (e) => e.hoehe === 110 && (e.stufen ?? []).join('-') === '80-40',
    );
    expect(treffer.map((e) => e.breite).sort()).toEqual([100, 125]);
  });

  it('kennt die beidseitigen Gondeln', () => {
    const gondeln = GERADE.filter((e) => e.beidseitig);
    expect(gondeln).toHaveLength(4);
  });
});

describe('Obst und Gemüse: die Tiefen stimmen', () => {
  it('setzt bei T800 die Gesamttiefe auf 955 mm und den Korpus auf 726 mm', () => {
    const einseitig = GERADE.filter((e) => !e.beidseitig && Math.max(...(e.stufen ?? [0])) === 80);
    expect(einseitig.length).toBeGreaterThan(0);
    for (const eintrag of einseitig) {
      expect(eintrag.tiefe).toBe(95.5);
      expect(eintrag.korpustiefe).toBe(72.6);
    }
  });

  it('setzt bei T1200 die Gesamttiefe auf 1317 mm und den Korpus auf 908 mm', () => {
    const einseitig = GERADE.filter((e) => !e.beidseitig && Math.max(...(e.stufen ?? [0])) === 120);
    expect(einseitig.length).toBeGreaterThan(0);
    for (const eintrag of einseitig) {
      expect(eintrag.tiefe).toBe(131.7);
      expect(eintrag.korpustiefe).toBe(90.8);
    }
  });

  it('macht die Gondel nicht doppelt so tief wie das einseitige Möbel', () => {
    // Beide Seiten teilen sich eine Mittelsäule – 1829 statt 1910 mm.
    const gondel = GERADE.find((e) => e.beidseitig && Math.max(...(e.stufen ?? [0])) === 80);
    expect(gondel?.tiefe).toBe(182.9);
    expect(gondel?.tiefe).toBeLessThan(2 * 95.5);
  });

  it('lässt die Front immer über den Korpus hinausragen', () => {
    for (const eintrag of GERADE) {
      expect(eintrag.korpustiefe).toBeDefined();
      expect(eintrag.korpustiefe!).toBeLessThan(eintrag.tiefe);
    }
  });
});
