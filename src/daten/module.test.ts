import { describe, expect, it } from 'vitest';
import { BIBLIOTHEK } from './bibliothek';
import { modulName, modulsatzFuer, zerlegeInModule } from './module';
import type { Grundform } from '../typen/modell';

/**
 * Prüfungen für die Modulsätze der Abteilungen.
 *
 * Der Sinn dieser Tabelle ist, dass niemand ein Maß plant, das es nicht gibt.
 * Sie taugt dafür nur, solange sie mit der Bibliothek übereinstimmt — deshalb
 * wird hier nicht die Tabelle gegen sich selbst geprüft, sondern gegen die
 * Vorlagen, aus denen im Markt wirklich gebaut wird.
 */

/** Alle Breiten, die die Bibliothek zu einer Form führt. */
function breitenZuForm(form: Grundform): number[] {
  return [...new Set(BIBLIOTHEK.filter((v) => v.form === form).map((v) => v.breite))].sort(
    (a, b) => a - b,
  );
}

describe('Modulsätze', () => {
  it('gibt dem Trockensortiment die vier Achsmaße', () => {
    expect(modulsatzFuer('wt100')!.laengen).toEqual([62.5, 100, 125, 133.3]);
  });

  it('lässt die Freihand-Formen ohne Raster', () => {
    // „Regal frei" und „Gondel frei" heißen so, weil sie frei sind. Ein
    // Raster dort wäre genau das Gegenteil dessen, wofür es sie gibt.
    expect(modulsatzFuer('regal')).toBeUndefined();
    expect(modulsatzFuer('rechteck')).toBeUndefined();
    expect(modulsatzFuer('kreis')).toBeUndefined();
  });

  it('deckt die Kühlung mit ihren Kataloglängen ab', () => {
    const satz = modulsatzFuer('kuehlSchrank')!;
    // Jede Länge, die die Bibliothek führt, muss anhängbar sein – sonst
    // stünde ein Möbel im Plan, das sich nicht nachbauen lässt.
    for (const breite of breitenZuForm('kuehlSchrank')) {
      expect(satz.laengen.some((l) => Math.abs(l - breite) < 0.05)).toBe(true);
    }
  });

  it('deckt die Tiefkühlschränke ab', () => {
    const satz = modulsatzFuer('tkSchrank')!;
    for (const breite of breitenZuForm('tkSchrank')) {
      expect(satz.laengen.some((l) => Math.abs(l - breite) < 0.05)).toBe(true);
    }
  });

  it('gibt der Tiefkühlinsel ihr 625er Modul', () => {
    const satz = modulsatzFuer('tkTruhe')!;
    expect(satz.laengen).toEqual([62.5]);
    // Jede Truhe der Bibliothek ist ein Vielfaches davon.
    for (const breite of breitenZuForm('tkTruhe')) {
      expect(Math.abs((breite / 62.5) - Math.round(breite / 62.5))).toBeLessThan(0.01);
    }
  });

  it('gibt Obst und Gemüse genau die Größen, die es dort gibt', () => {
    expect(modulsatzFuer('vitable')!.laengen).toEqual(breitenZuForm('vitable'));
  });

  it('gibt dem BakeOff-Turm sein Grundmodul und die doppelte Einheit', () => {
    expect(modulsatzFuer('bakeoff')!.laengen).toEqual(breitenZuForm('bakeoff'));
  });

  it('deckt die Kombigeräte ab', () => {
    const satz = modulsatzFuer('tkKombi')!;
    for (const breite of breitenZuForm('tkKombi')) {
      expect(satz.laengen.some((l) => Math.abs(l - breite) < 0.05)).toBe(true);
    }
  });

  it('lässt den Abschluss ohne Raster', () => {
    // Ein Abschluss beendet den Zug. Zwei hintereinander gibt es nicht.
    expect(modulsatzFuer('vitableAbschluss')).toBeUndefined();
    expect(modulsatzFuer('vitableAbschlussRund')).toBeUndefined();
  });

  it('nennt jede Länge so, wie sie im Plan steht', () => {
    // Im Trockensortiment spricht man von Achsmaßen, sonst von Metern.
    expect(modulName(modulsatzFuer('wt100')!, 125)).toBe('A1250');
    expect(modulName(modulsatzFuer('kuehlSchrank')!, 187.5)).toBe('1,88 m');
    expect(modulName(modulsatzFuer('tkSchrank')!, 156.2)).toBe('1,56 m');
    expect(modulName(modulsatzFuer('tkTruhe')!, 62.5)).toBe('0,63 m');
  });

  it('hat zu jeder Einheit eine Mehrzahl und eine Herkunft', () => {
    // Ohne Herkunft wäre die Tabelle eine Behauptung. Sie steht in der
    // Oberfläche unter den Knöpfen und sagt, woher die Maße kommen.
    const alle = ['wt100', 'kuehlSchrank', 'tkSchrank', 'tkKombi', 'tkTruhe', 'vitable', 'bakeoff'];
    for (const form of alle) {
      const satz = modulsatzFuer(form as Grundform)!;
      expect(satz.einheit.length).toBeGreaterThan(0);
      expect(satz.mehrzahl.length).toBeGreaterThan(0);
      expect(satz.herkunft.length).toBeGreaterThan(0);
      expect(satz.laengen.length).toBeGreaterThan(0);
      // Aufsteigend sortiert – die Knopfreihe folgt dieser Reihenfolge.
      expect([...satz.laengen].sort((a, b) => a - b)).toEqual(satz.laengen);
    }
  });
});

