import { describe, expect, it } from 'vitest';
import {
  auslagenAnteil,
  feldauslagen,
  frontfaktor,
  kistenAnteil,
  moebelauslagen,
  TK_FACH,
  TK_TOTZONE,
  TRUHE_AUSLAGEN,
} from './auslagen';
import type { PlanElement, Regalfeld } from '../typen/modell';
import type { Streckenmeter as Strecke } from './warengruppenmeter';

/**
 * Prüfungen für die Auslagen je laufendem Meter.
 *
 * Die Zahl, mit der aus laufenden Metern tatsächliche werden. Was hier
 * danebengeht, geht in jeder Zeile der Auswertung daneben – und zwar so,
 * dass es plausibel aussieht.
 */

function element(zusatz: Partial<PlanElement> = {}): PlanElement {
  return {
    id: 'el1',
    vorlageId: 'wt100',
    ebeneId: 'einrichtung',
    name: 'Zug',
    beschriftung: 'Zug',
    kategorie: 'regale',
    form: 'wt100',
    x: 0,
    y: 0,
    breite: 250,
    tiefe: 70,
    hoehe: 220,
    drehung: 0,
    farbe: '#cccccc',
    gesperrt: false,
    reihenfolge: 1,
    beschriftungSichtbar: true,
    schriftgroesse: 12,
    ...zusatz,
  } as PlanElement;
}

function strecke(el: PlanElement, von: number, bis: number): Strecke {
  return { name: 'Kaffee', laenge: bis - von, element: el, seite: 'unten', von, bis };
}

describe('Die Zahl am Feld', () => {
  it('nimmt die Böden, wie sie eingetragen sind', () => {
    expect(feldauslagen({ breite: 125, boeden: 5 })).toBe(5);
  });

  it('zählt den Unterbau als eine weitere Auslage', () => {
    // Egal was unten drunter steht – es trägt Ware, also ist es eine Auslage.
    expect(feldauslagen({ breite: 125, boeden: 5, unterbau: { art: 'euro' } })).toBe(6);
    expect(feldauslagen({ breite: 125, boeden: 0, unterbau: { art: 'euro' } })).toBe(1);
  });

  it('lässt ein leeres Feld bei null', () => {
    // Die Säule steht, aber es hängt nichts darin. Das ist keine fehlende
    // Angabe, sondern eine bekannte Null.
    expect(feldauslagen({ breite: 125, leer: true, boeden: 5 })).toBe(0);
  });

  it('sagt nichts, wo nichts steht', () => {
    expect(feldauslagen({ breite: 125 })).toBeUndefined();
  });

  it('greift auf die Vorgabe des Möbels zurück', () => {
    expect(feldauslagen({ breite: 125 }, 4)).toBe(4);
    // Die Zahl am Feld geht der Vorgabe vor – der Katalog kennt die Bauart,
    // aber nicht den Markt.
    expect(feldauslagen({ breite: 125, boeden: 3 }, 4)).toBe(3);
  });
});

