import { holeAssistentZugang, holeGeraetekennung } from '../speicher/projektArchiv';
import { usePlanStore } from '../zustand/planStore';
import { ueberblick } from './planbild';
import { fuehreWerkzeugAus, werkzeugliste } from './werkzeuge';

/**
 * Das Gespräch mit dem Assistenten.
 *
 * Die Schleife läuft **hier im Browser** und nicht im Worker, und zwar weil
 * die Werkzeuge hier greifen müssen: Der Plan liegt im Store, nicht auf dem
 * Server. Der Worker sieht nur Nachrichten hin und Nachrichten her.
 *
 *   Frage → API → Werkzeugaufrufe → ausführen → Ergebnisse → API → …
 *
 * bis die API keine Werkzeuge mehr will. Erst dann steht die Antwort.
 */

/** Modelle, die der Worker durchlässt. */
export const MODELLE = [
  { id: 'claude-sonnet-5', name: 'Sonnet', hinweis: 'schnell, für den Alltag' },
  { id: 'claude-opus-5', name: 'Opus', hinweis: 'gründlicher, langsamer' },
] as const;

export type ModellId = (typeof MODELLE)[number]['id'];

/**
 * Wie viele Runden Werkzeuge höchstens laufen.
 *
 * Ein Umbau über zwanzig Möbel braucht leicht ein Dutzend Runden. Die Grenze
 * ist deshalb hoch – sie ist eine Notbremse gegen eine Schleife, die sich
 * verrannt hat, und keine Sparmaßnahme.
 */
const MAX_RUNDEN = 24;

export interface Tat {
  werkzeug: string;
  eingabe: Record<string, unknown>;
  ergebnis: string;
  fehlgeschlagen: boolean;
}

export interface Beitrag {
  rolle: 'nutzer' | 'assistent';
  text: string;
  /** Was der Assistent in dieser Runde getan hat. Nur bei `assistent`. */
  taten?: Tat[];
  /** Steht statt einer Antwort da, wenn etwas schiefging. */
  fehler?: string;
}

/** Rohform einer Nachricht, so wie die API sie sehen will. */
interface ApiNachricht {
  role: 'user' | 'assistant';
  content: unknown;
}

interface ApiBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/* ------------------------------------------------------------ Der Auftrag */

/**
 * Wer der Assistent ist und wie er sich verhält.
 *
 * Die wichtigste Zeile ist die über das Nachfragen: Ein Assistent, der jeden
 * Schritt bestätigen lässt, ist langsamer als es selbst zu tun. Möglich wird
 * das durch die Historienklammer – eine ganze Runde ist **ein** Strg+Z.
 */
function auftrag(): string {
  return [
    'Du bist der Assistent im Marktplaner, einem Programm zur Planung von',
    'Ladenlayouts für einen EDEKA-Markt. Du sprichst Deutsch.',
    '',
    'Du hast über deine Werkzeuge denselben Zugriff wie der Nutzer selbst:',
    'Du kannst Möbel einsetzen, verschieben, drehen, löschen, beschriften,',
    'Warengruppen zuordnen, Räume und Wände anlegen und die Sortimentsliste',
    'pflegen.',
    '',
    '# Wie du arbeitest',
    '',
    '- **Handle, statt zu fragen.** Der Nutzer erteilt einen Auftrag, du führst',
    '  ihn aus. Eine ganze Runde lässt sich mit einem Strg+Z zurücknehmen, ein',
    '  Fehlgriff kostet ihn also nichts. Frage nur nach, wenn der Auftrag',
    '  wirklich mehrdeutig ist und die Lesarten zu ganz verschiedenen Plänen',
    '  führen.',
    '- **Sieh nach, bevor du handelst.** Kennungen werden nie geraten: Möbel',
    '  über `plan_lesen`, Vorlagen über `vorlagen_suchen`.',
    '- **Arbeite zu Ende.** Betrifft ein Auftrag zwölf Regale, fasse alle zwölf',
    '  an und nicht drei als Beispiel.',
    '- **Melde ehrlich.** Was nicht geklappt hat, sagst du. Ein Werkzeug, das',
    '  einen Fehler zurückgibt, hat nichts getan.',
    '',
    '# Der Plan',
    '',
    '- Alle Maße sind **Zentimeter**. x wächst nach rechts, y nach **unten**.',
    '  „Weiter oben" heißt also kleineres y.',
    '- Ein Möbel wird über seinen **Mittelpunkt** gesetzt, nicht über die Ecke.',
    '- Eine Gondel ist **ein** Element mit mehreren Feldern – nicht sechs',
    '  Elemente. Die Felder sind die einzelnen Meter und werden je Seite ab 1',
    '  gezählt. Beidseitige Möbel haben „unten" und „oben", einseitige nur',
    '  „unten".',
    '- Warengruppen stehen in den Feldern. Über mehrere Meter steht ein Name',
    '  einmal mit einer Klammer darunter – dafür `warengruppe_setzen` mit',
    '  `vonFeld` und `bisFeld`, nicht denselben Namen mehrfach.',
    '',
    '# Deine Antwort',
    '',
    'Kurz und sachlich, in ganzen Sätzen. Sag, was du getan hast, nicht was du',
    'gleich tun wirst – wenn du antwortest, ist es bereits getan. Keine',
    'Aufzählung deiner Werkzeugaufrufe: Die sieht der Nutzer ohnehin.',
  ].join('\n');
}

