import { Shape, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { modulsatzFuer, zerlegeInModule } from '../../daten/module';
import { achsmassZeichen } from '../../logik/achsmass';
import type { Grundform, PlanElement } from '../../typen/modell';

/**
 * Ein einzelnes Element auf dem Plan.
 *
 * Gezeichnet wird mit einer eigenen Zeichenfunktion (`sceneFunc`). Der Vorteil:
 * Für eine neue Grundform muss unten nur ein weiterer Fall in `zeichneForm`
 * ergänzt werden – am Rest der Anwendung ändert sich nichts. Genauso lassen
 * sich später fertige Symbole einsetzen.
 *
 * Der Bezugspunkt (x/y) ist der MITTELPUNKT. Deshalb wird der Zeichenursprung
 * über `offsetX`/`offsetY` um die halbe Größe verschoben. Dadurch dreht sich
 * jedes Element um die eigene Mitte.
 */

/**
 * Die tote Zone hinter einem wire-tech-100-Regal, in cm.
 *
 * Sie gehört zum System und lässt sich nicht wegplanen: Hinter dem Grundboden
 * bleiben immer 70 mm für Säule und Rückwand. Ein Regal mit 600er Boden
 * braucht also 670 mm Stellfläche. Bei der Gondel liegt die Zone zwischen den
 * beiden Seiten und zählt nur einmal.
 */
const TOTE_ZONE = 7;

/**
 * Schraffiert ein Rechteck unter 45 Grad.
 *
 * Die Linien werden am Rand abgeschnitten. Ohne das Abschneiden stünden
 * die Enden über die Fläche hinaus – bei einer kleinen Stütze fällt das
 * sofort auf, weil das Kreuz dann größer wäre als die Stütze selbst.
 */
function schraffiere(ctx: Konva.Context, b: number, t: number, abstand: number) {
  if (abstand <= 0 || b <= 0 || t <= 0) return;
  // Jede Linie liegt auf x + y = c.
  for (let c = abstand; c < b + t; c += abstand) {
    const x1 = Math.max(0, c - t);
    const x2 = Math.min(b, c);
    if (x2 - x1 < 0.01) continue;
    ctx.moveTo(x1, c - x1);
    ctx.lineTo(x2, c - x2);
  }
}

/**
 * Das Führungsrohr vor dem untersten Boden, in cm.
 *
 * Die Anschlagschiene für Einkaufswagen. Beide Maße sind **an einem Foto
 * abgemessen**, nicht aus einem Katalog: An einem Regal bekannter Tiefe
 * (670 mm) ergab der Maßstab 0,31 cm je Bildpunkt, und damit ein Rohr von
 * 3,7 cm Durchmesser, das 1,2 cm vor der Front sitzt – zusammen 5,0 cm
 * Überstand.
 *
 * Gerundet auf ein 40-mm-Rohr mit 10 mm Luft. Die Gegenprobe stützt den
 * Maßstab: Die Feldbreite im selben Foto kommt auf 96,5 cm heraus und ist
 * damit ein A1000. Sollte im Workbook ein anderes Maß stehen, sind es diese
 * beiden Zahlen und sonst nichts.
 */
const ROHR_ABSTAND = 1;
const ROHR_DURCHMESSER = 4;

/** Wie weit das Rohr insgesamt vor der Front steht. */
export const ROHR_UEBERSTAND = ROHR_ABSTAND + ROHR_DURCHMESSER;

/**
 * Zeichnet das Führungsrohr vor die Front – und bei einer Gondel vor beide.
 *
 * Bewusst **außerhalb** des Elementrahmens: Die Tiefe eines Regals ist die
 * des Möbels, und ein Rohr davor macht das Regal nicht tiefer. Es steht
 * aber im Gang, und genau deshalb muss man es sehen.
 *
 * Gezeichnet wird es als schmales Rechteck - von oben ist ein Rohr zwei
 * Linien, und genau so steht es auch im Plan.
 */
export function zeichneFuehrungsrohr(ctx: Konva.Context, element: PlanElement, b: number, t: number) {
  if (!element.fuehrungsrohr || element.form !== 'wt100') return;
  ctx.rect(0, t + ROHR_ABSTAND, b, ROHR_DURCHMESSER);
  if (element.beidseitig) {
    ctx.rect(0, -ROHR_ABSTAND - ROHR_DURCHMESSER, b, ROHR_DURCHMESSER);
  }
}

/**
 * Die Feldbreiten eines Zugs, auf die gezeichnete Länge umgerechnet.
 *
 * Ohne Feldliste wird gleichmäßig nach Achsmaß geteilt – so wurde bis dahin
 * jeder Zug gezeichnet, und für eine ältere Planung ist das die richtige
 * Deutung.
 *
 * Mit Feldliste werden die Breiten auf die tatsächliche Länge gestreckt. Der
 * Faktor liegt bei eins Komma nichts: Er fängt nur die Rundung des krummen
 * A1333 ab, damit das letzte Feld nicht übersteht.
 */
function feldbreiten(b: number, felder: number[] | undefined, achsmass: number): number[] {
  if (felder && felder.length > 0) {
    const roh = felder.reduce((s, f) => s + f, 0);
    if (roh > 0) {
      const faktor = b / roh;
      return felder.map((f) => f * faktor);
    }
  }
  const anzahl = achsmass > 0 ? Math.max(1, Math.round(b / achsmass)) : 1;
  return Array.from({ length: anzahl }, () => b / anzahl);
}

/**
 * Die Nahtstellen zwischen den Einheiten eines Möbels, im Zeichenmaß.
 *
 * Zwei aneinandergehängte Kühlregale sind zwei Möbel und kein langes.
 * Ohne diese Linie sieht der Plan an der Stelle aus wie ein Stück, und beim
 * Bestellen fällt der Unterschied erst auf, wenn es zu spät ist.
 *
 * Das Trockensortiment fehlt hier mit Absicht: Es zeichnet seine Feldgrenzen
 * schon selbst, und genau so sollen die übrigen Abteilungen auch aussehen.
 */
export function einheitenTeile(element: PlanElement): number[] {
  if (element.form === 'wt100') return [];
  const satz = modulsatzFuer(element.form);
  if (!satz) return [];
  return element.felder ?? zerlegeInModule(element.breite, satz);
}

/**
 * Die Abschnitte, in die ein Möbel im Plan zerfällt – in Planmaß.
 *
 * **Die eine Wahrheit für Naht und Achsmaß-Zeichen.** Beide müssen dieselbe
 * Teilung sehen, sonst zeigt der Plan zwei Diagonalen und keine Trennlinie
 * dazwischen – genau der Widerspruch, den ein Möbel von 2,50 m zuletzt
 * hatte.
 *
 * Zwei Schritte führen dorthin: erst die Einheiten, aus denen das Möbel
 * besteht; dann jede Einheit, die selbst ein Vielfaches von 1,25 m ist, noch
 * einmal geteilt – ein Kühlregal von 2,50 m ist eine Vorlage und trotzdem
 * zweimal 1,25 m.
 */
export function zeichenAbschnitte(element: PlanElement): number[] {
  const teile = einheitenTeile(element);
  const einheiten = teile.length > 0 ? teile : [element.breite];

  const abschnitte: number[] = [];
  for (const einheit of einheiten) {
    if (achsmassZeichen(einheit) !== 'keins') {
      // Ein eigenes Achsmaß wird nicht weiter zerlegt.
      abschnitte.push(einheit);
      continue;
    }
    const zahl = diagonalAbschnitte(einheit);
    if (zahl > 1) {
      for (let i = 0; i < zahl; i++) abschnitte.push(einheit / zahl);
    } else {
      abschnitte.push(einheit);
    }
  }
  return abschnitte;
}

export function einheitenNaehte(element: PlanElement, b: number): number[] {
  // Der Regalzug zeichnet seine Feldgrenzen selbst.
  if (element.form === 'wt100' || !modulsatzFuer(element.form)) return [];

  const abschnitte = zeichenAbschnitte(element);
  if (abschnitte.length < 2) return [];
  const roh = abschnitte.reduce((summe, teil) => summe + teil, 0);
  if (roh <= 0) return [];

  // Auf die gezeichnete Länge umrechnen – dieselbe Streckung wie bei den
  // Feldern des Regalzugs.
  const faktor = b / roh;
  const naehte: number[] = [];
  let x = 0;
  for (const teil of abschnitte.slice(0, -1)) {
    x += teil * faktor;
    naehte.push(x);
  }
  return naehte;
}

/**
 * Zeichnet die gewählte Grundform in ein Rechteck der Größe b × t.
 *
 * `beidseitig` ändert bei manchen Möbeln die Zeichnung: Eine Doppeltruhe hat
 * einen Steg in der Mitte, eine Einzeltruhe eine Rückwand. `achsmass` teilt
 * einen Regalzug gleichmäßig in Felder, `felder` gibt stattdessen jedes Feld
 * einzeln vor – daran hängt ein gemischter Zug.
 */
export function zeichneForm(
  ctx: Konva.Context,
  form: Grundform,
  b: number,
  t: number,
  beidseitig = false,
  achsmass = 0,
  felder?: number[],
  gespiegelt = false,
) {
  switch (form) {
    case 'abgerundet': {
      const r = Math.min(b, t) * 0.18;
      ctx.moveTo(r, 0);
      ctx.arcTo(b, 0, b, t, r);
      ctx.arcTo(b, t, 0, t, r);
      ctx.arcTo(0, t, 0, 0, r);
      ctx.arcTo(0, 0, b, 0, r);
      ctx.closePath();
      break;
    }
    case 'kreis':
      ctx.ellipse(b / 2, t / 2, b / 2, t / 2, 0, 0, Math.PI * 2);
      break;
    case 'halbkreis':
      // Flache Seite unten.
      ctx.ellipse(b / 2, t, b / 2, t, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      break;
    case 'linie': {
      // Ein schmaler Balken in der Mitte des Rahmens.
      const dicke = Math.max(t * 0.25, 4);
      ctx.rect(0, t / 2 - dicke / 2, b, dicke);
      break;
    }
    case 'pfeil': {
      const schaft = t * 0.35;
      const spitze = Math.min(b * 0.3, t);
      ctx.moveTo(0, t / 2 - schaft / 2);
      ctx.lineTo(b - spitze, t / 2 - schaft / 2);
      ctx.lineTo(b - spitze, 0);
      ctx.lineTo(b, t / 2);
      ctx.lineTo(b - spitze, t);
      ctx.lineTo(b - spitze, t / 2 + schaft / 2);
      ctx.lineTo(0, t / 2 + schaft / 2);
      ctx.closePath();
      break;
    }
    case 'bakeoff': {
      // Ein BakeOff-Turm von oben, nachgezeichnet aus dem Wanzl-Plan.
      //
      // Der Turm zeigt im Grundriss vier Bänder: hinten die Rückwand, davor
      // ein schmaler Streifen, dann die große Warenfläche und vorn die
      // Ablage. Genau diese Gliederung macht die Zeile auf dem Plan
      // wiedererkennbar – ein leeres Rechteck wäre nur ein Kasten.
      //
      // Die Trennlinien liegen als eigene Teilpfade im selben Pfad: Sie haben
      // keine Fläche, werden also nur gestrichelt gezeichnet und nicht gefüllt.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.23, 0.32, 0.83]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;
    }
    case 'bakeoffEcke': {
      // Das Eckstück: ein Keil, der die Lücke füllt, wenn die Zeile abknickt.
      // Bei gleicher Breite und Tiefe steht die Schräge genau auf 45°.
      ctx.moveTo(0, 0);
      ctx.lineTo(b, 0);
      ctx.lineTo(0, t);
      ctx.closePath();
      break;
    }
    case 'vitable':
      // Der Obst- und Gemüsetisch von oben. Die Stufenkanten kommen als
      // helle Linien in einem zweiten Durchgang dazu (siehe `helleLinien`) –
      // sie sind im Plan weiß und heben sich so vom Grün ab.
      ctx.rect(0, 0, b, t);
      break;

    case 'vitableAbschluss':
      // Gerader Abschluss („Abschluss 90°"): schließt den Zug stumpf ab.
      ctx.rect(0, 0, b, t);
      break;

    case 'vitableAbschlussRund': {
      // Runder Abschluss („Abschluss 180°") am Kopf einer Gondel:
      // vorn halbrund, hinten gerade am Zug anschließend.
      const r = t / 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(b - r, 0);
      ctx.arc(b - r, r, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(0, t);
      ctx.closePath();
      break;
    }

    case 'vitableEckInnen': {
      // Das 45-Grad-Eckstück: hinten gerade, vorn schräg abgeschnitten.
      //
      // Es sitzt am Ende seines Zuges und füllt die Ecke. Am Anschluss an
      // den Zug hat es die volle Tiefe; zur Ecke hin nimmt die Front unter
      // 45 Grad ab. Zwei davon – eines je Zug, das zweite seitenverkehrt –
      // fasen die Gangecke gemeinsam ab. Die Außenecke hinten bleibt
      // rechtwinklig.
      //
      // Bei halber Tiefe als Länge treffen sich die beiden Schrägen genau
      // auf der Diagonalen der Eckfläche und ergeben eine durchgehende
      // Fase. Länger als tief kann das Stück nicht sinnvoll werden – dann
      // ist die Front schon auf null gelaufen.
      const rest = Math.max(0, t - b);
      if (gespiegelt) {
        // Volle Tiefe am rechten Ende.
        ctx.moveTo(0, 0);
        ctx.lineTo(b, 0);
        ctx.lineTo(b, t);
        ctx.lineTo(0, rest);
      } else {
        // Volle Tiefe am linken Ende.
        ctx.moveTo(0, 0);
        ctx.lineTo(b, 0);
        ctx.lineTo(b, rest);
        ctx.lineTo(0, t);
      }
      ctx.closePath();
      break;
    }

    case 'vitableEckAussen':
      // Außeneck 90°: füllt die Ecke, um die der Zug außen herumgeführt wird.
      ctx.moveTo(0, 0);
      ctx.lineTo(b, 0);
      ctx.lineTo(0, t);
      ctx.closePath();
      break;

    case 'tkTruhe': {
      // Tiefkühlinsel von oben, unterteilt in Module von 62,5 cm. Genau
      // diese Teilung macht die Truhe im Plan erkennbar und zeigt, wie lang
      // sie sich bauen lässt.
      ctx.rect(0, 0, b, t);
      for (let x = TRUHENMODUL; x < b - 0.1; x += TRUHENMODUL) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, t);
      }
      if (beidseitig) {
        // Doppeltruhe: der Steg in der Mitte, an dem beide Seiten
        // aufeinandertreffen.
        ctx.moveTo(0, t * 0.46);
        ctx.lineTo(b, t * 0.46);
        ctx.moveTo(0, t * 0.54);
        ctx.lineTo(b, t * 0.54);
      } else {
        // Einzeltruhe: nur eine Auslage, dahinter die Rückwand.
        ctx.moveTo(0, t * 0.18);
        ctx.lineTo(b, t * 0.18);
      }
      break;
    }

    case 'tkSchrank': {
      // Tiefkühlschrank: ein Feld je Tür, dazu die Türen selbst als
      // Schwenkbogen davor – so sieht man im Plan sofort, wie weit sie
      // aufgehen und ob der Gang dafür reicht.
      ctx.rect(0, 0, b, t);
      const tueren = tuerAnzahl(b);
      const breiteJeTuer = b / tueren;
      for (let i = 1; i < tueren; i++) {
        ctx.moveTo(i * breiteJeTuer, 0);
        ctx.lineTo(i * breiteJeTuer, t);
      }
      break;
    }

    case 'tkKombi': {
      // Kombigerät: hinten der Schrankteil mit Türen, vorn die offene Wanne.
      // Die Trennlinie liegt bei der Tiefe der oberen Etagen (400 von 1145).
      ctx.rect(0, 0, b, t);
      const grenze = t * 0.35;
      ctx.moveTo(0, grenze);
      ctx.lineTo(b, grenze);
      const tueren = tuerAnzahl(b);
      const breiteJeTuer = b / tueren;
      for (let i = 1; i < tueren; i++) {
        ctx.moveTo(i * breiteJeTuer, 0);
        ctx.lineTo(i * breiteJeTuer, grenze);
      }
      // Die Wanne davor ist wie die Truhe in 62,5er-Module geteilt.
      for (let x = TRUHENMODUL; x < b - 0.1; x += TRUHENMODUL) {
        ctx.moveTo(x, grenze);
        ctx.lineTo(x, t);
      }
      break;
    }

    // Die drei Blink-Möbel unterscheiden sich im Grundriss durch ihre
    // Längslinien. Das ist ihr einziges sichtbares Merkmal – die Umrisse
    // sind fast gleich groß, und nur daran erkennt man auf dem Plan, ob
    // dort bedient wird oder der Kunde selbst zugreift.
    case 'blinkTheke':
      // Bedientheke: hinten der Arbeitsbereich, vorn die Glasfront.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.2, 0.78, 0.9]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;

    case 'blinkSelf':
      // SB flach: kein Arbeitsbereich, dafür zwei gleich große Auslagen,
      // an die der Kunde von vorn herankommt.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.16, 0.58]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;

    case 'blinkSv':
      // SB halbhoch: mehrere übereinanderliegende Etagen, von oben als
      // schmale Bänder sichtbar – wie bei einem Wandregal.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.22, 0.42, 0.62, 0.82]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;

    // Normalkühlung. Alle drei sind blau, deshalb muss die Zeichnung sie
    // auseinanderhalten – im Plan stehen sie oft nebeneinander.
    case 'kuehlSchrank':
    case 'kuehlOffen':
      // Hochkühlregal: eine Etagenkante und die tiefere Sockeletage davor.
      // Der Unterschied zwischen den beiden ist die Tür: Das offene Möbel
      // bekommt keinen Schwenkbogen (siehe MIT_TUEREN).
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.48, 0.62]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;

    case 'kuehlStufen':
      // Das Stufenmöbel: vier eng gestaffelte Etagenkanten und weiter vorn
      // die tiefe Sockeletage. Die dichte Staffelung ist sein Kennzeichen –
      // daran erkennt man es auch ohne Beschriftung.
      // Anteile aus den Etagentiefen 392 / 442 / 492 und Sockel 705 bei
      // einer Gesamttiefe von 991 mm.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.396, 0.446, 0.496, 0.711]) {
        ctx.moveTo(0, t * anteil);
        ctx.lineTo(b, t * anteil);
      }
      break;

    case 'palette': {
      // Palette von oben: die Bretter des Oberdecks. Sie laufen quer zur
      // längeren Seite, so wie man eine Palette im Plan zeichnet – daran
      // erkennt man sie sofort als Palette und nicht als Kiste.
      ctx.rect(0, 0, b, t);
      const laengs = b >= t;
      const bretter = 5;
      for (let i = 1; i < bretter; i++) {
        const anteil = i / bretter;
        if (laengs) {
          ctx.moveTo(0, t * anteil);
          ctx.lineTo(b, t * anteil);
        } else {
          ctx.moveTo(b * anteil, 0);
          ctx.lineTo(b * anteil, t);
        }
      }
      break;
    }

    case 'drehstaender': {
      // Drehständer: Kreis mit Speichen. Die Speichen sind das Zeichen für
      // „dreht sich" – ohne sie wäre es von einem runden Tisch nicht zu
      // unterscheiden.
      const rx = b / 2;
      const ry = t / 2;
      ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
      for (let i = 0; i < 4; i++) {
        const winkel = (i * Math.PI) / 4;
        ctx.moveTo(rx - Math.cos(winkel) * rx, ry - Math.sin(winkel) * ry);
        ctx.lineTo(rx + Math.cos(winkel) * rx, ry + Math.sin(winkel) * ry);
      }
      break;
    }

    // -------------------------------------------------- wire tech 100
    case 'wt100': {
      // Ein Regalzug von oben. Drei Dinge machen ihn im Plan lesbar:
      // die Feldteilung im Achsmaß, das Achsmaß-Zeichen in jedem Feld –
      // und die tote Zone, maßstäblich eingezeichnet.
      //
      // Die tote Zone sind die 70 mm hinter dem Grundboden, die das System
      // immer braucht. Ein Regal mit 600er Boden ist deshalb 670 tief. Bei
      // der Gondel teilen sich beide Seiten diese Zone, sie liegt dort in
      // der Mitte und zählt nur einmal: 2 × 600 + 70 = 1270, nicht 1340.
      ctx.rect(0, 0, b, t);

      // Die Felder einzeln, mit ihren eigenen Maßen. Ein gemischter Zug –
      // fünf Felder A1000 und eines A1250 – muss auch so aussehen: Die
      // Trennlinie sitzt dort, wo im Markt die Säule steht, und das
      // Achsmaß-Zeichen richtet sich nach der Breite des jeweiligen Felds.
      //
      // Die Breiten werden auf die gezeichnete Länge umgerechnet. Beim
      // krummen A1333 summieren sich sonst Zehntelmillimeter bis ans Ende
      // des Zugs, und das letzte Feld stünde sichtbar über.
      const liste = feldbreiten(b, felder, achsmass);
      let x = 0;
      for (let i = 0; i < liste.length; i++) {
        if (i > 0) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, t);
        }
        x += liste[i];
      }

      const zone = Math.min(TOTE_ZONE, t / 2);
      if (beidseitig) {
        ctx.moveTo(0, (t - zone) / 2);
        ctx.lineTo(b, (t - zone) / 2);
        ctx.moveTo(0, (t + zone) / 2);
        ctx.lineTo(b, (t + zone) / 2);
      } else {
        ctx.moveTo(0, zone);
        ctx.lineTo(b, zone);
      }

      // Das Achsmaß-Zeichen steht in jedem Feld, nicht einmal über den
      // ganzen Zug: Ein 6-m-Zug aus 1,25er Feldern hat fünf Diagonalen.
      let links = 0;
      for (const feld of liste) {
        const zeichen = achsmassZeichen(feld);
        if (zeichen !== 'keins') {
          ctx.moveTo(links, t);
          ctx.lineTo(links + feld, 0);
          if (zeichen === 'kreuz') {
            ctx.moveTo(links, 0);
            ctx.lineTo(links + feld, t);
          }
        }
        links += feld;
      }
      break;
    }

    case 'wt100Rund': {
      // Der Abschluss 180°, die runde Kopfgondel. Hinten schließt sie
      // stumpf an den Zug an, vorn laufen die Etagen im Bogen herum.
      const r = Math.min(t, b / 2);
      ctx.moveTo(0, 0);
      ctx.lineTo(b, 0);
      ctx.lineTo(b, t - r);
      ctx.arcTo(b, t, b - r, t, r);
      ctx.lineTo(r, t);
      ctx.arcTo(0, t, 0, t - r, r);
      ctx.closePath();
      // Die tote Zone an der Rückseite, wo sie am Zug anliegt.
      const zone = Math.min(TOTE_ZONE, t / 2);
      ctx.moveTo(0, zone);
      ctx.lineTo(b, zone);
      break;
    }

    case 'wt100Eck': {
      // Das Eckfeld. wire tech 100 kennt kein Eckbauteil – über Eck stößt
      // ein Zug stumpf an den anderen, und dahinter bleibt ein Quadrat
      // liegen, an das niemand herankommt. Die Kreuzschraffur sagt genau
      // das: hier steht Ware, aber sie ist nicht verkäuflich erreichbar.
      ctx.rect(0, 0, b, t);
      ctx.moveTo(0, 0);
      ctx.lineTo(b, t);
      ctx.moveTo(b, 0);
      ctx.lineTo(0, t);
      break;
    }

    // ---------------------------------------------------------------- Regal
    case 'regal':
      // Ein Regalfeld von oben. Der Strich hinten ist die Rückwand, bei einer
      // Gondel steht er in der Mitte: Dort stoßen die beiden Seiten aneinander.
      // Das ist im Plan der einzige Unterschied zwischen einem Wandregal und
      // einer Gondel – die Umrisse sehen sonst gleich aus.
      ctx.rect(0, 0, b, t);
      if (beidseitig) {
        ctx.moveTo(0, t * 0.47);
        ctx.lineTo(b, t * 0.47);
        ctx.moveTo(0, t * 0.53);
        ctx.lineTo(b, t * 0.53);
      } else {
        ctx.moveTo(0, t * 0.14);
        ctx.lineTo(b, t * 0.14);
      }
      break;

    // ------------------------------------------------ Gebäude, Ausstattung
    case 'treppe': {
      // Eine Treppe von oben: die Stufenkanten quer zur Laufrichtung, dazu
      // der Laufpfeil. Beides zusammen macht sie erkennbar – Stufen allein
      // sähen aus wie ein Regal, ein Pfeil allein wie ein Durchgang.
      //
      // Gelaufen wird über die längere Seite. Die Auftrittstiefe von 28 cm
      // ist das übliche Maß im öffentlichen Bereich; daraus ergibt sich die
      // Zahl der Stufen, statt sie am Element einstellen zu müssen.
      ctx.rect(0, 0, b, t);
      const laengs = b >= t;
      const lauf = laengs ? b : t;
      const stufen = Math.max(2, Math.round(lauf / 28));
      for (let i = 1; i < stufen; i++) {
        const stelle = (lauf * i) / stufen;
        if (laengs) {
          ctx.moveTo(stelle, 0);
          ctx.lineTo(stelle, t);
        } else {
          ctx.moveTo(0, stelle);
          ctx.lineTo(b, stelle);
        }
      }
      // Der Laufpfeil auf der Mittelachse, aufwärts.
      const laenge = lauf * 0.7;
      const start = (lauf - laenge) / 2;
      const kopf = Math.min(laenge * 0.18, (laengs ? t : b) * 0.3);
      const quer = (laengs ? t : b) / 2;
      if (laengs) {
        ctx.moveTo(start, quer);
        ctx.lineTo(start + laenge, quer);
        ctx.moveTo(start + laenge - kopf, quer - kopf * 0.6);
        ctx.lineTo(start + laenge, quer);
        ctx.lineTo(start + laenge - kopf, quer + kopf * 0.6);
      } else {
        ctx.moveTo(quer, start + laenge);
        ctx.lineTo(quer, start);
        ctx.moveTo(quer - kopf * 0.6, start + kopf);
        ctx.lineTo(quer, start);
        ctx.lineTo(quer + kopf * 0.6, start + kopf);
      }
      break;
    }

    case 'aufzug': {
      // Der Aufzug: das gekreuzte Rechteck ist das Zeichen für den Fahrkorb,
      // davor die geteilte Schiebetür.
      ctx.rect(0, 0, b, t);
      const rand = Math.min(b, t) * 0.1;
      ctx.moveTo(rand, rand);
      ctx.lineTo(b - rand, t - rand);
      ctx.moveTo(b - rand, rand);
      ctx.lineTo(rand, t - rand);
      // Die Tür vorn: zwei Flügel mit einem Spalt in der Mitte.
      ctx.moveTo(rand, t - rand);
      ctx.lineTo(b * 0.45, t - rand);
      ctx.moveTo(b * 0.55, t - rand);
      ctx.lineTo(b - rand, t - rand);
      break;
    }

    case 'saeule': {
      // Eine tragende Säule wird im Grundriss schraffiert – so unterscheidet
      // sie sich von einem runden Tisch oder einem Ständer, der nur dort steht.
      const rx = b / 2;
      const ry = t / 2;
      ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
      const r = Math.min(rx, ry);
      // Ohne diese Bremse dreht die Schleife endlos, sobald jemand die Säule
      // auf null zieht – der Abstand wäre dann ebenfalls null.
      if (r < 1) break;
      const abstand = r / 2;
      for (let d = -r + abstand / 2; d < r; d += abstand) {
        // Sehne im Abstand d von der Mitte, um 45° gedreht.
        const halb = Math.sqrt(Math.max(r * r - d * d, 0));
        const mx = rx + d * Math.SQRT1_2;
        const my = ry - d * Math.SQRT1_2;
        ctx.moveTo(mx - halb * Math.SQRT1_2, my - halb * Math.SQRT1_2);
        ctx.lineTo(mx + halb * Math.SQRT1_2, my + halb * Math.SQRT1_2);
      }
      break;
    }

    case 'tuerBlatt':
      // Nur die Zarge. Blatt und Schwenkbogen kommen als Strich dazu, sonst
      // würde die Füllung aus dem Bogen ein Tortenstück machen.
      ctx.rect(0, 0, b, t);
      break;

    case 'fenster':
      // Fenster: die Mauerlaibung und darin die Scheibe als schmales Band.
      ctx.rect(0, 0, b, t);
      ctx.moveTo(0, t * 0.38);
      ctx.lineTo(b, t * 0.38);
      ctx.moveTo(0, t * 0.62);
      ctx.lineTo(b, t * 0.62);
      break;

    case 'stellflaeche':
      // Eine Stellfläche ist kein Möbel, sondern freigehaltener Boden.
      // Die Schraffur sagt genau das: Hier steht etwas, aber nichts Festes.
      ctx.rect(0, 0, b, t);
      schraffiere(ctx, b, t, Math.max(Math.min(b, t) / 4, 20));
      break;

    case 'schild': {
      // Schild oder Bildschirm: die Tafel und davor zwei Striche, die zeigen,
      // wohin sie schaut. Ohne die Blickrichtung wäre es nur ein Balken.
      ctx.rect(0, 0, b, t);
      const spitze = t * 1.2;
      ctx.moveTo(b * 0.5 - b * 0.15, t + spitze);
      ctx.lineTo(b * 0.5, t);
      ctx.lineTo(b * 0.5 + b * 0.15, t + spitze);
      break;
    }

    // ------------------------------------------------------------- Kassen
    case 'kasse':
    case 'kasseSitz':
      zeichneKasse(ctx, b, t, false);
      break;

    case 'kasseDoppel':
      zeichneKasse(ctx, b, t, true);
      break;

    case 'sbKasse': {
      // Selbstbedienungskasse: hinten der Terminalkopf mit Scanner und
      // Bildschirm, davor die Ablage zum Einpacken. Der Kreis ist der
      // Bezahlteil – so unterscheidet sie sich vom bloßen Tisch.
      ctx.rect(0, 0, b, t);
      const kopf = t * 0.42;
      ctx.rect(b * 0.06, t * 0.06, b * 0.88, kopf - t * 0.06);
      ctx.moveTo(0, kopf);
      ctx.lineTo(b, kopf);
      const r = Math.min(b, t) * 0.11;
      ctx.moveTo(b * 0.78 + r, kopf + (t - kopf) / 2);
      ctx.ellipse(b * 0.78, kopf + (t - kopf) / 2, r, r, 0, 0, Math.PI * 2);
      // Die Ablage davor.
      ctx.rect(b * 0.06, kopf + t * 0.08, b * 0.6, t - kopf - t * 0.16);
      break;
    }

    case 'ausgangsanlage': {
      // Die Ausgangsanlage: ein Pfosten an jedem Ende, dazwischen das
      // Geländer, und der Flügel schwenkt in Laufrichtung auf. Der Bogen
      // kommt als Strich dazu, sonst würde er zum Tortenstück.
      const pfosten = Math.min(t, b * 0.12);
      ctx.rect(0, 0, pfosten, t);
      ctx.rect(b - pfosten, 0, pfosten, t);
      // Das Geländer dazwischen, dünner als die Pfosten.
      ctx.rect(pfosten, t * 0.3, b - 2 * pfosten, t * 0.4);
      break;
    }

    case 'wagenbox': {
      // Einkaufswagen ineinandergeschoben. Jedes U ist ein Wagen; sie sind
      // vorn offen, weil der nächste hineinfährt.
      ctx.rect(0, 0, b, t);
      const anzahl = Math.max(2, Math.round(b / 25));
      const je = b / anzahl;
      const oben = t * 0.15;
      const unten = t * 0.85;
      for (let i = 0; i < anzahl; i++) {
        const x = i * je + je * 0.12;
        const breite = je * 0.76;
        ctx.moveTo(x, oben);
        ctx.lineTo(x, unten);
        ctx.lineTo(x + breite, unten);
        ctx.lineTo(x + breite, oben);
      }
      break;
    }

    case 'automat': {
      // Leergutautomat: das Gehäuse und darunter der Einwurf.
      ctx.rect(0, 0, b, t);
      ctx.rect(b * 0.08, t * 0.08, b * 0.84, t * 0.54);
      const r = Math.min(b, t) * 0.12;
      ctx.moveTo(b * 0.5 + r, t * 0.78);
      ctx.ellipse(b * 0.5, t * 0.78, r, r, 0, 0, Math.PI * 2);
      break;
    }

    case 'zugang': {
      // Ein- oder Ausgang: die Fläche mit dem Pfeil, der die Laufrichtung
      // angibt. Gedreht wird das Element, nicht das Symbol.
      ctx.rect(0, 0, b, t);
      const y = t / 2;
      const von = b * 0.18;
      const bis = b * 0.82;
      const kopf = Math.min((bis - von) * 0.25, t * 0.35);
      ctx.moveTo(von, y);
      ctx.lineTo(bis, y);
      ctx.moveTo(bis - kopf, y - kopf * 0.7);
      ctx.lineTo(bis, y);
      ctx.lineTo(bis - kopf, y + kopf * 0.7);
      break;
    }

    // -------------------------------------------------------- Bau, Technik
    //
    // Diese Zeichen halten fest, was im Markt schon steht und sich nicht
    // wegplanen lässt. Sie sind bewusst schlicht: Im fertigen Plan sollen
    // sie erkennbar sein, aber nicht mit der Einrichtung um Aufmerksamkeit
    // streiten.
    case 'einzelsaeule': {
      // Die Einzelsäule aus der Wanzl-Legende: ein Kreis mit einem Kreuz,
      // dessen Arme über den Kreis hinausstehen.
      const rx = b / 2;
      const ry = t / 2;
      const r = Math.min(rx, ry);
      ctx.moveTo(rx + r, ry);
      ctx.ellipse(rx, ry, r, r, 0, 0, Math.PI * 2);
      const arm = r * 1.5;
      ctx.moveTo(rx - arm, ry);
      ctx.lineTo(rx + arm, ry);
      ctx.moveTo(rx, ry - arm);
      ctx.lineTo(rx, ry + arm);
      break;
    }

    case 'stuetzeEckig':
      // Eine tragende Stütze mit rechteckigem Querschnitt, schraffiert wie
      // die runde – im Grundriss ist Schraffur das Zeichen für „massiv".
      ctx.rect(0, 0, b, t);
      schraffiere(ctx, b, t, Math.max(Math.min(b, t) / 4, 5));
      break;

    case 'unterzug': {
      // Ein Unterzug läuft über dem Kopf. Gezeichnet wird deshalb nur das
      // Band, in dem er verläuft – zwei Linien, keine Fläche.
      ctx.moveTo(0, 0);
      ctx.lineTo(b, 0);
      ctx.moveTo(0, t);
      ctx.lineTo(b, t);
      break;
    }

    case 'schacht': {
      // Ein Schacht ist ein Loch im Grundriss: Rechteck mit Kreuz.
      ctx.rect(0, 0, b, t);
      ctx.moveTo(0, 0);
      ctx.lineTo(b, t);
      ctx.moveTo(b, 0);
      ctx.lineTo(0, t);
      break;
    }

    case 'feuerloescher': {
      // Kreis mit einer stilisierten Flamme – anders als der Wasseranschluss,
      // der eine Welle trägt.
      const rx = b / 2;
      const ry = t / 2;
      const r = Math.min(rx, ry);
      ctx.moveTo(rx + r, ry);
      ctx.ellipse(rx, ry, r, r, 0, 0, Math.PI * 2);
      ctx.moveTo(rx, ry + r * 0.5);
      ctx.lineTo(rx - r * 0.4, ry);
      ctx.lineTo(rx, ry - r * 0.55);
      ctx.lineTo(rx + r * 0.4, ry);
      ctx.closePath();
      break;
    }

    case 'notausgang': {
      // Rechteck mit einem Pfeil, der hinausführt.
      ctx.rect(0, 0, b, t);
      const y = t / 2;
      const kopf = Math.min(b * 0.28, t * 0.4);
      ctx.moveTo(b * 0.15, y);
      ctx.lineTo(b * 0.85, y);
      ctx.moveTo(b * 0.85 - kopf, y - kopf * 0.6);
      ctx.lineTo(b * 0.85, y);
      ctx.lineTo(b * 0.85 - kopf, y + kopf * 0.6);
      break;
    }

    case 'rauchabzug': {
      // Rauch- und Wärmeabzug: Öffnung nach oben, deshalb zwei Pfeile, die
      // aus der Fläche zeigen.
      ctx.rect(0, 0, b, t);
      for (const anteil of [0.33, 0.67]) {
        const x = b * anteil;
        const kopf = Math.min(t * 0.22, b * 0.16);
        ctx.moveTo(x, t * 0.8);
        ctx.lineTo(x, t * 0.2);
        ctx.moveTo(x - kopf * 0.6, t * 0.2 + kopf);
        ctx.lineTo(x, t * 0.2);
        ctx.lineTo(x + kopf * 0.6, t * 0.2 + kopf);
      }
      break;
    }

    case 'bodenablauf': {
      // Quadrat mit Kreis darin – der Rost über dem Ablauf.
      ctx.rect(0, 0, b, t);
      const rx = b / 2;
      const ry = t / 2;
      const r = Math.min(rx, ry) * 0.6;
      ctx.moveTo(rx + r, ry);
      ctx.ellipse(rx, ry, r, r, 0, 0, Math.PI * 2);
      ctx.moveTo(rx - r, ry);
      ctx.lineTo(rx + r, ry);
      ctx.moveTo(rx, ry - r);
      ctx.lineTo(rx, ry + r);
      break;
    }

    case 'anschlussStrom': {
      // Kreis mit Blitz.
      const rx = b / 2;
      const ry = t / 2;
      const r = Math.min(rx, ry);
      ctx.moveTo(rx + r, ry);
      ctx.ellipse(rx, ry, r, r, 0, 0, Math.PI * 2);
      ctx.moveTo(rx + r * 0.3, ry - r * 0.6);
      ctx.lineTo(rx - r * 0.25, ry + r * 0.05);
      ctx.lineTo(rx + r * 0.1, ry + r * 0.05);
      ctx.lineTo(rx - r * 0.3, ry + r * 0.6);
      break;
    }

    case 'anschlussWasser': {
      // Kreis mit Welle.
      const rx = b / 2;
      const ry = t / 2;
      const r = Math.min(rx, ry);
      ctx.moveTo(rx + r, ry);
      ctx.ellipse(rx, ry, r, r, 0, 0, Math.PI * 2);
      const schritt = (r * 1.2) / 3;
      ctx.moveTo(rx - r * 0.6, ry + r * 0.15);
      for (let i = 0; i < 3; i++) {
        const x = rx - r * 0.6 + schritt * i;
        ctx.lineTo(x + schritt / 2, ry - r * 0.2);
        ctx.lineTo(x + schritt, ry + r * 0.15);
      }
      break;
    }

    case 'umriss':
      // Der Umriss wird im zweiten Durchgang gezeichnet, weil er die Punkte
      // des Elements braucht und nicht nur seine Maße. Hier bleibt nichts zu
      // tun – ein Rechteck wäre falsch, gerade bei einer kreuzförmigen
      // Stütze.
      break;

    case 'rechteck':
    default:
      ctx.rect(0, 0, b, t);
      break;
  }
}

