import { describe, expect, it } from 'vitest';
import { Leinwandmitschreiber } from './leinwandmitschreiber';
import { moebelschritte } from './planvektor';
import { pfadVon } from './pfadschreiber';
import { zeichneMoebelumriss } from '../komponenten/zeichenflaeche/ElementSymbol';
import { BIBLIOTHEK } from '../daten/bibliothek';
import type { PlanElement } from '../typen/modell';

/**
 * Der Mitschreiber, der eine ganze Zeichnung aufnimmt.
 *
 * Das Entscheidende ist nicht, dass er etwas aufzeichnet – es ist, dass er
 * **nichts verliert**. Die Paletten unter den Böden, die Schwenkbögen der
 * Türen, die Beschriftung der Felder: Fehlt davon etwas, sieht man es nicht
 * im Plan, sondern erst auf dem gedruckten Blatt.
 */

/** Ein Element aus einer Bibliotheksvorlage. */
function ausVorlage(id: string, extra: Partial<PlanElement> = {}): PlanElement {
  const v = BIBLIOTHEK.find((e) => e.id === id) ?? BIBLIOTHEK[0];
  return {
    id: 'e1',
    vorlageId: v.id,
    ebeneId: 'einrichtung',
    name: v.name,
    kategorie: v.kategorie,
    x: 0,
    y: 0,
    breite: v.breite,
    tiefe: v.tiefe,
    drehung: 0,
    form: v.form,
    farbe: v.farbe,
    achsmass: v.achsmass ?? 0,
    polygon: v.polygon,
    hoehe: v.hoehe,
    beidseitig: v.beidseitig,
    beschriftung: v.name,
    beschriftungSichtbar: true,
    schriftgroesse: 14,
    gesperrt: false,
    reihenfolge: 1,
    ...extra,
  } as PlanElement;
}

/** Ein Regal mit Achsmaß – die Grundlage für Felder, Paletten und Ware. */
const REGAL = BIBLIOTHEK.find((e) => e.kategorie === 'regale' && e.achsmass)!;

describe('Leinwandmitschreiber', () => {
  it('trennt Flächen, Striche und Texte', () => {
    const m = new Leinwandmitschreiber({ zoom: 1, fuellung: '#abc', linie: '#123' });
    m.beginPath();
    m.rect(0, 0, 10, 10);
    m.setAttr('fillStyle', '#f00');
    m.fill();
    m.setAttr('strokeStyle', '#0f0');
    m.stroke();
    m.setAttr('font', '12px sans-serif');
    m.fillText('hallo', 5, 5);

    expect(m.schritte.map((s) => s.art)).toEqual(['flaeche', 'strich', 'text']);
    expect(m.schritte[0].farbe).toBe('#f00');
    expect(m.schritte[1].farbe).toBe('#0f0');
    expect(m.schritte[2].text).toBe('hallo');
  });

  it('nimmt beim Abschluss Farbe und Linie des Möbels', () => {
    // Konva holt sie dort vom Element und nicht aus dem Zeichenzustand.
    const m = new Leinwandmitschreiber({ zoom: 1, fuellung: '#abcdef', linie: '#123456' });
    m.beginPath();
    m.rect(0, 0, 10, 10);
    m.setAttr('fillStyle', 'egal');
    m.fillStrokeShape();
    expect(m.schritte.map((s) => s.farbe)).toEqual(['#abcdef', '#123456']);
  });

  it('rechnet die Strichbreite in ein Vielfaches der Grundbreite um', () => {
    // Die Zeichnung schreibt `1.6 / zoom`. Auf Papier ist das sinnlos – der
    // Faktor 1,6 dagegen gilt in jedem Maßstab.
    const m = new Leinwandmitschreiber({ zoom: 4 });
    m.beginPath();
    m.moveTo(0, 0);
    m.lineTo(10, 0);
    m.setAttr('lineWidth', 1.6 / 4);
    m.stroke();
    expect(m.schritte[0].breitenfaktor).toBeCloseTo(1.6, 5);
  });

  it('legt den Zustand mit save und restore ab', () => {
    const m = new Leinwandmitschreiber({ zoom: 1 });
    m.setAttr('fillStyle', '#111');
    m.save();
    m.setAttr('fillStyle', '#222');
    m.beginPath();
    m.rect(0, 0, 1, 1);
    m.fill();
    m.restore();
    m.beginPath();
    m.rect(0, 0, 1, 1);
    m.fill();
    expect(m.schritte.map((s) => s.farbe)).toEqual(['#222', '#111']);
  });

  it('führt Verschiebung und Drehung mit', () => {
    // Die Zeichnung dreht Beschriftungen um 180°, damit sie nicht auf dem
    // Kopf stehen. Verlöre der Mitschreiber das, säße die Notiz woanders.
    const m = new Leinwandmitschreiber({ zoom: 1 });
    m.translate(100, 50);
    m.beginPath();
    m.moveTo(0, 0);
    m.lineTo(10, 0);
    m.stroke();
    expect(m.schritte[0].d).toBe('M 100 50 L 110 50');
  });

  it('dreht ein Rechteck mit, statt es achsenparallel zu lassen', () => {
    const m = new Leinwandmitschreiber({ zoom: 1 });
    m.rotate(Math.PI / 2);
    m.beginPath();
    m.rect(0, 0, 10, 4);
    m.fill();
    // Nach einer Vierteldrehung liegt die Breite auf der y-Achse.
    expect(m.schritte[0].d).toContain('0 10');
  });

  it('liest die Schriftgröße aus der Schriftangabe', () => {
    const m = new Leinwandmitschreiber({ zoom: 1 });
    m.setAttr('font', '600 22px sans-serif');
    m.fillText('fett', 0, 0);
    m.setAttr('font', '11px sans-serif');
    m.fillText('mager', 0, 0);
    expect(m.schritte[0].schrift).toBe(22);
    expect(m.schritte[0].fett).toBe(true);
    expect(m.schritte[1].schrift).toBe(11);
    expect(m.schritte[1].fett).toBe(false);
  });

  it('misst Text nach echten Zeichenbreiten', () => {
    // Die Zeichnung fragt danach, um zu entscheiden, ob ein Name ins Feld
    // passt. Über die Zeichenzahl geschätzt bräche er an der falschen Stelle.
    const m = new Leinwandmitschreiber({ zoom: 1 });
    m.setAttr('font', '100px sans-serif');
    expect(m.measureText('W').width).toBeGreaterThan(m.measureText('I').width * 3);
  });

  it('übergeht leere Pfade, statt Schritte ohne Inhalt zu erzeugen', () => {
    const m = new Leinwandmitschreiber({ zoom: 1 });
    m.beginPath();
    m.fill();
    m.stroke();
    m.fillText('', 0, 0);
    expect(m.schritte).toEqual([]);
  });
});

