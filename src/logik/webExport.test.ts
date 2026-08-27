import { describe, expect, it } from 'vitest';
import { neuesProjekt } from '../daten/standardProjekt';
import { baueBeispielseite, baueWebSvg } from './webExport';
import type { Aufnahme } from './planAufnahme';
import type { Projekt } from '../typen/modell';

/**
 * Prüfungen für den Export in eine fremde Webanwendung.
 *
 * Der Kern des Formats ist eine einzige Zusage: **Ein Punkt im SVG ist ein
 * Zentimeter im Markt.** Stimmt die nicht, sitzen die Kameras der fremden
 * Anwendung daneben – und zwar so, dass es beim Ansehen plausibel aussieht
 * und erst im Markt auffällt. Deshalb wird sie hier zuerst geprüft.
 */

/**
 * Was ein XML-Parser an diesem Text bemängeln würde.
 *
 * Node bringt keinen mit, und für eine einzige Prüfung eine Bibliothek zu
 * holen wäre übertrieben. Geprüft wird das, woran selbstgebautes XML
 * tatsächlich scheitert: nicht geschlossene Tags, falsche Reihenfolge beim
 * Schließen und ein nacktes `&` im Text.
 */
function xmlBeanstandungen(xml: string): string[] {
  const klagen: string[] = [];
  // Ohne Vorspann, Kommentare und CDATA – deren Inhalt gehört nicht dazu.
  const rumpf = xml
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, 'CDATA');

  const stapel: string[] = [];
  const tags = /<\/?([A-Za-z][\w:.-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;
  let treffer: RegExpExecArray | null;
  let letztesEnde = 0;

  while ((treffer = tags.exec(rumpf)) !== null) {
    const [ganz, name, rest] = treffer;
    // Das schließende `/` steckt im Attributteil: Der Ausdruck oben lässt
    // alles bis zum `>` durch, und `/` gehört dazu.
    const leer = rest.trimEnd().endsWith('/');
    const attribute = leer ? rest.trimEnd().slice(0, -1) : rest;

    // Der Text zwischen zwei Tags darf kein nacktes & oder < enthalten.
    const dazwischen = rumpf.slice(letztesEnde, treffer.index);
    if (/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/.test(dazwischen)) {
      klagen.push(`nacktes & vor <${name}>`);
    }
    letztesEnde = treffer.index + ganz.length;

    // Jedes Attribut braucht Anführungszeichen um seinen Wert.
    const ohneWerte = attribute.replace(/"[^"]*"|'[^']*'/g, '""');
    if (/=\s*(?!"")/.test(ohneWerte)) klagen.push(`Attribut ohne Anführungszeichen in <${name}>`);

    if (ganz.startsWith('</')) {
      const offen = stapel.pop();
      if (offen !== name) klagen.push(`</${name}> schließt <${offen ?? 'nichts'}>`);
    } else if (!leer) {
      stapel.push(name);
    }
  }

  if (stapel.length > 0) klagen.push(`nicht geschlossen: ${stapel.join(', ')}`);
  return klagen;
}

function scheinAufnahme(breite: number, hoehe: number, x = 0, y = 0): Aufnahme {
  return {
    bild: {
      width: Math.round(breite),
      height: Math.round(hoehe),
      toDataURL: () => 'data:image/png;base64,AAAA',
    } as unknown as HTMLCanvasElement,
    ausschnitt: { x, y, breite, hoehe },
    punkteJeCm: 1,
  };
}

/** Ein Projekt mit einem beschrifteten Möbel. */
function projektMitMoebel(): Projekt {
  const p = neuesProjekt();
  return {
    ...p,
    name: 'Markt "Süd" & Co',
    elemente: [
      {
        id: 'el-1',
        vorlageId: 'regal-frei',
        ebeneId: p.ebenen[0].id,
        name: 'Molkerei',
        kategorie: 'kuehlung',
        x: 1234.6,
        y: 800.4,
        breite: 375,
        tiefe: 67,
        drehung: 90,
        form: 'regal',
        farbe: '#fff',
        beschriftung: '',
        beschriftungSichtbar: true,
        schriftgroesse: 12,
        gesperrt: false,
        reihenfolge: 1,
        felderUnten: [
          { breite: 125, warengruppe: { text: 'Joghurt', felder: 2 } },
          { breite: 125 },
          { breite: 125, warengruppe: { text: 'Butter', felder: 1 } },
        ],
      },
    ],
  };
}

describe('Das SVG für fremde Anwendungen', () => {
  it('misst in Zentimetern: ein Punkt im Bild ist ein Zentimeter im Markt', () => {
    const { svg } = baueWebSvg(neuesProjekt(), scheinAufnahme(4120, 2620));
    expect(svg).toContain('viewBox="0 0 4120 2620"');
    expect(svg).toContain('data-einheit="cm"');
    expect(svg).toContain('data-breite-cm="4120"');
    expect(svg).toContain('data-hoehe-cm="2620"');
  });

  it('merkt sich, wo im Plan die linke obere Ecke liegt', () => {
    // Ein umgeformter Grundriss kann links von null anfangen.
    const { svg, masse } = baueWebSvg(neuesProjekt(), scheinAufnahme(1000, 800, -260, -60));
    expect(svg).toContain('data-nullpunkt-x="-260"');
    expect(svg).toContain('data-nullpunkt-y="-60"');
    expect(masse.nullpunktX).toBe(-260);
  });

  it('füllt das Bild ohne Verzerrung über die ganze Fläche', () => {
    const { svg } = baueWebSvg(neuesProjekt(), scheinAufnahme(4120, 2620));
    // Bild und Koordinatensystem sind deckungsgleich – deshalb darf hier
    // nichts eingepasst werden, sonst verschiebt sich alles gegeneinander.
    expect(svg).toContain('<image x="0" y="0" width="4120" height="2620"');
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  it('legt die Möbel als Daten bei, mit ihren Warengruppen', () => {
    const { svg } = baueWebSvg(projektMitMoebel(), scheinAufnahme(2000, 1500));
    const roh = svg.match(/<!\[CDATA\[(.*?)\]\]>/s)![1];
    const daten = JSON.parse(roh);

    expect(daten.einheit).toBe('cm');
    expect(daten.moebel).toHaveLength(1);
    const moebel = daten.moebel[0];
    expect(moebel.name).toBe('Molkerei');
    // Ganze Zentimeter – Nachkommastellen braucht dort niemand.
    expect(moebel.x).toBe(1235);
    expect(moebel.y).toBe(800);
    expect(moebel.drehung).toBe(90);
    expect(moebel.warengruppen).toEqual(['Joghurt', 'Butter']);
  });

  it('macht aus einem Namen mit Sonderzeichen kein kaputtes XML', () => {
    const { svg } = baueWebSvg(projektMitMoebel(), scheinAufnahme(100, 100));
    expect(svg).toContain('<title>Markt &quot;Süd&quot; &amp; Co</title>');
    expect(svg).not.toMatch(/<title>[^<]*[^&]"/);
  });

  it('ist wohlgeformtes XML', () => {
    const { svg } = baueWebSvg(projektMitMoebel(), scheinAufnahme(2000, 1500));
    // In Node gibt es keinen DOMParser; geprüft wird deshalb von Hand, was
    // ein Parser als Erstes bemängeln würde – siehe `xmlBeanstandungen`.
    expect(xmlBeanstandungen(svg)).toEqual([]);
    expect(svg.trimStart().startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});

describe('Die XML-Prüfung dieser Datei', () => {
  // Ein Prüfer, der nie etwas findet, ist schlimmer als keiner: Er lässt die
  // übrigen Prüfungen grün aussehen, ohne etwas zu belegen.
  it('lässt sauberes XML durch', () => {
    expect(xmlBeanstandungen('<a x="1"><b/><c>text &amp; mehr</c></a>')).toEqual([]);
    expect(xmlBeanstandungen('<a>\n  <b attr="x" />\n</a>')).toEqual([]);
  });

  it.each([
    ['<a><b></a>', 'falsch verschachtelt'],
    ['<a><b></b>', 'nicht geschlossen'],
    ['<a>Meier & Sohn</a>', 'nacktes &'],
    ['<a x=1></a>', 'Attribut ohne Anführungszeichen'],
  ])('beanstandet %s', (kaputt) => {
    expect(xmlBeanstandungen(kaputt).length).toBeGreaterThan(0);
  });
});

describe('Die Beispielseite', () => {
  it('rechnet Zentimeter in Prozent um, damit die Kameras mitwandern', () => {
    const daten = baueWebSvg(neuesProjekt(), scheinAufnahme(4000, 2500));
    const seite = baueBeispielseite(daten, 'markt.svg');

    expect(seite).toContain('const PLAN = { breite: 4000, hoehe: 2500 }');
    expect(seite).toContain("kamera.x / PLAN.breite * 100");
    expect(seite).toContain("kamera.y / PLAN.hoehe  * 100");
  });

  it('verweist auf die richtige SVG-Datei', () => {
    const daten = baueWebSvg(neuesProjekt(), scheinAufnahme(1000, 800));
    expect(baueBeispielseite(daten, 'mein-markt.svg')).toContain('src="mein-markt.svg"');
  });

  it('legt die Beispielkameras in den Plan und nicht daneben', () => {
    const daten = baueWebSvg(neuesProjekt(), scheinAufnahme(4000, 2500));
    const seite = baueBeispielseite(daten, 'markt.svg');
    const liste = JSON.parse(seite.match(/const KAMERAS = (\[[\s\S]*?\]);/)![1]);

    expect(liste.length).toBeGreaterThan(0);
    for (const kamera of liste) {
      expect(kamera.x).toBeGreaterThanOrEqual(0);
      expect(kamera.x).toBeLessThanOrEqual(4000);
      expect(kamera.y).toBeGreaterThanOrEqual(0);
      expect(kamera.y).toBeLessThanOrEqual(2500);
      expect(typeof kamera.url).toBe('string');
    }
  });

  it('ist eine vollständige HTML-Seite', () => {
    const daten = baueWebSvg(neuesProjekt(), scheinAufnahme(1000, 800));
    const seite = baueBeispielseite(daten, 'markt.svg');
    expect(seite.trimStart().startsWith('<!doctype html>')).toBe(true);
    expect(seite).toContain('</html>');
    expect(seite).toContain('lang="de"');
  });
});
