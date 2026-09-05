import { KATEGORIEN } from '../daten/kategorien';
import {
  planAlsVektor,
  zoomFuerMassstab,
  type Planvektor,
  type Vektorform,
  type Vektortext,
} from './planvektor';
import {
  deckkraftstufen,
  formZuPdf,
  pdfDeckkraft,
  pdfFarbe,
  pfadZuPdf,
  textbreite,
  textZuPdf,
} from './pdfVektor';
import type { KategorieId, Projekt } from '../typen/modell';

/**
 * Ein Plan auf einem Blatt Papier – mit Maßstab, Schriftfeld und Legende.
 *
 * **Der Maßstab ist das Eigentliche.** Bisher wurde der Plan so weit
 * verkleinert, bis er aufs Blatt passte – ein krummer Maßstab, der auf dem
 * Papier nirgends steht. Wer daraufhin mit dem Lineal nachmisst, bekommt ein
 * falsches Maß, und wer zwei Ausdrucke nebeneinanderlegt, vergleicht Äpfel
 * mit Birnen. Ein Bauplan hat 1:50, 1:100 oder 1:200, und diese Zahl steht
 * im Schriftfeld.
 *
 * Deshalb heißt es hier: erst der Maßstab, dann das Blatt. Passt der Markt
 * bei 1:100 nicht auf A3, nimmt man A2 – oder 1:200. Das ist eine
 * Entscheidung des Planers, keine Rechenaufgabe des Programms; das Programm
 * sagt nur, was passt.
 */

/** Die Maßstäbe, die im Ladenbau vorkommen. */
export const MASSSTAEBE = [50, 100, 200, 250, 500] as const;
export type Massstab = (typeof MASSSTAEBE)[number];

/** Millimeter Papier je Zentimeter Markt, bei einem Maßstab von 1:n. */
export function mmJeCm(massstab: number): number {
  return 10 / massstab;
}

export interface Blattmasse {
  /** Blattmaße in Millimetern, schon im richtigen Format. */
  breiteMm: number;
  hoeheMm: number;
  randMm: number;
}

export interface Schriftfeld {
  markt: string;
  /** „Bestand", „Planung 2026", … */
  zusatz?: string;
  gezeichnetVon?: string;
  datum?: string;
}

export interface Blattauftrag {
  projekt: Projekt;
  blatt: Blattmasse;
  massstab: Massstab | number;
  schriftfeld: Schriftfeld;
  /** Legende der Abteilungen, die wirklich vorkommen. */
  mitLegende?: boolean;
  mitMassstabsbalken?: boolean;
}

/** Was auf das Blatt passt und was nicht. */
export interface Blattprobe {
  passt: boolean;
  /** Breite und Höhe, die der Plan bei diesem Maßstab bräuchte, in mm. */
  brauchtBreiteMm: number;
  brauchtHoeheMm: number;
  /** Der größte Maßstab (also die kleinste Zahl), der noch passen würde. */
  empfehlung?: number;
}

/** Höhe des Schriftfelds am unteren Blattrand, in Millimetern. */
const SCHRIFTFELD_HOEHE = 26;
/**
 * Ab welcher Größe eine Beschriftung noch gedruckt wird, in Millimetern.
 *
 * Im Bauzeichnen ist 2,5 mm die übliche Schrifthöhe; darunter wird es eng,
 * aber lesbar bleibt es bis etwa anderthalb. Was kleiner wäre, kommt gar
 * nicht aufs Blatt.
 */
const MINDEST_SCHRIFT_MM = 1.5;
/** Breite der Legendenspalte, in Millimetern. */
const LEGENDE_BREITE = 46;

