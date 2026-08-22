import type { Gruppe, PlanElement } from '../typen/modell';
import { neueId } from './id';

/**
 * Kopien von Elementen anlegen – für Duplizieren und Einfügen.
 *
 * Eine Kopie ist mehr als dasselbe Element mit neuer Kennung. Jedes Element
 * trägt Verweise auf andere, und die dürfen nicht mitkopiert werden:
 *
 *  - **Die Gruppe.** Wurde sie übernommen, lag die Kopie in derselben Gruppe
 *    wie das Original. Ein Klick auf die Kopie wählte damit das Original mit
 *    aus, und beim Verschieben wanderte es mit – man kam gar nicht dazu, die
 *    Kopie allein zu bewegen.
 *  - **Die Kopfgondel.** Ein kopierter Zug hätte auf dieselben Köpfe gezeigt
 *    wie das Original. Beide hätten sie dann an ihr Ende gezogen, und der
 *    Kopf wäre zwischen ihnen hin- und hergesprungen.
 *
 * Die Regel dahinter ist immer dieselbe: Ein Verweis wird **umgehängt**, wenn
 * der Partner mitkopiert wird, und **fallen gelassen**, wenn nicht. Was zusammen
 * kopiert wird, bleibt zusammen; was allein kopiert wird, steht allein.
 */
export interface Vervielfaeltigung {
  elemente: PlanElement[];
  /** Neue Gruppen, die dabei entstanden sind. */
  gruppen: Gruppe[];
}

export function vervielfaeltige(
  vorlagen: PlanElement[],
  versatz: { x: number; y: number },
  ersteReihenfolge: number,
  vorhandeneGruppen: Gruppe[] = [],
): Vervielfaeltigung {
  const kennungen = new Map<string, string>();
  for (const el of vorlagen) kennungen.set(el.id, neueId('el'));

  // Jede Gruppe, aus der mehr als ein Element mitkommt, wird als eigene
  // Gruppe nachgebaut. Kommt nur ein einzelnes Mitglied mit, ergibt eine
  // Gruppe daraus keinen Sinn – ein Zug aus einem Regal ist kein Zug.
  const jeGruppe = new Map<string, number>();
  for (const el of vorlagen) {
    if (el.gruppeId) jeGruppe.set(el.gruppeId, (jeGruppe.get(el.gruppeId) ?? 0) + 1);
  }
  const neueGruppen = new Map<string, string>();
  const gruppen: Gruppe[] = [];
  for (const [alt, anzahl] of jeGruppe) {
    if (anzahl < 2) continue;
    const id = neueId('gruppe');
    neueGruppen.set(alt, id);
    const vorbild = vorhandeneGruppen.find((g) => g.id === alt);
    gruppen.push({ id, name: vorbild?.name ?? 'Kopie', art: vorbild?.art ?? 'frei' });
  }

  let reihenfolge = ersteReihenfolge;
  const elemente = vorlagen.map((el) => {
    const kopf = el.kopfgondeln;
    const anfang = kopf?.anfang ? kennungen.get(kopf.anfang) : undefined;
    const ende = kopf?.ende ? kennungen.get(kopf.ende) : undefined;

    return {
      ...structuredClone(el),
      id: kennungen.get(el.id)!,
      // Etwas versetzt, damit die Kopie sichtbar ist.
      x: el.x + versatz.x,
      y: el.y + versatz.y,
      gesperrt: false,
      reihenfolge: reihenfolge++,
      gruppeId: el.gruppeId ? neueGruppen.get(el.gruppeId) : undefined,
      // Der Kopf hängt am kopierten Zug, wenn dieser mitkam – sonst an nichts.
      kopfVon: el.kopfVon ? kennungen.get(el.kopfVon) : undefined,
      kopfgondeln: anfang || ende ? { anfang, ende } : undefined,
    };
  });

  return { elemente, gruppen };
}
