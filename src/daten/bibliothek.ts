import type { BibliothekEintrag, Grundform, Punkt } from '../typen/modell';
import {
  GESTELL_HOEHE,
  GESTELL_LAENGEN,
  GESTELL_STAERKE,
  KISTE,
} from '../logik/getraenkekisten';

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

/**
 * Die Gelbtöne der Aktionsflächen.
 *
 * Die Fläche selbst ist hell, damit die Beschriftung darauf lesbar bleibt –
 * im Marktplan steht dort meist „Aktionsfläche". Paletten und Ständer sind
 * kräftiger: Sie sind Möbel und keine Zone, und sollen sich von der Fläche
 * abheben, auf der sie stehen.
 */
const AKTION_GELB = '#ffff99';

/**
 * Was in einer Aktionsfläche steht.
 *
 * Nicht der Name der Vorlage: „Aktionsfläche 2 x 2 m" wird in zwei Metern
 * Breite abgeschnitten, und die Maße stehen ohnehin am Element. Auf dem
 * Marktplan steht in so einer Zone das eine Wort – und wer will, schreibt
 * „Ostern" oder „Grillsaison" darüber.
 */
export const AKTION_TEXT = 'Aktionsfläche';

/**
 * Die Vorlage hinter dem Textwerkzeug in der Kopfzeile.
 *
 * Kein Möbel und keine Zone – eine Anmerkung im Plan: „Rampe frei halten",
 * „hier später Bake-Off". Sie steht nicht in der Bibliothek, weil man sie
 * dort nicht sucht; sie hängt am Werkzeug.
 */
export const TEXTFELD_VORLAGE: BibliothekEintrag = {
  id: 'textfeld',
  name: 'Textfeld',
  kategorie: 'ausstattung',
  breite: 240,
  tiefe: 60,
  hoehe: 0,
  form: 'textfeld',
  farbe: 'rgba(0,0,0,0)',
  standardBeschriftung: 'Text',
  gruppe: 'Beschriftung',
  hinweis: 'Freier Text im Plan – die Größe des Kastens bestimmt die Schrift',
};
export const SAISON_TEXT = 'Saisonfläche';
const PALETTE_GELB = '#cfc93f';
const STAENDER_GELB = '#e0cf52';

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
/**
 * Die Länge eines 45-Grad-Eckstücks im Verhältnis zu seiner Tiefe.
 *
 * Das Stück hat am Anschluss an den Zug die volle Tiefe und läuft zur Ecke
 * hin unter 45 Grad aus. Bei **halber Tiefe** treffen sich die Schrägen
 * zweier Stücke genau auf der Diagonalen der Eckfläche: Aus zwei Teilen wird
 * eine durchgehende Fase, und die Ecke ist lückenlos gefüllt.
 *
 * Das ist gerechnet, nicht geraten – aber die Breite bleibt am Element frei
 * einstellbar. Wer eine flachere Fase will, zieht die Stücke kürzer.
 */
const ECK_ANTEIL = 0.5;

const ECK_HINWEIS =
  'Sitzt am Ende eines Zuges und ist vorn schräg abgeschnitten. Zwei davon ' +
  'fasen die Ecke ab – das zweite seitenverkehrt einbauen (Schalter rechts).';

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

/**
 * Die Normalkühlung von WSL, Katalog 2026 Seiten 6 und 7.
 *
 *   Orion Remote Doors  – Hochkühlregal mit Glastür, 8 Ausführungen
 *   Orion Remote Open   – dasselbe offen, 8 Ausführungen
 *   Cloud Remote        – Stufenmöbel mit Tür, halbhoch
 *
 * Die acht Ausführungen sind vier Tiefen mal zwei Höhen. Der Katalog nennt
 * sie nach diesen beiden Maßen: „Orion Doors Remote 804x2090".
 *
 * Angegeben ist – wie bei der Tiefkühlung – das **äußere** Maß einschließlich
 * Stoßschutz, also der Platz am Boden. Der Korpus aus der Maßtabelle ist rund
 * 55 mm schmaler und 85 mm niedriger; beides steht im Hinweis.
 *
 * Das Modell Orion FV bleibt vorerst weg.
 */
const KUEHL_BLAU = '#4f97d4';
const KUEHL_BLAU_DUNKEL = '#2f6ea8';

const KUEHL_LAENGEN = [93.7, 125, 187.5, 250, 375];

/**
 * Die vier Tiefen des Orion.
 *
 * `aussen` ist das Maß mit Stoßschutz, so wie der Katalog das Möbel benennt;
 * `korpus` und `etage` stehen in der Maßtabelle auf Seite 6.
 *
 * `grundboden` steht dort **nicht**. Die Tabelle führt nur die Etagen, und
 * der Fließtext sagt allein „base shelf depth up to 800 mm". Die vier Werte
 * hier stammen aus dem Markt – Lukas' Angabe – und die größte deckt sich mit
 * den 800 mm des Katalogs. Sollte eine davon danebenliegen, ist es eine Zahl
 * in dieser Tabelle.
 */
const ORION_TIEFEN = [
  { aussen: 80.4, korpus: 750, etage: 400, grundboden: 48 },
  { aussen: 92.5, korpus: 870, etage: 500, grundboden: 60 },
  { aussen: 102.5, korpus: 970, etage: 550, grundboden: 70 },
  { aussen: 112.5, korpus: 1070, etage: 600, grundboden: 80 },
];

/** Die beiden Höhen, außen und als Korpusmaß mit Auslagenhöhe. */
const ORION_HOEHEN = [
  { aussen: 209, korpus: 2005, auslage: 1492 },
  { aussen: 229, korpus: 2205, auslage: 1692 },
];

function kuehlEintraege(): BibliothekEintrag[] {
  const eintraege: BibliothekEintrag[] = [];

  for (const tiefe of ORION_TIEFEN) {
    for (const hoehe of ORION_HOEHEN) {
      for (const mitTuer of [true, false]) {
        const tiefeMm = Math.round(tiefe.aussen * 10);
        const hoeheMm = Math.round(hoehe.aussen * 10);
        const art = mitTuer ? 'mit Tür' : 'offen';
        const modell = `Orion ${mitTuer ? 'Doors' : 'Open'} Remote ${tiefeMm}x${hoeheMm}`;
        for (const laenge of KUEHL_LAENGEN) {
          eintraege.push({
            id: `kuehl-orion-${mitTuer ? 'tuer' : 'offen'}-${tiefeMm}-${hoeheMm}-${Math.round(laenge * 10)}`,
            name: `Kühlregal ${(laenge / 100).toFixed(2).replace('.', ',')} m · ${art}`,
            kategorie: 'kuehlung',
            breite: laenge,
            tiefe: tiefe.aussen,
            hoehe: hoehe.aussen,
            korpustiefe: tiefe.korpus / 10,
            grundboden: tiefe.grundboden,
            form: mitTuer ? 'kuehlSchrank' : 'kuehlOffen',
            farbe: KUEHL_BLAU,
            gruppe: `${mitTuer ? 'Mit Tür' : 'Offen'} · T${tiefeMm} · H${hoeheMm}`,
            hinweis:
              `${modell} · unterster Boden ${tiefe.grundboden * 10} mm · ` +
              `Etagen ${tiefe.etage} mm · Korpus ${tiefe.korpus} × ${hoehe.korpus} mm · ` +
              `Auslage ${hoehe.auslage} mm`,
          });
        }
      }
    }
  }

  // Das Stufenmöbel bleibt, wie es war – es steht auf einer anderen Seite
  // des Katalogs und ist von der Umstellung nicht betroffen.
  for (const laenge of KUEHL_LAENGEN) {
    eintraege.push({
      id: `kuehl-cloud-${Math.round(laenge * 10)}`,
      name: `Stufenmöbel ${(laenge / 100).toFixed(2).replace('.', ',')} m · mit Tür`,
      kategorie: 'kuehlung',
      breite: laenge,
      tiefe: 99.1,
      hoehe: 150,
      grundboden: 70.5,
      form: 'kuehlStufen',
      farbe: KUEHL_BLAU_DUNKEL,
      gruppe: 'Stufenmöbel',
      hinweis: 'Cloud Remote · Auslage 1043 mm, Etagen 392 / 442 / 492 mm, Sockel 705 mm',
    });
  }

  return eintraege;
}

/**
 * Das Trockensortiment: Wanzl wire tech 100, Workbook Version 77 / 12–2025.
 *
 * Das System baut alles aus einem Raster. Breite ist das Achsmaß der
 * Rückwand, Tiefe der Grundboden, Höhe die Säule:
 *
 *   Achsmaß   625 · 800 · 1000 · 1250 · 1333 mm   (Seite 24)
 *   Tiefe     200 bis 800 mm in Hundertern         (Seite 54)
 *   Höhe      1400 bis 2400 mm in Zweihundertern   (Seiten 11 und 12)
 *
 * Nicht jede Kombination gibt es – das Workbook lässt Lücken, und die sind
 * unten als Regeln hinterlegt statt als Liste. Am auffälligsten: Achsmaß 800
 * gibt es nur mit 400er und 500er Boden und nur bis H1800, und Achsmaß 1333
 * hat keinen 800er Boden.
 *
 * Dazu die Planungsregel, die im Workbook nicht steht, aber jede Stellfläche
 * bestimmt: Hinter dem Grundboden bleiben immer 70 mm tote Zone. Ein Regal
 * mit 600er Boden ist deshalb 670 tief. Bei der Gondel liegt die Zone
 * zwischen beiden Seiten und zählt nur einmal – 2 × 600 + 70 = 1270.
 */
