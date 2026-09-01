import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import {
  BLENDENSTAERKE,
  griffZugabe,
  einheitenNaehte,
  zeichenAbschnitte,
  zeichneAchsmass,
  zeichneForm,
  zeichneFuehrungsrohr,
  zeichneFeldnotizen,
  zeichneFlaechenangaben,
  zeichneStriche,
  zeichneWarengruppen,
} from './ElementSymbol';
import { BIBLIOTHEK } from '../../daten/bibliothek';
import type { Grundform, PlanElement , Warengruppenabschnitt } from '../../typen/modell';

/**
 * Prüfungen für die Zeichenfunktion der Symbole.
 *
 * Gezeichnet wird auf einer Leinwand, und die verschluckt jeden Fehler
 * stillschweigend: Eine Linie nach NaN erscheint einfach nicht, ein falscher
 * Radius zieht einen Strich quer über den Plan. Deshalb wird hier statt einer
 * echten Leinwand ein Mitschreiber untergeschoben, der jeden Punkt festhält.
 *
 * Ein zweiter Fehler wäre schlimmer als eine fehlende Linie: eine Schleife,
 * deren Schrittweite bei einem sehr kleinen Element auf null fällt. Die
 * Anwendung würde einfrieren. Deshalb wird jede Form auch in winzig geprüft.
 */

/** Sammelt alle Koordinaten, die eine Zeichnung anfährt. */
function mitschreiber() {
  const punkte: number[] = [];
  const aufrufe: string[] = [];

  function merke(name: string, ...werte: number[]) {
    aufrufe.push(name);
    punkte.push(...werte);
  }

  const ctx = {
    rect: (x: number, y: number, b: number, t: number) => merke('rect', x, y, b, t),
    moveTo: (x: number, y: number) => merke('moveTo', x, y),
    lineTo: (x: number, y: number) => merke('lineTo', x, y),
    closePath: () => merke('closePath'),
    arc: (x: number, y: number, r: number, a1: number, a2: number) =>
      merke('arc', x, y, r, a1, a2),
    arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) =>
      merke('arcTo', x1, y1, x2, y2, r),
    ellipse: (x: number, y: number, rx: number, ry: number) => merke('ellipse', x, y, rx, ry),
  };

  return { ctx: ctx as unknown as Konva.Context, punkte, aufrufe };
}

/** Jede Form, die in der Bibliothek wirklich vorkommt. */
const FORMEN: Grundform[] = [...new Set(BIBLIOTHEK.map((e) => e.form))];

describe('Symbole zeichnen', () => {
  it('deckt mit der Bibliothek fast alle Formen ab', () => {
    // Wenn jemand eine Form ergänzt, aber keinen Eintrag dazu, fällt sie hier
    // durchs Raster – dann sagt diese Zahl, dass etwas fehlt.
    expect(FORMEN.length).toBeGreaterThanOrEqual(25);
  });

  for (const form of FORMEN) {
    it(`zeichnet ${form} ohne ungültige Koordinaten`, () => {
      const { ctx, punkte, aufrufe } = mitschreiber();
      zeichneForm(ctx, form, 250, 120, false);

      // `umriss` ist die eine Form, die hier nichts zeichnet: Ihr Polygon
      // steht am Element und wird erst im sceneFunc gezogen. Alles andere
      // muss hier etwas hinterlassen – zeichnet eine Form gar nichts, sieht
      // man auf dem Plan ein leeres Rechteck und sucht den Fehler woanders.
      if (form !== 'umriss') expect(aufrufe.length).toBeGreaterThan(0);
      const kaputt = punkte.filter((wert) => !Number.isFinite(wert));
      expect(kaputt).toEqual([]);
    });

    it(`zeichnet ${form} auch beidseitig`, () => {
      const { ctx, punkte } = mitschreiber();
      zeichneForm(ctx, form, 250, 120, true);
      expect(punkte.every((wert) => Number.isFinite(wert))).toBe(true);
    });

    it(`bleibt bei ${form} auch in winzig stehen`, () => {
      // Ein Element lässt sich mit den Anfassern beliebig klein ziehen.
      // Bleibt eine Schleife dabei hängen, friert die Anwendung ein – der
      // Test würde hier in die Zeitbegrenzung von vitest laufen.
      const { ctx, punkte } = mitschreiber();
      zeichneForm(ctx, form, 0.4, 0.2, false);
      expect(punkte.every((wert) => Number.isFinite(wert))).toBe(true);
    });
  }

  it('gibt der Treppe so viele Kanten, wie Stufen hineinpassen', () => {
    // 300 cm Lauf bei 28 cm Auftritt sind elf Stufen, also zehn Kanten
    // dazwischen. Dazu kommen Umriss und Pfeil.
    const { ctx, aufrufe } = mitschreiber();
    zeichneForm(ctx, 'treppe', 300, 120);
    const linien = aufrufe.filter((a) => a === 'lineTo').length;
    expect(linien).toBe(10 + 1 + 2);
  });

  it('unterscheidet Gondel und Wandregal', () => {
    const wand = mitschreiber();
    zeichneForm(wand.ctx, 'regal', 125, 60, false);
    const gondel = mitschreiber();
    zeichneForm(gondel.ctx, 'regal', 125, 120, true);

    // Die Gondel hat den Mittelsteg, also eine Linie mehr als die Rückwand.
    const striche = (a: string[]) => a.filter((n) => n === 'lineTo').length;
    expect(striche(wand.aufrufe)).toBe(1);
    expect(striche(gondel.aufrufe)).toBe(2);
  });
});

describe('Türen an Kühlmöbeln', () => {
  /**
   * Die Radien aller Schwenkbögen vor der Front.
   *
   * Ein eigener Mitschreiber statt des großen oben: Der wirft alle Werte in
   * einen Topf, und aus dem den Radius wieder herauszurechnen hieße, die
   * Argumentzahl jedes Zeichenbefehls nachzuhalten – eine Fehlerquelle, die
   * mit dem Geprüften nichts zu tun hat.
   */
  function boegen(form: Grundform, breite: number, tiefe = 90) {
    const radien: number[] = [];
    const ctx = {
      rect: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      arcTo: () => {},
      ellipse: () => {},
      arc: (_x: number, _y: number, r: number) => radien.push(r),
    };
    zeichneStriche(ctx as unknown as Konva.Context, form, breite, tiefe);
    return radien;
  }

  it('setzt alle 62,5 cm eine Tür', () => {
    // Die Regel aus dem Markt: 2,50 m sind vier Türen.
    expect(boegen('kuehlSchrank', 250)).toHaveLength(4);
  });

  it('macht jede Tür genau 62,5 cm breit', () => {
    // Der Schwenkradius ist die Türbreite – daran hängt, wie viel Gang eine
    // offene Tür braucht. Stimmt die Zahl der Türen, muss auch der Radius
    // stimmen, sonst teilt die Zeichnung die Front falsch auf.
    for (const radius of boegen('tkSchrank', 375)) expect(radius).toBeCloseTo(62.5, 6);
  });

  it('führt die Katalogmaße auf ganze Türen', () => {
    // 937, 1250, 1875, 2500 und 3750 mm – die Längen aus der Bibliothek.
    const erwartet: [number, number][] = [
      [93.7, 1],
      [125, 2],
      [187.5, 3],
      [250, 4],
      [375, 6],
    ];
    for (const [breite, anzahl] of erwartet) {
      expect(boegen('kuehlStufen', breite)).toHaveLength(anzahl);
    }
  });

  it('lässt das offene Kühlregal ohne Türen', () => {
    // Der Unterschied zum kuehlSchrank ist genau die Tür – sonst wären die
    // beiden blauen Möbel im Plan nicht zu unterscheiden.
    expect(boegen('kuehlOffen', 250)).toHaveLength(0);
  });

  it('gibt der Truhe keine Türen', () => {
    // Eine Tiefkühlinsel hat Schiebedeckel, keine Schwenktüren.
    expect(boegen('tkTruhe', 250)).toHaveLength(0);
  });

  it('gibt dem Türblatt genau ein Blatt, egal wie breit es ist', () => {
    expect(boegen('tuerBlatt', 100, 12)).toHaveLength(1);
    expect(boegen('tuerBlatt', 250, 12)).toHaveLength(1);
  });
});