/**
 * Die festen Abschnitte einer bedienten Kasse in cm, in Laufrichtung.
 *
 * Abgemessen an der Straight IV im Marktplan Immenhausen: Das Möbel ist dort
 * 3913 mm lang und teilt sich in Kopfteil, Warenband, Kassenplatz und
 * Abpacktisch. Aufgedruckt ist nur das Band mit 450 × 1800 mm – die übrigen
 * Abschnitte sind am Plan gemessen und summieren sich mit dem Band genau auf
 * die Gesamtlänge.
 *
 * Fest sind hier alle Abschnitte außer dem Band. Das ist auch der Grund: Wird
 * das Element länger gezogen, wächst nur das Band – genau so wird eine Kasse
 * auch bestellt. Kopfteil, Kassenplatz und Abpacktisch bleiben, wie sie sind.
 */
const KASSE_KOPF = 42.8;
const KASSE_PLATZ = 61.8;
const KASSE_ABPACK = 106.7;
const KASSE_FEST = KASSE_KOPF + KASSE_PLATZ + KASSE_ABPACK;

/** Breite eines Warenbands quer zur Laufrichtung, in cm. */
const KASSE_BAND = 45;

/**
 * Zeichnet eine bediente Kasse: b ist die Länge in Laufrichtung, t die Breite
 * quer dazu. Die Doppelkasse hat zwei Bänder an den Außenseiten und dazwischen
 * die Insel, auf der bedient wird.
 */
