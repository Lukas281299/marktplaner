import { describe, expect, it } from 'vitest';
import {
  balkenlaengeM,
  baueSvgBlatt,
  benutzteKategorien,
  MASSSTAEBE,
  mmJeCm,
  passtAufsBlatt,
  pdfInhalt,
} from './planblatt';
import { planAlsVektor, zoomFuerMassstab } from './planvektor';
import { pdfFarbe, pfadZuPdf, textbreite, textZuPdf, umformungZuPdf } from './pdfVektor';
import type { PlanElement, Projekt } from '../typen/modell';

/**
 * Das Blatt: Maßstab, Schriftfeld, Legende, Maßstabsbalken.
 *
 * Der Maßstab ist hier das Eigentliche. Ein Plan, dessen Maßstab nicht stimmt,
 * ist schlimmer als keiner – man misst mit dem Lineal nach und baut danach.
 */

function element(teil: Partial<PlanElement>): PlanElement {
  return {
    id: 'e1',
    vorlageId: 'v1',
    ebeneId: 'einrichtung',
    name: 'Wandregal',
    kategorie: 'regale',
    x: 500,
    y: 300,
    breite: 125,
    tiefe: 60,
    drehung: 0,
    form: 'rechteck',
    farbe: '#888888',
    beschriftung: 'Wandregal A1250',
    beschriftungSichtbar: true,
    schriftgroesse: 35,
    gesperrt: false,
    reihenfolge: 1,
    ...teil,
  } as PlanElement;
}

function projekt(teil: Partial<Projekt> = {}): Projekt {
  return {
    id: 'p1',
    name: 'Testmarkt',
    version: 19,
    erstelltAm: 0,
    geaendertAm: 0,
    grundflaeche: {
      umriss: [
        { x: 0, y: 0 },
        { x: 2000, y: 0 },
        { x: 2000, y: 1000 },
        { x: 0, y: 1000 },
      ],
      wandstaerke: 30,
    },
    einstellungen: { anzeigeEinheit: 'm' },
    ebenen: [{ id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false }],
    raeume: [],
    verkaufsflaechen: [],
    waende: [],
    oeffnungen: [],
    elemente: [element({})],
    gruppen: [],
    masslinien: [],
    ...teil,
  } as unknown as Projekt;
}

const A3_QUER = { breiteMm: 420, hoeheMm: 297, randMm: 10 };

describe('Maßstab', () => {
  it('rechnet Zentimeter des Marktes in Millimeter Papier um', () => {
    // Bei 1:100 wird aus einem Meter Markt ein Zentimeter Papier.
    expect(mmJeCm(100) * 100).toBe(10);
    expect(mmJeCm(50) * 100).toBe(20);
    expect(mmJeCm(200) * 100).toBe(5);
  });

  it('kennt nur die Maßstäbe, die es im Ladenbau gibt', () => {
    // Ein krummer Maßstab steht auf keinem Bauplan – wer 1:137 wählt, kann
    // auf dem Ausdruck nichts nachmessen.
    expect([...MASSSTAEBE]).toEqual([50, 100, 200, 250, 500]);
  });
});

