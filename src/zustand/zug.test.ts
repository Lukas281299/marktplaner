import { beforeEach, describe, expect, it } from 'vitest';
import { BIBLIOTHEK } from '../daten/bibliothek';
import { neuesProjekt } from '../daten/standardProjekt';
import { mitGruppen } from '../logik/gruppen';
import { istModul, summe } from '../logik/feldaufteilung';
import { usePlanStore } from './planStore';

/**
 * Prüfungen für Feldaufteilung, Kopfgondeln und das Drehen von Gruppen.
 *
 * Der Kern: Ein Zug ist eine Reihe von Feldern, und ein Kopf gehört zum Zug.
 * Was zusammengehört, muss zusammen bleiben – beim Verlängern, beim
 * Verschieben und beim Drehen. Ein Kopf, der nach dem Drehen quer im Gang
 * steht, fällt auf dem Bildschirm kaum auf und im Markt sofort.
 */

const store = () => usePlanStore.getState();

const vorlage = (id: string) => {
  const treffer = BIBLIOTHEK.find((v) => v.id === id);
  if (!treffer) throw new Error(`Vorlage ${id} gibt es nicht`);
  return treffer;
};

/** Legt einen Gondelzug in die Mitte und gibt ihn zurück. */
function legeZug(id = 'wt-zug-1000-6-600', x = 1000, y = 1000) {
  store().fuegeElementHinzu(vorlage(id), x, y);
  const elemente = store().projekt.elemente;
  return elemente[elemente.length - 1];
}

const hole = (id: string) => store().projekt.elemente.find((el) => el.id === id)!;

describe('Feldaufteilung am Zug', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('macht die Breite zur Summe der Felder', () => {
    const zug = legeZug();
    expect(zug.breite).toBe(600);

    store().setzeFelder(zug.id, [100, 100, 100, 100, 100, 125]);
    expect(hole(zug.id).breite).toBeCloseTo(625, 2);
  });

  it('lässt den Anfang des Zugs stehen, wenn er wächst', () => {
    // Ein Feld kommt hinten dran, nicht links und rechts je ein halbes.
    // Sonst wandert ein Zug, den man verlängert, aus seiner Flucht heraus.
    const zug = legeZug();
    const linkeKanteVorher = zug.x - zug.breite / 2;

    store().setzeFelder(zug.id, [100, 100, 100, 100, 100, 100, 100]);
    const neu = hole(zug.id);
    expect(neu.x - neu.breite / 2).toBeCloseTo(linkeKanteVorher, 1);
  });

  it('behält die Reihenfolge der Felder', () => {
    const zug = legeZug();
    store().setzeFelder(zug.id, [125, 100, 100, 100, 100, 100]);
    expect(hole(zug.id).felder).toEqual([125, 100, 100, 100, 100, 100]);
  });
});

