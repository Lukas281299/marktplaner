/**
 * Marktplaner – Vermittlungsprogramm für die Synchronisation.
 *
 * Läuft als Cloudflare Worker auf der kostenlosen Stufe.
 *
 * Es ist absichtlich so dumm wie möglich: Es nimmt einen Block entgegen, legt
 * ihn ab und gibt ihn wieder heraus. Mehr nicht. Es kann die Daten nicht lesen
 * – der Marktplaner verschlüsselt alles im Browser, bevor etwas hier ankommt.
 * Auf dem Server liegt eine Zeichenkette, mit der ohne den Kopplungscode auf
 * deinem Gerät niemand etwas anfangen kann, auch Cloudflare nicht.
 *
 * Aufteilung in Verzeichnis und Anhänge:
 * Unter `/daten/<konto>` liegt nur das Verzeichnis – welche Planungen es gibt,
 * wie sie heißen und wann sie zuletzt geändert wurden. Jede Planung selbst
 * liegt einzeln unter `/anhang/<konto>/<projekt-id>`. Sonst gingen bei jedem
 * Abgleich alle Planungen über die Leitung, auch die, an denen sich seit
 * Wochen nichts getan hat.
 *
 * Ablage: ein KV-Namensraum unter dem Namen MARKTPLANER.
 *
 *   GET  /                          →  kurze Statusmeldung
 *   GET  /daten/<konto>             →  { version, inhalt }  oder 404
 *   PUT  /daten/<konto>             ←  { version, inhalt }  →  { version } / 409
 *   GET  /anhang/<konto>/<name>     →  { inhalt }  oder 404
 *   PUT  /anhang/<konto>/<name>     ←  { inhalt }  →  { ok: true }
 *   DEL  /anhang/<konto>/<name>     →  { ok: true }
 *
 * Nötige Einstellung am Worker:
 *   MARKTPLANER     KV-Namensraum (Bindung)
 */

const KOPFZEILEN = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

/**
 * Bis hierhin ist ein Block erlaubt.
 *
 * Eine große Marktplanung mit ein paar hundert Elementen liegt bei etwa
 * 200 Kilobyte. Sobald ein eingelesener Ladenplan als Hintergrundbild
 * dazukommt, wird es deutlich mehr – deshalb großzügig bemessen.
 */
const MAX_GROESSE = 8 * 1024 * 1024;

function antwort(daten, status = 200) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { ...KOPFZEILEN, 'Content-Type': 'application/json' },
  });
}

/**
 * Die Kontokennung ist ein Hash aus dem Kopplungscode, den nur du kennst.
 * Sie ist immer 32 Zeichen aus 0-9a-f. Alles andere wird abgewiesen, damit
 * niemand über den Pfad Unsinn in die Ablage schreibt.
 */
function kontoGueltig(konto) {
  return typeof konto === 'string' && /^[0-9a-f]{32}$/.test(konto);
}

/** Liest den Rumpf und prüft, dass ein verschlüsselter Inhalt drinsteht. */
async function inhaltLesen(anfrage) {
  let neu;
  try {
    neu = await anfrage.json();
  } catch {
    return { fehler: antwort({ fehler: 'Der Inhalt ist kein gültiges JSON.' }, 400) };
  }
  if (typeof neu?.inhalt !== 'string' || neu.inhalt.length === 0) {
    return { fehler: antwort({ fehler: 'Es fehlt der verschlüsselte Inhalt.' }, 400) };
  }
  if (neu.inhalt.length > MAX_GROESSE) {
    return { fehler: antwort({ fehler: 'Der Block ist zu groß.' }, 413) };
  }
  return { neu };
}

export default {
  async fetch(anfrage, umgebung) {
    if (anfrage.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: KOPFZEILEN });
    }

    const pfad = new URL(anfrage.url).pathname;

    // Die Startseite dient nur dazu, beim Einrichten zu erkennen, ob unter
    // der eingegebenen Adresse wirklich dieses Programm läuft.
    if (pfad === '/' || pfad === '') {
      return antwort({ dienst: 'marktplaner-sync', bereit: true, version: 1 });
    }

    const ablage = umgebung.MARKTPLANER;
    if (!ablage) {
      return antwort({ fehler: 'Der KV-Namensraum MARKTPLANER ist nicht verbunden.' }, 500);
    }

    const daten = pfad.match(/^\/daten\/([^/]+)$/);
    const anhang = pfad.match(/^\/anhang\/([^/]+)\/([a-z0-9-]{1,64})$/);
    if (!daten && !anhang) return antwort({ fehler: 'Unbekannter Pfad.' }, 404);

    const konto = (daten ?? anhang)[1];
    if (!kontoGueltig(konto)) {
      return antwort({ fehler: 'Ungültige Kontokennung.' }, 400);
    }

    // ===================================================== einzelne Planung
    if (anhang) {
      const schluessel = `${konto}:anhang:${anhang[2]}`;

      if (anfrage.method === 'GET') {
        const roh = await ablage.get(schluessel);
        if (roh === null) return antwort({ fehler: 'Nicht vorhanden.' }, 404);
        return new Response(roh, {
          headers: { ...KOPFZEILEN, 'Content-Type': 'application/json' },
        });
      }

      if (anfrage.method === 'PUT') {
        const { neu, fehler } = await inhaltLesen(anfrage);
        if (fehler) return fehler;
        await ablage.put(schluessel, JSON.stringify({ inhalt: neu.inhalt }));
        return antwort({ ok: true });
      }

      if (anfrage.method === 'DELETE') {
        await ablage.delete(schluessel);
        return antwort({ ok: true });
      }

      return antwort({ fehler: 'Nicht erlaubt.' }, 405);
    }

    // ============================================================ Abholen
    if (anfrage.method === 'GET') {
      const roh = await ablage.get(konto);
      if (roh === null) return antwort({ fehler: 'Noch nichts abgelegt.' }, 404);
      return new Response(roh, {
        headers: { ...KOPFZEILEN, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================= Ablegen
    if (anfrage.method === 'PUT') {
      const { neu, fehler } = await inhaltLesen(anfrage);
      if (fehler) return fehler;

      // Fassung prüfen: Hat inzwischen ein anderes Gerät geschrieben, muss
      // dieses Gerät erst neu zusammenführen. Sonst gingen dessen Planungen
      // still verloren.
      const vorhanden = await ablage.get(konto, { type: 'json' });
      const aktuell = vorhanden?.version ?? 0;
      const erwartet = Number(neu.version ?? 0);

      if (erwartet !== aktuell) {
        return antwort({ fehler: 'Zwischenzeitlich geändert.', version: aktuell }, 409);
      }

      const fassung = aktuell + 1;
      await ablage.put(
        konto,
        JSON.stringify({
          version: fassung,
          inhalt: neu.inhalt,
          stand: new Date().toISOString(),
        }),
      );
      return antwort({ version: fassung });
    }

    return antwort({ fehler: 'Nicht erlaubt.' }, 405);
  },
};
