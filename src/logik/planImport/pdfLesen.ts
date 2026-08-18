import * as pdfjs from 'pdfjs-dist';
import arbeiterUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { Planart, PlanSeite, PlanText } from './typen';
import type { Strecke } from './waende';

/**
 * Ein Plan-PDF einlesen.
 *
 * Das ist die einzige Stelle, die pdf.js kennt. Alles darüber arbeitet nur
 * noch mit `PlanSeite` – dadurch lässt sich die ganze Erkennung mit
 * ausgedachten Daten prüfen, ohne je ein PDF zu öffnen.
 *
 * Die Koordinaten werden hier auf die übliche Leserichtung gebracht:
 * Ursprung links oben, y nach unten. PDF rechnet von links unten nach oben,
 * und diese eine Umrechnung an einer Stelle erspart es, später überall daran
 * denken zu müssen.
 */

// pdf.js lagert das Zerlegen in einen eigenen Arbeiter aus. Vite liefert die
// Datei über `?url` mit aus, statt sie von einem fremden Server zu holen –
// das Programm soll auch ohne Netz laufen.
pdfjs.GlobalWorkerOptions.workerSrc = arbeiterUrl;

/** Punkte in Millimeter – PDF rechnet in 1/72 Zoll. */
const PT_JE_MM = 72 / 25.4;

export interface PlanBefund extends PlanSeite {
  planart: Planart;
  /** Wie viele Seiten das Dokument hat. Eingelesen wird die erste. */
  seiten: number;
  /** Warum die Planart so eingeschätzt wurde. */
  begruendung: string;
}

/**
 * Liest die erste Seite eines Plan-PDFs.
 *
 * Die Pfade bleiben vorerst leer – die Geometrie kommt erst, wenn sie
 * gebraucht wird. Für Maßstab und Regale genügen die Texte, und die sind in
 * einem Bruchteil der Zeit da.
 */
export async function lesePlan(daten: ArrayBuffer): Promise<{ befund: PlanBefund; dokument: PDFDocumentProxy }> {
  const dokument = await pdfjs.getDocument({ data: daten }).promise;
  const seite = await dokument.getPage(1);
  const sicht = seite.getViewport({ scale: 1 });

  const texte = await liesTexte(seite);
  const { planart, begruendung } = await schaetzePlanart(seite, texte);

  return {
    dokument,
    befund: {
      blattBreiteMm: sicht.width / PT_JE_MM,
      blattHoeheMm: sicht.height / PT_JE_MM,
      breitePt: sicht.width,
      hoehePt: sicht.height,
      texte,
      pfade: [],
      planart,
      seiten: dokument.numPages,
      begruendung,
    },
  };
}

/**
 * Holt die Textstücke mit Mittelpunkt.
 *
 * pdf.js gibt je Stück eine Matrix: Darin steckt der Ursprung der Grundlinie
 * und, bei gedrehtem Text, die Drehung. Der Mittelpunkt wird deshalb über
 * die Matrix gerechnet und nicht aus dem Ursprung geschätzt – im Plan steht
 * reichlich Text hochkant, und der säße sonst systematisch daneben.
 */
