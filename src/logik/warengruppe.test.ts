import { describe, expect, it } from 'vitest';
import {
  eingerastet,
  geordnet,
  gruppenspannen,
  KLEINSTER_ABSCHNITT,
  mitAbschnitt,
  mitVerschobenerKante,
  ohneStrecke,
  rastpunkte,
  teileGeordnet,
} from './warengruppe';
import type { Regalfeld, Warengruppenabschnitt } from '../typen/modell';

/**
 * Prüfungen für die Warengruppen auf dem Meterband.
 *
 * Der Fall, der zu dieser Rechnung geführt hat, steht ganz unten: drei Meter,
 * zwei Sortimente, Grenze mitten durch ein Feld. Vorher ging das nur, indem
 * man die Felder umbaute – und dann zeigte der Plan ein Möbel, das es nicht
 * gibt.
 */

const A = (von: number, bis: number, text: string): Warengruppenabschnitt => ({ von, bis, text });
const felder = (...breiten: number[]): Regalfeld[] => breiten.map((breite) => ({ breite }));

describe('Ordnen', () => {
  it('sortiert nach Anfang', () => {
    const liste = geordnet([A(200, 300, 'Senf'), A(0, 200, 'Ketchup')], 300);
    expect(liste.map((a) => a.text)).toEqual(['Ketchup', 'Senf']);
  });

  it('behält einen leeren Text – man tippt ihn ja gerade', () => {
    // Wer „+ Warengruppe" drückt, hat einen Moment lang eine Strecke ohne
    // Namen. Würde sie hier weggeworfen, täte der Knopf gar nichts.
    expect(geordnet([A(0, 100, ''), A(100, 200, 'Senf')], 200)).toHaveLength(2);
  });

  it('zeichnet den leeren aber nicht', () => {
    // Im Plan wäre er eine leere Klammer.
    const spannen = gruppenspannen([A(0, 100, ''), A(100, 200, 'Senf')], 200);
    expect(spannen.map((s) => s.text)).toEqual(['Senf']);
  });

  it('beschneidet auf das Möbel, wenn es gekürzt wurde', () => {
    // Ein Zug von 6 auf 4 m gezogen: Die hintere Beschriftung hängt im Nichts.
    const liste = geordnet([A(0, 300, 'Ketchup'), A(300, 600, 'Senf')], 400);
    expect(liste).toHaveLength(2);
    expect(liste[1]).toMatchObject({ von: 300, bis: 400 });
  });

  it('wirft weg, was nach dem Kürzen ganz draußen liegt', () => {
    const liste = geordnet([A(0, 300, 'Ketchup'), A(400, 600, 'Senf')], 350);
    expect(liste.map((a) => a.text)).toEqual(['Ketchup']);
  });

  it('löst Überlappungen zugunsten des früheren auf', () => {
    const liste = geordnet([A(0, 200, 'Ketchup'), A(150, 300, 'Senf')], 300);
    expect(liste[0]).toMatchObject({ von: 0, bis: 200 });
    expect(liste[1]).toMatchObject({ von: 200, bis: 300 });
  });
});

describe('Spannen', () => {
  it('gibt die Strecken in der Achse des Möbels zurück', () => {
    const spannen = gruppenspannen([A(0, 150, 'Ketchup'), A(150, 300, 'Senf')], 300);
    expect(spannen.map((s) => [s.von, s.bis, s.text])).toEqual([
      [0, 150, 'Ketchup'],
      [150, 300, 'Senf'],
    ]);
  });

  it('merkt sich die Stelle in der gespeicherten Liste', () => {
    const spannen = gruppenspannen([A(150, 300, 'Senf'), A(0, 150, 'Ketchup')], 300);
    // Sortiert wird nach Anfang; der Index folgt der geordneten Liste, weil
    // genau die auch gespeichert wird.
    expect(spannen.map((s) => [s.text, s.index])).toEqual([
      ['Ketchup', 0],
      ['Senf', 1],
    ]);
  });

  it('spiegelt nichts – auch nicht an einem gedrehten Möbel', () => {
    // Die Zeichenfläche dreht das ganze Bild mit dem Möbel. Wer hier
    // zusätzlich spiegelte, schöbe jede Beschriftung ans andere Ende, und
    // zwar erst beim Drehen – niemand fände den Grund.
    const spannen = gruppenspannen([A(0, 100, 'Eier')], 300);
    expect(spannen[0]).toMatchObject({ von: 0, bis: 100 });
  });
});