function zeichneKasse(ctx: Konva.Context, b: number, t: number, doppelt: boolean) {
  ctx.rect(0, 0, b, t);

  // Die Querteilung. Bei einem sehr kurz gezogenen Element bleibt vom Band
  // nichts übrig – dann rücken die Fugen zusammen, statt sich zu überholen.
  const band = Math.max(b - KASSE_FEST, 0);
  const x1 = Math.min(KASSE_KOPF, b);
  const x2 = Math.min(x1 + band, b);
  const x3 = Math.min(x2 + KASSE_PLATZ, b);
  for (const x of [x1, x2, x3]) {
    if (x <= 0 || x >= b) continue;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, t);
  }

  const rahmen = Math.min(t * 0.1, 5);
  const bandBreite = Math.min(KASSE_BAND, t / (doppelt ? 3 : 1) - rahmen);

  if (band > 0.5 && bandBreite > 0) {
    if (doppelt) {
      // Ein Band an jeder Außenseite, die Insel bleibt in der Mitte.
      ctx.rect(x1, rahmen, band, bandBreite);
      ctx.rect(x1, t - rahmen - bandBreite, band, bandBreite);
    } else {
      ctx.rect(x1, rahmen, band, Math.min(bandBreite, t - 2 * rahmen));
    }
  }

  // Der Kassenplatz: Scanner und Geldlade als eigener Kasten.
  if (x3 - x2 > 1 && t > 4) {
    const laenge = (x3 - x2) * 0.55;
    const tiefe = Math.min(t * 0.3, 25);
    const mitte = (x2 + x3) / 2;
    ctx.rect(mitte - laenge / 2, (t - tiefe) / 2, laenge, tiefe);
  }

  // Der Abpacktisch als eingesetzte Fläche.
  if (b - x3 > 2 * rahmen && t > 2 * rahmen) {
    ctx.rect(x3 + rahmen, rahmen, b - x3 - 2 * rahmen, t - 2 * rahmen);
  }
}

