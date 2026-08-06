import type { Projekt } from '../typen/modell';
import { dateinameAus, ladeDateiHerunter } from '../speicher/projektArchiv';
import { buehneSteuerung } from './buehne';
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
  const quelle = buehne.toCanvas({
    x: ansicht.x - rand,
    y: ansicht.y - rand,
    width: projekt.grundflaeche.breite * ansicht.zoom + rand * 2,
    height: projekt.grundflaeche.laenge * ansicht.zoom + rand * 2,
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
