import { describe, expect, it } from 'vitest';
import { bauePdf, PAPIERE, PUNKTE_JE_CM } from './pdf';

/**
 * Prüfungen für den PDF-Schreiber.
 *
 * Ein selbstgebautes PDF hat eine unangenehme Eigenschaft: Ein Fehler im
 * Aufbau fällt beim Erzeugen **nicht** auf. Die Datei entsteht, sie hat eine
 * plausible Größe, und erst der Betrachter beim Empfänger sagt „beschädigt".
 * Deshalb wird hier nicht nur gezählt, sondern gelesen – am Ende von
 * pdf.js, also von einem echten Leser.
 */

/**
 * Ein Canvas, wie Node es nicht hat.
 *
 * `bauePdf` braucht vom Canvas nur zwei Dinge: seine Maße und die Bildpunkte.
 * Beides lässt sich vortäuschen, und damit läuft die Prüfung ohne Browser.
 */
function scheinCanvas(breite: number, hoehe: number): HTMLCanvasElement {
  const daten = new Uint8ClampedArray(breite * hoehe * 4);
  // Ein Verlauf, damit die gepackten Daten nicht bloß eine lange Null sind.
  for (let i = 0; i < daten.length; i += 4) {
    daten[i] = (i / 4) % 256;
    daten[i + 1] = 128;
    daten[i + 2] = 255 - ((i / 4) % 256);
    daten[i + 3] = 255;
  }
  return {
    width: breite,
    height: hoehe,
    getContext: () => ({
      getImageData: () => ({ data: daten, width: breite, height: hoehe }),
    }),
    toDataURL: () => 'data:image/jpeg;base64,' + btoa('nicht-benutzt'),
  } as unknown as HTMLCanvasElement;
}

