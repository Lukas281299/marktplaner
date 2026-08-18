import { BIBLIOTHEK } from '../../daten/bibliothek';
import type { BibliothekEintrag, Punkt } from '../../typen/modell';
import type { ErkannterZug } from './felder';
import type { PlanText, Sicherheit } from './typen';

/**
 * Aus erkannten Zügen werden Möbel.
 *
 * Der Zug allein sagt nur, wo Felder stehen und wie breit sie sind. Höhe und
 * Tiefe stehen daneben im Klartext: „wt100 H 1800 T 600". Diese Etiketten
 * werden hier gelesen und dem nächstgelegenen Zug zugeordnet.
 *
 * Zugeordnet wird über die Entfernung, und das ist eine Schätzung – ein
 * Etikett steht mal über, mal neben, mal unter seinem Zug. Deshalb wird die
 * Sicherheit mitgeführt und in der Prüfliste ausgewiesen, statt sie zu
 * verschweigen. Ein Regal, das im Plan 1800 hoch ist und in der Planung 1600,
 * fällt sonst erst auf, wenn jemand danach bestellt.
 */

/** Die tote Zone hinter einem wire-tech-100-Regal, in Zentimetern. */
const TOTE_ZONE = 7;

export type Regalsystem = 'wt100' | 'puretech' | 'vitable';

export interface Moebeletikett {
  text: string;
  punkt: Punkt;
  system: Regalsystem;
  /** Höhe in Millimetern, falls das Etikett eine nennt. */
  hoeheMm?: number;
  /** Grundbodentiefe in Millimetern, falls angegeben. */
  tiefeMm?: number;
  /** Achsmaß in Millimetern – nur die Blocknamen nennen es. */
  achsmassMm?: number;
}

/** Aus "wt100", "pt", "vt" wird das System. */
function zuSystem(roh: string): Regalsystem {
  const k = roh.toLowerCase().replace(/[\s_]+/g, '');
  if (k.startsWith('wt100') || k === 'wt') return 'wt100';
  if (k.startsWith('vt') || k.startsWith('vitable')) return 'vitable';
  return 'puretech';
}

/**
 * Liest die Möbelangaben aus den Texten.
 *
 * Der Plan führt sie in zwei Schreibweisen, und beide werden gebraucht:
 *
 *   Blockname   wt100_1250x600_neu - vt_1250x800 - pt_1000x300
 *               Nennt Achsmaß und Tiefe, aber keine Höhe. Steht am Möbel
 *               selbst und kommt im Plan Fuldabrück 134-mal vor.
 *   Etikett     wt100 H 1800 T 600 - pt H 900 T 300 - wt100 H 900
 *               Nennt die Höhe und meist die Tiefe. 84-mal vorhanden.
 *
 * Zuerst wurden nur die Etiketten gelesen, und damit blieb die Hälfte der
 * Züge ohne Angaben. Die Blocknamen sind die verlässlichere Quelle für die
 * Maße, die Etiketten die einzige für die Höhe – deshalb beide.
 */
export function moebeletiketten(texte: PlanText[]): Moebeletikett[] {
  const etiketten: Moebeletikett[] = [];

  for (const t of texte) {
    const punkt = { x: t.x, y: t.y };

    // Blockname: System, dann irgendwann „Achsmaß x Tiefe".
    const block = t.text.match(/^([a-z]{2,6}\d{0,3})_(?:[A-Za-z0-9]+_)?(\d{3,4})x(\d{3,4})/i);
    if (block) {
      etiketten.push({
        text: t.text,
        punkt,
        system: zuSystem(block[1]),
        achsmassMm: Number(block[2]),
        tiefeMm: Number(block[3]),
      });
      continue;
    }

    // Etikett mit Höhe. Der Systemname davor fehlt manchmal, weil der Text
    // im PDF zerteilt ist – dann wird wt100 angenommen, das ist im
    // Trockensortiment die Regel.
    if (/\bH\s*\d{3,4}/i.test(t.text)) {
      const etikett = t.text.match(
        /(?:\b(wt\s*100|pt|puretech|vitable)\b[^A-Za-z0-9]*)?H\s*(\d{3,4})(?:[^A-Za-z0-9]*T\s*(\d{3,4}))?/i,
      );
      if (etikett) {
        etiketten.push({
          text: t.text,
          punkt,
          system: etikett[1] ? zuSystem(etikett[1]) : 'wt100',
          hoeheMm: Number(etikett[2]),
          tiefeMm: etikett[3] ? Number(etikett[3]) : undefined,
        });
        continue;
      }
    }

    // Etikett, das nur die Tiefe nennt.
    const nurTiefe = t.text.match(/^T\s*(\d{3,4})\s*$/i);
    if (nurTiefe) {
      etiketten.push({ text: t.text, punkt, system: 'wt100', tiefeMm: Number(nurTiefe[1]) });
    }
  }

  return etiketten;
}

