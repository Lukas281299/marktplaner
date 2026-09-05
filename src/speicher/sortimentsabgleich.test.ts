import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Projekt } from '../typen/modell';

/**
 * Prüfungen für das Nachziehen über **alle** Planungen.
 *
 * Die Sortimentsliste gehört zum Gerät und gilt für jeden Markt. Wer sie
 * ändert, während Zierenberg offen ist, ändert sie damit auch für Baunatal –
 * nur merkte Baunatal das früher nicht: Seine Strecken behielten den alten
 * Pfad, bis jemand die Planung zufällig öffnete.
 *
 * Hier wird in fremde Planungen geschrieben, und zwar ohne dass jemand
 * zusieht. Deshalb ist jeder Fall einzeln festgehalten – vor allem die drei,
 * in denen **nicht** geschrieben werden darf.
 */

const ablage = new Map<string, Projekt>();
const geschrieben: string[] = [];

vi.mock('./projektArchiv', () => ({
  listeProjekte: async () => [...ablage.values()].map((p) => ({ id: p.id, name: p.name })),
  ladeProjekt: async (id: string) => ablage.get(id),
  speichereProjekt: async (projekt: Projekt) => {
    geschrieben.push(projekt.id);
    ablage.set(projekt.id, projekt);
  },
}));

const { benenneInAllenPlanungenUm, metersAmEintrag } = await import('./sortimentsabgleich');

const MILCH = 'Molkerei › Milch';
const VOLLMILCH = `${MILCH} › Vollmilch`;

/** Eine Planung mit einer einzigen beschrifteten Strecke. */
function planung(id: string, text: string, pfad?: string, von = 0, bis = 300): Projekt {
  return {
    id,
    name: id,
    elemente: [
      {
        id: `${id}-e1`,
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
        felderUnten: [{ breite: 300, boeden: 5 }],
        warengruppenUnten: [{ von, bis, text, pfad }],
      },
    ],
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
  } as unknown as Projekt;
}

const strecke = (id: string) => ablage.get(id)!.elemente[0].warengruppenUnten![0];

beforeEach(() => {
  ablage.clear();
  geschrieben.length = 0;
});

describe('Umbenennen erreicht alle Planungen', () => {
  it('zieht eine gespeicherte Planung nach', async () => {
    ablage.set('baunatal', planung('baunatal', 'Vollmilch', VOLLMILCH));
    const zahl = await benenneInAllenPlanungenUm(
      VOLLMILCH,
      `${MILCH} › Frischmilch`,
      false,
      () => 'zierenberg',
    );
    expect(zahl).toBe(1);
    expect(strecke('baunatal').pfad).toBe(`${MILCH} › Frischmilch`);
    expect(strecke('baunatal').text).toBe('Frischmilch');
  });

  it('lässt die geöffnete Planung in Ruhe', async () => {
    // Sie kann ungespeicherte Änderungen tragen; eine Fassung aus der
    // Datenbank überschriebe sie. Um sie kümmert sich der Datenspeicher.
    ablage.set('zierenberg', planung('zierenberg', 'Vollmilch', VOLLMILCH));
    const zahl = await benenneInAllenPlanungenUm(
      VOLLMILCH,
      `${MILCH} › Frischmilch`,
      false,
      () => 'zierenberg',
    );
    expect(zahl).toBe(0);
    expect(geschrieben).toEqual([]);
  });

  it('fragt bei jedem Schritt neu, welche Planung offen ist', async () => {
    // Der Lauf geht über die Datenbank, während der Planer weiterarbeitet.
    // Öffnet er mittendrin einen anderen Markt, würde dieser sonst unter ihm
    // weggeschrieben und seine ungespeicherten Änderungen wären fort.
    ablage.set('a', planung('a', 'Vollmilch', VOLLMILCH));
    ablage.set('b', planung('b', 'Vollmilch', VOLLMILCH));
    let offen = 'zierenberg';
    await benenneInAllenPlanungenUm(VOLLMILCH, `${MILCH} › Frischmilch`, false, () => {
      const jetzt = offen;
      offen = 'b'; // Nach der ersten Runde wird „b" geöffnet.
      return jetzt;
    });
    expect(geschrieben).toEqual(['a']);
    expect(strecke('b').pfad).toBe(VOLLMILCH);
  });

  it('schreibt nichts, wo es nichts zu tun gibt', async () => {
    // Sonst bekäme jede Planung bei jedem Umbenennen ein neues
    // Änderungsdatum und liefe durch den Abgleich.
    ablage.set('baunatal', planung('baunatal', 'Käse', 'Molkerei › Käse › Gouda'));
    expect(
      await benenneInAllenPlanungenUm(VOLLMILCH, `${MILCH} › Frischmilch`, false, () => ''),
    ).toBe(0);
    expect(geschrieben).toEqual([]);
  });

  it('geht denselben Weg zurück', async () => {
    // Ein Strg+Z nach dem Umbenennen: Was hier geschrieben wurde, muss auch
    // hier zurückgenommen werden.
    ablage.set('baunatal', planung('baunatal', 'Vollmilch', VOLLMILCH));
    const neu = `${MILCH} › Frischmilch`;
    await benenneInAllenPlanungenUm(VOLLMILCH, neu, false, () => '');
    await benenneInAllenPlanungenUm(neu, VOLLMILCH, false, () => '');
    expect(strecke('baunatal').pfad).toBe(VOLLMILCH);
    expect(strecke('baunatal').text).toBe('Vollmilch');
  });
});

describe('Was an einem Eintrag hängt', () => {
  it('summiert die Meter über alle Planungen', async () => {
    const offen = planung('zierenberg', 'Vollmilch', VOLLMILCH, 0, 250);
    ablage.set('zierenberg', offen);
    ablage.set('baunatal', planung('baunatal', 'Vollmilch', VOLLMILCH, 0, 150));
    expect(await metersAmEintrag(VOLLMILCH, offen)).toEqual({ meter: 400, planungen: 2 });
  });

  it('zählt auch, was unter dem Eintrag hängt', async () => {
    // Wer die Warengruppe „Milch" löscht, verliert auch die Vollmilch.
    const offen = planung('zierenberg', 'Vollmilch', VOLLMILCH, 0, 250);
    ablage.set('zierenberg', offen);
    expect(await metersAmEintrag(MILCH, offen)).toEqual({ meter: 250, planungen: 1 });
  });

  it('meldet nichts, wenn im Markt nichts davon steht', async () => {
    const offen = planung('zierenberg', 'Käse', 'Molkerei › Käse › Gouda');
    ablage.set('zierenberg', offen);
    expect(await metersAmEintrag(VOLLMILCH, offen)).toEqual({ meter: 0, planungen: 0 });
  });
});
