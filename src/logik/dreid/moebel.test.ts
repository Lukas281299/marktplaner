import { describe, expect, it } from 'vitest';
import { bauteileFuer, hoeheVon } from './moebel';
import { spiegele, type Bauteil, type Quader } from './bauteile';
import type { PlanElement } from '../../typen/modell';

/**
 * Prüfungen für die Bauteile der 3D-Ansicht.
 *
 * Der Sinn der Trennung zwischen Rezept und Renderer ist genau das hier: Ob
 * ein Regal fünf Böden hat, ob eine Gondel auf beiden Seiten gleich aussieht,
 * ob eine Truhe hüfthoch bleibt – das ist Rechnen und lässt sich ohne WebGL
 * beantworten. Was danach three.js daraus macht, ist stumpfe Übersetzung.
 *
 * Geprüft werden die Aussagen, die im Markt zählen: **Höhe** (verdeckt ein
 * Möbel die Sicht?), **Lage im eigenen Rahmen** (steht nichts über?) und die
 * **Zahl der tragenden Teile** (stimmen die Böden?).
 */

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'wt-wand-1000-300-1400',
    ebeneId: 'einrichtung',
    name: 'Möbel',
    kategorie: 'regale',
    x: 500,
    y: 500,
    breite: 100,
    tiefe: 37,
    hoehe: 140,
    drehung: 0,
    form: 'wt100',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
    beidseitig: false,
    achsmass: 100,
    felderUnten: [{ breite: 100, boeden: 5 }],
    ...teil,
  } as PlanElement;
}

/** Die höchste Stelle, die ein Bauteil erreicht. */
function hoechstePunkt(teile: Bauteil[]): number {
  let oben = 0;
  for (const teil of teile) {
    const z =
      teil.art === 'quader'
        ? teil.z + teil.h
        : teil.art === 'zylinder'
          ? teil.z + (teil.achse === 'z' ? teil.laenge : teil.radius)
          : teil.art === 'prisma'
            ? teil.z + teil.h
            : teil.z + teil.radius;
    oben = Math.max(oben, z);
  }
  return oben;
}

/** Liegt alles innerhalb des Rahmens, mit etwas Luft für Rohre und Griffe? */
function imRahmen(teile: Bauteil[], breite: number, tiefe: number, luft = 12): boolean {
  return teile.every((teil) => {
    if (teil.art === 'prisma') {
      return teil.punkte.every(
        (p) => p.x >= -luft && p.x <= breite + luft && p.y >= -luft && p.y <= tiefe + luft,
      );
    }
    if (teil.art === 'quader') {
      return teil.x >= -luft && teil.x + teil.b <= breite + luft && teil.y >= -luft && teil.y + teil.t <= tiefe + luft;
    }
    return teil.x >= -luft && teil.x <= breite + luft && teil.y >= -luft && teil.y <= tiefe + luft;
  });
}

const quaderMit = (teile: Bauteil[], material: string): Quader[] =>
  teile.filter((t): t is Quader => t.art === 'quader' && t.material === material);

describe('Das Wandregal', () => {
  const regal = element({});
  const teile = bauteileFuer(regal);

  it('bleibt in seinem Rahmen und in seiner Höhe', () => {
    expect(imRahmen(teile, regal.breite, regal.tiefe)).toBe(true);
    expect(hoechstePunkt(teile)).toBeLessThanOrEqual(regal.hoehe! + 2);
  });

  it('hat so viele Drahtetagen wie Böden eingetragen sind', () => {
    expect(quaderMit(teile, 'draht')).toHaveLength(5);
  });

  it('hat eine Säule mehr als Felder', () => {
    const zug = element({
      breite: 300,
      felderUnten: [{ breite: 100 }, { breite: 100 }, { breite: 100 }],
    });
    // Säulen sind die Regalteile, die vom Boden bis zur vollen Höhe reichen.
    const saeulen = quaderMit(bauteileFuer(zug), 'regal').filter(
      (t) => t.z === 0 && t.h === zug.hoehe,
    );
    expect(saeulen).toHaveLength(4);
  });

  it('nimmt fünf Böden an, wenn keine eingetragen sind', () => {
    const ohne = element({ felderUnten: [{ breite: 100 }] });
    expect(quaderMit(bauteileFuer(ohne), 'draht')).toHaveLength(5);
  });

  it('zeigt das Führungsrohr nur, wenn es bestellt ist', () => {
    const ohne = bauteileFuer(element({}));
    const mit = bauteileFuer(element({ fuehrungsrohr: true }));
    expect(ohne.some((t) => t.material === 'chrom')).toBe(false);
    expect(mit.some((t) => t.material === 'chrom')).toBe(true);
  });
});

