import type { PlanText, Sicherheit } from './typen';

/**
 * Den Maßstab eines Plans bestimmen.
 *
 * Der Maßstab steht meistens im Schriftfeld – aber darauf allein ist kein
 * Verlass: Er wird gern vergessen, wenn ein Plan nachträglich skaliert wird.
 * Verlässlich ist nur der Plan selbst.
 *
 * Deshalb wird er zuerst aus den Maßketten zurückgerechnet. Eine Maßkette
 * besteht aus Zahlen, die nebeneinander auf einer Linie stehen, und jede Zahl
 * sitzt in der Mitte der Strecke, die sie beschreibt. Zwischen zwei
 * benachbarten Zahlen liegt also die halbe erste plus die halbe zweite
 * Strecke. Aus dem Abstand auf dem Papier und dieser Summe ergibt sich, wie
 * viele Millimeter Wirklichkeit auf einen Punkt Papier kommen.
 *
 * Eine einzelne solche Rechnung ist wertlos – benachbart heißt nicht
 * zusammengehörig, und quer über den Plan finden sich beliebig viele Paare,
 * die nichts miteinander zu tun haben. Erst die Häufung trägt: Die richtigen
 * Paare landen alle auf demselben Wert, die falschen streuen. Deshalb wird
 * nicht der Mittelwert genommen, sondern der Maßstab, für den die meisten
 * Proben sprechen.
 */

/** Maßstäbe, die im Ladenbau vorkommen. */
const UEBLICHE_MASSSTAEBE = [20, 25, 50, 75, 100, 125, 150, 200, 250, 500];

/** Wie weit eine Probe daneben liegen darf, um noch zu zählen. */
const TOLERANZ = 0.02;

export interface MassstabBefund {
  /** Der Nenner: 100 heißt 1:100. */
  massstab: number;
  /** Millimeter Wirklichkeit je PDF-Punkt. */
  mmJePunkt: number;
  sicherheit: Sicherheit;
  /** Wie viele Maßketten-Proben dafür sprechen. */
  proben: number;
  /** Was im Schriftfeld stand, falls dort etwas stand. */
  ausSchriftfeld?: number;
  begruendung: string;
}

/** Millimeter Wirklichkeit je PDF-Punkt bei einem gegebenen Maßstab. */
export function mmJePunkt(massstab: number): number {
  return (25.4 / 72) * massstab;
}

/**
 * Liest den Maßstab aus dem Schriftfeld, z. B. aus „Maßstab 1:100".
 *
 * Nur als Gegenprobe gedacht. Steht dort nichts oder etwas Unsinniges, ist
 * das kein Grund, den Import abzubrechen.
 */
export function massstabAusText(texte: PlanText[]): number | undefined {
  for (const t of texte) {
    const treffer = t.text.match(/(?:ma(?:ss|ß)stab|scale|échelle)\s*:?\s*1\s*[:/]\s*(\d{1,4})/i);
    if (treffer) {
      const wert = Number(treffer[1]);
      if (wert >= 5 && wert <= 5000) return wert;
    }
  }
  return undefined;
}

/**
 * Sammelt die Verhältnisse aus allen Maßketten.
 *
 * Waagerechte und senkrechte Ketten werden gleich behandelt – nur die Achse
 * wechselt. Zahlen unter drei Stellen bleiben außen vor: Etagenzahlen wie
 * „5+" oder Positionsnummern sind keine Maße.
 */