describe('Passt der Plan aufs Blatt', () => {
  it('sagt Ja, wenn er passt', () => {
    // 20 × 10 m bei 1:100 sind 200 × 100 mm – auf A3 quer reichlich Platz.
    const probe = passtAufsBlatt(planAlsVektor(projekt()), A3_QUER, 100);
    expect(probe.passt).toBe(true);
    expect(probe.brauchtBreiteMm).toBe(200);
    expect(probe.brauchtHoeheMm).toBe(100);
  });

  it('sagt Nein und nennt den Maßstab, der ginge', () => {
    // Das erspart das Durchprobieren, um das es sonst jedes Mal geht.
    const gross = projekt({
      grundflaeche: {
        umriss: [
          { x: 0, y: 0 },
          { x: 8000, y: 0 },
          { x: 8000, y: 4000 },
          { x: 0, y: 4000 },
        ],
        wandstaerke: 30,
      },
    } as Partial<Projekt>);
    const probe = passtAufsBlatt(planAlsVektor(gross), A3_QUER, 100);
    expect(probe.passt).toBe(false);
    // 80 m breit: bei 1:200 wären das 400 mm, frei sind auf A3 quer neben
    // der Legende aber nur 354. Also 1:250.
    expect(probe.empfehlung).toBe(250);
  });

  it('rechnet den Platz der Legende mit ein', () => {
    const mit = passtAufsBlatt(planAlsVektor(projekt()), A3_QUER, 100, true);
    const ohne = passtAufsBlatt(planAlsVektor(projekt()), A3_QUER, 100, false);
    // Der Bedarf ist derselbe, nur der Platz ist verschieden – deshalb wird
    // hier über einen Maßstab geprüft, bei dem es kippt.
    expect(mit.brauchtBreiteMm).toBe(ohne.brauchtBreiteMm);
    expect(passtAufsBlatt(planAlsVektor(projekt()), A3_QUER, 50, false).passt).toBe(true);
    expect(passtAufsBlatt(planAlsVektor(projekt()), A3_QUER, 50, true).passt).toBe(false);
  });
});

describe('Maßstabsbalken', () => {
  it('nimmt eine runde Länge, die etwa ein Sechstel breit ist', () => {
    // Ein Balken über 7,3 m wäre zum Abmessen nutzlos.
    expect(balkenlaengeM(360, 100)).toBe(5);
    expect(balkenlaengeM(360, 200)).toBe(10);
    expect(balkenlaengeM(360, 50)).toBe(2);
  });
});

describe('Legende', () => {
  it('nennt nur Abteilungen, die wirklich im Plan stehen', () => {
    // Eine Legende, die alles aufzählt, erklärt nichts.
    const kategorien = benutzteKategorien(projekt());
    expect(kategorien.map((k) => k.id)).toEqual(['regale']);
  });

  it('bleibt leer, wenn nichts geplant ist', () => {
    expect(benutzteKategorien(projekt({ elemente: [] }))).toEqual([]);
  });
});

describe('SVG-Blatt', () => {
  const svg = baueSvgBlatt({
    projekt: projekt(),
    blatt: A3_QUER,
    massstab: 100,
    schriftfeld: { markt: 'EDEKA Testmarkt', zusatz: 'Planung', datum: '03.09.2026' },
  });

  it('trägt die Papiermaße nach außen', () => {
    // Damit ein Betrachter ohne Nachfrage in der richtigen Größe druckt.
    expect(svg).toContain('width="420mm"');
    expect(svg).toContain('height="297mm"');
    expect(svg).toContain('viewBox="0 0 420 297"');
  });

  it('schreibt den Maßstab ins Schriftfeld', () => {
    expect(svg).toContain('Maßstab 1:100');
    expect(svg).toContain('EDEKA Testmarkt');
  });

  it('enthält den Plan als Pfade, nicht als Bild', () => {
    // Das ist der ganze Punkt: kein `<image>`, keine Bilddaten.
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('data:image');
    expect(svg.match(/<path /g)?.length ?? 0).toBeGreaterThan(2);
  });

  it('beschneidet die Außenwand auf den Gebäudeumriss', () => {
    // Sonst läge die Wand halb außerhalb, und das Außenmaß stimmte nicht mehr.
    expect(svg).toContain('clipPath id="gebaeude"');
    expect(svg).toContain('clip-path="url(#gebaeude)"');
  });

  it('schützt Sonderzeichen im Marktnamen', () => {
    const heikel = baueSvgBlatt({
      projekt: projekt(),
      blatt: A3_QUER,
      massstab: 100,
      schriftfeld: { markt: 'Markt <A> & "B"' },
    });
    expect(heikel).toContain('Markt &lt;A&gt; &amp; &quot;B&quot;');
    expect(heikel).not.toContain('<A>');
  });
});