async function liesTexte(seite: PDFPageProxy): Promise<PlanText[]> {
  const inhalt = await seite.getTextContent();
  const hoehe = seite.getViewport({ scale: 1 }).height;

  interface Stueck extends PlanText {
    /** Drehung auf dem Bildschirm in Grad. */
    winkel: number;
    /** Lage entlang und quer zur Schriftrichtung – zum Zusammensetzen. */
    laengs: number;
    quer: number;
  }

  const stuecke: Stueck[] = [];
  for (const roh of inhalt.items) {
    if (!('str' in roh)) continue;
    if (!roh.str.trim()) continue;

    const [a, b, c, d, e, f] = roh.transform;
    const breite = roh.width;
    const schrifthoehe = roh.height || Math.hypot(c, d) || 1;

    // Mitte des Textkastens durch die Matrix schicken. Bei gedrehtem Text –
    // und im Plan steht reichlich hochkant – läge der Ursprung sonst
    // systematisch daneben.
    const x = a * (breite / 2) + c * (schrifthoehe / 2) + e;
    const y = b * (breite / 2) + d * (schrifthoehe / 2) + f;
    // PDF zählt y von unten, wir von oben.
    const bx = x;
    const by = hoehe - y;

    const winkel = (Math.atan2(-b, a) * 180) / Math.PI;
    const bogen = (winkel * Math.PI) / 180;
    stuecke.push({
      text: roh.str,
      x: bx,
      y: by,
      breite: Math.abs(a) * breite + Math.abs(c) * schrifthoehe,
      hoehe: Math.abs(b) * breite + Math.abs(d) * schrifthoehe,
      winkel,
      laengs: bx * Math.cos(bogen) + by * Math.sin(bogen),
      quer: -bx * Math.sin(bogen) + by * Math.cos(bogen),
    });
  }

  // Rohstücke und zusammengesetzte Zeilen zusammen zurückgeben.
  //
  // Beides wird gebraucht, und zwar von verschiedenen Auswertungen: Maßzahlen
  // und Etagenzahlen stehen einzeln im Plan und dürfen nicht mit dem Nachbarn
  // verschmelzen, sonst wird aus „1250" und „1369" ein „1250 1369" und die
  // Maßkette ist futsch. Die Möbeletiketten dagegen gibt es nur als Zeile.
  // Der Weg über eine einzige, möglichst kluge Zusammenfassung war der
  // Irrweg: Was für das eine richtig ist, zerstört das andere.
  const zeilen = setzeZeilenZusammen(stuecke).filter((z) => z.text.includes(' '));
  return [...stuecke.map(({ text, x, y, breite, hoehe }) => ({ text: text.trim(), x, y, breite, hoehe })), ...zeilen];
}

/**
 * Setzt die Textstücke wieder zu Zeilen zusammen.
 *
 * pdf.js gibt den Text so heraus, wie er im PDF steht, und das ist oft
 * kleinteilig: Aus „wt100 H 1800 T 600" werden mehrere Stücke, weil zwischen
 * den Wörtern die Schriftposition neu gesetzt wird. Wer auf dem einzelnen
 * Stück nach einem Muster sucht, findet nichts – genau daran ist die
 * Etikettenerkennung zuerst gescheitert.
 *
 * Zusammengefasst wird, was dieselbe Schriftrichtung hat, auf derselben
 * Grundlinie sitzt und nah genug beieinander steht. Der Abstand wird an der
 * Schrifthöhe gemessen, nicht an einem festen Maß: Ein Plan enthält Schrift
 * in sehr verschiedenen Größen, und ein Lückenmaß in Punkten wäre bei der
 * kleinen Schrift zu grob und bei der großen zu fein.
 */
function setzeZeilenZusammen<T extends PlanText & { winkel: number; laengs: number; quer: number }>(
  stuecke: T[],
): PlanText[] {
  // Nach Schriftrichtung und Grundlinie bündeln.
  const gruppen = new Map<string, T[]>();
  for (const s of stuecke) {
    const richtung = Math.round(s.winkel / 2) * 2;
    const zeile = Math.round(s.quer / 2);
    const schluessel = `${richtung}|${zeile}`;
    const liste = gruppen.get(schluessel) ?? [];
    liste.push(s);
    gruppen.set(schluessel, liste);
  }

  const zeilen: PlanText[] = [];
  for (const liste of gruppen.values()) {
    liste.sort((a, b) => a.laengs - b.laengs);

    let offen: T[] = [];
    const abschliessen = () => {
      if (offen.length === 0) return;
      const text = offen
        .map((s) => s.text)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) {
        const links = Math.min(...offen.map((s) => s.x - s.breite / 2));
        const rechts = Math.max(...offen.map((s) => s.x + s.breite / 2));
        const oben = Math.min(...offen.map((s) => s.y - s.hoehe / 2));
        const unten = Math.max(...offen.map((s) => s.y + s.hoehe / 2));
        zeilen.push({
          text,
          x: (links + rechts) / 2,
          y: (oben + unten) / 2,
          breite: rechts - links,
          hoehe: unten - oben,
        });
      }
      offen = [];
    };

    for (const s of liste) {
      if (offen.length === 0) {
        offen = [s];
        continue;
      }
      const vorher = offen[offen.length - 1];
      const schrift = Math.max(vorher.hoehe, s.hoehe, 1);
      const lueckeAnfang = vorher.laengs + Math.max(vorher.breite, vorher.hoehe) / 2;
      const luecke = s.laengs - Math.max(s.breite, s.hoehe) / 2 - lueckeAnfang;
      // Bis zu einer Schrifthöhe Abstand gehört es noch zur Zeile. Darüber
      // beginnt eine neue Angabe – im Plan stehen Etiketten oft in einer
      // Reihe nebeneinander.
      if (luecke <= schrift * 1.2) {
        // Ein sichtbarer Zwischenraum wird zum Leerzeichen, sonst klebten
        // „T" und „600" aneinander.
        if (luecke > schrift * 0.12 && !/\s$/.test(vorher.text) && !/^\s/.test(s.text)) {
          offen.push({ ...s, text: ` ${s.text}` });
        } else {
          offen.push(s);
        }
      } else {
        abschliessen();
        offen = [s];
      }
    }
    abschliessen();
  }

  return zeilen;
}