export function probenAusMassketten(texte: PlanText[]): number[] {
  const zahlen: { x: number; y: number; wert: number }[] = [];
  for (const t of texte) {
    const roh = t.text.trim();
    if (!/^\d{3,5}$/.test(roh)) continue;
    const wert = Number(roh);
    // Unter 100 mm misst niemand eine Kette, über 100 m auch nicht.
    if (wert < 100 || wert > 100000) continue;
    zahlen.push({ x: t.x, y: t.y, wert });
  }

  const proben: number[] = [];

  const sammle = (
    quer: (z: { x: number; y: number }) => number,
    laengs: (z: { x: number; y: number }) => number,
  ) => {
    const reihen = new Map<number, { pos: number; wert: number }[]>();
    for (const z of zahlen) {
      // Zwei Punkte Fangbreite: Maßzahlen einer Kette stehen exakt auf einer
      // Linie, aber die Grundlinien der Schrift schwanken minimal.
      const schluessel = Math.round(quer(z) / 2);
      const liste = reihen.get(schluessel) ?? [];
      liste.push({ pos: laengs(z), wert: z.wert });
      reihen.set(schluessel, liste);
    }

    for (const liste of reihen.values()) {
      if (liste.length < 2) continue;
      liste.sort((a, b) => a.pos - b.pos);
      for (let i = 0; i < liste.length - 1; i++) {
        const abstand = liste[i + 1].pos - liste[i].pos;
        const strecke = (liste[i].wert + liste[i + 1].wert) / 2;
        if (abstand < 4) continue;
        const verhaeltnis = strecke / abstand;
        // Alles außerhalb 1:10 bis 1:1000 ist Unfug und würde nur stören.
        if (verhaeltnis > 3 && verhaeltnis < 360) proben.push(verhaeltnis);
      }
    }
  };

  sammle((z) => z.y, (z) => z.x);
  sammle((z) => z.x, (z) => z.y);
  return proben;
}

/**
 * Bestimmt den Maßstab aus Maßketten und Schriftfeld.
 *
 * `blattBreiteMm` wird nicht zum Rechnen gebraucht, steht aber in der
 * Begründung – ein A1-Blatt mit Maßstab 1:5 wäre ein Zeichen dafür, dass
 * etwas nicht stimmt.
 */
export function bestimmeMassstab(texte: PlanText[]): MassstabBefund {
  const ausSchriftfeld = massstabAusText(texte);
  const proben = probenAusMassketten(texte);

  // Für jeden üblichen Maßstab zählen, wie viele Proben ihn stützen.
  let bester = 0;
  let besteZahl = 0;
  for (const kandidat of UEBLICHE_MASSSTAEBE) {
    const soll = mmJePunkt(kandidat);
    const treffer = proben.filter((p) => Math.abs(p - soll) / soll <= TOLERANZ).length;
    if (treffer > besteZahl) {
      besteZahl = treffer;
      bester = kandidat;
    }
  }

  // Mindestens fünf Proben, sonst ist die Häufung Zufall.
  if (bester > 0 && besteZahl >= 5) {
    const passt = ausSchriftfeld === undefined || ausSchriftfeld === bester;
    return {
      massstab: bester,
      mmJePunkt: mmJePunkt(bester),
      sicherheit: passt ? 'sicher' : 'wahrscheinlich',
      proben: besteZahl,
      ausSchriftfeld,
      begruendung: passt
        ? `${besteZahl} Maßketten stützen 1:${bester}` +
          (ausSchriftfeld ? ', das Schriftfeld sagt dasselbe' : '')
        : `${besteZahl} Maßketten stützen 1:${bester}, im Schriftfeld steht aber 1:${ausSchriftfeld} – der Plan wurde vermutlich nachträglich skaliert`,
    };
  }

  // Keine brauchbare Häufung: Dann gilt das Schriftfeld, aber als Vermutung.
  if (ausSchriftfeld !== undefined) {
    return {
      massstab: ausSchriftfeld,
      mmJePunkt: mmJePunkt(ausSchriftfeld),
      sicherheit: 'geraten',
      proben: besteZahl,
      ausSchriftfeld,
      begruendung:
        'Keine auswertbaren Maßketten gefunden – der Maßstab stammt allein aus dem Schriftfeld und sollte an einer bekannten Strecke geprüft werden',
    };
  }

  return {
    massstab: 100,
    mmJePunkt: mmJePunkt(100),
    sicherheit: 'geraten',
    proben: 0,
    begruendung:
      'Weder Maßketten noch ein Maßstab im Schriftfeld gefunden – angenommen 1:100, bitte an einer bekannten Strecke nachmessen',
  };
}
