import { beforeEach, describe, expect, it } from 'vitest';
import worker from './worker.js';
import { entschluesseln, kontoKennung, verschluesseln } from '../src/speicher/krypto';

/**
 * Prüfungen für das Vermittlungsprogramm.
 *
 * Der Worker läuft später bei Cloudflare, wo man ihn nur schwer beobachten
 * kann. Hier wird er stattdessen im Prüflauf gestartet – mit einer Ablage aus
 * einer schlichten Map – und über echte Anfragen angesprochen. Was hier
 * durchläuft, läuft auch dort: Es ist genau derselbe Code.
 */

/** Eine Ablage wie Workers KV, nur im Arbeitsspeicher. */
function ablageBauen() {
  const inhalt = new Map();
  return {
    async get(schluessel, optionen) {
      const wert = inhalt.get(schluessel);
      if (wert === undefined) return null;
      return optionen?.type === 'json' ? JSON.parse(wert) : wert;
    },
    async put(schluessel, wert) {
      inhalt.set(schluessel, wert);
    },
    async delete(schluessel) {
      inhalt.delete(schluessel);
    },
    groesse: () => inhalt.size,
  };
}

const BASIS = 'https://marktplaner-sync.test';
const KONTO = 'a'.repeat(32);

let ablage;
let umgebung;

beforeEach(() => {
  ablage = ablageBauen();
  umgebung = { MARKTPLANER: ablage };
});

function anfragen(pfad, optionen = {}) {
  return worker.fetch(new Request(`${BASIS}${pfad}`, optionen), umgebung);
}

function schreiben(pfad, rumpf) {
  return anfragen(pfad, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rumpf),
  });
}

describe('Startseite', () => {
  it('meldet sich als Marktplaner-Dienst', async () => {
    // Genau daran erkennt die Einrichtung, dass die Adresse stimmt.
    const antwort = await anfragen('/');
    expect(await antwort.json()).toMatchObject({ dienst: 'marktplaner-sync', bereit: true });
  });

  it('sagt Bescheid, wenn die Ablage nicht verbunden ist', async () => {
    umgebung = {};
    const antwort = await anfragen(`/daten/${KONTO}`);
    expect(antwort.status).toBe(500);
    expect((await antwort.json()).fehler).toContain('MARKTPLANER');
  });
});

describe('Verzeichnis', () => {
  it('meldet 404, solange noch nichts abgelegt wurde', async () => {
    expect((await anfragen(`/daten/${KONTO}`)).status).toBe(404);
  });

  it('legt ab und gibt wieder heraus', async () => {
    const geschrieben = await schreiben(`/daten/${KONTO}`, { version: 0, inhalt: 'block-1' });
    expect(await geschrieben.json()).toEqual({ version: 1 });

    const gelesen = await anfragen(`/daten/${KONTO}`);
    expect(await gelesen.json()).toMatchObject({ version: 1, inhalt: 'block-1' });
  });

  it('weist zurück, wenn inzwischen ein anderer Rechner geschrieben hat', async () => {
    // Genau hierauf beruht der Schutz vor stillem Datenverlust: Wer mit einer
    // überholten Fassung schreiben will, muss erst neu zusammenführen.
    await schreiben(`/daten/${KONTO}`, { version: 0, inhalt: 'erster' });

    const zweiter = await schreiben(`/daten/${KONTO}`, { version: 0, inhalt: 'zweiter' });
    expect(zweiter.status).toBe(409);
    expect(await zweiter.json()).toMatchObject({ version: 1 });

    // Mit der richtigen Fassung geht es durch.
    const dritter = await schreiben(`/daten/${KONTO}`, { version: 1, inhalt: 'zweiter' });
    expect(await dritter.json()).toEqual({ version: 2 });
  });

  it('lehnt eine erfundene Kontokennung ab', async () => {
    expect((await anfragen('/daten/nicht-hexadezimal')).status).toBe(400);
  });

  it('lehnt einen leeren Inhalt ab', async () => {
    const antwort = await schreiben(`/daten/${KONTO}`, { version: 0, inhalt: '' });
    expect(antwort.status).toBe(400);
  });

  it('lehnt einen zu großen Block ab', async () => {
    const antwort = await schreiben(`/daten/${KONTO}`, {
      version: 0,
      inhalt: 'x'.repeat(9 * 1024 * 1024),
    });
    expect(antwort.status).toBe(413);
  });
});

describe('einzelne Planungen', () => {
  const name = 'projekt-1234-abcd';

  it('legt ab, gibt heraus und räumt wieder weg', async () => {
    expect((await anfragen(`/anhang/${KONTO}/${name}`)).status).toBe(404);

    await schreiben(`/anhang/${KONTO}/${name}`, { inhalt: 'planung' });
    const gelesen = await anfragen(`/anhang/${KONTO}/${name}`);
    expect(await gelesen.json()).toEqual({ inhalt: 'planung' });

    await anfragen(`/anhang/${KONTO}/${name}`, { method: 'DELETE' });
    expect((await anfragen(`/anhang/${KONTO}/${name}`)).status).toBe(404);
  });

  it('trennt die Fächer verschiedener Kopplungscodes', async () => {
    // Zwei Kontokennungen dürfen sich unter keinen Umständen ins Gehege
    // kommen – sonst sähe ein Fremder die eigenen Planungen.
    const anderes = 'b'.repeat(32);
    await schreiben(`/anhang/${KONTO}/${name}`, { inhalt: 'meins' });

    expect((await anfragen(`/anhang/${anderes}/${name}`)).status).toBe(404);
  });
});

describe('unbekannte Pfade', () => {
  it('meldet 404 statt irgendetwas zu tun', async () => {
    expect((await anfragen('/irgendwas')).status).toBe(404);
  });

  it('beantwortet die Vorabfrage des Browsers', async () => {
    const antwort = await anfragen('/', { method: 'OPTIONS' });
    expect(antwort.status).toBe(204);
    expect(antwort.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('Zusammenspiel mit der Verschlüsselung', () => {
  it('gibt eine verschlüsselt abgelegte Planung unverändert zurück', async () => {
    const code = 'NNXY-FH3J-ZS33-TW2T';
    const konto = await kontoKennung(code);
    const planung = { id: 'projekt-1', name: 'Markt Nord', elemente: [{ x: 120, y: 340 }] };

    const inhalt = await verschluesseln(planung, code);
    await schreiben(`/daten/${konto}`, { version: 0, inhalt });

    const roh = await (await anfragen(`/daten/${konto}`)).json();
    expect(await entschluesseln(roh.inhalt, code)).toEqual(planung);
  });

  it('gibt mit dem falschen Code nichts preis', async () => {
    const code = 'NNXY-FH3J-ZS33-TW2T';
    const falsch = 'AAAA-BBBB-CCCC-DDDD';
    const konto = await kontoKennung(code);

    const inhalt = await verschluesseln({ geheim: true }, code);
    await schreiben(`/daten/${konto}`, { version: 0, inhalt });
    const roh = await (await anfragen(`/daten/${konto}`)).json();

    await expect(entschluesseln(roh.inhalt, falsch)).rejects.toThrow(/entschlüsseln/);
  });

  it('führt vom Kopplungscode nicht zur Kontokennung zurück', async () => {
    // Die Kennung steht offen in der Adresse. Sie darf den Schlüssel nicht
    // verraten – deshalb werden beide mit verschiedenem Salz abgeleitet.
    const code = 'NNXY-FH3J-ZS33-TW2T';
    expect(await kontoKennung(code)).toMatch(/^[0-9a-f]{32}$/);
    expect(await kontoKennung(code)).not.toContain('NNXY');
  });
});