describe('Die Gondel', () => {
  const gondel = element({
    beidseitig: true,
    tiefe: 74,
    felderUnten: [{ breite: 100, boeden: 5 }],
    felderOben: [{ breite: 100, boeden: 6 }],
  });
  const teile = bauteileFuer(gondel);

  it('trägt die Böden beider Seiten', () => {
    expect(quaderMit(teile, 'draht')).toHaveLength(11);
  });

  it('bleibt in ihrem Rahmen', () => {
    expect(imRahmen(teile, gondel.breite, gondel.tiefe)).toBe(true);
  });

  it('hat auf beiden Seiten gleich viel, wenn beide gleich eingeteilt sind', () => {
    const gleich = element({
      beidseitig: true,
      tiefe: 74,
      felderUnten: [{ breite: 100, boeden: 5 }],
      felderOben: [{ breite: 100, boeden: 5 }],
    });
    const alle = bauteileFuer(gleich);
    const vorn = alle.filter((t) => t.art === 'quader' && t.material === 'draht' && t.y > 37);
    const hinten = alle.filter((t) => t.art === 'quader' && t.material === 'draht' && t.y < 37);
    expect(vorn).toHaveLength(5);
    expect(hinten).toHaveLength(5);
  });
});

describe('Obst und Gemüse', () => {
  const tisch = element({
    kategorie: 'obstgemuese',
    form: 'vitable',
    breite: 125,
    tiefe: 131.7,
    hoehe: 160,
    stufen: [120, 60],
    felderUnten: [{ breite: 125 }],
  });
  const teile = bauteileFuer(tisch);

  it('legt grüne Kisten auf die Auflagen', () => {
    expect(quaderMit(teile, 'kiste').length).toBeGreaterThan(0);
  });

  it('legt sie geneigt wie die Auflage', () => {
    const kisten = quaderMit(teile, 'kiste');
    expect(kisten.every((k) => k.neigung === 25)).toBe(true);
  });

  it('bleibt in seiner Höhe', () => {
    expect(hoechstePunkt(teile)).toBeLessThanOrEqual(tisch.hoehe! + 25);
  });
});

describe('Die Tiefkühlung', () => {
  it('macht aus der Truhe eine Wanne mit Glasdeckel', () => {
    const truhe = element({
      kategorie: 'tiefkuehlung',
      form: 'tkTruhe',
      breite: 250,
      tiefe: 112,
      hoehe: 99,
    });
    const teile = bauteileFuer(truhe);
    expect(teile.some((t) => t.material === 'glas')).toBe(true);
    expect(hoechstePunkt(teile)).toBeLessThan(105);
  });

  it('gibt dem Schrank Glastüren über die ganze Front', () => {
    const schrank = element({
      kategorie: 'tiefkuehlung',
      form: 'tkSchrank',
      breite: 234.3,
      tiefe: 94,
      hoehe: 201,
    });
    const teile = bauteileFuer(schrank);
    const glas = teile.filter((t) => t.material === 'glas');
    // Drei Türen im Raster 78,1.
    expect(glas.length).toBeGreaterThanOrEqual(3);
    expect(imRahmen(teile, schrank.breite, schrank.tiefe)).toBe(true);
  });
});