async function bytesVon(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

const alsText = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

describe('Der PDF-Schreiber', () => {
  it('schreibt eine Datei, die als PDF beginnt und sauber endet', async () => {
    const blatt = await bauePdf({
      bild: scheinCanvas(60, 40),
      papier: PAPIERE[0],
      quer: false,
      rand: 10,
      texte: {},
    });
    const text = alsText(await bytesVon(blatt));

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(blatt.type).toBe('application/pdf');
  });

  it('setzt das Blatt auf das gewählte Papier – und dreht es im Querformat', async () => {
    const bild = scheinCanvas(60, 40);
    const hoch = alsText(await bytesVon(await bauePdf({ bild, papier: PAPIERE[1], quer: false, rand: 10, texte: {} })));
    const quer = alsText(await bytesVon(await bauePdf({ bild, papier: PAPIERE[1], quer: true, rand: 10, texte: {} })));

    // A3 sind 297 × 420 mm.
    const breiteHoch = (297 / 10) * PUNKTE_JE_CM;
    const hoeheHoch = (420 / 10) * PUNKTE_JE_CM;
    expect(hoch).toContain(`/MediaBox [0 0 ${breiteHoch.toFixed(2)} ${hoeheHoch.toFixed(2)}]`);
    expect(quer).toContain(`/MediaBox [0 0 ${hoeheHoch.toFixed(2)} ${breiteHoch.toFixed(2)}]`);
  });

  it('verzerrt das Bild nicht', async () => {
    const blatt = await bauePdf({
      bild: scheinCanvas(200, 100),
      papier: PAPIERE[0],
      quer: true,
      rand: 10,
      texte: {},
    });
    const text = alsText(await bytesVon(blatt));

    // Die Zeichenmatrix trägt Breite und Höhe des Bildes auf dem Blatt.
    const treffer = text.match(/([\d.]+) 0 0 ([\d.]+) [\d.]+ [\d.]+ cm/);
    expect(treffer).not.toBeNull();
    const [, breite, hoehe] = treffer!;
    // 200 zu 100 muss 2 zu 1 bleiben – sonst stimmen die Maße im Plan nicht.
    expect(Number(breite) / Number(hoehe)).toBeCloseTo(2, 3);
  });

  it('packt die Bildpunkte verlustfrei', async () => {
    const blatt = await bauePdf({
      bild: scheinCanvas(120, 80),
      papier: PAPIERE[0],
      quer: true,
      rand: 10,
      texte: {},
    });
    const text = alsText(await bytesVon(blatt));
    expect(text).toContain('/Filter /FlateDecode');
    expect(text).toContain('/ColorSpace /DeviceRGB');
    expect(text).toContain('/Width 120');
    expect(text).toContain('/Height 80');
  });

  it('schreibt Umlaute so, wie WinAnsi sie erwartet', async () => {
    const blatt = await bauePdf({
      bild: scheinCanvas(20, 20),
      papier: PAPIERE[0],
      quer: true,
      rand: 10,
      texte: { titel: 'Testmarkt Süd', fusszeile: 'Verkaufsfläche 800 m²' },
    });
    const text = alsText(await bytesVon(blatt));

    // ü ist oktal 374, ä ist 344, ² ist 262.
    expect(text).toContain('(Testmarkt S\\374d) Tj');
    expect(text).toContain('(Verkaufsfl\\344che 800 m\\262) Tj');
  });

  it('schützt Klammern, statt den Text abzuschneiden', async () => {
    const blatt = await bauePdf({
      bild: scheinCanvas(20, 20),
      papier: PAPIERE[0],
      quer: true,
      rand: 10,
      texte: { titel: 'Markt (neu) \\ alt' },
    });
    const text = alsText(await bytesVon(blatt));
    expect(text).toContain('(Markt \\(neu\\) \\\\ alt) Tj');
  });

  it('lässt Titel und Fußzeile weg, wenn keine da sind', async () => {
    const blatt = await bauePdf({
      bild: scheinCanvas(20, 20),
      papier: PAPIERE[0],
      quer: true,
      rand: 10,
      texte: {},
    });
    const text = alsText(await bytesVon(blatt));
    expect(text).not.toContain('BT ');
  });

  it('verweist in der Querverweistabelle auf echte Stellen', async () => {
    const bytes = await bytesVon(
      await bauePdf({
        bild: scheinCanvas(40, 30),
        papier: PAPIERE[0],
        quer: true,
        rand: 10,
        texte: { titel: 'Prüfung' },
      }),
    );
    const text = alsText(bytes);

    // `startxref` muss auf den Anfang der Tabelle zeigen – sonst geben
    // Betrachter „beschädigt" aus, obwohl alles andere stimmt.
    const start = Number(text.match(/startxref\s+(\d+)/)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');

    // Jede Stelle in der Tabelle muss auf „<n> 0 obj" zeigen. Übersprungen
    // werden drei Zeilen: `xref`, die Bereichsangabe und der Eintrag für das
    // Objekt 0, das es nach dem Format immer gibt und nie geben darf.
    const tabelle = text.slice(start).split('\n').slice(3, 3 + 6);
    tabelle.forEach((zeile, i) => {
      const stelle = Number(zeile.slice(0, 10));
      expect(text.slice(stelle, stelle + 8)).toContain(`${i + 1} 0 obj`);
    });
  });
});

/**
 * Der Test, auf den es ankommt: Kann ein echter Leser die Datei öffnen?
 *
 * Alles darüber prüft, ob dasteht, was dastehen soll. Erst hier zeigt sich,
 * ob es auch *gelesen* werden kann – von derselben Bibliothek, mit der der
 * Marktplaner fremde Pläne einliest.
 */
describe('Gelesen von pdf.js', () => {
  it('öffnet sich, hat eine Seite und trägt den Text', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const blatt = await bauePdf({
      bild: scheinCanvas(300, 200),
      papier: PAPIERE[1],
      quer: true,
      rand: 12,
      texte: { titel: 'Testmarkt Süd', fusszeile: 'Verkaufsfläche 800 m² · 7 Möbel' },
    });

    const dokument = await pdfjs.getDocument({
      data: await bytesVon(blatt),
      useSystemFonts: false,
    }).promise;

    expect(dokument.numPages).toBe(1);

    const seite = await dokument.getPage(1);
    const sicht = seite.getViewport({ scale: 1 });
    // A3 quer sind 420 × 297 mm.
    expect(Math.round((sicht.width / 72) * 25.4)).toBe(420);
    expect(Math.round((sicht.height / 72) * 25.4)).toBe(297);

    const inhalt = await seite.getTextContent();
    const gelesen = inhalt.items.map((i) => ('str' in i ? i.str : '')).join(' ');
    expect(gelesen).toContain('Testmarkt Süd');
    expect(gelesen).toContain('Verkaufsfläche');

    // Und das Bild ist auch wirklich als Bild eingehängt.
    const stuecke = await seite.getOperatorList();
    const { OPS } = pdfjs;
    expect(stuecke.fnArray).toContain(OPS.paintImageXObject);
  });
});
