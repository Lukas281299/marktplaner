import { modulName, modulsatzFuer, satzAusAchsmass } from '../daten/module';
import { bodentiefeMm } from './feldnotiz';
import type { PlanElement } from '../typen/modell';

/**
 * Die Bezeichnung eines Regals aus dem, was wirklich darin steht.
 *
 * Ein Wandregal heißt „Wandregal A1000 · T700 · H2200“, solange es aus
 * 1-m-Feldern besteht. Baut der Planer es auf 1,25 m um, hieß es bisher
 * weiter A1000 – die Bezeichnung kam aus der Vorlage und blieb stehen, auch
 * wenn vom Ursprung nichts mehr übrig war. Im Plan stand dann eine Angabe,
 * die man beim Bestellen abschreibt und die falsch ist.
 *
 * Deshalb wird sie abgeleitet statt gespeichert: aus den Feldern, der Tiefe
 * und der Höhe. Wer eigene Worte will, schreibt sie hin – dann bleibt seine
 * Fassung stehen und wird nicht mehr angefasst (`beschriftungAutomatisch`).
 *
 * **Jede Abteilung schreibt ihre Einheiten anders.** Das Trockensortiment
 * zählt Achsmaße – A1000, A1250 –, die Kühlung, die Tiefkühlung, die
 * Bedienung und Obst & Gemüse nennen Kataloglängen in Metern. Beides steht
 * so an den Möbeln, und beides steht so im Plan; eine gemeinsame Schreibweise
 * zu erfinden hieße, beide Kataloge falsch zu zitieren.
 *
 * Angefasst wird nur, was **aus Einheiten gebaut** ist. Eine Kasse, eine
 * Palette, ein Feuerlöscher haben kein Achsmaß; ihnen eines anzuhängen wäre
 * eine erfundene Angabe.
 */

/**
 * Türbreite eines Tiefkühlschranks in cm.
 *
 * Steht auch in `ElementSymbol.tsx`, weil dort gezeichnet wird. Beide Stellen
 * gehen auf dieselbe Katalogzeile zurück: WSL Eclipse, 781 mm je Tür.
 */
const TUER_TK = 78.1;

/** Ein Achsmaß so, wie es im Plan steht: „A1250“. */
export function achsText(achsmass: number): string {
  return `A${Math.round(achsmass * 10)}`;
}

/** Wie ein Möbel seine Einheiten benennt. */
export interface Einheitenschrift {
  schreibe: (laenge: number) => string;
  /**
   * Ob die Einheiten einzeln aufgezählt werden.
   *
   * Das hängt daran, ob der Modulsatz mehr als eine Länge kennt. Ein
   * Kühlregal gibt es in fünf Längen; zwei davon nebeneinander sind zwei
   * Möbel, und „5,00 m“ wäre eine Größe, die niemand liefert. Eine
   * Tiefkühlinsel dagegen wird aus lauter gleichen Modulen à 625 mm
   * zusammengesetzt und im Katalog nach ihrer Gesamtlänge benannt – dort
   * hieße „3× 0,63 m“ an einem Möbel vorbeigeredet, das 1,88 m heißt.
   */
  einzeln: boolean;
}

const ACHSSCHRIFT: Einheitenschrift = { schreibe: achsText, einzeln: true };

/**
 * In welcher Schreibweise dieses Möbel seine Einheiten nennt – oder
 * `undefined`, wenn es gar nicht aus Einheiten gebaut ist.
 *
 * Der Modulsatz entscheidet, nicht die Kategorie: In „Kühlung“ stehen
 * Hochkühlregale und Truhen nebeneinander, und die haben verschiedene Raster.
 *
 * Geschrieben wird mit `modulName` – derselben Funktion, die auch die Knöpfe
 * im Eigenschaftenfenster beschriftet. Ein zweiter Formatierer würde
 * früher oder später anders runden als der erste, und dann hieße dasselbe
 * Möbel an zwei Stellen verschieden.
 */
export function einheitenschrift(element: PlanElement): Einheitenschrift | undefined {
  const satz = modulsatzFuer(element.form) ?? satzAusAchsmass(element.achsmass);
  if (!satz) return undefined;
  // Am Knopfnamen abgelesen statt an einer zweiten Liste: Dort steht schon,
  // wie diese Abteilung ihre Einheiten schreibt.
  const achsmasse = /^A\d/.test(modulName(satz, satz.laengen[0]));
  return {
    schreibe: (laenge) => modulName(satz, laenge),
    einzeln: achsmasse || satz.laengen.length > 1,
  };
}

