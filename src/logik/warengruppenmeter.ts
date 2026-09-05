import { geordnet } from './warengruppe';
import { letzteStufe } from './sortiment';
import { felderVon, seitenbreite, seitenVon } from './regalseiten';
import type {
  Grundform,
  PlanElement,
  Projekt,
  Streckenaufteilung,
  Warengruppenabschnitt,
} from '../typen/modell';

/**
 * Die Meter je Warengruppe.
 *
 * **Zwei Zahlen, und sie messen Verschiedenes.**
 *
 *  - **Laufende Meter** sind die waagerechte Länge, die eine Warengruppe im
 *    Markt einnimmt. Ein Meter Obst und Gemüse ist ein laufender Meter, egal
 *    wie hoch das Möbel ist und wie viele Etagen es hat.
 *  - **Tatsächliche Meter** sind laufende Meter mal Auslagen. Ein Meter
 *    Regal mit fünf Böden sind fünf tatsächliche Meter. Damit zählt die Höhe
 *    mit, ohne dass man sie eintragen müsste.
 *
 * Die Tiefe zählt bewusst nicht mit. Es geht um Auslagefläche zum Greifen,
 * und ob ein Boden 400 oder 600 tief ist, ändert daran wenig – während es
 * die Zahlen um ein Drittel verschöbe.
 *
 * **Gemessen wird an den Abschnitten, nicht am Möbel.** Bis hierher gab es
 * `regalmeterJeWarengruppe`, und die las das Feld `warengruppe` am ganzen
 * Element. Das trifft den Fall nicht: Ein Zug trägt fünf Sortimente
 * nebeneinander, und die Grenzen laufen mitten durch die Felder. Gerechnet
 * wird deshalb über die Strecken, die im Plan eingezeichnet sind.
 *
 * **Bezugsachse ist die Feldkette der Seite**, nicht `element.breite`. So
 * sind die Abschnitte gespeichert (siehe `Warengruppenabschnitt`), und wer
 * hier anders misst, bekommt bei einer Gondel mit verschieden breiten Seiten
 * andere Zahlen als der Plan zeigt.
 */

/** Was auf einer Strecke steht und wie lang sie ist. */
export interface Streckenmeter {
  /** Der Name, wie er im Plan steht. */
  name: string;
  /**
   * Wohin die Strecke gehört – der Pfad in der Sortimentsliste.
   *
   * Fehlt er, gilt der Name. Siehe `Warengruppenabschnitt.pfad`.
   */
  pfad?: string;
  /** Länge in cm. */
  laenge: number;
  /** Das Möbel, zu dem die Strecke gehört. */
  element: PlanElement;
  /** Welche Seite – bei einer Gondel gibt es zwei. */
  seite: 'unten' | 'oben';
  /**
   * Anfang der Strecke in cm, gemessen ab dem Anfang dieser Möbelseite.
   *
   * Dieselbe Achse, in der auch die Felder liegen. Wer die Auslagen Feld für
   * Feld gewichten will, braucht die Stelle und nicht nur die Länge: Ein Zug
   * trägt vorn fünf und hinten sechs Böden, und eine Warengruppe läuft über
   * beide.
   */
  von: number;
  /** Ende der Strecke, ebenso gemessen. */
  bis: number;
  /**
   * Wie sich mehrere Namen auf dieser Strecke die Meter teilen.
   *
   * Kommt vom Abschnitt mit. Ohne Angabe bilden sie eine gemeinsame Zeile –
   * siehe `Streckenaufteilung`.
   */
  aufteilung?: Streckenaufteilung;
  /** Ist diese Strecke eine Sonder- oder Aktionsplatzierung? */
  aktion?: boolean;
}

/**
 * Eine Zeile, in die eine Strecke zählt – mit ihrem Anteil daran.
 *
 * Ein Ziel je Name. Der Anteil ist ein Bruchteil zwischen 0 und 1; er wirkt
 * auf die laufenden **und** auf die tatsächlichen Meter gleichermaßen, denn
 * beide messen dieselbe Strecke.
 */
