import { BIBLIOTHEK, findeVorlage } from '../daten/bibliothek';
import { alleNamen } from '../daten/warengruppen';
import { gesamtUmgrenzung } from '../logik/geometrie';
import { felderVon, seitenbreite, seitenVon } from '../logik/regalseiten';
import { mitAbschnitt } from '../logik/warengruppe';
import { warengruppenVon } from '../logik/warengruppenzuordnung';
import { abteilungsstand, gruppenstand, pfadVon, standVon } from '../logik/sortiment';
import type { Standwert } from '../logik/sortiment';
import { usePlanStore } from '../zustand/planStore';
import type { Ausrichtung, PlanStore } from '../zustand/planStore';
import type { BibliothekEintrag, PlanElement, Punkt } from '../typen/modell';
import { elementzeile, kurzeKennung } from './planbild';

/**
 * Was der Assistent tun kann.
 *
 * Grundsatz: **kein zweiter Weg in die Daten.** Jedes Werkzeug ruft dieselbe
 * Store-Aktion auf, die auch ein Klick auslöst. Was hier fehlt, kann der
 * Assistent nicht – und was hier steht, verhält sich zwangsläufig genauso wie
 * von Hand, samt Einrasten, Kopfgondel-Ausrichtung und Historie.
 *
 * Deshalb steht in keinem Werkzeug ein `set(...)` auf das Projekt.
 *
 * Die Rückgabe jedes Werkzeugs ist Text für das Modell, nicht für den
 * Menschen. Sie soll knapp sein und sagen, was **wirklich** geschehen ist:
 * Ein „erledigt" auf einen Aufruf, der an einem gesperrten Möbel abgeprallt
 * ist, führt zu einem Assistenten, der Erfolge meldet, die es nicht gab.
 */

export interface Werkzeug {
  name: string;
  beschreibung: string;
  /** JSON-Schema der Eingabe, so wie die API es erwartet. */
  schema: Record<string, unknown>;
  /** Ändert es den Plan? Nur solche Aufrufe werden dem Nutzer als Tat gezeigt. */
  schreibt: boolean;
  fuehreAus(eingabe: Record<string, any>, s: PlanStore): string;
}

/* ------------------------------------------------------------------ Helfer */

function laden(): PlanStore {
  return usePlanStore.getState();
}

/** Bricht mit einer Meldung ab, die als Werkzeugergebnis beim Modell landet. */
class Abbruch extends Error {}

function fehler(text: string): never {
  throw new Abbruch(text);
}

/**
 * Sucht ein Element – auch über eine gekürzte Kennung.
 *
 * Der Assistent bekommt die Kennungen gekürzt zu lesen (siehe
 * `kurzeKennung`), also muss er sie auch gekürzt zurückgeben dürfen. Volle
 * Kennungen gehen weiter, denn aus dem Plan kommen sie in voller Länge.
 *
 * Bei Mehrdeutigkeit wird **nichts** genommen: Lieber eine Rückfrage als das
 * falsche Möbel verschoben.
 */
export function findeElement(id: string, elemente: PlanElement[]): PlanElement | 'mehrdeutig' | undefined {
  const genau = elemente.find((e) => e.id === id);
  if (genau) return genau;

  const ohneStriche = (wert: string) => wert.replace(/-/g, '');
  const gesucht = ohneStriche(id);
  const treffer = elemente.filter((e) => ohneStriche(e.id).startsWith(gesucht));
  if (treffer.length === 1) return treffer[0];
  if (treffer.length > 1) return 'mehrdeutig';
  return undefined;
}

/**
 * Die Elemente, auf die sich ein Aufruf bezieht.
 *
 * Ohne `ids` gilt die Auswahl. Das ist der Fall „verschieb das mal nach
 * links", nachdem der Nutzer selbst etwas angeklickt hat.
 */
function betroffene(eingabe: { ids?: string[] }, s: PlanStore): PlanElement[] {
  const ids = eingabe.ids && eingabe.ids.length > 0 ? eingabe.ids : s.auswahl;
  if (ids.length === 0) fehler('Keine Elemente angegeben und nichts ausgewählt.');

  const gefunden: PlanElement[] = [];
  const fehlend: string[] = [];
  const doppelt: string[] = [];
  for (const id of ids) {
    const el = findeElement(String(id), s.projekt.elemente);
    if (el === 'mehrdeutig') doppelt.push(String(id));
    else if (el) gefunden.push(el);
    else fehlend.push(String(id));
  }
  if (doppelt.length > 0) {
    fehler(`Diese Kennungen passen auf mehrere Möbel: ${doppelt.join(', ')}. Nimm die volle Kennung.`);
  }
  if (gefunden.length === 0) {
    fehler(`Keines dieser Elemente gibt es: ${fehlend.join(', ')}`);
  }
  return gefunden;
}

/**
 * Die gemeinte Seite – mit einer klaren Absage, wenn es sie nicht gibt.
 *
 * „oben" an einem einseitigen Möbel ist keine Kleinigkeit, die man still auf
 * „unten" biegen darf: Der Assistent hätte dann etwas anderes beschriftet,
 * als er wollte, und niemand hätte es bemerkt.
 */
function seiteVon(el: PlanElement, wunsch: unknown): 'oben' | 'unten' {
  const seiten = seitenVon(el);
  if (wunsch === 'oben' && !seiten.includes('oben')) {
    fehler(`"${el.name}" ist einseitig und hat keine obere Seite.`);
  }
  return wunsch === 'oben' ? 'oben' : 'unten';
}

