/**
 * Marktplaner – Vermittlungsprogramm für den Assistenten.
 *
 * Läuft als Cloudflare Worker auf der kostenlosen Stufe.
 *
 * Seine einzige Aufgabe ist, den Schlüssel zu halten. Die App darf ihn nicht
 * kennen: Sie liegt öffentlich auf GitHub Pages, und was im Browser steht,
 * kann jeder auslesen, der sich für die Seite interessiert. Hier liegt er als
 * Secret bei Cloudflare und geht nur an api.anthropic.com.
 *
 * Was der Assistent kann und wie er denkt, steht **nicht** hier, sondern in
 * der App (`src/assistent/`). Dieses Programm reicht durch. Der Grund ist
 * praktischer Natur: Die Werkzeuge ändern sich mit dem Marktplaner, und wer
 * sie hier pflegen müsste, müsste den Worker bei jeder Kleinigkeit neu
 * einfügen.
 *
 * Drei Riegel schützen den Schlüssel davor, auf fremde Rechnung verbraucht
 * zu werden:
 *
 *   1. Herkunft – nur die eigene Seite und localhost dürfen fragen.
 *   2. Zugangswort – ein Geheimnis, das nur in deinem Browser steht.
 *   3. Tageslimit – falls die ersten beiden doch fallen, ist der Schaden
 *      auf einen Tag gedeckelt.
 *
 *   GET  /                 →  kurze Statusmeldung (offen, zum Nachsehen)
 *   POST /frage            ←  { zugang, geraet, modell, system, nachrichten,
 *                               werkzeuge }
 *                          →  { inhalt, stopGrund, verbrauch, kontingent }
 *
 * Nötige Einstellungen am Worker:
 *   ANTHROPIC_API_KEY   Secret – der Schlüssel von console.anthropic.com
 *   ASSISTENT_ZUGANG    Secret – frei gewähltes Wort, kommt auch in die App
 *   MARKTPLANER         KV-Namensraum (derselbe wie beim Abgleich)
 *   ERLAUBTE_HERKUNFT   Variable – z. B. https://lukas281299.github.io
 *   TAGESLIMIT          Variable – Anfragen pro Gerät und Tag (ohne: 200)
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_FASSUNG = '2023-06-01';
const STANDARD_TAGESLIMIT = 200;

/** Größte Anfrage, die durchgereicht wird. Ein großer Plan wiegt ~200 kB. */
const MAX_GROESSE = 4 * 1024 * 1024;

/** Nur diese Modelle sind zugelassen – sonst könnte jemand teuer einkaufen. */
const MODELLE = ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'];

/* --------------------------------------------------------------- Herkunft */