export interface Meterziel {
  name: string;
  pfad?: string;
  /** Wie viel der Länge auf dieses Ziel entfällt – 1 ist die ganze. */
  anteil: number;
  /** Zählt als Sonder- oder Aktionsplatzierung. */
  aktion?: boolean;
}

/**
 * Trägt dieses Element überhaupt Ware?
 *
 * Nur was Ware trägt, gehört in eine Meterauswertung. Eine Säule ist 40 cm
 * breit, eine Kundenführung zwei Meter lang – zählte man sie mit, stünden
 * sie unter „ohne Warengruppe" und sähen aus wie vergessene Regalmeter.
 *
 * **Ausgeschlossen wird die Ausstattung** (Bau, Technik, Türen, Möblierung)
 * und in den übrigen Abteilungen alles, was Anlage ist und kein Möbel: die
 * Kassenzeile selbst, Eingangsanlagen, Kundenführungen, Leergutrücknahmen,
 * Blenden, Textfelder, Linien und Pfeile. Die Kassengondel bleibt – auf der
 * liegt Ware, und genau darum geht es.
 *
 * Die Liste steht bewusst so herum: Ein neues Möbel zählt von selbst mit,
 * und wenn es das nicht soll, fällt das beim ersten Blick in die Tabelle
 * auf. Andersherum verschwände es stillschweigend.
 */
const OHNE_WARE: ReadonlySet<Grundform> = new Set<Grundform>([
  // Kassenzone und Eingang – die Zeile selbst trägt keine Ware.
  'kasse',
  'kasseExpress',
  'kasseSitz',
  'kasseDoppel',
  'sbKasse',
  'packrutsche',
  'ausgangsanlage',
  'schiebetueranlage',
  'kundenfuehrung',
  'egateEinzel',
  'egateDoppel',
  'wagenbox',
  'automat',
  'zugang',
  'foerderband',
  // Leergut ist Rücklauf und kein Sortiment.
  'leergutRuecknahme',
  'leergutEinweg',
  'dpgBehaelter',
  'kastenablage',
  // Bau, Technik und Gebäude. Sie stehen zwar in der Kategorie
  // „Ausstattung", die ohnehin herausfällt – aber die Form ist eindeutig,
  // und dann soll sie nicht allein an der Kategorie hängen. Wer eine Säule
  // in ein eigenes Möbel umwidmet, hat trotzdem eine Säule.
  'saeule',
  'stuetzeEckig',
  'einzelsaeule',
  'unterzug',
  'schacht',
  'treppe',
  'aufzug',
  'tuerBlatt',
  'fenster',
  'schild',
  'feuerloescher',
  'notausgang',
  'rauchabzug',
  'bodenablauf',
  'anschlussStrom',
  'anschlussWasser',
  // Die Aktionsfläche misst sich in Palettenplätzen und nicht in Metern –
  // siehe `logik/palettenplatz.ts`. Ihre Breite hängt daran, wie herum man
  // sie gezogen hat; als laufende Meter wäre sie eine Zufallszahl, und in
  // der Zeile „ohne Warengruppe" sähe sie aus wie vergessenes Regal.
  'aktionsflaeche',
  // Ausbau und Anmerkungen.
  'holzblende',
  'holzblendeU',
  'textfeld',
  'linie',
  'pfeil',
]);

/**
 * Vorlagen, die keine eigene Form haben und trotzdem keine Ware tragen.
 *
 * Ein Kassentisch ist ein Rechteck, eine Servicetheke ein abgerundetes
 * Rechteck, ein Füllstück in der Kassenzeile auch nur ein Rechteck. An der
 * Form sind sie von einem Warenträger nicht zu unterscheiden – am Eintrag,
 * aus dem sie kommen, schon.
 *
 * Die Liste ist kurz und wird es bleiben: Wer ein neues Möbel baut, das
 * keine Ware trägt, gibt ihm besser eine eigene Form.
 */
const OHNE_WARE_VORLAGEN: ReadonlySet<string> = new Set([
  'kassentisch',
  'kassensperre',
  'kasse-fuellstueck',
  'kundendienst',
  'information',
  'leergut-band-gerade',
  // Zonenmarkierungen. Sie sagen, wo eine Abteilung liegt, und tragen
  // selbst nichts – genau wie die Aktionsfläche.
  'frische-og-flaeche',
]);