const WT_TOTE_ZONE = 7;

/**
 * Die Farbe des Trockensortiments.
 *
 * **Ein Ton für alles**, was zum wire-tech-System gehört – Wandregal,
 * Gondel, Zug und Kopfgondel. Vorher waren es drei Abstufungen, und der Plan
 * sah dadurch nach drei verschiedenen Möbeln aus, wo in Wirklichkeit dasselbe
 * Regal steht. Was ein Wandregal von einer Gondel unterscheidet, liest man an
 * der Tiefe und am Mittelsteg ab, nicht an der Farbe.
 */
/**
 * Das Grau der Regale.
 *
 * Neutral und mittel – so, wie Regale auf einem Ladenbauplan stehen. Vorher
 * war es ein helles, warmes Beige-Grau; neben den farbigen Abteilungen sah
 * das nach eigener Farbe aus statt nach „nicht eingefärbt", und auf dem
 * Ausdruck verschwand es fast im Papier.
 */
export const WT_GRAU = '#787878';

/**
 * Die Töne, die es vorher gab.
 *
 * Nur noch für die Umwandlung älterer Planungen da – siehe `wandlung.ts`.
 * Ein Element, das einen davon trägt, bekommt beim Öffnen den einen Ton.
 * Die beiden letzten sind die freien Regale, die ihr eigenes Beige hatten.
 */
export const WT_GRAU_ALT = [
  '#c9c5bd',
  '#b7b2a8',
  '#d8d4cc',
  '#d9d0c1',
  '#cfc3ad',
  '#9e9e9e',
  '#8c8c8c',
];
const WT_GRAU_DUNKEL = WT_GRAU;
const WT_GRAU_HELL = WT_GRAU;

/** Achsmaße in cm, wie sie das Workbook auf Seite 24 führt. */
const WT_ACHSMASSE = [62.5, 80, 100, 125, 133.3];

/** Schreibt ein Achsmaß so, wie es im Plan steht: „A1250". */
function achsText(a: number): string {
  return `A${Math.round(a * 10)}`;
}

/** Höhen, die es zu einem Achsmaß gibt – begrenzt durch die Rückwand. */
function wtHoehen(achsmass: number): number[] {
  if (Math.abs(achsmass - 80) < 0.1) return [140, 160, 180];
  if (Math.abs(achsmass - 62.5) < 0.1) return [140, 160, 180, 200, 220];
  return [140, 160, 180, 200, 220, 240];
}

/** Grundbodentiefen, die es zu einem Achsmaß gibt (Draht-Etage, Seite 54). */
function wtTiefen(achsmass: number): number[] {
  if (Math.abs(achsmass - 80) < 0.1) return [40, 50];
  if (Math.abs(achsmass - 133.3) < 0.1) return [30, 40, 50, 60, 70];
  return [30, 40, 50, 60, 70, 80];
}

/**
 * Zusätzliche Höhengrenze aus der Säule.
 *
 * Die L-Säule (Wandregal) gibt es in 700 nur als H2200 und in 800 erst ab
 * H1800. Die T-Säule (Gondel) reicht bei 2 × 300 nur bis H2000, bei 2 × 400
 * bis H2200 und bei 2 × 700 erst ab H1800.
 */
function wtHoehenNachSaeule(tiefe: number, gondel: boolean): number[] | null {
  if (gondel) {
    if (tiefe === 30) return [140, 160, 180, 200];
    if (tiefe === 40) return [140, 160, 180, 200, 220];
    if (tiefe === 70) return [180, 200, 220];
    if (tiefe === 80) return null; // keine T-Säule dafür
    return null; // 50 und 60: keine zusätzliche Grenze
  }
  if (tiefe === 70) return [220];
  if (tiefe === 80) return [180, 200, 220];
  return null;
}

/**
 * Das Achsmaß der Kopfgondel vor einem Zug dieser Tiefe.
 *
 * Vorgabe aus der Praxis: Vor eine Gondel mit 600er Boden kommt eine
 * 1250er Kopfgondel, vor eine mit 500er eine 1000er. Die übrigen Tiefen
 * folgen derselben Logik – das Achsmaß, das der Gondeltiefe am nächsten
 * kommt, aus den vier Maßen, die es den Abschluss 180° gibt.
 */
function wtKopfAchsmass(tiefeJeSeite: number): number {
  const gondeltiefe = 2 * tiefeJeSeite + WT_TOTE_ZONE;
  const moeglich = [62.5, 100, 125, 133.3];
  return moeglich.reduce((a, b) =>
    Math.abs(b - gondeltiefe) < Math.abs(a - gondeltiefe) ? b : a,
  );
}

function wt100Eintraege(): BibliothekEintrag[] {
  const eintraege: BibliothekEintrag[] = [];

  for (const achsmass of WT_ACHSMASSE) {
    const a = achsText(achsmass);

    // ---- Wandregale, einseitig
    for (const tiefe of wtTiefen(achsmass)) {
      const grenze = wtHoehenNachSaeule(tiefe, false);
      for (const hoehe of wtHoehen(achsmass)) {
        if (grenze && !grenze.includes(hoehe)) continue;
        eintraege.push({
          id: `wt-wand-${Math.round(achsmass * 10)}-${tiefe * 10}-${hoehe * 10}`,
          name: `Wandregal ${a} · T${tiefe * 10} · H${hoehe * 10}`,
          kategorie: 'regale',
          breite: achsmass,
          tiefe: tiefe + WT_TOTE_ZONE,
          hoehe,
          form: 'wt100',
          farbe: WT_GRAU,
          achsmass,
          gruppe: `Wandregale ${a}`,
          hinweis: `Grundboden ${tiefe * 10} mm + 70 mm tote Zone = ${(tiefe + WT_TOTE_ZONE) * 10} mm Stellfläche`,
        });
      }
    }

    // ---- Gondeln, doppelseitig, ein Feld
    for (const tiefe of wtTiefen(achsmass)) {
      if (tiefe === 80) continue; // keine T-Säule für 2 × 800
      const grenze = wtHoehenNachSaeule(tiefe, true);
      const gondeltiefe = 2 * tiefe + WT_TOTE_ZONE;
      for (const hoehe of wtHoehen(achsmass)) {
        if (grenze && !grenze.includes(hoehe)) continue;
        eintraege.push({
          id: `wt-gondel-${Math.round(achsmass * 10)}-${tiefe * 10}-${hoehe * 10}`,
          name: `Gondel ${a} · T2×${tiefe * 10} · H${hoehe * 10}`,
          kategorie: 'regale',
          breite: achsmass,
          tiefe: gondeltiefe,
          hoehe,
          form: 'wt100',
          farbe: WT_GRAU_DUNKEL,
          achsmass,
          beidseitig: true,
          gruppe: `Gondeln ${a}`,
          hinweis: `2 × ${tiefe * 10} mm + 70 mm tote Zone = ${gondeltiefe * 10} mm – die Zone zählt nur einmal`,
        });
      }
    }
  }

  // ---- Fertige Gondelzüge
  //
  // Ein Zug ist nichts anderes als eine Gondel über mehrere Felder. Weil sich
  // die Länge aus Achsmaß und Feldzahl ergibt und nicht jede runde Meterzahl
  // aufgeht, stehen hier die Feldzahlen und der Name nennt das Ergebnis.
  for (const achsmass of [62.5, 100, 125, 133.3]) {
    for (const felder of [2, 3, 4, 5, 6, 8]) {
      for (const tiefe of [50, 60]) {
        const laenge = Math.round(achsmass * felder * 10) / 10;
        eintraege.push({
          id: `wt-zug-${Math.round(achsmass * 10)}-${felder}-${tiefe * 10}`,
          name: `Gondelzug ${(laenge / 100).toFixed(2).replace('.', ',')} m · ${felder} Felder ${achsText(achsmass)} · T2×${tiefe * 10}`,
          kategorie: 'regale',
          breite: laenge,
          tiefe: 2 * tiefe + WT_TOTE_ZONE,
          hoehe: 180,
          form: 'wt100',
          farbe: WT_GRAU_DUNKEL,
          achsmass,
          beidseitig: true,
          gruppe: 'Gondelzüge',
          hinweis: `Höhe am Element einstellbar · Kopfgondel dazu: ${achsText(wtKopfAchsmass(tiefe))}`,
        });
      }
    }
  }

  // ---- Kopfgondeln, gerade und rund (Abschluss 180°, Workbook Seite 56)
  for (const achsmass of [62.5, 100, 125, 133.3]) {
    for (const tiefe of [30, 40, 50, 60]) {
      const a = achsText(achsmass);
      eintraege.push({
        id: `wt-kopf-gerade-${Math.round(achsmass * 10)}-${tiefe * 10}`,
        name: `Kopfgondel gerade ${a} · T${tiefe * 10}`,
        kategorie: 'regale',
        breite: achsmass,
        tiefe: tiefe + WT_TOTE_ZONE,
        hoehe: 180,
        form: 'wt100',
        farbe: WT_GRAU_HELL,
        achsmass,
        gruppe: 'Kopfgondeln',
        hinweis: `Vor eine Gondel mit ${a === 'A1250' ? '600er' : a === 'A1000' ? '500er' : ''} Boden`,
      });
      eintraege.push({
        id: `wt-kopf-rund-${Math.round(achsmass * 10)}-${tiefe * 10}`,
        name: `Kopfgondel rund ${a} · T${tiefe * 10}`,
        kategorie: 'regale',
        breite: achsmass,
        tiefe: tiefe + WT_TOTE_ZONE,
        hoehe: 180,
        form: 'wt100Rund',
        farbe: WT_GRAU_HELL,
        achsmass,
        gruppe: 'Kopfgondeln',
        hinweis: 'Abschluss 180° · Drahtetage, Sockelblech und Führungsrohr rund',
      });
    }
  }

  // ---- Eckfelder
  //
  // Das Workbook kennt kein Eckbauteil. Über Eck stößt ein Zug stumpf an den
  // anderen, und dahinter bleibt ein Quadrat liegen, an das niemand
  // herankommt. Als eigenes Element geplant, geht es wenigstens nicht als
  // Verkaufsfläche in die Rechnung ein.
  for (const tiefe of [30, 40, 50, 60, 70, 80]) {
    const seite = tiefe + WT_TOTE_ZONE;
    eintraege.push({
      id: `wt-eck-${tiefe * 10}`,
      name: `Eckfeld T${tiefe * 10}`,
      kategorie: 'regale',
      breite: seite,
      tiefe: seite,
      hoehe: 180,
      form: 'wt100Eck',
      farbe: WT_GRAU_HELL,
      gruppe: 'Eckfelder',
      hinweis: 'Blindfeld – wire tech 100 hat kein Eckbauteil, die Züge stoßen stumpf',
    });
  }

  return eintraege;
}