/** Darf diese Herkunft fragen? */
function herkunftErlaubt(anfrage, umgebung) {
  const herkunft = anfrage.headers.get('Origin') ?? '';
  const erlaubt = (umgebung.ERLAUBTE_HERKUNFT ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  // Localhost mit beliebigem Port, damit die Entwicklung nicht blockiert ist.
  if (/^http:\/\/localhost(:\d+)?$/.test(herkunft)) return true;
  return erlaubt.includes(herkunft);
}

/**
 * Die Kopfzeilen für die Antwort – und zugleich die Türsteherfunktion.
 *
 * Ein leeres Ergebnis heißt „nicht erlaubt". Der Browser schickt `Origin` bei
 * jeder fremden Anfrage mit und lässt sich das nicht ausreden; deshalb reicht
 * das gegen fremde Webseiten. Gegen ein Programm ohne Browser hilft es nicht –
 * dafür sind Zugangswort und Tageslimit da.
 */
function kopfzeilen(anfrage, umgebung) {
  if (!herkunftErlaubt(anfrage, umgebung)) return null;
  return {
    'Access-Control-Allow-Origin': anfrage.headers.get('Origin') ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function antwort(daten, status, kopf) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { ...kopf, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/* -------------------------------------------------------------- Kontingent */

/**
 * Wie viele Anfragen ein Gerät am Tag hat.
 *
 * `Number(x) || STANDARD` wäre hier falsch: Ein bewusst gesetztes Limit von 0
 * – den Assistenten vorübergehend abstellen – würde still zu 200 werden.
 */
function tageslimit(umgebung) {
  const roh = (umgebung.TAGESLIMIT ?? '').trim();
  if (roh === '') return STANDARD_TAGESLIMIT;
  const zahl = Number(roh);
  if (!Number.isFinite(zahl) || zahl < 0) return STANDARD_TAGESLIMIT;
  return Math.floor(zahl);
}

function zaehlerschluessel(geraet) {
  return 'ki:' + geraet + ':' + new Date().toISOString().slice(0, 10);
}

async function zaehleMit(ablage, umgebung, geraet) {
  const grenze = tageslimit(umgebung);
  const schluessel = zaehlerschluessel(geraet);
  const bisher = Number((await ablage.get(schluessel)) ?? '0') || 0;
  if (bisher >= grenze) return { frei: false, verbraucht: bisher, grenze };
  // Zwei Tage Haltbarkeit, damit der Zähler über Zeitzonen hinweg abläuft.
  await ablage.put(schluessel, String(bisher + 1), { expirationTtl: 60 * 60 * 48 });
  return { frei: true, verbraucht: bisher + 1, grenze };
}

/**
 * Gibt eine gezählte Anfrage wieder frei, wenn die API gar nicht geantwortet
 * hat. Ein Netzfehler soll kein Kontingent kosten – verbraucht wurde nichts.
 */
async function gibZurueck(ablage, geraet) {
  const schluessel = zaehlerschluessel(geraet);
  const bisher = Number((await ablage.get(schluessel)) ?? '0') || 0;
  if (bisher <= 0) return;
  await ablage.put(schluessel, String(bisher - 1), { expirationTtl: 60 * 60 * 48 });
}

/* ------------------------------------------------------------------ Prüfen */

/**
 * Vergleicht zwei Geheimnisse, ohne beim ersten Unterschied abzubrechen.
 *
 * Ein `===` verrät über die Antwortzeit, wie viele Zeichen am Anfang stimmen.
 * Das ist über das Netz schwer auszunutzen, aber der Aufwand hier sind drei
 * Zeilen – also lieber gleich richtig.
 */
function gleich(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let unterschied = 0;
  for (let i = 0; i < a.length; i += 1) unterschied |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return unterschied === 0;
}

function ablageHolen(umgebung) {
  const ablage = umgebung.MARKTPLANER;
  if (!ablage) throw new Error('Der KV-Namensraum MARKTPLANER ist nicht verbunden.');
  if (typeof ablage.get !== 'function') {
    throw new Error('Die Bindung MARKTPLANER ist kein KV-Namensraum.');
  }
  return ablage;
}

/* ------------------------------------------------------------------ Worker */

export default {
  async fetch(anfrage, umgebung) {
    const pfad = new URL(anfrage.url).pathname;

    /**
     * Die Statusseite steht **vor** dem Türsteher und ist absichtlich offen.
     *
     * Sie ist zum Nachsehen im Browser da, und ein Aufruf aus der Adressleiste
     * schickt gar keinen `Origin` mit – hinter der Prüfung antwortete
     * ausgerechnet die Seite mit „Nicht erlaubt", die einem sagen soll, ob
     * alles richtig eingerichtet ist. Geheim ist hier nichts: nur, ob die
     * Einträge gesetzt sind, nicht was darin steht.
     */
    if (anfrage.method === 'GET' && pfad === '/') {
      return antwort(
        {
          dienst: 'marktplaner-assistent',
          bereit: true,
          version: 2,
          schluessel: !!umgebung.ANTHROPIC_API_KEY,
          zugang: !!umgebung.ASSISTENT_ZUGANG,
          ablage: !!umgebung.MARKTPLANER && typeof umgebung.MARKTPLANER.get === 'function',
          // Kommt die Frage aus einer Seite, darf sie auch fragen? Beim Aufruf
          // aus der Adressleiste gibt es keine Herkunft – dann steht hier null.
          herkunftOk: anfrage.headers.get('Origin')
            ? herkunftErlaubt(anfrage, umgebung)
            : null,
        },
        200,
        { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      );
    }

    const kopf = kopfzeilen(anfrage, umgebung);

    if (anfrage.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: kopf ?? {} });
    }
    if (!kopf) {
      return new Response(
        'Nicht erlaubt: Diese Herkunft steht nicht in ERLAUBTE_HERKUNFT.',
        { status: 403 },
      );
    }

    if (anfrage.method !== 'POST' || pfad !== '/frage') {
      return antwort({ fehler: 'Nicht gefunden.' }, 404, kopf);
    }

    if (!umgebung.ANTHROPIC_API_KEY) {
      return antwort({ fehler: 'Am Worker ist kein ANTHROPIC_API_KEY hinterlegt.' }, 500, kopf);
    }
    if (!umgebung.ASSISTENT_ZUGANG) {
      return antwort({ fehler: 'Am Worker ist kein ASSISTENT_ZUGANG hinterlegt.' }, 500, kopf);
    }

    let ablage;
    try {
      ablage = ablageHolen(umgebung);
    } catch (fehler) {
      return antwort({ fehler: fehler.message }, 500, kopf);
    }

    const roh = await anfrage.text();
    if (roh.length > MAX_GROESSE) {
      return antwort({ fehler: 'Die Anfrage ist zu groß.' }, 413, kopf);
    }

    let daten;
    try {
      daten = JSON.parse(roh);
    } catch {
      return antwort({ fehler: 'Ungültige Anfrage.' }, 400, kopf);
    }

    if (!gleich(daten.zugang, umgebung.ASSISTENT_ZUGANG)) {
      return antwort({ fehler: 'Das Zugangswort stimmt nicht.' }, 401, kopf);
    }

    const geraet = typeof daten.geraet === 'string' ? daten.geraet.slice(0, 64) : '';
    if (!/^[a-zA-Z0-9_-]{4,64}$/.test(geraet)) {
      return antwort({ fehler: 'Ungültige Gerätekennung.' }, 400, kopf);
    }

    const modell = MODELLE.includes(daten.modell) ? daten.modell : MODELLE[0];
    if (!Array.isArray(daten.nachrichten) || daten.nachrichten.length === 0) {
      return antwort({ fehler: 'Es fehlen die Nachrichten.' }, 400, kopf);
    }

    const kontingent = await zaehleMit(ablage, umgebung, geraet);
    if (!kontingent.frei) {
      return antwort(
        {
          fehler:
            'Für heute ist Schluss – ' +
            kontingent.grenze +
            ' Anfragen sind aufgebraucht. Morgen geht es weiter. (Das ist eine Kostenbremse, kein Urteil.)',
          amLimit: true,
        },
        429,
        kopf,
      );
    }

    const paket = {
      model: modell,
      max_tokens: Math.min(Number(daten.maxTokens) || 8000, 16000),
      messages: daten.nachrichten,
    };
    if (daten.system) paket.system = daten.system;
    if (Array.isArray(daten.werkzeuge) && daten.werkzeuge.length > 0) {
      paket.tools = daten.werkzeuge;
    }
    // Denken kostet Zeit und Token; für „stell die Gondel zwei Meter nach
    // links" bringt es nichts. Wer es braucht, schaltet es in der App an.
    if (daten.denken) {
      const budget = Math.min(Number(daten.denken) || 4000, 12000);
      paket.thinking = { type: 'enabled', budget_tokens: budget };
      // Beim Denken deckelt max_tokens das Denken mit ab; ohne Luft darüber
      // bräche die Antwort mitten im Satz ab.
      paket.max_tokens = Math.max(paket.max_tokens, budget + 4000);
    } else {
      paket.thinking = { type: 'disabled' };
    }

    let oben;
    try {
      oben = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': umgebung.ANTHROPIC_API_KEY,
          'anthropic-version': API_FASSUNG,
        },
        body: JSON.stringify(paket),
      });
    } catch {
      await gibZurueck(ablage, geraet);
      return antwort({ fehler: 'Der Assistent ist gerade nicht erreichbar.' }, 502, kopf);
    }

    if (!oben.ok) {
      const einzelheiten = await oben.text();
      console.error('Anthropic-Fehler', oben.status, einzelheiten.slice(0, 600));
      await gibZurueck(ablage, geraet);
      const freundlich =
        oben.status === 429
          ? 'Gerade zu viele Anfragen. Versuch es in einer Minute noch einmal.'
          : oben.status === 401
            ? 'Der hinterlegte Schlüssel wird nicht angenommen.'
            : 'Der Assistent konnte nicht antworten.';
      return antwort(
        { fehler: freundlich, status: oben.status },
        oben.status === 429 ? 429 : 502,
        kopf,
      );
    }

    const ergebnis = await oben.json();

    return antwort(
      {
        inhalt: ergebnis.content ?? [],
        stopGrund: ergebnis.stop_reason ?? null,
        modell,
        verbrauch: {
          hinein: ergebnis.usage?.input_tokens ?? 0,
          heraus: ergebnis.usage?.output_tokens ?? 0,
          ausDemCache: ergebnis.usage?.cache_read_input_tokens ?? 0,
          inDenCache: ergebnis.usage?.cache_creation_input_tokens ?? 0,
        },
        kontingent: { verbraucht: kontingent.verbraucht, grenze: kontingent.grenze },
      },
      200,
      kopf,
    );
  },
};