describe('Gemischter Regalzug', () => {
  /** Die x-Stellen, an denen der Zug senkrecht geteilt wird. */
  function trennlinien(breite: number, felder?: number[], achsmass = 100) {
    const { ctx, aufrufe, punkte } = mitschreiber();
    zeichneForm(
      ctx,
      'wt100',
      breite,
      127,
      true,
      achsmass,
      felder?.map((b) => ({ breite: b })),
    );
    const stellen: number[] = [];
    let zeiger = 0;
    for (let i = 0; i < aufrufe.length; i++) {
      const name = aufrufe[i];
      if (name === 'moveTo' && aufrufe[i + 1] === 'lineTo') {
        const [x1, y1] = [punkte[zeiger], punkte[zeiger + 1]];
        const [x2, y2] = [punkte[zeiger + 2], punkte[zeiger + 3]];
        // Senkrecht und über die ganze Tiefe: das ist eine Feldgrenze.
        if (Math.abs(x1 - x2) < 0.01 && Math.abs(y1) < 0.01 && Math.abs(y2 - 127) < 0.01) {
          stellen.push(Math.round(x1 * 100) / 100);
        }
      }
      zeiger += { arc: 6, arcTo: 5, rect: 4, ellipse: 4, moveTo: 2, lineTo: 2, closePath: 0 }[
        name as 'arc'
      ];
    }
    return stellen;
  }

  it('setzt die Feldgrenzen dorthin, wo die Säule steht', () => {
    // Fünf Felder A1000 und eines A1250: Die Grenzen liegen bei 100, 200,
    // 300, 400 und 500 – nicht bei gleichmäßigen Sechsteln von 6,25 m.
    expect(trennlinien(625, [100, 100, 100, 100, 100, 125])).toEqual([100, 200, 300, 400, 500]);
  });

  it('setzt das breite Feld dorthin, wo es in der Liste steht', () => {
    // Genau darum geht es bei der Position: Steht das A1250 vorn, sitzt die
    // erste Grenze bei 125 und nicht bei 100.
    expect(trennlinien(625, [125, 100, 100, 100, 100, 100])).toEqual([125, 225, 325, 425, 525]);
  });

  it('teilt ohne Feldliste weiter gleichmäßig', () => {
    // So wurde bis dahin jeder Zug gezeichnet – eine ältere Planung darf
    // sich durch das Öffnen nicht verändern.
    expect(trennlinien(600, undefined, 100)).toEqual([100, 200, 300, 400, 500]);
  });
});

describe('Trennung zwischen Einheiten', () => {
  /**
   * Die x-Stellen, an denen ein Element über die ganze Tiefe geteilt wird.
   *
   * Gerufen wird die echte Funktion aus der Zeichnung, nicht eine Kopie
   * ihrer Rechnung – sonst prüfte der Test sich selbst. Die Zeichenbreite
   * ist gleich der Planbreite, damit die Werte direkt ablesbar sind.
   */
  function naehte(el: Partial<PlanElement> & { form: Grundform; breite: number }) {
    const element = {
      id: 'x', vorlageId: 'x', ebeneId: 'einrichtung', name: 'x', kategorie: 'regale',
      x: 0, y: 0, tiefe: 100, drehung: 0, farbe: '#888', beschriftung: '',
      beschriftungSichtbar: false, schriftgroesse: 12, gesperrt: false, reihenfolge: 0,
      ...el,
    } as PlanElement;
    return einheitenNaehte(element, element.breite).map((x) => Math.round(x * 100) / 100);
  }

  it('trennt zwei angehängte Kühlregale', () => {
    // Genau der Fall: ein 1,25-m-Möbel, ein weiteres drangehängt. Der Plan
    // muss zeigen, dass es zwei sind und nicht ein langes.
    expect(naehte({ form: 'kuehlSchrank', breite: 250, felder: [125, 125] })).toEqual([125]);
  });

  it('trennt drei Einheiten in Obst und Gemüse', () => {
    expect(naehte({ form: 'vitable', breite: 350, felder: [125, 125, 100] })).toEqual([125, 250]);
  });

  it('lässt ein einzelnes Möbel ungeteilt', () => {
    // Ein Kühlregal von 1,88 m ist ein Gerät dieser Länge – da gehört
    // keine Naht hinein.
    expect(naehte({ form: 'kuehlSchrank', breite: 187.5 })).toEqual([]);
  });

  it('überlässt der Truhe ihre eigene Teilung', () => {
    // Die Tiefkühlinsel zeichnet ihre Module à 625 mm selbst. Eine zweite
    // Naht läge auf denselben Koordinaten – der Strich würde dadurch nur
    // schwerer, ohne etwas zu zeigen.
    expect(naehte({ form: 'tkTruhe', breite: 250 })).toEqual([]);
  });

  it('mischt sich beim Regalzug nicht ein', () => {
    // Das Trockensortiment zeichnet seine Feldgrenzen selbst – käme hier
    // noch eine Naht dazu, läge sie doppelt auf derselben Linie.
    expect(naehte({ form: 'wt100', breite: 625, felder: [100, 100, 100, 100, 100, 125] }))
      .toEqual([]);
  });

  it('gibt Formen ohne Raster keine Naht', () => {
    // Die Freihand-Formen kennen kein Raster – da gibt es nichts zu trennen.
    expect(naehte({ form: 'regal', breite: 400 })).toEqual([]);
    expect(naehte({ form: 'rechteck', breite: 400 })).toEqual([]);
  });
});

/**
 * Die Diagonalen und Kreuze, die ein Element zeichnet.
 *
 * Gemessen wird an der echten Zeichenfunktion: Eine Diagonale läuft von
 * unten links nach oben rechts, ein Kreuz hat zusätzlich die Gegenrichtung.
 * Zurück kommen die Spannweiten – daran erkennt man, ob je Einheit oder
 * über das ganze Möbel gezeichnet wurde.
 */