/**
 * Die bedienten Kassen, abgemessen am Marktplan Immenhausen.
 *
 * Der Plan zeigt die ITAB Straight IV. Aufgedruckt ist dort nur das Band –
 * „450 × 1800", bei der Doppelkasse „480 × 2000". Alles andere ist am Plan
 * gemessen, umgerechnet über den Maßstab 1:100 auf A1:
 *
 *   Kopfteil        428 mm
 *   Warenband      1800 mm  (aufgedruckt, veränderlich)
 *   Kassenplatz     618 mm
 *   Abpacktisch    1067 mm
 *   ------------------------
 *   Gesamtlänge    3913 mm  – gemessen 3912 mm
 *
 * Quer misst die Einzelkasse 584 mm, die Doppelkasse 1812 mm: zwei Bänder
 * von je 480 mm und dazwischen die Insel mit 745 mm, auf der bedient wird.
 *
 * Die Bandlängen sind die im Plan vorkommenden. Länger ziehen geht trotzdem –
 * die Zeichnung lässt dann nur das Band wachsen, die übrigen Abschnitte
 * bleiben fest. Genau so wird eine Kasse auch bestellt.
 */
const KASSE_SAND = '#f5dda0';
const KASSE_SAND_HELL = '#f7e5b8';

/** Länge der festen Abschnitte in cm: Kopf + Kassenplatz + Abpacktisch. */
const KASSE_FEST = 42.8 + 61.8 + 106.7;

const KASSE_BANDLAENGEN = [150, 180, 200, 270, 330];

function kassenEintraege(): BibliothekEintrag[] {
  const eintraege: BibliothekEintrag[] = [];

  const bauarten: { kennung: string; name: string; form: Grundform; tiefe: number; gruppe: string }[] = [
    { kennung: 'steh', name: 'Einzelstehkasse', form: 'kasse', tiefe: 58.4, gruppe: 'Einzelkassen stehend' },
    { kennung: 'sitz', name: 'Einzelsitzkasse', form: 'kasseSitz', tiefe: 58.4, gruppe: 'Einzelkassen sitzend' },
    { kennung: 'doppel', name: 'Doppelsitzkasse', form: 'kasseDoppel', tiefe: 181.2, gruppe: 'Doppelkassen' },
  ];

  for (const bauart of bauarten) {
    for (const band of KASSE_BANDLAENGEN) {
      const gesamt = Math.round((band + KASSE_FEST) * 10) / 10;
      eintraege.push({
        id: `kasse-${bauart.kennung}-${band * 10}`,
        name: `${bauart.name} · Band ${band * 10} mm`,
        kategorie: 'kassen',
        breite: gesamt,
        tiefe: bauart.tiefe,
        hoehe: 96,
        form: bauart.form,
        farbe: KASSE_SAND,
        gruppe: bauart.gruppe,
        hinweis: `ITAB Straight IV · Gesamtlänge ${Math.round(gesamt * 10)} mm, Arbeitshöhe 960 mm`,
      });
    }
    eintraege.push({
      id: `kasse-${bauart.kennung}-frei`,
      name: `${bauart.name} frei`,
      kategorie: 'kassen',
      breite: Math.round((180 + KASSE_FEST) * 10) / 10,
      tiefe: bauart.tiefe,
      hoehe: 96,
      form: bauart.form,
      farbe: KASSE_SAND,
      gruppe: bauart.gruppe,
      hinweis: 'Länger ziehen verlängert nur das Warenband',
    });
  }

  // Selbstbedienung und die Anlage, durch die der Kunde danach hinausgeht.
  eintraege.push(
    { id: 'kasse-sb-schmal', name: 'SB-Kasse schmal · 0,70 × 0,80 m', kategorie: 'kassen', breite: 70, tiefe: 80, hoehe: 150, form: 'sbKasse', farbe: KASSE_SAND_HELL, gruppe: 'SB-Kassen' },
    { id: 'kasse-sb', name: 'SB-Kasse · 0,90 × 0,80 m', kategorie: 'kassen', breite: 90, tiefe: 80, hoehe: 150, form: 'sbKasse', farbe: KASSE_SAND_HELL, gruppe: 'SB-Kassen' },
    { id: 'kasse-sb-breit', name: 'SB-Kasse mit Ablage · 1,20 × 0,80 m', kategorie: 'kassen', breite: 120, tiefe: 80, hoehe: 150, form: 'sbKasse', farbe: KASSE_SAND_HELL, gruppe: 'SB-Kassen' },
    { id: 'kasse-sb-frei', name: 'SB-Kasse frei', kategorie: 'kassen', breite: 90, tiefe: 80, hoehe: 150, form: 'sbKasse', farbe: KASSE_SAND_HELL, gruppe: 'SB-Kassen', hinweis: 'Maße frei einstellbar' },
    { id: 'ausgang-90', name: 'Ausgangsanlage 0,90 m', kategorie: 'kassen', breite: 90, tiefe: 15, hoehe: 100, form: 'ausgangsanlage', farbe: '#c9b47a', gruppe: 'SB-Kassen', hinweis: 'Der Bogen zeigt, wie weit der Flügel aufschlägt' },
    { id: 'ausgang-120', name: 'Ausgangsanlage 1,20 m', kategorie: 'kassen', breite: 120, tiefe: 15, hoehe: 100, form: 'ausgangsanlage', farbe: '#c9b47a', gruppe: 'SB-Kassen' },
    { id: 'ausgang-180', name: 'Ausgangsanlage 1,80 m · breit', kategorie: 'kassen', breite: 180, tiefe: 15, hoehe: 100, form: 'ausgangsanlage', farbe: '#c9b47a', gruppe: 'SB-Kassen', hinweis: 'Barrierefreier Durchgang' },
  );

  return eintraege;
}

/**
 * Die Blink-Bedienmöbel von WSL, Katalog 2026 Seite 32/33.
 *
 * Drei Möbel, jedes in sechs Längen und drei Farben. Die Farben sind im
 * Ladenbau die übliche Kennzeichnung der Warengruppe – rot für Fleisch,
 * blau für Fisch, gelb für Käse –, deshalb stehen sie hier gleich zur Wahl,
 * statt sie hinterher am einzelnen Möbel einstellen zu müssen.
 */
const BLINK_LAENGEN = [93.7, 125, 187.5, 250, 312.5, 375];

const BLINK_FARBEN: { name: string; wert: string }[] = [
  { name: 'rot', wert: '#d0504f' },
  { name: 'blau', wert: '#3f86c9' },
  { name: 'gelb', wert: '#e0b93a' },
  // Dunkelbraun für eine Backwarenbedienung – bewusst dunkler als die
  // BakeOff-Türme, damit die bediente Theke sich von der Selbstbedienung
  // abhebt, ohne aus der Reihe zu fallen.
  { name: 'dunkelbraun', wert: '#a67c4e' },
];

const BLINK_MOEBEL: {
  kennung: string;
  name: string;
  form: Grundform;
  tiefe: number;
  hoehe: number;
  hinweis: string;
}[] = [
  {
    kennung: 'theke',
    name: 'Bedientheke',
    form: 'blinkTheke',
    tiefe: 123,
    hoehe: 124.7,
    hinweis: 'Blink Standard Flat – bedient, mit Glasfront und Arbeitsbereich',
  },
  {
    kennung: 'sb-flach',
    name: 'SB flach',
    form: 'blinkSelf',
    tiefe: 123,
    hoehe: 87.1,
    hinweis: 'Blink Self Flat – Selbstbedienung, niedrig und offen',
  },
  {
    kennung: 'sb-halbhoch',
    name: 'SB halbhoch',
    form: 'blinkSv',
    tiefe: 119,
    hoehe: 150,
    hinweis: 'Blink SV – Selbstbedienung mit mehreren Etagen',
  },
];