describe('Kopfgondeln', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('setzt vor eine 600er Gondel eine A1250', () => {
    // Die Regel aus der Praxis: 2 × 600 + 70 tote Zone = 1270 tief, davor
    // gehört eine 1250er Kopfgondel.
    const zug = legeZug('wt-zug-1000-6-600');
    expect(zug.tiefe).toBe(127);

    store().setzeKopfgondel(zug.id, 'ende', true);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!;
    expect(kopf.breite).toBe(125);
  });

  it('setzt vor eine 500er Gondel eine A1000', () => {
    const zug = legeZug('wt-zug-1000-6-500');
    expect(zug.tiefe).toBe(107);

    store().setzeKopfgondel(zug.id, 'ende', true);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!;
    expect(kopf.breite).toBe(100);
  });

  it('gibt dem Kopf die Tiefe einer Gondelseite', () => {
    // Eine Seite der 127er Gondel ist 60 tief plus 7 tote Zone = 67.
    const zug = legeZug('wt-zug-1000-6-600');
    store().setzeKopfgondel(zug.id, 'ende', true);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!;
    expect(kopf.tiefe).toBeCloseTo(67, 2);
  });

  it('stellt den Kopf quer vor das Ende des Zugs', () => {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    store().setzeKopfgondel(zug.id, 'ende', true);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!;

    // Quer: 90 Grad zum Zug, damit die Breite über die Gondeltiefe läuft.
    expect(kopf.drehung).toBe(90);
    // Und lückenlos davor: halbe Zuglänge plus halbe Kopftiefe.
    expect(kopf.x).toBeCloseTo(1000 + 600 / 2 + 67 / 2, 1);
    expect(kopf.y).toBeCloseTo(1000, 1);
  });

  it('setzt beide Köpfe auf entgegengesetzte Seiten', () => {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    store().setzeKopfgondel(zug.id, 'anfang', true);
    store().setzeKopfgondel(zug.id, 'ende', true);

    const koepfe = store().projekt.elemente.filter((el) => el.kopfVon === zug.id);
    expect(koepfe).toHaveLength(2);
    const xWerte = koepfe.map((k) => k.x).sort((a, b) => a - b);
    expect(xWerte[0]).toBeCloseTo(1000 - 333.5, 1);
    expect(xWerte[1]).toBeCloseTo(1000 + 333.5, 1);
  });

  it('nimmt den Kopf in die Gruppe des Zugs', () => {
    // Nur so wandert und dreht er mit, ohne eigenen Mechanismus.
    const zug = legeZug();
    store().setzeKopfgondel(zug.id, 'ende', true);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!;
    expect(kopf.gruppeId).toBeTruthy();
    expect(hole(zug.id).gruppeId).toBe(kopf.gruppeId);
  });

  it('entfernt den Kopf wieder', () => {
    const zug = legeZug();
    store().setzeKopfgondel(zug.id, 'ende', true);
    expect(store().projekt.elemente.filter((el) => el.kopfVon === zug.id)).toHaveLength(1);

    store().setzeKopfgondel(zug.id, 'ende', false);
    expect(store().projekt.elemente.filter((el) => el.kopfVon === zug.id)).toHaveLength(0);
    expect(hole(zug.id).kopfgondeln?.ende).toBeUndefined();
  });

  it('legt keinen zweiten Kopf auf dieselbe Seite', () => {
    const zug = legeZug();
    store().setzeKopfgondel(zug.id, 'ende', true);
    store().setzeKopfgondel(zug.id, 'ende', true);
    expect(store().projekt.elemente.filter((el) => el.kopfVon === zug.id)).toHaveLength(1);
  });

  it('rückt den Kopf nach, wenn der Zug länger wird', () => {
    // Sonst stünde der Kopf nach dem Verlängern mitten im Zug.
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    store().setzeKopfgondel(zug.id, 'ende', true);
    const vorher = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!.x;

    store().setzeFelder(zug.id, [100, 100, 100, 100, 100, 100, 100]);
    const neu = hole(zug.id);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!;

    expect(kopf.x).toBeGreaterThan(vorher);
    expect(kopf.x).toBeCloseTo(neu.x + neu.breite / 2 + kopf.tiefe / 2, 1);
  });

  it('bietet vor einem Wandregal keine Kopfgondel an', () => {
    // Ein einseitiges Regal steht an der Wand und hat keinen freien Kopf.
    const wand = legeZug('wt-wand-1250-600-1800');
    store().setzeKopfgondel(wand.id, 'ende', true);
    expect(store().projekt.elemente.filter((el) => el.kopfVon === wand.id)).toHaveLength(0);
  });
});