export function traegtWare(element: PlanElement): boolean {
  if (element.kategorie === 'ausstattung') return false;
  if (OHNE_WARE_VORLAGEN.has(element.vorlageId)) return false;
  // **Eine Fläche mit eingetragenen Metern zählt.** Ohne die Zahl bliebe es
  // beim Alten: Ihre Breite hängt daran, wie herum man sie gezogen hat, und
  // als laufende Meter wäre das eine Zufallszahl. Wer die Zahl einträgt,
  // sagt ausdrücklich, wie viele Meter dort liegen – siehe `meterVorgabe`.
  if (element.form === 'aktionsflaeche') return (element.meterVorgabe ?? 0) > 0;
  return !OHNE_WARE.has(element.form);
}

/**
 * Die Länge, in der die Warengruppen einer Seite gemessen werden.
 *
 * Normalerweise die Feldkette des Möbels. Eine **freie Fläche** hat keine
 * Felder; dort gilt die von Hand eingetragene Zahl, und die Abschnitte
 * darauf teilen sie sich in demselben Verhältnis, in dem sie gezeichnet sind.
 */
function messlaenge(element: PlanElement, feldbreite: number): number {
  const vorgabe = element.meterVorgabe;
  if (element.form === 'aktionsflaeche' && vorgabe && vorgabe > 0) return vorgabe;
  return feldbreite;
}

/**
 * Alle beschrifteten Strecken eines Plans, Möbel für Möbel.
 *
 * Eine beidseitige Gondel liefert von selbst zwei Strecken – je Seite eine
 * eigene Liste. Deshalb wird hier nirgends verdoppelt: Das Doppelte entsteht
 * dadurch, dass beide Seiten beschriftet sind. Ist nur eine beschriftet,
 * zählt auch nur eine, und das ist richtig so.
 */
export function strecken(projekt: Projekt): Streckenmeter[] {
  const aus: Streckenmeter[] = [];
  const sichtbar = sichtbareEbenen(projekt);

  for (const element of projekt.elemente ?? []) {
    if (element.ebeneId && !sichtbar.has(element.ebeneId)) continue;
    if (!traegtWare(element)) continue;

    for (const seite of seitenVon(element)) {
      const felder = felderVon(element, seite);
      const breite = seitenbreite(felder);
      if (breite <= 0) continue;

      // Auf einer freien Fläche gilt die eingetragene Zahl statt der Breite.
      // Gestreckt wird nur die **Länge** – wo die Abschnitte liegen, bleibt,
      // wie es gezeichnet ist.
      const massstab = messlaenge(element, breite) / breite;

      const abschnitte = seite === 'oben' ? element.warengruppenOben : element.warengruppenUnten;
      for (const a of geordnet(abschnitte, breite)) {
        const name = a.text.trim();
        if (!name) continue;
        aus.push({
          name,
          pfad: a.pfad,
          laenge: (a.bis - a.von) * massstab,
          element,
          seite,
          // Auch die Lage wird gestreckt, damit die Auslagenrechnung
          // dieselbe Achse benutzt wie die Länge.
          von: a.von * massstab,
          bis: a.bis * massstab,
          aufteilung: a.aufteilung,
          aktion: a.aktion,
        });
      }
    }
  }
  return aus;
}

/**
 * Welche Ebenen gerade sichtbar sind.
 *
 * Was ausgeblendet ist, zählt nicht mit. Ein Planer blendet die Beschriftung
 * aus, um den Grundriss zu sehen – aber wer eine Ebene mit Möbeln ausblendet,
 * meint „die gehören gerade nicht dazu", und dann gehören sie auch nicht in
 * die Auswertung.
 */
export function sichtbareEbenen(projekt: Projekt): Set<string> {
  return new Set((projekt.ebenen ?? []).filter((e) => e.sichtbar !== false).map((e) => e.id));
}

