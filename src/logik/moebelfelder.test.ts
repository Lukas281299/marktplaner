import { describe, expect, it } from 'vitest';
import { zeigtBeidseitig, zeigtBodenmasse, zeigtKisten, zeigtWarengruppen } from './moebelfelder';
import type { PlanElement } from '../typen/modell';

/**
 * Prüfungen dafür, welche Eingaben zu welchem Möbel gehören.
 *
 * An einer Kassenzeile standen „Unterster Boden", „Korpustiefe" und ein
 * Warengruppenband – Felder aus der Welt der Regale. Was jemand dort
 * hineinschreibt, taucht in keiner Auswertung auf; ein Feld an der falschen
 * Stelle ist eine Einladung zum Fehler.
 *
 * Die Gegenprobe zählt genauso: Was schon einen Wert trägt, muss sichtbar
 * bleiben, sonst käme niemand mehr an eine Zahl aus einem eingelesenen Plan
 * heran.
 */

const moebel = (werte: Partial<PlanElement> = {}): PlanElement =>
  ({
    id: 'm',
    vorlageId: 'wt-100',
    ebeneId: 'einrichtung',
    name: 'Regal',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 100,
    tiefe: 67,
    drehung: 0,
    form: 'wt100',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
    beidseitig: false,
    ...werte,
  }) as PlanElement;

const kasse = (werte: Partial<PlanElement> = {}) =>
  moebel({ kategorie: 'kassen', form: 'kasse', name: 'Kasse', ...werte });

describe('Bodenmaße', () => {
  it('stehen am Regal', () => {
    expect(zeigtBodenmasse(moebel())).toBe(true);
  });

  it('stehen nicht an einer Kasse', () => {
    expect(zeigtBodenmasse(kasse())).toBe(false);
  });

  it('stehen nicht an einer Truhe, einer Palette, einem Getränkegestell', () => {
    // Eine Wanne und ein Ladungsträger haben keine Böden.
    expect(zeigtBodenmasse(moebel({ form: 'tkTruhe' }))).toBe(false);
    expect(zeigtBodenmasse(moebel({ form: 'palette' }))).toBe(false);
    expect(zeigtBodenmasse(moebel({ form: 'getraenkegestell' }))).toBe(false);
  });

  it('bleiben stehen, wo schon ein Maß eingetragen ist', () => {
    // Sonst käme an die Zahl niemand mehr heran.
    expect(zeigtBodenmasse(kasse({ grundboden: 60 }))).toBe(true);
    expect(zeigtBodenmasse(moebel({ form: 'tkTruhe', korpustiefe: 80 }))).toBe(true);
  });
});

describe('Beidseitig bestückt', () => {
  it('steht an allem, was Ware trägt', () => {
    expect(zeigtBeidseitig(moebel())).toBe(true);
    expect(zeigtBeidseitig(moebel({ form: 'tkTruhe' }))).toBe(true);
  });

  it('steht nicht an einer Kasse', () => {
    expect(zeigtBeidseitig(kasse())).toBe(false);
  });

  it('bleibt stehen, wo der Schalter schon gesetzt ist', () => {
    expect(zeigtBeidseitig(kasse({ beidseitig: true }))).toBe(true);
  });
});

describe('Warengruppenband', () => {
  it('steht am Regal', () => {
    expect(zeigtWarengruppen(moebel())).toBe(true);
  });

  it('steht nicht an einer Kasse', () => {
    expect(zeigtWarengruppen(kasse())).toBe(false);
  });

  it('bleibt stehen, wo schon eine Strecke beschriftet ist', () => {
    const alt = kasse({ warengruppenUnten: [{ von: 0, bis: 100, text: 'Zeitschriften' }] });
    expect(zeigtWarengruppen(alt)).toBe(true);
  });
});

describe('Auslagen und grüne Kisten', () => {
  it('stehen am Obst- und Gemüsemöbel', () => {
    expect(zeigtKisten(moebel({ kategorie: 'obstgemuese', form: 'vitable' }))).toBe(true);
  });

  it('stehen nicht an jedem Trockenregal', () => {
    // Vorher bekam jedes der zweihundert Regale ein leeres Kistenfeld.
    expect(zeigtKisten(moebel())).toBe(false);
    expect(zeigtKisten(moebel({ kategorie: 'kuehlung', form: 'kuehlSchrank' }))).toBe(false);
  });

  it('stehen am Kartoffelregal, sobald es beschriftet ist', () => {
    const kartoffeln = moebel({
      warengruppenUnten: [
        { von: 0, bis: 100, text: 'Kartoffeln', pfad: 'Obst & Gemüse › Erdfrüchte › Kartoffeln' },
      ],
    });
    expect(zeigtKisten(kartoffeln)).toBe(true);
  });

  it('stehen an einem gestuften Möbel', () => {
    expect(zeigtKisten(moebel({ stufen: [40, 60] }))).toBe(true);
  });

  it('bleiben stehen, wo schon eine Zahl eingetragen ist', () => {
    expect(zeigtKisten(moebel({ ifkoKisten: 12 }))).toBe(true);
    expect(zeigtKisten(moebel({ auslagen: 4 }))).toBe(true);
  });

  it('stehen nicht an einer Kasse', () => {
    expect(zeigtKisten(kasse())).toBe(false);
  });
});