describe('Breite in Einheiten zerlegen', () => {
  it('macht aus einer 2,50-m-Truhe vier Module', () => {
    // Am Möbel selbst steht „4 Module à 625 mm" – genau das muss auch im
    // Eigenschaftenfenster stehen.
    expect(zerlegeInModule(250, modulsatzFuer('tkTruhe')!)).toEqual([62.5, 62.5, 62.5, 62.5]);
  });

  it('lässt ein Kühlregal von 1,88 m ein Möbel bleiben', () => {
    // Möglichst wenige Einheiten: Das ist ein Gerät dieser Länge und nicht
    // zwei kleinere, die zufällig dieselbe Summe ergeben.
    expect(zerlegeInModule(187.5, modulsatzFuer('kuehlSchrank')!)).toEqual([187.5]);
  });

  it('zerlegt eine Länge, die es nur zusammengesetzt gibt', () => {
    const satz = modulsatzFuer('kuehlSchrank')!;
    const teile = zerlegeInModule(312.5, satz);
    expect(teile.reduce((a, b) => a + b, 0)).toBeCloseTo(312.5, 2);
    expect(teile.every((t) => satz.laengen.some((l) => Math.abs(l - t) < 0.05))).toBe(true);
  });

  it('lässt eine frei gezogene Breite in einem Stück', () => {
    // 2,10 m gibt es in der Kühlung nicht und lässt sich auch nicht
    // zusammensetzen. Sie zu zerstückeln wäre eine Erfindung.
    expect(zerlegeInModule(210, modulsatzFuer('kuehlSchrank')!)).toEqual([210]);
  });

  it('gibt jede Bibliotheksgröße sauber zurück', () => {
    // Die eigentliche Zusage: Was in der Bibliothek steht, muss sich in
    // Einheiten dieser Abteilung ausdrücken lassen.
    for (const form of ['kuehlSchrank', 'tkSchrank', 'tkKombi', 'tkTruhe', 'vitable', 'bakeoff']) {
      const satz = modulsatzFuer(form as Grundform)!;
      for (const breite of breitenZuForm(form as Grundform)) {
        const teile = zerlegeInModule(breite, satz);
        expect(teile.reduce((a, b) => a + b, 0)).toBeCloseTo(breite, 1);
        expect(teile.every((t) => satz.laengen.some((l) => Math.abs(l - t) < 0.05))).toBe(true);
      }
    }
  });
});

describe('Bedientheken', () => {
  it('kennt die Kataloglängen der Bedienung', () => {
    for (const form of ['blinkTheke', 'blinkSelf', 'blinkSv'] as Grundform[]) {
      const satz = modulsatzFuer(form)!;
      expect(satz.laengen).toEqual(breitenZuForm(form));
    }
  });

  it('lässt jede Bedientheke sauber zerlegen', () => {
    const satz = modulsatzFuer('blinkTheke')!;
    for (const breite of breitenZuForm('blinkTheke')) {
      const teile = zerlegeInModule(breite, satz);
      expect(teile.reduce((a, b) => a + b, 0)).toBeCloseTo(breite, 1);
    }
  });
});