/** Wie `findeElement`, bricht aber gleich mit einer Meldung ab. */
function einElement(id: unknown, s: PlanStore): PlanElement {
  const el = findeElement(String(id ?? ''), s.projekt.elemente);
  if (el === 'mehrdeutig') {
    fehler(`Die Kennung "${id}" passt auf mehrere Möbel. Nimm die volle Kennung.`);
  }
  if (!el) fehler(`Das Element "${id}" gibt es nicht.`);
  return el;
}

/**
 * Warnt vor Elementen, die der Store stillschweigend auslässt.
 *
 * Gesperrte Möbel lassen sich nicht ändern – das ist richtig so, muss aber im
 * Ergebnis stehen. Sonst hakt der Assistent einen Auftrag ab, der zur Hälfte
 * nicht ausgeführt wurde.
 */
function hinweisGesperrt(elemente: PlanElement[]): string {
  const gesperrt = elemente.filter((e) => e.gesperrt);
  if (gesperrt.length === 0) return '';
  return ` Übergangen (gesperrt): ${gesperrt.map((e) => e.id).join(', ')}.`;
}

/**
 * Zählt Elemente für die Rückmeldung auf.
 *
 * Nachgeschlagen wird dabei der **jetzige** Stand und nicht der übergebene:
 * Wer gerade umbenannt hat, bekäme sonst die alten Namen zurückgemeldet und
 * hielte die Umbenennung für misslungen.
 */
function nenne(elemente: PlanElement[]): string {
  const jetzt = laden().projekt.elemente;
  const teile = elemente.slice(0, 12).map((e) => {
    const frisch = jetzt.find((x) => x.id === e.id) ?? e;
    return `${kurzeKennung(frisch.id)} "${frisch.name}"`;
  });
  if (elemente.length > 12) teile.push(`… und ${elemente.length - 12} weitere`);
  return teile.join(', ');
}

/** Setzt die Auswahl, damit der Nutzer sieht, wovon die Rede ist. */
function zeige(ids: string[], s: PlanStore): void {
  s.waehleAus(ids, 'ersetzen');
}

function zahl(wert: unknown, name: string): number {
  const n = Number(wert);
  if (!Number.isFinite(n)) fehler(`${name} ist keine Zahl.`);
  return n;
}

function punkte(roh: unknown, name: string): Punkt[] {
  if (!Array.isArray(roh) || roh.length < 3) {
    fehler(`${name} braucht mindestens drei Punkte.`);
  }
  return roh.map((p: any) => ({ x: zahl(p?.x, `${name}.x`), y: zahl(p?.y, `${name}.y`) }));
}

/* --------------------------------------------------------------- Werkzeuge */

const PLAN_LESEN: Werkzeug = {
  name: 'plan_lesen',
  beschreibung:
    'Listet die Elemente des Plans mit Kennung, Name, Kategorie, Mittelpunkt, Maßen, Drehung und den Warengruppen der einzelnen Felder. Ohne Filter kommen alle. Nutze die Filter bei großen Plänen, sonst wird die Antwort lang.',
  schreibt: false,
  schema: {
    type: 'object',
    properties: {
      kategorie: {
        type: 'string',
        description:
          'Nur diese Kategorie: regale, kuehlung, tiefkuehlung, bedienung, obstgemuese, backwaren, kassen, aktion, ausstattung, eigene',
      },
      name: { type: 'string', description: 'Nur Elemente, deren Name diesen Text enthält.' },
      warengruppe: {
        type: 'string',
        description: 'Nur Elemente, bei denen dieser Text in einer Feldbeschriftung vorkommt.',
      },
      bereich: {
        type: 'object',
        description: 'Nur Elemente, deren Mittelpunkt in diesem Rechteck liegt (Zentimeter).',
        properties: {
          x1: { type: 'number' },
          y1: { type: 'number' },
          x2: { type: 'number' },
          y2: { type: 'number' },
        },
        required: ['x1', 'y1', 'x2', 'y2'],
      },
      nurAuswahl: { type: 'boolean', description: 'Nur die gerade ausgewählten Elemente.' },
    },
  },
  fuehreAus(eingabe, s) {
    let elemente = s.projekt.elemente;

    if (eingabe.nurAuswahl) elemente = elemente.filter((e) => s.auswahl.includes(e.id));
    if (eingabe.kategorie) elemente = elemente.filter((e) => e.kategorie === eingabe.kategorie);
    if (eingabe.name) {
      const suche = String(eingabe.name).toLowerCase();
      elemente = elemente.filter((e) => e.name.toLowerCase().includes(suche));
    }
    if (eingabe.warengruppe) {
      const suche = String(eingabe.warengruppe).toLowerCase();
      const trifft = (el: PlanElement) =>
        [...(el.warengruppenUnten ?? []), ...(el.warengruppenOben ?? [])].some((a) =>
          a.text.toLowerCase().includes(suche),
        ) ||
        (el.warengruppe ?? '').toLowerCase().includes(suche) ||
        Object.values(el.kopfgondeln ?? {}).some((t) => (t ?? '').toLowerCase().includes(suche));
      elemente = elemente.filter(trifft);
    }
    if (eingabe.bereich) {
      const b = eingabe.bereich;
      const links = Math.min(b.x1, b.x2);
      const rechts = Math.max(b.x1, b.x2);
      const oben = Math.min(b.y1, b.y2);
      const unten = Math.max(b.y1, b.y2);
      elemente = elemente.filter(
        (e) => e.x >= links && e.x <= rechts && e.y >= oben && e.y <= unten,
      );
    }

    if (elemente.length === 0) return 'Kein Element passt zu diesen Filtern.';
    return `${elemente.length} Elemente:\n` + elemente.map(elementzeile).join('\n');
  },
};