describe('Ein Möbel vollständig mitschreiben', () => {
  it('nimmt die Paletten unter den Böden mit', () => {
    // Sie werden in einem eigenen Durchgang mit eigener Farbe gemalt – der
    // Grund, warum ein reiner Pfadmitschreiber sie verlor.
    const el = ausVorlage(REGAL.id, {
      breite: REGAL.achsmass! * 2,
      felderUnten: [
        { breite: REGAL.achsmass!, unterbau: { art: 'euro', laengs: false } },
        { breite: REGAL.achsmass! },
      ],
    } as Partial<PlanElement>);
    const farben = new Set(moebelschritte(el, 1).map((s) => s.farbe));
    // Die Palettenfarben aus `UNTERBAUFARBEN`.
    expect([...farben].some((f) => f.includes('176, 132, 74'))).toBe(true);
    expect([...farben].some((f) => f.includes('120, 84, 38'))).toBe(true);
  });

  it('nimmt die Beschriftung der Felder mit', () => {
    const el = ausVorlage(REGAL.id, {
      breite: REGAL.achsmass! * 2,
      felderUnten: [{ breite: REGAL.achsmass! }, { breite: REGAL.achsmass! }],
      warengruppenUnten: [{ von: 0, bis: REGAL.achsmass! * 2, text: 'Kaffee' }],
    } as Partial<PlanElement>);
    const texte = moebelschritte(el, 1)
      .filter((s) => s.art === 'text')
      .map((s) => s.text);
    expect(texte).toContain('Kaffee');
  });

  it('nimmt die Schwenkbögen der Türen mit', () => {
    // Ein Kühlschrank zeichnet sie in einem eigenen Durchgang als Strich.
    const mitTuer = BIBLIOTHEK.find((e) => e.form === 'kuehlSchrank' || e.form === 'tkSchrank');
    expect(mitTuer, 'kein Möbel mit Türen in der Bibliothek').toBeTruthy();
    const schritte = moebelschritte(ausVorlage(mitTuer!.id), 1);
    expect(schritte.some((s) => s.art === 'strich' && s.farbe.includes('0.65'))).toBe(true);
  });

  it('schreibt jedes Möbel der Bibliothek ohne Fehler mit', () => {
    // Die Probe über alles: Kein Möbel darf beim Mitschreiben stolpern, und
    // keines darf leer bleiben.
    let leer = 0;
    for (const vorlage of BIBLIOTHEK) {
      const schritte = moebelschritte(ausVorlage(vorlage.id), 1);
      if (schritte.length === 0) leer++;
      for (const s of schritte) {
        if (s.art === 'text') continue;
        const zahlen = (s.d?.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
        expect(zahlen.every(Number.isFinite), `${vorlage.name}: kaputte Zahlen`).toBe(true);
      }
    }
    expect(leer, 'Möbel ohne jede Zeichnung').toBe(0);
  });

  it('lässt den Unterbau aus der Trefferfläche heraus', () => {
    // Eine Kartoffelkiste steht 300 mm vor einem 600er Regal. Läge sie in der
    // Trefferfläche, ließe sich das Regal davor nicht mehr anklicken – der
    // Klick träfe die Kiste des Nachbarn und wählte den Nachbarn aus.
    const el = ausVorlage(REGAL.id, {
      tiefe: 60,
      breite: REGAL.achsmass! * 2,
      felderUnten: [
        { breite: REGAL.achsmass!, unterbau: { art: 'kartoffelkiste', laengs: false } },
        { breite: REGAL.achsmass! },
      ],
    } as Partial<PlanElement>);

    /** Wie weit ein Pfad nach unten reicht. */
    const tiefe = (d: string) => {
      const zahlen = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      // Jede zweite Zahl ist ein y – bei M, L und den drei Punkten von C.
      return Math.max(...zahlen.filter((_, i) => i % 2 === 1));
    };

    const gezeichnet = moebelschritte(el, 1)
      .filter((s) => s.art !== 'text')
      .map((s) => tiefe(s.d ?? ''));
    const umriss = pfadVon((ctx) => zeichneMoebelumriss(ctx, el, el.breite, el.tiefe));

    // Gezeichnet wird über die Möbeltiefe hinaus – die Kiste steht vor.
    expect(Math.max(...gezeichnet)).toBeGreaterThan(el.tiefe + 10);
    // Getroffen wird nur das Möbel.
    expect(tiefe(umriss)).toBeLessThanOrEqual(el.tiefe + 0.01);
  });

  it('liefert für dasselbe Möbel zweimal dasselbe', () => {
    const el = ausVorlage(REGAL.id);
    expect(moebelschritte(el, 1)).toEqual(moebelschritte(el, 1));
  });
});