describe('Schreiben', () => {
  it('legt eine Beschriftung auf eine freie Strecke', () => {
    const liste = mitAbschnitt([], 300, A(0, 150, 'Ketchup'));
    expect(liste).toEqual([{ von: 0, bis: 150, text: 'Ketchup' }]);
  });

  it('kürzt, was in die neue Strecke hineinragt', () => {
    const liste = mitAbschnitt([A(0, 300, 'Ketchup')], 300, A(150, 300, 'Senf'));
    expect(liste).toEqual([
      { von: 0, bis: 150, text: 'Ketchup' },
      { von: 150, bis: 300, text: 'Senf' },
    ]);
  });

  it('teilt einen Abschnitt, der die neue Strecke umschließt', () => {
    const liste = mitAbschnitt([A(0, 300, 'Ketchup')], 300, A(100, 200, 'Senf'));
    expect(liste).toEqual([
      { von: 0, bis: 100, text: 'Ketchup' },
      { von: 100, bis: 200, text: 'Senf' },
      { von: 200, bis: 300, text: 'Ketchup' },
    ]);
  });

  it('löscht bei leerem Text, statt zu schreiben', () => {
    const liste = mitAbschnitt([A(0, 300, 'Ketchup')], 300, A(100, 200, ''));
    expect(liste).toEqual([
      { von: 0, bis: 100, text: 'Ketchup' },
      { von: 200, bis: 300, text: 'Ketchup' },
    ]);
  });

  it('räumt eine Strecke frei', () => {
    const liste = ohneStrecke([A(0, 150, 'Ketchup'), A(150, 300, 'Senf')], 300, 100, 200);
    expect(liste).toEqual([
      { von: 0, bis: 100, text: 'Ketchup' },
      { von: 200, bis: 300, text: 'Senf' },
    ]);
  });
});

describe('Rastpunkte', () => {
  it('nimmt Feldgrenzen, Hälften und Viertel', () => {
    expect(rastpunkte(felder(100))).toEqual([0, 25, 50, 75, 100]);
  });

  it('läuft über mehrere Felder durch', () => {
    expect(rastpunkte(felder(100, 100))).toContain(150);
    expect(rastpunkte(felder(100, 100))).toContain(200);
  });

  it('kommt auch mit krummen Feldern zurecht', () => {
    // Das A1333 des wire tech ist nicht glatt teilbar.
    const punkte = rastpunkte(felder(133.3));
    expect(punkte[0]).toBe(0);
    expect(punkte[punkte.length - 1]).toBeCloseTo(133.5, 1);
  });

  it('rastet nur ein, was nah genug ist', () => {
    const punkte = [0, 50, 100];
    expect(eingerastet(48, punkte, 10)).toBe(50);
    expect(eingerastet(70, punkte, 10)).toBe(70);
  });
});

describe('Kante ziehen', () => {
  const zwei = () => [A(0, 150, 'Ketchup'), A(150, 300, 'Senf')];

  it('nimmt den Nachbarn mit, statt ein Loch zu reißen', () => {
    const liste = mitVerschobenerKante(zwei(), 300, 0, 'bis', 200);
    expect(liste).toEqual([
      { von: 0, bis: 200, text: 'Ketchup' },
      { von: 200, bis: 300, text: 'Senf' },
    ]);
  });

  it('zieht auch von der anderen Seite dieselbe Grenze', () => {
    const liste = mitVerschobenerKante(zwei(), 300, 1, 'von', 100);
    expect(liste).toEqual([
      { von: 0, bis: 100, text: 'Ketchup' },
      { von: 100, bis: 300, text: 'Senf' },
    ]);
  });

  it('drückt den Nachbarn nicht unter das Mindestmaß', () => {
    const liste = mitVerschobenerKante(zwei(), 300, 0, 'bis', 299);
    expect(liste[1].bis - liste[1].von).toBeGreaterThanOrEqual(KLEINSTER_ABSCHNITT);
  });

  it('lässt sich selbst nicht unter das Mindestmaß drücken', () => {
    const liste = mitVerschobenerKante(zwei(), 300, 0, 'bis', 1);
    expect(liste[0].bis - liste[0].von).toBeGreaterThanOrEqual(KLEINSTER_ABSCHNITT);
  });

  it('verlängert einen einzelnen Abschnitt, wenn kein Nachbar anliegt', () => {
    const liste = mitVerschobenerKante([A(0, 150, 'Ketchup')], 300, 0, 'bis', 250);
    expect(liste).toEqual([{ von: 0, bis: 250, text: 'Ketchup' }]);
  });

  it('läuft nicht über das Möbel hinaus', () => {
    const liste = mitVerschobenerKante([A(0, 150, 'Ketchup')], 300, 0, 'bis', 900);
    expect(liste[0].bis).toBe(300);
  });

  it('stößt an einen Nachbarn, der nicht anliegt, statt ihn zu überrennen', () => {
    // Zwischen den beiden ist eine Lücke: Ketchup darf bis an sie heran.
    const liste = mitVerschobenerKante([A(0, 100, 'Ketchup'), A(200, 300, 'Senf')], 300, 0, 'bis', 280);
    expect(liste[0].bis).toBe(200);
    expect(liste[1]).toMatchObject({ von: 200, bis: 300 });
  });
});

