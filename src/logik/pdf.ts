/**
 * Ein kleiner PDF-Schreiber – gerade so viel, wie ein Plan braucht.
 *
 * Warum selbst und nicht mit einer fertigen Bibliothek: Ein Marktplan ist ein
 * Bild, ein Titel und eine Fußzeile. Dafür eine halbe Megabyte in das Programm
 * zu holen, das sonst ohne fremde Hilfe auskommt, steht in keinem Verhältnis –
 * das hier sind zweihundert Zeilen.
 *
 * Das Bild geht **verlustfrei** hinein: rohe Bildpunkte, mit `CompressionStream`
 * zusammengepackt, als `FlateDecode`. JPEG wäre einfacher, aber an den feinen
 * schwarzen Linien eines Grundrisses sieht man seine Artefakte sofort. Fehlt
 * `CompressionStream` (sehr alte Browser), gibt es JPEG als Rückfall.
 *
 * Maßeinheit im PDF ist der Punkt: 72 auf ein Zoll, also 28,35 auf einen
 * Zentimeter.
 */

/** Punkte je Zentimeter – die Maßeinheit von PDF ist das Zoll zu 72 Punkten. */
export const PUNKTE_JE_CM = 72 / 2.54;

export interface Papier {
  name: string;
  /** Breite und Höhe im Hochformat, in Millimetern. */
  breite: number;
  hoehe: number;
}

export const PAPIERE: Papier[] = [
  { name: 'A4', breite: 210, hoehe: 297 },
  { name: 'A3', breite: 297, hoehe: 420 },
  { name: 'A2', breite: 420, hoehe: 594 },
  { name: 'A1', breite: 594, hoehe: 841 },
  { name: 'A0', breite: 841, hoehe: 1189 },
];

/* --------------------------------------------------------------- Bausteine */

/**
 * Ein PDF ist eine Liste nummerierter Objekte und am Ende eine Tabelle, die
 * sagt, an welchem Byte jedes beginnt. Diese Klasse führt darüber Buch.
 */
class Schreiber {
  private teile: Uint8Array[] = [];
  private laenge = 0;
  /** Byte-Position jedes Objekts; Index 0 bleibt frei (so will es das Format). */
  private stellen: number[] = [0];

  roh(daten: Uint8Array): void {
    this.teile.push(daten);
    this.laenge += daten.length;
  }

  text(inhalt: string): void {
    // latin1: Jedes Zeichen wird ein Byte. Alles über 255 ist hier ohnehin
    // schon in eine Oktal-Folge übersetzt (siehe `pdfText`).
    const bytes = new Uint8Array(inhalt.length);
    for (let i = 0; i < inhalt.length; i += 1) bytes[i] = inhalt.charCodeAt(i) & 0xff;
    this.roh(bytes);
  }

  /** Merkt sich, wo das nächste Objekt beginnt, und schreibt seinen Kopf. */
  objekt(nummer: number, inhalt: string): void {
    this.stellen[nummer] = this.laenge;
    this.text(`${nummer} 0 obj\n${inhalt}\nendobj\n`);
  }

  /** Ein Objekt mit angehängtem Datenstrom – für Bilder und Seiteninhalte. */
  stromObjekt(nummer: number, woerterbuch: string, daten: Uint8Array): void {
    this.stellen[nummer] = this.laenge;
    this.text(`${nummer} 0 obj\n<< ${woerterbuch} /Length ${daten.length} >>\nstream\n`);
    this.roh(daten);
    this.text('\nendstream\nendobj\n');
  }

  get stelle(): number {
    return this.laenge;
  }

  /** Schließt die Datei ab: Querverweistabelle und Verweis auf den Katalog. */
  abschluss(anzahl: number, wurzel: number): Blob {
    const xref = this.laenge;
    let tabelle = `xref\n0 ${anzahl + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= anzahl; i += 1) {
      tabelle += String(this.stellen[i] ?? 0).padStart(10, '0') + ' 00000 n \n';
    }
    tabelle += `trailer\n<< /Size ${anzahl + 1} /Root ${wurzel} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    this.text(tabelle);
    return new Blob(this.teile as BlobPart[], { type: 'application/pdf' });
  }
}

