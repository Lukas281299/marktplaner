import { describe, expect, it } from 'vitest';
import {
  feldliste,
  istModul,
  naechsteBaubareLaenge,
  naechstesModul,
  passeAn,
  summe,
  zaehleModule,
} from './feldaufteilung';

/**
 * Prüfungen für die Feldaufteilung.
 *
 * Die Beispiele stammen aus der Praxis: Ein 6-m-Zug aus 1,00er Feldern, den
 * jemand auf 6,25 m zieht, soll fünf Felder behalten und eines auf 1,25
 * setzen. Auf 6,50 m sind es zwei. Genau daran hängt, ob die Aufteilung im
 * Markt baubar ist oder nur auf dem Bildschirm aufgeht.
 */

/** Kurzschreibweise: n Felder desselben Maßes. */
const mal = (anzahl: number, modul: number) => Array.from({ length: anzahl }, () => modul);

describe('Achsmaße', () => {
  it('kennt genau die vier zulässigen Maße', () => {
    expect(istModul(62.5)).toBe(true);
    expect(istModul(100)).toBe(true);
    expect(istModul(125)).toBe(true);
    expect(istModul(133.3)).toBe(true);
    expect(istModul(80)).toBe(false);
    expect(istModul(110)).toBe(false);
  });

  it('rundet auf das nächstgelegene Maß', () => {
    expect(naechstesModul(105)).toBe(100);
    expect(naechstesModul(120)).toBe(125);
    expect(naechstesModul(70)).toBe(62.5);
    expect(naechstesModul(200)).toBe(133.3);
  });
});

describe('Feldliste aus Breite und Achsmaß', () => {
  it('erschließt die Liste einer älteren Planung', () => {
    // Bis jetzt stand am Element nur „6 m breit, Achsmaß 1,00" – daraus
    // wurde beim Zeichnen immer gleichmäßig geteilt. Genau das kommt heraus.
    expect(feldliste(600, 100)).toEqual(mal(6, 100));
  });

  it('macht aus einem Element ohne Achsmaß ein einziges Feld', () => {
    expect(feldliste(180, undefined)).toEqual([180]);
  });
});