describe('Was ein Möbel mitbringt', () => {
  it('rechnet die Truhe aus Auslage und toter Zone', () => {
    // 85 cm am Stück, gegen ein Schrankfach von 30,6 cm minus 4 cm Totzone.
    expect(TK_FACH).toBeCloseTo(30.6, 5);
    expect(TRUHE_AUSLAGEN).toBe(3.2);
    expect(85 / (TK_FACH - TK_TOTZONE)).toBeCloseTo(3.195, 2);
    expect(moebelauslagen(element({ form: 'tkTruhe', kategorie: 'tiefkuehlung' }))).toBe(3.2);
  });

  it('gibt der beidseitigen Truhe das Doppelte – über die zweite Seite', () => {
    // Verdoppelt wird nicht hier, sondern dadurch, dass die Auswertung beide
    // Seiten einzeln durchläuft. Sonst zählte eine Insel vierfach.
    const el = element({ form: 'tkTruhe', kategorie: 'tiefkuehlung', beidseitig: true });
    expect(moebelauslagen(el)).toBe(3.2);
  });

  it('unterscheidet die beiden Schrankhöhen', () => {
    const niedrig = element({ form: 'tkSchrank', kategorie: 'tiefkuehlung', hoehe: 201 });
    const hoch = element({ form: 'tkSchrank', kategorie: 'tiefkuehlung', hoehe: 221 });
    expect(moebelauslagen(niedrig)).toBe(5);
    expect(moebelauslagen(hoch)).toBe(6);
  });

  it('legt beim Kombigerät Wanne und Schrank zusammen', () => {
    const niedrig = element({ form: 'tkKombi', kategorie: 'tiefkuehlung', hoehe: 209.8 });
    const hoch = element({ form: 'tkKombi', kategorie: 'tiefkuehlung', hoehe: 229.8 });
    // Wanne wie eine Truhenseite, darüber der Schrankteil in Fächern.
    expect(moebelauslagen(niedrig)).toBe(6);
    expect(moebelauslagen(hoch)).toBe(6.6);
    // Das hohe Gerät muss mehr tragen als das niedrige – sonst wäre die
    // zusätzliche Höhe im Plan ohne Wirkung.
    expect(moebelauslagen(hoch)!).toBeGreaterThan(moebelauslagen(niedrig)!);
  });

  it('kennt die Theken und den BakeOff-Turm', () => {
    expect(moebelauslagen(element({ form: 'blinkSelf', kategorie: 'bedienung' }))).toBe(1);
    expect(moebelauslagen(element({ form: 'blinkSv', kategorie: 'bedienung' }))).toBe(3);
    expect(moebelauslagen(element({ form: 'bakeoff', kategorie: 'backwaren' }))).toBe(4);
  });

  it('nimmt beim Obstmöbel die Auslagen, die am Möbel stehen', () => {
    const el = element({ form: 'vitable', kategorie: 'obstgemuese', auslagen: 3 });
    expect(moebelauslagen(el)).toBe(3);
  });

  it('zählt beim Getränkegestell die Kisten der vorderen Reihe', () => {
    // Eine Kiste misst 40 × 30 cm. Längs gestellt passen 2,5 auf den
    // laufenden Meter, quer 3,33 – genau der Unterschied, um den es beim
    // Einräumen geht.
    const laengs = element({
      form: 'getraenkegestell',
      kategorie: 'getraenke',
      beidseitig: true,
      kisten: { lage: 'laengs', reihen: 2 },
    });
    expect(moebelauslagen(laengs, 'unten')).toBe(2.5);

    const quer = element({
      form: 'getraenkegestell',
      kategorie: 'getraenke',
      beidseitig: true,
      kisten: { lage: 'quer', reihen: 2 },
    });
    expect(moebelauslagen(quer, 'unten')).toBeCloseTo(10 / 3, 6);
  });

  it('lässt die Reihen die Facingzahl nicht verfälschen', () => {
    // Ein Facing ist, was der Kunde sieht; was dahintersteht, ist Nachschub.
    // Wie tief gestellt wird, ist eine eigene Kennzahl.
    const flach = element({
      form: 'getraenkegestell',
      kategorie: 'getraenke',
      kisten: { lage: 'laengs', reihen: 1 },
    });
    const tief = element({
      form: 'getraenkegestell',
      kategorie: 'getraenke',
      kisten: { lage: 'laengs', reihen: 4 },
    });
    expect(moebelauslagen(tief, 'unten')).toBe(moebelauslagen(flach, 'unten'));
  });

  it('nimmt je Seite die Lage dieser Seite', () => {
    const gestell = element({
      form: 'getraenkegestell',
      kategorie: 'getraenke',
      beidseitig: true,
      kisten: { lage: 'laengs', reihen: 3, rueckseite: { lage: 'quer', reihen: 1 } },
    });
    const beide = [
      moebelauslagen(gestell, 'unten')!,
      moebelauslagen(gestell, 'oben')!,
    ].sort((a, b) => a - b);
    expect(beide[0]).toBe(2.5);
    expect(beide[1]).toBeCloseTo(10 / 3, 6);
  });

  it('gibt einem einseitigen Gestell hinten nichts', () => {
    const gestell = element({
      form: 'getraenkegestell',
      kategorie: 'getraenke',
      beidseitig: true,
      kisten: { lage: 'laengs', reihen: 2, einseitig: true },
    });
    // An der Wand steht nichts dahinter, und null ist hier eine Aussage.
    expect(moebelauslagen(gestell, 'unten')).toBe(0);
    expect(moebelauslagen(gestell, 'oben')).toBe(2.5);
  });

  it('lässt die grünen Kisten aus der Meterspalte heraus', () => {
    // Wie viele Kisten einem Meter entsprechen, hängt an ihrer Lage und an
    // der Tiefe der Auflage – es gibt keinen einzelnen Umrechnungskurs. Eine
    // Spalte, die Kisten und Meter addierte, ergäbe eine Zahl ohne Bedeutung.
    const tisch = element({
      form: 'vitable',
      kategorie: 'obstgemuese',
      breite: 125,
      ifkoKisten: 7,
      auslagen: 2,
    });
    expect(moebelauslagen(tisch)).toBe(2);
  });

  it('führt die Kisten als eigene Zahl mit', () => {
    // Die Zahl gilt für das ganze Möbel; eine Gondel wird je Seite durchlaufen.
    const wand = element({ form: 'vitable', kategorie: 'obstgemuese', breite: 125, ifkoKisten: 7 });
    const gondel = element({
      form: 'vitable',
      kategorie: 'obstgemuese',
      breite: 125,
      ifkoKisten: 14,
      beidseitig: true,
    });
    const auf = (el: PlanElement) =>
      kistenAnteil({ name: 'Äpfel', laenge: 125, element: el, seite: 'unten', von: 0, bis: 125 });
    expect(auf(wand)).toBeCloseTo(7, 6);
    expect(auf(gondel)).toBeCloseTo(7, 6);
  });

  it('zählt auch am Kartoffelregal die Kisten', () => {
    // Es kommt aus der Kategorie „Regale", steht aber in der Obstabteilung.
    // Die Abteilung entscheidet die Warengruppe, nicht der Katalog.
    const regal = element({ kategorie: 'regale', breite: 100, ifkoKisten: 6 });
    const anteil = kistenAnteil({
      name: 'Kartoffeln',
      laenge: 100,
      element: regal,
      seite: 'unten',
      von: 0,
      bis: 100,
    });
    expect(anteil).toBeCloseTo(6, 6);
  });

  it('sagt beim Regal nichts – dort entscheidet der Planer', () => {
    expect(moebelauslagen(element())).toBeUndefined();
  });
});

