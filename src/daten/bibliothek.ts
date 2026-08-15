import type { BibliothekEintrag } from '../typen/modell';

/**
 * Die mitgelieferte Elementbibliothek.
 *
 * Alle Maße sind in Zentimetern angegeben und entsprechen üblichen Größen im
 * Lebensmitteleinzelhandel. Sie sind nur Startwerte – nach dem Platzieren kann
 * jedes Element frei verändert werden.
 *
 * Die allgemeinen Einträge benutzen einfache Grundformen. Daneben stehen
 * nachgezeichnete Wanzl-Symbole (BakeOff, Vitable) mit den Maßen aus den
 * zugehörigen Workbooks – erkennbar an der Form, die den Systemnamen trägt.
 * Für ein neues Symbol muss nur `Grundform` erweitert und in
 * `ElementSymbol.tsx` ein weiterer Fall ergänzt werden.
 */

/**
 * Das Grün der Obst- und Gemüsemöbel, abgenommen aus dem Wanzl-Plan.
 * Steht als eigener Wert hier oben, weil es in vielen Einträgen vorkommt.
 */
const OG_GRUEN = '#1a7a1a';

/** Die Lilatöne der Tiefkühlmöbel – Truhe, Kombigerät, Kopfstück. */
const TK_LILA = '#a78ecf';
const TK_LILA_HELL = '#c2aee6';
const TK_LILA_DUNKEL = '#8a70b8';

/**
 * Die Vitable-Varianten aus dem Workbook, Seiten 12 und 13.
 *
 * Der Katalog führt jede Variante als Höhe mit einer Auflagenkette:
 * „H 1800 / T 800 + T600 + T400" heißt unterste Auflage 800 tief, darüber
 * 600, oben 400. Jede davon gibt es in beiden Achsmaßen, 1000 und 1250 mm.
 *
 * Die Liste steht hier als Tabelle und wird darunter ausmultipliziert. Von
 * Hand geschrieben wären es achtzig Zeilen, in denen früher oder später eine
 * Variante fehlt oder ein Maß nicht zum Namen passt.
 */
interface VitableVariante {
  /** Höhe in cm. */
  hoehe: number;
  /** Auflagentiefen in cm, tiefste zuerst. */
  stufen: number[];
  /** Zusatz wie „Cross-Selling", „Spiegel" oder „Klappetage". */
  zusatz?: string;
  /** Beidseitige Gondel statt einseitigem Wandmöbel. */
  beidseitig?: boolean;
}

const VITABLE_VARIANTEN: VitableVariante[] = [
  // Seite 12 – H1800 und H1600
  { hoehe: 180, stufen: [120, 60] },
  { hoehe: 180, stufen: [80, 60, 60] },
  { hoehe: 180, stufen: [80, 60, 40] },
  { hoehe: 160, stufen: [120, 60] },
  { hoehe: 160, stufen: [80, 60] },
  { hoehe: 160, stufen: [80, 40] },
  { hoehe: 160, stufen: [80, 60, 60] },
  { hoehe: 160, stufen: [80, 60, 40] },
  { hoehe: 160, stufen: [120], zusatz: 'Cross-Selling' },
  { hoehe: 160, stufen: [120], zusatz: 'Spiegel' },
  { hoehe: 160, stufen: [120], zusatz: 'Klappetage' },
  // Seite 13 – H1300 und H1100
  { hoehe: 130, stufen: [120] },
  { hoehe: 130, stufen: [80] },
  { hoehe: 130, stufen: [80, 60] },
  { hoehe: 130, stufen: [80, 40] },
  { hoehe: 110, stufen: [80] },
  { hoehe: 110, stufen: [80, 60] },
  { hoehe: 110, stufen: [80, 40] },
  // Beidseitige Gondeln
  { hoehe: 130, stufen: [120], beidseitig: true },
  { hoehe: 110, stufen: [80], beidseitig: true },
];

/**
 * Korpus- und Gesamttiefe je nach tiefster Auflage und Bauart, in cm.
 * Abgelesen aus den Schnittzeichnungen im Workbook.
 */