function schuetze(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function r(wert: number): number {
  return Math.round(wert * 1000) / 1000;
}

/** Der Platz, der dem Plan auf dem Blatt bleibt. */
export function zeichenflaecheMm(
  blatt: Blattmasse,
  mitLegende: boolean,
): { x: number; y: number; breite: number; hoehe: number } {
  const x = blatt.randMm;
  const y = blatt.randMm;
  const breite = blatt.breiteMm - blatt.randMm * 2 - (mitLegende ? LEGENDE_BREITE : 0);
  const hoehe = blatt.hoeheMm - blatt.randMm * 2 - SCHRIFTFELD_HOEHE;
  return { x, y, breite, hoehe };
}

/**
 * Passt der Plan bei diesem Maßstab auf dieses Blatt?
 *
 * Und wenn nicht: Welcher Maßstab täte es? Die Antwort ist wichtiger als sie
 * aussieht – sie erspart das Ausprobieren, und sie nennt einen **üblichen**
 * Maßstab, nicht irgendeine Zahl.
 */
export function passtAufsBlatt(
  vektor: Planvektor,
  blatt: Blattmasse,
  massstab: number,
  mitLegende = true,
): Blattprobe {
  const platz = zeichenflaecheMm(blatt, mitLegende);
  const breiteCm = Math.max(1, vektor.rahmen.rechts - vektor.rahmen.links);
  const hoeheCm = Math.max(1, vektor.rahmen.unten - vektor.rahmen.oben);
  const brauchtBreiteMm = breiteCm * mmJeCm(massstab);
  const brauchtHoeheMm = hoeheCm * mmJeCm(massstab);
  const passt = brauchtBreiteMm <= platz.breite && brauchtHoeheMm <= platz.hoehe;

  const empfehlung = passt
    ? undefined
    : MASSSTAEBE.find(
        (m) => breiteCm * mmJeCm(m) <= platz.breite && hoeheCm * mmJeCm(m) <= platz.hoehe,
      );
  return { passt, brauchtBreiteMm: r(brauchtBreiteMm), brauchtHoeheMm: r(brauchtHoeheMm), empfehlung };
}

/** Die Abteilungen, die in diesem Plan wirklich vorkommen. */
export function benutzteKategorien(projekt: Projekt): { id: KategorieId; name: string; farbe: string }[] {
  const da = new Set(projekt.elemente?.map((e) => e.kategorie) ?? []);
  return KATEGORIEN.filter((k) => da.has(k.id)).map((k) => ({
    id: k.id,
    name: k.name,
    farbe: k.farbe,
  }));
}

/**
 * Ein runder Balken, an dem man auf dem Ausdruck nachmessen kann.
 *
 * Er ist wichtiger als der Maßstab im Schriftfeld: Kopierer und Drucker
 * verkleinern gern um ein paar Prozent, ohne es zu sagen. Dann stimmt die
 * Zahl im Schriftfeld nicht mehr – der Balken schrumpft aber mit und bleibt
 * richtig.
 *
 * Gewählt wird eine runde Länge in Metern, die etwa ein Sechstel der
 * Zeichenbreite einnimmt.
 */
export function balkenlaengeM(platzBreiteMm: number, massstab: number): number {
  const zielMm = platzBreiteMm / 6;
  const zielM = (zielMm * massstab) / 1000;
  const stufen = [1, 2, 5, 10, 20, 50, 100];
  return stufen.reduce((beste, s) => (Math.abs(s - zielM) < Math.abs(beste - zielM) ? s : beste), 1);
}

function formZuSvg(f: Vektorform, massstab: number): string {
  const teile: string[] = [`d="${f.d}"`];
  teile.push(`fill="${f.fuellung ?? 'none'}"`);
  if (f.linie) {
    teile.push(`stroke="${f.linie}"`);
    // Eine Wand ist ein Bauteil und wird mit dem Plan kleiner. Eine Kontur
    // ist ein Zeichenmittel und bleibt gleich dick, sonst verschwände sie
    // bei 1:200 ganz.
    const breiteCm = f.strichCm ?? (f.strichMm ?? 0.25) * (massstab / 10);
    teile.push(`stroke-width="${r(breiteCm)}"`);
    teile.push('stroke-linejoin="round"');
  }
  if (f.deckkraft !== undefined) teile.push(`opacity="${f.deckkraft}"`);
  if (f.umformung) teile.push(`transform="${f.umformung}"`);
  if (f.beschnitten) teile.push('clip-path="url(#gebaeude)"');
  return `<path ${teile.join(' ')}/>`;
}

function textZuSvg(t: Vektortext): string {
  const anker = t.rechtsbuendig ? 'end' : t.anker === 'anfang' ? 'start' : 'middle';
  // Die Zeichnung setzt ihre Feldnotizen an der **Oberkante** der Zeile
  // (`textBaseline: 'top'`). Wer das übergeht, schiebt jede Feldbeschriftung
  // um eine halbe Zeile nach oben und aus ihrem Feld heraus.
  const grundlinie =
    t.grundlinie === 'top'
      ? 'text-before-edge'
      : t.grundlinie === 'alphabetic'
        ? 'alphabetic'
        : 'central';
  const teile: string[] = [
    `x="${r(t.x)}"`,
    `y="${r(t.y)}"`,
    `font-size="${r(t.groesse)}"`,
    `fill="${t.farbe ?? '#26313d'}"`,
    `text-anchor="${anker}"`,
    `dominant-baseline="${grundlinie}"`,
  ];
  if (t.fett) teile.push('font-weight="600"');
  // Erst an den Platz des Möbels, dann drehen: Die Umformung des Möbels gilt
  // für seine Beschriftungen genauso wie für seine Linien.
  const umformungen = [t.umformung, t.drehung ? `rotate(${r(t.drehung)} ${r(t.x)} ${r(t.y)})` : '']
    .filter(Boolean)
    .join(' ');
  if (umformungen) teile.push(`transform="${umformungen}"`);
  return `<text ${teile.join(' ')}>${schuetze(t.text)}</text>`;
}

/**
 * Das fertige Blatt als SVG.
 *
 * Die äußeren Maße sind Millimeter Papier (`width="297mm"`), damit ein
 * Betrachter ohne Nachfrage in der richtigen Größe druckt. Innen läuft alles
 * in Zentimetern des Marktes – die Umrechnung steckt in **einer** Umformung,
 * und die ist genau der Maßstab.
 */
export function baueSvgBlatt(auftrag: Blattauftrag): string {
  const { projekt, blatt, massstab, schriftfeld } = auftrag;
  const mitLegende = auftrag.mitLegende !== false;
  // Maßstäblich ausgeben heißt: Der Plan entscheidet an der Papiergröße,
  // was noch lesbar ist – nicht an einer festen Zahl.
  const vektor = planAlsVektor(projekt, { ersatzzoom: zoomFuerMassstab(massstab) });
  const platz = zeichenflaecheMm(blatt, mitLegende);
  const faktor = mmJeCm(massstab);

  const breiteCm = Math.max(1, vektor.rahmen.rechts - vektor.rahmen.links);
  const hoeheCm = Math.max(1, vektor.rahmen.unten - vektor.rahmen.oben);
  // Mittig im verfügbaren Platz – auch dann, wenn der Plan kleiner ist.
  const versatzX = platz.x + (platz.breite - breiteCm * faktor) / 2;
  const versatzY = platz.y + (platz.hoehe - hoeheCm * faktor) / 2;

  const zeilen: string[] = [];
  zeilen.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${blatt.breiteMm}mm" height="${blatt.hoeheMm}mm" ` +
      `viewBox="0 0 ${blatt.breiteMm} ${blatt.hoeheMm}">`,
  );
  zeilen.push(`<rect width="${blatt.breiteMm}" height="${blatt.hoeheMm}" fill="#ffffff"/>`);

  // Der Gebäudeumriss als Schnittform – dieselbe Beschneidung wie auf dem
  // Bildschirm, damit die Außenwand nach innen liegt.
  if (vektor.umriss.length >= 3) {
    const d = vektor.umriss
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${r(p.x)} ${r(p.y)}`)
      .join(' ');
    zeilen.push(`<defs><clipPath id="gebaeude" clipPathUnits="userSpaceOnUse"><path d="${d} Z"/></clipPath></defs>`);
  }

  // Der Plan selbst: eine Umformung bringt Zentimeter des Marktes auf
  // Millimeter des Papiers. Das **ist** der Maßstab, und er steht genau
  // einmal in der Datei.
  zeilen.push(
    `<g transform="translate(${r(versatzX)} ${r(versatzY)}) scale(${r(faktor)}) ` +
      `translate(${r(-vektor.rahmen.links)} ${r(-vektor.rahmen.oben)})">`,
  );
  for (const f of vektor.formen) zeilen.push(formZuSvg(f, massstab));
  zeilen.push('<g font-family="Helvetica, Arial, sans-serif">');
  // Was auf dem Papier kleiner als anderthalb Millimeter würde, wird
  // **weggelassen** statt klein gedruckt. Dieselbe Regel gilt auf dem
  // Bildschirm (`lesbar` in beschriftung.ts) und aus demselben Grund: Ein
  // Text von einem Millimeter ist kein Text mehr, sondern ein grauer Fleck,
  // und ein Plan voller grauer Flecken ist unruhiger als einer ohne.
  const mindestensCm = (MINDEST_SCHRIFT_MM * massstab) / 10;
  for (const t of vektor.texte) {
    if (t.groesse < mindestensCm) continue;
    zeilen.push(textZuSvg(t));
  }
  zeilen.push('</g>');
  zeilen.push('</g>');

  zeilen.push(...schriftfeldSvg(blatt, massstab, schriftfeld, platz, auftrag.mitMassstabsbalken !== false));
  if (mitLegende) zeilen.push(...legendeSvg(projekt, blatt));

  zeilen.push('</svg>');
  return zeilen.join('\n');
}