/**
 * Der Stuhl einer Sitzkasse und der Flügel einer Ausgangsanlage.
 *
 * Beides ist nur Strich: Ein Stuhl von oben ist ein Kreis mit einer Lehne
 * dahinter, und eine Lehne ist ein Bogen. Läge der Bogen im Hauptpfad, würde
 * die Füllung des Möbels ein Tortenstück daraus machen.
 */
function zeichneStuhl(ctx: Konva.Context, b: number, t: number, mittig: boolean) {
  const band = Math.max(b - KASSE_FEST, 0);
  const mitte = Math.min(KASSE_KOPF + band + KASSE_PLATZ / 2, b);
  const r = Math.min(18, t * 0.3);
  if (r < 2) return;

  // Bei der Doppelkasse sitzt die Bedienung auf der Insel zwischen den
  // Bändern. Bei der Einzelkasse steht der Stuhl neben dem Möbel – dort
  // gehört er hin, und so sieht man im Plan, wie viel Gang er braucht.
  const y = mittig ? t / 2 : t + r * 1.3;
  ctx.moveTo(mitte + r, y);
  ctx.arc(mitte, y, r, 0, Math.PI * 2);
  // Die Lehne im Rücken, zur Bandseite hin offen.
  ctx.moveTo(mitte + r * 1.45, y);
  ctx.arc(mitte, y, r * 1.45, 0, Math.PI, false);
}

