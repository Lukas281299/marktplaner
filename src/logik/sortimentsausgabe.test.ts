import { describe, expect, it } from 'vitest';
import { alsTabelle } from './sortimentsausgabe';
import { leseSortimentsliste } from './sortiment';

/**
 * Prüfungen für den Weg zurück nach Excel.
 *
 * Die eine Sache, auf die es ankommt: **Die Datei geht hin und zurück.** Was
 * ausgegeben und wieder eingelesen wird, muss dieselbe Liste ergeben – sonst
 * verliert jemand beim ersten Umweg über das Tabellenprogramm ein Sortiment
 * und merkt es erst, wenn im Markt eine Lücke steht.
 */

const LISTE = {
  abteilungen: [
    {
      name: 'Molkerei',
      warengruppen: [
        { name: 'Milch', sortimente: ['Vollmilch', 'H-Milch'] },
        { name: 'Joghurt', sortimente: ['Fruchtjoghurt'] },
      ],
    },
    {
      name: 'Backwaren',
      warengruppen: [{ name: 'Bake Off', sortimente: ['Baguette, Stangen, Ciab.'] }],
    },
  ],
};

describe('Die Liste als Tabelle', () => {
  it('schreibt jede Stufe nur in ihrer ersten Zeile', () => {
    expect(alsTabelle(LISTE).split('\r\n')).toEqual([
      'Abteilung;Warengruppe;Sortiment',
      'Molkerei;Milch;Vollmilch',
      ';;H-Milch',
      ';Joghurt;Fruchtjoghurt',
      // Das Komma im Namen braucht keine Anführungszeichen: Getrennt wird
      // am Semikolon.
      'Backwaren;Bake Off;Baguette, Stangen, Ciab.',
    ]);
  });

  it('geht hin und zurück, ohne dass etwas verlorengeht', () => {
    expect(leseSortimentsliste(alsTabelle(LISTE))).toEqual(LISTE);
  });

  it('behält eine Warengruppe ohne Sortimente', () => {
    const leer = {
      abteilungen: [{ name: 'Centeria', warengruppen: [{ name: 'Restaurant', sortimente: [] }] }],
    };
    expect(leseSortimentsliste(alsTabelle(leer))).toEqual(leer);
  });

  it('behält eine Abteilung ohne Warengruppen', () => {
    const leer = { abteilungen: [{ name: 'Leerstand', warengruppen: [] }] };
    expect(leseSortimentsliste(alsTabelle(leer))).toEqual(leer);
  });

  it('packt ein Semikolon im Namen ein', () => {
    const heikel = {
      abteilungen: [
        { name: 'A;B', warengruppen: [{ name: 'C"D', sortimente: ['E'] }] },
      ],
    };
    expect(leseSortimentsliste(alsTabelle(heikel))).toEqual(heikel);
  });
});
