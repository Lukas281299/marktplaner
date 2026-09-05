import { describe, expect, it } from 'vitest';
import { bauteileFuer, hoeheVon } from './moebel';
import { spiegele, type Bauteil, type Quader } from './bauteile';
import type { PlanElement, Regalfeld, Unterbauplatz } from '../../typen/modell';

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

/**
 * Wie viele Ebenen ein Regal zeigt — Grundboden und Drahtetagen zusammen.
 *
 * Der Grundboden ist eine Platte in Regalfarbe, die über die volle
 * Feldbreite geht; die Füße und Säulen sind schmal, die Sockelblende ist
 * dünn. Danach lässt er sich zählen.
 */
function ebenen(teile: Bauteil[]): number {
  // Eine Drahtetage ist 2,5 dick. Alles andere aus Draht gehört zu einem
  // Korb — dessen Boden ist dünner, seine Wände sind höher.
  const draht = quaderMit(teile, 'draht').filter((t) => Math.abs(t.h - 2.5) < 0.01).length;
  const grund = quaderMit(teile, 'regal').filter((t) => t.h <= 2.5 && t.b >= 50).length;
  return draht + grund;
}

describe('Das Wandregal', () => {
  const regal = element({});
  const teile = bauteileFuer(regal);

  it('bleibt in seinem Rahmen und in seiner Höhe', () => {
    expect(imRahmen(teile, regal.breite, regal.tiefe)).toBe(true);
    expect(hoechstePunkt(teile)).toBeLessThanOrEqual(regal.hoehe! + 2);
  });

  it('zählt den Grundboden als erste Etage mit', () => {
    // Wer sieben Böden einträgt, will sieben Ebenen sehen. Der Grundboden ist
    // eine davon: fünf eingetragene Böden sind das Sockelblech und vier
    // Drahtetagen darüber. Dieselbe Zählweise wie in der Rechnung.
    expect(quaderMit(teile, 'draht')).toHaveLength(4);
    expect(ebenen(teile)).toBe(5);
  });

  it('zeigt bei einem einzigen Boden genau eine Ebene', () => {
    const eins = element({ felderUnten: [{ breite: 100, boeden: 1 }] });
    const gebaut = bauteileFuer(eins);
    expect(quaderMit(gebaut, 'draht')).toHaveLength(0);
    expect(ebenen(gebaut)).toBe(1);
  });

  it('zeigt bei sieben Böden sieben Ebenen', () => {
    const sieben = element({ hoehe: 220, felderUnten: [{ breite: 100, boeden: 7 }] });
    expect(ebenen(bauteileFuer(sieben))).toBe(7);
  });

  it('lässt bei null Böden auch den Grundboden weg', () => {
    // Null heißt „keine Böden" — etwa dort, wo nur eine Palette steht.
    const ohne = element({ felderUnten: [{ breite: 100, boeden: 0 }] });
    expect(ebenen(bauteileFuer(ohne))).toBe(0);
  });

  it('hängt die Etagen hinten an, nicht vorn', () => {
    // Sie werden in die Säule eingehängt: Die hintere Kante steht fest, die
    // vordere wandert mit der Tiefe. Andersherum sähen flachere Etagen aus,
    // als schwebten sie vor der Rückwand.
    const drahtboeden = quaderMit(teile, 'draht');
    const hinten = new Set(drahtboeden.map((t) => Math.round(t.y * 10) / 10));
    expect(hinten.size).toBe(1);
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

  it('nimmt fünf Ebenen an, wenn keine eingetragen sind', () => {
    const ohne = element({ felderUnten: [{ breite: 100 }] });
    expect(ebenen(bauteileFuer(ohne))).toBe(5);
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

  it('trägt die Ebenen beider Seiten', () => {
    // Vorn fünf, hinten sechs — also vier plus fünf Drahtetagen über den
    // beiden Grundböden.
    expect(quaderMit(teile, 'draht')).toHaveLength(9);
    expect(ebenen(teile)).toBe(11);
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
    expect(vorn).toHaveLength(4);
    expect(hinten).toHaveLength(4);
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

  it('lässt einer freien Fläche ihre Abteilungsfarbe', () => {
    // Im Raum soll dieselbe Fläche liegen wie im Grundriss. Eine
    // Molkereifläche ist blau, auch wenn sie dieselbe Form hat wie eine
    // gelbe Aktionsfläche.
    const flaeche = element({
      kategorie: 'kuehlung',
      form: 'aktionsflaeche',
      hoehe: 0,
      farbe: '#b9d7ea',
    });
    expect(bauteileFuer(flaeche)[0].farbe).toBe('#b9d7ea');
  });

  it('lässt ein Fenster und ein Türblatt weg – die stecken in der Wand', () => {
    expect(bauteileFuer(element({ form: 'fenster' }))).toHaveLength(0);
    expect(bauteileFuer(element({ form: 'tuerBlatt' }))).toHaveLength(0);
  });

  it('gibt allem anderen einen Klotz in Kategoriefarbe', () => {
    const band = element({ kategorie: 'kassen', form: 'foerderband', breite: 300, tiefe: 60, hoehe: 96 });
    const teile = bauteileFuer(band);
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

describe('Die Kassenzone', () => {
  const kasse = (teil: Partial<PlanElement> = {}) =>
    element({ kategorie: 'kassen', form: 'kasse', breite: 391.3, tiefe: 58.4, hoehe: 96, ...teil });

  it('baut die Kassenzeile aus ihren vier Abschnitten', () => {
    const teile = bauteileFuer(kasse());
    // Das Warenband ist die dunkle Platte auf Arbeitshöhe.
    const band = teile.filter((t) => t.art === 'quader' && t.material === 'schwarz' && t.b > 100);
    expect(band.length).toBeGreaterThan(0);
    // Und die Packmulde liegt tiefer als die Arbeitsfläche.
    expect(teile.some((t) => t.material === 'edelstahl' && t.z < 96 && t.z > 60)).toBe(true);
  });

  it('spiegelt den Anschlag, ohne das Möbel zu drehen', () => {
    const links = bauteileFuer(kasse());
    const rechts = bauteileFuer(kasse({ gespiegelt: true }));
    const bandMitte = (teile: Bauteil[]) => {
      const band = teile.find((t) => t.art === 'quader' && t.material === 'schwarz' && t.b > 100);
      return band && band.art === 'quader' ? band.x + band.b / 2 : 0;
    };
    // Bei LA liegt das Band links, bei RA rechts – dieselbe Zeile, andere Seite.
    expect(bandMitte(links)).toBeLessThan(391.3 / 2);
    expect(bandMitte(rechts)).toBeGreaterThan(391.3 / 2);
  });

  it('gibt der Doppelkasse zwei Bahnen und eine Insel dazwischen', () => {
    const einzeln = bauteileFuer(kasse());
    const doppelt = bauteileFuer(kasse({ form: 'kasseDoppel', tiefe: 181.2 }));
    expect(doppelt.length).toBeGreaterThan(einzeln.length * 1.8);
    expect(imRahmen(doppelt, 391.3, 181.2, 30)).toBe(true);
  });

  it('setzt der Sitzkasse einen Stuhl daneben', () => {
    const ohne = bauteileFuer(kasse());
    const mit = bauteileFuer(kasse({ form: 'kasseSitz' }));
    expect(mit.length).toBeGreaterThan(ohne.length);
  });

  it('hält die Kassengondel niedrig und bestückt sie beidseitig', () => {
    const gondel = element({ kategorie: 'kassen', form: 'kassengondel', breite: 125, tiefe: 58.4, hoehe: 140 });
    const teile = bauteileFuer(gondel);
    expect(hoechstePunkt(teile)).toBeLessThanOrEqual(140);
    const boeden = teile.filter((t) => t.art === 'quader' && t.material === 'hellgrau' && t.h <= 2.5);
    // Vier bis fünf Böden je Seite.
    expect(boeden.length).toBeGreaterThanOrEqual(8);
  });

  it('stellt der SB-Kasse den Bildschirm über die Ablage', () => {
    const sb = element({ kategorie: 'kassen', form: 'sbKasse', breite: 90, tiefe: 80, hoehe: 150 });
    const teile = bauteileFuer(sb);
    expect(hoechstePunkt(teile)).toBeLessThanOrEqual(150);
    expect(teile.some((t) => t.material === 'edelstahl')).toBe(true);
  });

  it('gibt dem Leergutautomaten seine Einwurföffnung', () => {
    const automat = element({ kategorie: 'kassen', form: 'automat', breite: 120, tiefe: 100, hoehe: 200 });
    const teile = bauteileFuer(automat);
    // Die Öffnung ist ein liegender Zylinder in der Front.
    expect(teile.some((t) => t.art === 'zylinder' && t.achse === 'y')).toBe(true);
    expect(hoechstePunkt(teile)).toBeLessThanOrEqual(200);
  });

  it('bleibt überall in seinem Rahmen', () => {
    for (const [form, b, t, h] of [
      ['kasse', 391.3, 58.4, 96],
      ['kasseExpress', 120, 58.4, 96],
      ['packrutsche', 100, 58.4, 96],
      ['kassengondel', 125, 58.4, 140],
      ['sbKasse', 90, 80, 150],
      ['automat', 120, 100, 200],
      ['dpgBehaelter', 120, 80, 100],
      ['kastenablage', 300, 90, 180],
    ] as [PlanElement['form'], number, number, number][]) {
      const teile = bauteileFuer(element({ kategorie: 'kassen', form, breite: b, tiefe: t, hoehe: h }));
      expect(teile.length, form).toBeGreaterThan(0);
      // Der Mast und der Stuhl stehen bewusst über – dafür die Luft.
      expect(imRahmen(teile, b, t, 26), form).toBe(true);
    }
  });
});

describe('Was unter den Böden steht', () => {
  const mitUnterbau = (unterbau: Unterbauplatz) =>
    bauteileFuer(
      element({ breite: 125, tiefe: 67, hoehe: 200, felderUnten: [{ breite: 125, boeden: 2, unterbau }] }),
    );

  it('stellt die Getränkekisten unter das Regal', () => {
    const teile = mitUnterbau({ art: 'kiste' });
    const kaesten = teile.filter((t) => t.material === 'kiste' || t.material === 'kisteRot');
    expect(kaesten.length).toBeGreaterThan(0);
    // Sie stehen auf dem Boden und nicht in der Luft.
    expect(Math.min(...kaesten.map((t) => t.z))).toBe(0);
  });

  it('legt die Palette hin und stapelt Ware darauf', () => {
    const teile = mitUnterbau({ art: 'euro' });
    expect(teile.some((t) => t.material === 'palette')).toBe(true);
    expect(teile.some((t) => t.material === 'ware')).toBe(true);
  });

  it('schiebt die Böden über den Unterbau', () => {
    // Genau der Fall: ein Boden oben, darunter Platz für die Kisten.
    const ohne = bauteileFuer(
      element({ breite: 125, tiefe: 67, hoehe: 200, felderUnten: [{ breite: 125, boeden: 2 }] }),
    );
    const mit = mitUnterbau({ art: 'kiste' });
    const tiefster = (teile: Bauteil[]) =>
      Math.min(...quaderMit(teile, 'regal').filter((t) => t.h <= 2.5 && t.b >= 50).map((t) => t.z));
    expect(tiefster(mit)).toBeGreaterThan(tiefster(ohne) + 40);
  });

  it('gibt dem Kühlmöbel eine Glasfront', () => {
    expect(mitUnterbau({ art: 'kuehlmoebel' }).some((t) => t.material === 'glas')).toBe(true);
  });

  it('lässt die Kartoffelkiste aus Holz sein', () => {
    const teile = mitUnterbau({ art: 'kartoffelkiste' });
    expect(teile.some((t) => t.material === 'holzHell' || t.material === 'holzDunkel')).toBe(true);
  });
});

/**
 * Zwei Flächen, die genau aufeinanderliegen, kann die Grafikkarte nicht
 * auseinanderhalten: Sie zeigt mal die eine, mal die andere, und beim Drehen
 * flimmert es. Diese Prüfung sucht solche Paare, bevor sie jemand sieht.
 *
 * Geprüft werden nur **undurchsichtige** Quader: Glas liegt bewusst dicht an
 * anderen Flächen, und weil es durchsichtig ist, fällt dort nichts auf.
 */
function deckungsgleicheDeckflaechen(teile: Bauteil[]): string[] {
  const feste = teile.filter(
    (t): t is Quader => t.art === 'quader' && t.material !== 'glas' && !t.neigung,
  );
  const treffer: string[] = [];
  for (let i = 0; i < feste.length; i++) {
    for (let j = i + 1; j < feste.length; j++) {
      const a = feste[i];
      const b = feste[j];
      // Liegt die Oberkante des einen genau auf der des anderen?
      if (Math.abs(a.z + a.h - (b.z + b.h)) > 0.001) continue;
      // Und überlappen sie sich dort wirklich, statt nur nebeneinander zu liegen?
      const x = Math.min(a.x + a.b, b.x + b.b) - Math.max(a.x, b.x);
      const y = Math.min(a.y + a.t, b.y + b.t) - Math.max(a.y, b.y);
      if (x > 1 && y > 1) treffer.push(`z=${a.z + a.h} · ${a.material}/${b.material}`);
    }
  }
  return treffer;
}

describe('Nichts liegt genau aufeinander', () => {
  const tk = (form: PlanElement['form'], teil: Partial<PlanElement> = {}) =>
    bauteileFuer(
      element({ kategorie: 'tiefkuehlung', form, breite: 250, tiefe: 112, hoehe: 99, ...teil }),
    );

  it('nicht in der Truhe', () => {
    expect(deckungsgleicheDeckflaechen(tk('tkTruhe'))).toEqual([]);
  });

  it('nicht in der beidseitigen Truhe', () => {
    expect(deckungsgleicheDeckflaechen(tk('tkTruhe', { beidseitig: true, tiefe: 212 }))).toEqual([]);
  });

  it('nicht im Schrank', () => {
    expect(
      deckungsgleicheDeckflaechen(tk('tkSchrank', { breite: 234, tiefe: 94, hoehe: 201 })),
    ).toEqual([]);
  });

  it('nicht im Kombigerät', () => {
    expect(
      deckungsgleicheDeckflaechen(tk('tkKombi', { breite: 250, tiefe: 120, hoehe: 220 })),
    ).toEqual([]);
  });
});

describe('Körbe und Hängeware', () => {
  const bau = (ausstattung: Regalfeld['ausstattung'], boeden = 6) =>
    bauteileFuer(
      element({ hoehe: 200, tiefe: 57, felderUnten: [{ breite: 100, boeden, ausstattung }] }),
    );

  /**
   * Die Rückwand eines Einhängekorbs: 19 hoch, aus Draht.
   *
   * Eine gewöhnliche Drahtetage ist 2,5 dick — daran lassen sich die beiden
   * sicher unterscheiden.
   */
  const korbwaende = (teile: Bauteil[]) =>
    quaderMit(teile, 'draht').filter((t) => t.h >= 15);

  it('macht aus Etagen Körbe', () => {
    const ohne = bau(undefined);
    const mit = bau({ koerbe: { anzahl: 3, lage: 'unten' } });
    expect(korbwaende(ohne)).toHaveLength(0);
    expect(korbwaende(mit).length).toBeGreaterThan(0);
    // Die Zahl der Ebenen ändert sich dadurch nicht.
    expect(ebenen(mit)).toBe(ebenen(ohne));
  });

  it('gibt dem Korb sein Katalogmaß: hinten 19, vorn 7,5', () => {
    // Wanzl WT100 08.010, „Einhängekorb H=190/75".
    const teile = bau({ koerbe: { anzahl: 1, lage: 'unten' } });
    expect(korbwaende(teile).some((t) => Math.abs(t.h - 19) < 0.01)).toBe(true);
    expect(quaderMit(teile, 'draht').some((t) => Math.abs(t.h - 7.5) < 0.01)).toBe(true);
  });

  it('macht den Korb so breit wie das Feld und so tief wie die Etage', () => {
    const teile = bau({ koerbe: { anzahl: 1, lage: 'unten' } });
    const boden = korbwaende(teile)[0];
    expect(boden.b).toBe(100);
  });

  it('fängt beim untersten Boden an, wenn von unten aufgestockt wird', () => {
    // Der Grundboden ist die erste Ebene und trägt deshalb den ersten Korb.
    const teile = bau({ koerbe: { anzahl: 1, lage: 'unten' } }, 6);
    const tiefster = Math.min(...korbwaende(teile).map((t) => t.z));
    // Der Grundboden liegt bei SOCKEL = 12; der Korb sitzt darauf.
    expect(tiefster).toBeLessThan(20);
  });

  it('nimmt bei allen Ebenen auch den Grundboden mit', () => {
    // Sechs Ebenen, sechs Körbe: der Grundboden und die fünf Drahtetagen.
    const teile = bau({ koerbe: { anzahl: 6, lage: 'unten' } }, 6);
    const rueckwaende = korbwaende(teile).filter((t) => Math.abs(t.h - 19) < 0.01 && t.b >= 50);
    expect(rueckwaende).toHaveLength(6);
  });

  it('setzt die Körbe dorthin, wo sie stehen sollen', () => {
    const hoehe = (teile: Bauteil[]) => Math.min(...korbwaende(teile).map((t) => t.z));
    const unten = hoehe(bau({ koerbe: { anzahl: 2, lage: 'unten' } }));
    const oben = hoehe(bau({ koerbe: { anzahl: 2, lage: 'oben' } }));
    expect(oben).toBeGreaterThan(unten + 40);
  });

  it('hängt statt Böden ein Gitter mit Haken davor', () => {
    // Die Blister-Rückwand ist ein Gewebe, kein Blech — und dünner als die
    // Gitter-Rückwand des Regals, an der man sie unterscheidet.
    const mit = bau({ haengeware: { anteil: 50, lage: 'oben' } });
    expect(mit.some((t) => t.art === 'quader' && t.material === 'gitter' && t.t === 0.6)).toBe(true);
    // Und davor die Haken, quer nach vorn.
    const haken = mit.filter(
      (t) => t.art === 'zylinder' && t.material === 'chrom' && t.achse === 'y',
    );
    expect(haken.length).toBeGreaterThan(4);
  });

  it('macht die Haken 30 cm lang', () => {
    const mit = bau({ haengeware: { anteil: 50, lage: 'oben' } });
    const haken = mit.filter(
      (t): t is Extract<Bauteil, { art: 'zylinder' }> =>
        t.art === 'zylinder' && t.material === 'chrom' && t.achse === 'y',
    );
    expect(haken.every((h) => h.laenge === 30)).toBe(true);
  });

  it('zeichnet an der Blisterwand keine Ware', () => {
    // Was daran hängt, ist Ware und keine Einrichtung. Gezeichnet wird das
    // Gitter und die Haken, sonst nichts.
    const mit = bau({ haengeware: { anteil: 50, lage: 'oben' } });
    expect(mit.some((t) => t.material === 'ware')).toBe(false);
  });

  it('drängt die Böden aus der Zone der Hängeware', () => {
    const ohne = bau(undefined);
    const mit = bau({ haengeware: { anteil: 50, lage: 'oben' } });
    const hoechster = (teile: Bauteil[]) =>
      Math.max(...quaderMit(teile, 'draht').map((t) => t.z));
    // Gleich viele Böden, aber alle unterhalb der Lochwand.
    expect(quaderMit(mit, 'draht').length).toBe(quaderMit(ohne, 'draht').length);
    expect(hoechster(mit)).toBeLessThan(hoechster(ohne) - 30);
  });

  it('verträgt beides zusammen', () => {
    const teile = bau({
      koerbe: { anzahl: 2, lage: 'unten' },
      haengeware: { anteil: 40, lage: 'oben' },
    });
    expect(teile.some((t) => t.art === 'quader' && t.material === 'gitter' && t.t === 0.6)).toBe(
      true,
    );
    expect(korbwaende(teile).length).toBeGreaterThan(0);
  });
});