const VORLAGEN_SUCHEN: Werkzeug = {
  name: 'vorlagen_suchen',
  beschreibung:
    'Durchsucht die Möbelbibliothek. Liefert Vorlagen-Kennungen, die element_einfuegen braucht, mit ihren Standardmaßen. Immer erst suchen, nie eine Kennung raten.',
  schreibt: false,
  schema: {
    type: 'object',
    properties: {
      suche: { type: 'string', description: 'Text im Namen oder Hinweis der Vorlage.' },
      kategorie: { type: 'string', description: 'Nur diese Kategorie.' },
    },
  },
  fuehreAus(eingabe, s) {
    let liste: BibliothekEintrag[] = [...BIBLIOTHEK, ...s.eigeneVorlagen];
    if (eingabe.kategorie) liste = liste.filter((v) => v.kategorie === eingabe.kategorie);
    if (eingabe.suche) {
      const suche = String(eingabe.suche).toLowerCase();
      liste = liste.filter(
        (v) =>
          v.name.toLowerCase().includes(suche) ||
          (v.hinweis ?? '').toLowerCase().includes(suche) ||
          (v.gruppe ?? '').toLowerCase().includes(suche),
      );
    }
    if (liste.length === 0) return 'Keine Vorlage passt dazu.';

    const zeilen = liste
      .slice(0, 60)
      .map(
        (v) =>
          `${v.id} | "${v.name}" | ${v.kategorie} | B${v.breite} T${v.tiefe}` +
          (v.hoehe ? ` H${v.hoehe}` : '') +
          (v.beidseitig ? ' | beidseitig' : '') +
          (v.hinweis ? ` | ${v.hinweis}` : ''),
      );
    const rest = liste.length > 60 ? `\n… und ${liste.length - 60} weitere. Suche enger fassen.` : '';
    return `${liste.length} Vorlagen:\n` + zeilen.join('\n') + rest;
  },
};

const AUSWAEHLEN: Werkzeug = {
  name: 'auswaehlen',
  beschreibung:
    'Wählt Elemente im Plan aus, damit der Nutzer sieht, wovon die Rede ist. Nutze das, wenn du auf etwas hinweist, ohne es zu ändern.',
  schreibt: false,
  schema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' }, description: 'Leer lässt die Auswahl fallen.' },
    },
    required: ['ids'],
  },
  fuehreAus(eingabe, s) {
    const ids: string[] = Array.isArray(eingabe.ids) ? eingabe.ids : [];
    if (ids.length === 0) {
      s.hebeAuswahlAuf();
      return 'Auswahl aufgehoben.';
    }
    const echte = betroffene({ ids }, s).map((e) => e.id);
    zeige(echte, s);
    return `${echte.length} ausgewählt: ${echte.map(kurzeKennung).join(', ')}`;
  },
};

const ELEMENT_EINFUEGEN: Werkzeug = {
  name: 'element_einfuegen',
  beschreibung:
    'Setzt ein Möbel aus der Bibliothek in den Plan. Die Angabe x/y ist der Mittelpunkt in Zentimetern. Mit anzahl und abstand entsteht eine Reihe.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      vorlageId: { type: 'string', description: 'Kennung aus vorlagen_suchen.' },
      x: { type: 'number', description: 'Mittelpunkt waagerecht, in Zentimetern.' },
      y: { type: 'number', description: 'Mittelpunkt senkrecht, in Zentimetern.' },
      drehung: { type: 'number', description: 'Grad im Uhrzeigersinn. 0 = wie die Vorlage.' },
      anzahl: { type: 'number', description: 'Wie viele nebeneinander. Ohne Angabe: eines.' },
      richtung: {
        type: 'string',
        enum: ['rechts', 'unten'],
        description: 'Wohin die Reihe läuft. Ohne Angabe: rechts.',
      },
      abstand: {
        type: 'number',
        description: 'Abstand von Mitte zu Mitte. Ohne Angabe: lückenlos, also die Breite.',
      },
      name: { type: 'string', description: 'Abweichender Name.' },
    },
    required: ['vorlageId', 'x', 'y'],
  },
  fuehreAus(eingabe, s) {
    const vorlage = findeVorlage(String(eingabe.vorlageId), s.eigeneVorlagen);
    if (!vorlage) fehler(`Die Vorlage "${eingabe.vorlageId}" gibt es nicht. Erst vorlagen_suchen.`);

    const anzahl = Math.max(1, Math.min(Math.floor(Number(eingabe.anzahl) || 1), 60));
    const nachUnten = eingabe.richtung === 'unten';
    const schritt =
      eingabe.abstand !== undefined
        ? zahl(eingabe.abstand, 'abstand')
        : nachUnten
          ? vorlage.tiefe
          : vorlage.breite;

    const x = zahl(eingabe.x, 'x');
    const y = zahl(eingabe.y, 'y');
    const neue: string[] = [];

    for (let i = 0; i < anzahl; i += 1) {
      const id = s.fuegeElementHinzu(
        vorlage,
        nachUnten ? x : x + i * schritt,
        nachUnten ? y + i * schritt : y,
      );
      neue.push(id);
    }

    const werte: Record<string, unknown> = {};
    if (eingabe.drehung !== undefined) werte.drehung = zahl(eingabe.drehung, 'drehung');
    if (eingabe.name) werte.name = String(eingabe.name);
    if (Object.keys(werte).length > 0) s.aendereElemente(neue, werte);

    zeige(neue, s);
    return `${anzahl}× "${vorlage.name}" eingefügt: ${neue.map(kurzeKennung).join(', ')}`;
  },
};

