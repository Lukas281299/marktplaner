import { describe, expect, it } from 'vitest';
import { etikettFuerZug, moebeletiketten, passendeVorlage, zuMoebel } from './moebel';
import { mmJePunkt } from './massstab';
import type { ErkannterZug } from './felder';
import type { PlanText } from './typen';

const JE_PUNKT = mmJePunkt(100);

function text(inhalt: string, x = 0, y = 0): PlanText {
  return { text: inhalt, x, y, breite: inhalt.length * 3, hoehe: 6 };
}

/** Ein Zug mit `felder` Feldern ab (x, y), waagerecht. */
function zug(felder: number, achsmassMm: number, x = 100, y = 300): ErkannterZug {
  const schritt = achsmassMm / JE_PUNKT;
  return {
    felder: Array.from({ length: felder }, (_, i) => ({
      punkt: { x: x + i * schritt, y },
      etagen: 5,
    })),
    achsmassMm,
    gemessenMm: achsmassMm,
    winkel: 0,
    laengeMm: achsmassMm * felder,
    sicherheit: 'sicher',
  };
}

describe('Möbeletiketten lesen', () => {
  it('liest die Schreibweisen des Plans', () => {
    const gelesen = moebeletiketten([
      text('wt100 H 1800 T 600'),
      text('wt100 H1600 T500'),
      text('wt100 H 2000 T 600'),
      text('pt H 900 T 300'),
    ]);
    expect(gelesen.map((e) => [e.system, e.hoeheMm, e.tiefeMm])).toEqual([
      ['wt100', 1800, 600],
      ['wt100', 1600, 500],
      ['wt100', 2000, 600],
      ['puretech', 900, 300],
    ]);
  });

  it('kommt mit einem Etikett ohne Tiefe zurecht', () => {
    const gelesen = moebeletiketten([text('wt100 H 900')]);
    expect(gelesen).toHaveLength(1);
    expect(gelesen[0].hoeheMm).toBe(900);
    expect(gelesen[0].tiefeMm).toBeUndefined();
  });

  it('lässt Sortimentstexte liegen', () => {
    expect(moebeletiketten([text('Süßgebäck'), text('TK Insel 7,5m'), text('01.33')])).toEqual([]);
  });

  it('liest die CAD-Blocknamen mit Achsmaß und Tiefe', () => {
    // Diese stehen 134-mal im Plan und sind die verlässlichere Quelle für
    // die Maße – die lesbaren Etiketten gibt es nur 84-mal.
    const gelesen = moebeletiketten([
      text('wt100_1250x600_neu'),
      text('wt100_1000x600_neu'),
      text('wt100_VS_1250x700_neu'),
      text('vt_1250x800'),
      text('pt_1000x300'),
    ]);
    expect(gelesen.map((e) => [e.system, e.achsmassMm, e.tiefeMm])).toEqual([
      ['wt100', 1250, 600],
      ['wt100', 1000, 600],
      ['wt100', 1250, 700],
      ['vitable', 1250, 800],
      ['puretech', 1000, 300],
    ]);
  });
});

describe('Etikett zum Zug finden', () => {
  it('nimmt das nächstgelegene', () => {
    const etiketten = moebeletiketten([
      text('wt100 H 1800 T 600', 105, 292),
      text('wt100 H 2000 T 600', 900, 292),
    ]);
    const { etikett } = etikettFuerZug(zug(6, 1000), etiketten, JE_PUNKT);
    expect(etikett?.hoeheMm).toBe(1800);
  });

  it('misst zum nächsten Feld, nicht zur Mitte des Zuges', () => {
    // Ein sechzehn Meter langer Zug: Das Etikett steht am Anfang, ein fremdes
    // Etikett näher an der Mitte. Von der Mitte aus gemessen gewänne das
    // falsche.
    const langer = zug(16, 1000, 100, 300);
    const etiketten = moebeletiketten([
      text('wt100 H 1800 T 600', 102, 296),
      text('wt100 H 2000 T 500', 320, 260),
    ]);
    const { etikett } = etikettFuerZug(langer, etiketten, JE_PUNKT);
    expect(etikett?.hoeheMm).toBe(1800);
  });

  it('meldet, wenn weit und breit kein Etikett steht', () => {
    const etiketten = moebeletiketten([text('wt100 H 1800 T 600', 5000, 5000)]);
    const { etikett } = etikettFuerZug(zug(4, 1000), etiketten, JE_PUNKT);
    expect(etikett).toBeUndefined();
  });
});