function diagonalen(el: Partial<PlanElement> & { form: Grundform; breite: number }) {
  const element = {
    id: 'x', vorlageId: 'x', ebeneId: 'einrichtung', name: 'x', kategorie: 'obstgemuese',
    x: 0, y: 0, tiefe: 100, drehung: 0, farbe: '#888', beschriftung: '',
    beschriftungSichtbar: false, schriftgroesse: 12, gesperrt: false, reihenfolge: 0,
    ...el,
  } as PlanElement;
  const t = 100;
  const aufrufe: [string, number, number][] = [];
  const ctx = {
    rect: () => {}, closePath: () => {}, arc: () => {}, arcTo: () => {}, ellipse: () => {},
    moveTo: (x: number, y: number) => aufrufe.push(['m', x, y]),
    lineTo: (x: number, y: number) => aufrufe.push(['l', x, y]),
  } as unknown as Konva.Context;
  zeichneAchsmass(ctx, element, element.breite, t);

  const auf: number[] = [];
  const ab: number[] = [];
  for (let i = 0; i < aufrufe.length - 1; i++) {
    const [a, x1, y1] = aufrufe[i];
    const [b, x2, y2] = aufrufe[i + 1];
    if (a !== 'm' || b !== 'l') continue;
    const weite = Math.round((x2 - x1) * 100) / 100;
    if (Math.abs(y1 - t) < 0.01 && Math.abs(y2) < 0.01) auf.push(weite);
    if (Math.abs(y1) < 0.01 && Math.abs(y2 - t) < 0.01) ab.push(weite);
  }
  return { diagonalen: auf, gegendiagonalen: ab };
}

describe('Achsmaß-Zeichen je Einheit', () => {
  it('gibt einem 1,25-m-Tisch seine Diagonale', () => {
    expect(diagonalen({ form: 'vitable', breite: 125 }).diagonalen).toEqual([125]);
  });

  it('gibt zwei angehängten 1,25ern zwei Diagonalen', () => {
    // Genau der gemeldete Fehler: Aus der Gesamtbreite gerechnet wären
    // 2,50 m ein Maß ohne Zeichen – die Diagonale verschwand.
    const ergebnis = diagonalen({ form: 'vitable', breite: 250, felder: [125, 125] });
    expect(ergebnis.diagonalen).toEqual([125, 125]);
  });

  it('lässt 1,00-m-Einheiten ohne Zeichen', () => {
    expect(diagonalen({ form: 'vitable', breite: 200, felder: [100, 100] }).diagonalen).toEqual([]);
  });

  it('mischt Maße richtig', () => {
    // Ein A1000 trägt nichts, ein A1250 die Diagonale.
    const ergebnis = diagonalen({ form: 'vitable', breite: 225, felder: [100, 125] });
    expect(ergebnis.diagonalen).toEqual([125]);
  });

  it('zeichnet beim BakeOff-Turm nach derselben Regel', () => {
    expect(diagonalen({ form: 'bakeoff', breite: 100 }).diagonalen).toEqual([]);
  });

  it('bleibt bei Formen ohne Raster beim ganzen Möbel', () => {
    // Ein „Regal frei" von 1,25 m trägt weiterhin seine Diagonale, obwohl
    // es keine Einheiten kennt.
    expect(diagonalen({ form: 'regal', breite: 125 }).diagonalen).toEqual([125]);
  });
});

