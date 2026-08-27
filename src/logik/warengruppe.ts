import type { Regalfeld, Warengruppenabschnitt } from '../typen/modell';

/**
 * Die Warengruppen-Beschriftung unter einem Regalzug.
 *
 * Auf einem Ladenbauplan steht unter dem Zug, was dort verkauft wird –
 * „Mayonnaise", „Senf", „Ketchup". Diese Beschriftung gehört nicht zu einem
 * einzelnen Feld, sondern zu einer **Strecke**: Ketchup bekommt drei laufende
 * Meter, und dann steht es einmal da und nicht dreimal.
 *
 * **Gemessen wird in Zentimetern.** Früher zählte die Beschriftung in
 * Feldern, und das ging so lange gut, wie sich jedes Sortiment an die
 * Feldgrenzen hielt. Zwei Sortimente auf drei Metern tun das nicht: Die
 * Grenze läuft mitten durch das zweite Feld. Wer dafür die Felder umbaute,
 * zeichnete ein Möbel, das es nicht gibt – ein Zug mit drei Böden wurde zu
 * einem mit zweien.
 *
 * Die Felder bleiben deshalb, wie das Möbel gebaut ist. Sie sind für die
 * Beschriftung nur noch **Rastpunkte** beim Ziehen (siehe `rastpunkte`).
 *
 * Nicht zu verwechseln mit der Warengruppe am Element (`PlanElement.
 * warengruppe`): Die ist eine grobe Einordnung fürs Rechnen, diese hier ist
 * Beschriftung im Bild.
 */

/**
 * Eine Beschriftung mit ihrer Strecke, **in Leserichtung des Plans**.
 *
 * `von` und `bis` sind Zentimeter ab dem linken Rand des Möbels im Bild.
 * Gespeichert wird dagegen in der Achse des Möbels – steht der Zug an der
 * unteren Wand, läuft seine Achse andersherum, und dann drehen die Spannen
 * sich hier um. Sonst reichte Ketchup nach links über die Mayonnaise.
 */
export interface Gruppenspanne {
  von: number;
  bis: number;
  text: string;
  /** Die eingestellte Schrifthöhe in cm, falls es eine gibt. */
  schrift?: number;
  /** Die Stelle dieses Abschnitts in der **gespeicherten** Liste. */
  index: number;
}

/** Wie nah zwei Zentimeterwerte sein dürfen, um als gleich zu gelten. */
const GENAU = 0.5;

/** Schmaler als so wird kein Abschnitt – sonst verschwindet er unter der Hand. */
export const KLEINSTER_ABSCHNITT = 10;

/**
 * Bringt eine Abschnittsliste in Ordnung.
 *
 * Sortiert, auf das Möbel beschnitten, ohne Überlappungen und ohne leere
 * Texte. Das Ergebnis ist die einzige Form, in der Abschnitte gespeichert
 * werden – alles andere müsste jede lesende Stelle noch einmal prüfen.
 *
 * Überlappungen entstehen nicht beim Bearbeiten, sondern beim **Kürzen des
 * Möbels**: Wer einen Zug von sechs auf vier Meter zieht, hat plötzlich eine
 * Beschriftung im Nichts.
 */
export function geordnet(
  abschnitte: Warengruppenabschnitt[] | undefined,
  gesamtbreite: number,
): Warengruppenabschnitt[] {
  if (!abschnitte || abschnitte.length === 0) return [];

  const sauber = abschnitte
    .filter((a) => a.text.trim().length > 0)
    .map((a) => ({
      ...a,
      text: a.text,
      von: Math.max(0, Math.min(a.von, a.bis)),
      bis: Math.min(gesamtbreite, Math.max(a.von, a.bis)),
    }))
    .filter((a) => a.bis - a.von > GENAU)
    .sort((a, b) => a.von - b.von);

  // Überlappungen zugunsten des früheren Abschnitts auflösen: Der spätere
  // weicht zurück. Andersherum verschöbe sich beim Kürzen alles nach vorn.
  const ergebnis: Warengruppenabschnitt[] = [];
  for (const abschnitt of sauber) {
    const vorher = ergebnis[ergebnis.length - 1];
    const von = vorher ? Math.max(abschnitt.von, vorher.bis) : abschnitt.von;
    if (abschnitt.bis - von <= GENAU) continue;
    ergebnis.push({ ...abschnitt, von });
  }
  return ergebnis;
}

/**
 * Die Beschriftungen einer Seite, jede mit ihrer Strecke im Bild.
 *
 * **Gezählt wird in Leserichtung des Plans.** Steht der Zug an der unteren
 * Wand, läuft seine Achse andersherum; dann wird hier gespiegelt. Sonst
 * stünde jede Beschriftung an der falschen Stelle.
 */