/**
 * Der Schwenkbogen des Ausgangsflügels.
 *
 * Der Flügel hängt am rechten Pfosten und schlägt zur Verkaufsfläche hin auf.
 * Gezeichnet wird die offene Stellung samt Bogen – nur so steht im Plan, wie
 * viel Platz vor der Anlage frei bleiben muss.
 */
function zeichneAusgangsfluegel(ctx: Konva.Context, b: number, t: number) {
  const pfosten = Math.min(t, b * 0.12);
  const angel = b - pfosten;
  const weite = Math.max(b - 2 * pfosten, 0);
  if (weite <= 0) return;
  ctx.moveTo(angel, t);
  ctx.lineTo(angel, t + weite);
  ctx.moveTo(angel, t + weite);
  ctx.arc(angel, t, weite, Math.PI / 2, Math.PI, false);
}

/** Modulbreite einer Tiefkühltruhe in cm – daraus setzt sich ihre Länge zusammen. */
const TRUHENMODUL = 62.5;

/**
 * Türbreite an Kühlmöbeln und Tiefkühlschränken in cm.
 *
 * Eine Tür alle 62,5 cm – dasselbe Rastermaß wie beim TRUHENMODUL. Ein
 * 2,50-m-Möbel hat damit vier Türen. Die Zahl der Türen wird berechnet statt
 * gespeichert: Zieht jemand den Schrank länger, kommen Türen dazu, und genau
 * so wird er auch bestellt.
 *
 * Die Katalogmaße gehen auf: 937, 1250, 1875, 2500 und 3750 mm ergeben 1, 2,
 * 3, 4 und 6 Türen.
 */