describe('Drehen', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('dreht ein einzelnes Element um sich selbst', () => {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    store().waehleAus([zug.id]);
    store().dreheAuswahl(90);

    const neu = hole(zug.id);
    expect(neu.drehung).toBe(90);
    expect(neu.x).toBeCloseTo(1000, 1);
    expect(neu.y).toBeCloseTo(1000, 1);
  });

  it('dreht mehrere Elemente gemeinsam um ihre Mitte', () => {
    // Vorher drehte sich jedes Regal um sich selbst: Ein Zug aus drei
    // Feldern fiel dabei zu einem Haufen übereinanderstehender Felder
    // zusammen, weil keines seinen Platz verließ.
    const a = legeZug('wt-gondel-1000-600-1800', 900, 1000);
    const b = legeZug('wt-gondel-1000-600-1800', 1000, 1000);
    const c = legeZug('wt-gondel-1000-600-1800', 1100, 1000);

    store().waehleAus([a.id, b.id, c.id]);
    store().dreheAuswahl(90);

    // Die Mitte der drei liegt bei x = 1000. Um sie herum gedreht liegen
    // sie danach übereinander statt nebeneinander – der Zug steht hochkant.
    expect(hole(b.id).x).toBeCloseTo(1000, 1);
    expect(hole(b.id).y).toBeCloseTo(1000, 1);
    expect(hole(a.id).x).toBeCloseTo(1000, 1);
    expect(hole(a.id).y).toBeCloseTo(900, 1);
    expect(hole(c.id).x).toBeCloseTo(1000, 1);
    expect(hole(c.id).y).toBeCloseTo(1100, 1);
    // Und jedes einzelne steht quer.
    for (const el of [a, b, c]) expect(hole(el.id).drehung).toBe(90);
  });

  it('nimmt die Kopfgondel beim Drehen mit', () => {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    store().setzeKopfgondel(zug.id, 'ende', true);
    const kopfId = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!.id;

    // So wählt auch die Zeichenfläche aus: Ein Klick auf ein Gruppenmitglied
    // nimmt die ganze Gruppe. Die Erweiterung sitzt dort und nicht im
    // Speicher, weil Alt+Klick bewusst ein einzelnes Regal herausgreift.
    store().waehleAus(mitGruppen(store().projekt.elemente, [zug.id]));
    store().dreheAuswahl(90);

    const gedreht = hole(zug.id);
    const kopf = hole(kopfId);
    expect(gedreht.drehung).toBe(90);

    // Geprüft wird die Lage **zueinander**, nicht die absolute: Eine starre
    // Drehung um die gemeinsame Mitte verschiebt beide, lässt ihr Verhältnis
    // aber unangetastet. Genau das ist der Punkt.
    const abstand = Math.hypot(kopf.x - gedreht.x, kopf.y - gedreht.y);
    expect(abstand).toBeCloseTo(600 / 2 + 67 / 2, 1);
    // Der Kopf liegt jetzt unterhalb des Zugs, nicht mehr rechts daneben.
    expect(kopf.x).toBeCloseTo(gedreht.x, 1);
    expect(kopf.y).toBeGreaterThan(gedreht.y);
  });

  it('lässt beim Drehen einer Gruppe die Abstände unangetastet', () => {
    // Der eigentliche Wert einer starren Drehung: Was zusammensteht, steht
    // hinterher genauso zusammen. Vorher stimmte das nicht – die Elemente
    // blieben liegen und drehten sich nur in sich.
    const a = legeZug('wt-gondel-1000-600-1800', 900, 1000);
    const b = legeZug('wt-gondel-1000-600-1800', 1000, 1000);
    const vorher = Math.hypot(b.x - a.x, b.y - a.y);

    store().waehleAus([a.id, b.id]);
    store().dreheAuswahl(37);

    const na = hole(a.id);
    const nb = hole(b.id);
    expect(Math.hypot(nb.x - na.x, nb.y - na.y)).toBeCloseTo(vorher, 1);
  });
});

describe('Auswahl nach dem Setzen eines Kopfs', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  it('nimmt den frisch gesetzten Kopf in die Auswahl', () => {
    // Sonst ließe ein Druck auf „drehen" direkt danach den Kopf stehen:
    // Die Zeichenfläche erweitert die Auswahl beim Klick um die Gruppe,
    // aber hier ist die Gruppe gerade erst entstanden.
    const zug = legeZug();
    expect(store().auswahl).toEqual([zug.id]);

    store().setzeKopfgondel(zug.id, 'ende', true);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!;
    expect(store().auswahl).toContain(zug.id);
    expect(store().auswahl).toContain(kopf.id);
  });

  it('nimmt den entfernten Kopf wieder aus der Auswahl', () => {
    const zug = legeZug();
    store().setzeKopfgondel(zug.id, 'ende', true);
    const kopfId = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!.id;

    store().setzeKopfgondel(zug.id, 'ende', false);
    expect(store().auswahl).not.toContain(kopfId);
  });
});

describe('Abrunden beim Ziehen', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  /** Zieht ein Element auf eine Breite, so wie es der Anfasser tut. */
  function ziehe(el: { id: string; x: number; y: number; tiefe: number; drehung: number }, breite: number) {
    // Rechter Anfasser: Die linke Kante bleibt stehen, die Mitte wandert.
    const links = el.x - (store().projekt.elemente.find((e) => e.id === el.id)!.breite) / 2;
    store().setzeGeometrien([
      { id: el.id, x: links + breite / 2, y: el.y, breite, tiefe: el.tiefe, drehung: el.drehung },
    ]);
  }

  it('rundet einen Regalzug auf ein baubares Maß ab', () => {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    ziehe(zug, 637);
    const neu = hole(zug.id);
    expect(neu.breite).toBeLessThanOrEqual(637);
    expect(neu.breite).toBeCloseTo(633.3, 1);
  });

  it('lässt die Kante stehen, an der nicht gezogen wurde', () => {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    const linksVorher = zug.x - zug.breite / 2;
    ziehe(zug, 637);
    const neu = hole(zug.id);
    expect(neu.x - neu.breite / 2).toBeCloseTo(linksVorher, 1);
  });

  it('baut daraus eine gültige Feldliste', () => {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    ziehe(zug, 637);
    const neu = hole(zug.id);
    expect(neu.felder).toBeTruthy();
    expect(neu.felder!.every((f) => istModul(f))).toBe(true);
    expect(summe(neu.felder!)).toBeCloseTo(neu.breite, 1);
  });

  it('lässt ein Maß in Ruhe, das es schon gibt', () => {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    ziehe(zug, 625);
    expect(hole(zug.id).breite).toBeCloseTo(625, 2);
  });

  it('rückt die Kopfgondel nach dem Ziehen nach', () => {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    store().setzeKopfgondel(zug.id, 'ende', true);
    ziehe(zug, 637);

    const neu = hole(zug.id);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === zug.id)!;
    expect(kopf.x).toBeCloseTo(neu.x + neu.breite / 2 + kopf.tiefe / 2, 1);
  });

  it('lässt alles außer Regalen frei', () => {
    // Ausdrückliche Ansage: nur die normalen Regale. Eine Freihand-Fläche
    // behält jedes Maß, das man ihr gibt.
    for (const vorlagenId of ['regal-frei', 'regal-gondel-frei']) {
      const el = legeZug(vorlagenId, 1000, 1000);
      ziehe(el, 637);
      expect(hole(el.id).breite).toBeCloseTo(637, 1);
    }
  });
});

