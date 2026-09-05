import { describe, expect, it } from 'vitest';
import {
  beschriftungsschluessel,
  mitAngeglichenenBeschriftungen,
  mitNachgezogenenPfaden,
  veralteteBeschriftungen,
  verwaistePfade,
  type Beschriftungsentscheidung,
} from './listenabgleich';
import type { PlanElement, Projekt, Warengruppenabschnitt } from '../typen/modell';
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

// ===========================================================================
//  Beschriftungen, die nicht mehr so heißen wie die Liste
// ===========================================================================

/**
 * Der Pfad stimmt, der Name im Plan nicht mehr.
 *
 * Der Fall, den Lukas gemeldet hat: „Aufbackware Brötchen" wurde zu
 * „Aufbackware", der Pfad zog mit, die Beschriftung am Möbel nicht. Die
 * Auswertung war richtig, der Plan zeigte den alten Namen – und der Plan ist
 * das, was ausgedruckt an der Wand hängt.
 *
 * Geprüft wird vor allem, was **nicht** gemeldet wird: Ein eigener Satz, eine
 * Aktionsstrecke und ein Bund aus zwei Namen bleiben unangetastet. Diese drei
 * Ausnahmen sind der ganze Unterschied zwischen einer Reparatur und einem
 * Datenverlust.
 */

const LISTE: Sortimentsliste = {
  abteilungen: [
    {
      name: 'Backwaren',
      warengruppen: [{ name: 'Aufbackware', sortimente: ['Laugen', 'Brötchen'] }],
    },
    {
      name: 'Trocken',
      warengruppen: [{ name: 'Knabber', sortimente: ['Nüsse', 'Trockenobst'] }],
    },
  ],
};

const AUFBACKWARE = P('Backwaren', 'Aufbackware');

/** Eine Planung aus einem einzigen Abschnitt. */
function mitAbschnitt(teil: Partial<Warengruppenabschnitt>): Projekt {
  const el = element('x', AUFBACKWARE);
  return {
    elemente: [{ ...el, warengruppenUnten: [{ von: 0, bis: 300, text: 'x', ...teil }] }],
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
  } as Projekt;
}

describe('Beschriftungen, die von der Liste abweichen', () => {
  it('meldet den alten Namen, wenn der Pfad noch stimmt', () => {
    const gefunden = veralteteBeschriftungen(
      mitAbschnitt({ text: 'Aufbackware Brötchen', pfad: AUFBACKWARE }),
      LISTE,
    );
    expect(gefunden).toEqual([
      { pfad: AUFBACKWARE, alt: 'Aufbackware Brötchen', neu: 'Aufbackware', meter: 300 },
    ]);
  });

  it('meldet nichts, wenn der Name schon stimmt', () => {
    expect(
      veralteteBeschriftungen(mitAbschnitt({ text: 'Aufbackware', pfad: AUFBACKWARE }), LISTE),
    ).toEqual([]);
  });

  it('lässt einen eigenen Satz in Ruhe', () => {
    // „Marmorkuchen Aktion" gehört dem Planer. Ohne diese Ausnahme
    // überschriebe der Abgleich seine Beschriftungen.
    expect(
      veralteteBeschriftungen(
        mitAbschnitt({ text: 'Ostergebäck', pfad: AUFBACKWARE, eigenerText: true }),
        LISTE,
      ),
    ).toEqual([]);
  });

  it('lässt eine Aktionsstrecke in Ruhe', () => {
    // Eine Aktion heißt nie wie die Liste – das ist ihr Wesen und kein
    // veralteter Name.
    expect(
      veralteteBeschriftungen(
        mitAbschnitt({ text: 'Ostergebäck', pfad: AUFBACKWARE, aktion: true }),
        LISTE,
      ),
    ).toEqual([]);
  });

  it('lässt einen Bund aus zwei Namen in Ruhe', () => {
    // „Nüsse, Trockenobst" sind zwei Sortimente auf einer Strecke. Anzugleichen
    // hieße, eines davon aus dem Plan zu werfen.
    expect(
      veralteteBeschriftungen(
        mitAbschnitt({ text: 'Nüsse, Trockenobst', pfad: P('Trocken', 'Knabber', 'Nüsse') }),
        LISTE,
      ),
    ).toEqual([]);
  });

  it('meldet einen verwaisten Pfad nicht – dafür gibt es den anderen Bericht', () => {
    expect(
      veralteteBeschriftungen(
        mitAbschnitt({ text: 'Weg', pfad: P('Backwaren', 'Gibtsnichtmehr') }),
        LISTE,
      ),
    ).toEqual([]);
  });

  it('zählt denselben falschen Namen an zwei Möbeln als eine Zeile', () => {
    const eins = element('Aufbackware Brötchen', AUFBACKWARE);
    const zwei = { ...eins, id: 'e2' };
    const projekt = {
      elemente: [eins, zwei],
      ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
    } as Projekt;
    const gefunden = veralteteBeschriftungen(projekt, LISTE);
    expect(gefunden).toHaveLength(1);
    expect(gefunden[0].meter).toBe(600);
  });

  it('sieht auch auf ausgeblendete Ebenen', () => {
    // Ausgeblendet heißt nicht abgebaut. Beim nächsten Einblenden stünde der
    // alte Name wieder da.
    const projekt = {
      elemente: [element('Aufbackware Brötchen', AUFBACKWARE)],
      ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: false, gesperrt: false }],
    } as Projekt;
    expect(veralteteBeschriftungen(projekt, LISTE)).toHaveLength(1);
  });
});

