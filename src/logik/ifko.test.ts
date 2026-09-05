import { describe, expect, it } from 'vitest';
import { auflageFuer, ifkoJeFeld, ifkoJeStufe, ifkoVorschlag, nutzbreite, umrissanteil } from './ifko';
import { BIBLIOTHEK } from '../daten/bibliothek';
import type { PlanElement } from '../typen/modell';

/**
 * Prüfungen für die grünen Kisten.
 *
 * Die Zahlen sind gemessen und nicht gerechnet – geprüft wird deshalb vor
 * allem, dass die Tabelle unverändert herauskommt. Sie in eine Formel zu
 * gießen wäre der Fehler: Eine ifko misst 600 × 400, aber wie viele auf eine
 * Auflage gehen, entscheidet auch, wie weit man sie überstehen lässt.
 */

function moebel(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'vt-wand-100-h1600-80-60',
    ebeneId: 'einrichtung',
    name: 'O&G',
    kategorie: 'obstgemuese',
    x: 0,
    y: 0,
    breite: 100,
    tiefe: 90,
    drehung: 0,
    form: 'vitable',
    farbe: '#8a8',
    beschriftung: '',
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 1,
    ...teil,
  } as PlanElement;
}

describe('Kisten auf einer Auflage', () => {
  it('folgt der Lage, die zur Tiefe passt', () => {
    // 400 quer, 600 längs, 800 zwei quer, 1200 zwei längs.
    expect(auflageFuer(40)).toEqual({ tiefe: 40, lage: 'quer', reihen: 1 });
    expect(auflageFuer(60)).toEqual({ tiefe: 60, lage: 'laengs', reihen: 1 });
    expect(auflageFuer(80)).toEqual({ tiefe: 80, lage: 'quer', reihen: 2 });
    expect(auflageFuer(120)).toEqual({ tiefe: 120, lage: 'laengs', reihen: 2 });
  });

  it('zieht beim 1,25-m-Feld die Grifflücke ab', () => {
    // Fünf Zentimeter zum Anfassen – auf 1,20 m geht dann alles glatt auf,
    // ohne Rest und ohne Rundung. Genau Lukas' gemessene Zahlen.
    expect(nutzbreite(125)).toBe(120);
    expect(ifkoJeStufe(125, 40)).toBe(2);
    expect(ifkoJeStufe(125, 60)).toBe(3);
    expect(ifkoJeStufe(125, 80)).toBe(4);
    expect(ifkoJeStufe(125, 120)).toBe(6);
  });

  it('lässt das 1,00-m-Feld ganz', () => {
    // Dort bleibt nichts übrig, also gibt es auch keine Lücke – und alle
    // vier Werte kommen aus der Rechnung heraus.
    expect(nutzbreite(100)).toBe(100);
    expect(ifkoJeStufe(100, 40)).toBeCloseTo(5 / 3, 6);
    expect(ifkoJeStufe(100, 60)).toBe(2.5);
    expect(ifkoJeStufe(100, 80)).toBeCloseTo(10 / 3, 6);
    expect(ifkoJeStufe(100, 120)).toBe(5);
  });

  it('rechnet jede Breite über dasselbe Raster', () => {
    // Ein 2,00-m-Feld sind zwei Achsmaße A1000 in einem Möbel – keine Lücke.
    expect(ifkoJeStufe(200, 120)).toBe(10);
    // Und was nicht ins 20er-Raster passt, ist Grifflücke.
    expect(nutzbreite(62.5)).toBe(60);
    expect(ifkoJeStufe(62.5, 60)).toBe(1.5);
  });

  it('nimmt bei der Tiefe die nächste Bauform', () => {
    expect(ifkoJeStufe(100, 75)).toBe(ifkoJeStufe(100, 80));
    expect(ifkoJeStufe(100, 45)).toBe(ifkoJeStufe(100, 40));
    expect(ifkoJeStufe(100, 200)).toBe(ifkoJeStufe(100, 120));
  });

  it('nimmt bei genau der Mitte die kleinere Tiefe', () => {
    // 70 liegt zwischen 60 und 80. Die flachere Auflage anzunehmen sagt eine
    // Kiste weniger – und eine Kiste zu wenig steht in der Ecke, eine zu viel
    // wird bestellt und passt nicht.
    expect(ifkoJeStufe(100, 70)).toBe(ifkoJeStufe(100, 60));
  });

  it('gibt bei unsinnigen Maßen nichts zurück', () => {
    expect(ifkoJeStufe(0, 60)).toBe(0);
    expect(ifkoJeStufe(100, 0)).toBe(0);
  });
});

