/**
 * Ein Plan-PDF in eine Marktplaner-Planung umwandeln – ohne Browser.
 *
 * Gedacht für den Fall, dass mehrere Pläne auf einmal hereinkommen: Der
 * Dialog in der App macht dasselbe, aber einer nach dem anderen und mit einem
 * Klick je Schritt. Hier läuft es über die Befehlszeile.
 *
 * **Nur der Grundriss.** Umriss, Wandzüge und Stützen – keine Regale. Wer
 * einen Plan neu einrichtet, will die alte Einrichtung nicht erst wegräumen
 * müssen; und wer sie doch braucht, nimmt den Dialog in der App.
 *
 * Die Erkennung selbst ist dieselbe wie dort: Diese Datei ruft nur auf, was
 * `src/logik/planImport/` ohnehin kann. Eine zweite Erkennung wäre eine
 * zweite, die auseinanderläuft.
 *
 * Aufruf – der Bauschritt biegt dabei `planImport/arbeiter` auf den
 * Node-Ersatz um, weil es außerhalb des Browsers keinen Vite gibt:
 *
 * ```
 * npx esbuild werkzeuge/plan-nach-projekt.ts --bundle --platform=node \
 *   --format=esm --external:pdfjs-dist --outfile=werkzeuge/plan.mjs \
 *   --alias:./arbeiter=../../werkzeuge/arbeiter-node
 * node werkzeuge/plan.mjs "Plan.pdf" "Name der Planung" ziel.json
 * ```
 */
import { readFile, writeFile } from 'node:fs/promises';
import { lesePlan, liesFuellflaechen } from '../src/logik/planImport/pdfLesen';
import { bestimmeMassstab } from '../src/logik/planImport/massstab';
import {
  farbeGleich,
  findeWandfarbe,
  inZentimeter,
  mittelpunkt,
  nurImGebaeude,
  rahmenAlsUmriss,
  teileEin,
  zentrierterUmriss,
  type Wandkoerper,
} from '../src/logik/planImport/wandkoerper';
import { BIBLIOTHEK } from '../src/daten/bibliothek';
import { STANDARD_EBENEN } from '../src/daten/standardProjekt';
import { SCHEMA_VERSION, type PlanElement, type Projekt } from '../src/typen/modell';

/** Eine Kennung, die auch ohne `crypto.randomUUID` eindeutig genug ist. */
function neueId(vorsilbe: string, n: number): string {
  return `${vorsilbe}-${Date.now().toString(36)}-${n.toString(36)}`;
}

export interface Ergebnis {
  projekt: Projekt;
  bericht: {
    massstab: number;
    sicherheit: string;
    proben: number;
    wandzuege: number;
    stuetzen: number;
    fremdkoerper: number;
    breiteM: number;
    hoeheM: number;
  };
}

export async function planNachProjekt(pfad: string, name: string): Promise<Ergebnis> {
  const roh = await readFile(pfad);
  const daten = roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength) as ArrayBuffer;

  const { befund, dokument } = await lesePlan(daten.slice(0));
  const massstab = bestimmeMassstab(befund.texte);
  if (!massstab.massstab) {
    throw new Error(
      `Kein Maßstab erkannt (${massstab.begruendung}). Ohne ihn wäre jedes Maß geraten.`,
    );
  }

  if (befund.planart !== 'vektor') {
    throw new Error(
      `Der Plan ist kein Vektorplan (${befund.begruendung}). Aus einem Bild lassen sich keine Wände lesen.`,
    );
  }

  const flaechen = await liesFuellflaechen(dokument);
  const wandfarbe = findeWandfarbe(flaechen);
  let koerper: Wandkoerper[] = [];
  if (wandfarbe) {
    const eigene = flaechen.filter((f) => farbeGleich(f.fuellung, wandfarbe));
    koerper = nurImGebaeude(teileEin(eigene, massstab.mmJePunkt), 2000, massstab.mmJePunkt);
  }

  const baulich = koerper.filter((k) => k.art !== 'fremd');
  if (baulich.length === 0) {
    throw new Error('Keine Wandkörper gefunden – der Plan zeichnet seine Wände wohl anders.');
  }

  const jeCm = massstab.mmJePunkt / 10;
  const umriss = rahmenAlsUmriss(koerper, massstab.mmJePunkt);
  const waende = koerper.filter((k) => k.art === 'wand');
  const stuetzenKoerper = koerper.filter((k) => k.art === 'stuetze');

  // Die Stützen als echte Elemente, mit ihrem echten Umriss. Sie sind das
  // Einzige aus der Einrichtung, das mitkommt – sie stehen ja schon da und
  // entscheiden über jeden Zug davor.
  const vorlage = BIBLIOTHEK.find((v) => v.id === 'stuetze-eckig');
  const elemente: PlanElement[] = vorlage
    ? stuetzenKoerper.map((k, i) => {
        const m = mittelpunkt(k.punkte);
        return {
          id: neueId('el', i),
          vorlageId: vorlage.id,
          ebeneId: 'gebaeude',
          name: vorlage.name,
          kategorie: vorlage.kategorie,
          x: m.x * jeCm,
          y: m.y * jeCm,
          breite: k.breiteMm / 10,
          tiefe: k.hoeheMm / 10,
          hoehe: 300,
          drehung: 0,
          form: 'umriss',
          farbe: vorlage.farbe,
          beschriftung: '',
          beschriftungSichtbar: false,
          schriftgroesse: 12,
          gesperrt: false,
          reihenfolge: i + 1,
          polygon: zentrierterUmriss(k.punkte, massstab.mmJePunkt),
        };
      })
    : [];

  const jetzt = Date.now();
  const projekt: Projekt = {
    id: neueId('p', 0),
    name,
    version: SCHEMA_VERSION,
    erstelltAm: jetzt,
    geaendertAm: jetzt,
    grundflaeche: {
      umriss,
      wandstaerke: 30,
      wandkoerper: waende.map((k) => inZentimeter(k.punkte, massstab.mmJePunkt)),
    },
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
    elemente,
    gruppen: [],
    masslinien: [],
  };

  const r = umriss.reduce(
    (a, p) => ({
      links: Math.min(a.links, p.x),
      rechts: Math.max(a.rechts, p.x),
      oben: Math.min(a.oben, p.y),
      unten: Math.max(a.unten, p.y),
    }),
    { links: Infinity, rechts: -Infinity, oben: Infinity, unten: -Infinity },
  );

  return {
    projekt,
    bericht: {
      massstab: massstab.massstab,
      sicherheit: massstab.sicherheit,
      proben: massstab.proben,
      wandzuege: waende.length,
      stuetzen: stuetzenKoerper.length,
      fremdkoerper: koerper.length - baulich.length,
      breiteM: (r.rechts - r.links) / 100,
      hoeheM: (r.unten - r.oben) / 100,
    },
  };
}

/* --------------------------------------------------------- Befehlszeile */

const [pdf, name, ziel] = process.argv.slice(2);
if (pdf && name && ziel) {
  const { projekt, bericht } = await planNachProjekt(pdf, name);
  // Dieselbe Hülle, die „JSON exportieren" schreibt – so lässt sich die Datei
  // ohne Umweg wieder einlesen.
  await writeFile(
    ziel,
    JSON.stringify(
      {
        format: 'marktplaner',
        version: SCHEMA_VERSION,
        exportiertAm: new Date().toISOString(),
        projekt,
        eigeneVorlagen: [],
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(JSON.stringify({ datei: ziel, ...bericht }));
}