export function gruppenspannen(
  abschnitte: Warengruppenabschnitt[] | undefined,
  gesamtbreite: number,
  rueckwaerts = false,
): Gruppenspanne[] {
  const liste = geordnet(abschnitte, gesamtbreite);
  const spannen = liste.map((a, index) => ({
    von: rueckwaerts ? gesamtbreite - a.bis : a.von,
    bis: rueckwaerts ? gesamtbreite - a.von : a.bis,
    text: a.text.trim(),
    schrift: a.schrift,
    index,
  }));
  return rueckwaerts ? spannen.reverse() : spannen;
}

/* ------------------------------------------------------------- Bearbeiten */

/**
 * Legt eine Beschriftung auf eine Strecke.
 *
 * Was dort schon stand, weicht: Ein Abschnitt, der ganz darunter liegt, fällt
 * weg; einer, der hineinragt, wird gekürzt; einer, der die neue Strecke
 * umschließt, zerfällt in zwei. Das ist dieselbe Regel wie beim Schreiben in
 * ein Feld – wer etwas Neues hinschreibt, meint, dass es dort jetzt gilt.
 *
 * Ein leerer Text löscht nur, statt zu schreiben.
 */
export function mitAbschnitt(
  abschnitte: Warengruppenabschnitt[] | undefined,
  gesamtbreite: number,
  neu: Warengruppenabschnitt,
): Warengruppenabschnitt[] {
  const von = Math.max(0, Math.min(neu.von, neu.bis));
  const bis = Math.min(gesamtbreite, Math.max(neu.von, neu.bis));
  if (bis - von <= GENAU) return geordnet(abschnitte, gesamtbreite);

  const frei = ohneStrecke(abschnitte, gesamtbreite, von, bis);
  const text = neu.text.trim();
  if (!text) return frei;

  return geordnet([...frei, { ...neu, von, bis, text }], gesamtbreite);
}

/** Räumt eine Strecke frei, ohne etwas Neues hineinzulegen. */
export function ohneStrecke(
  abschnitte: Warengruppenabschnitt[] | undefined,
  gesamtbreite: number,
  von: number,
  bis: number,
): Warengruppenabschnitt[] {
  const ergebnis: Warengruppenabschnitt[] = [];
  for (const alt of geordnet(abschnitte, gesamtbreite)) {
    // Ganz daneben: bleibt.
    if (alt.bis <= von + GENAU || alt.von >= bis - GENAU) {
      ergebnis.push(alt);
      continue;
    }
    // Was links übersteht, bleibt als eigener Abschnitt stehen.
    if (alt.von < von - GENAU) ergebnis.push({ ...alt, bis: von });
    // Und was rechts übersteht, ebenso.
    if (alt.bis > bis + GENAU) ergebnis.push({ ...alt, von: bis });
  }
  return geordnet(ergebnis, gesamtbreite);
}

/**
 * Die Stellen, an denen eine Grenze beim Ziehen einrastet.
 *
 * Feldgrenzen zuerst, dann Halbe und Viertel darin. Damit trifft man die
 * üblichen Fälle ohne Zielen – drei Meter zu zweit geteilt sind anderthalb,
 * und anderthalb ist die Mitte eines Feldes oder eine Feldgrenze, je nachdem
 * wie der Zug gebaut ist.
 *
 * Die Enden des Möbels gehören dazu: Ein Abschnitt soll bündig abschließen
 * können.
 */
export function rastpunkte(felder: Regalfeld[]): number[] {
  const punkte = new Set<number>([0]);
  let x = 0;
  for (const feld of felder) {
    // Viertel, Hälfte, Dreiviertel – und die Grenze selbst.
    for (const anteil of [0.25, 0.5, 0.75, 1]) {
      punkte.add(runde(x + feld.breite * anteil));
    }
    x += feld.breite;
  }
  return [...punkte].sort((a, b) => a - b);
}

/** Rastet einen Wert auf den nächsten Punkt ein, wenn er nah genug ist. */
export function eingerastet(wert: number, punkte: number[], toleranz: number): number {
  let bester = wert;
  let abstand = toleranz;
  for (const punkt of punkte) {
    const weite = Math.abs(punkt - wert);
    if (weite < abstand) {
      abstand = weite;
      bester = punkt;
    }
  }
  return runde(bester);
}

/**
 * Verschiebt eine Kante eines Abschnitts.
 *
 * Grenzt sie an einen Nachbarn, wandern **beide gemeinsam** – sonst risse
 * beim Ziehen ein Loch auf oder die beiden überlappten sich. Grenzt sie an
 * nichts, wandert nur diese Kante, und der Abschnitt wird länger oder kürzer.
 *
 * Kein Abschnitt wird dabei schmaler als `KLEINSTER_ABSCHNITT`: Ein Sortiment
 * auf zwei Zentimetern ist keine Angabe mehr, sondern ein Versehen, und wer
 * es loswerden will, löscht es.
 */