describe('Der BakeOff-Turm', () => {
  const turm = element({
    kategorie: 'backwaren',
    form: 'bakeoff',
    breite: 100,
    tiefe: 88.5,
    hoehe: 185.5,
  });
  const teile = bauteileFuer(turm);

  it('hat vier Etagen mit je drei Glasklappen', () => {
    // Zwölf Klappen plus Seitengläser und Dach.
    expect(teile.filter((t) => t.material === 'glas').length).toBeGreaterThanOrEqual(12);
  });

  it('trägt die Holzfront am Unterbau', () => {
    expect(teile.some((t) => t.material === 'holzHell')).toBe(true);
  });

  it('bleibt in seinem Rahmen', () => {
    expect(imRahmen(teile, turm.breite, turm.tiefe)).toBe(true);
    expect(hoechstePunkt(teile)).toBeLessThanOrEqual(turm.hoehe! + 1);
  });
});

describe('Getränke', () => {
  it('stapelt die Kästen vor dem Gestell', () => {
    const gestell = element({
      kategorie: 'getraenke',
      form: 'getraenkegestell',
      breite: 150,
      tiefe: 66,
      hoehe: 160,
      kisten: { lage: 'laengs', reihen: 1 },
    });
    const teile = bauteileFuer(gestell);
    const kaesten = teile.filter(
      (t) => t.material === 'kiste' || t.material === 'kisteRot' || t.material === 'ware',
    );
    // Drei Kästen nebeneinander auf 150 cm, vier hoch, zwei Seiten.
    expect(kaesten.length).toBe(3 * 4 * 2);
  });
});

describe('Zonen und Platzhalter', () => {
  it('macht aus einer Aktionsfläche eine flache Markierung', () => {
    const flaeche = element({ kategorie: 'aktion', form: 'aktionsflaeche', hoehe: 0, breite: 200, tiefe: 200 });
    const teile = bauteileFuer(flaeche);
    expect(teile).toHaveLength(1);
    expect(hoechstePunkt(teile)).toBeLessThan(3);
  });

  it('lässt ein Fenster und ein Türblatt weg – die stecken in der Wand', () => {
    expect(bauteileFuer(element({ form: 'fenster' }))).toHaveLength(0);
    expect(bauteileFuer(element({ form: 'tuerBlatt' }))).toHaveLength(0);
  });

  it('gibt allem anderen einen Klotz in Kategoriefarbe', () => {
    const kasse = element({ kategorie: 'kassen', form: 'kasse', breite: 391, tiefe: 58, hoehe: 96 });
    const teile = bauteileFuer(kasse);
    expect(teile).toHaveLength(1);
    expect(teile[0].material).toBe('kategorie');
    expect(hoechstePunkt(teile)).toBe(96);
  });

  it('nimmt eine Ersatzhöhe, wenn keine eingetragen ist', () => {
    // Eine Kasse ist tischhoch, ein Regal mannshoch – ein Möbel ohne Höhe
    // soll nicht flach auf dem Boden liegen.
    expect(hoeheVon(element({ hoehe: undefined, kategorie: 'kassen' }))).toBe(90);
    expect(hoeheVon(element({ hoehe: undefined, kategorie: 'regale' }))).toBe(180);
    expect(hoeheVon(element({ hoehe: 220 }))).toBe(220);
  });
});

describe('Spiegeln', () => {
  it('legt einen Quader an die andere Seite', () => {
    const [gespiegelt] = spiegele(
      [{ art: 'quader', x: 0, y: 10, z: 0, b: 5, t: 20, h: 5, material: 'regal' }],
      100,
    );
    expect(gespiegelt).toMatchObject({ y: 70, gespiegelt: true });
  });

  it('dreht ein Prisma um, damit seine Fläche oben bleibt', () => {
    const [gespiegelt] = spiegele(
      [{ art: 'prisma', punkte: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], z: 0, h: 5, material: 'regal' }],
      100,
    );
    if (gespiegelt.art !== 'prisma') throw new Error('kein Prisma');
    expect(gespiegelt.punkte).toEqual([
      { x: 10, y: 90 },
      { x: 10, y: 100 },
      { x: 0, y: 100 },
    ]);
  });
});