describe('45-Grad-Eckstück', () => {
  /** Die Eckpunkte, die das Eckstück zeichnet. */
  function ecken(b: number, t: number, gespiegelt = false) {
    const { ctx, aufrufe, punkte } = mitschreiber();
    zeichneForm(ctx, 'vitableEckInnen', b, t, false, 0, undefined, gespiegelt);
    const p: [number, number][] = [];
    let zeiger = 0;
    for (const name of aufrufe) {
      if (name === 'moveTo' || name === 'lineTo') p.push([punkte[zeiger], punkte[zeiger + 1]]);
      zeiger += { arc: 6, arcTo: 5, rect: 4, ellipse: 4, moveTo: 2, lineTo: 2, closePath: 0 }[
        name as 'arc'
      ];
    }
    return p;
  }

  it('hat am Anschluss die volle Tiefe und läuft zur Ecke aus', () => {
    // Länge halbe Tiefe: links volle 100, rechts noch 50.
    expect(ecken(50, 100)).toEqual([
      [0, 0],
      [50, 0],
      [50, 50],
      [0, 100],
    ]);
  });

  it('schneidet die Front unter genau 45 Grad', () => {
    // Der Kern: Auf der Länge b nimmt die Tiefe um genau b ab.
    const p = ecken(50, 100);
    const dx = p[2][0] - p[3][0];
    const dy = p[2][1] - p[3][1];
    expect(Math.abs(Math.abs(dx) - Math.abs(dy))).toBeLessThan(0.001);
  });

  it('spiegelt die volle Tiefe ans andere Ende', () => {
    expect(ecken(50, 100, true)).toEqual([
      [0, 0],
      [50, 0],
      [50, 100],
      [0, 50],
    ]);
  });

  it('ergibt aus zwei Stücken eine durchgehende Fase', () => {
    // Bei halber Tiefe endet das erste Stück bei der halben Tiefe – genau
    // dort, wo das seitenverkehrte zweite anfängt. Die beiden Schrägen
    // liegen dann auf einer Linie.
    const eins = ecken(50, 100);
    const zwei = ecken(50, 100, true);
    expect(eins[2][1]).toBe(50);
    expect(zwei[3][1]).toBe(50);
  });

  it('läuft bei voller Tiefe als Länge auf ein Dreieck aus', () => {
    // Dann ist die Front auf null gelaufen: ein Stück fast die ganze Ecke.
    const p = ecken(100, 100);
    expect(p[2]).toEqual([100, 0]);
  });

  it('bleibt stehen, wenn jemand es länger als tief zieht', () => {
    // Ohne Begrenzung entstünde eine negative Tiefe und das Polygon
    // klappte in sich zusammen.
    const p = ecken(160, 100);
    expect(p.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(p[2][1]).toBe(0);
  });
});

describe('Führungsrohr', () => {
  /** Die Rechtecke, die ein Element zeichnet, mit ihrer Lage. */
  function rechtecke(el: Partial<PlanElement> & { form: Grundform }) {
    const element = {
      id: 'x', vorlageId: 'x', ebeneId: 'einrichtung', name: 'x', kategorie: 'regale',
      x: 0, y: 0, breite: 250, tiefe: 67, drehung: 0, farbe: '#888', beschriftung: '',
      beschriftungSichtbar: false, schriftgroesse: 12, gesperrt: false, reihenfolge: 0,
      ...el,
    } as PlanElement;
    const kaesten: number[][] = [];
    const ctx = {
      closePath: () => {}, arc: () => {}, arcTo: () => {}, ellipse: () => {},
      moveTo: () => {}, lineTo: () => {},
      rect: (x: number, y: number, b: number, t: number) => kaesten.push([x, y, b, t]),
    } as unknown as Konva.Context;
    zeichneFuehrungsrohr(ctx, element, element.breite, element.tiefe);
    return kaesten;
  }

  it('zeichnet nichts, solange es nicht angehakt ist', () => {
    expect(rechtecke({ form: 'wt100' })).toEqual([]);
  });

  it('setzt das Rohr vor die Front', () => {
    // Ein Zentimeter Luft, dann vier Zentimeter Rohr – zusammen fünf
    // Zentimeter Überstand, so wie am Foto gemessen.
    expect(rechtecke({ form: 'wt100', fuehrungsrohr: true })).toEqual([[0, 68, 250, 4]]);
  });

  it('gibt der Gondel auf beiden Seiten eines', () => {
    // An einer Gondel fährt der Wagen auf beiden Seiten entlang.
    expect(rechtecke({ form: 'wt100', fuehrungsrohr: true, beidseitig: true })).toEqual([
      [0, 68, 250, 4],
      [0, -5, 250, 4],
    ]);
  });

  it('steht über die volle Länge des Zugs', () => {
    const [rohr] = rechtecke({ form: 'wt100', fuehrungsrohr: true, breite: 625 });
    expect(rohr[2]).toBe(625);
  });

  it('bleibt anderen Möbeln fern', () => {
    // Das Rohr gehört zum wire-tech-Regal. Ein Kühlmöbel oder eine
    // Freihand-Fläche bekommt keines, auch wenn der Haken gesetzt wäre.
    expect(rechtecke({ form: 'kuehlSchrank', fuehrungsrohr: true })).toEqual([]);
    expect(rechtecke({ form: 'regal', fuehrungsrohr: true })).toEqual([]);
  });
});

describe('Diagonale je 1,25 m', () => {
  it('gibt dem Kühlregal von 1,25 m seine Diagonale', () => {
    // Der gemeldete Fehler: Kühlmöbel trugen gar kein Zeichen.
    expect(diagonalen({ form: 'kuehlSchrank', breite: 125 }).diagonalen).toEqual([125]);
  });

  it('teilt ein Kühlregal von 2,50 m in zwei', () => {
    // Es ist eine Vorlage und kein Zusammenbau – trotzdem zwei Diagonalen,
    // denn es sind zweimal 1,25 m.
    expect(diagonalen({ form: 'kuehlSchrank', breite: 250 }).diagonalen).toEqual([125, 125]);
  });

  it('teilt 3,75 m in drei', () => {
    expect(diagonalen({ form: 'kuehlSchrank', breite: 375 }).diagonalen).toEqual([125, 125, 125]);
  });

  it('lässt die krummen Kataloglängen frei', () => {
    // 0,94 m und 1,88 m sind kein Vielfaches von 1,25 – dort wäre jedes
    // Zeichen falsch, und ein falsches ist schlimmer als keines.
    expect(diagonalen({ form: 'kuehlSchrank', breite: 93.7 }).diagonalen).toEqual([]);
    expect(diagonalen({ form: 'kuehlSchrank', breite: 187.5 }).diagonalen).toEqual([]);
    expect(diagonalen({ form: 'kuehlSchrank', breite: 194 }).diagonalen).toEqual([]);
  });

  it('gilt auch für Tiefkühlung', () => {
    expect(diagonalen({ form: 'tkKombi', breite: 250 }).diagonalen).toEqual([125, 125]);
    // Die Kataloglängen der TK-Schränke gehen nicht auf.
    expect(diagonalen({ form: 'tkSchrank', breite: 156.2 }).diagonalen).toEqual([]);
  });

  it('zählt bei zusammengesetzten Möbeln je Einheit', () => {
    // Zwei angehängte 1,25er: zwei Diagonalen. Kommt ein 0,94er dazu,
    // bleibt es bei zweien.
    expect(
      diagonalen({ form: 'kuehlSchrank', breite: 343.7, felder: [125, 125, 93.7] }).diagonalen,
    ).toEqual([125, 125]);
  });

  it('lässt die Kreuze der schmalen Maße stehen', () => {
    // A625 und A1333 tragen ein Kreuz. Die neue Regel kommt nur dort zum
    // Zug, wo es bisher gar kein Zeichen gab – sie nimmt keines weg.
    expect(diagonalen({ form: 'vitable', breite: 62.5 }).gegendiagonalen).toEqual([62.5]);
  });
});

describe('Naht und Diagonale sagen dasselbe', () => {
  /** Baut ein Element zum Prüfen. */
  const moebel = (el: Partial<PlanElement> & { form: Grundform; breite: number }) =>
    ({
      id: 'x', vorlageId: 'x', ebeneId: 'einrichtung', name: 'x', kategorie: 'kuehlung',
      x: 0, y: 0, tiefe: 100, drehung: 0, farbe: '#888', beschriftung: '',
      beschriftungSichtbar: false, schriftgroesse: 12, gesperrt: false, reihenfolge: 0,
      ...el,
    }) as PlanElement;

  it('trennt eine fertige 2,50-m-Vorlage in der Mitte', () => {
    // Genau der gemeldete Widerspruch: Die Diagonale teilte das Möbel in
    // zwei, die Trennlinie fehlte.
    expect(einheitenNaehte(moebel({ form: 'kuehlSchrank', breite: 250 }), 250)).toEqual([125]);
  });

  it('trennt 3,75 m in drei', () => {
    expect(einheitenNaehte(moebel({ form: 'kuehlSchrank', breite: 375 }), 375)).toEqual([125, 250]);
  });

  it('trennt auch die Bedientheke', () => {
    expect(einheitenNaehte(moebel({ form: 'blinkTheke', breite: 250 }), 250)).toEqual([125]);
  });

  it('setzt so viele Abschnitte wie Nähte plus eins', () => {
    // Die Zusage, um die es geht: Beide lesen dieselbe Teilung. Ginge das
    // auseinander, sähe man Diagonalen ohne Trennlinie dazwischen.
    const faelle: [Grundform, number, number[] | undefined][] = [
      ['kuehlSchrank', 250, undefined],
      ['kuehlSchrank', 375, undefined],
      ['kuehlSchrank', 187.5, undefined],
      ['kuehlSchrank', 93.7, undefined],
      ['kuehlSchrank', 343.7, [125, 125, 93.7]],
      ['blinkTheke', 312.5, undefined],
      ['blinkSelf', 250, [125, 125]],
      ['vitable', 200, undefined],
      ['tkSchrank', 156.2, undefined],
    ];
    for (const [form, breite, felder] of faelle) {
      const el = moebel({ form, breite, felder });
      const abschnitte = zeichenAbschnitte(el);
      const naehte = einheitenNaehte(el, breite);
      expect(naehte).toHaveLength(abschnitte.length - 1);
      // Und die Summe der Abschnitte ist die Breite.
      expect(abschnitte.reduce((s, a) => s + a, 0)).toBeCloseTo(breite, 3);
    }
  });

  it('hält den Regalzug heraus', () => {
    // Der zeichnet seine Feldgrenzen selbst – eine zweite Naht läge
    // doppelt darauf.
    expect(einheitenNaehte(moebel({ form: 'wt100', breite: 625, felder: [125, 125, 125, 125, 125] }), 625)).toEqual([]);
  });
});

describe('Gondel mit zwei verschiedenen Seiten', () => {
  const TIEFE = 127;
  const f = (...breiten: number[]) => breiten.map((breite) => ({ breite }));

  /** Alle Rechtecke einer Zeichnung, in der Reihenfolge des Zeichnens. */
  function rechtecke(
    breite: number,
    unten: { breite: number; leer?: boolean }[],
    oben?: { breite: number; leer?: boolean }[],
    beidseitig = true,
  ) {
    const { ctx, aufrufe, punkte } = mitschreiber();
    zeichneForm(ctx, 'wt100', breite, TIEFE, beidseitig, 100, unten, false, oben);
    const kaesten: { x: number; y: number; b: number; t: number }[] = [];
    let zeiger = 0;
    for (const name of aufrufe) {
      if (name === 'rect') {
        kaesten.push({
          x: punkte[zeiger],
          y: punkte[zeiger + 1],
          b: punkte[zeiger + 2],
          t: punkte[zeiger + 3],
        });
      }
      zeiger += { arc: 6, arcTo: 5, rect: 4, ellipse: 4, moveTo: 2, lineTo: 2, closePath: 0 }[
        name as 'arc'
      ];
    }
    return kaesten;
  }

  it('zeichnet gleich geteilte Seiten als einen Körper', () => {
    // Der wichtigste Fall: Solange nichts umgebaut ist, sieht der Zug aus wie
    // eh und je – ein Umriss über die ganze Tiefe, dazu die tote Zone.
    const kaesten = rechtecke(250, f(125, 125), f(125, 125));
    expect(kaesten).toHaveLength(2);
    expect(kaesten[0]).toEqual({ x: 0, y: 0, b: 250, t: TIEFE });
  });

  it('macht aus einem leeren Feld eine Lücke', () => {
    // Zwei Körper statt einem: Wo nichts hängt, ist auch nichts gezeichnet.
    const luecke = [{ breite: 125 }, { breite: 125, leer: true }, { breite: 125 }];
    const kaesten = rechtecke(375, luecke, luecke);
    const koerper = kaesten.filter((k) => k.t > 10);
    expect(koerper).toHaveLength(4); // zwei Stücke je Seite
    expect(koerper[0].b).toBeCloseTo(125, 2);
    expect(koerper[1].x).toBeCloseTo(250, 2);
  });

  it('lässt die kürzere Seite früher enden', () => {
    // Die Breite ist die längere Seite. Die kürzere Rückseite hört auf,
    // wo sie aufhört – die Stufe muss man im Plan sehen.
    const kaesten = rechtecke(300, f(100, 100, 100), f(100, 100));
    const koerper = kaesten.filter((k) => k.t > 10);
    expect(koerper).toHaveLength(2);
    const [hinten, vorn] = koerper;
    expect(hinten.b).toBeCloseTo(200, 2);
    expect(vorn.b).toBeCloseTo(300, 2);
  });

  it('zieht die tote Zone über die ganze Länge', () => {
    // Die Säulen stehen auch dort, wo eine Seite ein Feld frei lässt.
    const kaesten = rechtecke(300, f(100, 100, 100), f(100, 100));
    const zone = kaesten.find((k) => k.t <= 10);
    expect(zone).toBeTruthy();
    expect(zone!.b).toBeCloseTo(300, 2);
  });

  it('teilt verschiedene Seiten nicht mehr über die ganze Tiefe', () => {
    // Eine Trennlinie über die volle Tiefe behauptet eine gemeinsame Säule.
    // Wenn die Seiten sich unterscheiden, gibt es die nicht mehr.
    const { ctx, aufrufe, punkte } = mitschreiber();
    zeichneForm(ctx, 'wt100', 250, TIEFE, true, 100, f(125, 125), false, f(250));
    let zeiger = 0;
    let ueberAllesTief = 0;
    for (let i = 0; i < aufrufe.length; i++) {
      if (aufrufe[i] === 'moveTo' && aufrufe[i + 1] === 'lineTo') {
        const [x1, y1] = [punkte[zeiger], punkte[zeiger + 1]];
        const [x2, y2] = [punkte[zeiger + 2], punkte[zeiger + 3]];
        if (Math.abs(x1 - x2) < 0.01 && Math.abs(y1) < 0.01 && Math.abs(y2 - TIEFE) < 0.01) {
          ueberAllesTief++;
        }
      }
      zeiger += { arc: 6, arcTo: 5, rect: 4, ellipse: 4, moveTo: 2, lineTo: 2, closePath: 0 }[
        aufrufe[i] as 'arc'
      ];
    }
    expect(ueberAllesTief).toBe(0);
  });

  it('zeichnet in ein leeres Feld kein Achsmaß-Zeichen', () => {
    // Ein Zeichen behauptet ein Regal. Wo keines steht, steht auch keines.
    const { ctx, aufrufe } = mitschreiber();
    zeichneForm(
      ctx,
      'wt100',
      250,
      TIEFE,
      false,
      125,
      [{ breite: 125 }, { breite: 125, leer: true }],
    );
    // Genau eine Diagonale: die des vollen Felds.
    const striche = aufrufe.filter((n) => n === 'moveTo').length;
    expect(striche).toBe(1);
  });
});

/** Eine Leinwand, die auch Text mitschreibt. */
function schreiber() {
  const texte: { text: string; x: number; y: number; groesse: number }[] = [];
  // Die zuletzt gesetzte Schrifthöhe – daran hängt, ob etwas eingepasst wurde.
  let schriftgroesse = 0;
  const striche: [number, number, number, number][] = [];
  let letzter: [number, number] | null = null;

  // Wendungen: je gewendetem Block ein Eintrag mit seinem Mittelpunkt.
  const wendungen: { x: number; y: number; winkel: number }[] = [];
  let letzteVerschiebung: [number, number] | null = null;

  const ctx = {
    setAttr: (name: string, wert: unknown) => {
      if (name === 'font') schriftgroesse = parseFloat(String(wert));
    },
    beginPath: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: (x: number, y: number) => {
      letzteVerschiebung = [x, y];
    },
    rotate: (winkel: number) => {
      if (letzteVerschiebung) {
        wendungen.push({ x: letzteVerschiebung[0], y: letzteVerschiebung[1], winkel });
      }
    },
    // Zehn Punkte je Zeichen – so misst hier die Leinwand.
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillText: (text: string, x: number, y: number) =>
      texte.push({ text, x, y, groesse: schriftgroesse }),
    moveTo: (x: number, y: number) => {
      letzter = [x, y];
    },
    lineTo: (x: number, y: number) => {
      if (letzter) striche.push([letzter[0], letzter[1], x, y]);
      letzter = [x, y];
    },
  };
  return { ctx: ctx as unknown as Konva.Context, texte, striche, wendungen };
}

const bau = (el: Partial<PlanElement> & { form: Grundform; breite: number }) =>
  ({
    id: 'x', vorlageId: 'x', ebeneId: 'einrichtung', name: 'x', kategorie: 'regale',
    x: 0, y: 0, tiefe: 100, drehung: 0, farbe: '#888', beschriftung: '',
    beschriftungSichtbar: false, schriftgroesse: 12, gesperrt: false, reihenfolge: 0,
    ...el,
  }) as PlanElement;

describe('Warengruppen unter dem Zug', () => {
  const TIEFE = 127;

  /**
   * Ein Zug mit Feldern und – getrennt davon – seinen Warengruppen.
   *
   * Getrennt, weil es das seit Fassung 15 ist: Die Felder sagen, wie das
   * Möbel gebaut ist, die Abschnitte, was darauf steht.
   */
  const zug = (
    felder: Record<string, unknown>[],
    band: Warengruppenabschnitt[] = [],
    oben?: { felder: Record<string, unknown>[]; band: Warengruppenabschnitt[] },
  ) =>
    bau({
      form: 'wt100',
      breite: 500,
      tiefe: TIEFE,
      beidseitig: Boolean(oben),
      achsmass: 100,
      felderUnten: felder,
      felderOben: oben?.felder,
      warengruppenUnten: band,
      warengruppenOben: oben?.band,
    } as unknown as Parameters<typeof bau>[0]);

  /** Fünf Meter Regal, in Feldern zu einem Meter. */
  const meter = (anzahl: number) => Array.from({ length: anzahl }, () => ({ breite: 100 }));
  const wg = (von: number, bis: number, text: string): Warengruppenabschnitt => ({ von, bis, text });

  it('setzt die Beschriftung mittig unter ihre Strecke', () => {
    // „Ketchup" von 2,00 bis 5,00 m steht in deren Mitte – bei 3,50 m.
    const { ctx, texte } = schreiber();
    zeichneWarengruppen(ctx, zug(meter(5), [wg(200, 500, 'Ketchup')]), 500, TIEFE, 1);
    const name = texte.find((t) => t.text === 'Ketchup')!;
    expect(name).toBeDefined();
    expect(name.x).toBeCloseTo(350, 1);
    // Unter dem Möbel, nicht darin.
    expect(name.y).toBeGreaterThan(TIEFE);
  });

  it('schreibt die Meterzahl unter den Namen', () => {
    // Wie viel Platz ein Sortiment bekommt, ist die Frage beim Planen –
    // niemand soll sie am Bildschirm abmessen müssen.
    const { ctx, texte } = schreiber();
    zeichneWarengruppen(ctx, zug(meter(5), [wg(200, 500, 'Ketchup')]), 500, TIEFE, 1);

    const name = texte.find((t) => t.text === 'Ketchup')!;
    const meterzahl = texte.find((t) => t.text === '3 m')!;
    expect(meterzahl).toBeDefined();
    // Darunter und in derselben Spalte.
    expect(meterzahl.y).toBeGreaterThan(name.y);
    expect(meterzahl.x).toBeCloseTo(name.x, 1);
  });

  it('schreibt krumme Längen mit Komma', () => {
    const { ctx, texte } = schreiber();
    zeichneWarengruppen(ctx, zug(meter(3), [wg(0, 150, 'Senf')]), 300, TIEFE, 1);
    expect(texte.map((t) => t.text)).toContain('1,5 m');
  });

  it('schreibt sie einmal und nicht je Feld', () => {
    const { ctx, texte } = schreiber();
    zeichneWarengruppen(ctx, zug(meter(3), [wg(0, 300, 'Ketchup')]), 300, TIEFE, 1);
    expect(texte.filter((t) => t.text === 'Ketchup')).toHaveLength(1);
  });

  it('setzt die Rückseite über das Möbel', () => {
    // Auf die Seite, auf der man davorsteht.
    const { ctx, texte } = schreiber();
    zeichneWarengruppen(
      ctx,
      zug(meter(2), [], { felder: meter(2), band: [wg(0, 200, 'Senf')] }),
      200,
      TIEFE,
      1,
    );
    // Name und Meterzahl, beide über dem Möbel.
    expect(texte.map((t) => t.text)).toEqual(['Senf', '2 m']);
    expect(texte.every((t) => t.y < 0)).toBe(true);
  });

  it('klammert eine Strecke über mehrere Felder ein', () => {
    // Ein Strich an jedem Ende, dazwischen eine Linie, die der Text
    // unterbricht – sonst sieht niemand, wie weit „Ketchup" gilt.
    const { ctx, striche } = schreiber();
    zeichneWarengruppen(ctx, zug(meter(3), [wg(0, 300, 'Ketchup')]), 300, TIEFE, 1);
    const senkrecht = striche.filter((st) => Math.abs(st[0] - st[2]) < 0.01);
    expect(senkrecht.map((st) => Math.round(st[0]))).toEqual([0, 300]);
    const waagerecht = striche.filter((st) => Math.abs(st[1] - st[3]) < 0.01);
    expect(waagerecht).toHaveLength(2);
    // Die Lücke in der Mitte gehört dem Text.
    expect(waagerecht[0][2]).toBeLessThan(150);
    expect(waagerecht[1][0]).toBeGreaterThan(150);
  });

  it('lässt die Klammer über genau einem Feld weg', () => {
    // Dort zeigen die Feldgrenzen schon alles, und der Plan hat genug Striche.
    const { ctx, striche } = schreiber();
    zeichneWarengruppen(ctx, zug(meter(2), [wg(0, 100, 'Senf')]), 200, TIEFE, 1);
    expect(striche).toHaveLength(0);
  });

  it('klammert eine Strecke, die mitten in einem Feld endet', () => {
    // Hier ist sie am nötigsten: Ohne Klammer sähe niemand, dass „Senf" schon
    // nach anderthalb Metern aufhört und nicht erst an der Feldgrenze.
    const { ctx, striche } = schreiber();
    zeichneWarengruppen(ctx, zug(meter(3), [wg(0, 150, 'Senf')]), 300, TIEFE, 1);
    const senkrecht = striche.filter((st) => Math.abs(st[0] - st[2]) < 0.01);
    expect(senkrecht.map((st) => Math.round(st[0]))).toEqual([0, 150]);
  });

  it('bricht einen zu langen Namen um', () => {
    const { ctx, texte } = schreiber();
    zeichneWarengruppen(ctx, zug(meter(2), [wg(0, 100, 'Ketchup und Grillsoßen')]), 200, TIEFE, 1);
    // Ein Feld ist 1,00 m breit, mehr als ein Wort passt hier nicht.
    // Die Meterzahl steht darunter.
    expect(texte.map((t) => t.text)).toEqual(['Ketchup', 'und', 'Grillsoßen', '1 m']);
    expect(texte[1].y).toBeGreaterThan(texte[0].y);
    expect(texte[3].y).toBeGreaterThan(texte[2].y);
  });

  it('blendet sich beim Herauszoomen aus', () => {
    // Wie jede Beschriftung, die zur Zeichnung gehört.
    const { ctx, texte } = schreiber();
    zeichneWarengruppen(ctx, zug(meter(2), [wg(0, 100, 'Ketchup')]), 200, TIEFE, 0.01);
    expect(texte).toHaveLength(0);
  });
});

describe('Beschriftungen bleiben lesbar', () => {
  const TIEFE = 127;

  /**
   * Die Beschriftung gehört zum Möbel und dreht sich mit ihm – sie bleibt
   * unter der Seite, zu der sie gehört. Lesen können muss man sie trotzdem:
   * Ab einer halben Drehung stünde sie sonst auf dem Kopf.
   */
  const zug = (
    drehung: number,
    band: Warengruppenabschnitt[],
    felder: Record<string, unknown>[] = [{ breite: 100 }, { breite: 100 }],
  ) =>
    ({
      id: 'x', vorlageId: 'x', ebeneId: 'einrichtung', name: 'x', kategorie: 'regale',
      x: 0, y: 0, breite: 200, tiefe: TIEFE, hoehe: 180, drehung, farbe: '#888',
      beschriftung: '', beschriftungSichtbar: false, schriftgroesse: 12,
      gesperrt: false, reihenfolge: 0, form: 'wt100', achsmass: 100,
      felderUnten: felder,
      warengruppenUnten: band,
    }) as unknown as PlanElement;

  // Zwei Meter Senf über das ganze Möbel – gespeichert immer gleich, egal wie
  // das Möbel steht. Gedreht wird erst beim Zeichnen.
  const gruppe: Warengruppenabschnitt[] = [{ von: 0, bis: 200, text: 'Senf' }];

  it('lässt aufrechte Schrift in Ruhe', () => {
    const { ctx, wendungen } = schreiber();
    zeichneWarengruppen(ctx, zug(0, gruppe), 200, TIEFE, 1);
    expect(wendungen).toHaveLength(0);
  });

  it('wendet die Beschriftung bei einer halben Drehung', () => {
    const { ctx, wendungen, texte } = schreiber();
    zeichneWarengruppen(ctx, zug(180, gruppe), 200, TIEFE, 1);
    expect(wendungen).toHaveLength(1);
    expect(wendungen[0].winkel).toBeCloseTo(Math.PI, 5);
    // Um die eigene Mitte: waagerecht die Mitte der Strecke …
    expect(wendungen[0].x).toBeCloseTo(100, 1);
    // … senkrecht unterhalb des Möbels, wo der Block steht.
    expect(wendungen[0].y).toBeGreaterThan(TIEFE);
    // Der Text steht dabei unverändert an seinem Platz.
    expect(texte[0].x).toBeCloseTo(100, 1);
  });

  it('wendet erst jenseits der Vierteldrehung', () => {
    // Dieselbe Grenze, nach der jede Bauzeichnung ihre Maße setzt.
    const wende = (grad: number) => {
      const { ctx, wendungen } = schreiber();
      zeichneWarengruppen(ctx, zug(grad, gruppe), 200, TIEFE, 1);
      return wendungen.length;
    };
    expect(wende(89)).toBe(0);
    expect(wende(90)).toBe(0);
    expect(wende(91)).toBe(1);
    expect(wende(269)).toBe(1);
    // Bei 270° zeigt die eigene x-Achse nach oben – ein senkrechtes Möbel
    // soll aber von oben nach unten gelesen werden, also gewendet.
    expect(wende(270)).toBe(1);
    expect(wende(271)).toBe(0);
    expect(wende(-170)).toBe(1);
    expect(wende(540)).toBe(1);
  });

  it('wendet auch die Notizen, um die Mitte ihres Felds', () => {
    // Um die Mitte des Felds und nicht des Möbels: Die Notiz bleibt in ihrem
    // Feld und steht auf dem Bildschirm wieder links oben.
    const { ctx, wendungen } = schreiber();
    zeichneFeldnotizen(
      ctx,
      zug(180, [], [
        { breite: 100, notiz: '5+' },
        { breite: 100, notiz: '4+' },
      ]),
      200,
      TIEFE,
      1,
    );
    expect(wendungen.map((w) => Math.round(w.x))).toEqual([50, 150]);
    expect(wendungen.every((w) => Math.abs(w.y - TIEFE / 2) < 0.01)).toBe(true);
  });
});

describe('Aktionsfläche beschriftet sich selbst', () => {
  /**
   * Die Fläche zieht man sich zurecht. Ihre drei Angaben — Name, Quadratmeter,
   * Kantenlängen — müssen dabei lesbar bleiben, ohne bei der großen Fläche ins
   * Plakathafte zu wachsen.
   */
  const flaeche = (breite: number, tiefe: number, beschriftung = 'Aktionsfläche') =>
    ({
      id: 'f', vorlageId: 'aktionsflaeche-frei', ebeneId: 'einrichtung', name: 'Fläche',
      kategorie: 'aktion', x: 0, y: 0, breite, tiefe, hoehe: 0, drehung: 0,
      form: 'aktionsflaeche', farbe: '#ffff99', beschriftung, beschriftungSichtbar: true,
      schriftgroesse: 12, gesperrt: false, reihenfolge: 0,
    }) as unknown as PlanElement;

  const zeichne = (breite: number, tiefe: number, beschriftung?: string) => {
    const { ctx, texte } = schreiber();
    zeichneFlaechenangaben(ctx, flaeche(breite, tiefe, beschriftung), breite, tiefe, 1);
    return texte;
  };

  it('schreibt Quadratmeter links, Kantenlängen rechts und den Namen in die Mitte', () => {
    const texte = zeichne(400, 200);
    expect(texte.map((e) => e.text)).toEqual(['8,00 m²', 'L 4000', 'B 2000', 'Aktionsfläche']);

    const [qm, laenge, , name] = texte;
    expect(qm.x).toBeLessThan(100);
    expect(laenge.x).toBeGreaterThan(300);
    expect(qm.y).toBeCloseTo(laenge.y, 1);
    expect(name.x).toBeCloseTo(200, 1);
    expect(name.y).toBeGreaterThan(50);
    expect(name.y).toBeLessThan(150);
  });

  it('verkleinert den Namen, wenn die Fläche klein wird', () => {
    // Sonst stünde er über den Rand hinaus oder würde abgeschnitten.
    const gross = zeichne(400, 200).find((e) => e.text === 'Aktionsfläche')!;
    const klein = zeichne(120, 90).find((e) => e.text === 'Aktionsfläche')!;
    expect(klein.groesse).toBeLessThan(gross.groesse);
    expect(klein.groesse).toBeGreaterThan(0);
  });

  it('lässt den Namen bei einer großen Fläche nicht zum Plakat werden', () => {
    const riesig = zeichne(1200, 800).find((e) => e.text === 'Aktionsfläche')!;
    const gross = zeichne(400, 200).find((e) => e.text === 'Aktionsfläche')!;
    expect(riesig.groesse).toBeCloseTo(gross.groesse, 5);
  });

  it('rechnet die Fläche aus den Maßen', () => {
    expect(zeichne(250, 250)[0].text).toBe('6,25 m²');
    expect(zeichne(120, 90)[0].text).toBe('1,08 m²');
  });

  it('nimmt den eigenen Text, wenn die Zone einen hat', () => {
    expect(zeichne(300, 200, 'Ostern').map((e) => e.text)).toContain('Ostern');
  });

  it('lässt die Mitte leer, wenn kein Text dasteht', () => {
    // Die Zahlen bleiben trotzdem – sie stehen für sich.
    expect(zeichne(300, 200, '   ').map((e) => e.text)).toEqual(['6,00 m²', 'L 3000', 'B 2000']);
  });

  it('blendet sich beim Herauszoomen aus', () => {
    const { ctx, texte } = schreiber();
    zeichneFlaechenangaben(ctx, flaeche(400, 200), 400, 200, 0.01);
    expect(texte).toHaveLength(0);
  });
});

describe('Möbel mit eigenem Achsmaß', () => {
  /**
   * Ein Möbel, das keinem System mit festen Rastern angehört, aber sein
   * eigenes Maß führt – so wie die Blumenmöbel.
   */
  const reihe = (breite: number, achsmass: number, felder: number) =>
    ({
      id: 'b', vorlageId: 'blumen', ebeneId: 'einrichtung', name: 'Pflanzregal',
      kategorie: 'blumen', x: 0, y: 0, breite, tiefe: 56, hoehe: 155, drehung: 0,
      form: 'rechteck', farbe: '#b6dfa6', beschriftung: '', beschriftungSichtbar: false,
      schriftgroesse: 12, gesperrt: false, reihenfolge: 0, achsmass,
      felderUnten: Array.from({ length: felder }, () => ({ breite: achsmass })),
    }) as unknown as PlanElement;

  it('trennt seine Einheiten sichtbar', () => {
    // Drei aneinandergehängte Pflanzregale wurden als ein Klotz von 1,97 m
    // gezeichnet: im Modell drei Elemente, im Plan eines. Damit sah das
    // Anfügen aus, als täte es nichts.
    const naehte = einheitenNaehte(reihe(197.1, 65.7, 3), 197.1);
    expect(naehte).toHaveLength(2);
    expect(naehte[0]).toBeCloseTo(65.7, 1);
    expect(naehte[1]).toBeCloseTo(131.4, 1);
  });

  it('lässt ein einzelnes Möbel ungeteilt', () => {
    expect(einheitenNaehte(reihe(65.7, 65.7, 1), 65.7)).toEqual([]);
  });

  it('teilt gar nichts ohne Achsmaß und ohne Modulsatz', () => {
    // Ein frei gezogenes Rechteck ist ein Möbel und keine Reihe.
    const frei = { ...reihe(200, 65.7, 1), achsmass: undefined, felderUnten: undefined };
    expect(einheitenNaehte(frei as PlanElement, 200)).toEqual([]);
  });
});

/**
 * Der Trefferbereich eines Möbels.
 *
 * Ein Brett von acht Zentimetern ist bei 13 % Zoom **einen** Bildpunkt breit.
 * Man sieht es, man kann es aber nicht anklicken – eine Blende war damit im
 * Plan, aber nicht mehr zu fassen. Im Browser nachgemessen: Klicks auf ihre
 * Kante trafen das Regal dahinter oder gar nichts.
 *
 * Aufgeweitet wird deshalb, aber nur so weit wie nötig: Ein Hof um jedes
 * Möbel finge Klicks ab, die dem Nachbarn galten.
 */
describe('Trefferbereich', () => {
  const griffMoebel = (zusatz: Partial<PlanElement>): PlanElement =>
    ({
      id: 'el1',
      vorlageId: 'x',
      ebeneId: 'einrichtung',
      name: 'Probe',
      beschriftung: '',
      kategorie: 'ausstattung',
      form: 'rechteck',
      x: 0,
      y: 0,
      breite: 320,
      tiefe: 65,
      drehung: 0,
      farbe: '#ccc',
      gesperrt: false,
      reihenfolge: 1,
      beschriftungSichtbar: true,
      schriftgroesse: 12,
      ...zusatz,
    }) as PlanElement;

  /** Wie breit der Trefferbereich auf dem Bildschirm wird, in Bildpunkten. */
  const trefferBreite = (element: PlanElement, zoom: number, eigenbreite: number) => {
    const zugabe = griffZugabe(element, zoom);
    return (eigenbreite + (zugabe === 'auto' ? 0 : zugabe)) * zoom;
  };

  const blende = griffMoebel({ form: 'holzblende' });
  const regal = griffMoebel({ form: 'wt100', breite: 500, tiefe: 57 });

  it('macht das Brett einer Blende bei jedem Zoom greifbar', () => {
    for (const zoom of [0.13, 0.25, 0.5, 1, 2]) {
      expect(trefferBreite(blende, zoom, BLENDENSTAERKE)).toBeGreaterThanOrEqual(10.9);
    }
  });

  it('rechnet bei der Blende mit dem Brett, nicht mit ihrer Größe', () => {
    // 65 cm tief, aber nur 8 cm davon sind Material. Ohne diesen Unterschied
    // hielte die Rechnung sie bei jedem Zoom für breit genug.
    expect(griffZugabe(blende, 1)).not.toBe('auto');
  });

  it('lässt die Mitte einer Blende frei, sobald man arbeiten kann', () => {
    // Sonst fängt die Blende die Klicks ab, die dem Regal darin galten.
    for (const zoom of [0.5, 1, 2]) {
      const zugabe = griffZugabe(blende, zoom);
      const rand = BLENDENSTAERKE + (zugabe === 'auto' ? 0 : zugabe) / 2;
      expect((65 - 2 * rand) * zoom).toBeGreaterThan(12);
    }
  });

  it('fasst ein Regal von 57 cm Tiefe gar nicht an', () => {
    // Es ist von sich aus breit genug; ein Hof ringsum finge Klicks ab, die
    // dem Nachbarregal galten.
    expect(griffZugabe(regal, 0.25)).toBe('auto');
    expect(griffZugabe(regal, 1)).toBe('auto');
  });

  it('hilft einem schmalen Möbel weit herausgezoomt', () => {
    // Eine Kassensperre von 5 cm ist bei 20 % ein Bildpunkt.
    const sperre = griffMoebel({ form: 'linie', breite: 300, tiefe: 5 });
    expect(trefferBreite(sperre, 0.2, 5)).toBeGreaterThanOrEqual(10.9);
  });

  it('weitet nie mehr auf als nötig', () => {
    // Der Hof reicht höchstens gut fünf Bildpunkte über das Möbel hinaus.
    for (const zoom of [0.1, 0.3, 0.7, 1.5]) {
      const zugabe = griffZugabe(griffMoebel({ tiefe: 4 }), zoom);
      expect(((zugabe === 'auto' ? 0 : zugabe) / 2) * zoom).toBeLessThanOrEqual(5.6);
    }
  });
});