function vitableTiefen(tiefsteAuflage: number, beidseitig: boolean) {
  if (beidseitig) {
    return tiefsteAuflage >= 120
      ? { tiefe: 255.4, korpustiefe: 173.4 }
      : { tiefe: 182.9, korpustiefe: 137.2 };
  }
  return tiefsteAuflage >= 120
    ? { tiefe: 131.7, korpustiefe: 90.8 }
    : { tiefe: 95.5, korpustiefe: 72.6 };
}

/** Schreibt die Auflagenkette so, wie sie im Workbook steht: „T800+600+400". */
function stufenText(stufen: number[]): string {
  return stufen.map((s, i) => (i === 0 ? `T${s * 10}` : `${s * 10}`)).join('+');
}

/** Multipliziert die Variantentabelle mit den beiden Achsmaßen aus. */
function vitableEintraege(): BibliothekEintrag[] {
  const eintraege: BibliothekEintrag[] = [];
  for (const variante of VITABLE_VARIANTEN) {
    for (const breite of [100, 125]) {
      const tiefste = Math.max(...variante.stufen);
      const { tiefe, korpustiefe } = vitableTiefen(tiefste, Boolean(variante.beidseitig));
      const art = variante.beidseitig ? 'Gondel ' : '';
      const zusatz = variante.zusatz ? ` + ${variante.zusatz}` : '';
      const kennung = [
        'vt',
        variante.beidseitig ? 'gondel' : 'wand',
        breite,
        `h${variante.hoehe * 10}`,
        variante.stufen.join('-'),
        variante.zusatz?.toLowerCase().replace(/[^a-z]/g, '') ?? '',
      ]
        .filter(Boolean)
        .join('-');

      eintraege.push({
        id: kennung,
        name: `O&G ${art}${(breite / 100).toFixed(2).replace('.', ',')} m · H${variante.hoehe * 10} · ${stufenText(variante.stufen)}${zusatz}`,
        kategorie: 'obstgemuese',
        breite,
        tiefe,
        korpustiefe,
        hoehe: variante.hoehe,
        form: 'vitable',
        farbe: OG_GRUEN,
        stufen: variante.stufen,
        beidseitig: variante.beidseitig,
        // Die Höhe ist das, wonach man beim Planen zuerst greift: Ob ein
        // Möbel 1,10 m oder 1,80 m hoch ist, entscheidet über die Sichtachsen
        // im Markt. Deshalb gruppiert die Bibliothek danach.
        gruppe: variante.beidseitig ? 'Beidseitige Gondeln' : `Höhe ${variante.hoehe * 10}`,
        hinweis: `${variante.stufen.length}-etagig · Korpus ${Math.round(korpustiefe * 10)} mm, Gesamttiefe ${Math.round(tiefe * 10)} mm`,
      });
    }
  }
  return eintraege;
}