describe('PDF-Inhalt', () => {
  it('schreibt Zeichenbefehle statt Bilddaten', () => {
    const { inhalt } = pdfInhalt({
      projekt: projekt(),
      blatt: A3_QUER,
      massstab: 100,
      schriftfeld: { markt: 'EDEKA Testmarkt' },
    });
    // m = hin, l = Strecke, f = füllen: die Befehle eines Vektorplans.
    expect(inhalt).toMatch(/\bm\b/);
    expect(inhalt).toMatch(/\bl\b/);
    expect(inhalt).toContain('Maßstab 1:100');
    expect(inhalt).not.toContain('/Bild Do');
  });

  it('meldet die Durchsichtigkeitsstufen, die vorkommen', () => {
    // PDF kann Durchsichtigkeit nicht an der Farbe festmachen; jede Stufe
    // braucht oben im Dokument einen eigenen Eintrag.
    const mitRaum = projekt({
      raeume: [
        {
          id: 'r1',
          name: 'Lager',
          umriss: [
            { x: 100, y: 100 },
            { x: 500, y: 100 },
            { x: 500, y: 400 },
            { x: 100, y: 400 },
          ],
          art: 'lager',
          wandstaerke: 0,
          farbe: '#e8eaed',
          beschriftungSichtbar: true,
          gesperrt: false,
        },
      ],
    } as Partial<Projekt>);
    const { deckkraft } = pdfInhalt({
      projekt: mitRaum,
      blatt: A3_QUER,
      massstab: 100,
      schriftfeld: { markt: 'X' },
    });
    expect(deckkraft).toContain(0.4);
  });
});

describe('PDF-Bausteine', () => {
  it('wandelt Farben in die drei Zahlen, die PDF erwartet', () => {
    expect(pdfFarbe('#ffffff')).toEqual([1, 1, 1]);
    expect(pdfFarbe('#000')).toEqual([0, 0, 0]);
    expect(pdfFarbe('rgba(30,40,52,0.55)')).toEqual([30 / 255, 40 / 255, 52 / 255]);
    expect(pdfFarbe('none')).toBeNull();
    expect(pdfFarbe('kaputt')).toBeNull();
  });

  it('übersetzt einen Pfad in PDF-Befehle', () => {
    expect(pfadZuPdf('M 10 20 L 30 40 Z')).toBe('10 20 m\n30 40 l\nh');
    expect(pfadZuPdf('M 0 0 C 1 2 3 4 5 6')).toBe('0 0 m\n1 2 3 4 5 6 c');
  });

  it('übersetzt Verschieben und Drehen in eine PDF-Matrix', () => {
    expect(umformungZuPdf('translate(100 50)')).toBe('1 0 0 1 100 50 cm');
    const gedreht = umformungZuPdf('translate(100 50) rotate(90 10 5)');
    expect(gedreht).toContain('1 0 0 1 10 5 cm');
    expect(gedreht).toContain('0 1 -1 0 0 0 cm');
    expect(umformungZuPdf(undefined)).toBeNull();
  });

  it('misst Text nach den echten Zeichenbreiten', () => {
    // Über die Zeichenzahl geschätzt säße jede mittige Beschriftung schief:
    // Ein „I" ist ein Viertel so breit wie ein „W".
    expect(textbreite('W', 100)).toBeGreaterThan(textbreite('I', 100) * 3);
    expect(textbreite('', 100)).toBe(0);
    // Umlaute zählen mit, auch wenn sie nicht in der Tabelle stehen.
    expect(textbreite('Kühlregal', 10)).toBeGreaterThan(textbreite('Kuhl', 10));
  });
});

