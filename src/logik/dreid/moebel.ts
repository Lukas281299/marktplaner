import { KATEGORIEN } from '../../daten/kategorien';
import { abgedunkelt } from './material';
import { prisma, quader, rechteck, type Bauteil } from './bauteile';
import { regalBauteile } from './bauformen/regale';
import { vitableBauteile } from './bauformen/vitable';
import { bakeoffBauteile } from './bauformen/bakeoff';
import { tiefkuehlBauteile } from './bauformen/tiefkuehlung';
import { kuehlBauteile } from './bauformen/kuehlung';
import { blumenBauteile } from './bauformen/blumen';
import { aktionBauteile } from './bauformen/aktion';
import { ausstattungBauteile } from './bauformen/ausstattung';
import { getraenkeBauteile } from './bauformen/getraenke';
import { kassenBauteile } from './bauformen/kassen';
import type { Grundform, PlanElement } from '../../typen/modell';

/**
 * Welches Rezept ein Möbel bekommt.
 *
 * Jede Möbelfamilie hat ihre eigene Datei unter `bauformen/`, mit den Maßen
 * aus dem jeweiligen Katalog. Was keine hat, wird ein Klotz in seiner
 * Kategoriefarbe – erkennbar als Platzhalter, aber an der richtigen Stelle
 * und in der richtigen Höhe.
 */

/** Zonen und Anmerkungen: eine flache Markierung auf dem Boden, kein Körper. */
const ZONEN: ReadonlySet<Grundform> = new Set<Grundform>([
  'aktionsflaeche',
  'textfeld',
  'stellflaeche',
  'linie',
  'pfeil',
  'zugang',
  'notausgang',
  'rauchabzug',
  'bodenablauf',
  'anschlussStrom',
  'anschlussWasser',
  'schild',
]);

/** Was gar nicht gezeigt wird. */
const UNSICHTBAR: ReadonlySet<Grundform> = new Set<Grundform>(['fenster', 'tuerBlatt']);

/**
 * Die Höhe, die ein Möbel ohne eigene Angabe bekommt.
 *
 * Nach Kategorie: Ein Regal ist mannshoch, eine Truhe hüfthoch, eine Kasse
 * tischhoch. Wer die Höhe am Möbel einträgt, überstimmt das.
 */
const ERSATZHOEHE: Record<PlanElement['kategorie'], number> = {
  regale: 180,
  kuehlung: 200,
  tiefkuehlung: 90,
  bedienung: 125,
  obstgemuese: 110,
  blumen: 120,
  getraenke: 180,
  backwaren: 185,
  kassen: 90,
  aktion: 120,
  ausstattung: 100,
  eigene: 120,
};

export function hoeheVon(element: PlanElement): number {
  return element.hoehe && element.hoehe > 0 ? element.hoehe : ERSATZHOEHE[element.kategorie] ?? 120;
}

/** Die Kategoriefarbe eines Elements, für Platzhalter und Ware. */
export function kategoriefarbe(element: PlanElement): string {
  const kategorie = KATEGORIEN.find((k) => k.id === element.kategorie);
  return abgedunkelt(kategorie?.farbe ?? '#9aa0a6');
}

/** Der Klotz: ein Quader in Kategoriefarbe, so hoch wie das Möbel. */
export function klotz(element: PlanElement): Bauteil[] {
  const farbe = kategoriefarbe(element);
  if (element.form === 'umriss' && element.polygon && element.polygon.length >= 3) {
    // Der Umriss liegt um den Mittelpunkt des Elements – in die Ecke schieben.
    const punkte = element.polygon.map((p) => ({
      x: p.x + element.breite / 2,
      y: p.y + element.tiefe / 2,
    }));
    return [prisma(punkte, 0, hoeheVon(element), 'kategorie', farbe)];
  }
  return [quader(0, 0, 0, element.breite, element.tiefe, hoeheVon(element), 'kategorie', { farbe })];
}

/**
 * Eine flache Markierung – Aktionsfläche, freie Fläche, Textfeld, Sperrfläche.
 *
 * **Die Farbe ist die des Elements**, nicht die der Kategorie. Eine
 * Aktionsfläche ist gelb, eine freie Fläche trägt die Farbe ihrer Abteilung,
 * und wer eine davon umfärbt, meint es. Im Raum soll dieselbe Fläche liegen
 * wie im Grundriss; zwei Farben für ein Rechteck wären eine Falle.
 */
function markierung(element: PlanElement): Bauteil[] {
  const farbe = element.farbe || kategoriefarbe(element);
  return [prisma(rechteck(element.breite, element.tiefe), 0.4, 0.8, 'markierung', farbe)];
}

/**
 * Die Bauteile eines Möbels – in seinen eigenen Koordinaten.
 *
 * Hier wird nur verteilt. Die Rezepte stehen in `bauformen/`.
 */
export function bauteileFuer(element: PlanElement): Bauteil[] {
  const form = element.form;
  if (UNSICHTBAR.has(form)) return [];
  if (ZONEN.has(form)) return markierung(element);

  switch (form) {
    case 'wt100':
    case 'wt100Rund':
    case 'wt100Eck':
    case 'regal':
      return regalBauteile(element);
    case 'vitable':
    case 'vitableEckInnen':
    case 'vitableEckAussen':
    case 'vitableAbschluss':
    case 'vitableAbschlussRund':
      return vitableBauteile(element);
    case 'bakeoff':
    case 'bakeoffEcke':
      return bakeoffBauteile(element);
    case 'tkTruhe':
    case 'tkSchrank':
    case 'tkKombi':
      return tiefkuehlBauteile(element);
    case 'kuehlOffen':
    case 'kuehlSchrank':
    case 'kuehlStufen':
    case 'blinkTheke':
    case 'blinkSelf':
    case 'blinkSv':
      return kuehlBauteile(element);
    case 'blumenregal':
    case 'blumensaeule':
    case 'blumeninsel':
    case 'blumendisplay':
    case 'blumentrog':
    case 'blumentreppe':
    case 'blumenwanne':
    case 'blumenwagen':
      return blumenBauteile(element);
    case 'getraenkegestell':
      return getraenkeBauteile(element);
    case 'kasse':
    case 'kasseSitz':
    case 'kasseDoppel':
    case 'kasseExpress':
    case 'packrutsche':
    case 'kassengondel':
    case 'sbKasse':
    case 'automat':
    case 'leergutRuecknahme':
    case 'leergutEinweg':
    case 'dpgBehaelter':
    case 'kastenablage':
      return kassenBauteile(element);
    case 'palette':
    case 'drehstaender':
    case 'abgerundet':
    case 'rechteck':
      return aktionBauteile(element);
    case 'saeule':
    case 'einzelsaeule':
    case 'stuetzeEckig':
    case 'treppe':
    case 'aufzug':
    case 'unterzug':
    case 'schacht':
    case 'feuerloescher':
    case 'kundenfuehrung':
    case 'schiebetueranlage':
    case 'egateEinzel':
    case 'egateDoppel':
    case 'ausgangsanlage':
    case 'wagenbox':
    case 'holzblende':
    case 'holzblendeU':
      return ausstattungBauteile(element);
    default:
      return klotz(element);
  }
}
