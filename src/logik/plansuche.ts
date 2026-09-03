import type { PlanElement, Projekt, Punkt, Raum } from '../typen/modell';
import { KATEGORIEN } from '../daten/kategorien';
import { rahmen } from './polygon';

/**
 * Etwas im Plan wiederfinden.
 *
 * Ein ausgebauter Markt hat zweihundert Möbel. Wer wissen will, wo die
 * Kaffeegondel steht oder welches Regal die Notiz „Rückwand fehlt“ trägt,
 * hatte bisher nur eine Möglichkeit: hinsehen und suchen. Bei einem Plan, der
 * nicht ganz auf den Schirm passt, heißt das scrollen und raten.
 *
 * Gesucht wird in allem, was ein Mensch hinschreibt – Beschriftung, Name,
 * Warengruppe, Notiz, Hersteller – und in den Feldbeschriftungen der Regale,
 * denn dort steht das Sortiment. Nicht gesucht wird in Maßen und Farben: Nach
 * „600“ zu suchen ergäbe hundert Treffer und keinen Hinweis.
 *
 * **Umlaute werden aufgelöst.** Wer schnell tippt, schreibt „Kuhlung“, und
 * ein Treffer ist mehr wert als die richtige Schreibweise.
 */

/** Woher ein Treffer stammt. */
export type Trefferart = 'element' | 'raum' | 'masslinie' | 'text';

export interface Treffer {
  id: string;
  art: Trefferart;
  /** Die Überschrift des Treffers – das, was im Plan steht. */
  titel: string;
  /**
   * In welchem Feld gefunden wurde: „Notiz: Rückwand fehlt“.
   *
   * Leer, wenn im Titel selbst gefunden wurde – dann stünde hier nur
   * dasselbe noch einmal.
   */
  fund: string;
  /** Wo es hingehört: „Regale“, „Kühlung“, „Raum“, „Maßlinie“. */
  bereich: string;
  /** Wohin die Ansicht springt. */
  punkt: Punkt;
  /** Ob die Ebene des Treffers gerade ausgeblendet ist. */
  verborgen: boolean;
  /** Kleiner ist besser; nur zum Sortieren. */
  rang: number;
}

/**
 * Vergleichsform eines Textes: klein geschrieben, ohne Umlaute.
 *
 * `toLowerCase` allein reicht nicht – „Kühlregal“ und „Kuhlregal“ wären
 * verschiedene Wörter. Und die Zerlegung über `normalize('NFD')` würde aus
 * „ü“ ein „u“ machen, aber aus „ß“ nichts; deshalb beides von Hand.
 */