/** Mittelpunkt eines Zuges in PDF-Punkten. */
export function zugMitte(zug: ErkannterZug): Punkt {
  const erstes = zug.felder[0].punkt;
  const letztes = zug.felder[zug.felder.length - 1].punkt;
  return { x: (erstes.x + letztes.x) / 2, y: (erstes.y + letztes.y) / 2 };
}

/**
 * Sucht zu einem Zug das passende Etikett.
 *
 * Gemessen wird zum nächstgelegenen Feld des Zuges, nicht zu dessen Mitte:
 * Bei einem sechzehn Meter langen Zug steht das Etikett irgendwo daneben, und
 * von der Mitte aus wäre es weiter entfernt als ein fremdes Etikett am
 * Nachbarregal.
 */
export function etikettFuerZug(
  zug: ErkannterZug,
  etiketten: Moebeletikett[],
  mmJePunkt: number,
  maxAbstandMm = 2500,
  taugt: (e: Moebeletikett) => boolean = () => true,
): { etikett?: Moebeletikett; abstandMm: number } {
  let bestes: Moebeletikett | undefined;
  let besterAbstand = Infinity;

  for (const etikett of etiketten) {
    if (!taugt(etikett)) continue;
    for (const feld of zug.felder) {
      const d = Math.hypot(etikett.punkt.x - feld.punkt.x, etikett.punkt.y - feld.punkt.y) * mmJePunkt;
      if (d < besterAbstand) {
        besterAbstand = d;
        bestes = etikett;
      }
    }
  }

  if (!bestes || besterAbstand > maxAbstandMm) return { abstandMm: besterAbstand };
  return { etikett: bestes, abstandMm: besterAbstand };
}

export interface ErkanntesMoebel {
  /** Mittelpunkt in PDF-Punkten. */
  mitte: Punkt;
  /** Länge des Zuges in Zentimetern. */
  breite: number;
  /** Tiefe in Zentimetern, tote Zone eingerechnet. */
  tiefe: number;
  hoehe: number;
  drehung: number;
  achsmass: number;
  felder: number;
  beidseitig: boolean;
  system: Regalsystem;
  /** Die Vorlage, die am besten passt. */
  vorlage: BibliothekEintrag;
  sicherheit: Sicherheit;
  anmerkungen: string[];
}

/** Übliche Grundbodentiefe je System, wenn im Plan keine steht. */
const ERSATZTIEFE: Record<Regalsystem, number> = { wt100: 600, puretech: 500, vitable: 800 };

/**
 * Sucht die Vorlage, die am besten zu Achsmaß, Tiefe und Höhe passt.
 *
 * Gewichtet wird nach Auffälligkeit im Plan: Das Achsmaß muss stimmen, sonst
 * stehen die Felder falsch. Tiefe und Höhe dürfen abweichen – sie lassen sich
 * am Element nachstellen, ohne dass die Zeichnung verrutscht.
 */
export function passendeVorlage(
  achsmassCm: number,
  tiefeCm: number,
  hoeheCm: number,
  beidseitig: boolean,
): BibliothekEintrag {
  const anwaerter = BIBLIOTHEK.filter(
    (e) => e.form === 'wt100' && Boolean(e.beidseitig) === beidseitig && e.id.startsWith(beidseitig ? 'wt-gondel-' : 'wt-wand-'),
  );

  let bester = anwaerter[0];
  let besteAbweichung = Infinity;
  for (const eintrag of anwaerter) {
    const dAchse = Math.abs((eintrag.achsmass ?? 0) - achsmassCm) * 10;
    const dTiefe = Math.abs(eintrag.tiefe - tiefeCm);
    const dHoehe = Math.abs((eintrag.hoehe ?? 0) - hoeheCm);
    const abweichung = dAchse + dTiefe + dHoehe * 0.5;
    if (abweichung < besteAbweichung) {
      besteAbweichung = abweichung;
      bester = eintrag;
    }
  }
  return bester;
}

