import { Shape, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { modulsatzFuer } from '../../daten/module';
import { achsmassZeichen } from '../../logik/achsmass';
import { laeuftRueckwaerts, lesbar } from '../../logik/beschriftung';
import { feldliste } from '../../logik/feldaufteilung';
import { masszeilen, notizZeilen } from '../../logik/feldnotiz';
import { formatiereFlaeche } from '../../logik/masse';
import {
  felderVon,
  gleicheEinteilung,
  ohneLuecke,
  seitenbreite,
  vollStuecke,
} from '../../logik/regalseiten';
import {
  GRUPPE_GROESSEN,
  GRUPPE_NORMAL,
  gruppensatz,
  gruppenspannen,
  KLEINSTE_SCHRIFT,
  textImKasten,
} from '../../logik/warengruppe';
import { feldkanten } from '../../logik/warengruppenzuordnung';
import { GESTELL_STAERKE, kistenbelegung } from '../../logik/getraenkekisten';
import { palettenAnzahl, palettenmass } from '../../logik/paletten';
import type { Grundform, PlanElement, Punkt, Regalfeld } from '../../typen/modell';

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
 * Ein Feld, wie es gezeichnet wird: sein Platz im Bild und seine Daten.
 *
 * Beides wird gebraucht und darf nicht verwechselt werden: Gezeichnet wird
 * an `x` mit der Weite `weite`, aber das Achsmaß-Zeichen richtet sich nach
 * `feld.breite` – dem wirklichen Maß. Ein auf 1,26 gestrecktes Feld ist
 * immer noch ein A1250 und bekommt seine Diagonale.
 */
interface Feldplatz {
  x: number;
  weite: number;
  feld: Regalfeld;
}

/**
 * Der Faktor, mit dem beide Seiten auf die gezeichnete Länge kommen.
 *
 * **Beide mit demselben.** Die längere Seite füllt das Bild, die kürzere
 * endet früher – genau die Stufe, die man sehen soll. Streckte man jede
 * Seite für sich, wäre sie verschwunden.
 *
 * Der Faktor liegt bei eins Komma nichts: Er fängt die Rundung des krummen
 * A1333 ab, damit das letzte Feld nicht übersteht.
 */
function seitenFaktor(b: number, oben: Regalfeld[], unten: Regalfeld[]): number {
  const roh = Math.max(seitenbreite(oben), seitenbreite(unten));
  return roh > 0 ? b / roh : 1;
}

/** Die Felder einer Seite mit ihrem Platz im Bild. */
function feldplaetze(felder: Regalfeld[], faktor: number): Feldplatz[] {
  const plaetze: Feldplatz[] = [];
  let x = 0;
  for (const feld of felder) {
    const weite = feld.breite * faktor;
    plaetze.push({ x, weite, feld });
    x += weite;
  }
  return plaetze;
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
  // Entweder das Möbel gehört einem System mit festen Rastern an – oder es
  // führt sein eigenes Maß als Achsmaß. Beides heißt: Es besteht aus
  // Einheiten, und die gehören im Plan sichtbar getrennt.
  //
  // Ohne den zweiten Fall wurden drei aneinandergehängte Pflanzregale als
  // ein Klotz von 1,97 m gezeichnet. Im Modell waren es drei Elemente, im
  // Plan sah man eines – und damit sah das Anfügen aus, als täte es nichts.
  if (!modulsatzFuer(element.form) && !element.achsmass) return [];
  // Die vordere Seite gibt die Einheiten vor. Getrennt einteilen lässt sich
  // nur der Regalzug, und der ist hier schon abgebogen.
  return felderVon(element, 'unten').map((feld) => feld.breite);
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
  // Regalzug und Tiefkühlinsel zeichnen ihre Teilung selbst – beim Zug die
  // Feldgrenzen, bei der Truhe die Module à 625 mm. Eine zweite Naht läge
  // dort auf denselben Koordinaten und macht den Strich nur schwerer.
  // Das Getränkegestell zeichnet seine Teilung selbst: Eine Naht über die
  // ganze Tiefe liefe hier durch die Kisten, und die laufen ja gerade durch.
  if (
    element.form === 'wt100' ||
    element.form === 'tkTruhe' ||
    element.form === 'getraenkegestell'
  ) {
    return [];
  }
  if (!modulsatzFuer(element.form) && !element.achsmass) return [];

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
 * Schrifthöhe der Feldnotizen im Plan, in cm.
 *
 * Feste Größe in der Zeichnung, wie bei jeder Beschriftung, die zum Plan
 * gehört: Beim Herauszoomen schrumpft sie mit und blendet sich aus, statt
 * sich übers Regal zu legen.
 *
 * **Notiz und Maß sind gleich groß.** Die Notiz war doppelt so groß – sie
 * wird ja zuerst gelesen –, aber in einem Feld von einem Meter drängte sich
 * die Zahl der Böden vor alles andere. Gleich groß stehen beide Ecken ruhig
 * nebeneinander; welche man zuerst liest, entscheidet ihre Stellung.
 */
const NOTIZ_HOEHE = 11;
const MASS_HOEHE = 11;

/**
 * Zeichnet einen Textblock so, dass er sich lesen lässt.
 *
 * Die Beschriftung gehört zum Möbel und dreht sich mit ihm – sie bleibt an
 * ihrem Platz, auch wenn der Zug quer oder verkehrt herum steht. Nur lesen
 * können muss man sie: Steht sie auf dem Kopf, wird der ganze Block um seine
 * **eigene Mitte** gewendet.
 *
 * Um die eigene Mitte, nicht um die des Möbels: So bleibt der Block genau
 * dort, wo er hingehört – die Notiz in ihrem Feld, die Warengruppe unter
 * ihrer Seite. Und weil sich dabei alles am Mittelpunkt spiegelt, stimmt auch
 * die Reihenfolge der Zeilen wieder: Die erste steht auf dem Bildschirm
 * oben.
 */
function lesbarerBlock(
  ctx: Konva.Context,
  kopf: boolean,
  mx: number,
  my: number,
  zeichnen: () => void,
) {
  if (!kopf) {
    zeichnen();
    return;
  }
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(Math.PI);
  ctx.translate(-mx, -my);
  zeichnen();
  ctx.restore();
}

/**
 * Schreibt die Notizen in die Felder eines Regals.
 *
 * Je Feld links oben die eigenen Zeilen, rechts oben Höhe und Tiefe. Bei
 * einer Gondel zweimal: oben die eine Seite, unten die andere – dort wird
 * getrennt bestückt, und ein gemeinsamer Eintrag wäre schlicht falsch.
 *
 * Eigener Durchgang mit `fillText`, weil Text nicht in den Pfad gehört: Der
 * wird gefüllt und gestrichelt, und aus jedem Buchstaben würde dabei ein
 * Klecks.
 */
/**
 * Die beiden Kennzahlen eines Obst- und Gemüsemöbels, als Zeilen.
 *
 * `4+` wie bei den Regalen – dort ist es die Zahl der Böden, hier die der
 * Auslagen; gelesen wird es gleich. Darunter die grünen Kisten mit ihrem
 * Kürzel, damit die beiden Zahlen nicht zu verwechseln sind.
 *
 * `undefined` heißt: Dieses Möbel führt keine Kennzahlen, es gilt die Notiz.
 */
function ogKennzahlen(element: PlanElement): string[] | undefined {
  if (element.kategorie !== 'obstgemuese') return undefined;
  const zeilen: string[] = [];
  if (element.auslagen) zeilen.push(`${element.auslagen}+`);
  if (element.ifkoKisten) zeilen.push(`${element.ifkoKisten} iK`);
  return zeilen.length > 0 ? zeilen : undefined;
}

export function zeichneFeldnotizen(
  ctx: Konva.Context,
  element: PlanElement,
  b: number,
  t: number,
  zoom: number,
) {
  if (!lesbar(NOTIZ_HOEHE, zoom)) return;

  const unten = felderVon(element, 'unten');
  const oben = element.beidseitig ? felderVon(element, 'oben') : [];
  const faktor = seitenFaktor(b, oben, unten);
  const masse = masszeilen(element);

  const hoehe = element.beidseitig ? t / 2 : t;
  const baender = element.beidseitig
    ? [
        { felder: oben, von: 0 },
        { felder: unten, von: t / 2 },
      ]
    : [{ felder: unten, von: 0 }];

  const rand = Math.min(NOTIZ_HOEHE * 0.35, b * 0.02);
  const kopf = laeuftRueckwaerts(element.drehung);
  // Obst und Gemüse trägt statt der Notiz seine beiden Kennzahlen. Sie
  // stehen am Möbel und nicht am Feld: Ein Vitable-Tisch ist ein Möbel mit
  // einer Zahl Auslagen, nicht sechs Felder mit je einer.
  const kennzahlen = ogKennzahlen(element);
  ctx.setAttr('textBaseline', 'top');

  for (const band of baender) {
    for (const platz of feldplaetze(band.felder, faktor)) {
      // Wo kein Regal steht, steht auch keine Notiz.
      if (platz.feld.leer) continue;

      const zeilenLinks = kennzahlen ?? notizZeilen(platz.feld.notiz);

      // Gewendet wird um die Mitte des Felds: Die Notiz bleibt dadurch in
      // ihrem Feld und steht auf dem Bildschirm wieder links oben.
      lesbarerBlock(ctx, kopf, platz.x + platz.weite / 2, band.von + hoehe / 2, () => {
        // Links: was von Hand darinsteht – oder bei Obst und Gemüse die
        // Kennzahlen des Möbels, die dort keine Entscheidung sind.
        ctx.setAttr('font', `600 ${NOTIZ_HOEHE}px sans-serif`);
        ctx.setAttr('fillStyle', 'rgba(150,26,26,0.92)');
        zeilenLinks.forEach((zeile, z) => {
          ctx.fillText(zeile, platz.x + rand, band.von + rand + z * NOTIZ_HOEHE * 1.15);
        });

        // Rechts: was das Programm ohnehin weiß.
        if (lesbar(MASS_HOEHE, zoom) && masse.length > 0) {
          ctx.setAttr('font', `${MASS_HOEHE}px sans-serif`);
          ctx.setAttr('fillStyle', 'rgba(30,40,52,0.55)');
          ctx.setAttr('textAlign', 'right');
          masse.forEach((zeile, z) => {
            ctx.fillText(
              zeile,
              platz.x + platz.weite - rand,
              band.von + rand + z * MASS_HOEHE * 1.2,
            );
          });
          ctx.setAttr('textAlign', 'left');
        }
      });
    }
  }
}

/** Abstand der Beschriftung vom Möbel, in cm. */
const GRUPPE_ABSTAND = 7;

/** Die größte einstellbare Schrift – ab hier lohnt das Zeichnen überhaupt. */
const GRUPPE_GROESSTE = GRUPPE_GROESSEN[GRUPPE_GROESSEN.length - 1].hoehe;

/**
 * Schreibt die Warengruppen unter den Zug.
 *
 * Eine Beschriftung gilt über eine Strecke – „Ketchup" über drei laufende
 * Meter –, und dann steht sie einmal da und nicht dreimal. Damit man sieht,
 * wie weit sie reicht, bekommt sie eine Klammer: ein Strich an jedem Ende der
 * Strecke, dazwischen eine Linie, die der Text unterbricht.
 *
 * Über einem einzelnen Feld bleibt die Klammer weg. Dort ist nichts zu
 * erklären, und der Plan hat genug Striche.
 *
 * Bei einer Gondel steht die Beschriftung der Vorderseite unter dem Möbel,
 * die der Rückseite darüber – auf der Seite, auf der man davorsteht.
 */
/** Liegen beide Enden auf Feldkanten, und liegt genau eine dazwischen? */
function istGenauEinFeld(von: number, bis: number, kanten: number[]): boolean {
  const auf = (wert: number) => kanten.findIndex((k) => Math.abs(k - wert) < 0.5);
  const a = auf(von);
  const b = auf(bis);
  return a >= 0 && b >= 0 && Math.abs(a - b) === 1;
}

/**
 * Die Farbe der Meterzahl unter einer Warengruppe.
 *
 * Rot, weil es die Zahl ist, um die beim Planen gestritten wird – wie viel
 * Platz ein Sortiment bekommt. Ein dunkles Rot und kein grelles: Es muss auf
 * dem Ausdruck noch lesbar sein.
 */
const METERFARBE = '#b3261e';

/**
 * Der Holzton, mit dem eine Palette hinterlegt wird.
 *
 * Blass genug, dass Böden, Achsmaßzeichen und Beschriftung darüber lesbar
 * bleiben, und warm genug, dass man sie von jedem Möbelgrau unterscheidet.
 * Sie wird vor allem anderen gemalt und liegt damit im Hintergrund.
 */
/**
 * Stärke eines Blendenbretts in cm.
 *
 * Acht Zentimeter sind nicht die Stärke der Platte, sondern die des
 * fertigen Aufbaus mit Unterkonstruktion. Zwei Zentimeter wären im Plan
 * ein Strich und keine Blende.
 */
export const BLENDENSTAERKE = 8;

/** Wie breit ein Trefferbereich auf dem Bildschirm mindestens sein soll. */
const GRIFF_MINDESTBREITE = 11;

/**
 * Die schmalste Stelle, an der man dieses Möbel wirklich anfassen kann.
 *
 * Bei den meisten ist das die kürzere Kante. Eine Blende ist innen offen –
 * dort greift man nur das Brett, und das misst acht Zentimeter.
 */
function griffbreite(element: PlanElement): number {
  if (element.form === 'holzblende' || element.form === 'holzblendeU') return BLENDENSTAERKE;
  return Math.min(element.breite, element.tiefe);
}

/**
 * Wie weit der Trefferbereich über das Gezeichnete hinausreichen darf.
 *
 * Ein Brett von acht Zentimetern ist bei 13 % Zoom **einen** Bildpunkt
 * breit. Man sieht es, man kann es aber nicht anklicken – eine Blende war
 * damit im Plan, aber nicht mehr zu fassen.
 *
 * Konva zeichnet die Trefferfläche auf eine eigene Leinwand; `hitStrokeWidth`
 * legt fest, wie dick die Linien dort werden. Aufgeweitet wird nur so weit,
 * bis elf Bildpunkte erreicht sind, und nur bei dem, was dünner ist. Ein
 * Regal von 57 cm Tiefe bleibt deshalb bei seiner eigenen Kante: Ein Hof
 * ringsum fänge sonst Klicks ab, die dem Nachbarn galten.
 */
export function griffZugabe(element: PlanElement, zoom: number): number | 'auto' {
  const zugabe = GRIFF_MINDESTBREITE / zoom - griffbreite(element);
  return zugabe > 0 ? zugabe : 'auto';
}

const PALETTENFARBE = 'rgba(176, 132, 74, 0.38)';

/** Die Linien der Palette: derselbe Holzton, nur kräftiger. */
const PALETTENLINIE = 'rgba(120, 84, 38, 0.85)';

/**
 * Eine Länge in Metern, so kurz wie möglich.
 *
 * `4 m` statt `4,00 m`: Die Zahl steht klein unter einem Namen und soll auf
 * einen Blick lesbar sein. Nachkommastellen nur, wo sie etwas sagen –
 * `1,88 m` bei einem A1875, aber eben `4 m` bei vier vollen Metern.
 */
export function meterText(cm: number): string {
  const meter = cm / 100;
  const gerundet = Math.round(meter * 100) / 100;
  const text = Number.isInteger(gerundet)
    ? String(gerundet)
    : gerundet.toFixed(2).replace(/0$/, '').replace('.', ',');
  return `${text} m`;
}

export function zeichneWarengruppen(
  ctx: Konva.Context,
  element: PlanElement,
  b: number,
  t: number,
  zoom: number,
) {
  if (!lesbar(GRUPPE_GROESSTE, zoom)) return;

  const unten = felderVon(element, 'unten');
  const oben = element.beidseitig ? felderVon(element, 'oben') : [];
  const faktor = seitenFaktor(b, oben, unten);

  ctx.setAttr('fillStyle', 'rgba(24,32,44,0.92)');
  ctx.setAttr('strokeStyle', 'rgba(24,32,44,0.7)');
  ctx.setAttr('lineWidth', 1.1 / zoom);
  ctx.setAttr('textBaseline', 'top');

  // Wie breit ein Text wird, weiß nur die Leinwand. Die Schrift muss dafür
  // gesetzt sein – gemessen wird in genau der Größe, in der auch gezeichnet
  // wird, sonst passt hinterher nichts.
  const messen = (text: string, schrift: number) => {
    ctx.setAttr('font', `${schrift}px sans-serif`);
    return typeof ctx.measureText === 'function'
      ? ctx.measureText(text).width
      : text.length * schrift * 0.55;
  };

  const kopf = laeuftRueckwaerts(element.drehung);
  const seiten = element.beidseitig
    ? [
        { felder: oben, abschnitte: element.warengruppenOben, vorn: false },
        { felder: unten, abschnitte: element.warengruppenUnten, vorn: true },
      ]
    : [{ felder: unten, abschnitte: element.warengruppenUnten, vorn: true }];

  for (const seite of seiten) {
    // Die Strecken stehen in Zentimetern des Möbels; `faktor` bringt sie auf
    // die gezeichnete Länge. Deshalb braucht es hier keine Feldplätze mehr –
    // eine Grenze darf ja mitten durch ein Feld laufen.
    const gesamt = seitenbreite(seite.felder);
    // Die Feldkanten in der Achse des Möbels – daran entscheidet sich, ob
    // eine Klammer nötig ist. Nicht gespiegelt: Strecken und Felder liegen
    // in derselben Achse, und gedreht wird das ganze Bild.
    const kanten = feldkanten(seite.felder);

    for (const spanne of gruppenspannen(seite.abschnitte, gesamt)) {
      const links = spanne.von * faktor;
      const rechts = spanne.bis * faktor;
      if (rechts - links <= 0) continue;
      const mitte = (links + rechts) / 2;

      // Umgebrochen und notfalls verkleinert, bis es in die Strecke passt.
      // Ein Name, der über sein Möbel hinausragt, steht im Plan über dem
      // Nachbarn und behauptet dort etwas Falsches.
      const satz = gruppensatz(
        spanne.text,
        rechts - links,
        spanne.schrift ?? GRUPPE_NORMAL,
        messen,
      );
      const zeilen = satz.zeilen;
      if (zeilen.length === 0 || !lesbar(satz.schrift, zoom)) continue;

      const zeilenhoehe = satz.schrift * 1.15;
      // Die Meterzahl darunter: Wie viel Platz ein Sortiment bekommt, ist die
      // Frage, um die es beim Planen geht – und niemand soll sie am Bildschirm
      // abmessen müssen. Kleiner als der Name und in Rot, damit beides
      // auseinanderzuhalten ist.
      const meterschrift = Math.max(KLEINSTE_SCHRIFT, satz.schrift * 0.62);
      const meterzeile = lesbar(meterschrift, zoom) ? meterText(spanne.bis - spanne.von) : '';
      const meterhoehe = meterzeile ? meterschrift * 1.35 : 0;

      const hoehe = zeilen.length * zeilenhoehe + meterhoehe;
      const anfang = seite.vorn ? t + GRUPPE_ABSTAND : -GRUPPE_ABSTAND - hoehe;

      // Gewendet wird um die Mitte des ganzen Blocks, Klammer und Meterzahl
      // eingeschlossen: Er bleibt dadurch unter seiner Seite stehen, und auf
      // dem Bildschirm sitzt die Klammer wieder neben der ersten Zeile.
      lesbarerBlock(ctx, kopf, mitte, anfang + hoehe / 2, () => {
        ctx.setAttr('font', `${satz.schrift}px sans-serif`);
        ctx.setAttr('textAlign', 'center');
        zeilen.forEach((zeile, i) => {
          ctx.fillText(zeile, mitte, anfang + i * zeilenhoehe);
        });

        if (meterzeile) {
          ctx.setAttr('fillStyle', METERFARBE);
          ctx.setAttr('font', `${meterschrift}px sans-serif`);
          ctx.fillText(meterzeile, mitte, anfang + zeilen.length * zeilenhoehe + meterschrift * 0.2);
          // Zurück auf die Schriftfarbe – der nächste Durchgang zeichnet
          // wieder einen Namen, und der ist nicht rot.
          ctx.setAttr('fillStyle', 'rgba(24,32,44,0.92)');
        }

        ctx.setAttr('textAlign', 'left');

        // Keine Klammer, wo die Strecke **genau ein Feld** ist: Dort zeigen
        // die Feldgrenzen schon, wie weit der Name gilt, und der Plan hat
        // genug Striche.
        //
        // Überall sonst braucht es sie, und zwar dringender als früher: Seit
        // die Strecken in Zentimetern messen, kann eine mitten in einem Feld
        // enden. Ohne Klammer sähe niemand, wo.
        if (istGenauEinFeld(spanne.von, spanne.bis, kanten)) return;

        // Die Klammer liegt auf der ersten Zeile, der Text schneidet sie frei.
        const y = anfang + zeilenhoehe / 2;
        const arm = satz.schrift * 0.4;
        const luft = satz.schrift * 0.35;
        const halb = messen(zeilen[0], satz.schrift) / 2 + luft;

        ctx.beginPath();
        ctx.moveTo(links, y - arm);
        ctx.lineTo(links, y + arm);
        ctx.moveTo(rechts, y - arm);
        ctx.lineTo(rechts, y + arm);
        if (mitte - halb > links) {
          ctx.moveTo(links, y);
          ctx.lineTo(mitte - halb, y);
          ctx.moveTo(mitte + halb, y);
          ctx.lineTo(rechts, y);
        }
        ctx.stroke();
      });
    }
  }
}

/**
 * Schreibt ein freies Textfeld in den Plan.
 *
 * Nur den Text: Der Kasten darum ist eine Hilfe beim Setzen und gehört nicht
 * in den Plan. Wie groß der Text steht, sagt die Größe des Kastens — das ist
 * dieselbe Regel wie bei der Aktionsfläche und kommt ohne eine weitere
 * Einstellung aus: Man zieht ihn sich zurecht und sieht dabei, was passiert.
 */
function zeichneTextfeld(
  ctx: Konva.Context,
  element: PlanElement,
  b: number,
  t: number,
  zoom: number,
) {
  const text = (element.beschriftung ?? '').trim();
  if (!element.beschriftungSichtbar || text === '' || b <= 0 || t <= 0) return;

  const messen = (inhalt: string, schrift: number) => {
    ctx.setAttr('font', `${schrift}px sans-serif`);
    return typeof ctx.measureText === 'function'
      ? ctx.measureText(inhalt).width
      : inhalt.length * schrift * 0.55;
  };

  // Der Kasten gibt die Schrift vor – in beide Richtungen.
  const satz = textImKasten(text, b * 0.94, t * 0.86, t * 0.62, messen);
  if (satz.zeilen.length === 0 || !lesbar(satz.schrift, zoom)) return;

  const zeilenhoehe = satz.schrift * 1.2;
  const oben = t / 2 - (satz.zeilen.length * zeilenhoehe) / 2;

  ctx.setAttr('font', `${satz.schrift}px sans-serif`);
  ctx.setAttr('fillStyle', 'rgba(24,32,44,0.92)');
  ctx.setAttr('textBaseline', 'top');
  lesbarerBlock(ctx, laeuftRueckwaerts(element.drehung), b / 2, t / 2, () => {
    ctx.setAttr('textAlign', 'center');
    satz.zeilen.forEach((zeile, i) => {
      ctx.fillText(zeile, b / 2, oben + i * zeilenhoehe);
    });
    ctx.setAttr('textAlign', 'left');
  });
}

/**
 * Größte und kleinste Schrift einer Aktionsfläche, in cm.
 *
 * Die Fläche zieht man sich zurecht — zwei Meter im Quadrat oder acht mal
 * drei. Ihre Angaben müssen dabei lesbar bleiben, ohne bei der großen Fläche
 * ins Plakathafte zu wachsen. Deshalb eine Spanne statt einer Zahl: Die
 * Schrift richtet sich nach der Fläche und bleibt in diesen Grenzen.
 */
const FLAECHE_NAME_GROSS = 34;
const FLAECHE_ECKE_GROSS = 14;

/**
 * Schreibt eine Aktionsfläche voll: Name, Quadratmeter, Länge und Breite.
 *
 * So steht es auf einem Marktplan: In der Mitte, wofür die Zone da ist, in
 * den oberen Ecken die Zahlen, mit denen man rechnet — links die
 * Quadratmeter, rechts die beiden Kantenlängen.
 *
 * Alles drei richtet sich nach der Größe der Fläche und nicht nach einer
 * festen Zahl. Wer die Fläche kleiner zieht, soll nicht plötzlich vor einer
 * abgeschnittenen Beschriftung stehen; wer sie groß zieht, will kein Plakat.
 */
export function zeichneFlaechenangaben(
  ctx: Konva.Context,
  element: PlanElement,
  b: number,
  t: number,
  zoom: number,
) {
  const kurz = Math.min(b, t);
  if (kurz <= 0) return;

  // Wie breit ein Text wird, weiß nur die Leinwand.
  const messen = (text: string, schrift: number) => {
    ctx.setAttr('font', `${schrift}px sans-serif`);
    return typeof ctx.measureText === 'function'
      ? ctx.measureText(text).width
      : text.length * schrift * 0.55;
  };

  const kopf = laeuftRueckwaerts(element.drehung);
  const ecke = Math.min(FLAECHE_ECKE_GROSS, kurz * 0.14);
  const rand = Math.max(ecke * 0.5, kurz * 0.04);

  // ---- Die beiden oberen Ecken: links die Fläche, rechts die Kanten.
  if (lesbar(ecke, zoom)) {
    ctx.setAttr('font', `${ecke}px sans-serif`);
    ctx.setAttr('fillStyle', 'rgba(30,40,52,0.62)');
    ctx.setAttr('textBaseline', 'top');

    lesbarerBlock(ctx, kopf, b / 2, t / 2, () => {
      ctx.setAttr('textAlign', 'left');
      ctx.fillText(formatiereFlaeche(b * t), rand, rand);

      ctx.setAttr('textAlign', 'right');
      masszeilen(element).forEach((zeile, i) => {
        ctx.fillText(zeile, b - rand, rand + i * ecke * 1.25);
      });
      ctx.setAttr('textAlign', 'left');
    });
  }

  // ---- Die Mitte: wofür die Fläche da ist.
  const text = (element.beschriftung ?? '').trim();
  if (!element.beschriftungSichtbar || text === '') return;

  const satz = textImKasten(
    text,
    b - 2 * rand,
    t * 0.5,
    Math.min(FLAECHE_NAME_GROSS, t * 0.3, b * 0.3),
    messen,
  );
  if (satz.zeilen.length === 0 || !lesbar(satz.schrift, zoom)) return;

  const zeilenhoehe = satz.schrift * 1.15;
  const oben = t / 2 - (satz.zeilen.length * zeilenhoehe) / 2;

  ctx.setAttr('font', `${satz.schrift}px sans-serif`);
  ctx.setAttr('fillStyle', 'rgba(24,32,44,0.9)');
  ctx.setAttr('textBaseline', 'top');
  lesbarerBlock(ctx, kopf, b / 2, t / 2, () => {
    ctx.setAttr('textAlign', 'center');
    satz.zeilen.forEach((zeile, i) => {
      ctx.fillText(zeile, b / 2, oben + i * zeilenhoehe);
    });
    ctx.setAttr('textAlign', 'left');
  });
}

/**
 * Zeichnet die gewählte Grundform in ein Rechteck der Größe b × t.
 *
 * `beidseitig` ändert bei manchen Möbeln die Zeichnung: Eine Doppeltruhe hat
 * einen Steg in der Mitte, eine Einzeltruhe eine Rückwand. `achsmass` teilt
 * einen Regalzug gleichmäßig in Felder, `felder` gibt stattdessen jedes Feld
 * einzeln vor – daran hängt ein gemischter Zug.
 */
/**
 * Wo die Stützen eines Getränkezuges stehen, im Zeichenmaß.
 *
 * An jeder Gestellgrenze eine – aus der **Feldliste**, nicht aus einem festen
 * Raster. Ein Zug darf aus verschiedenen Längen bestehen (1,50 + 2,00 + 2,50,
 * so wie sie auf dem Plan wirklich stehen), und dann sitzen die Stützen eben
 * ungleichmäßig.
 *
 * Die Kisten laufen darüber hinweg: Sie richten sich im Markt nicht danach,
 * wo ein Gestell aufhört.
 */
function gestellstuetzen(element: PlanElement, b: number): number[] {
  const felder = felderVon(element, 'unten');
  const roh = felder.reduce((summe, f) => summe + f.breite, 0);
  if (roh <= 0) return [0, b];

  const faktor = b / roh;
  const punkte = [0];
  let x = 0;
  for (const feld of felder) {
    x += feld.breite;
    punkte.push(x * faktor);
  }
  return punkte;
}

/**
 * Ein Getränkegestell mit den Kisten davor.
 *
 * Das Gestell selbst ist im Grundriss fast nichts – zwei Rohre mit
 * Fußplatten, die nur die Preisschiene tragen. Gezeichnet wird es deshalb als
 * schmaler Streifen in der Mitte, mit einer **Raute an jedem Ende**: So steht
 * es auf den Ladenbauplänen, und so erkennt man auf einen Blick, wo ein
 * Gestell aufhört und das nächste anfängt.
 *
 * Den Platz nehmen die Kisten. Sie stehen als Raster davor – jede einzeln
 * gezeichnet, weil die Zahl der Kästen die Angabe ist, um die es geht.
 */
function zeichneGetraenkegestell(
  ctx: Konva.Context,
  b: number,
  t: number,
  kisten: PlanElement['kisten'],
  stuetzen: number[] = [0, b],
): void {
  const lage = kisten?.lage ?? 'laengs';
  const reihen = Math.max(0, Math.round(kisten?.reihen ?? 1));
  const seiten: 1 | 2 = kisten?.einseitig ? 1 : 2;
  const belegung = kistenbelegung(b, lage, reihen, seiten);

  // Das Gestell liegt mittig, wenn beidseitig bestückt wird – sonst hinten,
  // denn einseitig steht es an der Wand.
  const gestellVon = seiten === 2 ? (t - GESTELL_STAERKE) / 2 : t - GESTELL_STAERKE;
  const gestellBis = gestellVon + GESTELL_STAERKE;

  ctx.rect(0, gestellVon, b, GESTELL_STAERKE);

  // Die beiden Rohre als Längslinien im Streifen.
  const rohr = GESTELL_STAERKE * 0.3;
  for (const y of [gestellVon + rohr, gestellBis - rohr]) {
    ctx.moveTo(0, y);
    ctx.lineTo(b, y);
  }

  // Eine Raute an jeder Gestellgrenze – die Stütze mit ihrer Fußplatte. Bei
  // einem verlängerten Zug steht an jeder Stoßstelle eine; die Kisten laufen
  // darüber hinweg, weil sie im Markt auch durchlaufen.
  const mitte = (gestellVon + gestellBis) / 2;
  const raute = Math.min(GESTELL_STAERKE * 1.6, b / 6);
  for (const x of stuetzen) {
    ctx.moveTo(x, mitte - raute);
    ctx.lineTo(x + raute, mitte);
    ctx.lineTo(x, mitte + raute);
    ctx.lineTo(x - raute, mitte);
    ctx.closePath();
  }

  if (belegung.jeReihe === 0 || reihen === 0) return;

  // Die Kisten: je Seite ein Raster aus `jeReihe` × `reihen` Kästen. Sie
  // beginnen am Gestell und wachsen nach außen – so wie sie auch gestapelt
  // werden.
  const richtungen: (1 | -1)[] = seiten === 2 ? [-1, 1] : [-1];
  for (const richtung of richtungen) {
    const kante = richtung < 0 ? gestellVon : gestellBis;
    for (let reihe = 0; reihe < reihen; reihe++) {
      const von = kante + richtung * reihe * belegung.reihentiefe;
      const bis = von + richtung * belegung.reihentiefe;
      for (let i = 0; i < belegung.jeReihe; i++) {
        const x = i * belegung.kistenbreite;
        ctx.rect(x, Math.min(von, bis), belegung.kistenbreite, belegung.reihentiefe);
      }
    }
  }
}

/**
 * Ein Förderband entlang seines Verlaufs.
 *
 * Gezeichnet werden die beiden Seitenwangen und die Rollen quer dazu – das
 * Bild, an dem man eine Rollenbahn im Plan erkennt.
 *
 * Die Knicke werden abgerundet, weil eine Rollenbahn nicht scharf abbiegt:
 * In der Ecke sitzt ein Kurvenmodul mit einem Radius. Die äußere Wange
 * bekommt dabei den größeren Bogen, die innere den kleineren – wie beim
 * echten Modul, und ohne das würden sich die Wangen in der Kurve schneiden.
 *
 * Die Punkte liegen relativ zum Mittelpunkt; gezeichnet wird ab der linken
 * oberen Ecke, deshalb kommt die halbe Größe dazu – wie beim Umriss.
 */
function zeichneFoerderband(
  ctx: Konva.Context,
  verlauf: Punkt[],
  bandbreite: number,
  b: number,
  t: number,
  eckradius = 0,
) {
  const punkte = verlauf.map((p) => ({ x: p.x + b / 2, y: p.y + t / 2 }));
  const halb = bandbreite / 2;

  /** Der um `abstand` seitlich versetzte Zug, mit gerundeten Ecken. */
  const wange = (abstand: number) => {
    const versetzt = punkte.map((p, i) => {
      // Die Richtung an diesem Punkt: die Kante davor, davor die dahinter.
      const a = punkte[Math.max(0, i - 1)];
      const c = punkte[Math.min(punkte.length - 1, i + 1)];
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      return { x: p.x + (-dy / l) * abstand, y: p.y + (dx / l) * abstand };
    });

    ctx.moveTo(versetzt[0].x, versetzt[0].y);
    for (let i = 1; i < versetzt.length - 1; i++) {
      // Innen enger, außen weiter – sonst überschneiden sich die Wangen.
      const r = Math.max(0, eckradius + (abstand > 0 ? halb : -halb) * Math.sign(eckradius || 1));
      if (r > 1) ctx.arcTo(versetzt[i].x, versetzt[i].y, versetzt[i + 1].x, versetzt[i + 1].y, r);
      else ctx.lineTo(versetzt[i].x, versetzt[i].y);
    }
    ctx.lineTo(versetzt[versetzt.length - 1].x, versetzt[versetzt.length - 1].y);
  };

  wange(halb);
  wange(-halb);

  // Die Rollen quer dazu, etwa alle 12 cm. In den Kurven werden sie von
  // selbst dichter – dort steht auch beim echten Modul eine Rolle mehr.
  const abstand = 12;
  for (let i = 1; i < punkte.length; i++) {
    const a = punkte[i - 1];
    const c = punkte[i];
    const laenge = Math.hypot(c.x - a.x, c.y - a.y);
    if (laenge < 1) continue;
    const qx = (-(c.y - a.y) / laenge) * halb;
    const qy = ((c.x - a.x) / laenge) * halb;
    // In der Kurve endet das gerade Stück früher – dort sitzt der Bogen.
    const rand = eckradius > 1 ? Math.min(eckradius, laenge / 2) : 0;
    const anzahl = Math.max(1, Math.floor((laenge - 2 * rand) / abstand));
    for (let r = 0; r <= anzahl; r++) {
      const f = (rand + ((laenge - 2 * rand) * r) / anzahl) / laenge;
      const x = a.x + (c.x - a.x) * f;
      const y = a.y + (c.y - a.y) * f;
      ctx.moveTo(x + qx, y + qy);
      ctx.lineTo(x - qx, y - qy);
    }

    // Abschluss an Anfang und Ende des ganzen Bandes.
    if (i === 1) {
      ctx.moveTo(a.x + qx, a.y + qy);
      ctx.lineTo(a.x - qx, a.y - qy);
    }
    if (i === punkte.length - 1) {
      ctx.moveTo(c.x + qx, c.y + qy);
      ctx.lineTo(c.x - qx, c.y - qy);
    }
  }
}

/**
 * Wo die Paletten eines Möbels liegen, in Bildkoordinaten.
 *
 * Einmal gerechnet für beides: die blasse Fläche, die vor allem anderen
 * gemalt wird, und die Striche darüber. Zwei Rechnungen für dieselben
 * Rechtecke gingen früher oder später auseinander.
 */
export function palettenflaechen(
  element: PlanElement,
  b: number,
  t: number,
): { x: number; y: number; breite: number; tiefe: number }[] {
  const unten = felderVon(element, 'unten');
  const oben = element.beidseitig ? felderVon(element, 'oben') : [];
  const faktor = seitenFaktor(b, oben, unten);
  const hoehe = element.beidseitig ? t / 2 : t;
  const baender = element.beidseitig
    ? [
        { felder: oben, von: 0 },
        { felder: unten, von: t / 2 },
      ]
    : [{ felder: unten, von: 0 }];

  const flaechen: { x: number; y: number; breite: number; tiefe: number }[] = [];
  for (const band of baender) {
    for (const platz of feldplaetze(band.felder, faktor)) {
      const palette = platz.feld.palette;
      if (platz.feld.leer || !palette) continue;
      const laengs = palette.laengs ?? true;
      const mass = palettenmass(palette.art, laengs);
      const anzahl = palettenAnzahl(palette, platz.weite);
      const gesamt = anzahl * mass.breite;
      const luecke = anzahl > 1 ? Math.max(0, (platz.weite - gesamt) / (anzahl + 1)) : 0;
      const start = anzahl > 1 ? luecke : Math.max(0, (platz.weite - mass.breite) / 2);
      for (let i = 0; i < anzahl; i++) {
        flaechen.push({
          x: platz.x + start + i * (mass.breite + luecke),
          // An der Rückwand: bei der oberen Seite von oben, bei der unteren
          // von unten – dort steht die Palette im Markt auch.
          y: band.von === 0 && element.beidseitig ? hoehe - mass.tiefe : band.von,
          breite: mass.breite,
          tiefe: mass.tiefe,
        });
      }
    }
  }
  return flaechen;
}

/**
 * Die Umrisse der Paletten und ihre Bretter.
 *
 * Gezeichnet wie im Bauplan: der Umriss und darin die Bretter quer – daran
 * erkennt man eine Palette im Plan, ohne sie beschriften zu müssen. Die
 * blasse Fläche darunter kommt vorher, im Hintergrund des Möbels.
 *
 * Ragt eine Palette tiefer als das Möbel, bekommt sie an dessen Kante einen
 * zweiten Strich: Im Plan sieht man dann, dass sie in den Gang steht, und
 * muss nicht nachmessen.
 */
function zeichnePaletten(
  ctx: Konva.Context,
  flaechen: { x: number; y: number; breite: number; tiefe: number }[],
  laengs: boolean,
  moebeltiefeImBild: number,
) {
  for (const f of flaechen) {
    ctx.rect(f.x, f.y, f.breite, f.tiefe);

    // Fünf Bretter quer zur langen Seite, wie bei der Decklage einer echten
    // Palette.
    const bretter = 5;
    for (let n = 1; n < bretter; n++) {
      if (laengs) {
        const bx = f.x + (f.breite * n) / bretter;
        ctx.moveTo(bx, f.y);
        ctx.lineTo(bx, f.y + f.tiefe);
      } else {
        const by = f.y + (f.tiefe * n) / bretter;
        ctx.moveTo(f.x, by);
        ctx.lineTo(f.x + f.breite, by);
      }
    }

    if (f.y + f.tiefe > moebeltiefeImBild + 1) {
      ctx.moveTo(f.x, moebeltiefeImBild);
      ctx.lineTo(f.x + f.breite, moebeltiefeImBild);
    }
  }
}

export function zeichneForm(
  ctx: Konva.Context,
  form: Grundform,
  b: number,
  t: number,
  beidseitig = false,
  achsmass = 0,
  felder?: Regalfeld[],
  gespiegelt = false,
  felderOben?: Regalfeld[],
  kisten?: PlanElement['kisten'],
  stuetzen?: number[],
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

    case 'getraenkegestell': {
      zeichneGetraenkegestell(ctx, b, t, kisten, stuetzen);
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
      const zone = Math.min(TOTE_ZONE, t / 2);
      const zoneVon = beidseitig ? (t - zone) / 2 : 0;

      // Ohne Liste wird gleichmäßig nach Achsmaß geteilt – so wurde bis
      // dahin jeder Zug gezeichnet, und für eine ältere Planung ist das die
      // richtige Deutung. Ohne eigene Rückseite zeigt die Gondel auf beiden
      // Seiten dasselbe.
      const unten =
        felder && felder.length > 0 ? felder : feldliste(b, achsmass).map((breite) => ({ breite }));
      const oben = felderOben && felderOben.length > 0 ? felderOben : unten;
      const faktor = seitenFaktor(b, oben, unten);

      // Solange beide Seiten gleich eingeteilt sind, wird das Möbel als ein
      // Körper gezeichnet: Trennlinie und Achsmaß-Zeichen laufen über die
      // ganze Tiefe, so wie eh und je. Erst wenn die Seiten sich
      // unterscheiden, zerfällt die Zeichnung in zwei Bänder – jedes mit
      // seiner eigenen Teilung, weil es keine gemeinsame mehr gibt.
      const zusammen = ohneLuecke(unten) && (!beidseitig || gleicheEinteilung(oben, unten));
      const baender = zusammen
        ? [{ felder: unten, von: 0, bis: t }]
        : beidseitig
          ? [
              { felder: oben, von: 0, bis: zoneVon },
              { felder: unten, von: zoneVon + zone, bis: t },
            ]
          : [{ felder: unten, von: zone, bis: t }];

      for (const band of baender) {
        const hoehe = band.bis - band.von;
        if (hoehe <= 0) continue;

        // Der Körper, Stück für Stück: Ein leeres Feld unterbricht ihn, und
        // genau das soll man sehen – dort hängt nichts.
        for (const stueck of vollStuecke(band.felder)) {
          ctx.rect(stueck.von * faktor, band.von, (stueck.bis - stueck.von) * faktor, hoehe);
        }

        // Die Felder einzeln, mit ihren eigenen Maßen. Ein gemischter Zug –
        // fünf Felder A1000 und eines A1250 – muss auch so aussehen: Die
        // Trennlinie sitzt dort, wo im Markt die Säule steht.
        //
        // An einer Lücke bleibt der Strich weg: Dort ist schon der Rand des
        // Stücks gezeichnet, ein zweiter läge auf denselben Koordinaten.
        const plaetze = feldplaetze(band.felder, faktor);
        plaetze.forEach((platz, i) => {
          if (i === 0 || platz.feld.leer || plaetze[i - 1].feld.leer) return;
          ctx.moveTo(platz.x, band.von);
          ctx.lineTo(platz.x, band.bis);
        });


        // Das Achsmaß-Zeichen steht in jedem Feld, nicht einmal über den
        // ganzen Zug: Ein 6-m-Zug aus 1,25er Feldern hat fünf Diagonalen.
        // Es richtet sich nach der wirklichen Breite des Felds, nicht nach
        // der gezeichneten – gestreckt wird nur für die Rundung.
        for (const platz of plaetze) {
          if (platz.feld.leer) continue;
          const zeichen = achsmassZeichen(platz.feld.breite);
          if (zeichen === 'keins') continue;
          ctx.moveTo(platz.x, band.bis);
          ctx.lineTo(platz.x + platz.weite, band.von);
          if (zeichen === 'kreuz') {
            ctx.moveTo(platz.x, band.von);
            ctx.lineTo(platz.x + platz.weite, band.bis);
          }
        }
      }

      // Die tote Zone über die ganze Länge – die Säulen stehen auch dort,
      // wo eine Seite ein Feld frei lässt.
      ctx.rect(0, zoneVon, b, zone);
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

    case 'leergutRuecknahme': {
      // Rücknahmeautomat, wie er im Bauplan steht: das Gehäuse, davor die
      // Einwurföffnung zum Kunden hin, dahinter der Auswurf aufs Band.
      //
      // Die Öffnung sitzt unten, weil das Möbel mit der Bedienseite nach
      // unten steht – wie jedes andere auch. Gedreht wird das Element.
      ctx.rect(0, 0, b, t);
      // Einwurf: die Klappe zum Verkaufsraum.
      const klappe = Math.min(b * 0.62, t * 0.9);
      ctx.rect((b - klappe) / 2, t * 0.72, klappe, t * 0.2);
      // Das Innere, in dem die Flasche erkannt wird.
      ctx.rect(b * 0.12, t * 0.1, b * 0.76, t * 0.5);
      // Und der Auswurf nach hinten, dort schließt das Band an.
      ctx.moveTo(b * 0.5, t * 0.1);
      ctx.lineTo(b * 0.5, 0);
      break;
    }

    case 'leergutEinweg': {
      // Einwegpfand: der Sammelbehälter mit der Presse darin. Im Bauplan
      // ist die Presse als gestapelte Balken gezeichnet – das ist das
      // Zeichen, an dem man sie im Plan wiedererkennt.
      ctx.rect(0, 0, b, t);
      const balken = 5;
      const hoehe = t * 0.055;
      const luecke = t * 0.045;
      const block = balken * hoehe + (balken - 1) * luecke;
      const oben = (t - block) / 2;
      for (let i = 0; i < balken; i++) {
        const y = oben + i * (hoehe + luecke);
        // Nach innen schmaler werdend: der Ballen wird zusammengedrückt.
        const rand = b * (0.16 + 0.05 * Math.abs(i - (balken - 1) / 2));
        ctx.rect(rand, y, b - 2 * rand, hoehe);
      }
      break;
    }

    case 'dpgBehaelter': {
      // Der Sammelbehälter für Einwegpfand: der Kasten mit dem Kreuz, so
      // wie er im Aufstellplan steht. Das Kreuz sagt „hier steht ein
      // Behälter, kein Möbel" – dieselbe Kurzschrift wie bei den Gitterboxen
      // im Bauplan.
      ctx.rect(0, 0, b, t);
      const rand = Math.min(b, t) * 0.07;
      ctx.moveTo(rand, rand);
      ctx.lineTo(b - rand, t - rand);
      ctx.moveTo(b - rand, rand);
      ctx.lineTo(rand, t - rand);
      break;
    }

    case 'kastenablage': {
      // Die Ablage für Mehrwegkästen: zwei Bahnen längs, quer dazu die
      // Plätze. Ein Kasten misst 400 mm – daran richtet sich die Teilung,
      // damit man im Plan abzählen kann, wie viele daraufgehen.
      ctx.rect(0, 0, b, t);
      // Die Längsteilung: bei genug Tiefe zwei Bahnen nebeneinander.
      const bahnen = t >= 70 ? 2 : 1;
      for (let i = 1; i < bahnen; i++) {
        const y = (t * i) / bahnen;
        ctx.moveTo(0, y);
        ctx.lineTo(b, y);
      }
      // Und die Kastenplätze quer: ein Kasten misst 400 mm.
      //
      // Abgerundet, nicht gerundet – gezeichnet wird, was wirklich
      // draufpasst. Auf 3,00 m sind das sieben Kästen und nicht acht, auch
      // wenn 3,00 / 0,40 nach siebeneinhalb aussieht. Der Rest bleibt als
      // Luft am Ende stehen, so wie im Gestell auch.
      const plaetze = Math.max(1, Math.floor(b / 40));
      for (let i = 1; i <= plaetze; i++) {
        const x = Math.min(b, 40 * i);
        if (x >= b - 0.5) break;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, t);
      }
      break;
    }

    case 'foerderband':
      // Der Verlauf ist bereits gezeichnet; ohne Verlauf bleibt ein leeres
      // Band übrig, und das ist ein Rechteck.
      ctx.rect(0, 0, b, t);
      break;

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

    case 'holzblende':
    case 'holzblendeU': {
      // Eine Blende ist ein Brett, kein Körper.
      //
      // Von oben sieht man deshalb nur den Rahmen; in der Mitte bleibt das
      // Regal sichtbar, um das sie herumgebaut ist. Wäre die Fläche gefüllt,
      // verdeckte die Blende genau das, was sie einfassen soll.
      //
      // Das Loch entsteht durch die **Gegenrichtung**: Die äußere Bahn läuft
      // im Uhrzeigersinn, die innere dagegen. Wo sich beide überdecken, hebt
      // die Füllregel der Leinwand sie auf.
      const brett = Math.min(BLENDENSTAERKE, Math.min(b, t) / 2 - 1);
      if (brett <= 0) {
        ctx.rect(0, 0, b, t);
        break;
      }
      if (form === 'holzblende') {
        ctx.rect(0, 0, b, t);
        ctx.moveTo(brett, brett);
        ctx.lineTo(brett, t - brett);
        ctx.lineTo(b - brett, t - brett);
        ctx.lineTo(b - brett, brett);
        ctx.closePath();
      } else {
        // Drei Seiten, die vierte offen – für einen Zug, der an der Wand
        // steht und dort keine Blende braucht.
        ctx.moveTo(0, 0);
        ctx.lineTo(brett, 0);
        ctx.lineTo(brett, t - brett);
        ctx.lineTo(b - brett, t - brett);
        ctx.lineTo(b - brett, 0);
        ctx.lineTo(b, 0);
        ctx.lineTo(b, t);
        ctx.lineTo(0, t);
        ctx.closePath();
      }
      break;
    }

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
      // Ein Textfeld hat keinen Umriss – im Plan steht dort nur der Text.
      // Beim Auswählen wird sein Kasten sichtbar, damit man ihn fassen und
      // ziehen kann; sonst wüsste niemand, woran er ziehen soll.
      stroke={
        element.form === 'textfeld'
          ? ausgewaehlt
            ? '#0a84ff'
            : 'rgba(0,0,0,0)'
          : ausgewaehlt
            ? '#0a84ff'
            : 'rgba(30,40,52,0.55)'
      }
      strokeWidth={(ausgewaehlt ? 2 : 1) / zoom}
      opacity={element.gesperrt ? 0.7 : 1}
      hitStrokeWidth={griffZugabe(element, zoom)}
      shadowForStrokeEnabled={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx, shape) => {
        const b = shape.width();
        const t = shape.height();

        const paletten =
          element.felderUnten || element.felderOben ? palettenflaechen(element, b, t) : [];

        // 1. Umriss und Achsmaß-Zeichen in einem Zug – beides in der
        //    Linienfarbe des Elements.
        ctx.beginPath();
        if (element.form === 'foerderband' && element.verlauf && element.verlauf.length >= 2) {
          zeichneFoerderband(ctx, element.verlauf, element.bandbreite ?? 40, b, t, element.eckradius ?? 0);
        } else if (element.form === 'umriss' && element.polygon && element.polygon.length >= 3) {
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
          felderVon(element, 'unten'),
          Boolean(element.gespiegelt),
          element.beidseitig ? felderVon(element, 'oben') : undefined,
          element.kisten,
          gestellstuetzen(element, b),
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

        // 1b. Die Paletten – erst jetzt, nach der Möbelfüllung.
        //
        //     Vorher lagen sie davor und wurden von `fillStrokeShape`
        //     zugedeckt: Der Hauptpfad enthält den Möbelumriss, und der
        //     wird mit der Möbelfarbe gefüllt. Sichtbar war dann nur noch
        //     Grau.
        //
        //     Erst die blasse Fläche, dann ihre Linien darüber – so liegt
        //     die Palette im Regal und nicht als Deckel darauf.
        if (paletten.length > 0) {
          ctx.save();
          ctx.beginPath();
          for (const f of paletten) ctx.rect(f.x, f.y, f.breite, f.tiefe);
          ctx.setAttr('fillStyle', PALETTENFARBE);
          ctx.fill();

          const ersteSeite = felderVon(element, 'unten').find((f) => f.palette)?.palette;
          ctx.setAttr('strokeStyle', PALETTENLINIE);
          ctx.setAttr('lineWidth', 1 / zoom);
          ctx.beginPath();
          zeichnePaletten(ctx, paletten, ersteSeite?.laengs ?? true, element.beidseitig ? t / 2 : t);
          ctx.stroke();
          ctx.restore();
        }

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

        // 4. Die Notizen in den Feldern. Text gehört nicht in den Pfad –
        //    der wird gefüllt, und aus jedem Buchstaben würde ein Klecks.
        ctx.save();
        if (element.form === 'aktionsflaeche') {
          // Eine Zone hat keine Felder. Sie trägt ihre eigenen Angaben.
          zeichneFlaechenangaben(ctx, element, b, t, zoom);
        } else if (element.form === 'textfeld') {
          zeichneTextfeld(ctx, element, b, t, zoom);
        } else {
          zeichneFeldnotizen(ctx, element, b, t, zoom);
          zeichneWarengruppen(ctx, element, b, t, zoom);
        }
        ctx.restore();
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
  // Aktionsfläche und Textfeld schreiben sich selbst – passend zu ihrer
  // Größe. Ein zweiter Text läge darüber.
  if (element.form === 'aktionsflaeche' || element.form === 'textfeld') return null;

  const schrift = element.schriftgroesse / zoom;
  // Zu kleine Schrift auf dem Bildschirm ist unleserlich – dann lieber weglassen.
  if (element.schriftgroesse < 4) return null;

  // Die Beschriftung dreht sich mit dem Möbel – sie gehört ja dazu. Läuft es
  // andersherum, wird sie um die Mitte des Möbels gewendet: Sie bleibt dort
  // stehen, wo sie steht, und liest sich wieder von links nach rechts. Ein
  // Regal an der unteren Wand hatte seinen Namen sonst kopfüber im Plan.
  const gewendet = laeuftRueckwaerts(element.drehung);

  return (
    <Text
      listening={false}
      x={element.x}
      y={element.y}
      width={element.breite}
      offsetX={element.breite / 2}
      offsetY={schrift * 0.6}
      rotation={element.drehung + (gewendet ? 180 : 0)}
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