/** Die Eigenschaften, die elemente_aendern durchreicht – und sonst keine. */
const AENDERBAR = [
  'name',
  'breite',
  'tiefe',
  'hoehe',
  'farbe',
  'beschriftung',
  'beschriftungSichtbar',
  'schriftgroesse',
  'warengruppe',
  'notiz',
  'hersteller',
  'gesperrt',
  'drehung',
  'beidseitig',
] as const;

const ELEMENTE_AENDERN: Werkzeug = {
  name: 'elemente_aendern',
  beschreibung:
    'Ändert Eigenschaften vorhandener Möbel. Ohne ids gilt die aktuelle Auswahl. Die Drehung ist hier absolut – zum Weiterdrehen elemente_drehen nehmen.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' } },
      name: { type: 'string' },
      breite: { type: 'number', description: 'Zentimeter.' },
      tiefe: { type: 'number', description: 'Zentimeter.' },
      hoehe: { type: 'number', description: 'Zentimeter.' },
      farbe: { type: 'string', description: 'Als #rrggbb.' },
      beschriftung: { type: 'string' },
      beschriftungSichtbar: { type: 'boolean' },
      schriftgroesse: { type: 'number' },
      warengruppe: {
        type: 'string',
        description: 'Warengruppe des ganzen Möbels. Für einzelne Meter warengruppe_setzen nehmen.',
      },
      notiz: { type: 'string' },
      hersteller: { type: 'string' },
      gesperrt: { type: 'boolean' },
      drehung: { type: 'number', description: 'Absolut, in Grad.' },
    },
  },
  fuehreAus(eingabe, s) {
    const elemente = betroffene(eingabe, s);
    const werte: Record<string, unknown> = {};
    for (const feld of AENDERBAR) {
      if (eingabe[feld] !== undefined) werte[feld] = eingabe[feld];
    }
    if (Object.keys(werte).length === 0) fehler('Es wurde keine Eigenschaft angegeben.');

    const ids = elemente.map((e) => e.id);
    s.aendereElemente(ids, werte);
    zeige(ids, s);
    return (
      `${elemente.length} geändert (${Object.keys(werte).join(', ')}): ${nenne(elemente)}.` +
      hinweisGesperrt(elemente)
    );
  },
};

const ELEMENTE_VERSCHIEBEN: Werkzeug = {
  name: 'elemente_verschieben',
  beschreibung:
    'Verschiebt Möbel. Entweder relativ (dx/dy) oder auf einen festen Punkt (x/y, dann rückt die Mitte der Auswahl dorthin). Zentimeter; x wächst nach rechts, y nach unten.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' } },
      dx: { type: 'number', description: 'Nach rechts, negativ nach links.' },
      dy: { type: 'number', description: 'Nach unten, negativ nach oben.' },
      x: { type: 'number', description: 'Zielmitte waagerecht.' },
      y: { type: 'number', description: 'Zielmitte senkrecht.' },
    },
  },
  fuehreAus(eingabe, s) {
    const elemente = betroffene(eingabe, s);
    const ids = elemente.map((e) => e.id);

    let dx = Number(eingabe.dx) || 0;
    let dy = Number(eingabe.dy) || 0;

    if (eingabe.x !== undefined || eingabe.y !== undefined) {
      const rahmen = gesamtUmgrenzung(elemente);
      if (!rahmen) fehler('Die Lage der Elemente ließ sich nicht bestimmen.');
      const mitteX = (rahmen.links + rahmen.rechts) / 2;
      const mitteY = (rahmen.oben + rahmen.unten) / 2;
      if (eingabe.x !== undefined) dx = zahl(eingabe.x, 'x') - mitteX;
      if (eingabe.y !== undefined) dy = zahl(eingabe.y, 'y') - mitteY;
    }

    if (dx === 0 && dy === 0) fehler('Es wurde keine Verschiebung angegeben.');

    zeige(ids, s);
    s.verschiebeAuswahl(dx, dy);
    return (
      `${elemente.length} um ${Math.round(dx)}/${Math.round(dy)} cm verschoben: ${nenne(elemente)}.` +
      hinweisGesperrt(elemente)
    );
  },
};

const ELEMENTE_DREHEN: Werkzeug = {
  name: 'elemente_drehen',
  beschreibung:
    'Dreht Möbel um den angegebenen Winkel weiter. Mehrere drehen sich gemeinsam um ihre gemeinsame Mitte, nicht jedes um sich selbst.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' } },
      grad: { type: 'number', description: 'Im Uhrzeigersinn. 90, 180, -90 sind die üblichen.' },
    },
    required: ['grad'],
  },
  fuehreAus(eingabe, s) {
    const elemente = betroffene(eingabe, s);
    const grad = zahl(eingabe.grad, 'grad');
    zeige(elemente.map((e) => e.id), s);
    s.dreheAuswahl(grad);
    return `${elemente.length} um ${grad}° gedreht: ${nenne(elemente)}.` + hinweisGesperrt(elemente);
  },
};

const ELEMENTE_LOESCHEN: Werkzeug = {
  name: 'elemente_loeschen',
  beschreibung: 'Entfernt Möbel aus dem Plan.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: { ids: { type: 'array', items: { type: 'string' } } },
  },
  fuehreAus(eingabe, s) {
    const elemente = betroffene(eingabe, s);
    const beschreibung = nenne(elemente);
    zeige(elemente.map((e) => e.id), s);
    s.loescheAuswahl();
    return `${elemente.length} gelöscht: ${beschreibung}.` + hinweisGesperrt(elemente);
  },
};