const TUERBREITE = TRUHENMODUL;

function tuerAnzahl(breite: number): number {
  return Math.max(1, Math.round(breite / TUERBREITE));
}

/**
 * Formen, vor deren Front Türen gezeichnet werden.
 *
 * Bei den Kühlmöbeln ergibt sich die Zahl der Türen aus der Länge. Eine
 * einzelne Tür aus der Ausstattung hat dagegen genau ein Blatt, egal wie
 * breit sie ist – deshalb steht sie hier mit einer festen Eins.
 */
const MIT_TUEREN = new Map<Grundform, number | 'nachBreite'>([
  ['tkSchrank', 'nachBreite'],
  ['tkKombi', 'nachBreite'],
  ['kuehlSchrank', 'nachBreite'],
  ['kuehlStufen', 'nachBreite'],
  ['tuerBlatt', 1],
]);

/**
 * Zeichnet die Schwenkbögen der Türen vor die Front.
 *
 * Bewusst in einem eigenen Durchgang und nur als Strich: Türbögen sind
 * Linien, keine Flächen. Lägen sie im Hauptpfad, würde die Füllung des
 * Möbels sie mit ausfüllen und aus jedem Bogen ein farbiges Tortenstück
 * machen.
 *
 * Alle Türen schlagen in dieselbe Richtung auf. Im Plan sieht man dadurch auf
 * einen Blick, wie viel Gang eine geöffnete Tür braucht.
 */