export function vergleichsform(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Wie gut ein Text zur Suche passt – oder `null`, wenn gar nicht.
 *
 * Drei Stufen: genau dieses Wort, fängt damit an, kommt darin vor. Wer
 * „Kaffee“ tippt, will zuerst das Regal sehen, das „Kaffee“ heißt, und erst
 * danach das, in dessen Notiz das Wort vorkommt.
 */
export function passgenauigkeit(text: string, gesucht: string): number | null {
  const t = vergleichsform(text);
  if (!t) return null;
  if (t === gesucht) return 0;
  if (t.startsWith(gesucht)) return 1;
  // Auch am Wortanfang mitten im Text: „Bio Kaffee“ soll „Kaffee“ finden,
  // und zwar besser als „Entkoffeiniert“.
  if (new RegExp(`\\b${gesucht.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return 2;
  if (t.includes(gesucht)) return 3;
  return null;
}

/** Ein durchsuchtes Feld: sein Anzeigename und sein Inhalt. */
interface Feld {
  name: string;
  wert: string | undefined;
  /** Aufschlag auf die Passgenauigkeit – die Beschriftung wiegt am meisten. */
  gewicht: number;
  /**
   * Ob dieses Feld schon die Überschrift des Treffers ist.
   *
   * Dann wird der Fund nicht genannt: „Gondel A1250“ mit der Unterzeile
   * „Beschriftung: Gondel A1250“ sagt zweimal dasselbe. Stattdessen steht
   * dort, wo das Möbel hingehört und wo es steht – daran unterscheidet man
   * zwei gleich benannte Gondeln.
   */
  titelfeld?: boolean;
}

function felderVon(element: PlanElement): Feld[] {
  const abschnitte = [...(element.warengruppenUnten ?? []), ...(element.warengruppenOben ?? [])];

  // Die Notizen stehen am Feld. `feldnotizen` ist der alte Ort – eine
  // geöffnete Planung hat sie längst umgezogen, und wer nur dort suchte,
  // fand ab Fassung 9 nichts mehr.
  const feldnotizen = [
    ...(element.felderUnten ?? []),
    ...(element.felderOben ?? []),
    ...(element.feldnotizen ?? []).flatMap((f) => [{ notiz: f.oben }, { notiz: f.unten }]),
  ]
    .map((f) => f.notiz)
    .filter((t): t is string => !!t?.trim());

  return [
    { name: 'Beschriftung', wert: element.beschriftung, gewicht: 0, titelfeld: true },
    { name: 'Name', wert: element.name, gewicht: 0, titelfeld: true },
    { name: 'Warengruppe', wert: element.warengruppe, gewicht: 4 },
    // Was auf den Feldern steht, ist das Sortiment – danach sucht man oft.
    ...abschnitte.map((a) => ({ name: 'Sortiment', wert: a.text, gewicht: 4 })),
    // Die Teilsortimente einer Strecke stehen nicht im Plan – umso mehr muss
    // die Suche sie finden, sonst weiß nur noch der Bescheid, der es
    // eingetippt hat.
    ...abschnitte.map((a) => ({ name: 'Teilsortiment', wert: a.notiz, gewicht: 6 })),
    ...abschnitte.flatMap((a) =>
      (a.teile ?? []).map((t) => ({ name: 'Teilsortiment', wert: t.text, gewicht: 6 })),
    ),
    ...feldnotizen.map((t) => ({ name: 'Feldnotiz', wert: t, gewicht: 6 })),
    { name: 'Notiz', wert: element.notiz, gewicht: 8 },
    { name: 'Hersteller', wert: element.hersteller, gewicht: 10 },
  ];
}

/**
 * Der beste Treffer unter mehreren Feldern.
 *
 * Ein Regal kann in Beschriftung *und* Notiz passen. Dann zählt der bessere
 * Fund – zwei Zeilen für dasselbe Möbel wären in der Liste nur im Weg.
 */
function besterFund(felder: Feld[], gesucht: string): { rang: number; fund: string } | null {
  let beste: { rang: number; fund: string } | null = null;
  for (const feld of felder) {
    if (!feld.wert?.trim()) continue;
    const naehe = passgenauigkeit(feld.wert, gesucht);
    if (naehe === null) continue;
    const rang = naehe + feld.gewicht;
    if (!beste || rang < beste.rang) {
      beste = { rang, fund: feld.titelfeld ? '' : `${feld.name}: ${feld.wert.trim()}` };
    }
  }
  return beste;
}

/** Die Mitte eines Raumes – dorthin springt die Ansicht. */
function raummitte(raum: Raum): Punkt {
  const r = rahmen(raum.umriss);
  return { x: (r.links + r.rechts) / 2, y: (r.oben + r.unten) / 2 };
}

/** Der Anzeigename einer Kategorie, für die Zeile unter dem Treffer. */
function kategoriename(element: PlanElement): string {
  return KATEGORIEN.find((k) => k.id === element.kategorie)?.name ?? 'Element';
}

/**
 * Alles, was zur Suche passt – das Beste zuerst.
 *
 * Auch Treffer auf ausgeblendeten Ebenen kommen mit, aber gekennzeichnet:
 * Sie sind da, man sieht sie nur gerade nicht, und das ist eine Antwort und
 * kein Fehler. Sie einfach wegzulassen hieße zu behaupten, es gebe sie nicht.
 */
export function suchtreffer(projekt: Projekt, eingabe: string, grenze = 50): Treffer[] {
  const gesucht = vergleichsform(eingabe);
  if (gesucht.length < 2) return [];

  const verborgeneEbenen = new Set(
    projekt.ebenen.filter((e) => !e.sichtbar).map((e) => e.id),
  );
  const treffer: Treffer[] = [];

  for (const element of projekt.elemente) {
    const fund = besterFund(felderVon(element), gesucht);
    if (!fund) continue;
    treffer.push({
      id: element.id,
      art: 'element',
      titel: element.beschriftung?.trim() || element.name,
      fund: fund.fund,
      bereich: kategoriename(element),
      punkt: { x: element.x, y: element.y },
      verborgen: verborgeneEbenen.has(element.ebeneId),
      rang: fund.rang,
    });
  }

  for (const raum of projekt.raeume) {
    const naehe = passgenauigkeit(raum.name, gesucht);
    if (naehe === null) continue;
    treffer.push({
      id: raum.id,
      art: 'raum',
      titel: raum.name,
      fund: '',
      bereich: 'Raum',
      punkt: raummitte(raum),
      verborgen: false,
      rang: naehe + 2,
    });
  }

  for (const masslinie of projekt.masslinien) {
    const naehe = passgenauigkeit(masslinie.text, gesucht);
    if (naehe === null) continue;
    treffer.push({
      id: masslinie.id,
      art: 'masslinie',
      titel: masslinie.text,
      fund: '',
      bereich: 'Maßlinie',
      punkt: {
        x: (masslinie.von.x + masslinie.bis.x) / 2,
        y: (masslinie.von.y + masslinie.bis.y) / 2,
      },
      verborgen: false,
      rang: naehe + 6,
    });
  }

  // Gleicher Rang: nach dem Titel, damit die Reihenfolge zwischen zwei
  // Tastendrücken dieselbe bleibt. Eine Liste, die bei jedem Zeichen
  // umspringt, kann man nicht mit der Tastatur durchgehen.
  treffer.sort((a, b) => a.rang - b.rang || a.titel.localeCompare(b.titel, 'de'));
  return treffer.slice(0, grenze);
}