export function mitVerschobenerKante(
  abschnitte: Warengruppenabschnitt[],
  gesamtbreite: number,
  index: number,
  kante: 'von' | 'bis',
  ziel: number,
): Warengruppenabschnitt[] {
  const liste = geordnet(abschnitte, gesamtbreite);
  const eigen = liste[index];
  if (!eigen) return liste;

  const nachbar =
    kante === 'von'
      ? liste[index - 1] && Math.abs(liste[index - 1].bis - eigen.von) < GENAU
        ? index - 1
        : -1
      : liste[index + 1] && Math.abs(liste[index + 1].von - eigen.bis) < GENAU
        ? index + 1
        : -1;

  // Wie weit die Kante darf, ohne jemanden unter das Mindestmaß zu drücken.
  const grenzen = spielraum(liste, gesamtbreite, index, kante, nachbar);
  const wert = runde(Math.max(grenzen.min, Math.min(grenzen.max, ziel)));

  return liste.map((abschnitt, i) => {
    if (i === index) return { ...abschnitt, [kante]: wert };
    if (i === nachbar) return { ...abschnitt, [kante === 'von' ? 'bis' : 'von']: wert };
    return abschnitt;
  });
}

/** Zwischen welchen Werten sich eine Kante bewegen darf. */
function spielraum(
  liste: Warengruppenabschnitt[],
  gesamtbreite: number,
  index: number,
  kante: 'von' | 'bis',
  nachbar: number,
): { min: number; max: number } {
  const eigen = liste[index];

  if (kante === 'von') {
    // Nach rechts darf sie bis kurz vor das eigene Ende.
    const max = eigen.bis - KLEINSTER_ABSCHNITT;
    // Nach links bis an den Nachbarn – der aber selbst nicht verschwinden darf.
    const min =
      nachbar >= 0
        ? liste[nachbar].von + KLEINSTER_ABSCHNITT
        : (liste[index - 1]?.bis ?? 0);
    return { min: Math.min(min, max), max };
  }

  const min = eigen.von + KLEINSTER_ABSCHNITT;
  const max =
    nachbar >= 0
      ? liste[nachbar].bis - KLEINSTER_ABSCHNITT
      : (liste[index + 1]?.von ?? gesamtbreite);
  return { min, max: Math.max(min, max) };
}

/** Halbe Zentimeter reichen; alles darunter sind Rechenreste. */
function runde(wert: number): number {
  return Math.round(wert * 2) / 2;
}

/* --------------------------------------------------------------- Anzeige */

/**
 * Die Größen, in denen sich eine Beschriftung einstellen lässt, in cm.
 *
 * Vier Stufen und keine freie Eingabe: Auf einem Plan sollen gleiche Dinge
 * gleich groß sein. Wer jede Beschriftung einzeln auf den Zentimeter setzen
 * kann, bekommt am Ende dreißig verschiedene.
 */
export const GRUPPE_GROESSEN: { hoehe: number; name: string }[] = [
  { hoehe: 14, name: 'sehr klein' },
  { hoehe: 18, name: 'klein' },
  { hoehe: 22, name: 'normal' },
  { hoehe: 28, name: 'groß' },
];

/**
 * Die übliche Größe, wenn nichts eingestellt ist.
 *
 * So hoch wie die Notiz im Feld. Größer war sie zuerst — sie ist ja das,
 * was man zuerst liest —, aber im Plan drängte sie sich vor und stand über
 * dem Nachbarn. Gleich groß liest sich beides gut und nichts drängelt.
 */
export const GRUPPE_NORMAL = 22;

/**
 * Kleiner als so wird nicht verkleinert, in cm.
 *
 * Acht Zentimeter Schrifthöhe im Plan sind schon wenig – das ist die Grenze,
 * ab der ein Name auf dem Ausdruck nichts mehr taugt. Wer einen langen Namen
 * auf ein halbes Feld schreibt, sieht ihn dann ein wenig überstehen und kann
 * ihn kürzen. Eine Beschriftung, die zu Staub geschrumpft ist, sieht er
 * nicht.
 */
export const KLEINSTE_SCHRIFT = 8;

/** Eine umgebrochene Beschriftung mit der Größe, in der sie passt. */
export interface Gruppensatz {
  zeilen: string[];
  schrift: number;
}

