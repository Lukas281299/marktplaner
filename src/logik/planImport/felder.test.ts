import { describe, expect, it } from 'vitest';
import { etagenzahlen, findeGondelpaare, findeZuege } from './felder';
import { mmJePunkt } from './massstab';
import type { PlanText } from './typen';

/**
 * Prüfungen für die Felderkennung.
 *
 * Gebaut werden hier Zahlenreihen, wie sie im Plan stehen: eine Etagenzahl
 * je Regalfeld, in dessen Mitte. Kommt der Zug richtig heraus, stimmen
 * Achsmaß, Feldzahl und Laufrichtung.
 */

const JE_PUNKT = mmJePunkt(100);

function zahl(inhalt: string, x: number, y: number): PlanText {
  return { text: inhalt, x, y, breite: 6, hoehe: 5 };
}

/**
 * Legt eine Reihe Etagenzahlen an: `felder` Stück im Abstand `achsmass`,
 * ab (x, y) unter dem Winkel `grad`.
 */
function reihe(
  felder: number,
  achsmassMm: number,
  x: number,
  y: number,
  grad = 0,
  etagen = 5,
  streuung = 0,
): PlanText[] {
  const schritt = achsmassMm / JE_PUNKT;
  const bogen = (grad * Math.PI) / 180;
  const texte: PlanText[] = [];
  for (let i = 0; i < felder; i++) {
    // Die Zahl sitzt in der optischen Mitte des Felds, nicht exakt auf der
    // Achse – im echten Plan streut das um ein paar Prozent.
    const versatz = streuung ? (((i * 37) % 11) / 11 - 0.5) * streuung * schritt : 0;
    const d = i * schritt + versatz;
    texte.push(zahl(`${etagen}+`, x + Math.cos(bogen) * d, y + Math.sin(bogen) * d));
  }
  return texte;
}

describe('Etagenzahlen einlesen', () => {
  it('erkennt „5+" und liest die Zahl', () => {
    const felder = etagenzahlen([zahl('5+', 10, 20), zahl('6 +', 30, 20)]);
    expect(felder.map((f) => f.etagen)).toEqual([5, 6]);
  });

  it('lässt alles andere liegen', () => {
    const felder = etagenzahlen([
      zahl('01.33', 10, 20),
      zahl('1250', 30, 20),
      zahl('wt100 H 1800 T 600', 50, 20),
      zahl('+', 70, 20),
      zahl('12+', 90, 20),
    ]);
    expect(felder).toEqual([]);
  });
});