/**
 * Bringt Text in die Form, die PDF versteht.
 *
 * Klammern und Rückstriche haben im Format eine Bedeutung und müssen
 * geschützt werden. Umlaute gehen als Oktalzahl hinein – die Standardschrift
 * Helvetica liegt in WinAnsi, und dort steht „ä" auf 228.
 */
function pdfText(inhalt: string): string {
  let aus = '';
  for (const zeichen of inhalt) {
    const nummer = zeichen.codePointAt(0) ?? 63;
    if (zeichen === '(' || zeichen === ')' || zeichen === '\\') aus += '\\' + zeichen;
    else if (nummer < 32) aus += ' ';
    else if (nummer < 128) aus += zeichen;
    else if (nummer < 256) aus += '\\' + nummer.toString(8).padStart(3, '0');
    // Alles darüber kennt WinAnsi nicht; ein Fragezeichen ist ehrlicher als
    // ein zufälliges anderes Zeichen.
    else aus += '?';
  }
  return aus;
}

/** Packt Daten so zusammen, wie FlateDecode sie erwartet (zlib). */
async function packe(daten: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const strom = new Blob([daten as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

/**
 * Die Bildpunkte als reines RGB, ohne Alphakanal.
 *
 * Das Weiß liegt schon unter dem Bild (siehe `planAufnahme.ts`), deshalb kann
 * der Alphakanal hier einfach wegfallen.
 */
function rgbVon(bild: HTMLCanvasElement): Uint8Array | null {
  const ctx = bild.getContext('2d');
  if (!ctx) return null;
  const daten = ctx.getImageData(0, 0, bild.width, bild.height).data;
  const rgb = new Uint8Array((daten.length / 4) * 3);
  for (let i = 0, j = 0; i < daten.length; i += 4, j += 3) {
    rgb[j] = daten[i];
    rgb[j + 1] = daten[i + 1];
    rgb[j + 2] = daten[i + 2];
  }
  return rgb;
}

/** Das Bild als JPEG – der Rückfall, wenn das Packen nicht geht. */
function jpegVon(bild: HTMLCanvasElement): Uint8Array {
  const daten = bild.toDataURL('image/jpeg', 0.92).split(',')[1];
  const roh = atob(daten);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

/* ------------------------------------------------------------------ Aufbau */

export interface Seitentext {
  /** Groß oben auf dem Blatt. */
  titel?: string;
  /** Klein unten – Maßstab, Datum, Anzahl der Möbel. */
  fusszeile?: string;
}

export interface PdfAuftrag {
  bild: HTMLCanvasElement;
  papier: Papier;
  quer: boolean;
  /** Rand in Millimetern. */
  rand: number;
  texte: Seitentext;
}

/**
 * Baut das PDF.
 *
 * Der Aufbau ist der kleinstmögliche, den ein Betrachter akzeptiert:
 * Katalog → Seitenbaum → Seite → Inhalt, dazu das Bild und eine Schrift.
 *
 * Das Bild wird **eingepasst, nicht gedehnt**: Es behält sein Seitenverhältnis
 * und sitzt mittig auf dem Blatt. Ein verzerrter Plan wäre kein Plan mehr,
 * sondern eine Zeichnung mit falschen Maßen.
 */
export async function bauePdf(auftrag: PdfAuftrag): Promise<Blob> {
  const { bild, papier, quer, rand, texte } = auftrag;

  const blattBreiteMm = quer ? papier.hoehe : papier.breite;
  const blattHoeheMm = quer ? papier.breite : papier.hoehe;
  const blattBreite = (blattBreiteMm / 10) * PUNKTE_JE_CM;
  const blattHoehe = (blattHoeheMm / 10) * PUNKTE_JE_CM;
  const randP = (rand / 10) * PUNKTE_JE_CM;

  // Platz für Titel und Fußzeile, aber nur wenn es sie gibt.
  const obenFrei = texte.titel ? 22 : 0;
  const untenFrei = texte.fusszeile ? 16 : 0;

  const platzBreite = blattBreite - randP * 2;
  const platzHoehe = blattHoehe - randP * 2 - obenFrei - untenFrei;

  const massstab = Math.min(platzBreite / bild.width, platzHoehe / bild.height);
  const bildBreite = bild.width * massstab;
  const bildHoehe = bild.height * massstab;
  const bildX = (blattBreite - bildBreite) / 2;
  // PDF zählt von unten; deshalb sitzt der Rand oben unten in der Rechnung.
  const bildY = randP + untenFrei + (platzHoehe - bildHoehe) / 2;

  // ------------------------------------------------------------ Bilddaten
  const rgb = rgbVon(bild);
  const gepackt = rgb ? await packe(rgb) : null;
  const alsFlate = gepackt !== null;
  const bilddaten = alsFlate ? gepackt : jpegVon(bild);
  const bildWoerterbuch =
    `/Type /XObject /Subtype /Image /Width ${bild.width} /Height ${bild.height} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
    (alsFlate ? '/Filter /FlateDecode' : '/Filter /DCTDecode');

  // ------------------------------------------------------- Seiteninhalt
  const zeilen: string[] = [];
  zeilen.push('q');
  // Ein Bild ist im PDF ein Einheitsquadrat; die Matrix macht daraus das Maß.
  zeilen.push(`${bildBreite.toFixed(2)} 0 0 ${bildHoehe.toFixed(2)} ${bildX.toFixed(2)} ${bildY.toFixed(2)} cm`);
  zeilen.push('/Bild Do');
  zeilen.push('Q');

  if (texte.titel) {
    zeilen.push('BT /Helv 13 Tf 0 0 0 rg');
    zeilen.push(`${randP.toFixed(2)} ${(blattHoehe - randP - 12).toFixed(2)} Td`);
    zeilen.push(`(${pdfText(texte.titel)}) Tj ET`);
  }
  if (texte.fusszeile) {
    zeilen.push('BT /Helv 8 Tf 0.35 0.4 0.45 rg');
    zeilen.push(`${randP.toFixed(2)} ${(randP + 4).toFixed(2)} Td`);
    zeilen.push(`(${pdfText(texte.fusszeile)}) Tj ET`);
  }
  const inhalt = new TextEncoder().encode(zeilen.join('\n'));

  // ------------------------------------------------------------ Zusammenbau
  const s = new Schreiber();
  s.text('%PDF-1.4\n');
  // Ein Kommentar mit hohen Bytes sagt Werkzeugen: Diese Datei ist binär.
  s.roh(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  s.objekt(1, '<< /Type /Catalog /Pages 2 0 R >>');
  s.objekt(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  s.objekt(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${blattBreite.toFixed(2)} ${blattHoehe.toFixed(2)}] ` +
      `/Resources << /XObject << /Bild 5 0 R >> /Font << /Helv 6 0 R >> >> /Contents 4 0 R >>`,
  );
  s.stromObjekt(4, '', inhalt);
  s.stromObjekt(5, bildWoerterbuch, bilddaten);
  s.objekt(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  return s.abschluss(6, 1);
}


/**
 * Ein PDF aus Vektorbefehlen statt aus einem Bild.
 *
 * Das ist der Unterschied, um den es geht: Bisher steckte im PDF ein
 * Rasterbild – so scharf wie der Bildschirm im Augenblick des Exports und
 * keinen Punkt schärfer. Auf A1 sah man das sofort. Jetzt stehen Linien im
 * PDF, und die sind bei jeder Vergrößerung scharf.
 *
 * Der Aufbau ist derselbe kleine wie beim Bildexport, nur ohne Bild und
 * dafür mit zwei Zusätzen: den Durchsichtigkeitsstufen (in PDF ein eigener
 * Zustand, keine Eigenschaft der Farbe) und einer Schrift mit
 * WinAnsi-Kodierung, damit Umlaute ankommen.
 */
export interface PdfVektorauftrag {
  /** Die fertigen Zeichenbefehle, in Punkten. */
  inhalt: string;
  /** Blattmaße in Millimetern, schon im richtigen Format. */
  breiteMm: number;
  hoeheMm: number;
  /** Die Durchsichtigkeitsstufen, die im Inhalt als /GS0, /GS1 … vorkommen. */
  deckkraft: number[];
  titel?: string;
}

/**
 * Text so kodieren, wie das PDF ihn erwartet: **ein Byte je Zeichen**.
 *
 * Die Schrift ist mit `/WinAnsiEncoding` angemeldet – dort ist „ß" das Byte
 * 0xDF und „ü" das Byte 0xFC. `TextEncoder` schreibt dagegen UTF-8, also zwei
 * Bytes, und der Leser zeigt daraufhin zwei Zeichen an: Aus „Maßstab" wurde
 * „MaÃŸstab". Das ist im gerenderten PDF sofort aufgefallen.
 *
 * WinAnsi und Latin-1 stimmen im hier gebrauchten Bereich überein; die paar
 * Sonderzeichen zwischen 0x80 und 0x9F stehen in der Tabelle.
 */
const WINANSI_SONDER: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Zeichen, die WinAnsi nicht hat, aber die im Plan etwas bedeuten.
 *
 * Der **Stern der Sonderplatzierung** ist keine Verzierung: An ihm sieht man
 * auf einen Blick, welcher Meter Werbeware trägt. Als Fragezeichen im Ausdruck
 * liest er sich wie eine fehlende Angabe. Ein Sternchen ist nicht dasselbe
 * Zeichen, aber dieselbe Aussage – und das ist mehr wert als die genaue Form.
 */
const ERSATZZEICHEN: Record<number, number> = {
  0x2605: 0x2a, // ★ → *
  0x2606: 0x2a, // ☆ → *
  0x00d7: 0x78, // × → x
  0x2192: 0x3e, // → → >
  0x2713: 0x76, // ✓ → v
};

export function winAnsiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x100) bytes[i] = code;
    else if (WINANSI_SONDER[code] !== undefined) bytes[i] = WINANSI_SONDER[code];
    else if (ERSATZZEICHEN[code] !== undefined) bytes[i] = ERSATZZEICHEN[code];
    // Alles, was WinAnsi nicht kennt, wird ein Fragezeichen. Ein falsches
    // Zeichen ist besser als ein verschobener Rest der Zeile.
    else bytes[i] = 0x3f;
  }
  return bytes;
}

export function bauePdfVektor(auftrag: PdfVektorauftrag): Blob {
  const breite = (auftrag.breiteMm / 10) * PUNKTE_JE_CM;
  const hoehe = (auftrag.hoeheMm / 10) * PUNKTE_JE_CM;
  const inhalt = winAnsiBytes(auftrag.inhalt);

  // Jede Durchsichtigkeitsstufe wird ein eigenes kleines Objekt. `ca` gilt
  // fürs Füllen, `CA` fürs Strichen – beide gleich, sonst sähe ein blasser
  // Raum mit kräftigem Rand seltsam aus.
  const ersteStufe = 7;
  const stufen = auftrag.deckkraft.map((wert, i) => ({
    name: `GS${i}`,
    nummer: ersteStufe + i,
    wert,
  }));
  const gsEintraege = stufen.map((g) => `/${g.name} ${g.nummer} 0 R`).join(' ');

  const s = new Schreiber();
  s.text('%PDF-1.4\n');
  s.roh(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  s.objekt(1, '<< /Type /Catalog /Pages 2 0 R >>');
  s.objekt(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  s.objekt(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${breite.toFixed(2)} ${hoehe.toFixed(2)}] ` +
      `/Resources << /Font << /Helv 6 0 R >>` +
      (stufen.length > 0 ? ` /ExtGState << ${gsEintraege} >>` : '') +
      ` >> /Contents 4 0 R >>`,
  );
  s.stromObjekt(4, '', inhalt);
  // Objekt 5 bleibt frei – so bleibt die Nummerierung dieselbe wie beim
  // Bildexport, und beide Wege lassen sich nebeneinander lesen.
  s.objekt(5, '<< >>');
  s.objekt(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  for (const g of stufen) {
    s.objekt(g.nummer, `<< /Type /ExtGState /ca ${g.wert} /CA ${g.wert} >>`);
  }

  return s.abschluss(6 + stufen.length, 1);
}