/**
 * Vektorplan oder Bildplan?
 *
 * Der Unterschied entscheidet, was möglich ist: Aus einem CAD-PDF lässt sich
 * der Plan wirklich auslesen, ein Scan taugt nur als Vorlage zum
 * Darüberzeichnen. Die Unterscheidung wird dem Benutzer angesagt, statt sie
 * zu verschweigen – sonst wundert er sich, warum derselbe Knopf einmal
 * siebzig Regale findet und einmal keines.
 *
 * Gewertet wird nach Textstücken und Zeichenbefehlen. Ein eingescannter Plan
 * hat oft trotzdem eine Textebene aus einer Texterkennung; entscheidend ist
 * deshalb, ob auch gezeichnet wird.
 */
async function schaetzePlanart(
  seite: PDFPageProxy,
  texte: PlanText[],
): Promise<{ planart: Planart; begruendung: string }> {
  const befehle = await seite.getOperatorList();
  const { OPS } = pdfjs;

  // Gezählt wird `constructPath`, nicht `stroke` oder `fill`.
  //
  // Das ist der Punkt, an dem eine naheliegende Zählung falsch ist: pdf.js
  // fasst aufeinanderfolgende Pfadbefehle zusammen und schluckt den
  // Malbefehl dabei mit. Wer auf `stroke` und `fill` zählt, findet in einem
  // reinen CAD-Plan fast nichts und hält ihn für einen Scan – genau das ist
  // hier passiert, bevor es auffiel.
  const pfadBefehle = new Set<number>([
    OPS.constructPath,
    OPS.stroke,
    OPS.closeStroke,
    OPS.fill,
    OPS.eoFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ]);
  const bildBefehle = new Set<number>([OPS.paintImageXObject, OPS.paintInlineImageXObject]);

  let striche = 0;
  let bilder = 0;
  for (const befehl of befehle.fnArray) {
    if (pfadBefehle.has(befehl)) striche++;
    else if (bildBefehle.has(befehl)) bilder++;
  }

  if (striche >= 200) {
    return {
      planart: 'vektor',
      begruendung: `Zeichnungsdaten vorhanden (${striche.toLocaleString('de-DE')} Pfade, ${texte.length.toLocaleString('de-DE')} Textstücke) – der Plan lässt sich auswerten`,
    };
  }

  if (bilder > 0) {
    return {
      planart: 'bild',
      begruendung:
        texte.length > 50
          ? `Der Plan besteht aus ${bilder} Bild${bilder === 1 ? '' : 'ern'} mit einer Textebene, aber ohne Zeichnungsdaten – nutzbar nur als maßstäbliche Vorlage`
          : `Der Plan ist ein Bild ohne Zeichnungsdaten – nutzbar nur als maßstäbliche Vorlage`,
    };
  }

  return {
    planart: 'bild',
    begruendung:
      'Weder nennenswerte Zeichnungsdaten noch Bilder gefunden – der Plan wird als Vorlage eingelegt',
  };
}


/**
 * Holt alle geraden Strecken der Seite.
 *
 * pdf.js liefert Pfade als `constructPath` mit einer Liste von Befehlen und
 * einer flachen Zahlenreihe dahinter. Kurven werden übersprungen: Eine Wand
 * ist gerade, und die Bogenstücke im Plan sind Türschwenks und Rundungen
 * an Möbeln.
 *
 * Zurück kommen Koordinaten in der Leserichtung des Blattes, also mit y
 * nach unten – dieselbe Rechnung wie bei den Texten.
 */