describe('Beschriftungen angleichen', () => {
  const schluessel = beschriftungsschluessel(AUFBACKWARE, 'Aufbackware Brötchen');
  const wahl = (w: Beschriftungsentscheidung) =>
    new Map<string, Beschriftungsentscheidung>([[schluessel, w]]);

  it('schreibt den Namen aus der Liste in den Plan', () => {
    const ergebnis = mitAngeglichenenBeschriftungen(
      mitAbschnitt({ text: 'Aufbackware Brötchen', pfad: AUFBACKWARE }),
      wahl('angleichen'),
    );
    expect(ergebnis?.elemente[0].warengruppenUnten?.[0].text).toBe('Aufbackware');
    expect(ergebnis?.zahl).toBe(1);
  });

  it('merkt sich „so lassen", damit die Zeile nicht wiederkommt', () => {
    const ergebnis = mitAngeglichenenBeschriftungen(
      mitAbschnitt({ text: 'Aufbackware Brötchen', pfad: AUFBACKWARE }),
      wahl('behalten'),
    );
    const strecke = ergebnis?.elemente[0].warengruppenUnten?.[0];
    expect(strecke?.text).toBe('Aufbackware Brötchen');
    expect(strecke?.eigenerText).toBe(true);
    // Und danach meldet der Bericht sie nicht mehr.
    expect(
      veralteteBeschriftungen({ ...mitAbschnitt({}), elemente: ergebnis!.elemente }, LISTE),
    ).toEqual([]);
  });

  it('zählt die Abschnitte und nicht die Zeilen', () => {
    // Eine Zeile kann an zwölf Möbeln stehen. „1 angeglichen" wäre gelogen.
    const eins = element('Aufbackware Brötchen', AUFBACKWARE);
    const projekt = {
      elemente: [eins, { ...eins, id: 'e2' }],
      ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
    } as Projekt;
    expect(mitAngeglichenenBeschriftungen(projekt, wahl('angleichen'))?.zahl).toBe(2);
  });

  it('geht still vorbei, wenn die Zeile nicht mehr da ist', () => {
    // Der Bericht ist eine Momentaufnahme. Wer inzwischen umbenannt hat,
    // bekommt keine falsche Änderung, sondern gar keine.
    expect(
      mitAngeglichenenBeschriftungen(
        mitAbschnitt({ text: 'etwas ganz anderes', pfad: AUFBACKWARE }),
        wahl('angleichen'),
      ),
    ).toBeNull();
  });
});