const ELEMENTE_DUPLIZIEREN: Werkzeug = {
  name: 'elemente_duplizieren',
  beschreibung:
    'Legt Kopien der Möbel an, leicht versetzt. Die Kopien sind danach ausgewählt und lassen sich mit elemente_verschieben an ihren Platz setzen.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: { ids: { type: 'array', items: { type: 'string' } } },
  },
  fuehreAus(eingabe, s) {
    const elemente = betroffene(eingabe, s);
    zeige(elemente.map((e) => e.id), s);
    s.dupliziereAuswahl();
    const neue = laden().auswahl;
    return `${neue.length} Kopien angelegt: ${neue.map(kurzeKennung).join(', ')}`;
  },
};

const ELEMENTE_ANORDNEN: Werkzeug = {
  name: 'elemente_anordnen',
  beschreibung:
    'Bringt mehrere Möbel in Ordnung: bündig ausrichten, gleichmäßig verteilen oder lückenlos aneinanderschieben.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' } },
      art: {
        type: 'string',
        enum: [
          'links',
          'rechts',
          'oben',
          'unten',
          'mitteWaagerecht',
          'mitteSenkrecht',
          'verteilenWaagerecht',
          'verteilenSenkrecht',
          'aneinander',
        ],
      },
    },
    required: ['art'],
  },
  fuehreAus(eingabe, s) {
    const elemente = betroffene(eingabe, s);
    if (elemente.length < 2) fehler('Zum Anordnen braucht es mindestens zwei Elemente.');
    zeige(elemente.map((e) => e.id), s);

    const art = String(eingabe.art);
    if (art === 'verteilenWaagerecht') s.verteileGleichmaessig('waagerecht');
    else if (art === 'verteilenSenkrecht') s.verteileGleichmaessig('senkrecht');
    else if (art === 'aneinander') s.reiheAneinanderAus();
    else s.richteAus(art as Ausrichtung);

    return `${elemente.length} angeordnet (${art}): ${nenne(elemente)}.` + hinweisGesperrt(elemente);
  },
};

const ELEMENTE_GRUPPIEREN: Werkzeug = {
  name: 'elemente_gruppieren',
  beschreibung:
    'Fasst Möbel zu einer Einheit zusammen (Zug, Gondel oder frei) oder löst sie wieder auf. Ein Zug ist eine Regalreihe, eine Gondel eine beidseitig bestückte Insel.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' } },
      art: { type: 'string', enum: ['zug', 'gondel', 'frei', 'aufloesen'] },
    },
    required: ['art'],
  },
  fuehreAus(eingabe, s) {
    const elemente = betroffene(eingabe, s);
    zeige(elemente.map((e) => e.id), s);
    if (eingabe.art === 'aufloesen') {
      s.hebeGruppeAuf();
      return `Gruppierung aufgehoben für ${elemente.length} Elemente.`;
    }
    s.gruppiere(eingabe.art as 'zug' | 'gondel' | 'frei');
    return `${elemente.length} als ${eingabe.art} gruppiert: ${nenne(elemente)}.`;
  },
};

/* -------------------------------------------------------- Warengruppen */

const WARENGRUPPE_SETZEN: Werkzeug = {
  name: 'warengruppe_setzen',
  beschreibung:
    'Schreibt eine Warengruppe auf eine Strecke eines Möbels. Gemessen wird in Metern ab dem Anfang des Möbels – eine Grenze darf mitten durch ein Feld laufen. Was auf der Strecke stand, weicht. Ein leerer Text löscht.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Kennung des Möbels.' },
      seite: {
        type: 'string',
        enum: ['unten', 'oben'],
        description:
          'Bei beidseitigen Gondeln die Seite. Einseitige Möbel haben nur "unten". Ohne Angabe: unten.',
      },
      von: { type: 'number', description: 'Anfang in Metern ab dem Anfang des Möbels.' },
      bis: { type: 'number', description: 'Ende in Metern.' },
      text: { type: 'string', description: 'Der Name. Leer löscht die Strecke.' },
    },
    required: ['id', 'von', 'bis', 'text'],
  },
  fuehreAus(eingabe, s) {
    const el = einElement(eingabe.id, s);
    const seite = seiteVon(el, eingabe.seite);
    const gesamt = seitenbreite(felderVon(el, seite));
    if (gesamt <= 0) fehler(`"${el.name}" hat keine Strecke zum Beschriften.`);

    // Der Assistent rechnet in Metern, gespeichert wird in Zentimetern.
    const von = zahl(eingabe.von, 'von') * 100;
    const bis = zahl(eingabe.bis, 'bis') * 100;
    if (Math.min(von, bis) < -1 || Math.max(von, bis) > gesamt + 1) {
      fehler(
        `Die Strecke ${eingabe.von}–${eingabe.bis} m liegt nicht auf "${el.name}" – ` +
          `das Möbel ist ${(gesamt / 100).toFixed(2)} m lang.`,
      );
    }

    const text = String(eingabe.text ?? '').trim();
    s.setzeWarengruppen(
      el.id,
      seite,
      mitAbschnitt(warengruppenVon(el, seite), gesamt, { von, bis, text }),
    );
    zeige([el.id], s);

    const strecke = `${(Math.min(von, bis) / 100).toFixed(2)}–${(Math.max(von, bis) / 100).toFixed(2)} m`;
    return text
      ? `"${text}" steht jetzt an "${el.name}" (${seite}, ${strecke}).`
      : `Die Strecke ${strecke} an "${el.name}" (${seite}) ist jetzt frei.`;
  },
};