/** Das Schriftfeld unten und der Maßstabsbalken darüber. */
function schriftfeldSvg(
  blatt: Blattmasse,
  massstab: number,
  feld: Schriftfeld,
  platz: { x: number; y: number; breite: number; hoehe: number },
  mitBalken: boolean,
): string[] {
  const y = blatt.hoeheMm - blatt.randMm - SCHRIFTFELD_HOEHE;
  const breite = blatt.breiteMm - blatt.randMm * 2;
  const zeilen: string[] = [];

  zeilen.push(
    `<rect x="${blatt.randMm}" y="${r(y)}" width="${r(breite)}" height="${SCHRIFTFELD_HOEHE}" ` +
      `fill="none" stroke="#26313d" stroke-width="0.3"/>`,
  );
  zeilen.push('<g font-family="Helvetica, Arial, sans-serif" fill="#26313d">');
  zeilen.push(
    `<text x="${blatt.randMm + 4}" y="${r(y + 9)}" font-size="6" font-weight="bold">${schuetze(feld.markt)}</text>`,
  );
  if (feld.zusatz) {
    zeilen.push(
      `<text x="${blatt.randMm + 4}" y="${r(y + 17)}" font-size="3.6" fill="#5d6874">${schuetze(feld.zusatz)}</text>`,
    );
  }
  const rechts = blatt.breiteMm - blatt.randMm - 4;
  zeilen.push(
    `<text x="${r(rechts)}" y="${r(y + 9)}" font-size="5" text-anchor="end">Maßstab 1:${massstab}</text>`,
  );
  const unten = [feld.gezeichnetVon, feld.datum].filter(Boolean).join('  ·  ');
  if (unten) {
    zeilen.push(
      `<text x="${r(rechts)}" y="${r(y + 17)}" font-size="3.6" text-anchor="end" fill="#5d6874">${schuetze(unten)}</text>`,
    );
  }
  zeilen.push('</g>');

  if (mitBalken) {
    const meter = balkenlaengeM(platz.breite, massstab);
    const laengeMm = (meter * 1000) / massstab;
    const bx = blatt.randMm + 4;
    const by = r(y - 6);
    zeilen.push(
      `<g font-family="Helvetica, Arial, sans-serif">` +
        // Zwei Hälften, hell und dunkel – so liest man auch halbe Längen ab.
        `<rect x="${r(bx)}" y="${by}" width="${r(laengeMm / 2)}" height="1.6" fill="#26313d"/>` +
        `<rect x="${r(bx + laengeMm / 2)}" y="${by}" width="${r(laengeMm / 2)}" height="1.6" ` +
        `fill="#ffffff" stroke="#26313d" stroke-width="0.2"/>` +
        `<text x="${r(bx + laengeMm + 2)}" y="${r(by + 1.6)}" font-size="3.2" fill="#26313d">${meter} m</text>` +
        `</g>`,
    );
  }
  return zeilen;
}

