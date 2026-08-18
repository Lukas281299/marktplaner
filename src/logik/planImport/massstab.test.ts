import { describe, expect, it } from 'vitest';
import { bestimmeMassstab, massstabAusText, mmJePunkt, probenAusMassketten } from './massstab';
import type { PlanText } from './typen';

/**
 * Prüfungen für die Maßstabsbestimmung.
 *
 * Gebaut wird hier jeweils eine echte Maßkette: Strecken werden aneinander
 * gelegt, und jede Maßzahl kommt in die Mitte ihrer Strecke – genau so steht
 * sie im Plan. Rechnet die Bestimmung richtig, muss der Maßstab wieder
 * herauskommen, mit dem die Kette gebaut wurde.
 */

function text(inhalt: string, x: number, y: number): PlanText {
  return { text: inhalt, x, y, breite: inhalt.length * 3, hoehe: 6 };
}

/**
 * Legt eine waagerechte Maßkette an.
 *
 * `strecken` sind die Maße in Millimetern, `massstab` der Nenner. Die
 * Maßzahl einer Strecke sitzt in deren Mitte.
 */
function masskette(strecken: number[], massstab: number, y: number, startX = 50): PlanText[] {
  const jePunkt = mmJePunkt(massstab);
  const texte: PlanText[] = [];
  let x = startX;
  for (const strecke of strecken) {
    const laenge = strecke / jePunkt;
    texte.push(text(String(strecke), x + laenge / 2, y));
    x += laenge;
  }
  return texte;
}

describe('Maßstab aus dem Schriftfeld', () => {
  it('liest „Maßstab 1:100"', () => {
    expect(massstabAusText([text('Maßstab 1:100', 0, 0)])).toBe(100);
  });

  it('liest auch Schreibweisen mit ss, Leerzeichen und Schrägstrich', () => {
    expect(massstabAusText([text('Massstab 1 : 50', 0, 0)])).toBe(50);
    expect(massstabAusText([text('Scale 1/200', 0, 0)])).toBe(200);
  });

  it('lässt sich von Unsinn nicht beirren', () => {
    // Zu groß, um ein Maßstab zu sein.
    expect(massstabAusText([text('Maßstab 1:99999', 0, 0)])).toBeUndefined();
    // Ein Verhältnis ohne das Wort davor ist kein Maßstab, sondern
    // irgendeine Angabe – im Plan steht viel mit Doppelpunkt.
    expect(massstabAusText([text('Mischung 1:3', 0, 0)])).toBeUndefined();
    expect(massstabAusText([text('Bandbreite 450 x 1800', 0, 0)])).toBeUndefined();
  });
});

describe('Maßstab aus den Maßketten', () => {
  it('findet 1:100 in einer sauberen Kette', () => {
    const befund = bestimmeMassstab(masskette([1250, 1250, 1000, 625, 1333, 1250, 1000], 100, 300));
    expect(befund.massstab).toBe(100);
    expect(befund.mmJePunkt).toBeCloseTo(35.2778, 3);
    expect(befund.sicherheit).toBe('sicher');
  });

  it('findet auch 1:50 und 1:200', () => {
    expect(bestimmeMassstab(masskette([2000, 3000, 2500, 1800, 2200, 1600], 50, 200)).massstab).toBe(50);
    expect(bestimmeMassstab(masskette([6000, 8000, 7500, 5400, 6600, 4800], 200, 200)).massstab).toBe(200);
  });

  it('wertet senkrechte Ketten genauso aus', () => {
    const jePunkt = mmJePunkt(100);
    const texte: PlanText[] = [];
    let y = 40;
    for (const strecke of [1250, 1250, 1000, 625, 1333, 1250]) {
      const laenge = strecke / jePunkt;
      texte.push(text(String(strecke), 120, y + laenge / 2));
      y += laenge;
    }
    expect(bestimmeMassstab(texte).massstab).toBe(100);
  });

  it('lässt sich von Zahlen, die keine Maße sind, nicht stören', () => {
    // Positionsnummern, Etagenzahlen und Artikelnummern stehen kreuz und quer
    // im Plan. Sie dürfen die Häufung nicht kippen.
    const stoerung = [
      text('5', 80, 300), text('6', 140, 300), text('01.33', 200, 300),
      text('88', 260, 305), text('2024', 900, 900), text('1', 320, 300),
    ];
    const befund = bestimmeMassstab([...masskette([1250, 1250, 1000, 625, 1333, 1250, 1000], 100, 500), ...stoerung]);
    expect(befund.massstab).toBe(100);
  });

  it('überstimmt ein falsches Schriftfeld und sagt warum', () => {
    // Der Plan wurde skaliert, das Schriftfeld nicht nachgezogen. Die
    // Zeichnung selbst hat recht.
    const texte = [...masskette([1250, 1250, 1000, 625, 1333, 1250, 1000], 100, 300), text('Maßstab 1:50', 900, 900)];
    const befund = bestimmeMassstab(texte);
    expect(befund.massstab).toBe(100);
    expect(befund.sicherheit).toBe('wahrscheinlich');
    expect(befund.begruendung).toContain('nachträglich skaliert');
  });

  it('nimmt das Schriftfeld, wenn es keine Maßketten gibt', () => {
    const befund = bestimmeMassstab([text('Maßstab 1:100', 900, 900)]);
    expect(befund.massstab).toBe(100);
    expect(befund.sicherheit).toBe('geraten');
    expect(befund.begruendung).toContain('Maßketten');
  });

  it('gibt bei einem leeren Plan eine ehrliche Vermutung ab', () => {
    const befund = bestimmeMassstab([]);
    expect(befund.massstab).toBe(100);
    expect(befund.sicherheit).toBe('geraten');
    expect(befund.proben).toBe(0);
  });
});

describe('Proben aus Maßketten', () => {
  it('rechnet den halben Abstand beider Nachbarn, nicht den ganzen', () => {
    // Zwei Strecken von 1000 mm: Die Maßzahlen stehen 1000 mm auseinander,
    // nämlich je 500 mm von der gemeinsamen Kante entfernt.
    const proben = probenAusMassketten(masskette([1000, 1000], 100, 300));
    expect(proben).toHaveLength(1);
    expect(proben[0]).toBeCloseTo(mmJePunkt(100), 4);
  });

  it('wirft Paare weg, die viel zu weit auseinanderliegen', () => {
    // Zwei Zahlen quer über das Blatt gehören nicht zusammen.
    const proben = probenAusMassketten([text('1000', 50, 300), text('1000', 2000, 300)]);
    expect(proben).toEqual([]);
  });
});