export const BIBLIOTHEK: BibliothekEintrag[] = [
  // ---------------------------------------------------------------- Regale
  { id: 'regal-trocken', name: 'Trockensortimentsregal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 200, form: 'rechteck', farbe: '#d9d0c1', hinweis: 'Einseitiges Regalfeld, 125 cm' },
  { id: 'regal-wand', name: 'Wandregal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 220, form: 'rechteck', farbe: '#d4c9b6', hinweis: 'Regal an der Außenwand' },
  { id: 'regal-gondel', name: 'Gondelregal', kategorie: 'regale', breite: 125, tiefe: 120, hoehe: 180, form: 'rechteck', farbe: '#cfc3ad', hinweis: 'Doppelseitiges Regal in der Gasse' },
  { id: 'regal-kopf', name: 'Kopfregal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 180, form: 'rechteck', farbe: '#e2d6c2', hinweis: 'Stirnseite einer Gondel' },
  { id: 'regal-getraenke', name: 'Getränkeregal', kategorie: 'regale', breite: 125, tiefe: 80, hoehe: 180, form: 'rechteck', farbe: '#cdd3c0', hinweis: 'Für Kästen und Mehrwegflaschen' },
  { id: 'regal-wein', name: 'Weinregal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 200, form: 'rechteck', farbe: '#cbbfae' },
  { id: 'regal-drogerie', name: 'Drogerieregal', kategorie: 'regale', breite: 125, tiefe: 50, hoehe: 200, form: 'rechteck', farbe: '#ded5c7' },
  { id: 'regal-nonfood', name: 'Non-Food-Regal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 200, form: 'rechteck', farbe: '#d7cdbd' },
  { id: 'regal-brot', name: 'Brotregal', kategorie: 'regale', breite: 100, tiefe: 80, hoehe: 180, form: 'rechteck', farbe: '#e3d3b6' },
  { id: 'regal-zeitschriften', name: 'Zeitschriftenregal', kategorie: 'regale', breite: 125, tiefe: 50, hoehe: 160, form: 'rechteck', farbe: '#dcd4c6' },

  // ------------------------------------------------ Kühlung & Tiefkühlung
  { id: 'kuehl-regal', name: 'Kühlregal', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#b9d7ea', hinweis: 'Offenes Kühlregal' },
  { id: 'kuehl-wand', name: 'Wandkühlregal', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#aecfe4' },
  { id: 'kuehl-gondel', name: 'Kühlgondel', kategorie: 'kuehlung', breite: 250, tiefe: 110, hoehe: 120, form: 'abgerundet', farbe: '#a5c9e0' },
  { id: 'tk-truhe', name: 'Tiefkühltruhe', kategorie: 'kuehlung', breite: 200, tiefe: 90, hoehe: 90, form: 'abgerundet', farbe: '#94bedb', hinweis: 'Waagerechte Truhe' },
  { id: 'tk-schrank', name: 'Tiefkühlschrank', kategorie: 'kuehlung', breite: 125, tiefe: 90, hoehe: 200, form: 'rechteck', farbe: '#88b6d6', hinweis: 'Stehender TK-Schrank mit Glastüren' },
  { id: 'kuehl-molkerei', name: 'Molkereiprodukte-Kühlung', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#c3ddec' },
  { id: 'kuehl-fleisch-sb', name: 'Fleisch-SB-Kühlung', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#d9c2c8' },
  { id: 'kuehl-wurst-sb', name: 'Wurst-SB-Kühlung', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#dcc8cd' },
  { id: 'kuehl-getraenke', name: 'Getränke-Kühlung', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#b0d4e6' },

  // ------------------------------------------------------ Frischeabteilung
  { id: 'frische-og-flaeche', name: 'Obst- und Gemüsefläche', kategorie: 'obstgemuese', breite: 500, tiefe: 400, hoehe: 0, form: 'rechteck', farbe: '#cfe4c2', hinweis: 'Gesamte O&G-Zone als Fläche – Zonenmarkierung, kein Möbel', gruppe: 'Frei' },
  { id: 'theke-fleisch', name: 'Fleischtheke', kategorie: 'frische', breite: 250, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#e2bdbd' },
  { id: 'theke-wurst', name: 'Wursttheke', kategorie: 'frische', breite: 250, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#e5c6c2' },
  { id: 'theke-kaese', name: 'Käsetheke', kategorie: 'frische', breite: 200, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#eeddb4' },
  { id: 'theke-fisch', name: 'Fischtheke', kategorie: 'frische', breite: 200, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#c2dbe2' },
  { id: 'theke-backwaren', name: 'Backwarentheke', kategorie: 'frische', breite: 250, tiefe: 100, hoehe: 130, form: 'rechteck', farbe: '#e6cfa4', hinweis: 'Bedientheke – für Selbstbedienung siehe Backwaren' },
  { id: 'frische-salatbar', name: 'Salatbar', kategorie: 'frische', breite: 150, tiefe: 100, hoehe: 120, form: 'abgerundet', farbe: '#cbe3bb' },
  { id: 'theke-heiss', name: 'Heiße Theke', kategorie: 'frische', breite: 200, tiefe: 100, hoehe: 130, form: 'rechteck', farbe: '#e7c39c' },

  // ---------------------------------------------------------- Tiefkühlung
  //
  // WSL Refrigeration (Wanzl), Produktkatalog 2026, Seiten 24 bis 29.
  // Alle Maße in Millimetern aus den Datentabellen, hier in Zentimetern.
  //
  //   Eclipse Remote  – Schrank    T 940,  H 2010/2210, L 1562/2343/3124/3898
  //   Eclipse Combo   – Kombi      T 1145, H 2098/2298, L 1875/2500/3750
  //   Eclipse Island  – Truhe      T 1532/2022, H 986,  L 1875/2500/3750
  //
  // Die Truhenlängen sind genau 3, 4 und 6 Module à 625 mm – deshalb zeichnet
  // das Symbol diese Teilung mit, und deshalb lässt sich eine Truhe in
  // 62,5er-Schritten verlängern.

  // ---- Truhen (Eclipse Island)
  { id: 'tk-truhe-1532-1875', name: 'TK-Truhe 1,88 m · T1532', kategorie: 'tiefkuehlung', breite: 187.5, tiefe: 153.2, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Truhen T1532', hinweis: '3 Module à 625 mm · Auslage 604 mm je Seite' },
  { id: 'tk-truhe-1532-2500', name: 'TK-Truhe 2,50 m · T1532', kategorie: 'tiefkuehlung', breite: 250, tiefe: 153.2, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Truhen T1532', hinweis: '4 Module à 625 mm' },
  { id: 'tk-truhe-1532-3750', name: 'TK-Truhe 3,75 m · T1532', kategorie: 'tiefkuehlung', breite: 375, tiefe: 153.2, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Truhen T1532', hinweis: '6 Module à 625 mm' },
  { id: 'tk-truhe-2022-1875', name: 'TK-Truhe 1,88 m · T2022', kategorie: 'tiefkuehlung', breite: 187.5, tiefe: 202.2, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Truhen T2022', hinweis: '3 Module à 625 mm · Auslage 850 mm je Seite' },
  { id: 'tk-truhe-2022-2500', name: 'TK-Truhe 2,50 m · T2022', kategorie: 'tiefkuehlung', breite: 250, tiefe: 202.2, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Truhen T2022', hinweis: '4 Module à 625 mm' },
  { id: 'tk-truhe-2022-3750', name: 'TK-Truhe 3,75 m · T2022', kategorie: 'tiefkuehlung', breite: 375, tiefe: 202.2, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Truhen T2022', hinweis: '6 Module à 625 mm' },
  // Kopfstück am Ende einer Truhenzeile. Seine Länge entspricht der Tiefe.
  { id: 'tk-truhe-kopf-1532', name: 'TK-Truhe Kopfstück · T1532', kategorie: 'tiefkuehlung', breite: 62.5, tiefe: 153.2, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA_DUNKEL, gruppe: 'Truhen T1532', hinweis: 'Kopfstück, im Katalog 1532 mm einschließlich Seitenwänden' },
  { id: 'tk-truhe-kopf-2022', name: 'TK-Truhe Kopfstück · T2022', kategorie: 'tiefkuehlung', breite: 62.5, tiefe: 202.2, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA_DUNKEL, gruppe: 'Truhen T2022', hinweis: 'Kopfstück, im Katalog 2022 mm einschließlich Seitenwänden' },

  // ---- Schränke (Eclipse Remote)
  { id: 'tk-schrank-h2010-2t', name: 'TK-Schrank 1,56 m · 2 Türen · H2010', kategorie: 'tiefkuehlung', breite: 156.2, tiefe: 94, hoehe: 201, form: 'tkSchrank', farbe: TK_LILA, gruppe: 'Schränke H2010', hinweis: 'Auslage 1531 mm, Etagentiefe 600 mm' },
  { id: 'tk-schrank-h2010-3t', name: 'TK-Schrank 2,34 m · 3 Türen · H2010', kategorie: 'tiefkuehlung', breite: 234.3, tiefe: 94, hoehe: 201, form: 'tkSchrank', farbe: TK_LILA, gruppe: 'Schränke H2010' },
  { id: 'tk-schrank-h2010-4t', name: 'TK-Schrank 3,12 m · 4 Türen · H2010', kategorie: 'tiefkuehlung', breite: 312.4, tiefe: 94, hoehe: 201, form: 'tkSchrank', farbe: TK_LILA, gruppe: 'Schränke H2010' },
  { id: 'tk-schrank-h2010-5t', name: 'TK-Schrank 3,90 m · 5 Türen · H2010', kategorie: 'tiefkuehlung', breite: 389.8, tiefe: 94, hoehe: 201, form: 'tkSchrank', farbe: TK_LILA, gruppe: 'Schränke H2010' },
  { id: 'tk-schrank-h2210-2t', name: 'TK-Schrank 1,56 m · 2 Türen · H2210', kategorie: 'tiefkuehlung', breite: 156.2, tiefe: 94, hoehe: 221, form: 'tkSchrank', farbe: TK_LILA, gruppe: 'Schränke H2210', hinweis: 'Auslage 1731 mm, Etagentiefe 600 mm' },
  { id: 'tk-schrank-h2210-3t', name: 'TK-Schrank 2,34 m · 3 Türen · H2210', kategorie: 'tiefkuehlung', breite: 234.3, tiefe: 94, hoehe: 221, form: 'tkSchrank', farbe: TK_LILA, gruppe: 'Schränke H2210' },
  { id: 'tk-schrank-h2210-4t', name: 'TK-Schrank 3,12 m · 4 Türen · H2210', kategorie: 'tiefkuehlung', breite: 312.4, tiefe: 94, hoehe: 221, form: 'tkSchrank', farbe: TK_LILA, gruppe: 'Schränke H2210' },
  { id: 'tk-schrank-h2210-5t', name: 'TK-Schrank 3,90 m · 5 Türen · H2210', kategorie: 'tiefkuehlung', breite: 389.8, tiefe: 94, hoehe: 221, form: 'tkSchrank', farbe: TK_LILA, gruppe: 'Schränke H2210' },

  // ---- Kombigeräte (Eclipse Combo): Schrank oben, offene Wanne vorn
  { id: 'tk-kombi-h2098-1875', name: 'TK-Kombi 1,88 m · H2098', kategorie: 'tiefkuehlung', breite: 187.5, tiefe: 114.5, hoehe: 209.8, form: 'tkKombi', farbe: TK_LILA_HELL, gruppe: 'Kombigeräte', hinweis: 'Oben Schrank (Auslage 852 mm), vorn Wanne (846 mm tief)' },
  { id: 'tk-kombi-h2098-2500', name: 'TK-Kombi 2,50 m · H2098', kategorie: 'tiefkuehlung', breite: 250, tiefe: 114.5, hoehe: 209.8, form: 'tkKombi', farbe: TK_LILA_HELL, gruppe: 'Kombigeräte' },
  { id: 'tk-kombi-h2098-3750', name: 'TK-Kombi 3,75 m · H2098', kategorie: 'tiefkuehlung', breite: 375, tiefe: 114.5, hoehe: 209.8, form: 'tkKombi', farbe: TK_LILA_HELL, gruppe: 'Kombigeräte' },
  { id: 'tk-kombi-h2298-1875', name: 'TK-Kombi 1,88 m · H2298', kategorie: 'tiefkuehlung', breite: 187.5, tiefe: 114.5, hoehe: 229.8, form: 'tkKombi', farbe: TK_LILA_HELL, gruppe: 'Kombigeräte', hinweis: 'Oben Schrank (Auslage 1052 mm), vorn Wanne (846 mm tief)' },
  { id: 'tk-kombi-h2298-2500', name: 'TK-Kombi 2,50 m · H2298', kategorie: 'tiefkuehlung', breite: 250, tiefe: 114.5, hoehe: 229.8, form: 'tkKombi', farbe: TK_LILA_HELL, gruppe: 'Kombigeräte' },
  { id: 'tk-kombi-h2298-3750', name: 'TK-Kombi 3,75 m · H2298', kategorie: 'tiefkuehlung', breite: 375, tiefe: 114.5, hoehe: 229.8, form: 'tkKombi', farbe: TK_LILA_HELL, gruppe: 'Kombigeräte' },

  // ---- Frei einstellbar
  { id: 'tk-truhe-frei', name: 'TK-Truhe frei', kategorie: 'tiefkuehlung', breite: 312.5, tiefe: 153.2, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Frei', hinweis: 'Länge in Schritten von 62,5 cm eintragen – das Symbol teilt sich danach' },
  { id: 'tk-schrank-frei', name: 'TK-Schrank frei', kategorie: 'tiefkuehlung', breite: 234.3, tiefe: 94, hoehe: 201, form: 'tkSchrank', farbe: TK_LILA, gruppe: 'Frei', hinweis: 'Die Zahl der Türen ergibt sich aus der Länge (rund 78 cm je Tür)' },
  { id: 'tk-kombi-frei', name: 'TK-Kombi frei', kategorie: 'tiefkuehlung', breite: 250, tiefe: 114.5, hoehe: 209.8, form: 'tkKombi', farbe: TK_LILA_HELL, gruppe: 'Frei' },

  // ------------------------------------------------------- Obst und Gemüse
  //
  // Vitable von Wanzl, Workbook Version 38 / 10-2025.
  //
  // Die geraden Möbel entstehen oben aus der Variantentabelle: jede der
  // 20 Varianten des Katalogs in beiden Achsmaßen, 1000 und 1250 mm.
  //
  // Wichtig bei den Tiefen: Die Front kragt über den Korpus hinaus. Das Feld
  // "tiefe" ist der Platzbedarf am Boden, "korpustiefe" das, was darauf steht.
  ...vitableEintraege(),

  // Ecken, Abschlüsse und Gondelköpfe. Für diese Bausteine nennt das Workbook
  // keine eigenen Maße – sie übernehmen die des geraden Möbels, an das sie
  // anschließen.
  { id: 'vt-eck-innen-800', name: 'O&G Inneneck 45° · T800', kategorie: 'obstgemuese', breite: 95.5, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitableEckInnen', farbe: OG_GRUEN, stufen: [80, 60, 40], hinweis: 'Zwei davon ergeben ein Inneneck 90°. Danach muss eine gerade Einheit folgen.', gruppe: 'Ecken und Abschlüsse' },
  { id: 'vt-eck-innen-1200', name: 'O&G Inneneck 45° · T1200', kategorie: 'obstgemuese', breite: 131.7, tiefe: 131.7, korpustiefe: 90.8, hoehe: 180, form: 'vitableEckInnen', farbe: OG_GRUEN, stufen: [120, 60], gruppe: 'Ecken und Abschlüsse' },
  { id: 'vt-eck-aussen', name: 'O&G Außeneck 90°', kategorie: 'obstgemuese', breite: 95.5, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitableEckAussen', farbe: OG_GRUEN, gruppe: 'Ecken und Abschlüsse' },
  { id: 'vt-abschluss-800', name: 'O&G Abschluss gerade · T800', kategorie: 'obstgemuese', breite: 95.5, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitableAbschluss', farbe: OG_GRUEN, stufen: [80, 60, 40], hinweis: 'Abschluss 90° – gerader Kopf am Ende eines Zuges', gruppe: 'Ecken und Abschlüsse' },
  { id: 'vt-abschluss-1200', name: 'O&G Abschluss gerade · T1200', kategorie: 'obstgemuese', breite: 131.7, tiefe: 131.7, korpustiefe: 90.8, hoehe: 180, form: 'vitableAbschluss', farbe: OG_GRUEN, stufen: [120, 60], gruppe: 'Ecken und Abschlüsse' },
  { id: 'vt-kopf-rund-800', name: 'O&G Kopfgondel rund · T800', kategorie: 'obstgemuese', breite: 95.5, tiefe: 182.9, korpustiefe: 137.2, hoehe: 180, form: 'vitableAbschlussRund', farbe: OG_GRUEN, stufen: [80, 60, 40], beidseitig: true, hinweis: 'Abschluss 180° – runder Kopf einer freistehenden Gondel', gruppe: 'Ecken und Abschlüsse' },
  { id: 'vt-kopf-rund-1200', name: 'O&G Kopfgondel rund · T1200', kategorie: 'obstgemuese', breite: 131.7, tiefe: 255.4, korpustiefe: 173.4, hoehe: 180, form: 'vitableAbschlussRund', farbe: OG_GRUEN, stufen: [120, 60], beidseitig: true, gruppe: 'Ecken und Abschlüsse' },

  // Das freie Element: gleiches Symbol, alle Maße selbst bestimmbar.
  { id: 'vt-frei', name: 'O&G frei', kategorie: 'obstgemuese', breite: 200, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitable', farbe: OG_GRUEN, stufen: [80, 60, 40], hinweis: 'Maße, Korpustiefe und Stufen frei einstellbar', gruppe: 'Frei' },

  // ------------------------------------------------------------ Backwaren
  //
  // BakeOff 3.0 von Wanzl. Maße aus dem Workbook (Version 18 / 08-2025):
  // Der Backwarenturm gibt es in genau einer Größe – 1000 x 1855 x 885 mm
  // (Breite x Höhe x Tiefe). Die Varianten unterscheiden sich nicht im Maß,
  // sondern in der Ausstattung. Deshalb ist die Breite hier überall 100 cm:
  // Eine 5-Meter-Zeile sind fünf Türme nebeneinander.
  { id: 'bakeoff-turm', name: 'BakeOff-Turm', kategorie: 'backwaren', breite: 100, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d8bc98', hinweis: 'Grundmodul BO3.0 01.001 – 1000 x 1855 x 885 mm', gruppe: 'Türme' },
  { id: 'bakeoff-turm-strom', name: 'BakeOff-Turm mit Strom', kategorie: 'backwaren', breite: 100, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d0ad82', hinweis: 'Stromführend, Anschluss 230 V – BO3.0 01.002', gruppe: 'Türme' },
  { id: 'bakeoff-turm-schneider', name: 'BakeOff-Turm Brotschneider', kategorie: 'backwaren', breite: 100, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d0ad82', hinweis: 'Für Brotschneidemaschine – BO3.0 01.003', gruppe: 'Türme' },
  { id: 'bakeoff-turm-einzel', name: 'BakeOff-Turm einzeln', kategorie: 'backwaren', breite: 100, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d8bc98', hinweis: 'Stand-Alone, freistehend – BO3.0 01.004', gruppe: 'Türme' },
  { id: 'bakeoff-ecke', name: 'BakeOff-Eckstück 45°', kategorie: 'backwaren', breite: 88.5, tiefe: 88.5, hoehe: 185.5, form: 'bakeoffEcke', farbe: '#c49a6c', hinweis: 'Füllt die Ecke, wenn die Zeile abknickt', gruppe: 'Ecken und Anbauten' },
  { id: 'bakeoff-ablage', name: 'Klappbare Ablage', kategorie: 'backwaren', breite: 100, tiefe: 40, hoehe: 90, form: 'rechteck', farbe: '#e8dcc8', hinweis: 'Vor der Zeile, im Plan gestrichelt', gruppe: 'Ecken und Anbauten' },
  // Das freie Element: gleiches Symbol, aber alle Maße selbst bestimmbar –
  // für Sonderbauten und für alles, was das Workbook nicht hergibt.
  { id: 'bakeoff-frei', name: 'BakeOff frei', kategorie: 'backwaren', breite: 200, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d8bc98', hinweis: 'Maße frei einstellbar – Breite, Tiefe und Höhe rechts eintragen', gruppe: 'Frei' },

  // ------------------------------------------------------ Kassen & Eingang
  { id: 'kasse-normal', name: 'Kasse', kategorie: 'kassen', breite: 300, tiefe: 100, hoehe: 110, form: 'rechteck', farbe: '#f5dda0', hinweis: 'Bediente Kasse mit Warenband' },
  { id: 'kasse-sb', name: 'Selbstbedienungskasse', kategorie: 'kassen', breite: 100, tiefe: 100, hoehe: 140, form: 'rechteck', farbe: '#f7e5b8', hinweis: 'SB-Kasse' },
  { id: 'kassentisch', name: 'Kassentisch', kategorie: 'kassen', breite: 200, tiefe: 80, hoehe: 90, form: 'rechteck', farbe: '#efdcaa' },
  { id: 'kassensperre', name: 'Kassensperre', kategorie: 'kassen', breite: 100, tiefe: 15, hoehe: 100, form: 'rechteck', farbe: '#c9b47a' },
  { id: 'eingangsbereich', name: 'Eingangsbereich', kategorie: 'kassen', breite: 300, tiefe: 200, hoehe: 0, form: 'rechteck', farbe: '#d8e6c8' },
  { id: 'ausgangsbereich', name: 'Ausgangsbereich', kategorie: 'kassen', breite: 300, tiefe: 200, hoehe: 0, form: 'rechteck', farbe: '#e6d8c8' },
  { id: 'einkaufswagenbox', name: 'Einkaufswagenbox', kategorie: 'kassen', breite: 200, tiefe: 120, hoehe: 100, form: 'abgerundet', farbe: '#dfe3e6' },
  { id: 'kundendienst', name: 'Kundendienst', kategorie: 'kassen', breite: 200, tiefe: 100, hoehe: 110, form: 'rechteck', farbe: '#f1e2bb' },
  { id: 'information', name: 'Information', kategorie: 'kassen', breite: 150, tiefe: 80, hoehe: 110, form: 'rechteck', farbe: '#f1e2bb' },
  { id: 'leergutautomat', name: 'Leergutautomat', kategorie: 'kassen', breite: 120, tiefe: 100, hoehe: 200, form: 'rechteck', farbe: '#cddac2' },

  // -------------------------------------------- Aktions- & Sonderflächen
  { id: 'aktionsflaeche', name: 'Aktionsfläche', kategorie: 'aktion', breite: 200, tiefe: 200, hoehe: 0, form: 'rechteck', farbe: '#f0c4b3' },
  { id: 'aktionspalette', name: 'Aktionspalette', kategorie: 'aktion', breite: 120, tiefe: 80, hoehe: 120, form: 'rechteck', farbe: '#e8b49f', hinweis: 'Europalette 120 × 80 cm' },
  { id: 'display', name: 'Display', kategorie: 'aktion', breite: 80, tiefe: 60, hoehe: 150, form: 'rechteck', farbe: '#eebda9' },
  { id: 'schuette', name: 'Schütte', kategorie: 'aktion', breite: 100, tiefe: 80, hoehe: 90, form: 'abgerundet', farbe: '#f2cdbe' },
  { id: 'kuehldisplay', name: 'Kühldisplay', kategorie: 'aktion', breite: 100, tiefe: 80, hoehe: 120, form: 'abgerundet', farbe: '#c8d9e4' },
  { id: 'saisonflaeche', name: 'Saisonfläche', kategorie: 'aktion', breite: 300, tiefe: 300, hoehe: 0, form: 'rechteck', farbe: '#f4d3c4' },
  { id: 'verkostungsstand', name: 'Verkostungsstand', kategorie: 'aktion', breite: 120, tiefe: 80, hoehe: 110, form: 'abgerundet', farbe: '#eec6ae' },

  // ------------------------------------------------------ Weitere Ausstattung
  { id: 'saeule', name: 'Säule', kategorie: 'ausstattung', breite: 40, tiefe: 40, hoehe: 300, form: 'kreis', farbe: '#b9bec4', hinweis: 'Tragende Säule' },
  { id: 'treppe', name: 'Treppe', kategorie: 'ausstattung', breite: 300, tiefe: 120, hoehe: 0, form: 'rechteck', farbe: '#cfd4d9' },
  { id: 'aufzug', name: 'Aufzug', kategorie: 'ausstattung', breite: 200, tiefe: 200, hoehe: 0, form: 'rechteck', farbe: '#c6ccd2' },
  { id: 'tuer', name: 'Tür', kategorie: 'ausstattung', breite: 100, tiefe: 15, hoehe: 210, form: 'rechteck', farbe: '#9aa4ae' },
  { id: 'fenster', name: 'Fenster', kategorie: 'ausstattung', breite: 150, tiefe: 15, hoehe: 150, form: 'rechteck', farbe: '#b6d3e2' },
  { id: 'sitzbereich', name: 'Sitzbereich', kategorie: 'ausstattung', breite: 300, tiefe: 200, hoehe: 0, form: 'abgerundet', farbe: '#dbd3c4' },
  { id: 'werbeschild', name: 'Werbeschild', kategorie: 'ausstattung', breite: 100, tiefe: 15, hoehe: 60, form: 'rechteck', farbe: '#f2d06b' },
  { id: 'bildschirm', name: 'Bildschirm', kategorie: 'ausstattung', breite: 80, tiefe: 12, hoehe: 50, form: 'rechteck', farbe: '#8d99a6' },
  { id: 'abfallbehaelter', name: 'Abfallbehälter', kategorie: 'ausstattung', breite: 60, tiefe: 60, hoehe: 90, form: 'kreis', farbe: '#b0b6bc' },
  { id: 'hubwagen', name: 'Hubwagenstellplatz', kategorie: 'ausstattung', breite: 200, tiefe: 100, hoehe: 0, form: 'rechteck', farbe: '#d9dde1' },
];

/** Sucht eine Vorlage. Gibt `undefined` zurück, wenn es sie nicht (mehr) gibt. */
export function findeVorlage(
  id: string,
  eigene: BibliothekEintrag[] = [],
): BibliothekEintrag | undefined {
  return [...BIBLIOTHEK, ...eigene].find((v) => v.id === id);
}