/** Die Legende der Abteilungen, rechts neben dem Plan. */
function legendeSvg(projekt: Projekt, blatt: Blattmasse): string[] {
  const kategorien = benutzteKategorien(projekt);
  if (kategorien.length === 0) return [];

  const x = blatt.breiteMm - blatt.randMm - LEGENDE_BREITE + 2;
  let y = blatt.randMm + 6;
  const zeilen: string[] = ['<g font-family="Helvetica, Arial, sans-serif" fill="#26313d">'];
  zeilen.push(`<text x="${r(x)}" y="${r(y)}" font-size="4" font-weight="bold">Abteilungen</text>`);
  y += 6;
  for (const k of kategorien) {
    zeilen.push(
      `<rect x="${r(x)}" y="${r(y - 3)}" width="4" height="4" fill="${k.farbe}" ` +
        `stroke="#26313d" stroke-width="0.2"/>`,
    );
    zeilen.push(`<text x="${r(x + 6)}" y="${r(y)}" font-size="3.4">${schuetze(k.name)}</text>`);
    y += 6;
  }
  zeilen.push('</g>');
  return zeilen;
}


/* ------------------------------------------------------------------- PDF */

/**
 * Dasselbe Blatt als PDF – mit denselben Pfaden.
 *
 * Der Unterschied zum SVG ist nur die Schreibweise. Die Geometrie kommt aus
 * derselben Quelle (`planAlsVektor`), und die Möbel darin aus derselben
 * Zeichenfunktion wie auf dem Bildschirm. Es gibt keine zweite Fassung, die
 * auseinanderlaufen könnte – das war der Grund, warum die Ausgabe bisher ein
 * Bild war.
 *
 * PDF rechnet in Punkten zu 1/72 Zoll. Der Weg vom Zentimeter des Marktes
 * dorthin ist eine einzige Kette: Zentimeter → Millimeter Papier (das ist der
 * Maßstab) → Punkte. Sie steht genau einmal, in `aufsBlatt`.
 */
