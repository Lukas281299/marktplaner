import type { Projekt } from '../typen/modell';
import { dateinameAus, ladeDateiHerunter } from '../speicher/projektArchiv';
import { buehneSteuerung } from './buehne';
import { rahmen } from './polygon';
import type { Ansicht } from '../zustand/planStore';

/**
 * Export des Plans als PNG-Bild.
 *
 * Es wird genau der Bereich des Gebäudes ausgeschnitten (plus etwas Rand),
 * unabhängig davon, wie weit gerade hineingezoomt ist. Die Anfasser der
 * Auswahl werden vorher ausgeblendet, damit sie nicht im Bild landen.
 */
export function exportierePng(projekt: Projekt, ansicht: Ansicht, faktor = 2): void {
  const buehne = buehneSteuerung.buehne;
  if (!buehne) return;

  const ebenen = buehne.getLayers();
  const overlay = ebenen[ebenen.length - 1];
  const warSichtbar = overlay?.visible() ?? true;
  overlay?.visible(false);

  const rand = 60;
  // Der Ausschnitt richtet sich nach der Umgrenzung des Grundrisses. Die kann
  // nach dem Umformen auch links oder oberhalb von 0 anfangen – deshalb wird
  // sie mitgerechnet und nicht angenommen, dass sie bei 0/0 beginnt.
  const bereich = rahmen(projekt.grundflaeche.umriss);
  const quelle = buehne.toCanvas({
    x: ansicht.x + bereich.links * ansicht.zoom - rand,
    y: ansicht.y + bereich.oben * ansicht.zoom - rand,
    width: (bereich.rechts - bereich.links) * ansicht.zoom + rand * 2,
    height: (bereich.unten - bereich.oben) * ansicht.zoom + rand * 2,
    pixelRatio: faktor,
  });

  overlay?.visible(warSichtbar);

  // Weißer Hintergrund, damit das Bild nicht durchsichtig ist.
  const ziel = document.createElement('canvas');
  ziel.width = quelle.width;
  ziel.height = quelle.height;
  const ctx = ziel.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ziel.width, ziel.height);
  ctx.drawImage(quelle, 0, 0);

  ziel.toBlob((blob) => {
    if (blob) ladeDateiHerunter(blob, `${dateinameAus(projekt.name)}.png`);
  }, 'image/png');
}
