import { mitNachgezogenenPfaden, verwaistePfade, type VerwaisterPfad } from '../logik/listenabgleich';
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