const FELDER_SETZEN: Werkzeug = {
  name: 'felder_setzen',
  beschreibung:
    'Teilt ein Möbel in Felder ein oder markiert einzelne als leer. Die Breiten sind Zentimeter und ergeben zusammen die Breite des Möbels.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      seite: { type: 'string', enum: ['unten', 'oben'] },
      breiten: {
        type: 'array',
        items: { type: 'number' },
        description: 'Eine Zahl je Feld, in Zentimetern.',
      },
      leer: {
        type: 'array',
        items: { type: 'number' },
        description: 'Feldnummern (ab 1), die als leer gelten sollen.',
      },
    },
    required: ['id'],
  },
  fuehreAus(eingabe, s) {
    const el = einElement(eingabe.id, s);
    const seite = seiteVon(el, eingabe.seite);
    const bisher = felderVon(el, seite);

    let neue = bisher.map((f) => ({ ...f }));
    if (Array.isArray(eingabe.breiten) && eingabe.breiten.length > 0) {
      neue = eingabe.breiten.map((b: unknown, i: number) => ({
        ...(bisher[i] ?? {}),
        breite: zahl(b, `breiten[${i}]`),
      }));
    }
    if (Array.isArray(eingabe.leer)) {
      const menge = new Set(eingabe.leer.map((n: unknown) => Math.floor(Number(n))));
      neue = neue.map((f, i) => ({ ...f, leer: menge.has(i + 1) ? true : undefined }));
    }
    if (neue.length === 0) fehler('Es wurde keine Einteilung angegeben.');

    s.setzeSeitenfelder(el.id, seite, neue);
    zeige([el.id], s);
    const nachher = laden().projekt.elemente.find((e) => e.id === el.id);
    const jetzt = (seite === 'oben' ? nachher?.felderOben : nachher?.felderUnten) ?? [];
    return `"${el.name}" (${seite}) hat jetzt ${jetzt.length} Felder: ${jetzt
      .map((f) => Math.round(f.breite) + (f.leer ? ' (leer)' : ''))
      .join(', ')}`;
  },
};

const KOPFGONDEL_SETZEN: Werkzeug = {
  name: 'kopfgondel_setzen',
  beschreibung:
    'Setzt eine Kopfgondel an ein Regal oder nimmt sie weg, und beschriftet sie. Anfang und Ende beziehen sich auf die Längsachse des Möbels.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      seite: { type: 'string', enum: ['anfang', 'ende'] },
      an: { type: 'boolean', description: 'false nimmt sie weg.' },
      text: { type: 'string', description: 'Beschriftung der Kopfgondel.' },
    },
    required: ['id', 'seite'],
  },
  fuehreAus(eingabe, s) {
    const el = einElement(eingabe.id, s);
    const seite = eingabe.seite === 'anfang' ? 'anfang' : 'ende';

    if (eingabe.an !== undefined) s.setzeKopfgondel(el.id, seite, !!eingabe.an);
    if (eingabe.text !== undefined) {
      const jetzt = laden().projekt.elemente.find((e) => e.id === el.id);
      s.aendereElemente([el.id], {
        kopfgondeln: { ...(jetzt?.kopfgondeln ?? {}), [seite]: String(eingabe.text) },
      });
    }

    zeige([el.id], s);
    const nachher = laden().projekt.elemente.find((e) => e.id === el.id);
    const wert = nachher?.kopfgondeln?.[seite];
    return wert === undefined
      ? `An "${el.name}" ist am ${seite} keine Kopfgondel.`
      : `Kopfgondel am ${seite} von "${el.name}": "${wert}"`;
  },
};

/* ----------------------------------------------------------- Sortiment */

const SORTIMENT_LESEN: Werkzeug = {
  name: 'sortiment_lesen',
  beschreibung:
    'Zeigt die Sortimentsliste des Marktes mit ihrem Stand: grün steht im Markt, grau ist hier nicht vorgesehen, rot ist offen. Damit lässt sich beantworten, was noch fehlt.',
  schreibt: false,
  schema: {
    type: 'object',
    properties: {
      abteilung: { type: 'string', description: 'Nur diese Abteilung.' },
      nurOffene: { type: 'boolean', description: 'Nur, was noch nicht steht.' },
    },
  },
  fuehreAus(eingabe, s) {
    const stand = s.projekt.sortimentsstand;
    const zeilen: string[] = [];

    for (const abt of s.sortiment.abteilungen) {
      if (eingabe.abteilung && abt.name !== eingabe.abteilung) continue;
      const az = abteilungsstand(stand, abt);
      zeilen.push(
        `# ${abt.name} — ${az.zahlen.gruen} grün / ${az.zahlen.offen} offen (${az.zahlen.grau} grau)`,
      );

      for (const gr of abt.warengruppen) {
        const gz = gruppenstand(stand, abt.name, gr);
        if (eingabe.nurOffene && gz.wert !== 'rot') continue;
        zeilen.push(`  - ${gr.name} [${gz.wert}]`);

        for (const sort of gr.sortimente) {
          const w = standVon(stand, pfadVon(abt.name, gr.name, sort));
          if (eingabe.nurOffene && w !== 'rot') continue;
          zeilen.push(`      ${sort} [${w}]`);
        }
      }
    }

    if (zeilen.length === 0) {
      return s.sortiment.abteilungen.length === 0
        ? 'Es ist keine Sortimentsliste geladen.'
        : 'Dazu gibt es keine Einträge.';
    }
    return zeilen.join('\n');
  },
};

