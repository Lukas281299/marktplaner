import { describe, expect, it } from 'vitest';
import {
  GESTELL_LAENGEN,
  GESTELL_STAERKE,
  gestelltiefe,
  KISTE,
  kistenbelegung,
} from './getraenkekisten';

/**
 * Prüfungen für die Getränkekisten vor dem Preisgestell.
 *
 * Der Kern: **Wie viele nebeneinander passen, wird gerechnet und nicht
 * eingestellt.** Gewählt werden Gestelllänge, Lage der Kisten und Zahl der
 * Reihen; alles andere folgt. Eine Zahl, die man eintippen kann, wäre eine
 * Zahl, die falsch sein kann – im Plan stünden dann acht Kisten auf zwei
 * Metern, wo sechs hinpassen.
 */

describe('Das Kistenmaß', () => {
  it('ist der Bierkasten – 400 × 300 mm', () => {
    expect([KISTE.laenge, KISTE.breite]).toEqual([40, 30]);
  });
});

describe('Was vor ein Gestell passt', () => {
  it('rechnet die Kästen längs auf zwei Meter', () => {
    // Längs heißt: die 40er-Seite parallel zum Gestell. 200 / 40 = 5.
    const b = kistenbelegung(200, 'laengs', 1);
    expect(b.jeReihe).toBe(5);
    expect(b.kistenbreite).toBe(40);
    expect(b.reihentiefe).toBe(30);
    expect(b.rest).toBe(0);
  });

  it('rechnet dieselben Kästen quer', () => {
    // Quer heißt: die 30er-Seite parallel. 200 / 30 = 6 Rest 20.
    const b = kistenbelegung(200, 'quer', 1);
    expect(b.jeReihe).toBe(6);
    expect(b.kistenbreite).toBe(30);
    expect(b.reihentiefe).toBe(40);
    expect(b.rest).toBe(20);
  });

  it('zählt beide Seiten zusammen', () => {
    // Vor dem Gestell und dahinter – ein Gestell wird von zwei Seiten bestückt.
    expect(kistenbelegung(200, 'laengs', 2).gesamt).toBe(5 * 2 * 2);
  });

  it('rechnet auch die einseitige Aufstellung', () => {
    // So steht ein Gestell an der Wand.
    expect(kistenbelegung(200, 'laengs', 2, 1).gesamt).toBe(5 * 2);
  });

  it('lässt eine Kiste weg, die nicht mehr ganz draufpasst', () => {
    // Ein halber Kasten steht auch im Markt nicht da.
    const b = kistenbelegung(250, 'laengs', 1);
    expect(b.jeReihe).toBe(6); // 250 / 40 = 6,25
    expect(b.rest).toBe(10);
  });

  it('lässt ein genau aufgehendes Maß nicht nach unten wegrunden', () => {
    expect(kistenbelegung(120, 'laengs', 1).jeReihe).toBe(3);
    expect(kistenbelegung(150, 'quer', 1).jeReihe).toBe(5);
  });

  it('kommt ohne Reihen ohne Kisten aus', () => {
    const b = kistenbelegung(200, 'laengs', 0);
    expect(b.gesamt).toBe(0);
    expect(b.seitentiefe).toBe(0);
  });
});

describe('Die Tiefe im Plan', () => {
  it('ist Gestell plus Kisten auf beiden Seiten', () => {
    // Eine Reihe längs je Seite: 6 + 30 + 30.
    expect(gestelltiefe('laengs', 1)).toBe(GESTELL_STAERKE + 60);
  });

  it('wächst mit jeder Reihe – das ist der Sinn der Anzeige', () => {
    // Zwei Reihen je Seite sind 60 cm mehr, und genau so viel fehlt der Gasse.
    expect(gestelltiefe('laengs', 2) - gestelltiefe('laengs', 1)).toBe(60);
  });

  it('wird quer tiefer als längs', () => {
    expect(gestelltiefe('quer', 1)).toBe(GESTELL_STAERKE + 80);
  });

  it('ist einseitig nur halb so tief', () => {
    expect(gestelltiefe('laengs', 1, 1)).toBe(GESTELL_STAERKE + 30);
  });

  it('ist ohne Kisten nur das Gestell', () => {
    expect(gestelltiefe('laengs', 0)).toBe(GESTELL_STAERKE);
  });
});

describe('Die Gestelllängen', () => {
  it('sind die drei gelieferten Maße', () => {
    expect(GESTELL_LAENGEN).toEqual([150, 200, 250]);
  });

  it('nehmen längs drei, fünf und sechs Kästen je Reihe auf', () => {
    expect(GESTELL_LAENGEN.map((l) => kistenbelegung(l, 'laengs', 1).jeReihe)).toEqual([3, 5, 6]);
  });

  it('quer entsprechend mehr', () => {
    expect(GESTELL_LAENGEN.map((l) => kistenbelegung(l, 'quer', 1).jeReihe)).toEqual([5, 6, 8]);
  });
});