export async function liesStrecken(dokument: PDFDocumentProxy): Promise<Strecke[]> {
  const seite = await dokument.getPage(1);
  const befehle = await seite.getOperatorList();
  const hoehe = seite.getViewport({ scale: 1 }).height;
  const { OPS } = pdfjs;

  // Die Befehlscodes innerhalb eines Teilpfades sind nicht die von pdf.js,
  // sondern eine eigene, kurze Zählung. Das war der Stolperstein: Mit den
  // OPS-Werten dekodiert kam kein einziges Streckenstück heraus.
  const MOVE = 0;
  const LINE = 1;
  const KURVE = 2;

  const strecken: Strecke[] = [];

  for (let i = 0; i < befehle.fnArray.length; i++) {
    if (befehle.fnArray[i] !== OPS.constructPath) continue;
    const teilpfade = (befehle.argsArray[i] as unknown[])[1];
    if (!Array.isArray(teilpfade)) continue;

    for (const roh of teilpfade as ArrayLike<number>[]) {
      let x = 0;
      let y = 0;
      let n = 0;
      while (n < roh.length) {
        const code = roh[n++];
        if (code === MOVE) {
          x = roh[n++];
          y = roh[n++];
        } else if (code === LINE) {
          const nx = roh[n++];
          const ny = roh[n++];
          strecken.push({ von: { x, y: hoehe - y }, bis: { x: nx, y: hoehe - ny } });
          x = nx;
          y = ny;
        } else if (code === KURVE) {
          // Ein Bogen ist keine Wand. Nur der Endpunkt wird übernommen,
          // damit eine anschließende Gerade richtig ansetzt.
          n += 4;
          x = roh[n++];
          y = roh[n++];
        } else {
          // Unbekannter Code: Der Teilpfad lässt sich nicht weiter deuten.
          break;
        }
      }
    }
  }

  return strecken;
}

/**
 * Rendert die Seite als Bild für die Hintergrundebene.
 *
 * `maxKante` begrenzt die längste Bildkante. Ein A1-Blatt in voller Auflösung
 * wäre mehrere Bildschirmbreiten groß und im Projekt nicht mehr zu handhaben;
 * die Vorlage soll aber auch nicht so grob werden, dass man die Regale nicht
 * mehr erkennt. Rund 3000 Bildpunkte sind der brauchbare Mittelweg.
 */
export async function rendereSeite(
  dokument: PDFDocumentProxy,
  maxKante = 3000,
  guete = 0.82,
): Promise<{ bild: string; breitePx: number; hoehePx: number }> {
  const seite = await dokument.getPage(1);
  const grund = seite.getViewport({ scale: 1 });
  const faktor = Math.min(maxKante / Math.max(grund.width, grund.height), 4);
  const sicht = seite.getViewport({ scale: faktor });

  const leinwand = document.createElement('canvas');
  leinwand.width = Math.round(sicht.width);
  leinwand.height = Math.round(sicht.height);
  const ctx = leinwand.getContext('2d');
  if (!ctx) throw new Error('Die Zeichenfläche des Browsers ließ sich nicht anlegen.');

  // Weißer Grund: Ein PDF hat keinen, und auf der dunklen Oberfläche wäre
  // eine Strichzeichnung sonst unsichtbar.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, leinwand.width, leinwand.height);

  // Ein Zeitwächter um das Rendern.
  //
  // Ein A1-Plan mit sechzigtausend Pfaden braucht seine Zeit, und wie lange,
  // hängt vom Rechner ab. Ohne Grenze bliebe der Dialog bei einem Browser,
  // der die Zeichenfläche nicht rastert, für immer auf „Einen Moment" stehen –
  // ohne Fehler, ohne Ausweg. Lieber eine ehrliche Meldung nach einer Minute.
  const auftrag = seite.render({ canvas: leinwand, canvasContext: ctx, viewport: sicht });
  let wecker: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      auftrag.promise,
      new Promise((_, ablehnen) => {
        wecker = setTimeout(
          () =>
            ablehnen(
              new Error(
                'Das Zeichnen der Vorlage hat zu lange gedauert und wurde abgebrochen. ' +
                  'Bei sehr großen Plänen hilft es, die Seite neu zu laden und es noch einmal zu versuchen.',
              ),
            ),
          60_000,
        );
      }),
    ]);
  } finally {
    if (wecker !== undefined) clearTimeout(wecker);
    auftrag.cancel();
  }

  // WebP komprimiert Strichzeichnungen deutlich besser als JPEG und macht
  // keine Artefakte an den Linien. Kann der Browser es nicht, fällt
  // `toDataURL` von selbst auf PNG zurück.
  return {
    bild: leinwand.toDataURL('image/webp', guete),
    breitePx: leinwand.width,
    hoehePx: leinwand.height,
  };
}