export function pdfInhalt(auftrag: Blattauftrag): {
  inhalt: string;
  deckkraft: number[];
} {
  const { projekt, blatt, massstab, schriftfeld } = auftrag;
  const mitLegende = auftrag.mitLegende !== false;
  // Maßstäblich ausgeben heißt: Der Plan entscheidet an der Papiergröße,
  // was noch lesbar ist – nicht an einer festen Zahl.
  const vektor = planAlsVektor(projekt, { ersatzzoom: zoomFuerMassstab(massstab) });
  const platz = zeichenflaecheMm(blatt, mitLegende);
  const faktor = mmJeCm(massstab);

  const breiteCm = Math.max(1, vektor.rahmen.rechts - vektor.rahmen.links);
  const hoeheCm = Math.max(1, vektor.rahmen.unten - vektor.rahmen.oben);
  const versatzX = platz.x + (platz.breite - breiteCm * faktor) / 2;
  const versatzY = platz.y + (platz.hoehe - hoeheCm * faktor) / 2;

  const stufen = deckkraftstufen(vektor.formen);
  const nameFuer = (wert: number) => `GS${stufen.indexOf(wert)}`;

  const zeilen: string[] = [];

  // Einmal spiegeln, damit der Plan nicht auf dem Kopf steht: PDF zählt von
  // unten, ein Grundriss von oben. Danach ist die ganze Seite in
  // Millimetern und richtig herum.
  zeilen.push('q');
  zeilen.push(`${MM} 0 0 ${-MM} 0 ${n(blatt.hoeheMm * MM)} cm`);

  // ------------------------------------------------------------ der Plan
  zeilen.push('q');
  zeilen.push(`1 0 0 1 ${n(versatzX)} ${n(versatzY)} cm`);
  zeilen.push(`${n(faktor)} 0 0 ${n(faktor)} 0 0 cm`);
  zeilen.push(`1 0 0 1 ${n(-vektor.rahmen.links)} ${n(-vektor.rahmen.oben)} cm`);

  // Die Außenwand wird auf den Gebäudeumriss beschnitten – dieselbe
  // Beschneidung wie auf dem Bildschirm, damit die Wand nach innen liegt.
  const umrissPfad =
    vektor.umriss.length >= 3
      ? vektor.umriss.map((p, i) => `${i === 0 ? 'M' : 'L'} ${n(p.x)} ${n(p.y)}`).join(' ') + ' Z'
      : '';

  for (const form of vektor.formen) {
    const strichCm = form.strichCm ?? (form.strichMm ?? 0.25) * (massstab / 10);
    const gesamt =
      (form.deckkraft ?? 1) * Math.min(pdfDeckkraft(form.fuellung), pdfDeckkraft(form.linie));
    const stufe = gesamt < 0.999 ? nameFuer(Math.round(gesamt * 100) / 100) : undefined;

    if (form.beschnitten && umrissPfad) {
      zeilen.push('q');
      zeilen.push(pfadZuPdf(umrissPfad));
      zeilen.push('W n');
      zeilen.push(formZuPdf(form, strichCm, stufe));
      zeilen.push('Q');
    } else {
      zeilen.push(formZuPdf(form, strichCm, stufe));
    }
  }

  const mindestensCm = (MINDEST_SCHRIFT_MM * massstab) / 10;
  for (const text of vektor.texte) {
    if (text.groesse < mindestensCm) continue;
    zeilen.push(textZuPdf(text));
  }
  zeilen.push('Q');

  // ------------------------------------------- Schriftfeld, Balken, Legende
  zeilen.push(...pdfBeiwerk(blatt, massstab, schriftfeld, platz, auftrag, projekt));

  zeilen.push('Q');
  return { inhalt: zeilen.join('\n'), deckkraft: stufen };
}