/**
 * Die Länge einer Möbelseite, die **nicht** beschriftet ist.
 *
 * Diese Meter stehen im Markt und tragen Ware – sie sind nur noch keinem
 * Sortiment zugeschrieben. Sie wegzulassen hieße, eine Tabelle zu zeigen,
 * deren Summe kleiner ist als der Markt, ohne dass man sähe warum.
 */
export function unbeschriftet(element: PlanElement): number {
  let offen = 0;
  for (const seite of seitenVon(element)) {
    const breite = seitenbreite(felderVon(element, seite));
    if (breite <= 0) continue;
    const abschnitte = seite === 'oben' ? element.warengruppenOben : element.warengruppenUnten;
    const belegt = geordnet(abschnitte, breite)
      .filter((a) => a.text.trim().length > 0)
      .reduce((summe, a) => summe + (a.bis - a.von), 0);
    offen += Math.max(0, breite - belegt);
  }
  return offen;
}

/** Was eine Strecke an tatsächlichen Metern trägt. */
export interface Auslagenanteil {
  /** Tatsächliche Meter dieser Strecke, in cm. */
  tatsaechlich: number;
  /**
   * Länge in cm, für die keine Auslagenzahl bekannt ist.
   *
   * Nicht dasselbe wie null Auslagen: Ein leeres Feld trägt nachweislich
   * nichts, ein Möbel ohne eingetragene Bodenzahl trägt etwas Unbekanntes.
   */
  ohne: number;
  /**
   * Länge in cm, für die es **bewusst** keine Auslagenzahl gibt.
   *
   * Blumen und Pflanzen haben kaum klassische Böden – dort sind die
   * laufenden Meter die ganze Aussage. Das ist etwas anderes als eine
   * fehlende Zahl: Hier ist nichts nachzutragen, und die Auswertung darf
   * nicht danach fragen.
   */
  ohneMassstab?: number;
}

/**
 * Wie viele Auslagen eine Strecke trägt.
 *
 * Nimmt die ganze Strecke und nicht nur das Möbel: Eine Warengruppe deckt
 * selten das ganze Möbel ab, und die Felder darunter können sich
 * unterscheiden. Siehe `logik/auslagen.ts`.
 */
export type Auslagenzahl = (strecke: Streckenmeter) => Auslagenanteil | undefined;

/** Eine Zeile der Auswertung. */
export interface Warengruppenzeile {
  /** Der Name, unter dem die Zeile steht – bei einem Pfad dessen letzte Stufe. */
  name: string;
  /**
   * Der Pfad, wenn die Strecken einen tragen.
   *
   * Er macht die Zeile eindeutig: „Kuchen" unter Backwaren und „Kuchen" unter
   * Lebensmittel › Feinbackwaren sind zwei Zeilen, keine gemeinsame.
   */
  pfad?: string;
  /** Laufende Meter. */
  laufend: number;
  /**
   * Tatsächliche Meter – oder `undefined`, wenn für diese Möbel keine
   * Auslagenzahl bekannt ist.
   *
   * Lieber leer als erfunden: Eine Null sähe aus wie „hier steht nichts",
   * und eine geschätzte Zahl wanderte in eine Bestellung.
   */
  tatsaechlich?: number;
  /**
   * Auf wie vielen laufenden Metern die Auslagenzahl fehlt.
   *
   * Sagt, wie belastbar die Spalte daneben ist. Steht hier etwas, ist die
   * Zeile unvollständig – und man sieht, welches Möbel man noch ausfüllen muss.
   */
  ohneAuslagen: number;
  /**
   * Auf wie vielen Metern es **bewusst** keine zweite Zahl gibt.
   *
   * Blumen zählen nur laufend. Diese Meter dürfen nicht als Lücke erscheinen,
   * sonst mahnt die Tabelle etwas an, das niemand nachtragen will.
   */
  nurLaufend: number;
  /** Wie viele Möbelseiten zu dieser Zeile beitragen. */
  strecken: number;
}

/**
 * Der Name, unter dem eine Strecke in der Tabelle steht.
 *
 * Bei einem Pfad seine letzte Stufe und nicht der Text im Plan: Im Plan mag
 * „Marmorkuchen Aktion" stehen, in der Auswertung zählt es zu „Kuchen".
 * Sonst stünden für dasselbe Sortiment beliebig viele Zeilen da.
 */
