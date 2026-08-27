import type { Projekt } from '../typen/modell';
import type { Aufnahme } from './planAufnahme';

/**
 * Der Plan für eine fremde Webanwendung.
 *
 * **Format: SVG, dessen Koordinatensystem der Markt selbst ist.** Die
 * `viewBox` läuft in Zentimetern des Grundrisses – wer ein Kamerasymbol an
 * die Stelle 1200/800 im Markt setzen will, schreibt `cx="1200" cy="800"`.
 * Keine Umrechnung, kein Maßstabsfaktor, nichts, was beim nächsten Umbau des
 * Plans stillschweigend falsch wird.
 *
 * Warum SVG und nicht einfach PNG: Ein PNG ist nur ein Bild. Man weiß nicht,
 * wie viele Zentimeter ein Bildpunkt ist, wo der Nullpunkt liegt und was
 * passiert, wenn der Plan später anders beschnitten exportiert wird. Genau
 * daran gehen solche Overlays kaputt – die Kameras sitzen nach dem zweiten
 * Export zwei Meter daneben. Hier steht der Maßstab **in** der Datei.
 *
 * Warum das Bild trotzdem eingebettet ist und nicht als Vektor: Die Zeichnung
 * eines Möbels steckt in gut tausend Zeilen Konva-Code. Sie ein zweites Mal
 * als SVG zu schreiben hieße, sie doppelt zu pflegen – und die zweite Fassung
 * wäre nach dem ersten neuen Möbel falsch. Ein eingebettetes Bild kann nicht
 * veralten.
 */

/** Wie oft die Angaben in der Datei stehen – für spätere Änderungen am Aufbau. */
const FASSUNG = 1;

export interface WebExportDaten {
  svg: string;
  /** Die Angaben, die auch im SVG stehen – für die Beispielseite. */
  masse: {
    breiteCm: number;
    hoeheCm: number;
    nullpunktX: number;
    nullpunktY: number;
  };
}

