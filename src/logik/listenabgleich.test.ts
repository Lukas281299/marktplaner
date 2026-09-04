import { describe, expect, it } from 'vitest';
import { mitNachgezogenenPfaden, verwaistePfade } from './listenabgleich';
import type { PlanElement, Projekt } from '../typen/modell';
import type { Sortimentsliste } from '../daten/warengruppen';

/**
 * Prüfungen für eine neue Sortimentsliste.
 *
 * Der Plan merkt sich den ganzen Pfad, nicht einen Verweis in die Liste –
 * deshalb geht beim Ersetzen nichts verloren. Reißen kann die **Verbindung**:
 * Ein umbenannter Eintrag steht danach rot da, obwohl seine Meter im Markt
 * stehen. Genau das soll der Abgleich zeigen und, wo es eindeutig ist,
 * nachziehen.
 */

const ALT: Sortimentsliste = {
  abteilungen: [
    { name: 'Getränke', warengruppen: [{ name: 'Getränke Einweg', sortimente: ['Säfte', 'Cola'] }] },
  ],
};

const P = (...stufen: string[]) => stufen.join(' › ');
const SAEFTE_ALT = P('Getränke', 'Getränke Einweg', 'Säfte');

function element(text: string, pfad: string): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'wt100',
    ebeneId: 'einrichtung',
    name: 'Zug',
    kategorie: 'regale',
    x: 0,
    y: 0,
    breite: 300,
    tiefe: 70,
    drehung: 0,
    form: 'wt100',
    farbe: '#ccc',
    beschriftung: '',
    beschriftungSichtbar: false,
    schriftgroesse: 12,
    gesperrt: false,
    reihenfolge: 0,
    beidseitig: false,
    achsmass: 100,
    felderUnten: [{ breite: 300, boeden: 5 }],
    warengruppenUnten: [{ von: 0, bis: 300, text, pfad }],
  } as PlanElement;
}

const plan = (): Projekt =>
  ({
    elemente: [element('Säfte', SAEFTE_ALT)],
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
  }) as Projekt;

describe('Was die neue Liste nicht mehr kennt', () => {
  it('meldet nichts, wenn alles noch da ist', () => {
    expect(verwaistePfade(plan(), ALT)).toEqual([]);
  });

  it('meldet nichts, wenn nur etwas dazugekommen ist', () => {
    const neu: Sortimentsliste = {
      abteilungen: [
        {
          name: 'Getränke',
          warengruppen: [{ name: 'Getränke Einweg', sortimente: ['Säfte', 'Cola', 'Eistee'] }],
        },
      ],
    };
    expect(verwaistePfade(plan(), neu)).toEqual([]);
  });

  it('findet ein umbenanntes Sortiment und weiß, wohin damit', () => {
    // Die Warengruppe heißt neu, das Sortiment steht darin genau einmal.
    const neu: Sortimentsliste = {
      abteilungen: [
        { name: 'Getränke', warengruppen: [{ name: 'Alkoholfrei', sortimente: ['Säfte', 'Cola'] }] },
      ],
    };
    expect(verwaistePfade(plan(), neu)).toEqual([
      { alt: SAEFTE_ALT, neu: P('Getränke', 'Alkoholfrei', 'Säfte'), meter: 300 },
    ]);
  });

  it('zieht nicht nach, wenn der Name in der neuen Liste mehrfach steht', () => {
    // „Säfte" zweimal: Die falsche Stelle zu treffen verschöbe Meter zwischen
    // zwei Abteilungen, ohne dass es auffiele.
    const neu: Sortimentsliste = {
      abteilungen: [
        { name: 'Getränke', warengruppen: [{ name: 'Alkoholfrei', sortimente: ['Säfte'] }] },
        { name: 'Obst & Gemüse', warengruppen: [{ name: 'Convenience', sortimente: ['Säfte'] }] },
      ],
    };
    expect(verwaistePfade(plan(), neu)).toEqual([{ alt: SAEFTE_ALT, neu: undefined, meter: 300 }]);
  });

  it('zieht nicht nach, wenn es den Namen gar nicht mehr gibt', () => {
    const neu: Sortimentsliste = {
      abteilungen: [
        { name: 'Getränke', warengruppen: [{ name: 'Alkoholfrei', sortimente: ['Fruchtsäfte'] }] },
      ],
    };
    expect(verwaistePfade(plan(), neu)).toEqual([{ alt: SAEFTE_ALT, neu: undefined, meter: 300 }]);
  });
});

describe('Nachziehen', () => {
  it('hängt den Pfad um und lässt den Text stehen', () => {
    const neuerPfad = P('Getränke', 'Alkoholfrei', 'Säfte');
    const elemente = mitNachgezogenenPfaden(plan(), new Map([[SAEFTE_ALT, neuerPfad]]));
    expect(elemente).not.toBeNull();
    const abschnitt = elemente![0].warengruppenUnten![0];
    expect(abschnitt.pfad).toBe(neuerPfad);
    // Die Beschriftung hat jemand gewählt – daran hat die Liste nichts zu ändern.
    expect(abschnitt.text).toBe('Säfte');
  });

  it('tut nichts, wenn nichts passt', () => {
    expect(mitNachgezogenenPfaden(plan(), new Map([['Anderes › Ding', 'X › Y']]))).toBeNull();
    expect(mitNachgezogenenPfaden(plan(), new Map())).toBeNull();
  });
});