describe('Züge aus den Feldern', () => {
  it('erkennt einen geraden Zug aus sechs 1000ern', () => {
    const zuege = findeZuege(etagenzahlen(reihe(6, 1000, 100, 300)), JE_PUNKT);
    expect(zuege).toHaveLength(1);
    expect(zuege[0].felder).toHaveLength(6);
    expect(zuege[0].achsmassMm).toBe(1000);
    expect(zuege[0].laengeMm).toBe(6000);
    expect(zuege[0].sicherheit).toBe('sicher');
  });

  it('erkennt 1250 und 625 auseinander', () => {
    expect(findeZuege(etagenzahlen(reihe(5, 1250, 100, 300)), JE_PUNKT)[0].achsmassMm).toBe(1250);
    expect(findeZuege(etagenzahlen(reihe(5, 625, 100, 600)), JE_PUNKT)[0].achsmassMm).toBe(625);
  });

  it('hält 1250 und 1333 auseinander', () => {
    // Die beiden liegen nur 6,6 % auseinander – das ist der engste Fall.
    expect(findeZuege(etagenzahlen(reihe(6, 1333, 100, 300)), JE_PUNKT)[0].achsmassMm).toBe(1333);
    expect(findeZuege(etagenzahlen(reihe(6, 1250, 100, 300)), JE_PUNKT)[0].achsmassMm).toBe(1250);
  });

  it('verkraftet die Streuung des echten Plans', () => {
    // Gemessen wurden dort 976 bis 1021 mm für ein 1000er Feld.
    const zug = findeZuege(etagenzahlen(reihe(8, 1000, 100, 300, 0, 6, 0.04)), JE_PUNKT)[0];
    expect(zug.achsmassMm).toBe(1000);
    expect(zug.felder).toHaveLength(8);
  });

  it('folgt einem schrägen Zug', () => {
    // Im Plan stehen mehrere Züge schräg im Raum. Nach y zu bündeln würde
    // sie zerreißen.
    const zug = findeZuege(etagenzahlen(reihe(7, 1000, 200, 200, 37)), JE_PUNKT)[0];
    expect(zug.felder).toHaveLength(7);
    expect(zug.achsmassMm).toBe(1000);
    expect(zug.winkel).toBeCloseTo(37, 0);
  });

  it('trennt zwei Züge, die über Eck aneinanderstoßen', () => {
    const ecke = [...reihe(5, 1000, 100, 300), ...reihe(5, 1000, 100, 300 + 1000 / JE_PUNKT, 90)];
    const zuege = findeZuege(etagenzahlen(ecke), JE_PUNKT).filter((z) => z.felder.length > 1);
    expect(zuege).toHaveLength(2);
    const winkel = zuege.map((z) => Math.round(Math.abs(z.winkel))).sort();
    expect(winkel).toEqual([0, 90]);
  });

  it('trennt zwei Züge, die weit auseinanderstehen', () => {
    const weit = [...reihe(4, 1000, 100, 300), ...reihe(4, 1000, 900, 300)];
    const zuege = findeZuege(etagenzahlen(weit), JE_PUNKT);
    expect(zuege).toHaveLength(2);
    expect(zuege.every((z) => z.felder.length === 4)).toBe(true);
  });

  it('meldet ein einzelnes Feld als solches', () => {
    const zuege = findeZuege(etagenzahlen([zahl('4+', 100, 300)]), JE_PUNKT);
    expect(zuege).toHaveLength(1);
    expect(zuege[0].sicherheit).toBe('geraten');
    expect(zuege[0].anmerkung).toContain('Einzelnes Feld');
  });

  it('meldet ein Achsmaß, das zu keinem Systemmaß passt', () => {
    // 1450 liegt noch in Reichweite der Verkettung, aber 8,8 % neben dem
    // größten Systemmaß 1333 – so etwas soll auffallen, nicht durchrutschen.
    const zug = findeZuege(etagenzahlen(reihe(5, 1450, 100, 300)), JE_PUNKT)[0];
    expect(zug.sicherheit).toBe('geraten');
    expect(zug.anmerkung).toContain('1450');
  });

  it('lässt Felder liegen, die weiter als ein Systemmaß auseinanderstehen', () => {
    // 1600 mm ist kein Achsmaß und auch keine Lücke innerhalb eines Zuges.
    const zuege = findeZuege(etagenzahlen(reihe(4, 1600, 100, 300)), JE_PUNKT);
    expect(zuege.every((z) => z.felder.length === 1)).toBe(true);
  });

  it('lässt sich von einem einzelnen zu großen Schritt nicht verziehen', () => {
    // Der Median schützt: Ein Feld fehlt in der Mitte, der Rest stimmt.
    const schritt = 1000 / JE_PUNKT;
    const texte = [0, 1, 2, 4, 5, 6].map((i) => zahl('5+', 100 + i * schritt, 300));
    const zug = findeZuege(etagenzahlen(texte), JE_PUNKT)[0];
    expect(zug.achsmassMm).toBe(1000);
  });
});