function schuetze(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Die Möbel als Daten – damit die fremde Anwendung weiß, was wo steht.
 *
 * Nicht alles, sondern das, was man für ein Overlay braucht: wo etwas steht,
 * wie groß es ist und wie es heißt. Wer eine Kamera „über der Molkerei"
 * platzieren will, findet die Molkerei hierüber.
 */
function moebeldaten(projekt: Projekt) {
  return projekt.elemente.map((el) => ({
    id: el.id,
    name: el.name,
    kategorie: el.kategorie,
    x: Math.round(el.x),
    y: Math.round(el.y),
    breite: Math.round(el.breite),
    tiefe: Math.round(el.tiefe),
    drehung: Math.round(el.drehung),
    warengruppen: [...(el.warengruppenUnten ?? []), ...(el.warengruppenOben ?? [])]
      .map((a) => a.text.trim())
      .filter(Boolean),
  }));
}

/**
 * Baut das SVG.
 *
 * Die Bildpunkte liegen als Daten-URL darin. Das macht die Datei größer als
 * nötig, aber es ist **eine** Datei – und eine Datei, die man verschicken und
 * irgendwohin legen kann, ohne dass ein zweiter Teil fehlt.
 */
export function baueWebSvg(projekt: Projekt, aufnahme: Aufnahme): WebExportDaten {
  const { ausschnitt } = aufnahme;
  const breite = Math.round(ausschnitt.breite);
  const hoehe = Math.round(ausschnitt.hoehe);
  const bild = aufnahme.bild.toDataURL('image/png');

  const angaben = {
    fassung: FASSUNG,
    erzeuger: 'Marktplaner',
    planung: projekt.name,
    einheit: 'cm',
    /** Wo die linke obere Ecke der Zeichnung im Plan liegt. */
    nullpunkt: { x: Math.round(ausschnitt.x), y: Math.round(ausschnitt.y) },
    groesse: { breite, hoehe },
    moebel: moebeldaten(projekt),
  };

  // Das Koordinatensystem beginnt bei 0/0 und läuft über die Größe des
  // Ausschnitts. Die Verschiebung gegenüber dem Plan steht im Nullpunkt –
  // wer sie braucht, rechnet sie dazu, alle anderen ignorieren sie.
  return {
    svg:
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n` +
      `     viewBox="0 0 ${breite} ${hoehe}" width="${breite}" height="${hoehe}"\n` +
      `     data-marktplaner="${FASSUNG}" data-einheit="cm"\n` +
      `     data-breite-cm="${breite}" data-hoehe-cm="${hoehe}"\n` +
      `     data-nullpunkt-x="${Math.round(ausschnitt.x)}" data-nullpunkt-y="${Math.round(ausschnitt.y)}">\n` +
      `  <title>${schuetze(projekt.name)}</title>\n` +
      `  <desc>Marktplan. Ein Punkt im Koordinatensystem entspricht einem Zentimeter im Markt.</desc>\n` +
      `  <metadata id="marktplaner-daten">\n` +
      `    <![CDATA[${JSON.stringify(angaben)}]]>\n` +
      `  </metadata>\n` +
      `  <image x="0" y="0" width="${breite}" height="${hoehe}" href="${bild}"\n` +
      `         preserveAspectRatio="none" />\n` +
      `</svg>\n`,
    masse: {
      breiteCm: breite,
      hoeheCm: hoehe,
      nullpunktX: Math.round(ausschnitt.x),
      nullpunktY: Math.round(ausschnitt.y),
    },
  };
}

/**
 * Eine Beispielseite, die zeigt, wie Kameras auf den Plan kommen.
 *
 * Sie ist kein Zierrat: Wer den Plan in seiner Anwendung einbauen soll, hat
 * sonst nur eine Datei und muss raten, wie das Koordinatensystem gemeint ist.
 * Hier kann er es öffnen, anklicken und den Teil herauskopieren, den er
 * braucht.
 */
export function baueBeispielseite(daten: WebExportDaten, svgDateiname: string): string {
  const { breiteCm, hoeheCm } = daten.masse;
  // Ein paar Kameras verstreut, damit die Seite beim Öffnen etwas zeigt.
  const beispiele = [
    { name: 'Eingang', x: Math.round(breiteCm * 0.12), y: Math.round(hoeheCm * 0.88) },
    { name: 'Kasse 1', x: Math.round(breiteCm * 0.3), y: Math.round(hoeheCm * 0.82) },
    { name: 'Molkerei', x: Math.round(breiteCm * 0.62), y: Math.round(hoeheCm * 0.35) },
    { name: 'Lager', x: Math.round(breiteCm * 0.88), y: Math.round(hoeheCm * 0.15) },
  ];

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Kameras auf dem Marktplan</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #f6f7f9; color: #1c2530; }
  header { padding: 16px 20px; background: #fff; border-bottom: 1px solid #dde1e6; }
  h1 { margin: 0 0 4px; font-size: 18px; }
  p { margin: 0; font-size: 13px; color: #5d6874; }

  /* Der Plan und die Kameras liegen im selben Kasten. Dadurch reicht eine
     Angabe in Prozent, um eine Kamera an ihren Platz zu setzen – und beim
     Verkleinern des Fensters wandert sie mit. */
  .buehne { position: relative; margin: 20px auto; max-width: 1400px; }
  .buehne img { display: block; width: 100%; height: auto; }

  .kamera {
    position: absolute;
    width: 34px; height: 34px;
    margin: -17px 0 0 -17px;      /* auf den Punkt zentrieren */
    border: 0; padding: 0;
    border-radius: 50%;
    background: #005ca9; color: #fff;
    cursor: pointer;
    display: grid; place-items: center;
    box-shadow: 0 2px 6px rgba(0,0,0,.35);
    transition: transform .12s;
  }
  .kamera:hover { transform: scale(1.15); background: #00457f; }
  .kamera svg { width: 18px; height: 18px; fill: currentColor; }

  .name {
    position: absolute; transform: translate(-50%, 10px);
    background: rgba(28,37,48,.85); color: #fff;
    padding: 2px 6px; border-radius: 4px;
    font-size: 11px; white-space: nowrap; pointer-events: none;
  }
</style>
</head>
<body>
<header>
  <h1>Kameras auf dem Marktplan</h1>
  <p>Plan: ${(breiteCm / 100).toFixed(2).replace('.', ',')} m &times; ${(hoeheCm / 100).toFixed(2).replace('.', ',')} m &middot;
     Kamerapositionen stehen in <strong>Zentimetern im Markt</strong>.</p>
</header>

<div class="buehne" id="buehne">
  <img src="${schuetze(svgDateiname)}" alt="Marktplan">
</div>

<script>
/* --------------------------------------------------------------------------
   Die Maße des Plans, in Zentimetern. Sie stehen auch im SVG selbst
   (data-breite-cm / data-hoehe-cm), falls du sie von dort lesen willst.
   -------------------------------------------------------------------------- */
const PLAN = { breite: ${breiteCm}, hoehe: ${hoeheCm} };

/* Deine Kameras. x und y sind Zentimeter im Markt, gemessen von der linken
   oberen Ecke des Plans. url ist das, was beim Klick aufgehen soll –
   ein Stream, eine Detailseite, was auch immer. */
const KAMERAS = ${JSON.stringify(
    beispiele.map((k) => ({ ...k, url: 'https://beispiel.local/kamera/' + k.name.toLowerCase().replace(/\\s+/g, '-') })),
    null,
    2,
  )};

const buehne = document.getElementById('buehne');

for (const kamera of KAMERAS) {
  const knopf = document.createElement('button');
  knopf.className = 'kamera';
  knopf.title = kamera.name;
  // Prozent statt Pixel: So sitzt die Kamera bei jeder Fenstergröße richtig.
  knopf.style.left = (kamera.x / PLAN.breite * 100) + '%';
  knopf.style.top  = (kamera.y / PLAN.hoehe  * 100) + '%';
  knopf.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h3l2-2h6l2 2h3v12H4z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="3.2"/></svg>';
  knopf.addEventListener('click', () => oeffneKamera(kamera));
  buehne.appendChild(knopf);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = kamera.name;
  name.style.left = knopf.style.left;
  name.style.top  = knopf.style.top;
  buehne.appendChild(name);
}

function oeffneKamera(kamera) {
  /* Hier kommt hin, was bei dir passieren soll: ein Fenster mit dem Stream,
     ein Wechsel der Seite, ein Aufruf deiner Anlage. */
  window.open(kamera.url, '_blank', 'noopener');
}

/* Umgekehrt: Klick irgendwo auf den Plan gibt die Stelle in Zentimetern aus.
   So findest du die Koordinaten für neue Kameras, ohne zu messen. */
buehne.addEventListener('click', (e) => {
  if (e.target.closest('.kamera')) return;
  const kasten = buehne.getBoundingClientRect();
  const x = Math.round((e.clientX - kasten.left) / kasten.width  * PLAN.breite);
  const y = Math.round((e.clientY - kasten.top)  / kasten.height * PLAN.hoehe);
  console.log('Angeklickt bei x: ' + x + ', y: ' + y + '  (Zentimeter im Markt)');
});
</script>
</body>
</html>
`;
}