describe('Anpassen an eine Ziellänge', () => {
  it('macht aus 6,00 m auf 6,25 m ein einziges breiteres Feld', () => {
    const ergebnis = passeAn(mal(6, 100), 625)!;
    expect(ergebnis.breite).toBeCloseTo(625, 2);
    expect(ergebnis.felder).toHaveLength(6);
    expect(ergebnis.geaendert).toBe(1);
    expect(zaehleModule(ergebnis.felder)).toEqual([
      { modul: 100, anzahl: 5 },
      { modul: 125, anzahl: 1 },
    ]);
  });

  it('macht aus 6,00 m auf 6,50 m zwei breitere Felder', () => {
    const ergebnis = passeAn(mal(6, 100), 650)!;
    expect(ergebnis.breite).toBeCloseTo(650, 2);
    expect(ergebnis.felder).toHaveLength(6);
    expect(ergebnis.geaendert).toBe(2);
    expect(zaehleModule(ergebnis.felder)).toEqual([
      { modul: 100, anzahl: 4 },
      { modul: 125, anzahl: 2 },
    ]);
  });

  it('setzt die geänderten Felder ans Ende', () => {
    // Dort erwartet man sie, wenn man rechts am Griff gezogen hat. Wer sie
    // woanders haben will, schiebt sie danach – das ist der Sinn der
    // Positionssteuerung.
    const ergebnis = passeAn(mal(6, 100), 625)!;
    expect(ergebnis.felder[5]).toBe(125);
    expect(ergebnis.felder.slice(0, 5)).toEqual(mal(5, 100));
  });

  it('lässt einen Zug in Ruhe, der schon passt', () => {
    const ergebnis = passeAn(mal(6, 100), 600)!;
    expect(ergebnis.geaendert).toBe(0);
    expect(ergebnis.felder).toEqual(mal(6, 100));
  });

  it('behält die Feldzahl, wo es irgend geht', () => {
    // 5 × 1,25 = 6,25. Dieselbe Länge wie oben, aber aus fünf Feldern –
    // wer mit fünf angefangen hat, behält fünf.
    const ergebnis = passeAn(mal(5, 125), 625)!;
    expect(ergebnis.felder).toHaveLength(5);
    expect(ergebnis.geaendert).toBe(0);
  });

  it('nimmt Felder dazu, wenn die Länge sonst nicht zu bauen ist', () => {
    // 6 Felder schaffen höchstens 6 × 1,333 = 8,00 m. Für 12 m braucht es
    // mehr Felder, da hilft kein Umverteilen.
    //
    // Herauskommen darf hier 1199,7 – das sind neun A1333-Felder, und die
    // sind in Wirklichkeit 1333⅓ mm, zusammen also exakt 12,00 m. Die 133,3
    // in der Bibliothek ist der gerundete Wert; ein Zug aus diesem Maß trägt
    // die Rundung mit. Deshalb wird hier auf Zentimeter geprüft und nicht
    // auf Zehntelmillimeter.
    const ergebnis = passeAn(mal(6, 100), 1200)!;
    expect(Math.abs(ergebnis.breite - 1200)).toBeLessThanOrEqual(0.6);
    expect(ergebnis.felder.length).toBeGreaterThan(6);
  });

  it('lässt Felder weg, wenn der Zug kürzer wird', () => {
    const ergebnis = passeAn(mal(6, 100), 300)!;
    expect(ergebnis.breite).toBeCloseTo(300, 2);
    expect(ergebnis.felder.length).toBeLessThan(6);
  });

  it('kommt mit dem krummen Maß A1333 zurecht', () => {
    // Drei Felder ergeben 399,9 cm und meinen 4,00 m. Ohne Toleranz fiele
    // jede Aufteilung mit diesem Maß durch.
    const ergebnis = passeAn(mal(3, 133.3), 400)!;
    expect(ergebnis.felder).toEqual(mal(3, 133.3));
    expect(ergebnis.geaendert).toBe(0);
  });

  it('mischt Maße, wenn es anders nicht aufgeht', () => {
    // 1,875 m = 62,5 + 125 oder 3 × 62,5. Beides ist baubar.
    const ergebnis = passeAn([100, 100], 187.5)!;
    expect(ergebnis.breite).toBeCloseTo(187.5, 2);
    expect(ergebnis.felder.every((f) => istModul(f))).toBe(true);
  });

  it('sagt Nein zu einer Länge, die es nicht gibt', () => {
    // 30 cm ist kürzer als das kleinste Feld. Kein Rechentrick macht daraus
    // einen Zug – und eine erfundene Zahl wäre schlimmer als ein Nein.
    expect(passeAn(mal(2, 100), 30)).toBeNull();
  });

  it('baut jedes Feld aus einem zulässigen Maß', () => {
    for (const ziel of [62.5, 125, 200, 262.5, 333.3, 500, 725, 1000]) {
      const ergebnis = passeAn(mal(4, 100), ziel);
      if (!ergebnis) continue;
      expect(ergebnis.felder.every((f) => istModul(f))).toBe(true);
      expect(summe(ergebnis.felder)).toBeCloseTo(ziel, 0);
    }
  });
});

describe('Nächste baubare Länge', () => {
  it('nimmt das Wunschmaß, wenn es aufgeht', () => {
    expect(naechsteBaubareLaenge(mal(6, 100), 625)!.breite).toBeCloseTo(625, 2);
  });

  it('rückt auf das nächste baubare Maß, wenn nicht', () => {
    // 6,10 m gibt es nicht. Was herauskommt, muss in der Nähe liegen und
    // aus zulässigen Feldern bestehen.
    const ergebnis = naechsteBaubareLaenge(mal(6, 100), 610)!;
    expect(ergebnis.felder.every((f) => istModul(f))).toBe(true);
    expect(Math.abs(ergebnis.breite - 610)).toBeLessThan(20);
  });

  it('findet auch für ein sehr kurzes Wunschmaß etwas', () => {
    const ergebnis = naechsteBaubareLaenge(mal(2, 100), 40)!;
    expect(ergebnis.breite).toBeCloseTo(62.5, 2);
  });
});

describe('Module zählen', () => {
  it('fasst eine gemischte Liste zusammen', () => {
    expect(zaehleModule([100, 125, 100, 62.5, 125, 125])).toEqual([
      { modul: 62.5, anzahl: 1 },
      { modul: 100, anzahl: 2 },
      { modul: 125, anzahl: 3 },
    ]);
  });
});