const SORTIMENT_ABHAKEN: Werkzeug = {
  name: 'sortiment_abhaken',
  beschreibung:
    'Setzt einen Eintrag der Sortimentsliste auf grün (steht), grau (hier nicht vorgesehen) oder rot (offen). Wirkt auf alles darunter.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      abteilung: { type: 'string' },
      warengruppe: { type: 'string', description: 'Weglassen, um die ganze Abteilung zu setzen.' },
      sortiment: { type: 'string', description: 'Weglassen, um die ganze Warengruppe zu setzen.' },
      wert: { type: 'string', enum: ['gruen', 'grau', 'rot'] },
    },
    required: ['abteilung', 'wert'],
  },
  fuehreAus(eingabe, s) {
    const abt = s.sortiment.abteilungen.find((a) => a.name === eingabe.abteilung);
    if (!abt) fehler(`Die Abteilung "${eingabe.abteilung}" gibt es nicht.`);
    if (eingabe.warengruppe && !abt.warengruppen.some((g) => g.name === eingabe.warengruppe)) {
      fehler(`In "${abt.name}" gibt es keine Warengruppe "${eingabe.warengruppe}".`);
    }

    // `pfadVon` nimmt nur Zeichenketten; eine ausgelassene Stufe faellt weg,
    // statt als "undefined" im Pfad zu landen.
    const stufen = [String(eingabe.abteilung)];
    if (eingabe.warengruppe) stufen.push(String(eingabe.warengruppe));
    if (eingabe.sortiment) stufen.push(String(eingabe.sortiment));
    const pfad = pfadVon(...stufen);
    s.setzeSortimentsstand(pfad, eingabe.wert as Standwert);
    return `"${pfad}" steht jetzt auf ${eingabe.wert}.`;
  },
};

/* ---------------------------------------------------------------- Bau */

const RAUM_ANLEGEN: Werkzeug = {
  name: 'raum_anlegen',
  beschreibung:
    'Legt einen Raum an – Lager, Kühlung, Sozialraum, Technik. Der Umriss ist eine Liste von Eckpunkten in Zentimetern.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      umriss: {
        type: 'array',
        items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
      },
      art: { type: 'string', enum: ['verkauf', 'lager', 'kuehlung', 'sozial', 'technik', 'sonstige'] },
      name: { type: 'string' },
    },
    required: ['umriss'],
  },
  fuehreAus(eingabe, s) {
    const umriss = punkte(eingabe.umriss, 'umriss');
    const id = s.fuegeRaumHinzu(umriss, (eingabe.art as any) ?? 'lager');
    if (eingabe.name) s.aendereRaum(id, { name: String(eingabe.name) });
    return `Raum ${id} angelegt (${umriss.length} Ecken).`;
  },
};

const WAND_ZIEHEN: Werkzeug = {
  name: 'wand_ziehen',
  beschreibung: 'Zieht eine freistehende Wand von einem Punkt zum anderen.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      vonX: { type: 'number' },
      vonY: { type: 'number' },
      bisX: { type: 'number' },
      bisY: { type: 'number' },
      staerke: { type: 'number', description: 'Zentimeter. Ohne Angabe: 12.' },
    },
    required: ['vonX', 'vonY', 'bisX', 'bisY'],
  },
  fuehreAus(eingabe, s) {
    const id = s.fuegeWandHinzu(
      { x: zahl(eingabe.vonX, 'vonX'), y: zahl(eingabe.vonY, 'vonY') },
      { x: zahl(eingabe.bisX, 'bisX'), y: zahl(eingabe.bisY, 'bisY') },
      eingabe.staerke === undefined ? undefined : zahl(eingabe.staerke, 'staerke'),
    );
    return `Wand ${id} gezogen.`;
  },
};

const MASSLINIE_ZIEHEN: Werkzeug = {
  name: 'masslinie_ziehen',
  beschreibung: 'Zieht eine Maßlinie zwischen zwei Punkten. Das Maß rechnet der Plan selbst aus.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      vonX: { type: 'number' },
      vonY: { type: 'number' },
      bisX: { type: 'number' },
      bisY: { type: 'number' },
      text: { type: 'string', description: 'Eigener Text statt des gerechneten Maßes.' },
    },
    required: ['vonX', 'vonY', 'bisX', 'bisY'],
  },
  fuehreAus(eingabe, s) {
    const id = s.fuegeMasslinieHinzu(
      { x: zahl(eingabe.vonX, 'vonX'), y: zahl(eingabe.vonY, 'vonY') },
      { x: zahl(eingabe.bisX, 'bisX'), y: zahl(eingabe.bisY, 'bisY') },
    );
    if (eingabe.text) s.aendereMasslinie(id, { text: String(eingabe.text) });
    return `Maßlinie ${id} gezogen.`;
  },
};

const PROJEKT_EINSTELLEN: Werkzeug = {
  name: 'projekt_einstellen',
  beschreibung: 'Ändert Name und Anzeigeeinstellungen der Planung.',
  schreibt: true,
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      anzeigeEinheit: { type: 'string', enum: ['m', 'cm'] },
      rasterWeite: { type: 'number', description: 'Zentimeter.' },
      amRasterEinrasten: { type: 'boolean' },
      rasterSichtbar: { type: 'boolean' },
      masseAnzeigen: { type: 'boolean' },
    },
  },
  fuehreAus(eingabe, s) {
    const getan: string[] = [];
    if (eingabe.name) {
      s.benenneProjektUm(String(eingabe.name));
      getan.push(`Name "${eingabe.name}"`);
    }
    const werte: Record<string, unknown> = {};
    for (const feld of ['anzeigeEinheit', 'rasterWeite', 'amRasterEinrasten', 'rasterSichtbar', 'masseAnzeigen']) {
      if (eingabe[feld] !== undefined) werte[feld] = eingabe[feld];
    }
    if (Object.keys(werte).length > 0) {
      s.setzeEinstellung(werte);
      getan.push(...Object.entries(werte).map(([k, v]) => `${k}=${v}`));
    }
    if (getan.length === 0) fehler('Es wurde nichts zum Einstellen angegeben.');
    return `Geändert: ${getan.join(', ')}.`;
  },
};