describe('Die Auslagen einer Strecke', () => {
  const felder = (...f: Regalfeld[]) => element({ felderUnten: f, breite: 250 });

  it('rechnet Feld für Feld und gewichtet mit der Breite', () => {
    // Zwei Felder à 125 cm, fünf und sechs Böden. Über beide gerechnet:
    // 125 · 5 + 125 · 6 = 1375 cm tatsächlich.
    const el = felder({ breite: 125, boeden: 5 }, { breite: 125, boeden: 6 });
    expect(auslagenAnteil(strecke(el, 0, 250))).toEqual({
      tatsaechlich: 1375,
      ohne: 0,
      ohneMassstab: 0,
    });
  });

  it('nimmt nur das Stück, das die Strecke wirklich abdeckt', () => {
    const el = felder({ breite: 125, boeden: 5 }, { breite: 125, boeden: 6 });
    // Von 60 bis 190: 65 cm im ersten Feld, 65 cm im zweiten.
    expect(auslagenAnteil(strecke(el, 60, 190))).toEqual({
      tatsaechlich: 65 * 5 + 65 * 6,
      ohne: 0,
      ohneMassstab: 0,
    });
  });

  it('meldet die Länge, auf der die Zahl fehlt – und rechnet den Rest trotzdem', () => {
    // Eine halb ausgefüllte Strecke ganz zu verlieren wäre schlimmer als
    // eine Zeile, die sagt, wie viel noch offen ist.
    const el = felder({ breite: 125, boeden: 5 }, { breite: 125 });
    expect(auslagenAnteil(strecke(el, 0, 250))).toEqual({
      tatsaechlich: 625,
      ohne: 125,
      ohneMassstab: 0,
    });
  });

  it('rechnet ein leeres Feld als null und nicht als unbekannt', () => {
    const el = felder({ breite: 125, boeden: 5 }, { breite: 125, leer: true });
    expect(auslagenAnteil(strecke(el, 0, 250))).toEqual({
      tatsaechlich: 625,
      ohne: 0,
      ohneMassstab: 0,
    });
  });

  it('füllt fehlende Felder mit der Vorgabe des Möbels', () => {
    const el = element({
      form: 'tkSchrank',
      kategorie: 'tiefkuehlung',
      hoehe: 201,
      breite: 156.2,
      felderUnten: [{ breite: 78.1 }, { breite: 78.1 }],
    });
    const a = auslagenAnteil(strecke(el, 0, 156.2));
    expect(a.ohne).toBe(0);
    expect(a.tatsaechlich).toBeCloseTo(156.2 * 5, 6);
  });

  it('rechnet ein Möbel ohne eigene Feldliste über seine Grundeinteilung', () => {
    // Eine Truhe hat keine Felder, die man einzeln bestückt – sie zählt am
    // Stück.
    const el = element({ form: 'tkTruhe', kategorie: 'tiefkuehlung', breite: 250 });
    const a = auslagenAnteil(strecke(el, 0, 250));
    expect(a.ohne).toBe(0);
    expect(a.tatsaechlich).toBeCloseTo(250 * 3.2, 6);
  });

  it('lässt einen Überhang nicht verschwinden', () => {
    // Wer die Breite von Hand eintippt, hinterlässt einen Abschnitt, der
    // über die Felder hinausragt. Diese Meter stehen im Plan.
    const el = felder({ breite: 100, boeden: 5 });
    const a = auslagenAnteil({ ...strecke(el, 0, 250), laenge: 250 });
    expect(a.tatsaechlich).toBe(500);
    expect(a.ohne).toBe(150);
  });
});