/** Punkte je Millimeter – PDF misst in Zweiundsiebzigsteln eines Zolls. */
const MM = 72 / 25.4;

/** Das Beiwerk am Blattrand, in Millimetern. */
function pdfBeiwerk(
  blatt: Blattmasse,
  massstab: number,
  feld: Schriftfeld,
  platz: { x: number; y: number; breite: number; hoehe: number },
  auftrag: Blattauftrag,
  projekt: Projekt,
): string[] {
  const zeilen: string[] = [];
  const y = blatt.hoeheMm - blatt.randMm - SCHRIFTFELD_HOEHE;
  const breite = blatt.breiteMm - blatt.randMm * 2;

  // Der Rahmen des Schriftfelds.
  zeilen.push('q');
  zeilen.push('0.149 0.192 0.239 RG');
  zeilen.push('0.3 w');
  zeilen.push(
    pfadZuPdf(
      `M ${n(blatt.randMm)} ${n(y)} L ${n(blatt.randMm + breite)} ${n(y)} ` +
        `L ${n(blatt.randMm + breite)} ${n(y + SCHRIFTFELD_HOEHE)} ` +
        `L ${n(blatt.randMm)} ${n(y + SCHRIFTFELD_HOEHE)} Z`,
    ),
  );
  zeilen.push('S');
  zeilen.push('Q');

  const schrift = (
    text: string,
    x: number,
    zy: number,
    groesse: number,
    anker: 'anfang' | 'ende',
    farbe = '#26313d',
  ) =>
    textZuPdf({
      text,
      x: anker === 'ende' ? x - textbreite(text, groesse) : x,
      y: zy,
      groesse,
      farbe,
      anker: 'anfang',
      // **Wie im SVG.** Dort steht an diesen Texten kein `dominant-baseline`,
      // sie sitzen also auf ihrer Grundlinie. Ohne diese Angabe griffe hier
      // die Mitte, und Schriftfeld, Legende und Maßstabsbalken stünden im PDF
      // um ein bis zwei Millimeter anders als im SVG desselben Blattes.
      grundlinie: 'alphabetic',
    });

  zeilen.push(schrift(feld.markt, blatt.randMm + 4, y + 9, 6, 'anfang'));
  if (feld.zusatz) zeilen.push(schrift(feld.zusatz, blatt.randMm + 4, y + 17, 3.6, 'anfang', '#5d6874'));
  const rechts = blatt.breiteMm - blatt.randMm - 4;
  zeilen.push(schrift(`Maßstab 1:${massstab}`, rechts, y + 9, 5, 'ende'));
  const unten = [feld.gezeichnetVon, feld.datum].filter(Boolean).join('  ·  ');
  if (unten) zeilen.push(schrift(unten, rechts, y + 17, 3.6, 'ende', '#5d6874'));

  // Der Maßstabsbalken.
  if (auftrag.mitMassstabsbalken !== false) {
    const meter = balkenlaengeM(platz.breite, massstab);
    const laengeMm = (meter * 1000) / massstab;
    const bx = blatt.randMm + 4;
    const by = y - 6;
    zeilen.push('q');
    zeilen.push('0.149 0.192 0.239 rg');
    zeilen.push(pfadZuPdf(`M ${n(bx)} ${n(by)} L ${n(bx + laengeMm / 2)} ${n(by)} L ${n(bx + laengeMm / 2)} ${n(by + 1.6)} L ${n(bx)} ${n(by + 1.6)} Z`));
    zeilen.push('f');
    zeilen.push('0.149 0.192 0.239 RG');
    zeilen.push('0.2 w');
    zeilen.push(pfadZuPdf(`M ${n(bx + laengeMm / 2)} ${n(by)} L ${n(bx + laengeMm)} ${n(by)} L ${n(bx + laengeMm)} ${n(by + 1.6)} L ${n(bx + laengeMm / 2)} ${n(by + 1.6)} Z`));
    zeilen.push('S');
    zeilen.push('Q');
    zeilen.push(schrift(`${meter} m`, bx + laengeMm + 2, by + 1.6, 3.2, 'anfang'));
  }

  // Die Legende.
  if (auftrag.mitLegende !== false) {
    const kategorien = benutzteKategorien(projekt);
    let ly = blatt.randMm + 6;
    const lx = blatt.breiteMm - blatt.randMm - LEGENDE_BREITE + 2;
    if (kategorien.length > 0) {
      zeilen.push(schrift('Abteilungen', lx, ly, 4, 'anfang'));
      ly += 6;
      for (const k of kategorien) {
        const farbe = pdfFarbe(k.farbe);
        if (farbe) {
          zeilen.push('q');
          zeilen.push(`${farbe.map(n).join(' ')} rg`);
          zeilen.push('0.149 0.192 0.239 RG');
          zeilen.push('0.2 w');
          zeilen.push(pfadZuPdf(`M ${n(lx)} ${n(ly - 3)} L ${n(lx + 4)} ${n(ly - 3)} L ${n(lx + 4)} ${n(ly + 1)} L ${n(lx)} ${n(ly + 1)} Z`));
          zeilen.push('B');
          zeilen.push('Q');
        }
        zeilen.push(schrift(k.name, lx + 6, ly, 3.4, 'anfang'));
        ly += 6;
      }
    }
  }
  return zeilen;
}

function n(wert: number): string {
  return (Math.round(wert * 1000) / 1000).toString();
}