function blinkEintraege(): BibliothekEintrag[] {
  const eintraege: BibliothekEintrag[] = [];
  for (const moebel of BLINK_MOEBEL) {
    for (const farbe of BLINK_FARBEN) {
      for (const laenge of BLINK_LAENGEN) {
        eintraege.push({
          id: `blink-${moebel.kennung}-${farbe.name}-${Math.round(laenge * 10)}`,
          name: `${moebel.name} ${(laenge / 100).toFixed(2).replace('.', ',')} m`,
          kategorie: 'bedienung',
          breite: laenge,
          tiefe: moebel.tiefe,
          hoehe: moebel.hoehe,
          form: moebel.form,
          farbe: farbe.wert,
          gruppe: `${moebel.name} ${farbe.name}`,
          hinweis: moebel.hinweis,
        });
      }
    }
  }
  return eintraege;
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

/** Hausfarbe der Getränkeabteilung – heller als die Regale. */
export /**
 * Leergutanlage: heller als die Regale, aber deutlich grauer als die
 * Verkaufsmöbel. Sie steht meist im Lager und soll im Plan nicht mit der
 * Einrichtung um Aufmerksamkeit streiten.
 */
const LEERGUT_GRAU = '#c9cdd2';

/**
 * Einwegpfand blau, Mehrweg grün – die Farben, an denen man im Lager
 * auseinanderhält, was wohin gehört. Gedämpft gehalten: Sie sollen den Blick
 * führen, nicht den Plan beherrschen.
 */
const DPG_BLAU = '#a8c4e0';
const MW_GRUEN = '#a9cfae';

const GETRAENKE_GRAU = '#c6c6c6';

/**
 * Die Preisgestelle der Getränkeabteilung.
 *
 * Drei Längen, wie sie geliefert werden. Die Tiefe steht hier als Anfangswert
 * für **eine Reihe längs je Seite**; sie rechnet sich neu, sobald man am Möbel
 * die Lage der Kisten oder die Zahl der Reihen ändert.
 */
function getraenkeEintraege(): BibliothekEintrag[] {
  return GESTELL_LAENGEN.map((laenge) => ({
    id: `getraenke-gestell-${laenge}`,
    name: `Getränkegestell ${(laenge / 100).toFixed(2).replace('.', ',')} m`,
    kategorie: 'getraenke' as const,
    breite: laenge,
    tiefe: GESTELL_STAERKE + KISTE.breite * 2,
    hoehe: GESTELL_HOEHE,
    form: 'getraenkegestell' as const,
    farbe: GETRAENKE_GRAU,
    beidseitig: true,
    // Kein eigenes Achsmaß: Für diese Form gibt es einen Modulsatz mit allen
    // drei Längen (siehe `daten/module.ts`), und damit lassen sich auch
    // **verschiedene** Gestelle aneinanderhängen – 1,50 + 2,00 + 2,50, so wie
    // die Züge auf dem Plan wirklich stehen. Ein Achsmaß am Möbel würde den
    // Satz überstimmen und alle Einheiten auf dieselbe Länge zwingen.
    gruppe: 'Preisgestelle',
    hinweis: `Kisten beidseitig davor · ${Math.floor(laenge / KISTE.laenge)} Kästen längs je Reihe`,
  }));
}

/** Hausfarbe der Blumenabteilung – ein helles Grün. */
const BLUMEN_GRUEN = '#b6dfa6';

/**
 * Holzton für Blenden und Verkleidungen.
 *
 * Warm und gedämpft: Eine Blende ist Ausbau, kein Möbel. Sie soll im Plan
 * als Holz zu erkennen sein, ohne dem Regal darin die Aufmerksamkeit zu
 * nehmen.
 */
const HOLZ_EICHE = '#cda274';

/**
 * Silber für Blenden aus Metall.
 *
 * Kühler und heller als der graue Ausbau ringsum – eine Metallblende soll
 * sich von der Säule und vom Rollcontainer unterscheiden lassen, die
 * daneben in derselben Gruppe stehen.
 */
const METALL_SILBER = '#b8c0c8';

/**
 * Die Blumen- und Pflanzenmöbel von CMS Metasys.
 *
 * Alle Maße stammen von den Produktseiten des Herstellers (Kategorie
 * Blumenpräsenter, abgerufen im August 2026) und sind hier in Zentimetern.
 * Die Höhe ist die des Möbels, nicht die der bepflanzten Ware – ein
 * Pflanzregal von 1,55 m trägt Blumen, die darüber hinausragen.
 *
 * Gezeichnet wird die **Stellfläche**, nicht das Möbel im Detail. Ein Plan
 * beantwortet die Frage, wie viel Platz etwas braucht und ob der Gang noch
 * passt; wie die Wannen darin liegen, steht im Katalog.
 */
function blumenEintraege(): BibliothekEintrag[] {
  const gemeinsam = {
    kategorie: 'blumen' as const,
    farbe: BLUMEN_GRUEN,
  };

  return [
    // --- Pflanzregale: dasselbe Gestell in drei Höhen
    {
      ...gemeinsam,
      id: 'blumen-pflanzregal-niedrig',
      name: 'Pflanzregal niedrig',
      breite: 65.7,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 65.7,
      tiefe: 56,
      hoehe: 102.5,
      form: 'rechteck',
      gruppe: 'Pflanzregale',
      hinweis: 'PR 2017 · Holzrückwand, 2 Kombihalter, große Bodenwanne',
    },
    {
      ...gemeinsam,
      id: 'blumen-pflanzregal-mittel',
      name: 'Pflanzregal mittel',
      breite: 65.7,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 65.7,
      tiefe: 56,
      hoehe: 128,
      form: 'rechteck',
      gruppe: 'Pflanzregale',
      hinweis: 'PR 2018 · Holzrückwand, Kombihalter, große Bodenwanne',
    },
    {
      ...gemeinsam,
      id: 'blumen-pflanzregal-hoch',
      name: 'Pflanzregal hoch',
      breite: 65.7,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 65.7,
      tiefe: 56,
      hoehe: 155,
      form: 'rechteck',
      gruppe: 'Pflanzregale',
      hinweis: 'PR 2019 · Holzrückwand, 3 Kombihalter, große Bodenwanne',
    },

    // --- Präsenter
    {
      ...gemeinsam,
      id: 'blumen-schnittblumen-saeule',
      name: 'Schnittblumen-Säule',
      breite: 41,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 41,
      tiefe: 51.5,
      hoehe: 88,
      form: 'rechteck',
      gruppe: 'Präsenter',
      hinweis: 'SB 1050 · 3 Ringe, ohne Eimer · fahrbar als SB 1051',
    },
    {
      ...gemeinsam,
      id: 'blumen-insel-quadrat',
      name: 'Blumeninsel quadratisch',
      breite: 143,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 143,
      tiefe: 143,
      hoehe: 62.5,
      form: 'rechteck',
      gruppe: 'Präsenter',
      hinweis: 'PR 2008 · Würfel mit Holzdekor, 4 Kombihalter, Mittelwanne 63 × 63',
    },
    {
      ...gemeinsam,
      id: 'blumen-display-kasse',
      name: 'Blumendisplay Kasse',
      breite: 61,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 61,
      tiefe: 73,
      hoehe: 147,
      form: 'rechteck',
      gruppe: 'Präsenter',
      hinweis: 'KD 2004 · 4 Ringhalter, A4-Rahmen · bis 12 Halter erweiterbar',
    },

    // --- Topfblumen: gerade und über Eck
    {
      ...gemeinsam,
      id: 'blumen-topf-gerade',
      name: 'Topfblumen-Präsenter gerade',
      breite: 91,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 91,
      tiefe: 78,
      hoehe: 145,
      form: 'rechteck',
      gruppe: 'Topfblumen',
      hinweis: 'BT 9080 · Mittelelement, 3 Wannen, fahrbar',
    },
    {
      ...gemeinsam,
      id: 'blumen-topf-ecke',
      name: 'Topfblumen-Präsenter Ecke',
      breite: 78,
      tiefe: 78,
      hoehe: 145,
      form: 'umriss',
      // Ein Viertelkreis, aus dem Quadrat geschnitten: Der Bogen läuft von
      // der einen Ecke zur anderen, sodass zwei gerade Elemente über Eck
      // anschließen.
      polygon: viertelkreis(78, 78),
      gruppe: 'Topfblumen',
      hinweis: 'BT 9082 · Viertelkreiselement, 3 Wannen, fahrbar',
    },

    // --- Blumentreppen
    {
      ...gemeinsam,
      id: 'blumen-treppe-2',
      name: 'Blumentreppe 2-stufig',
      breite: 100,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 100,
      tiefe: 66.6,
      hoehe: 73.5,
      form: 'rechteck',
      gruppe: 'Blumentreppen',
      hinweis: 'BT 1007 · 2 geschlossene Bewässerungswannen, fahrbar',
    },
    {
      ...gemeinsam,
      id: 'blumen-treppe-3',
      name: 'Blumentreppe 3-stufig',
      breite: 100,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 100,
      tiefe: 100,
      hoehe: 73.5,
      form: 'rechteck',
      gruppe: 'Blumentreppen',
      hinweis: 'BT 1010 · 3 geschlossene Bewässerungswannen, fahrbar',
    },

    // --- Wannen und Wagen
    {
      ...gemeinsam,
      id: 'blumen-wanne-mini',
      name: 'Bewässerungswanne klein',
      breite: 63,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 63,
      tiefe: 55.3,
      hoehe: 54.9,
      form: 'rechteck',
      gruppe: 'Wannen und Wagen',
      hinweis: 'BW 0653 · fahrbar · zwei davon sind so breit wie eine große',
    },
    {
      ...gemeinsam,
      id: 'blumen-wanne-maxi',
      name: 'Bewässerungswanne groß',
      breite: 126,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 126,
      tiefe: 55.3,
      hoehe: 59.4,
      form: 'rechteck',
      gruppe: 'Wannen und Wagen',
      hinweis: 'BW 1253 · fahrbar, Holzdekor',
    },
    {
      ...gemeinsam,
      id: 'blumen-wagen',
      name: 'Blumenwagen',
      breite: 149,
      // Sein eigenes Maß als Raster: So lässt es sich am Möbel verlängern,
      // statt drei einzelne hinzustellen und auszurichten.
      achsmass: 149,
      tiefe: 82.6,
      hoehe: 152,
      form: 'rechteck',
      gruppe: 'Wannen und Wagen',
      hinweis: 'BW 1826 · ohne Dach, 4 Böden · mit Dach 2,10 m hoch',
    },
  ];
}

/**
 * Ein Viertelkreis als Polygon, aus einem Rechteck geschnitten.
 *
 * Die volle Ecke bleibt links oben stehen, der Bogen läuft von der linken
 * unteren zur rechten oberen Ecke. So schließen zwei gerade Präsenter über
 * Eck an, ohne dass eine Lücke bleibt.
 *
 * **Die Punkte liegen relativ zum Mittelpunkt** – so erwartet es die
 * Zeichnung (siehe `ElementSymbol.tsx`). Ein Polygon von null bis Breite
 * säße um eine halbe Möbelbreite verschoben, und das fällt bei einem
 * Viertelkreis erst auf, wenn zwei davon über Eck nicht zusammenpassen.
 */
function viertelkreis(breite: number, tiefe: number, schritte = 16): Punkt[] {
  const punkte: Punkt[] = [{ x: -breite / 2, y: -tiefe / 2 }];
  for (let i = 0; i <= schritte; i++) {
    const winkel = (Math.PI / 2) * (i / schritte);
    punkte.push({
      x: breite * Math.sin(winkel) - breite / 2,
      y: tiefe * (1 - Math.cos(winkel)) - tiefe / 2,
    });
  }
  return punkte;
}

export const BIBLIOTHEK: BibliothekEintrag[] = [
  // ---------------------------------------------------------------- Regale
  ...wt100Eintraege(),
  // Ein freies Feld für alles, was das System nicht hergibt.
  { id: 'regal-frei', name: 'Regal frei', kategorie: 'regale', breite: 125, tiefe: 67, hoehe: 180, form: 'regal', farbe: WT_GRAU, gruppe: 'Frei', hinweis: 'Maße frei einstellbar' },
  { id: 'regal-gondel-frei', name: 'Gondel frei', kategorie: 'regale', breite: 125, tiefe: 127, hoehe: 180, form: 'regal', farbe: WT_GRAU, beidseitig: true, gruppe: 'Frei', hinweis: 'Maße frei einstellbar' },

  // ---------------------------------------------------- Normalkuehlung
  //
  // Titan Remote und Cloud Remote von WSL, Katalog 2026 Seiten 18 bis 21.
  // Die frueheren allgemeinen Rechtecke sind entfallen: Molkerei, SB-Fleisch
  // und Getraenke sind dieselben Moebel mit anderer Warengruppe, und die
  // beiden Tiefkuehleintraege stehen jetzt richtig unter Tiefkuehlung.
  ...kuehlEintraege(),

  // Die Zonenmarkierung für Obst und Gemüse. Kein Möbel, sondern eine Fläche.
  { id: 'frische-og-flaeche', name: 'Obst- und Gemüsefläche', kategorie: 'obstgemuese', breite: 500, tiefe: 400, hoehe: 0, form: 'rechteck', farbe: '#cfe4c2', hinweis: 'Gesamte O&G-Zone als Fläche – Zonenmarkierung, kein Möbel', gruppe: 'Frei' },

  // ------------------------------------------------------------- Getränke
  //
  // Keine Regale: schmale Gestelle für die Preisschilder, und davor werden
  // beidseitig Kisten gestapelt. Die Tiefe des Möbels ergibt sich deshalb aus
  // den Kisten – siehe `logik/getraenkekisten.ts`.
  ...getraenkeEintraege(),

  // ----------------------------------------------------- Blumen & Pflanzen
  //
  // CMS Metasys, Kategorie Blumenpräsenter. Alle Maße von den Produktseiten,
  // Millimeter dort, Zentimeter hier.
  //
  // Die Namen sind **nicht** die des Herstellers: „PR 2017" sagt niemandem
  // etwas, der einen Markt plant. Die Artikelnummer steht im Hinweis, damit
  // man sie zum Bestellen wiederfindet.
  ...blumenEintraege(),

  // ------------------------------------------------- Bedienung & SB-Theken
  //
  // Blink von WSL, Katalog 2026 Seite 32/33. Längen 937, 1250, 1875, 2500,
  // 3125 und 3750 mm – bis auf die kürzeste wieder das 625er-Raster.
  ...blinkEintraege(),
  { id: 'blink-frei', name: 'Bedientheke frei', kategorie: 'bedienung', breite: 250, tiefe: 123, hoehe: 124.7, form: 'blinkTheke', farbe: '#d0504f', gruppe: 'Frei', hinweis: 'Maße und Farbe frei einstellbar' },

  // ---------------------------------------------------------- Tiefkühlung
  //
  // WSL Refrigeration (Wanzl), Produktkatalog 2026, Seiten 24 bis 29.
  // Alle Maße in Millimetern aus den Datentabellen, hier in Zentimetern.
  //
  //   Eclipse Remote  – Schrank    T 940,  H 2010/2210, L 1562/2343/3124/3898
  //   Eclipse Combo   – Kombi      T 1145, H 2098/2298, L 1875/2500/3750
  //   Eclipse Island  – Truhe      T 1121/2119, H 987/986, L 1875/2500/3750
  //
  // Die Truhenlängen sind genau 3, 4 und 6 Module à 625 mm – deshalb zeichnet
  // das Symbol diese Teilung mit, und deshalb lässt sich eine Truhe in
  // 62,5er-Schritten verlängern.

  // ---- Truhen (Eclipse Island)
  //
  // Zwei Bauarten, beide mit den Maßen aus den Schnittzeichnungen:
  //
  //   Single Island   T 1121 mm (Korpus 1073)  H  987 mm  Auslage 849 mm
  //   Double Island   T 2119 mm (Korpus 2022)  H  986 mm  Auslage 850 mm je Seite
  //
  // Eingetragen ist das äußere Maß einschließlich Stoßschutz, denn das ist
  // der Platz, den die Truhe am Boden wirklich braucht.
  { id: 'tk-truhe-einzel-1875', name: 'TK-Truhe einseitig 1,88 m', kategorie: 'tiefkuehlung', breite: 187.5, tiefe: 112.1, hoehe: 98.7, form: 'tkTruhe', farbe: TK_LILA, gruppe: 'Truhen einseitig', hinweis: 'Single Island · 3 Module à 625 mm · Auslage 849 mm' },
  { id: 'tk-truhe-einzel-2500', name: 'TK-Truhe einseitig 2,50 m', kategorie: 'tiefkuehlung', breite: 250, tiefe: 112.1, hoehe: 98.7, form: 'tkTruhe', farbe: TK_LILA, gruppe: 'Truhen einseitig', hinweis: 'Single Island · 4 Module à 625 mm' },
  { id: 'tk-truhe-einzel-3750', name: 'TK-Truhe einseitig 3,75 m', kategorie: 'tiefkuehlung', breite: 375, tiefe: 112.1, hoehe: 98.7, form: 'tkTruhe', farbe: TK_LILA, gruppe: 'Truhen einseitig', hinweis: 'Single Island · 6 Module à 625 mm' },
  { id: 'tk-truhe-doppel-1875', name: 'TK-Truhe beidseitig 1,88 m', kategorie: 'tiefkuehlung', breite: 187.5, tiefe: 211.9, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Truhen beidseitig', hinweis: 'Double Island · 3 Module à 625 mm · Auslage 850 mm je Seite' },
  { id: 'tk-truhe-doppel-2500', name: 'TK-Truhe beidseitig 2,50 m', kategorie: 'tiefkuehlung', breite: 250, tiefe: 211.9, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Truhen beidseitig', hinweis: 'Double Island · 4 Module à 625 mm' },
  { id: 'tk-truhe-doppel-3750', name: 'TK-Truhe beidseitig 3,75 m', kategorie: 'tiefkuehlung', breite: 375, tiefe: 211.9, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Truhen beidseitig', hinweis: 'Double Island · 6 Module à 625 mm' },
  // Kopfstück am Ende einer Truhenzeile.
  { id: 'tk-truhe-kopf-einzel', name: 'TK-Truhe Kopfstück einseitig', kategorie: 'tiefkuehlung', breite: 62.5, tiefe: 112.1, hoehe: 98.7, form: 'tkTruhe', farbe: TK_LILA_DUNKEL, gruppe: 'Truhen einseitig' },
  { id: 'tk-truhe-kopf-doppel', name: 'TK-Truhe Kopfstück beidseitig', kategorie: 'tiefkuehlung', breite: 62.5, tiefe: 211.9, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA_DUNKEL, beidseitig: true, gruppe: 'Truhen beidseitig' },

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
  { id: 'tk-truhe-frei', name: 'TK-Truhe frei einseitig', kategorie: 'tiefkuehlung', breite: 312.5, tiefe: 112.1, hoehe: 98.7, form: 'tkTruhe', farbe: TK_LILA, gruppe: 'Frei', hinweis: 'Länge in Schritten von 62,5 cm eintragen – das Symbol teilt sich danach' },
  { id: 'tk-truhe-frei-doppel', name: 'TK-Truhe frei beidseitig', kategorie: 'tiefkuehlung', breite: 312.5, tiefe: 211.9, hoehe: 98.6, form: 'tkTruhe', farbe: TK_LILA, beidseitig: true, gruppe: 'Frei', hinweis: 'Länge in Schritten von 62,5 cm eintragen' },
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
  // Ein Trapez zum Selbstformen. Eine Ecklösung ist in jedem Markt anders
  // zugeschnitten, und keine feste Vorlage trifft alle. Deshalb hier nur ein
  // brauchbarer Anfang – die vier Ecken zieht man auf dem Plan zurecht.
  {
    id: 'vt-trapez-1200',
    name: 'O&G Trapez frei · T1200',
    kategorie: 'obstgemuese',
    breite: 200,
    tiefe: 131.7,
    korpustiefe: 90.8,
    hoehe: 180,
    form: 'umriss',
    polygon: [
      { x: -100, y: -65.85 },
      { x: 100, y: -65.85 },
      { x: 60, y: 65.85 },
      { x: -60, y: 65.85 },
    ],
    farbe: OG_GRUEN,
    hinweis: 'Vier Ecken, einzeln verschiebbar. Auswählen, dann an den Punkten ziehen.',
    gruppe: 'Ecken und Abschlüsse',
  },
  {
    id: 'vt-trapez-800',
    name: 'O&G Trapez frei · T800',
    kategorie: 'obstgemuese',
    breite: 150,
    tiefe: 95.5,
    korpustiefe: 72.6,
    hoehe: 180,
    form: 'umriss',
    polygon: [
      { x: -75, y: -47.75 },
      { x: 75, y: -47.75 },
      { x: 45, y: 47.75 },
      { x: -45, y: 47.75 },
    ],
    farbe: OG_GRUEN,
    hinweis: 'Vier Ecken, einzeln verschiebbar. Auswählen, dann an den Punkten ziehen.',
    gruppe: 'Ecken und Abschlüsse',
  },
  { id: 'vt-eck-innen-800', name: 'O&G Eck 45° · T800', kategorie: 'obstgemuese', breite: 95.5 * ECK_ANTEIL, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitableEckInnen', farbe: OG_GRUEN, stufen: [80, 60, 40], hinweis: ECK_HINWEIS, gruppe: 'Ecken und Abschlüsse' },
  { id: 'vt-eck-innen-1200', name: 'O&G Eck 45° · T1200', kategorie: 'obstgemuese', breite: 131.7 * ECK_ANTEIL, tiefe: 131.7, korpustiefe: 90.8, hoehe: 180, form: 'vitableEckInnen', farbe: OG_GRUEN, stufen: [120, 60], hinweis: ECK_HINWEIS, gruppe: 'Ecken und Abschlüsse' },
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
  ...kassenEintraege(),
  { id: 'kassentisch', name: 'Kassentisch', kategorie: 'kassen', breite: 200, tiefe: 80, hoehe: 90, form: 'rechteck', farbe: KASSE_SAND, gruppe: 'Übriges' },
  { id: 'kassensperre', name: 'Kassensperre', kategorie: 'kassen', breite: 100, tiefe: 15, hoehe: 100, form: 'linie', farbe: '#c9b47a', gruppe: 'Übriges' },
  { id: 'eingangsbereich', name: 'Eingangsbereich', kategorie: 'kassen', breite: 300, tiefe: 200, hoehe: 0, form: 'zugang', farbe: '#d8e6c8', gruppe: 'Ein- und Ausgang' },
  { id: 'ausgangsbereich', name: 'Ausgangsbereich', kategorie: 'kassen', breite: 300, tiefe: 200, hoehe: 0, form: 'zugang', farbe: '#e6d8c8', gruppe: 'Ein- und Ausgang' },
  { id: 'einkaufswagenbox', name: 'Einkaufswagenbox', kategorie: 'kassen', breite: 200, tiefe: 120, hoehe: 100, form: 'wagenbox', farbe: '#dfe3e6', gruppe: 'Ein- und Ausgang' },
  { id: 'kundendienst', name: 'Kundendienst', kategorie: 'kassen', breite: 200, tiefe: 100, hoehe: 110, form: 'abgerundet', farbe: '#f1e2bb', gruppe: 'Übriges' },
  { id: 'information', name: 'Information', kategorie: 'kassen', breite: 150, tiefe: 80, hoehe: 110, form: 'abgerundet', farbe: '#f1e2bb', gruppe: 'Übriges' },
  { id: 'leergutautomat', name: 'Leergutautomat', kategorie: 'kassen', breite: 120, tiefe: 100, hoehe: 200, form: 'automat', farbe: '#cddac2', gruppe: 'Übriges' },

  // ------------------------------------------------------------- Leergut
  //
  // Maße vom Aufstellplan einer bestehenden Anlage abgenommen: Der Automat
  // ist 800 mm breit, die Rollenbahn 400 mm und liegt 250 mm über dem Boden,
  // der Bereich vor der Wand misst 3,00 m in der Tiefe.
  //
  // Die Rücknahme sitzt in der Wand: Vorne wirft der Kunde ein, hinten geht
  // das Mehrweg aufs Band und das Einweg in die Presse daneben. Deshalb ist
  // das Gerät flach – was Platz braucht, steht dahinter im Lager.
  { id: 'leergut-ruecknahme', name: 'Rücknahmeautomat', kategorie: 'kassen', breite: 80, tiefe: 90, hoehe: 220, form: 'leergutRuecknahme', farbe: LEERGUT_GRAU, gruppe: 'Leergut', hinweis: 'Einlassung in der Wand · 800 mm breit · Auswurf nach hinten aufs Band' },
  { id: 'leergut-ruecknahme-doppel', name: 'Rücknahme, zwei Automaten', kategorie: 'kassen', breite: 160, tiefe: 90, hoehe: 220, form: 'leergutRuecknahme', farbe: LEERGUT_GRAU, gruppe: 'Leergut', hinweis: 'Zwei Geräte nebeneinander, 1600 mm · so steht es im Bestandsplan' },
  { id: 'leergut-einweg', name: 'Einwegpfand-Presse', kategorie: 'kassen', breite: 100, tiefe: 125, hoehe: 180, form: 'leergutEinweg', farbe: LEERGUT_GRAU, gruppe: 'Leergut', hinweis: 'Sammelbehälter mit Presse · H 1,80 m, keine Nachtabschaltung' },
  { id: 'leergut-einweg-gross', name: 'Einwegpfand-Presse groß', kategorie: 'kassen', breite: 130, tiefe: 150, hoehe: 180, form: 'leergutEinweg', farbe: LEERGUT_GRAU, gruppe: 'Leergut', hinweis: 'Für zwei Automaten, wenn beide auf eine Presse laufen' },
  { id: 'leergut-band-gerade', name: 'Förderband, gerade 6 m', kategorie: 'kassen', breite: 600, tiefe: 40, hoehe: 25, form: 'rechteck', farbe: LEERGUT_GRAU, gruppe: 'Leergut', hinweis: 'Für einen geraden Lauf · frei geführt geht es mit dem Werkzeug „Förderband"' },

  // Der Sammelbehälter fürs Einwegpfand steht im Plan blau, die Ablage für
  // die Mehrwegkästen grün: An der Farbe erkennt man im Lager auf einen
  // Blick, was wohin gehört – DPG in den Behälter, Kästen aufs Gestell.
  { id: 'dpg-behaelter', name: 'DPG-Behälter 1200×800', kategorie: 'kassen', breite: 120, tiefe: 80, hoehe: 100, form: 'dpgBehaelter', farbe: DPG_BLAU, gruppe: 'Leergut', hinweis: 'Sammelbehälter für Einwegpfand · Grundmaß einer Europalette' },
  { id: 'dpg-behaelter-quer', name: 'DPG-Behälter 800×1200', kategorie: 'kassen', breite: 80, tiefe: 120, hoehe: 100, form: 'dpgBehaelter', farbe: DPG_BLAU, gruppe: 'Leergut', hinweis: 'Derselbe Behälter quer gestellt' },
  { id: 'dpg-behaelter-klein', name: 'DPG-Behälter 800×600', kategorie: 'kassen', breite: 80, tiefe: 60, hoehe: 100, form: 'dpgBehaelter', farbe: DPG_BLAU, gruppe: 'Leergut', hinweis: 'Der kleine Behälter, auf halber Palette' },

  { id: 'mw-ablage-200', name: 'Kastenablage MW 2,00 m', kategorie: 'kassen', breite: 200, tiefe: 90, hoehe: 180, form: 'kastenablage', farbe: MW_GRUEN, gruppe: 'Leergut', hinweis: 'Zwei Bahnen · 5 Kästen je Bahn (Kastenmaß 400 mm)' },
  { id: 'mw-ablage-300', name: 'Kastenablage MW 3,00 m', kategorie: 'kassen', breite: 300, tiefe: 90, hoehe: 180, form: 'kastenablage', farbe: MW_GRUEN, gruppe: 'Leergut', hinweis: 'Zwei Bahnen · 7 Kästen je Bahn · so steht es im Bestandsplan' },
  { id: 'mw-ablage-400', name: 'Kastenablage MW 4,00 m', kategorie: 'kassen', breite: 400, tiefe: 90, hoehe: 180, form: 'kastenablage', farbe: MW_GRUEN, gruppe: 'Leergut', hinweis: 'Zwei Bahnen · 10 Kästen je Bahn' },
  { id: 'mw-ablage-schmal', name: 'Kastenablage MW 3,00 m, einbahnig', kategorie: 'kassen', breite: 300, tiefe: 45, hoehe: 180, form: 'kastenablage', farbe: MW_GRUEN, gruppe: 'Leergut', hinweis: 'Eine Bahn · 7 Kästen · für den Gang an der Wand' },

  // -------------------------------------------- Aktions- & Sonderflächen
  // ------------------------------------------ Aktions- und Sonderflächen
  //
  // Gelb ist im Marktplan die Farbe der Aktionsfläche. Die Fläche selbst
  // ist hell, damit die Beschriftung darauf lesbar bleibt; Paletten und
  // Ständer sind kräftiger, weil sie Möbel sind und keine Zone.
  //
  // Palettenmaße sind genormt:
  //   EPAL / Europalette   1200 x 800 mm
  //   halbe Palette        800 x 600 mm   (1/2 CHEP, "Düsseldorfer")
  //   Viertelpalette       600 x 400 mm   (1/4 CHEP)

  // ---- Flächen
  { id: 'aktionsflaeche', name: 'Aktionsfläche 2 x 2 m', kategorie: 'aktion', breite: 200, tiefe: 200, hoehe: 0, form: 'aktionsflaeche', farbe: AKTION_GELB, standardBeschriftung: AKTION_TEXT, gruppe: 'Flächen', hinweis: 'Zonenmarkierung, kein Möbel' },
  { id: 'aktionsflaeche-3x2', name: 'Aktionsfläche 3 x 2 m', kategorie: 'aktion', breite: 300, tiefe: 200, hoehe: 0, form: 'aktionsflaeche', farbe: AKTION_GELB, standardBeschriftung: AKTION_TEXT, gruppe: 'Flächen' },
  { id: 'aktionsflaeche-4x2', name: 'Aktionsfläche 4 x 2 m', kategorie: 'aktion', breite: 400, tiefe: 200, hoehe: 0, form: 'aktionsflaeche', farbe: AKTION_GELB, standardBeschriftung: AKTION_TEXT, gruppe: 'Flächen' },
  { id: 'aktionsflaeche-frei', name: 'Aktionsfläche frei', kategorie: 'aktion', breite: 300, tiefe: 300, hoehe: 0, form: 'aktionsflaeche', farbe: AKTION_GELB, standardBeschriftung: AKTION_TEXT, gruppe: 'Flächen', hinweis: 'Maße frei einstellbar' },
  { id: 'saisonflaeche', name: 'Saisonfläche', kategorie: 'aktion', breite: 300, tiefe: 300, hoehe: 0, form: 'aktionsflaeche', farbe: AKTION_GELB, standardBeschriftung: SAISON_TEXT, gruppe: 'Flächen' },

  // ---- Paletten
  { id: 'palette-epal-quer', name: 'EPAL quer · 1,20 x 0,80 m', kategorie: 'aktion', breite: 120, tiefe: 80, hoehe: 100, form: 'palette', farbe: PALETTE_GELB, gruppe: 'Paletten', hinweis: 'Europalette, lange Seite zum Gang' },
  { id: 'palette-epal-längs', name: 'EPAL längs · 0,80 x 1,20 m', kategorie: 'aktion', breite: 80, tiefe: 120, hoehe: 100, form: 'palette', farbe: PALETTE_GELB, gruppe: 'Paletten', hinweis: 'Europalette, kurze Seite zum Gang' },
  { id: 'palette-halb-quer', name: 'Halbe Palette quer · 0,80 x 0,60 m', kategorie: 'aktion', breite: 80, tiefe: 60, hoehe: 100, form: 'palette', farbe: PALETTE_GELB, gruppe: 'Paletten', hinweis: '1/2 CHEP, Düsseldorfer Palette' },
  { id: 'palette-halb-längs', name: 'Halbe Palette längs · 0,60 x 0,80 m', kategorie: 'aktion', breite: 60, tiefe: 80, hoehe: 100, form: 'palette', farbe: PALETTE_GELB, gruppe: 'Paletten' },
  { id: 'palette-viertel-quer', name: 'Viertelpalette quer · 0,60 x 0,40 m', kategorie: 'aktion', breite: 60, tiefe: 40, hoehe: 100, form: 'palette', farbe: PALETTE_GELB, gruppe: 'Paletten', hinweis: '1/4 CHEP' },
  { id: 'palette-viertel-längs', name: 'Viertelpalette längs · 0,40 x 0,60 m', kategorie: 'aktion', breite: 40, tiefe: 60, hoehe: 100, form: 'palette', farbe: PALETTE_GELB, gruppe: 'Paletten' },
  { id: 'palette-chep', name: 'CHEP ganz · 1,20 x 1,00 m', kategorie: 'aktion', breite: 120, tiefe: 100, hoehe: 100, form: 'palette', farbe: PALETTE_GELB, gruppe: 'Paletten' },
  { id: 'palette-frei', name: 'Palette frei', kategorie: 'aktion', breite: 120, tiefe: 80, hoehe: 100, form: 'palette', farbe: PALETTE_GELB, gruppe: 'Paletten', hinweis: 'Maße frei einstellbar' },

  // ---- Drehständer
  { id: 'drehstaender-40', name: 'Drehständer 40 cm', kategorie: 'aktion', breite: 40, tiefe: 40, hoehe: 160, form: 'drehstaender', farbe: STAENDER_GELB, gruppe: 'Drehständer' },
  { id: 'drehstaender-50', name: 'Drehständer 50 cm', kategorie: 'aktion', breite: 50, tiefe: 50, hoehe: 170, form: 'drehstaender', farbe: STAENDER_GELB, gruppe: 'Drehständer' },
  { id: 'drehstaender-60', name: 'Drehständer 60 cm', kategorie: 'aktion', breite: 60, tiefe: 60, hoehe: 180, form: 'drehstaender', farbe: STAENDER_GELB, gruppe: 'Drehständer' },
  { id: 'drehstaender-80', name: 'Drehständer 80 cm', kategorie: 'aktion', breite: 80, tiefe: 80, hoehe: 180, form: 'drehstaender', farbe: STAENDER_GELB, gruppe: 'Drehständer' },
  { id: 'drehstaender-100', name: 'Drehständer 100 cm', kategorie: 'aktion', breite: 100, tiefe: 100, hoehe: 180, form: 'drehstaender', farbe: STAENDER_GELB, gruppe: 'Drehständer' },
  { id: 'drehstaender-frei', name: 'Drehständer frei', kategorie: 'aktion', breite: 60, tiefe: 60, hoehe: 180, form: 'drehstaender', farbe: STAENDER_GELB, gruppe: 'Drehständer', hinweis: 'Durchmesser frei einstellbar' },

  // ---- Übriges
  { id: 'display', name: 'Display', kategorie: 'aktion', breite: 80, tiefe: 60, hoehe: 150, form: 'rechteck', farbe: STAENDER_GELB, gruppe: 'Übriges' },
  { id: 'schuette', name: 'Schütte', kategorie: 'aktion', breite: 100, tiefe: 80, hoehe: 90, form: 'abgerundet', farbe: STAENDER_GELB, gruppe: 'Übriges' },
  { id: 'kuehldisplay', name: 'Kühldisplay', kategorie: 'aktion', breite: 100, tiefe: 80, hoehe: 120, form: 'abgerundet', farbe: '#c8d9e4', gruppe: 'Übriges' },
  { id: 'verkostungsstand', name: 'Verkostungsstand', kategorie: 'aktion', breite: 120, tiefe: 80, hoehe: 110, form: 'abgerundet', farbe: STAENDER_GELB, gruppe: 'Übriges' },

  // ------------------------------------------------------ Weitere Ausstattung
  { id: 'saeule', name: 'Säule', kategorie: 'ausstattung', breite: 40, tiefe: 40, hoehe: 300, form: 'saeule', farbe: '#b9bec4', hinweis: 'Tragende Säule, im Grundriss schraffiert', gruppe: 'Einrichtung' },
  { id: 'saeule-eckig', name: 'Säule eckig', kategorie: 'ausstattung', breite: 40, tiefe: 40, hoehe: 300, form: 'stellflaeche', farbe: '#b9bec4', hinweis: 'Quadratische Stütze', gruppe: 'Einrichtung' },
  { id: 'treppe', name: 'Treppe', kategorie: 'ausstattung', breite: 300, tiefe: 120, hoehe: 0, form: 'treppe', farbe: '#cfd4d9', hinweis: 'Stufen im Auftritt 28 cm, Pfeil zeigt aufwärts', gruppe: 'Einrichtung' },
  { id: 'aufzug', name: 'Aufzug', kategorie: 'ausstattung', breite: 200, tiefe: 200, hoehe: 0, form: 'aufzug', farbe: '#c6ccd2', gruppe: 'Einrichtung' },
  { id: 'tuer', name: 'Tür', kategorie: 'ausstattung', breite: 100, tiefe: 15, hoehe: 210, form: 'tuerBlatt', farbe: '#9aa4ae', hinweis: 'Mit Schwenkbogen – zeigt den Platzbedarf', gruppe: 'Einrichtung' },
  { id: 'fenster', name: 'Fenster', kategorie: 'ausstattung', breite: 150, tiefe: 15, hoehe: 150, form: 'fenster', farbe: '#b6d3e2', gruppe: 'Einrichtung' },
  { id: 'sitzbereich', name: 'Sitzbereich', kategorie: 'ausstattung', breite: 300, tiefe: 200, hoehe: 0, form: 'abgerundet', farbe: '#dbd3c4', gruppe: 'Einrichtung' },
  { id: 'werbeschild', name: 'Werbeschild', kategorie: 'ausstattung', breite: 100, tiefe: 15, hoehe: 60, form: 'schild', farbe: '#f2d06b', hinweis: 'Die Spitze zeigt die Blickrichtung', gruppe: 'Einrichtung' },
  { id: 'bildschirm', name: 'Bildschirm', kategorie: 'ausstattung', breite: 80, tiefe: 12, hoehe: 50, form: 'schild', farbe: '#8d99a6', gruppe: 'Einrichtung' },
  { id: 'abfallbehaelter', name: 'Abfallbehälter', kategorie: 'ausstattung', breite: 60, tiefe: 60, hoehe: 90, form: 'kreis', farbe: '#b0b6bc', gruppe: 'Einrichtung' },
  { id: 'hubwagen', name: 'Hubwagenstellplatz', kategorie: 'ausstattung', breite: 200, tiefe: 100, hoehe: 0, form: 'stellflaeche', farbe: '#d9dde1', hinweis: 'Freizuhaltende Fläche', gruppe: 'Einrichtung' },
  { id: 'rollcontainer', name: 'Rollcontainer', kategorie: 'ausstattung', breite: 80, tiefe: 70, hoehe: 180, form: 'wagenbox', farbe: '#cfd4d9', gruppe: 'Einrichtung' },

  // Holzblenden. Sie werden um ein Regal herumgebaut und sind deshalb
  // innen offen: Was sie einfassen, bleibt im Plan sichtbar. Die Maße sind
  // Anfangswerte – gezogen wird die Blende auf das Regal, das darin steht.
  { id: 'holzblende-rahmen', name: 'Holzblende umlaufend', kategorie: 'ausstattung', breite: 320, tiefe: 65, hoehe: 220, form: 'holzblende', farbe: HOLZ_EICHE, gruppe: 'Einrichtung', standardBeschriftung: 'Holzblende', hinweis: 'Rahmen rundum · innen offen, das Regal bleibt sichtbar · Brett 8 cm' },
  { id: 'holzblende-u', name: 'Holzblende U-förmig', kategorie: 'ausstattung', breite: 320, tiefe: 65, hoehe: 220, form: 'holzblendeU', farbe: HOLZ_EICHE, gruppe: 'Einrichtung', standardBeschriftung: 'Holzblende', hinweis: 'Drei Seiten, eine Langseite offen – für einen Zug an der Wand · mit „Um 90° drehen“ ausrichten' },
  { id: 'holzblende-gerade', name: 'Holzblende gerade', kategorie: 'ausstattung', breite: 200, tiefe: 8, hoehe: 220, form: 'rechteck', farbe: HOLZ_EICHE, gruppe: 'Einrichtung', standardBeschriftung: 'Holzblende', hinweis: 'Ein einzelnes Brett – für die Front oder eine Seite' },

  // Dieselben drei Formen in Metall. Die Form beschreibt den Zuschnitt,
  // die Farbe den Werkstoff – deshalb teilen sie sich die Grundformen.
  { id: 'metallblende-rahmen', name: 'Metallblende umlaufend', kategorie: 'ausstattung', breite: 320, tiefe: 65, hoehe: 220, form: 'holzblende', farbe: METALL_SILBER, gruppe: 'Einrichtung', standardBeschriftung: 'Metallblende', hinweis: 'Rahmen rundum · innen offen, das Regal bleibt sichtbar · Blech 8 cm' },
  { id: 'metallblende-u', name: 'Metallblende U-förmig', kategorie: 'ausstattung', breite: 320, tiefe: 65, hoehe: 220, form: 'holzblendeU', farbe: METALL_SILBER, gruppe: 'Einrichtung', standardBeschriftung: 'Metallblende', hinweis: 'Drei Seiten, eine Langseite offen – für einen Zug an der Wand · mit „Um 90° drehen“ ausrichten' },
  { id: 'metallblende-gerade', name: 'Metallblende gerade', kategorie: 'ausstattung', breite: 200, tiefe: 8, hoehe: 220, form: 'rechteck', farbe: METALL_SILBER, gruppe: 'Einrichtung', standardBeschriftung: 'Metallblende', hinweis: 'Ein einzelnes Blech – für die Front oder eine Seite' },

  // ---------------------------------------------------- Bau und Technik
  //
  // Was beim Aufmessen eines bestehenden Marktes mit in den Plan muss. Diese
  // Zeichen stehen für nichts, was geliefert wird – sie halten fest, was
  // schon da ist und die Planung einschränkt. Eine Säule mitten in der
  // Gasse entscheidet ueber den ganzen Zug davor.
  { id: 'einzelsaeule', name: 'Einzelsäule', kategorie: 'ausstattung', breite: 30, tiefe: 30, hoehe: 300, form: 'einzelsaeule', farbe: '#e8a7a0', gruppe: 'Bau und Technik', hinweis: 'Zeichen wie in der Wanzl-Legende' },
  { id: 'stuetze-eckig', name: 'Stütze eckig', kategorie: 'ausstattung', breite: 40, tiefe: 40, hoehe: 300, form: 'stuetzeEckig', farbe: '#b9bec4', gruppe: 'Bau und Technik' },
  { id: 'unterzug', name: 'Unterzug', kategorie: 'ausstattung', breite: 600, tiefe: 40, hoehe: 0, form: 'unterzug', farbe: '#cfd4d9', gruppe: 'Bau und Technik', hinweis: 'Läuft über dem Kopf – nur das Band wird gezeichnet' },
  { id: 'schacht', name: 'Schacht', kategorie: 'ausstattung', breite: 120, tiefe: 120, hoehe: 0, form: 'schacht', farbe: '#c6ccd2', gruppe: 'Bau und Technik' },
  { id: 'feuerloescher', name: 'Feuerlöscher', kategorie: 'ausstattung', breite: 30, tiefe: 30, hoehe: 100, form: 'feuerloescher', farbe: '#e0605a', gruppe: 'Bau und Technik' },
  { id: 'notausgang', name: 'Notausgang', kategorie: 'ausstattung', breite: 120, tiefe: 30, hoehe: 210, form: 'notausgang', farbe: '#7cc47c', gruppe: 'Bau und Technik' },
  { id: 'rauchabzug', name: 'Rauch- und Wärmeabzug', kategorie: 'ausstattung', breite: 150, tiefe: 100, hoehe: 0, form: 'rauchabzug', farbe: '#c8d4dc', gruppe: 'Bau und Technik', hinweis: 'RWA – Fläche muss frei bleiben' },
  { id: 'bodenablauf', name: 'Bodenablauf', kategorie: 'ausstattung', breite: 30, tiefe: 30, hoehe: 0, form: 'bodenablauf', farbe: '#aebcc6', gruppe: 'Bau und Technik' },
  { id: 'anschluss-strom', name: 'Stromanschluss', kategorie: 'ausstattung', breite: 20, tiefe: 20, hoehe: 0, form: 'anschlussStrom', farbe: '#e8c96a', gruppe: 'Bau und Technik' },
  { id: 'anschluss-wasser', name: 'Wasseranschluss', kategorie: 'ausstattung', breite: 20, tiefe: 20, hoehe: 0, form: 'anschlussWasser', farbe: '#8ec4de', gruppe: 'Bau und Technik' },
];

/** Sucht eine Vorlage. Gibt `undefined` zurück, wenn es sie nicht (mehr) gibt. */
export function findeVorlage(
  id: string,
  eigene: BibliothekEintrag[] = [],
): BibliothekEintrag | undefined {
  return [...BIBLIOTHEK, ...eigene].find((v) => v.id === id);
}