/**
 * Macht aus einem erkannten Zug ein Möbel.
 *
 * `gegenzug` ist die zweite Seite einer Gondel, falls es eine gibt. Dann wird
 * die tote Zone nur einmal gerechnet – 2 × 600 + 70 = 1270 und nicht 1340.
 */
export function zuMoebel(
  zug: ErkannterZug,
  etiketten: Moebeletikett[],
  mmJePunkt: number,
  beidseitig = false,
): ErkanntesMoebel {
  const anmerkungen: string[] = [];

  // Getrennt suchen: Der Blockname am Möbel nennt die Tiefe, das Etikett
  // daneben die Höhe. Wer nur eines von beiden sucht, findet für die
  // Hälfte der Züge nichts.
  const masse = etikettFuerZug(zug, etiketten, mmJePunkt, 2500, (e) => e.tiefeMm !== undefined);
  const hoehen = etikettFuerZug(zug, etiketten, mmJePunkt, 3000, (e) => e.hoeheMm !== undefined);

  const system: Regalsystem = masse.etikett?.system ?? hoehen.etikett?.system ?? 'wt100';
  const bodenMm = masse.etikett?.tiefeMm ?? ERSATZTIEFE[system];
  const hoeheMm = hoehen.etikett?.hoeheMm ?? 1800;

  if (!masse.etikett) {
    anmerkungen.push(`Keine Tiefenangabe in der Nähe - ${bodenMm} mm angenommen`);
  } else if (masse.abstandMm > 1500) {
    anmerkungen.push(
      `Tiefe aus „${masse.etikett.text}" in ${(masse.abstandMm / 1000).toFixed(1)} m Entfernung - Zuordnung unsicher`,
    );
  }

  if (!hoehen.etikett) {
    anmerkungen.push('Keine Höhenangabe in der Nähe – 1800 mm angenommen');
  } else if (hoehen.abstandMm > 2000) {
    anmerkungen.push(
      `Höhe aus „${hoehen.etikett.text}" in ${(hoehen.abstandMm / 1000).toFixed(1)} m Entfernung - Zuordnung unsicher`,
    );
  }

  // Der Blockname nennt auch das Achsmaß. Weicht es von dem ab, was aus den
  // Etagenzahlen gemessen wurde, ist eines von beiden falsch – das gehört
  // auf die Prüfliste.
  const ausBlock = masse.etikett?.achsmassMm;
  if (ausBlock && Math.abs(ausBlock - zug.achsmassMm) > 60) {
    anmerkungen.push(
      `Blockname nennt Achsmaß ${ausBlock} mm, gemessen wurden ${zug.achsmassMm} mm`,
    );
  }

  const bodenCm = bodenMm / 10;
  const tiefe = beidseitig ? 2 * bodenCm + TOTE_ZONE : bodenCm + TOTE_ZONE;
  const achsmassCm = zug.achsmassMm / 10;
  const hoehe = hoeheMm / 10;

  const vorlage = passendeVorlage(achsmassCm, tiefe, hoehe, beidseitig);
  if (Math.abs((vorlage.achsmass ?? 0) - achsmassCm) > 0.5) {
    anmerkungen.push(
      `Gemessenes Achsmaß ${zug.achsmassMm} mm hat keine Entsprechung im System – Vorlage „${vorlage.name}" gewählt`,
    );
  }

  // Die Sicherheit ist nie besser als die des Zuges selbst.
  const sicherheit: Sicherheit =
    zug.sicherheit === 'geraten' || (!masse.etikett && !hoehen.etikett)
      ? 'geraten'
      : anmerkungen.length > 0 || zug.sicherheit === 'wahrscheinlich'
        ? 'wahrscheinlich'
        : 'sicher';

  return {
    mitte: zugMitte(zug),
    breite: (zug.achsmassMm * zug.felder.length) / 10,
    tiefe,
    hoehe,
    drehung: zug.winkel,
    achsmass: achsmassCm,
    felder: zug.felder.length,
    beidseitig,
    system,
    vorlage,
    sicherheit,
    anmerkungen,
  };
}