/* -------------------------------------------------------------- Der Worker */

export class AssistentFehler extends Error {}

interface Antwort {
  inhalt: ApiBlock[];
  stopGrund: string | null;
  kontingent?: { verbraucht: number; grenze: number };
  verbrauch?: Record<string, number>;
}

async function frage(
  nachrichten: ApiNachricht[],
  modell: ModellId,
  abbruch: AbortSignal,
): Promise<Antwort> {
  const zugang = await holeAssistentZugang();
  if (!zugang) {
    throw new AssistentFehler(
      'Der Assistent ist noch nicht eingerichtet. Adresse und Zugangswort stehen unter „Assistent einrichten".',
    );
  }
  const geraet = await holeGeraetekennung();

  const s = usePlanStore.getState();

  let ergebnis: Response;
  try {
    ergebnis = await fetch(zugang.adresse.replace(/\/+$/, '') + '/frage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abbruch,
      body: JSON.stringify({
        zugang: zugang.wort,
        geraet,
        modell,
        // Zwei Blöcke: Der Auftrag ist immer derselbe und wird darum
        // zwischengespeichert; der Stand des Plans ändert sich ständig und
        // steht deshalb dahinter.
        system: [
          { type: 'text', text: auftrag(), cache_control: { type: 'ephemeral' } },
          { type: 'text', text: 'Stand der Planung:\n' + ueberblick(s.projekt, s.auswahl) },
        ],
        nachrichten,
        werkzeuge: werkzeugliste(),
      }),
    });
  } catch (fehler) {
    if (fehler instanceof DOMException && fehler.name === 'AbortError') throw fehler;
    throw new AssistentFehler(
      'Der Assistent ist nicht erreichbar. Steht die Adresse richtig, und läuft der Worker?',
    );
  }

  if (!ergebnis.ok) {
    const daten = await ergebnis.json().catch(() => ({}) as { fehler?: string });
    throw new AssistentFehler(daten.fehler ?? `Der Worker antwortete mit ${ergebnis.status}.`);
  }

  return (await ergebnis.json()) as Antwort;
}

/* ------------------------------------------------------------- Die Schleife */

export interface Lauf {
  text: string;
  taten: Tat[];
  kontingent?: { verbraucht: number; grenze: number };
}

/**
 * Führt eine Runde: Frage hinein, fertige Antwort heraus.
 *
 * `melde` wird nach jedem Werkzeug gerufen, damit die Oberfläche mitläuft,
 * statt still dazustehen, während sich der Plan unter den Augen des Nutzers
 * verändert.
 */