describe('Der Fall, um den es ging', () => {
  it('teilt drei Meter mit drei Feldern auf zwei Sortimente à 1,5 m', () => {
    const bau = felder(100, 100, 100);
    let liste = mitAbschnitt([], 300, A(0, 300, 'Ketchup'));
    liste = mitAbschnitt(liste, 300, A(150, 300, 'Senf'));

    expect(liste).toEqual([
      { von: 0, bis: 150, text: 'Ketchup' },
      { von: 150, bis: 300, text: 'Senf' },
    ]);
    // Die Grenze liegt mitten in Feld 2 – und ist trotzdem ein Rastpunkt.
    expect(rastpunkte(bau)).toContain(150);
    // Und die Felder sind unangetastet geblieben.
    expect(bau.map((f) => f.breite)).toEqual([100, 100, 100]);
  });
});

describe('Teilsortimente einer Strecke', () => {
  it('ordnet, beschneidet und wirft Leeres weg', () => {
    const teile = teileGeordnet(
      [
        { von: 200, bis: 300, text: 'Bio' },
        { von: 0, bis: 100, text: 'Eigenmarke' },
        { von: 400, bis: 500, text: 'liegt draußen' },
        { von: 100, bis: 100, text: 'ohne Länge' },
      ],
      0,
      300,
    );
    expect(teile?.map((t) => t.text)).toEqual(['Eigenmarke', 'Bio']);
  });

  it('kürzt ein Teil auf die Strecke', () => {
    const teile = teileGeordnet([{ von: 0, bis: 400, text: 'Bio' }], 100, 300);
    expect(teile).toEqual([{ von: 100, bis: 300, text: 'Bio' }]);
  });

  it('lässt Überlappungen dem früheren Teil', () => {
    const teile = teileGeordnet(
      [
        { von: 0, bis: 200, text: 'A' },
        { von: 100, bis: 300, text: 'B' },
      ],
      0,
      300,
    );
    expect(teile).toEqual([
      { von: 0, bis: 200, text: 'A' },
      { von: 200, bis: 300, text: 'B' },
    ]);
  });

  it('gibt nichts zurück statt einer leeren Liste', () => {
    // Sonst stünde in jeder gespeicherten Planung ein leeres Feld herum.
    expect(teileGeordnet(undefined, 0, 300)).toBeUndefined();
    expect(teileGeordnet([], 0, 300)).toBeUndefined();
    expect(teileGeordnet([{ von: 400, bis: 500, text: 'weg' }], 0, 300)).toBeUndefined();
  });

  it('nimmt die Teile mit, wenn eine Strecke geteilt wird', () => {
    // Wer mitten in „Trockenobst" etwas anderes einträgt, behält links und
    // rechts die Teilsortimente, die dort noch liegen.
    const vorher = [
      {
        von: 0,
        bis: 300,
        text: 'Trockenobst',
        teile: [
          { von: 0, bis: 100, text: 'Eigenmarke' },
          { von: 200, bis: 300, text: 'Bio' },
        ],
      },
    ];
    const nachher = ohneStrecke(vorher, 300, 100, 200);
    expect(nachher).toHaveLength(2);
    expect(nachher[0].teile?.map((t) => t.text)).toEqual(['Eigenmarke']);
    expect(nachher[1].teile?.map((t) => t.text)).toEqual(['Bio']);
  });
});