/**
 * Wo ein Text auf dem Blatt sitzt.
 *
 * **Die Seite ist gespiegelt.** Ein Grundriss zählt von oben, PDF von unten;
 * deshalb steht der ganze Plan unter einer Spiegelung, und die Textmatrix hebt
 * sie für die Glyphen wieder auf. Die Folge: Die Oberkante einer Zeile liegt
 * **über** ihrer Grundlinie, auch wenn `y` nach unten wächst.
 *
 * Genau daran ist es lange schiefgegangen — das Vorzeichen war das der
 * ungespiegelten Seite, und jeder Text saß zu hoch: Raumnamen und Maßzahlen um
 * 0,72 Zeilenhöhen, Warengruppen um 1,44. Auf dem Bildschirm und im SVG stand
 * es richtig, im Ausdruck nicht — und der Ausdruck ist das, was an der Wand
 * hängt.
 */
describe('Die Grundlinie im PDF', () => {
  /** Das `f` aus der Textmatrix `a b c d e f Tm` – die Grundlinie. */
  const grundlinieVon = (befehle: string) => {
    const zeile = befehle.split('\n').find((z) => z.endsWith(' Tm'));
    const teile = (zeile ?? '').replace(' Tm', '').split(' ').map(Number);
    return teile[5];
  };

  const text = (grundlinie?: 'top' | 'middle' | 'alphabetic') =>
    grundlinieVon(
      textZuPdf({ text: 'Molkerei', x: 100, y: 200, groesse: 10, anker: 'anfang', grundlinie }),
    );

  it('setzt „alphabetic" genau auf den Punkt', () => {
    expect(text('alphabetic')).toBeCloseTo(200, 5);
  });

  it('setzt „top" darunter – dann liegt die Oberkante auf dem Punkt', () => {
    // Die Glyphen wachsen nach oben: Oberkante = Grundlinie − 0,72 · Größe.
    // Soll die Oberkante bei 200 liegen, gehört die Grundlinie auf 207,2.
    expect(text('top')).toBeCloseTo(207.2, 5);
  });

  it('setzt die Mitte auf halber Höhe darunter', () => {
    expect(text('middle')).toBeCloseTo(203.6, 5);
  });

  it('setzt sie nie über den Punkt – das war der alte Fehler', () => {
    for (const g of ['top', 'middle', 'alphabetic'] as const) {
      expect(text(g)).toBeGreaterThanOrEqual(200);
    }
  });
});

/**
 * Was auf dem Papier noch lesbar ist, hängt am Maßstab.
 *
 * Am Bildschirm heißt lesbar „Höhe × Zoom ≥ 5 Bildpunkte", auf Papier „Höhe ×
 * 10 / Maßstab ≥ 1,5 mm". Der Ersatzzoom der Ausgabe rechnet das eine ins
 * andere um. Er stand lange fest auf 0,33 — das ist genau 1:100, galt aber in
 * jedem Maßstab. Bei 1:50 fielen dadurch Feldnotizen und Meterzahlen aus dem
 * Plan, obwohl sie dort mit über 2 mm gut lesbar wären.
 */
describe('Der Ersatzzoom folgt dem Maßstab', () => {
  it('trifft bei 1:100 den alten festen Wert', () => {
    expect(zoomFuerMassstab(100)).toBeCloseTo(0.333, 2);
  });

  it('lässt bei 1:50 die Feldnotizen durch', () => {
    // Eine Feldnotiz ist 11 cm hoch; lesbar ist sie ab 5 Bildpunkten.
    expect(11 * zoomFuerMassstab(50)).toBeGreaterThan(5);
  });

  it('lässt sie bei 1:200 weg – dort wären es 0,55 mm auf dem Papier', () => {
    expect(11 * zoomFuerMassstab(200)).toBeLessThan(5);
  });

  it('nimmt die Möbelnamen in jeden Maßstab mit', () => {
    // Die Beschriftungsgröße ist eine Bildschirmgröße und wird mit demselben
    // Zoom ins Marktmaß gerechnet. Vorher stand sie als „12 cm" im Blatt und
    // fiel bei 1:100 unter die Grenze von 15 cm – kein Möbel trug mehr seinen
    // Namen.
    for (const massstab of MASSSTAEBE) {
      const marktmass = 12 / zoomFuerMassstab(massstab);
      expect(marktmass).toBeGreaterThanOrEqual((1.5 * massstab) / 10);
    }
  });
});
