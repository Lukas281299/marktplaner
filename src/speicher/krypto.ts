/**
 * Verschlüsselung für die Synchronisation.
 *
 * Alles passiert im Browser. Was den Rechner verlässt, ist ein Block, mit dem
 * ohne den Kopplungscode niemand etwas anfangen kann – weder Cloudflare noch
 * jemand, der die Kontokennung errät.
 *
 * Verfahren: AES-GCM mit 256 Bit. Der Schlüssel wird aus dem Kopplungscode
 * abgeleitet (PBKDF2, 250.000 Runden), damit der Code selbst nie übertragen
 * wird. Die Kontokennung ist ein davon unabhängiger Hash desselben Codes –
 * der Server kennt also nur eine Zeichenkette, aus der sich der Schlüssel
 * nicht zurückrechnen lässt.
 */

const RUNDEN = 250_000;

/**
 * Ein fester Zusatz beim Ableiten. Er trennt Schlüssel und Kontokennung
 * voneinander: Aus demselben Code entstehen zwei Werte, die nichts
 * voneinander verraten.
 */
const SALZ_SCHLUESSEL = 'marktplaner-sync-v1-schluessel';
const SALZ_KONTO = 'marktplaner-sync-v1-konto';

/**
 * Zeichen für den Kopplungscode. Ohne 0/O und 1/I/l – die verwechselt man
 * beim Abtippen vom einen Rechner auf den anderen zu leicht.
 */
const ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function textZuBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Kopiert Bytes in einen eigenen Puffer.
 *
 * Die Verschlüsselungsschnittstelle des Browsers verlangt einen echten
 * ArrayBuffer. Ein Ausschnitt aus einem größeren Puffer erfüllt das nicht,
 * deshalb hier eine saubere Kopie.
 */
function alsPuffer(bytes: Uint8Array): ArrayBuffer {
  const puffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(puffer).set(bytes);
  return puffer;
}

function bytesZuHex(puffer: ArrayBuffer): string {
  return [...new Uint8Array(puffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesZuBase64(bytes: Uint8Array): string {
  let text = '';
  // In Blöcken, sonst sprengt eine große Planung den Aufrufstapel.
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(text);
}

function base64ZuBytes(text: string): Uint8Array {
  const roh = atob(text);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

/**
 * Erzeugt einen neuen Kopplungscode, z. B. „K7NP-2XQF-8MTR-WD4H".
 *
 * 16 Zeichen aus 31 möglichen ergeben rund 79 Bit – das ist auch dann nicht
 * zu erraten, wenn jemand die Serveradresse kennt. Deshalb wird er erzeugt
 * und nicht selbst gewählt: Ein ausgedachtes Passwort wäre hier die
 * Schwachstelle.
 */
export function neuerKopplungscode(): string {
  const zufall = new Uint32Array(16);
  crypto.getRandomValues(zufall);
  const zeichen = [...zufall].map((z) => ZEICHEN[z % ZEICHEN.length]);
  return [0, 4, 8, 12].map((i) => zeichen.slice(i, i + 4).join('')).join('-');
}

/** Vereinheitlicht die Schreibweise: Groß, ohne Bindestriche und Leerzeichen. */
export function codeNormalisieren(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Sieht der eingegebene Code überhaupt nach einem gültigen aus? */
export function codeGueltig(code: string): boolean {
  const sauber = codeNormalisieren(code);
  return sauber.length === 16 && [...sauber].every((z) => ZEICHEN.includes(z));
}

/** Schreibt einen Code wieder in Vierergruppen, wie er angezeigt wird. */
export function codeFormatieren(code: string): string {
  const sauber = codeNormalisieren(code);
  return (sauber.match(/.{1,4}/g) ?? []).join('-');
}

async function schluesselAus(code: string): Promise<CryptoKey> {
  const roh = await crypto.subtle.importKey(
    'raw',
    alsPuffer(textZuBytes(codeNormalisieren(code))),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: alsPuffer(textZuBytes(SALZ_SCHLUESSEL)),
      iterations: RUNDEN,
      hash: 'SHA-256',
    },
    roh,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Das Ableiten dauert bewusst spürbar lange (das ist der Sinn der 250.000
 * Runden). Bei einem Abgleich mit zwanzig Planungen wäre das zwanzigmal
 * dieselbe Rechnerei – deshalb wird der fertige Schlüssel gemerkt, solange
 * die Seite offen ist. Er verlässt den Arbeitsspeicher nicht.
 */
let gemerkt: { code: string; schluessel: Promise<CryptoKey> } | null = null;

function schluessel(code: string): Promise<CryptoKey> {
  const sauber = codeNormalisieren(code);
  if (gemerkt?.code !== sauber) {
    gemerkt = { code: sauber, schluessel: schluesselAus(sauber) };
  }
  return gemerkt.schluessel;
}

/**
 * Die Kennung, unter der die Daten auf dem Server liegen.
 *
 * Sie verrät den Code nicht: Wer die Kennung kennt, kann den verschlüsselten
 * Block herunterladen, aber nicht lesen.
 */
export async function kontoKennung(code: string): Promise<string> {
  const puffer = await crypto.subtle.digest(
    'SHA-256',
    alsPuffer(textZuBytes(SALZ_KONTO + codeNormalisieren(code))),
  );
  return bytesZuHex(puffer).slice(0, 32);
}

/** Verschlüsselt beliebige Daten zu einer Zeichenkette. */
export async function verschluesseln(daten: unknown, code: string): Promise<string> {
  const s = await schluessel(code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const klartext = textZuBytes(JSON.stringify(daten));
  const geheim = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: alsPuffer(iv) },
    s,
    alsPuffer(klartext),
  );

  // Der Zufallswert muss mit, sonst lässt sich nicht mehr entschlüsseln.
  // Er ist kein Geheimnis und darf offen davorstehen.
  const zusammen = new Uint8Array(iv.length + geheim.byteLength);
  zusammen.set(iv, 0);
  zusammen.set(new Uint8Array(geheim), iv.length);
  return bytesZuBase64(zusammen);
}

/**
 * Entschlüsselt wieder zurück. Schlägt fehl, wenn der Code nicht passt oder
 * jemand am Block herumgespielt hat – AES-GCM merkt beides.
 */
export async function entschluesseln<T>(block: string, code: string): Promise<T> {
  const s = await schluessel(code);
  const bytes = base64ZuBytes(block);
  const iv = bytes.subarray(0, 12);
  const geheim = bytes.subarray(12);
  try {
    const klartext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: alsPuffer(iv) },
      s,
      alsPuffer(geheim),
    );
    return JSON.parse(new TextDecoder().decode(klartext)) as T;
  } catch {
    throw new Error(
      'Der Block ließ sich nicht entschlüsseln. Stimmt der Kopplungscode auf beiden Rechnern überein?',
    );
  }
}