describe('Vorlage auswählen', () => {
  it('trifft Wandregal A1250 T600 H1800', () => {
    const vorlage = passendeVorlage(125, 67, 180, false);
    expect(vorlage.id).toBe('wt-wand-1250-600-1800');
  });

  it('trifft die Gondel mit derselben Tiefe je Seite', () => {
    const vorlage = passendeVorlage(125, 127, 180, true);
    expect(vorlage.id).toBe('wt-gondel-1250-600-1800');
  });

  it('bleibt beim Achsmaß, auch wenn die Höhe daneben liegt', () => {
    const vorlage = passendeVorlage(100, 57, 175, false);
    expect(vorlage.achsmass).toBe(100);
  });
});

describe('Aus dem Zug wird ein Möbel', () => {
  it('rechnet die tote Zone einmal auf das Wandregal', () => {
    const etiketten = moebeletiketten([text('wt100 H 1800 T 600', 105, 292)]);
    const moebel = zuMoebel(zug(6, 1000), etiketten, JE_PUNKT, false);
    expect(moebel.tiefe).toBe(67);
    expect(moebel.breite).toBe(600);
    expect(moebel.hoehe).toBe(180);
    expect(moebel.achsmass).toBe(100);
    expect(moebel.felder).toBe(6);
    expect(moebel.sicherheit).toBe('sicher');
  });

  it('rechnet die tote Zone bei der Gondel nur einmal', () => {
    const etiketten = moebeletiketten([text('wt100 H 1800 T 600', 105, 292)]);
    const moebel = zuMoebel(zug(5, 1250), etiketten, JE_PUNKT, true);
    expect(moebel.tiefe).toBe(127);
    expect(moebel.beidseitig).toBe(true);
    expect(moebel.vorlage.id).toBe('wt-gondel-1250-600-1800');
  });

  it('nimmt Tiefe aus dem Blocknamen und Höhe aus dem Etikett', () => {
    // Der übliche Fall im Plan: Der Blockname klebt am Möbel, das lesbare
    // Etikett mit der Höhe steht ein Stück daneben.
    const etiketten = moebeletiketten([
      text('wt100_1250x600_neu', 102, 298),
      text('wt100 H 2000 T 600', 140, 280),
    ]);
    const moebel = zuMoebel(zug(5, 1250), etiketten, JE_PUNKT, false);
    expect(moebel.tiefe).toBe(67);
    expect(moebel.hoehe).toBe(200);
    expect(moebel.vorlage.id).toBe('wt-wand-1250-600-2000');
  });

  it('meldet, wenn Blockname und gemessenes Achsmaß auseinandergehen', () => {
    const etiketten = moebeletiketten([text('wt100_1000x600_neu', 102, 298)]);
    const moebel = zuMoebel(zug(5, 1250), etiketten, JE_PUNKT, false);
    expect(moebel.anmerkungen.join(' ')).toContain('1000');
  });

  it('sagt es, wenn gar nichts in der Nähe stand', () => {
    const moebel = zuMoebel(zug(4, 1000), [], JE_PUNKT, false);
    expect(moebel.sicherheit).toBe('geraten');
    expect(moebel.anmerkungen.join(' ')).toContain('Tiefenangabe');
  });

  it('übernimmt die Unsicherheit des Zuges', () => {
    const wackelig: ErkannterZug = { ...zug(4, 1147), sicherheit: 'geraten' };
    const etiketten = moebeletiketten([text('wt100 H 1800 T 600', 105, 292)]);
    expect(zuMoebel(wackelig, etiketten, JE_PUNKT, false).sicherheit).toBe('geraten');
  });
});