describe('Abteilungen ohne tatsächliche Meter', () => {
  const strecke2 = (el: PlanElement, pfad?: string) => ({
    name: 'x',
    pfad,
    laenge: 100,
    element: el,
    seite: 'unten' as const,
    von: 0,
    bis: 100,
  });

  it('entscheidet an der Abteilung und nicht am Möbel', () => {
    // Ein Regalmöbel in der Gastronomie ist trotzdem keines, an dem man
    // Böden zählt – und ein Blumentrog kann überall stehen.
    const regal = element({ breite: 100, felderUnten: [{ breite: 100 }] });
    const a = auslagenAnteil(strecke2(regal, 'Centeria › Restaurant'));
    expect(a.ohneMassstab).toBe(100);
    expect(a.ohne).toBe(0);
  });

  it('mahnt in einer normalen Abteilung weiter an', () => {
    const regal = element({ breite: 100, felderUnten: [{ breite: 100 }] });
    const a = auslagenAnteil(strecke2(regal, 'Molkereiprodukte › Käse SB › Feta'));
    expect(a.ohne).toBe(100);
    expect(a.ohneMassstab).toBe(0);
  });

  it('nimmt ohne Pfad die Möbelkategorie', () => {
    // Alte Planungen und frei getippte Namen: Beim Blumenmöbel greift die
    // Kategorie, weil dort eigene Möbel stehen.
    const trog = element({ form: 'blumentrog', kategorie: 'blumen', breite: 100 });
    expect(auslagenAnteil(strecke2(trog)).ohneMassstab).toBe(100);
  });
});