const ANSICHT_ZEIGEN: Werkzeug = {
  name: 'ansicht_zeigen',
  beschreibung:
    'Rückt einen Bereich des Plans ins Bild, damit der Nutzer sieht, worum es geht. Ohne Angaben wird auf die ausgewählten Elemente gezoomt.',
  schreibt: false,
  schema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' }, description: 'Auf diese Elemente zoomen.' },
      zoom: { type: 'number', description: 'Vergrößerung, 0.02 bis 4. 1 ist Originalgröße.' },
    },
  },
  fuehreAus(eingabe, s) {
    const roh: string[] = Array.isArray(eingabe.ids) && eingabe.ids.length > 0 ? eingabe.ids : s.auswahl;
    const elemente = roh
      .map((id) => findeElement(String(id), s.projekt.elemente))
      .filter((e): e is PlanElement => !!e && e !== 'mehrdeutig');
    const ids = elemente.map((e) => e.id);
    if (elemente.length === 0) {
      if (eingabe.zoom !== undefined) {
        s.setzeAnsicht({ zoom: Math.min(4, Math.max(0.02, zahl(eingabe.zoom, 'zoom'))) });
        return `Vergrößerung auf ${eingabe.zoom} gestellt.`;
      }
      fehler('Es wurde nichts angegeben, worauf zu zoomen wäre.');
    }

    const rahmen = gesamtUmgrenzung(elemente);
    if (!rahmen) fehler('Die Lage ließ sich nicht bestimmen.');

    // Grob mittig ins Fenster: Der genaue Ausschnitt hängt von der Fenster-
    // groesse ab, die hier niemand kennt – gemessen wird er in der Anzeige.
    const breite = rahmen.rechts - rahmen.links;
    const hoehe = rahmen.unten - rahmen.oben;
    const zoom =
      eingabe.zoom !== undefined
        ? Math.min(4, Math.max(0.02, zahl(eingabe.zoom, 'zoom')))
        : Math.min(1.5, Math.max(0.05, 700 / Math.max(breite, hoehe, 1)));

    s.setzeAnsicht({
      zoom,
      x: 400 - (rahmen.links + breite / 2) * zoom,
      y: 300 - (rahmen.oben + hoehe / 2) * zoom,
    });
    zeige(ids, s);
    return `Ansicht auf ${elemente.length} Element(e) gerückt.`;
  },
};

/* ------------------------------------------------------------- Register */

export const WERKZEUGE: Werkzeug[] = [
  PLAN_LESEN,
  VORLAGEN_SUCHEN,
  AUSWAEHLEN,
  ANSICHT_ZEIGEN,
  ELEMENT_EINFUEGEN,
  ELEMENTE_AENDERN,
  ELEMENTE_VERSCHIEBEN,
  ELEMENTE_DREHEN,
  ELEMENTE_LOESCHEN,
  ELEMENTE_DUPLIZIEREN,
  ELEMENTE_ANORDNEN,
  ELEMENTE_GRUPPIEREN,
  WARENGRUPPE_SETZEN,
  FELDER_SETZEN,
  KOPFGONDEL_SETZEN,
  SORTIMENT_LESEN,
  SORTIMENT_ABHAKEN,
  RAUM_ANLEGEN,
  WAND_ZIEHEN,
  MASSLINIE_ZIEHEN,
  PROJEKT_EINSTELLEN,
];

/** Die Werkzeugliste in der Form, die die API erwartet. */
export function werkzeugliste(): { name: string; description: string; input_schema: unknown }[] {
  return WERKZEUGE.map((w) => ({
    name: w.name,
    description: w.beschreibung,
    input_schema: w.schema,
  }));
}

export interface Ergebnis {
  text: string;
  fehlgeschlagen: boolean;
}

/**
 * Führt einen Werkzeugaufruf aus.
 *
 * Fehler werden **nicht** geworfen, sondern als Text zurückgegeben: Das Modell
 * soll sie lesen und es anders versuchen können. Ein geworfener Fehler risse
 * stattdessen das ganze Gespräch ab, und der Nutzer stünde vor einem halb
 * umgebauten Markt ohne Erklärung.
 */
export function fuehreWerkzeugAus(name: string, eingabe: Record<string, unknown>): Ergebnis {
  const werkzeug = WERKZEUGE.find((w) => w.name === name);
  if (!werkzeug) {
    return { text: `Das Werkzeug "${name}" gibt es nicht.`, fehlgeschlagen: true };
  }
  try {
    return { text: werkzeug.fuehreAus(eingabe ?? {}, laden()), fehlgeschlagen: false };
  } catch (fehler) {
    if (fehler instanceof Abbruch) return { text: fehler.message, fehlgeschlagen: true };
    console.error('Marktplaner: Werkzeug', name, 'ist gestolpert', fehler);
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { text: `Der Aufruf ist fehlgeschlagen: ${grund}`, fehlgeschlagen: true };
  }
}

/** Ob ein Aufruf den Plan verändert – für die Historienklammer und die Anzeige. */
export function schreibendesWerkzeug(name: string): boolean {
  return WERKZEUGE.find((w) => w.name === name)?.schreibt ?? false;
}

/** Namen aus der Sortimentsliste, damit der Prompt sie kennt. */
export function bekannteWarengruppen(): string[] {
  return alleNamen(laden().sortiment);
}
