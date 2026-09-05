import {
  mitAngeglichenenBeschriftungen,
  mitNachgezogenenPfaden,
  veralteteBeschriftungen,
  verwaistePfade,
  type Beschriftungsentscheidung,
  type VeralteteBeschriftung,
  type VerwaisterPfad,
} from '../logik/listenabgleich';
import { mitUmbenanntemPfad } from '../logik/pfadumbenennung';
import { ladeProjekt, listeProjekte, speichereProjekt } from './projektArchiv';
import type { Sortimentsliste } from '../daten/warengruppen';
import type { Projekt } from '../typen/modell';

/**
 * Der Abgleich einer neuen Sortimentsliste mit **allen** Planungen.
 *
 * Die Sortimentsliste gilt am Gerät für jede Planung. Wird sie ersetzt,
 * reißt die Verbindung nicht nur in der geöffneten – jede gespeicherte
 * Planung, die den umbenannten Eintrag benutzt, verliert ihn genauso. Nur die
 * geöffnete zu prüfen hieße, die anderen erst zu sehen, wenn man sie zufällig
 * öffnet.
 *
 * Deshalb werden hier alle durchgesehen. Die geöffnete kommt aus dem
 * Datenspeicher (sie kann ungespeicherte Änderungen tragen), die übrigen aus
 * der Datenbank.
 */

/** Was eine Planung an Pfaden verloren hat. */
export interface Planbericht {
  id: string;
  name: string;
  /** Die gerade geöffnete Planung – nachgezogen wird sie über den Datenspeicher. */
  offen: boolean;
  eintraege: VerwaisterPfad[];
}

/**
 * Prüft jede Planung gegen die neue Liste.
 *
 * Nur Planungen mit verwaisten Pfaden kommen zurück, die geöffnete zuerst.
 */
export async function pruefeAllePlanungen(
  liste: Sortimentsliste,
  offenes: Projekt,
): Promise<Planbericht[]> {
  const berichte: Planbericht[] = [];

  const eigene = verwaistePfade(offenes, liste);
  if (eigene.length > 0) {
    berichte.push({ id: offenes.id, name: offenes.name, offen: true, eintraege: eigene });
  }

  for (const info of await listeProjekte()) {
    if (info.id === offenes.id) continue;
    const projekt = await ladeProjekt(info.id);
    if (!projekt) continue;
    const eintraege = verwaistePfade(projekt, liste);
    if (eintraege.length > 0) {
      berichte.push({ id: projekt.id, name: projekt.name, offen: false, eintraege });
    }
  }
  return berichte;
}

/**
 * Zieht die Pfade einer **gespeicherten** Planung nach und legt sie wieder ab.
 *
 * Für die geöffnete Planung ist das der falsche Weg – dort würde die Fassung
 * aus der Datenbank die ungespeicherten Änderungen überschreiben. Sie wird
 * über den Datenspeicher nachgezogen (`ziehePfadeNach`).
 *
 * Zurück kommt, wie viele Pfade umgezogen sind.
 */
export async function ziehePlanungNach(id: string, umzug: Map<string, string>): Promise<number> {
  const projekt = await ladeProjekt(id);
  if (!projekt) return 0;
  const elemente = mitNachgezogenenPfaden(projekt, umzug);
  if (!elemente) return 0;
  await speichereProjekt({ ...projekt, elemente });
  return umzug.size;
}

// ===========================================================================
//  Umbenennen: alle Planungen, nicht nur die offene
// ===========================================================================

/**
 * Zieht ein Umbenennen durch **jede gespeicherte** Planung.
 *
 * Die Sortimentsliste gehört zum Gerät und gilt für alle Märkte. Wer sie
 * ändert, während Zierenberg offen ist, ändert sie damit auch für Kassel und
 * Baunatal – nur merkten die es bisher nicht: Ihre Strecken behielten den
 * alten Pfad und den alten Namen, bis man sie zufällig öffnete. Dann stand
 * dort ein Name, den die Liste nicht mehr führt, die Meter liefen in eine
 * eigene Zeile am Ende der Auswertung, und die grünen Haken fehlten.
 *
 * Die **offene** Planung ist ausgenommen: Sie kann ungespeicherte Änderungen
 * tragen, die eine Fassung aus der Datenbank überschriebe. Um sie kümmert
 * sich der Datenspeicher.
 *
 * **Welche offen ist, wird bei jedem Schritt neu gefragt** und nicht einmal
 * zu Beginn festgehalten. Der Lauf geht über die Datenbank, während der
 * Planer weiterarbeitet – öffnet er mittendrin einen anderen Markt, würde
 * dieser sonst unter ihm weggeschrieben und seine ungespeicherten Änderungen
 * wären fort.
 *
 * Zurück kommt, wie viele Planungen sich geändert haben.
 */
export async function benenneInAllenPlanungenUm(
  alt: string,
  neu: string,
  auchOhnePfad: boolean,
  istOffen: () => string,
): Promise<number> {
  let zahl = 0;
  for (const info of await listeProjekte()) {
    if (info.id === istOffen()) continue;
    const projekt = await ladeProjekt(info.id);
    if (!projekt) continue;
    const gezogen = mitUmbenanntemPfad(projekt, alt, neu, auchOhnePfad);
    // `mitUmbenanntemPfad` gibt dieselbe Planung zurück, wenn nichts zu tun
    // war – dann wird auch nichts geschrieben. Sonst bekäme jede Planung bei
    // jedem Umbenennen ein neues Änderungsdatum und liefe durch den Abgleich.
    if (gezogen === projekt) continue;
    await speichereProjekt(gezogen);
    zahl++;
  }
  return zahl;
}