/**
 * Setzt eine Beschriftung so, dass sie in ihre Strecke passt.
 *
 * Zwei Mittel, in dieser Reihenfolge: **umbrechen**, und wenn das nicht
 * reicht, **verkleinern**. Ein Name, der über sein Möbel hinausragt, steht
 * im Plan über dem Nachbarn und behauptet dort etwas Falsches.
 *
 * Umbrüche von Hand gelten unverändert – wer selbst trennt, weiß besser, wo.
 * Was danach immer noch zu breit ist, wird an den Wortgrenzen weiter geteilt.
 * Bleibt dann noch eine Zeile zu breit – ein einzelnes langes Wort –, wird
 * die ganze Beschriftung kleiner, bis sie hineinpasst.
 *
 * Abgeschnitten wird nie: Aus „Grillsoßen" würde „Grillso", und das liest
 * sich wie eine Angabe.
 *
 * `messen` kommt von außen, weil die Breite eines Textes nur die Leinwand
 * kennt – und die gibt es beim Prüfen nicht.
 */
export function gruppensatz(
  text: string,
  breite: number,
  schrift: number,
  messen: (text: string, schrift: number) => number,
): Gruppensatz {
  let hoehe = schrift;
  let zeilen = gruppenZeilen(text, breite, (t) => messen(t, hoehe));

  // Höchstens ein paar Anläufe: Jeder verkleinert um genau so viel, wie zu
  // viel war, und danach passen andere Wörter in dieselbe Zeile. Zwei, drei
  // Durchgänge reichen; eine Schleife ohne Ende darf hier nicht entstehen.
  for (let versuch = 0; versuch < 4; versuch++) {
    const breiteste = zeilen.reduce((max, zeile) => Math.max(max, messen(zeile, hoehe)), 0);
    if (breiteste <= breite || breiteste <= 0 || breite <= 0) break;

    const naechste = Math.max(
      Math.min(schrift, KLEINSTE_SCHRIFT),
      (hoehe * breite) / breiteste,
    );
    if (naechste >= hoehe - 0.01) break;
    hoehe = naechste;
    zeilen = gruppenZeilen(text, breite, (t) => messen(t, hoehe));
  }

  return { zeilen, schrift: hoehe };
}

/**
 * Setzt einen Text in ein Rechteck – passend in **beide** Richtungen.
 *
 * `gruppensatz` sorgt für die Breite; hier kommt die Höhe dazu. Nötig, weil
 * das Umbrechen selbst Höhe kostet: Ein Text, der in zwei Zeilen passt, ist
 * doppelt so hoch wie vorher und ragt sonst unten aus seinem Kasten.
 *
 * Gebraucht überall dort, wo die Größe des Möbels die Schrift vorgibt statt
 * einer Einstellung – beim freien Textfeld und beim Namen einer
 * Aktionsfläche. Man zieht den Kasten und sieht, was passiert.
 */
export function textImKasten(
  text: string,
  breite: number,
  hoehe: number,
  schrift: number,
  messen: (text: string, schrift: number) => number,
  zeilenabstand = 1.2,
): Gruppensatz {
  let satz = gruppensatz(text, breite, schrift, messen);

  for (let versuch = 0; versuch < 3; versuch++) {
    const gebraucht = satz.zeilen.length * satz.schrift * zeilenabstand;
    if (gebraucht <= hoehe || gebraucht <= 0 || hoehe <= 0) break;

    const naechste = Math.max(KLEINSTE_SCHRIFT, (satz.schrift * hoehe) / gebraucht);
    if (naechste >= satz.schrift - 0.01) break;
    satz = gruppensatz(text, breite, naechste, messen);
  }

  return satz;
}

/**
 * Bricht eine Beschriftung auf die Breite ihrer Strecke um.
 *
 * Umbrüche von Hand gelten unverändert – wer selbst trennt, weiß besser, wo.
 * Was danach immer noch zu breit ist, wird an den Wortgrenzen weiter geteilt.
 *
 * Ein einzelnes zu langes Wort bleibt stehen und steht über. Getrennt würde
 * es unleserlich, und ein abgeschnittenes Wort wäre eine falsche Angabe: Aus
 * „Grillsoßen" würde „Grillso".
 *
 * `messen` kommt von außen, weil die Breite eines Textes nur die Leinwand
 * kennt – und die gibt es beim Prüfen nicht.
 */
export function gruppenZeilen(
  text: string,
  breite: number,
  messen: (text: string) => number,
): string[] {
  const zeilen: string[] = [];

  for (const absatz of text.split('\n')) {
    const worte = absatz.trim().split(/\s+/).filter(Boolean);
    if (worte.length === 0) {
      // Eine Leerzeile von Hand ist ein gewollter Abstand.
      if (zeilen.length > 0) zeilen.push('');
      continue;
    }

    let zeile = worte[0];
    for (const wort of worte.slice(1)) {
      const versuch = `${zeile} ${wort}`;
      if (breite > 0 && messen(versuch) > breite) {
        zeilen.push(zeile);
        zeile = wort;
      } else {
        zeile = versuch;
      }
    }
    zeilen.push(zeile);
  }

  // Ein leerer Text ergibt keine Zeile, nicht eine leere.
  while (zeilen.length > 0 && zeilen[zeilen.length - 1] === '') zeilen.pop();
  return zeilen;
}