describe('Der Kopf bleibt am Zug', () => {
  beforeEach(() => {
    usePlanStore.getState().setzeProjekt(neuesProjekt());
  });

  /** Abstand und Winkel zwischen Zug und seinem Kopf. */
  function verhaeltnis(zugId: string) {
    const zug = hole(zugId);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === zugId)!;
    return {
      abstand: Math.hypot(kopf.x - zug.x, kopf.y - zug.y),
      winkel: kopf.drehung,
      zugWinkel: zug.drehung,
    };
  }

  /** Ein Zug mit krummer Länge – dort tut jedes Runden weh. */
  function krummerZug() {
    const zug = legeZug('wt-zug-1000-6-600', 1000, 1000);
    store().setzeFelder(zug.id, [133.3, 133.3, 133.3, 125, 100]);
    store().setzeKopfgondel(zug.id, 'ende', true);
    return zug.id;
  }

  it('bleibt beim Verschieben des Zugs am Platz', () => {
    const id = krummerZug();
    const vorher = verhaeltnis(id);
    const zug = hole(id);

    // So verschiebt die Zeichenfläche: gleiche Verschiebung für alle.
    const ids = mitGruppen(store().projekt.elemente, [id]);
    store().setzePositionen(
      ids.map((elId) => {
        const el = hole(elId);
        return { id: elId, x: el.x + 37.3, y: el.y - 12.7 };
      }),
    );

    expect(hole(id).x).toBeCloseTo(zug.x + 37.3, 2);
    expect(verhaeltnis(id).abstand).toBeCloseTo(vorher.abstand, 3);
  });

  it('folgt auch, wenn nur der Zug bewegt wird', () => {
    // Der eigentliche Ausbruch: Wird der Zug ohne seinen Kopf verschoben –
    // per Alt-Klick, per Ausrichten, per Tastatur –, blieb der Kopf stehen.
    const id = krummerZug();
    const vorher = verhaeltnis(id);
    const zug = hole(id);

    store().setzePositionen([{ id, x: zug.x + 200, y: zug.y + 150 }]);

    const nachher = verhaeltnis(id);
    expect(nachher.abstand).toBeCloseTo(vorher.abstand, 3);
    const kopf = store().projekt.elemente.find((el) => el.kopfVon === id)!;
    expect(kopf.x).toBeCloseTo(zug.x + 200 + hole(id).breite / 2 + kopf.tiefe / 2, 2);
  });

  it('folgt der Tastatur', () => {
    const id = krummerZug();
    const vorher = verhaeltnis(id);
    store().waehleAus([id]);
    store().verschiebeAuswahl(25, -40);
    expect(verhaeltnis(id).abstand).toBeCloseTo(vorher.abstand, 3);
  });

  it('folgt dem Ausrichten', () => {
    const id = krummerZug();
    const vorher = verhaeltnis(id);
    // Ein zweites Möbel dazu, sonst richtet sich nichts aus.
    const anderes = legeZug('wt-gondel-1000-600-1800', 400, 400);
    store().waehleAus([id, anderes.id]);
    store().richteAus('oben');
    expect(verhaeltnis(id).abstand).toBeCloseTo(vorher.abstand, 3);
  });

  it('hält den Abstand auch nach vielen Verschiebungen', () => {
    // Ein Fehler von Zehntelmillimetern je Zug summiert sich sonst zu einer
    // sichtbaren Lücke – genau so fällt so etwas im Alltag auf.
    const id = krummerZug();
    const vorher = verhaeltnis(id);
    for (let i = 0; i < 50; i++) {
      const zug = hole(id);
      store().setzePositionen([{ id, x: zug.x + 0.7, y: zug.y + 0.3 }]);
    }
    expect(verhaeltnis(id).abstand).toBeCloseTo(vorher.abstand, 3);
  });
});