describe('Vorschlag für ein Möbel', () => {
  it('legt die Stufen zusammen', () => {
    // H1600 / T800 + T600 auf 1,00 m: 3 1/3 + 3 = 6 1/3, gerundet 6.
    expect(ifkoVorschlag(moebel({ breite: 100, stufen: [80, 60] }))).toBe(6);
    // Dasselbe Möbel in 1,25 m: 4 + 3 = 7.
    expect(ifkoVorschlag(moebel({ breite: 125, stufen: [80, 60] }))).toBe(7);
    // H1800 / T800 + T600 + T400 auf 1,00 m: 3 1/3 + 3 + 1 2/3 = genau 8.
    expect(ifkoVorschlag(moebel({ breite: 100, stufen: [80, 60, 40] }))).toBe(8);
  });

  it('verdoppelt bei einer Gondel', () => {
    // Sie trägt ihre Stufen auf beiden Seiten.
    const wand = moebel({ breite: 130, stufen: [120] });
    const gondel = moebel({ breite: 130, stufen: [120], beidseitig: true });
    expect(ifkoVorschlag(gondel)).toBe(ifkoVorschlag(wand)! * 2);
  });

  it('sagt nichts, wo das Möbel nichts über seine Stufen sagt', () => {
    // Jede Zahl wäre geraten – und geraten wandert sie in eine Bestellung.
    expect(ifkoVorschlag(moebel({ stufen: undefined }))).toBeUndefined();
    expect(ifkoVorschlag(moebel({ stufen: [] }))).toBeUndefined();
    expect(ifkoVorschlag(moebel({ breite: 0, stufen: [60] }))).toBeUndefined();
  });
});

describe('Ein Feld allein', () => {
  it('trägt die gemessene Tabelle', () => {
    // Dieselben acht Zahlen wie oben, aber vom Feld aus gefragt: Das ist die
    // Zahl, die am Ende im Möbel steht.
    const auf = (tiefe: number, feld: number) =>
      ifkoJeFeld(moebel({ stufen: [tiefe] }), feld);
    expect(auf(40, 125)).toBe(2);
    expect(auf(60, 125)).toBe(3);
    expect(auf(80, 125)).toBe(4);
    expect(auf(120, 125)).toBe(6);
    expect(auf(40, 100)).toBeCloseTo(5 / 3, 6);
    expect(auf(60, 100)).toBe(2.5);
    expect(auf(80, 100)).toBeCloseTo(10 / 3, 6);
    expect(auf(120, 100)).toBe(5);
  });

  it('legt die Stufen eines Feldes zusammen', () => {
    expect(ifkoJeFeld(moebel({ stufen: [80, 60, 40] }), 125)).toBe(9);
  });
});

describe('Trapeze und Ecken', () => {
  it('rechnet mit der mittleren Breite, nicht mit der breitesten Stelle', () => {
    // Ein Trapez, hinten 200 und vorn 120 breit: im Mittel 160.
    const trapez = moebel({
      breite: 200,
      polygon: [
        { x: -100, y: -60 },
        { x: 100, y: -60 },
        { x: 60, y: 60 },
        { x: -60, y: 60 },
      ],
    });
    expect(umrissanteil(trapez)).toBeCloseTo(0.8, 6);
    // 160 cm Nutzbreite auf einer 1200er Auflage: 160 / 40 × 2 = 8.
    expect(ifkoJeFeld({ ...trapez, stufen: [120] }, 200)).toBe(8);
  });

  it('lässt ein Rechteck in Ruhe', () => {
    expect(umrissanteil(moebel({}))).toBe(1);
    expect(umrissanteil(moebel({ polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }))).toBe(1);
  });

  it('zählt an jedem Obstmöbel der Bibliothek Kisten', () => {
    // Der Fehler, um den es hier geht: Trapeze und freie Eckstücke trugen
    // keine Stufen und damit **null** Kisten – ein Bananentisch in der Ecke
    // fehlte in der Bestellung vollständig.
    const ohne = BIBLIOTHEK.filter(
      (e) =>
        e.kategorie === 'obstgemuese' &&
        (e.hoehe ?? 0) > 0 &&
        !ifkoVorschlag({ ...e, beidseitig: e.beidseitig ?? false } as PlanElement),
    );
    expect(ohne.map((e) => e.name)).toEqual([]);
  });
});