describe('Blumen zählen nur laufend', () => {
  it('mahnt keine Bodenzahl an', () => {
    // „Hier gibt es kaum klassische Böden, hier reichen mir fürs erste nur
    // laufende Meter." Diese Meter dürfen nicht als Lücke erscheinen.
    const trog = element({ form: 'blumentrog', kategorie: 'blumen', breite: 100 });
    const a = auslagenAnteil({
      name: 'Schnittblumen',
      laenge: 100,
      element: trog,
      seite: 'unten',
      von: 0,
      bis: 100,
    });
    expect(a.ohne).toBe(0);
    expect(a.ohneMassstab).toBe(100);
    expect(a.tatsaechlich).toBe(0);
  });

  it('nimmt eine eingetragene Bodenzahl trotzdem ernst', () => {
    // Die Leitregel gilt auch hier: Was am Feld steht, gewinnt. Ein
    // Pflanzregal mit drei Böden hat drei.
    const regal = element({
      form: 'blumenregal',
      kategorie: 'blumen',
      breite: 100,
      felderUnten: [{ breite: 100, boeden: 3 }],
    });
    const a = auslagenAnteil({
      name: 'Grünpflanzen',
      laenge: 100,
      element: regal,
      seite: 'unten',
      von: 0,
      bis: 100,
    });
    expect(a.tatsaechlich).toBe(300);
    expect(a.ohneMassstab).toBe(0);
  });
});

describe('Die Front eines Eckstücks', () => {
  it('ist länger als sein Platz am Boden', () => {
    // Ein Stück von 44,25 cm Breite, vorn unter 45° abgeschnitten, zeigt
    // eine Kante von 62,6 cm. Wer mit der Breite rechnet, verliert knapp
    // ein Drittel – an jeder Ecke im Markt.
    const ecke = element({
      form: 'bakeoffEcke',
      kategorie: 'backwaren',
      breite: 44.25,
      tiefe: 88.5,
      felderUnten: [{ breite: 44.25, boeden: 4 }],
    });
    expect(frontfaktor(ecke)).toBeCloseTo(Math.SQRT2, 6);
    const a = auslagenAnteil({
      name: 'Brot',
      laenge: 44.25,
      element: ecke,
      seite: 'unten',
      von: 0,
      bis: 44.25,
    });
    expect(a.tatsaechlich).toBeCloseTo(44.25 * 4 * Math.SQRT2, 4);
  });

  it('lässt jedes gerade Möbel unangetastet', () => {
    // Sonst verschöbe sich jede bestehende Zahl.
    expect(frontfaktor(element({}))).toBe(1);
    expect(frontfaktor(element({ form: 'tkTruhe', kategorie: 'tiefkuehlung' }))).toBe(1);
  });
});

describe('Was der Durchgang gefunden hat', () => {
  it('verteilt die Kisten über die Feldkette der Seite', () => {
    // Die Breite eines Möbels ist die *längere* seiner Seiten. Wer über sie
    // verteilt, verliert an der kürzeren genau den Unterschied.
    const gondel = element({
      kategorie: 'obstgemuese',
      breite: 500,
      beidseitig: true,
      ifkoKisten: 40,
      felderUnten: [{ breite: 500 }],
      felderOben: [{ breite: 400 }],
    });
    const auf = (seite: 'unten' | 'oben', bis: number) =>
      kistenAnteil({ name: 'x', laenge: bis, element: gondel, seite, von: 0, bis });

    // Je Seite die Hälfte der 40 Kisten – jede Seite über ihre eigene Länge.
    expect(auf('unten', 500)).toBeCloseTo(20, 6);
    expect(auf('oben', 400)).toBeCloseTo(20, 6);
  });

  it('lässt am Preisgestell keine Bodenzahl über die Facings gewinnen', () => {
    // An einem Gestell gibt es keine Böden. Eine versehentlich eingetragene
    // Zahl darf die Lage der Kisten nicht aus der Rechnung werfen.
    const gestell = element({
      form: 'getraenkegestell',
      kategorie: 'getraenke',
      breite: 200,
      kisten: { lage: 'laengs', reihen: 2 },
      felderUnten: [{ breite: 200, boeden: 5, unterbau: { art: 'euro' } }],
    });
    const a = auslagenAnteil({
      name: 'Bier MW',
      laenge: 200,
      element: gestell,
      seite: 'unten',
      von: 0,
      bis: 200,
    });
    // 2,5 Facings je laufendem Meter über 2,00 m – nicht 5 aus der Bodenzahl
    // und nicht 6 mit dem Unterbau obendrauf.
    expect(a.tatsaechlich).toBe(500);
    expect(a.ohne).toBe(0);
  });
});