describe('Gondeln aus zwei Reihen', () => {
  it('findet die beiden Seiten einer Gondel an der Mittellinie', () => {
    // So steht es im echten Plan: Die Zahlenreihen liegen nur rund 380 mm
    // auseinander, beidseits der Mittellinie – nicht auf Gondeltiefe.
    const mitte = 380 / JE_PUNKT;
    const beide = [...reihe(6, 1250, 100, 300, 0, 5), ...reihe(6, 1250, 100, 300 + mitte, 0, 6)];
    const zuege = findeZuege(etagenzahlen(beide), JE_PUNKT);
    expect(zuege).toHaveLength(2);
    expect(findeGondelpaare(zuege, JE_PUNKT)).toEqual([[0, 1]]);
  });

  it('findet sie auch, wenn sie auf Gondeltiefe gezeichnet sind', () => {
    // Zwei gleich lange Reihen, 1070 mm auseinander – eine Gondel T2x500.
    const tiefe = 1070 / JE_PUNKT;
    const beide = [...reihe(6, 1250, 100, 300, 0, 5), ...reihe(6, 1250, 100, 300 + tiefe, 0, 6)];
    const zuege = findeZuege(etagenzahlen(beide), JE_PUNKT);
    expect(zuege).toHaveLength(2);
    expect(findeGondelpaare(zuege, JE_PUNKT)).toEqual([[0, 1]]);
  });

  it('erklärt zwei weit auseinanderliegende Züge nicht zur Gondel', () => {
    // Zwei Wandregale an gegenüberliegenden Wänden eines Gangs.
    const weit = 4000 / JE_PUNKT;
    const beide = [...reihe(6, 1250, 100, 300), ...reihe(6, 1250, 100, 300 + weit)];
    const zuege = findeZuege(etagenzahlen(beide), JE_PUNKT);
    expect(findeGondelpaare(zuege, JE_PUNKT)).toEqual([]);
  });

  it('paart auch, wenn die Seiten verschieden viele Felder haben', () => {
    // Der Regelfall im echten Plan: Auf der einen Seite steht ein Feld
    // weniger, weil dort ein Kopfregal sitzt. Die Forderung nach exakt
    // gleicher Feldzahl hat deshalb im Plan Fuldabrück keine einzige Gondel
    // gefunden.
    const tiefe = 1070 / JE_PUNKT;
    const ungleich = [...reihe(6, 1250, 100, 300), ...reihe(5, 1250, 100, 300 + tiefe)];
    const zuege = findeZuege(etagenzahlen(ungleich), JE_PUNKT);
    expect(findeGondelpaare(zuege, JE_PUNKT)).toHaveLength(1);
  });

  it('paart auch, wenn die Seiten gegenläufig verkettet wurden', () => {
    // Die Kette der zweiten Seite kann von rechts nach links gelaufen sein.
    // Dann steht dort 180 Grad statt 0 – dieselbe Gerade, anderer Winkel.
    const tiefe = 1070 / JE_PUNKT;
    const zuege = findeZuege(etagenzahlen(reihe(6, 1250, 100, 300)), JE_PUNKT);
    const gegenlaeufig = findeZuege(etagenzahlen(reihe(6, 1250, 100, 300 + tiefe)), JE_PUNKT).map(
      (z) => ({ ...z, winkel: z.winkel + 180, felder: [...z.felder].reverse() }),
    );
    expect(findeGondelpaare([...zuege, ...gegenlaeufig], JE_PUNKT)).toHaveLength(1);
  });

  it('paart nicht, wenn sich die Züge längs kaum überdecken', () => {
    // Zwei kurze Züge nebeneinander, aber versetzt: das sind zwei Regale,
    // keine Gondel.
    const tiefe = 1070 / JE_PUNKT;
    const versetzt = [
      ...reihe(4, 1250, 100, 300),
      ...reihe(4, 1250, 100 + (4 * 1250) / JE_PUNKT, 300 + tiefe),
    ];
    const zuege = findeZuege(etagenzahlen(versetzt), JE_PUNKT);
    expect(findeGondelpaare(zuege, JE_PUNKT)).toEqual([]);
  });
});
