import { neueId } from '../logik/id';
import { rechteck } from '../logik/polygon';
import { SCHEMA_VERSION, type Ebene, type Projekt } from '../typen/modell';

/**
 * Die Ebenen, mit denen jedes neue Projekt startet.
 * Die Kennungen sind fest, damit Elemente sie zuverlässig zuordnen können.
 */
export const STANDARD_EBENEN: Ebene[] = [
  { id: 'gebaeude', name: 'Gebäude & Wände', sichtbar: true, gesperrt: false },
  { id: 'raeume', name: 'Räume', sichtbar: true, gesperrt: false },
  { id: 'einrichtung', name: 'Einrichtung', sichtbar: true, gesperrt: false },
  { id: 'beschriftung', name: 'Beschriftungen', sichtbar: true, gesperrt: false },
  { id: 'laufwege', name: 'Laufwege', sichtbar: true, gesperrt: false },
];

/** Die Ebene, auf der neue Elemente standardmäßig landen. */
export const STANDARD_EBENE_ID = 'einrichtung';

/**
 * Erzeugt ein leeres Projekt.
 *
 * Voreinstellung: 40 m × 25 m – eine typische Größe für einen mittleren Markt.
 * Angefangen wird mit einem Rechteck, weil das der häufigste Fall ist und man
 * am schnellsten etwas sieht. Umformen lässt es sich danach beliebig.
 */
export function neuesProjekt(
  name = 'Neue Marktplanung',
  breite = 4000,
  laenge = 2500,
): Projekt {
  const jetzt = Date.now();
  return {
    id: neueId('projekt'),
    name,
    version: SCHEMA_VERSION,
    erstelltAm: jetzt,
    geaendertAm: jetzt,
    grundflaeche: { umriss: rechteck(0, 0, breite, laenge), wandstaerke: 30 },
    einstellungen: {
      anzeigeEinheit: 'm',
      rasterSichtbar: true,
      rasterWeite: 50,
      amRasterEinrasten: true,
      hilfslinienAktiv: true,
      masseAnzeigen: true,
    },
    ebenen: STANDARD_EBENEN.map((e) => ({ ...e })),
    raeume: [],
    verkaufsflaechen: [],
    waende: [],
    oeffnungen: [],
    elemente: [],
    gruppen: [],
    masslinien: [],
  };
}