function anzeigename(strecke: Streckenmeter): string {
  return strecke.pfad ? letzteStufe(strecke.pfad) : strecke.name;
}

/** Der Name, unter dem Meter ohne Beschriftung erscheinen. */
export const OHNE_WARENGRUPPE = 'ohne Warengruppe';

export interface Meteroptionen {
  /**
   * Wie viele Auslagen ein Möbel je laufendem Meter trägt.
   *
   * Kommt von außen, weil jede Abteilung anders rechnet: Regale und Kühlung
   * über die Bödenzahl, die Tiefkühlung über die Sichtfläche, die Getränke
   * über Kistenfacings. Wer hier nichts liefert, bekommt nur laufende Meter –
   * und das ist eine brauchbare Auswertung für sich.
   */
  auslagen?: Auslagenzahl;
  /**
   * In welche Zeilen eine Strecke zählt – und mit welchem Anteil.
   *
   * Gefragt wird nach der **Strecke** und nicht nach ihrem Namen, weil die
   * Antwort mehr braucht als den Namen: die Sortimentsliste, den gespeicherten
   * Pfad und die Frage, ob dort zwei Sortimente gemeinsam stehen. Das alles
   * gehört nicht hierher – hier wird gerechnet, nicht eingeordnet. Siehe
   * `logik/sortimentsbund.ts` und `logik/meterbaum.ts`.
   *
   * **Mehrere Ziele sind der Ausnahmefall.** Der Normalfall ist eines: Zwei
   * Namen auf einem Meter bilden eine gemeinsame Zeile. Erst wer die Strecke
   * ausdrücklich aufteilt, bekommt zwei Zeilen mit ihren Anteilen.
   *
   * Ohne Angabe zählt die Strecke unter ihrem eigenen Namen und Pfad.
   */
  zieleFuer?: (strecke: Streckenmeter) => Meterziel[] | undefined;
}

