import { Shape } from 'react-konva';
import type Konva from 'konva';
import { lesbar } from '../../logik/beschriftung';
import { GRUPPE_NORMAL, gruppensatz } from '../../logik/warengruppe';
import { bandlage } from '../../logik/warengruppenband';
import type { PlanElement, Warengruppenband } from '../../typen/modell';

/**
 * Die Warengruppen unter den Möbeln.
 *
 * Ein eigener Durchgang und nicht Teil eines Möbels: Eine Beschriftung reicht
 * über **mehrere** Möbel, und keines davon ist ihr Besitzer. Vier Meter Eier
 * tragen einen Namen über die ganze Strecke, mit einem Strich an jedem Ende.
 *
 * Gezeichnet wird alles in einer einzigen Form. Bei zwanzig Bändern wären
 * zwanzig Formen zwanzig Ebenen im Bild, die alle dasselbe tun.
 */

/** Abstand der Beschriftung vom vordersten Möbel der Strecke, in cm. */
const ABSTAND = 7;

export function Warengruppenbaender({
  baender,
  elemente,
  zoom,
}: {
  baender: Warengruppenband[];
  elemente: PlanElement[];
  zoom: number;
}) {
  if (baender.length === 0) return null;

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
 * Ein Band: der Text mittig, an jedem Ende ein Strich.
 *
 * Gezeichnet wird im eigenen Koordinatensystem der Strecke – Ursprung in
 * ihrer Mitte, x längs. Dadurch ist die ganze Rechnung darunter dieselbe wie
 * bei einem einzelnen Möbel, egal wie die Strecke im Plan liegt.
 */
function zeichneBand(
  ctx: Konva.Context,
  lage: { x: number; y: number; breite: number; drehung: number; kopfueber: boolean },
  satz: { zeilen: string[]; schrift: number },
  messen: (text: string, schrift: number) => number,
) {
  const zeilenhoehe = satz.schrift * 1.15;
  const halb = lage.breite / 2;

  ctx.save();
  ctx.translate(lage.x, lage.y);
  // Steht die Strecke auf dem Kopf, wird die Schrift gewendet: Sie bleibt an
  // ihrem Platz und liest sich wieder von links nach rechts.
  ctx.rotate(((lage.drehung + (lage.kopfueber ? 180 : 0)) * Math.PI) / 180);

  ctx.setAttr('font', `${satz.schrift}px sans-serif`);
  ctx.setAttr('textAlign', 'center');
  satz.zeilen.forEach((zeile, i) => {
    ctx.fillText(zeile, 0, i * zeilenhoehe);
  });
  ctx.setAttr('textAlign', 'left');

  // Die Klammer liegt auf der ersten Zeile, der Text schneidet sie frei. Über
  // einem einzigen Meter bleibt sie weg – dort ist nichts zu erklären.
  const y = zeilenhoehe / 2;
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