export async function stelleFrage(
  verlauf: Beitrag[],
  frageText: string,
  modell: ModellId,
  melde: (taten: Tat[]) => void,
  abbruch: AbortSignal,
): Promise<Lauf> {
  const nachrichten: ApiNachricht[] = verlaufAlsNachrichten(verlauf);
  nachrichten.push({ role: 'user', content: frageText });

  const taten: Tat[] = [];
  let kontingent: Lauf['kontingent'];
  let text = '';

  // Eine ganze Runde ist **ein** Strg+Z. Sie fasst oft ein Dutzend Handgriffe;
  // wer sie zurücknehmen will, meint sie als Ganzes und nicht den letzten
  // Handgriff daraus. Die Klammer trägt faul ein – eine Runde, die nur eine
  // Frage beantwortet, legt gar keinen Schritt an.
  usePlanStore.getState().oeffneKlammer();
  try {
    return await schleife();
  } finally {
    usePlanStore.getState().schliesseKlammer();
  }

  async function schleife(): Promise<Lauf> {
  for (let runde = 0; runde < MAX_RUNDEN; runde += 1) {
    const antwort = await frage(nachrichten, modell, abbruch);
    kontingent = antwort.kontingent ?? kontingent;

    const bloecke = antwort.inhalt ?? [];
    text = bloecke
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')
      .trim();

    const aufrufe = bloecke.filter((b) => b.type === 'tool_use' && b.name && b.id);
    if (aufrufe.length === 0) return { text, taten, kontingent };

    // Die Antwort des Modells muss unverändert zurück in den Verlauf, sonst
    // findet der nächste Aufruf seine tool_use-Kennungen nicht wieder.
    nachrichten.push({ role: 'assistant', content: bloecke });

    const ergebnisse = aufrufe.map((aufruf) => {
      const eingabe = (aufruf.input ?? {}) as Record<string, unknown>;
      const { text: ergebnis, fehlgeschlagen } = fuehreWerkzeugAus(aufruf.name as string, eingabe);
      taten.push({ werkzeug: aufruf.name as string, eingabe, ergebnis, fehlgeschlagen });
      return {
        type: 'tool_result' as const,
        tool_use_id: aufruf.id as string,
        content: ergebnis,
        ...(fehlgeschlagen ? { is_error: true } : {}),
      };
    });

    melde([...taten]);
    nachrichten.push({ role: 'user', content: ergebnisse });

    if (abbruch.aborted) throw new DOMException('Abgebrochen', 'AbortError');
  }

  return {
    text:
      text ||
      'Ich bin nach vielen Schritten noch nicht fertig geworden und habe hier abgebrochen. Sieh dir an, was schon geschehen ist – mit Strg+Z lässt es sich zurücknehmen.',
    taten,
    kontingent,
  };
  }
}

/**
 * Der bisherige Verlauf für die API.
 *
 * Die Werkzeugaufrufe früherer Runden bleiben draußen: Sie blähen den Verlauf
 * auf, und was sie bewirkt haben, steht ohnehin im Plan, den der Assistent bei
 * jeder Frage neu vorgelegt bekommt.
 */
function verlaufAlsNachrichten(verlauf: Beitrag[]): ApiNachricht[] {
  return verlauf
    .filter((b) => !b.fehler && b.text.trim().length > 0)
    .map((b) => ({
      role: b.rolle === 'nutzer' ? ('user' as const) : ('assistant' as const),
      content: b.text,
    }));
}

/** Prüft, ob unter der Adresse wirklich der Assistenten-Worker läuft. */
export async function pruefeZugang(
  adresse: string,
): Promise<{ gut: boolean; meldung: string }> {
  let ergebnis: Response;
  try {
    ergebnis = await fetch(adresse.replace(/\/+$/, '') + '/');
  } catch {
    return { gut: false, meldung: 'Unter dieser Adresse antwortet nichts.' };
  }
  if (!ergebnis.ok) {
    return { gut: false, meldung: `Der Server antwortete mit ${ergebnis.status}.` };
  }

  const daten = (await ergebnis.json().catch(() => null)) as {
    dienst?: string;
    schluessel?: boolean;
    zugang?: boolean;
    ablage?: boolean;
    herkunftOk?: boolean | null;
  } | null;

  if (daten?.dienst !== 'marktplaner-assistent') {
    return { gut: false, meldung: 'Unter dieser Adresse läuft etwas anderes.' };
  }
  if (!daten.schluessel) return { gut: false, meldung: 'Am Worker fehlt der ANTHROPIC_API_KEY.' };
  if (!daten.zugang) return { gut: false, meldung: 'Am Worker fehlt das ASSISTENT_ZUGANG.' };
  if (!daten.ablage) {
    return { gut: false, meldung: 'Am Worker fehlt der KV-Namensraum MARKTPLANER.' };
  }
  // `false` heißt: Der Worker läuft, würde diese Seite aber abweisen. Ohne
  // diese Prüfung meldete das Einrichten „bereit", und erst die erste Frage
  // liefe in ein nacktes „Nicht erlaubt".
  if (daten.herkunftOk === false) {
    return {
      gut: false,
      meldung: `Der Worker weist diese Seite ab. Trag unter ERLAUBTE_HERKUNFT genau ${window.location.origin} ein.`,
    };
  }
  return { gut: true, meldung: 'Der Worker ist bereit.' };
}