/** Fasst gleiche Namen zusammen und rechnet beide Spalten. */
export function warengruppenmeter(
  projekt: Projekt,
  optionen: Meteroptionen = {},
): Warengruppenzeile[] {
  const zeilen = new Map<string, Warengruppenzeile>();

  /**
   * Der Schlüssel einer Zeile.
   *
   * Der Pfad, wenn es einen gibt – sonst der Name. Damit landen zwei
   * gleichnamige Sortimente aus verschiedenen Abteilungen in zwei Zeilen, und
   * ein frei getippter Name verhält sich wie bisher.
   */
  const nimm = (name: string, pfad?: string) => {
    const schluessel = pfad ?? name;
    const vorhanden = zeilen.get(schluessel);
    if (vorhanden) return vorhanden;
    const neu: Warengruppenzeile = {
      name,
      pfad,
      laufend: 0,
      ohneAuslagen: 0,
      nurLaufend: 0,
      strecken: 0,
    };
    zeilen.set(schluessel, neu);
    return neu;
  };

  for (const strecke of strecken(projekt)) {
    // Erst umleiten: Ein zugeordneter Name bringt seine Meter dorthin, wo
    // gerechnet wird. Eine Kette wird dabei nicht verfolgt – eine Zuordnung
    // ist eine Aussage über zwei Namen, keine Vererbung.
    //
    // **Nachgeschlagen wird der Anzeigename und nicht der Text im Plan.**
    // Steht dort „Marmorkuchen Aktion" mit dem Pfad auf Kuchen, dann zählt
    // die Strecke als Kuchen – und eine Zuordnung von Kuchen muss sie
    // mitnehmen. Über den Plantext gesucht, ginge sie ins Leere, während die
    // Kisten (`logik/meterbaum.ts`) dem Ziel folgten: Die Zeile behielte
    // ihre Meter und verlöre ihre Kisten.
    const ziele = optionen.zieleFuer?.(strecke) ?? [
      { name: anzeigename(strecke), pfad: strecke.pfad, anteil: 1 },
    ];
    const anteil = optionen.auslagen?.(strecke);

    for (const ziel of ziele) {
      const zeile = nimm(ziel.name, ziel.pfad);
      const laenge = strecke.laenge * ziel.anteil;
      zeile.laufend += laenge;
      zeile.strecken++;

      if (!anteil) {
        zeile.ohneAuslagen += laenge;
        continue;
      }
      const ohneMassstab = (anteil.ohneMassstab ?? 0) * ziel.anteil;
      // Eine Zahl bekommt die Zeile, sobald auch nur ein Stück der Strecke
      // bekannt ist – und daneben steht, wie viel davon noch offen war.
      if (anteil.ohne + (anteil.ohneMassstab ?? 0) < strecke.laenge - 0.005) {
        zeile.tatsaechlich = (zeile.tatsaechlich ?? 0) + anteil.tatsaechlich * ziel.anteil;
      }
      zeile.ohneAuslagen += anteil.ohne * ziel.anteil;
      zeile.nurLaufend += ohneMassstab;
    }
  }

  // Die Meter, die noch keinen Namen tragen – damit die Summe der Tabelle
  // dem Markt entspricht.
  const sichtbar = sichtbareEbenen(projekt);
  let offen = 0;
  for (const element of projekt.elemente ?? []) {
    if (element.ebeneId && !sichtbar.has(element.ebeneId)) continue;
    if (!traegtWare(element)) continue;
    offen += unbeschriftet(element);
  }
  if (offen > 0.5) {
    const zeile = nimm(OHNE_WARENGRUPPE);
    zeile.laufend += offen;
  }

  return [...zeilen.values()]
    .map((z) => ({
      ...z,
      laufend: Math.round(z.laufend) / 100,
      tatsaechlich: z.tatsaechlich === undefined ? undefined : Math.round(z.tatsaechlich) / 100,
      ohneAuslagen: Math.round(z.ohneAuslagen) / 100,
      nurLaufend: Math.round(z.nurLaufend) / 100,
    }))
    .sort((a, b) => {
      // Die namenlosen Meter stehen unten: Sie sind kein Sortiment.
      if (a.name === OHNE_WARENGRUPPE) return 1;
      if (b.name === OHNE_WARENGRUPPE) return -1;
      return b.laufend - a.laufend || a.name.localeCompare(b.name, 'de');
    });
}

/** Die Summen unter der Tabelle. */
export function metersumme(zeilen: Warengruppenzeile[]): {
  laufend: number;
  tatsaechlich: number;
  ohneAuslagen: number;
  nurLaufend: number;
  ohneWarengruppe: number;
} {
  let laufend = 0;
  let tatsaechlich = 0;
  let ohneAuslagen = 0;
  let nurLaufend = 0;
  let ohneWarengruppe = 0;
  for (const z of zeilen) {
    laufend += z.laufend;
    tatsaechlich += z.tatsaechlich ?? 0;
    ohneAuslagen += z.ohneAuslagen;
    nurLaufend += z.nurLaufend;
    if (z.name === OHNE_WARENGRUPPE) ohneWarengruppe += z.laufend;
  }
  const rund = (w: number) => Math.round(w * 100) / 100;
  return {
    laufend: rund(laufend),
    tatsaechlich: rund(tatsaechlich),
    ohneAuslagen: rund(ohneAuslagen),
    nurLaufend: rund(nurLaufend),
    ohneWarengruppe: rund(ohneWarengruppe),
  };
}

/**
 * Alle Namen, die im Plan vorkommen – für den Abgleich mit der
 * Sortimentsliste.
 */
export function namenImPlan(projekt: Projekt): Set<string> {
  return new Set(strecken(projekt).map((s) => (s.pfad ? letzteStufe(s.pfad) : s.name)));
}

/** Nur zum Prüfen: die rohen Abschnitte einer Seite, schon beschnitten. */
export function abschnitteDerSeite(
  element: PlanElement,
  seite: 'unten' | 'oben',
): Warengruppenabschnitt[] {
  const breite = seitenbreite(felderVon(element, seite));
  const abschnitte = seite === 'oben' ? element.warengruppenOben : element.warengruppenUnten;
  return geordnet(abschnitte, breite);
}