function zeichneTuerboegen(ctx: Konva.Context, b: number, t: number, anzahl: number) {
  const tueren = anzahl;
  const breiteJeTuer = b / tueren;
  for (let i = 0; i < tueren; i++) {
    const angel = i * breiteJeTuer;
    // Das Türblatt, im rechten Winkel offen.
    ctx.moveTo(angel, t);
    ctx.lineTo(angel, t + breiteJeTuer);
    // Der Bogen von der offenen Tür bis zur gegenüberliegenden Zarge.
    ctx.moveTo(angel, t + breiteJeTuer);
    ctx.arc(angel, t, breiteJeTuer, Math.PI / 2, 0, true);
  }
}

/**
 * Alles, was nur Strich sein darf, in einem Durchgang.
 *
 * Bögen und Kreise gehören nicht in den Hauptpfad: Der wird gefüllt, und aus
 * jedem offenen Bogen würde dabei ein farbiges Tortenstück. Hier stehen sie
 * deshalb zusammen und werden allein gestrichelt.
 */
export function zeichneStriche(ctx: Konva.Context, form: Grundform, b: number, t: number) {
  const tueren = MIT_TUEREN.get(form);
  if (tueren !== undefined) {
    zeichneTuerboegen(ctx, b, t, tueren === 'nachBreite' ? tuerAnzahl(b) : tueren);
  }
  if (form === 'kasseSitz') zeichneStuhl(ctx, b, t, false);
  if (form === 'kasseDoppel') zeichneStuhl(ctx, b, t, true);
  if (form === 'ausgangsanlage') zeichneAusgangsfluegel(ctx, b, t);
}

/** Formen, die im zweiten Durchgang noch etwas dazubekommen. */
const MIT_STRICHEN = new Set<Grundform>([
  ...MIT_TUEREN.keys(),
  'kasseSitz',
  'kasseDoppel',
  'ausgangsanlage',
]);

/**
 * Formen, die ein Möbel darstellen und deshalb das Achsmaß-Zeichen tragen.
 *
 * Die Regel gilt laut Ladenbau für alle Möbel. Reine Zeichenhilfen wie Linie
 * und Pfeil bekommen es nicht – dort wäre eine Diagonale nur Verwirrung.
 */
/**
 * Formen, bei denen es eine linke und eine rechte Ausführung gibt.
 *
 * Bisher nur das 45-Grad-Eckstück. Über die Drehung ist das nicht zu
 * ersetzen: 180 Grad vertauschen zwar links und rechts, drehen aber auch
 * vorn und hinten – die Front schaute dann zur Wand.
 */
export const SPIEGELBAR = new Set<Grundform>(['vitableEckInnen']);

const MIT_ACHSMASS = new Set<Grundform>([
  'rechteck',
  'abgerundet',
  'regal',
  'bakeoff',
  'vitable',
  'vitableAbschluss',
  // Kühlung und Tiefkühlung. Ein Kühlregal von 1,25 m ist genauso ein
  // A1250 wie ein Regalfeld, und im Plan liest man die Breite am selben
  // Zeichen ab – da darf die Abteilung keinen Unterschied machen.
  'kuehlSchrank',
  'kuehlOffen',
  'kuehlStufen',
  'tkSchrank',
  'tkKombi',
  'tkTruhe',
  // Bedientheken. Auch dort baut man aus Modulen, und auch dort liest man
  // die Breite am Zeichen ab.
  'blinkTheke',
  'blinkSelf',
  'blinkSv',
]);

/**
 * Das Maß, in dem die Diagonale sich wiederholt, in cm.
 *
 * Ein Möbel von 2,50 m ist zweimal 1,25 und trägt zwei Diagonalen, eines
 * von 3,75 m derer drei. Geht die Länge nicht glatt auf, bleibt es leer:
 * 0,94 m und 1,88 m bekommen nichts, weil sie kein Vielfaches sind. Ein
 * falsches Zeichen wäre schlimmer als keines – man liest daran ja die
 * Breite ab.
 */
const DIAGONALMASS = 125;

/** Wie viele volle 1,25-m-Abschnitte stecken in dieser Breite? */
function diagonalAbschnitte(breite: number): number {
  const zahl = breite / DIAGONALMASS;
  const ganz = Math.round(zahl);
  if (ganz < 1) return 0;
  // Ein Zentimeter Spielraum, wie beim Achsmaß selbst.
  return Math.abs(breite - ganz * DIAGONALMASS) <= 1 ? ganz : 0;
}

/**
 * Zeichnet das Achsmaß-Zeichen: Diagonale oder Kreuz, siehe `achsmass.ts`.
 *
 * **Je Einheit, nicht je Möbel.** Ein Obst-und-Gemüse-Tisch von 1,25 m trägt
 * seine Diagonale; hängt man einen zweiten an, sind es zwei Einheiten zu
 * 1,25 m und damit zwei Diagonalen. Aus der Gesamtbreite gerechnet käme
 * dagegen 2,50 m heraus – ein Maß, zu dem kein Zeichen gehört, und die
 * Diagonale verschwände genau dann, wenn man sie am nötigsten braucht.
 *
 * Das ist dieselbe Regel, nach der ein Regalzug seine Felder zeichnet.
 */
export function zeichneAchsmass(ctx: Konva.Context, element: PlanElement, b: number, t: number) {
  if (!MIT_ACHSMASS.has(element.form)) return;

  const abschnitte = zeichenAbschnitte(element);
  const roh = abschnitte.reduce((summe, teil) => summe + teil, 0);
  if (roh <= 0) return;
  const faktor = b / roh;

  let x = 0;
  for (const breite of abschnitte) {
    const weite = breite * faktor;
    const zeichen = achsmassZeichen(breite);
    if (zeichen !== 'keins') {
      // Von unten links nach oben rechts – y zeigt auf dem Bildschirm nach
      // unten.
      ctx.moveTo(x, t);
      ctx.lineTo(x + weite, 0);
      if (zeichen === 'kreuz') {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + weite, t);
      }
    }
    x += weite;
  }
}