// ===========================================================================
//  Beschriftungen angleichen
// ===========================================================================

/** Was eine Planung an veralteten Beschriftungen trägt. */
export interface Beschriftungsbericht {
  id: string;
  name: string;
  /** Die gerade geöffnete Planung – angeglichen wird sie über den Datenspeicher. */
  offen: boolean;
  eintraege: VeralteteBeschriftung[];
}

/**
 * Sieht in **jeder** Planung nach, welche Beschriftung nicht mehr zur Liste passt.
 *
 * Angefasst wird nichts – nur gezeigt. Welcher Text veraltet ist und welcher
 * ein eigener Satz, weiß nur der Planer.
 */
export async function pruefeBeschriftungen(
  liste: Sortimentsliste,
  offenes: Projekt,
): Promise<Beschriftungsbericht[]> {
  const berichte: Beschriftungsbericht[] = [];

  const eigene = veralteteBeschriftungen(offenes, liste);
  if (eigene.length > 0) {
    berichte.push({ id: offenes.id, name: offenes.name, offen: true, eintraege: eigene });
  }

  for (const info of await listeProjekte()) {
    if (info.id === offenes.id) continue;
    const projekt = await ladeProjekt(info.id);
    if (!projekt) continue;
    const eintraege = veralteteBeschriftungen(projekt, liste);
    if (eintraege.length > 0) {
      berichte.push({ id: projekt.id, name: projekt.name, offen: false, eintraege });
    }
  }
  return berichte;
}

/**
 * Gleicht die Beschriftungen einer **gespeicherten** Planung an und legt sie ab.
 *
 * Für die geöffnete ist das der falsche Weg – dort würde die Fassung aus der
 * Datenbank ungespeicherte Änderungen überschreiben. Sie geht über den
 * Datenspeicher (`gleicheBeschriftungenAn`), damit auch Strg+Z sie zurückholt.
 */
export async function gleicheBeschriftungenAnIn(
  id: string,
  entscheidungen: Map<string, Beschriftungsentscheidung>,
): Promise<number> {
  const projekt = await ladeProjekt(id);
  if (!projekt) return 0;
  const ergebnis = mitAngeglichenenBeschriftungen(projekt, entscheidungen);
  if (!ergebnis) return 0;
  await speichereProjekt({ ...projekt, elemente: ergebnis.elemente });
  return ergebnis.zahl;
}

// ===========================================================================
//  Was hängt an einem Eintrag, den jemand löschen will?
// ===========================================================================

/** Trägt diese Strecke diesen Zweig – ihn selbst oder etwas darunter? */
function zaehltDazu(pfad: string | undefined, zweig: string): boolean {
  return !!pfad && (pfad === zweig || pfad.startsWith(`${zweig} › `));
}

/** Zwei Namen vergleichen, wie der Markt sie vergleicht. */
const zeichen = (text: string) => text.trim().toLocaleLowerCase('de-DE');

/**
 * Wie viele Meter in wie vielen Planungen an diesem Eintrag hängen.
 *
 * **Löschen ist nicht Umbenennen.** Wer einen Eintrag aus der Liste nimmt,
 * nimmt ihn nicht aus dem Markt: Die Strecke steht weiter am Möbel, ihre Meter
 * zählen weiter – nur gehören sie ab dann zu nichts mehr. In der Auswertung
 * rutschen sie ans Ende, unter einen Namen, den die Liste nicht kennt, und der
 * grüne Haken ist weg.
 *
 * Das kann gewollt sein. Aber man soll es wissen, bevor man es tut, und dafür
 * braucht es eine Zahl: „steht auf 12,40 m in 2 Planungen" ist eine Antwort,
 * „bist du sicher?" ist keine.
 *
 * Gemessen wird in **Zentimetern** und über alle Ebenen – auch die
 * ausgeblendeten, denn ausgeblendet heißt nicht abgebaut.
 */
export async function metersAmEintrag(
  zweig: string,
  offenes: Projekt,
): Promise<{ meter: number; planungen: number }> {
  let meter = 0;
  let planungen = 0;

  // Auch **frei getippte** Meter zählen mit: Sie tragen den Namen ohne Pfad,
  // und wer den Eintrag löscht, verliert ihre Verbindung genauso. Eine Zahl,
  // die zu klein ist, wiegt in Sicherheit.
  const name = zeichen(zweig.split(' › ').pop() ?? zweig);

  const zaehle = (projekt: Projekt) => {
    let eigen = 0;
    for (const element of projekt.elemente ?? []) {
      for (const a of [...(element.warengruppenUnten ?? []), ...(element.warengruppenOben ?? [])]) {
        const trifft = a.pfad ? zaehltDazu(a.pfad, zweig) : zeichen(a.text) === name;
        if (trifft) eigen += Math.max(0, a.bis - a.von);
      }
    }
    if (eigen > 0) {
      meter += eigen;
      planungen++;
    }
  };

  zaehle(offenes);
  for (const info of await listeProjekte()) {
    if (info.id === offenes.id) continue;
    const projekt = await ladeProjekt(info.id);
    if (projekt) zaehle(projekt);
  }
  return { meter: Math.round(meter), planungen };
}
