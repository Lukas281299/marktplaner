import { Shape } from 'react-konva';
import type Konva from 'konva';
import { lesbar } from '../../logik/beschriftung';
import { GRUPPE_NORMAL, gruppensatz } from '../../logik/warengruppe';
import { bandlage, feldlage, type Bandlage } from '../../logik/warengruppenband';
import type { Feldbezug, PlanElement, Warengruppenband } from '../../typen/modell';

/**
 * Die Warengruppen unter den Metern – und was gerade markiert ist.
 *
 * Ein eigener Durchgang und nicht Teil eines Möbels: Eine Beschriftung reicht
 * über **mehrere Meter** und manchmal über mehrere Möbel, und keines davon
 * ist ihr Besitzer. Vier Meter Eier tragen einen Namen über die ganze
 * Strecke, mit einem Strich an jedem Ende.
 *
 * Gezeichnet wird alles in einer einzigen Form. Bei zwanzig Bändern wären
 * zwanzig Formen zwanzig Ebenen im Bild, die alle dasselbe tun.
 */

/** Abstand der Beschriftung von der Vorderkante, in cm. */
const ABSTAND = 7;

/** Wie weit die Markierung eines Meters vor sein Möbel reicht, in cm. */
const MARKE_TIEFE = 5;

export function Warengruppenbaender({
  baender,
  markierung,
  elemente,
  zoom,
}: {
  baender: Warengruppenband[];
  markierung: Feldbezug[];
  elemente: PlanElement[];
  zoom: number;
}) {
  if (baender.length === 0 && markierung.length === 0) return null;

  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(ctx) => {
        // Wie breit ein Text wird, weiß nur die Leinwand. Gemessen wird in
        // genau der Größe, in der auch gezeichnet wird.
        const messen = (text: string, schrift: number) => {
          ctx.setAttr('font', `${schrift}px sans-serif`);
          return typeof ctx.measureText === 'function'
            ? ctx.measureText(text).width
            : text.length * schrift * 0.55;
        };

        // ---- Erst die Markierung: Sie liegt unter den Beschriftungen.
        zeichneMarkierung(ctx, markierung, elemente, zoom);

        ctx.setAttr('fillStyle', 'rgba(24,32,44,0.92)');
        ctx.setAttr('strokeStyle', 'rgba(24,32,44,0.7)');
        ctx.setAttr('lineWidth', 1.1 / zoom);
        ctx.setAttr('textBaseline', 'top');

        for (const band of baender) {
          const lage = bandlage(band, elemente, ABSTAND);
          if (!lage) continue;

          const satz = gruppensatz(band.text, lage.breite, band.schrift ?? GRUPPE_NORMAL, messen);
          if (satz.zeilen.length === 0 || !lesbar(satz.schrift, zoom)) continue;

          zeichneBand(ctx, lage, satz, messen);
        }
      }}
    />
  );
}

/**
 * Die markierten Meter, damit man sieht, was Enter treffen wird.
 *
 * Ein farbiger Streifen an der Vorderkante – dort, wo gleich die Schrift
 * steht. Über das ganze Feld gelegt verdeckte er die Notizen darin.
 */
function zeichneMarkierung(
  ctx: Konva.Context,
  markierung: Feldbezug[],
  elemente: PlanElement[],
  zoom: number,
) {
  if (markierung.length === 0) return;

  ctx.save();
  ctx.setAttr('fillStyle', 'rgba(43,122,190,0.55)');
  ctx.setAttr('strokeStyle', 'rgba(43,122,190,0.9)');
  ctx.setAttr('lineWidth', 1.2 / zoom);

  for (const bezug of markierung) {
    const element = elemente.find((el) => el.id === bezug.element);
    if (!element) continue;
    const lage = feldlage(element, bezug.seite, bezug.feld);
    if (!lage) continue;

    ctx.save();
    ctx.translate(lage.x, lage.y);
    ctx.rotate((lage.drehung * Math.PI) / 180);
    // Der Streifen liegt vor der Kante. Bei der Rückseite einer Gondel zeigt
    // „vorn" in die andere Richtung.
    const hoehe = lage.seite === 'oben' ? -MARKE_TIEFE : MARKE_TIEFE;
    ctx.beginPath();
    ctx.rect(-lage.breite / 2, 0, lage.breite, hoehe);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Ein Band: der Text mittig, an jedem Ende ein Strich.
 *
 * Gezeichnet wird im eigenen Koordinatensystem der Strecke – Ursprung an
 * ihrer Vorderkante, x längs. Dadurch ist die Rechnung darunter dieselbe wie
 * bei einem einzelnen Möbel, egal wie die Strecke im Plan liegt.
 */
function zeichneBand(
  ctx: Konva.Context,
  lage: Bandlage,
  satz: { zeilen: string[]; schrift: number },
  messen: (text: string, schrift: number) => number,
) {
  const zeilenhoehe = satz.schrift * 1.15;
  const hoehe = satz.zeilen.length * zeilenhoehe;
  const halb = lage.breite / 2;

  ctx.save();
  ctx.translate(lage.x, lage.y);
  // Steht die Strecke auf dem Kopf, wird die Schrift gewendet: Sie bleibt an
  // ihrem Platz und liest sich wieder von links nach rechts.
  ctx.rotate(((lage.drehung + (lage.kopfueber ? 180 : 0)) * Math.PI) / 180);

  // Nach vorn heißt bei der Vorderseite nach unten, bei der Rückseite einer
  // Gondel nach oben – und beim gewendeten Block noch einmal andersherum.
  // Wächst die Schrift nach oben, muss der Block um seine Höhe zurück, sonst
  // stünde er im Möbel.
  const nachUnten = (lage.seite === 'oben') === lage.kopfueber;
  const oben = nachUnten ? 0 : -hoehe;

  ctx.setAttr('font', `${satz.schrift}px sans-serif`);
  ctx.setAttr('textAlign', 'center');
  satz.zeilen.forEach((zeile, i) => {
    ctx.fillText(zeile, 0, oben + i * zeilenhoehe);
  });
  ctx.setAttr('textAlign', 'left');

  // Die Klammer liegt auf der ersten Zeile, der Text schneidet sie frei. Über
  // einem einzigen Meter bleibt sie weg – dort ist nichts zu erklären.
  const y = oben + zeilenhoehe / 2;
  const arm = satz.schrift * 0.4;
  const luft = satz.schrift * 0.35;
  const frei = messen(satz.zeilen[0], satz.schrift) / 2 + luft;

  ctx.beginPath();
  ctx.moveTo(-halb, y - arm);
  ctx.lineTo(-halb, y + arm);
  ctx.moveTo(halb, y - arm);
  ctx.lineTo(halb, y + arm);
  if (frei < halb) {
    ctx.moveTo(-halb, y);
    ctx.lineTo(-frei, y);
    ctx.moveTo(frei, y);
    ctx.lineTo(halb, y);
  }
  ctx.stroke();
  ctx.restore();
}
