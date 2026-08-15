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

describe('Trockensortiment: wire tech 100', () => {
  const WT = BIBLIOTHEK.filter((e) => e.id.startsWith('wt-'));
  const WAND = WT.filter((e) => e.id.startsWith('wt-wand-'));
  const GONDEL = WT.filter((e) => e.id.startsWith('wt-gondel-'));

  it('rechnet die tote Zone einmal auf jedes Wandregal', () => {
    // Ein 600er Grundboden ist nicht 600 tief, sondern 670.
    expect(WAND.length).toBeGreaterThan(0);
    for (const eintrag of WAND) {
      const boden = Number(eintrag.id.split('-')[3]) / 10;
      expect(eintrag.tiefe).toBeCloseTo(boden + 7, 5);
    }
  });

  it('rechnet die tote Zone bei der Gondel nur einmal, nicht zweimal', () => {
    // 2 × 600 + 70 = 1270 – und gerade nicht 2 × 670 = 1340.
    expect(GONDEL.length).toBeGreaterThan(0);
    for (const eintrag of GONDEL) {
      const boden = Number(eintrag.id.split('-')[3]) / 10;
      expect(eintrag.tiefe).toBeCloseTo(2 * boden + 7, 5);
      expect(eintrag.tiefe).toBeLessThan(2 * (boden + 7));
    }
  });

  it('macht die Gondel 1270 tief, nicht 1340', () => {
    const eintrag = GONDEL.find((e) => e.id === 'wt-gondel-1250-600-1800');
    expect(eintrag?.tiefe).toBe(127);
  });

  it('lässt Achsmaß 800 nur mit 400er und 500er Boden zu', () => {
    const achthundert = WT.filter((e) => e.achsmass === 80);
    expect(achthundert.length).toBeGreaterThan(0);
    for (const eintrag of achthundert) {
      const boden = Number(eintrag.id.split('-')[3]) / 10;
      expect([40, 50]).toContain(boden);
      expect(eintrag.hoehe).toBeLessThanOrEqual(180);
    }
  });

  it('gibt Achsmaß 1333 keinen 800er Boden', () => {
    const treffer = WT.filter(
      (e) => e.achsmass === 133.3 && Number(e.id.split('-')[3]) === 800,
    );
    expect(treffer).toEqual([]);
  });

  it('setzt jedem Regalfeld sein Achsmaß, damit die Felder stimmen', () => {
    for (const eintrag of [...WAND, ...GONDEL]) {
      expect(eintrag.achsmass).toBeGreaterThan(0);
      expect(eintrag.breite).toBeCloseTo(eintrag.achsmass!, 5);
    }
  });

  it('baut Gondelzüge aus ganzen Feldern', () => {
    const zuege = WT.filter((e) => e.id.startsWith('wt-zug-'));
    expect(zuege.length).toBeGreaterThan(0);
    for (const zug of zuege) {
      const felder = zug.breite / zug.achsmass!;
      expect(Math.abs(felder - Math.round(felder))).toBeLessThan(0.01);
    }
  });

  it('stellt vor die 600er Gondel eine 1250er Kopfgondel', () => {
    // Vorgabe aus der Praxis: 600er Boden → A1250, 500er → A1000.
    const zug = WT.find((e) => e.id === 'wt-zug-1250-5-600');
    expect(zug?.hinweis).toContain('A1250');
    const fuenfhundert = WT.find((e) => e.id === 'wt-zug-1250-5-500');
    expect(fuenfhundert?.hinweis).toContain('A1000');
  });

  it('führt jede Kopfgondel gerade und rund', () => {
    const gerade = WT.filter((e) => e.id.startsWith('wt-kopf-gerade-'));
    const rund = WT.filter((e) => e.id.startsWith('wt-kopf-rund-'));
    expect(gerade).toHaveLength(rund.length);
    expect(rund.length).toBeGreaterThan(0);
  });

  it('macht das Eckfeld quadratisch', () => {
    const ecken = WT.filter((e) => e.id.startsWith('wt-eck-'));
    expect(ecken.length).toBeGreaterThan(0);
    for (const eck of ecken) expect(eck.breite).toBe(eck.tiefe);
  });
});

describe('Kassen', () => {
  const KASSEN = BIBLIOTHEK.filter((e) => e.kategorie === 'kassen');
  const BEDIENT = KASSEN.filter((e) => /^kasse-(steh|sitz|doppel)-\d+$/.test(e.id));

  it('rechnet die Gesamtlänge aus Band und festen Abschnitten', () => {
    // Am Plan gemessen: Kopf 428 + Band + Kassenplatz 618 + Abpacktisch 1067.
    // Bei Band 1800 sind das 3913 mm – gemessen wurden 3912.
    const eintrag = BEDIENT.find((e) => e.id === 'kasse-sitz-1800');
    expect(eintrag).toBeDefined();
    expect(Math.round(eintrag!.breite * 10)).toBe(3913);
  });

  it('führt jede Bauart in allen fünf Bandlängen', () => {
    for (const bauart of ['steh', 'sitz', 'doppel']) {
      const treffer = BEDIENT.filter((e) => e.id.startsWith(`kasse-${bauart}-`));
      expect(treffer).toHaveLength(5);
    }
  });

  it('macht die Doppelkasse quer so breit wie zwei Bänder und die Insel', () => {
    // 480 + 745 + 480 plus Rahmen ergeben die gemessenen 1812 mm.
    const doppel = BEDIENT.filter((e) => e.id.startsWith('kasse-doppel-'));
    expect(doppel.length).toBeGreaterThan(0);
    for (const eintrag of doppel) expect(eintrag.tiefe).toBe(181.2);
  });

  it('gibt allen Kassen die Arbeitshöhe 960 mm', () => {
    // Die Höhe ist in der DGUV-Information 208-002 festgelegt.
    for (const eintrag of BEDIENT) expect(eintrag.hoehe).toBe(96);
  });
});

describe('Aktionsflächen', () => {
  const AKTION = BIBLIOTHEK.filter((e) => e.kategorie === 'aktion');

  it('führt die genormten Palettenmaße', () => {
    // Diese drei Maße sind der Grund für den ganzen Abschnitt. Sie sind
    // genormt und dürfen sich nicht durch eine Umstellung verschieben.
    const paletten = AKTION.filter((e) => e.form === 'palette');
    const masse = paletten.map((e) => `${e.breite}x${e.tiefe}`);
    expect(masse).toContain('120x80'); // EPAL
    expect(masse).toContain('80x60'); // 1/2 CHEP
    expect(masse).toContain('60x40'); // 1/4 CHEP
  });

  it('gibt jeder Palette und jedem Ständer eine Untergruppe', () => {
    const ohne = AKTION.filter((e) => !e.gruppe).map((e) => e.id);
    expect(ohne).toEqual([]);
  });

  it('macht Drehständer rund, also breit wie tief', () => {
    const staender = AKTION.filter((e) => e.form === 'drehstaender');
    expect(staender.length).toBeGreaterThan(0);
    for (const eintrag of staender) expect(eintrag.breite).toBe(eintrag.tiefe);
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