/**
 * Die hellen Linien, die in einem zweiten Durchgang gezeichnet werden.
 *
 * Bisher sind das die Stufenkanten der Obst- und Gemüsetische. Von oben
 * gesehen verdeckt jede Auflage die darunterliegende – sichtbar bleibt je ein
 * Band, und dessen Kante liegt genau bei der Tiefe der darüberliegenden
 * Auflage. Deshalb wird die tiefste Auflage übersprungen: Sie ist die
 * Vorderkante des Möbels und schon vom Umriss gezeichnet.
 */
function helleLinien(element: PlanElement, b: number, t: number): number[][] {
  const tiefe = element.tiefe;
  if (tiefe <= 0) return [];

  // Eine beidseitige Gondel ist an der Mitte gespiegelt: Jede Seite bekommt
  // die halbe Tiefe, und jede Linie erscheint zweimal.
  const seiten = element.beidseitig ? 2 : 1;
  const korpus = element.korpustiefe ?? tiefe;
  const halberKorpus = korpus / seiten;

  const stellen: number[] = [];

  // Die Kanten der Auflagen, gemessen ab der Rückwand.
  const stufen = element.stufen;
  if (stufen && stufen.length >= 2) {
    const tiefste = Math.max(...stufen);
    if (tiefste > 0) {
      for (const stufe of stufen) {
        if (stufe >= tiefste) continue;
        stellen.push((stufe / tiefste) * halberKorpus);
      }
    }
  }

  // Die Vorderkante des Korpus – ab hier kragt die Front über.
  if (element.korpustiefe && element.korpustiefe < tiefe) stellen.push(halberKorpus);

  const linien: number[][] = [];
  // Zwei gleich tiefe Auflagen (etwa „T800 + 2x T600") liegen von oben
  // gesehen übereinander und ergeben nur eine Kante.
  for (const stelle of [...new Set(stellen)]) {
    const y = (stelle / tiefe) * t;
    linien.push([0, y, b, y]);
    if (element.beidseitig) linien.push([0, t - y, b, t - y]);
  }
  return linien;
}

interface Props {
  element: PlanElement;
  ausgewaehlt: boolean;
  ziehbar: boolean;
  zoom: number;
  /** Meldet den gezeichneten Knoten an die Zeichenfläche (für die Anfasser). */
  merkeKnoten: (id: string, knoten: Konva.Shape | null) => void;
  beiMausTaste: (e: KonvaEventObject<MouseEvent>, id: string) => void;
  beiZiehStart: (e: KonvaEventObject<DragEvent>, id: string) => void;
  beiZiehen: (e: KonvaEventObject<DragEvent>, id: string) => void;
  beiZiehEnde: () => void;
}

export function ElementSymbol({
  element,
  ausgewaehlt,
  ziehbar,
  zoom,
  merkeKnoten,
  beiMausTaste,
  beiZiehStart,
  beiZiehen,
  beiZiehEnde,
}: Props) {
  return (
    <Shape
      id={element.id}
      name="planelement"
      ref={(knoten) => merkeKnoten(element.id, knoten)}
      x={element.x}
      y={element.y}
      width={element.breite}
      height={element.tiefe}
      offsetX={element.breite / 2}
      offsetY={element.tiefe / 2}
      rotation={element.drehung}
      draggable={ziehbar}
      fill={element.farbe}
      stroke={ausgewaehlt ? '#0a84ff' : 'rgba(30,40,52,0.55)'}
      strokeWidth={(ausgewaehlt ? 2 : 1) / zoom}
      opacity={element.gesperrt ? 0.7 : 1}
      shadowForStrokeEnabled={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx, shape) => {
        const b = shape.width();
        const t = shape.height();

        // 1. Umriss und Achsmaß-Zeichen in einem Zug – beides in der
        //    Linienfarbe des Elements.
        ctx.beginPath();
        if (element.form === 'umriss' && element.polygon && element.polygon.length >= 3) {
          // Die Punkte liegen relativ zum Mittelpunkt; gezeichnet wird ab der
          // linken oberen Ecke, deshalb die halbe Größe dazu.
          const p0 = element.polygon[0];
          ctx.moveTo(p0.x + b / 2, p0.y + t / 2);
          for (const p of element.polygon.slice(1)) ctx.lineTo(p.x + b / 2, p.y + t / 2);
          ctx.closePath();
        }
        zeichneForm(
          ctx,
          element.form,
          b,
          t,
          Boolean(element.beidseitig),
          element.achsmass ?? 0,
          element.felder,
          Boolean(element.gespiegelt),
        );
        // Wo zwei Einheiten aneinanderstoßen, kommt eine Trennlinie über
        // die ganze Tiefe – so wie beim Regalzug.
        for (const x of einheitenNaehte(element, b)) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, t);
        }
        zeichneAchsmass(ctx, element, b, t);
        zeichneFuehrungsrohr(ctx, element, b, t);
        ctx.fillStrokeShape(shape);

        // 2. Die hellen Stufenkanten darüber. Sie brauchen eine eigene Farbe
        //    und deshalb einen zweiten Durchgang.
        const hell = helleLinien(element, b, t);
        if (hell.length > 0) {
          ctx.save();
          ctx.setAttr('strokeStyle', '#ffffff');
          ctx.setAttr('lineWidth', 1.6 / zoom);
          ctx.beginPath();
          for (const [x1, y1, x2, y2] of hell) {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.stroke();
          ctx.restore();
        }

        // 3. Türbögen, Stühle und Schwenkflügel – siehe `zeichneStriche`.
        if (MIT_STRICHEN.has(element.form)) {
          ctx.save();
          ctx.setAttr('strokeStyle', 'rgba(30,40,52,0.65)');
          ctx.setAttr('lineWidth', 1.1 / zoom);
          ctx.beginPath();
          zeichneStriche(ctx, element.form, b, t);
          ctx.stroke();
          ctx.restore();
        }
      }}
      onMouseDown={(e) => beiMausTaste(e, element.id)}
      onDragStart={(e) => beiZiehStart(e, element.id)}
      onDragMove={(e) => beiZiehen(e, element.id)}
      onDragEnd={beiZiehEnde}
    />
  );
}

/**
 * Die Beschriftung eines Elements.
 * Sie ist bewusst ein eigenes Objekt: So bleibt die Schrift beim Vergrößern
 * des Elements immer gleich groß und wird nicht mitgedehnt.
 */
export function ElementBeschriftung({
  element,
  zoom,
  erzwungen = false,
}: {
  element: PlanElement;
  zoom: number;
  /** Anzeigen, auch wenn am Element selbst abgeschaltet – siehe `Einstellungen.beschriftungen`. */
  erzwungen?: boolean;
}) {
  if ((!element.beschriftungSichtbar && !erzwungen) || !element.beschriftung.trim()) return null;

  const schrift = element.schriftgroesse / zoom;
  // Zu kleine Schrift auf dem Bildschirm ist unleserlich – dann lieber weglassen.
  if (element.schriftgroesse < 4) return null;

  return (
    <Text
      listening={false}
      x={element.x}
      y={element.y}
      width={element.breite}
      offsetX={element.breite / 2}
      offsetY={schrift * 0.6}
      rotation={element.drehung}
      text={element.beschriftung}
      fontSize={schrift}
      fontFamily="Segoe UI, system-ui, sans-serif"
      fill="#1c2530"
      align="center"
      ellipsis
      wrap="none"
      perfectDrawEnabled={false}
    />
  );
}
