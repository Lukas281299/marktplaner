import { describe, expect, it } from 'vitest';
import {
  GESTELL_LAENGEN,
  GESTELL_STAERKE,
  gestelltiefe,
  KISTE,
  kistenbelegung, kistenseiten, kistenzahl } from './getraenkekisten';

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
    expect(gestelltiefe({ lage: 'laengs', reihen: 1 })).toBe(GESTELL_STAERKE + 60);
  });

  it('wächst mit jeder Reihe – das ist der Sinn der Anzeige', () => {
    // Zwei Reihen je Seite sind 60 cm mehr, und genau so viel fehlt der Gasse.
    expect(
      gestelltiefe({ lage: 'laengs', reihen: 2 }) - gestelltiefe({ lage: 'laengs', reihen: 1 }),
    ).toBe(60);
  });

  it('wird quer tiefer als längs', () => {
    expect(gestelltiefe({ lage: 'quer', reihen: 1 })).toBe(GESTELL_STAERKE + 80);
  });

  it('ist einseitig nur halb so tief', () => {
    expect(gestelltiefe({ lage: 'laengs', reihen: 1, einseitig: true })).toBe(
      GESTELL_STAERKE + 30,
    );
  });

  it('rechnet jede Seite für sich, wenn sie verschieden sind', () => {
    // Vorn drei Reihen quer (3 × 40), hinten zwei längs (2 × 30).
    expect(
      gestelltiefe({
        lage: 'quer',
        reihen: 3,
        rueckseite: { lage: 'laengs', reihen: 2 },
      }),
    ).toBe(GESTELL_STAERKE + 120 + 60);
  });

  it('ist ohne Kisten nur das Gestell', () => {
    expect(gestelltiefe({ lage: 'laengs', reihen: 0 })).toBe(GESTELL_STAERKE);
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

describe('Mehrere Gestelle hintereinander', () => {
  /**
   * Der Fall, um den es geht: Kisten gehen selten glatt in einer Gestelllänge
   * auf. Auf 2,50 m passen sechs Kästen längs – bleiben 10 cm. Stünden zwei
   * Gestelle als **zwei Möbel** nebeneinander, klaffte in der Mitte eine
   * Lücke von 10 cm, und dieselben zwei Meter fünfzig hätten zwölf Kästen
   * statt der zwölf, die wirklich hinpassen.
   *
   * Ein verlängertes Möbel rechnet dagegen über die **ganze** Länge – und
   * dann laufen die Kisten durch, so wie sie im Markt auch durchlaufen.
   */
  it('verliert an jeder Stoßstelle eine Lücke, wenn je Gestell gerechnet wird', () => {
    const einzeln = kistenbelegung(250, 'laengs', 1, 1);
    expect(einzeln.jeReihe).toBe(6);
    expect(einzeln.rest).toBe(10);
    // Zwei getrennte Gestelle: zweimal sechs, und zweimal 10 cm verschenkt.
    expect(einzeln.jeReihe * 2).toBe(12);
  });

  it('gewinnt eine Kiste zurück, wenn über die ganze Länge gerechnet wird', () => {
    // Dieselben zwei Gestelle als ein Möbel: 500 / 40 = 12 Rest 20.
    const zusammen = kistenbelegung(500, 'laengs', 1, 1);
    expect(zusammen.jeReihe).toBe(12);
    expect(zusammen.rest).toBe(20);
  });

  it('macht den Unterschied dort sichtbar, wo er groß ist', () => {
    // Drei Gestelle à 1,50 m quer: einzeln 5 je Gestell = 15.
    expect(kistenbelegung(150, 'quer', 1, 1).jeReihe).toBe(5);
    // Zusammen 450 / 30 = 15 – hier geht es glatt auf, kein Verlust.
    expect(kistenbelegung(450, 'quer', 1, 1).jeReihe).toBe(15);

    // Drei Gestelle à 2,50 m längs: einzeln 6 je Gestell = 18 …
    expect(kistenbelegung(250, 'laengs', 1, 1).jeReihe).toBe(6);
    // … zusammen 750 / 40 = 18 Rest 30. Gleich viele, aber der Rest liegt
    // am Ende statt dreimal mittendrin – und dort stört er niemanden.
    const lang = kistenbelegung(750, 'laengs', 1, 1);
    expect(lang.jeReihe).toBe(18);
    expect(lang.rest).toBe(30);
  });

  it('rechnet einen gemischten Zug über seine Gesamtlänge', () => {
    // 1,50 + 2,00 + 2,50 = 6,00 m. Einzeln: 3 + 5 + 6 = 14 Kästen längs.
    const einzeln =
      kistenbelegung(150, 'laengs', 1, 1).jeReihe +
      kistenbelegung(200, 'laengs', 1, 1).jeReihe +
      kistenbelegung(250, 'laengs', 1, 1).jeReihe;
    expect(einzeln).toBe(14);
    // Am Stück: 600 / 40 = 15. Eine Kiste mehr, und keine Lücke dazwischen.
    expect(kistenbelegung(600, 'laengs', 1, 1).jeReihe).toBe(15);
  });
});

describe('Beide Seiten einzeln', () => {
  it('nimmt die Vorderseite für die Rückseite, wenn nichts anderes dasteht', () => {
    const { vorne, hinten } = kistenseiten({ lage: 'quer', reihen: 2 });
    expect(vorne).toEqual({ lage: 'quer', reihen: 2 });
    expect(hinten).toEqual({ lage: 'quer', reihen: 2 });
  });

  it('lässt die Rückseite anders sein', () => {
    const { vorne, hinten } = kistenseiten({
      lage: 'quer',
      reihen: 3,
      rueckseite: { lage: 'laengs', reihen: 2 },
    });
    expect(vorne).toEqual({ lage: 'quer', reihen: 3 });
    expect(hinten).toEqual({ lage: 'laengs', reihen: 2 });
  });

  it('hat einseitig gar keine Rückseite', () => {
    const { hinten } = kistenseiten({ lage: 'laengs', reihen: 2, einseitig: true });
    expect(hinten).toBeNull();
  });

  it('zählt die Kisten beider Seiten zusammen', () => {
    // 2,00 m Gestell: vorn quer (30 breit) sind 6 je Reihe, zwei Reihen = 12.
    // Hinten längs (40 breit) sind 5 je Reihe, eine Reihe = 5. Zusammen 17.
    expect(
      kistenzahl(200, { lage: 'quer', reihen: 2, rueckseite: { lage: 'laengs', reihen: 1 } }),
    ).toBe(17);
  });
});