/** Gleiche Maße nebeneinander zusammenfassen. */
function gruppiere(breiten: number[]): { mass: number; anzahl: number }[] {
  const gruppen: { mass: number; anzahl: number }[] = [];
  for (const b of breiten) {
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && Math.abs(letzte.mass - b) < 0.05) letzte.anzahl++;
    else gruppen.push({ mass: b, anzahl: 1 });
  }
  return gruppen;
}

/**
 * Die Felder als Kurzschrift: „A1000“ oder „3× A1000 · 3× A1250“.
 *
 * Gleiche Maße werden gezählt und zusammengefasst, in der Reihenfolge, in
 * der sie im Regal stehen – so liest man es auch am Möbel ab. Leere Felder
 * zählen mit: Der Platz ist belegt, die Säule steht.
 *
 * Bei Möbeln aus lauter gleichen Modulen wird stattdessen die
 * **Gesamtlänge** genannt: Eine Tiefkühlinsel aus drei Modulen à 625 mm
 * heißt im Katalog 1,88 m. Erst ein wirklich gemischtes Möbel wird auch
 * dort aufgezählt – dann ist die Summe zu wenig.
 */
export function felderKurz(breiten: number[], schrift: Einheitenschrift = ACHSSCHRIFT): string {
  if (breiten.length === 0) return '';
  const gruppen = gruppiere(breiten);

  if (!schrift.einzeln && gruppen.length === 1) {
    return schrift.schreibe(breiten.reduce((summe, b) => summe + b, 0));
  }
  // Ein einzelnes Feld braucht kein „1×“ davor.
  if (gruppen.length === 1 && gruppen[0].anzahl === 1) return schrift.schreibe(gruppen[0].mass);
  return gruppen.map((g) => `${g.anzahl}× ${schrift.schreibe(g.mass)}`).join(' · ');
}

/** Ein Größenteil: „A1250“, „3× A1000“, „1,88 m“, „2× 2,50 m“. */
const GROESSE = String.raw`(?:\d+×\s*)?(?:A\d+|\d+(?:,\d+)?\s*m)`;
/** Ein Teil, der die Zusammensetzung wiederholt: „3 Felder A1000“. */
const ZUSAMMENSETZUNG = new RegExp(
  String.raw`^\d+\s+(?:Feld|Felder|Modul|Module|Möbel|Gestell|Gestelle|Einheit|Einheiten|Turm|Türme|Schrank|Schränke|Gerät|Geräte)(?:\s+A\d+)?$`,
);

/**
 * Zerlegt eine Bezeichnung in Bauart, Größe und den Rest.
 *
 * „Kühlregal 2,50 m · offen“ wird zu Bauart „Kühlregal“, Größe „2,50 m“ und
 * Rest „offen“. Nur die Größe wird später ersetzt – alles andere ist
 * Zubehör, das niemand ableiten kann: ob eine Tür davor ist, wie viele
 * Stufen die Auslage hat, welche Tiefe hinten und vorn gilt.
 */
function zerlegeName(bezeichnung: string): {
  kopf: string;
  rest: string[];
  /** Ob überhaupt eine Maßangabe darin stand. */
  hatGroesse: boolean;
} {
  const teile = bezeichnung
    .split('·')
    .map((t) => t.trim())
    .filter(Boolean);
  if (teile.length === 0) return { kopf: bezeichnung.trim(), rest: [], hatGroesse: false };

  const vorne = teile[0].match(new RegExp(String.raw`^(.*?)\s+(${GROESSE})$`));
  const kopf = (vorne?.[1] ?? teile[0]).trim();

  // Steht die Größe über mehrere Teile – „3× A1000 · 3× A1250“ –, gehören
  // sie alle dazu, solange sie unmittelbar aufeinanderfolgen.
  const nurGroesse = new RegExp(String.raw`^${GROESSE}$`);
  let i = 1;
  if (vorne) while (i < teile.length && nurGroesse.test(teile[i])) i++;

  const rest = teile.slice(i).filter((t) => !ZUSAMMENSETZUNG.test(t));
  return { kopf: kopf || bezeichnung.trim(), rest, hatGroesse: vorne !== null };
}

/**
 * Der Teil des Namens vor den Maßen – „Wandregal“, „Gondel“, „Gondelzug“.
 *
 * Aus der vorhandenen Bezeichnung gelesen und nicht aus einer Liste: Die
 * Bibliothek benennt ihre Möbel selbst, und diese Namen sollen erhalten
 * bleiben, auch wenn später neue dazukommen.
 */
export function bauart(bezeichnung: string): string {
  return zerlegeName(bezeichnung).kopf;
}

/**
 * Die vollständige Bezeichnung eines Regals.
 *
 * `undefined`, wenn das Möbel keine Felder hat oder gar nicht aus Einheiten
 * gebaut ist – dann gibt es nichts abzuleiten, und die Bezeichnung bleibt,
 * wie sie ist.
 */
export function bezeichnungFuer(element: PlanElement): string | undefined {
  const schrift = einheitenschrift(element);
  if (!schrift) return undefined;

  // Nur was wirklich in Felder geteilt ist. `felderVon` baut für jedes Möbel
  // ein Ersatzfeld – dabei käme ein Maß heraus, das es dort gar nicht gibt.
  const unten = element.felderUnten ?? [];
  const oben = element.felderOben ?? [];
  const breiten = (unten.length > 0 ? unten : oben).map((f) => f.breite).filter((b) => b > 0);
  if (breiten.length === 0) return undefined;

  const { kopf, rest } = zerlegeName(element.beschriftung || element.name);

  // Tiefe und Höhe stehen in Millimetern und werden mitgezogen – aber nur,
  // wo sie schon in dieser einfachen Form stehen. „T1200+600“ bei Obst und
  // Gemüse meint hinten und vorn; das kann hier niemand nachrechnen.
  //
  // **Die Bodentiefe und nicht das Stellmaß.** Ein Regal von 1470 mm Tiefe
  // ist eine Gondel aus zwei 700er Böden mit 70 mm toter Zone dazwischen –
  // die Hälfte davon wären 735, und die gibt es nicht zu bestellen.
  // `bodentiefeMm` zieht die tote Zone ab und rastet auf das nächste Maß des
  // Systems ein.
  const tiefeMm = bodentiefeMm(element);
  const nachgezogen = (teil: string): string => {
    if (/^T\d+$/.test(teil)) return `T${tiefeMm}`;
    if (/^T2×\d+$/.test(teil)) return `T2×${tiefeMm}`;
    const hoehe = element.hoehe ?? 0;
    if (/^H\d+$/.test(teil) && hoehe > 0) return `H${Math.round(hoehe * 10)}`;
    // Die Türzahl eines Tiefkühlschranks steht im Namen und ergibt sich aus
    // der Breite. Ohne Nachziehen behielte ein auf vier Türen verlängerter
    // Schrank sein „3 Türen" – und man bestellte danach.
    const tueren = teil.match(/^(\d+)\s+(Tür|Türen)$/);
    if (tueren && element.form === 'tkSchrank') {
      const zahl = Math.max(1, Math.round(element.breite / TUER_TK));
      return `${zahl} ${zahl === 1 ? 'Tür' : 'Türen'}`;
    }
    return teil;
  };

  // Bauart und Maß stehen ohne Trenner nebeneinander – „Wandregal A1250“ –,
  // so wie die Bibliothek ihre Möbel benennt. Erst danach trennen Punkte.
  const kopfzeile = [kopf, felderKurz(breiten, schrift)].filter(Boolean).join(' ');
  return [kopfzeile, ...rest.map(nachgezogen)].filter(Boolean).join(' · ');
}

/**
 * Die nachgezogene Bezeichnung für eine **vorhandene** Planung.
 *
 * Zurückhaltender als `bezeichnungFuer`, und aus gutem Grund: In alten
 * Planungen gab es das Kennzeichen `beschriftungAutomatisch` noch nicht.
 * Ein Regal, das der Planer damals „Kaffee“ genannt hat, sieht heute
 * genauso aus wie eines, das nie angefasst wurde – am Kennzeichen ist
 * beides nicht zu unterscheiden.
 *
 * Deshalb wird nur angefasst, was **schon eine Maßangabe trägt**: Das ist
 * die Handschrift der Bibliothek. Wer eigene Worte ohne Maß hingeschrieben
 * hat, behält sie.
 */
export function nachgezogeneBezeichnung(element: PlanElement): string | undefined {
  if (element?.beschriftungAutomatisch === false) return undefined;
  // Beides kann fehlen: In einer beschädigten Datei steht statt eines Möbels
  // schon einmal eine Zahl oder ein Text. Dann gibt es nichts nachzuziehen –
  // aber es darf auch nichts fliegen, sonst lässt sich die Planung gar nicht
  // mehr öffnen.
  const bisher = element?.beschriftung || element?.name;
  if (typeof bisher !== 'string') return undefined;
  if (!zerlegeName(bisher).hatGroesse) return undefined;
  const neu = bezeichnungFuer(element);
  return neu && neu !== element.beschriftung ? neu : undefined;
}
