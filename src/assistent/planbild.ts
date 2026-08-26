import type { PlanElement, Projekt, Punkt } from '../typen/modell';

/**
 * Was der Assistent vom Plan zu sehen bekommt.
 *
 * Er sieht keine Zeichnung, sondern Text. Deshalb entscheidet diese Datei
 * darüber, wie gut er den Markt versteht – mehr als jeder Prompt.
 *
 * Zwei Auflösungen, mit Absicht getrennt:
 *
 *   `ueberblick`  geht bei **jeder** Frage mit. Er muss kurz sein, denn er
 *                 wiederholt sich in jeder Runde.
 *   `elementzeile` steckt in der Antwort des Werkzeugs `plan_lesen`, das er
 *                 selbst aufruft, wenn er Einzelheiten braucht.
 *
 * Der ganze Plan im System-Prompt wäre der naheliegende Weg und wäre falsch:
 * Nach dem ersten Verschieben stimmte er nicht mehr, und der Assistent
 * plante gegen einen Markt, den es nicht mehr gibt.
 */

/** Rundet auf ganze Zentimeter – Nachkommastellen liest hier niemand. */
function cm(wert: number): number {
  return Math.round(wert);
}

/**
 * Die Kennung, gekürzt auf ein handliches Maß.
 *
 * Eine volle Kennung ist `el-` und eine UUID – 39 Zeichen. In einem Plan mit
 * dreihundert Möbeln stehen davon zwölftausend Zeichen in jeder Liste, die
 * der Assistent liest, und er muss sie fehlerfrei abschreiben, um etwas
 * anzufassen. Acht Hexstellen unterscheiden dieselben dreihundert sicher;
 * aufgelöst wird über den Anfang (siehe `findeElement` in `werkzeuge.ts`).
 */
export function kurzeKennung(id: string): string {
  const strich = id.indexOf('-');
  if (strich < 0) return id;
  return id.slice(0, strich + 1) + id.slice(strich + 1).replace(/-/g, '').slice(0, 8);
}

/** `1234` → `12,34 m`. Für Angaben, bei denen Meter das Maß der Dinge sind. */
function meter(wert: number): string {
  return (wert / 100).toFixed(2).replace('.', ',') + ' m';
}

/**
 * Die Warengruppen einer Seite als ein Text.
 *
 * Steht eine Beschriftung über mehrere Felder, wird sie einmal genannt und
 * die Zahl der Meter dahinter: `Eier (2 F.)`. Genau so steht sie auch im
 * Feld – der Assistent soll dasselbe Bild haben wie die Gondelübersicht.
 */
function seitentext(felder: { breite: number; leer?: boolean; warengruppe?: { text: string; felder: number } }[] | undefined): string {
  if (!felder || felder.length === 0) return '';
  const teile: string[] = [];
  felder.forEach((f, i) => {
    if (f.warengruppe?.text) {
      const spanne = f.warengruppe.felder > 1 ? ` (${f.warengruppe.felder} F.)` : '';
      teile.push(`${i + 1}: ${f.warengruppe.text}${spanne}`);
    }
  });
  return teile.join('; ');
}

/**
 * Ein Element in einer Zeile.
 *
 * Die Kennung steht vorn, weil der Assistent sie zum Anfassen braucht und
 * sie sonst am Zeilenende zwischen Zahlen verschwindet.
 */
export function elementzeile(el: PlanElement): string {
  const teile = [
    kurzeKennung(el.id),
    `"${el.name}"`,
    `${el.kategorie}`,
    `Mitte ${cm(el.x)}/${cm(el.y)}`,
    `B${cm(el.breite)} T${cm(el.tiefe)}`,
  ];
  if (el.hoehe) teile.push(`H${cm(el.hoehe)}`);
  if (el.drehung) teile.push(`${Math.round(el.drehung)}°`);
  if (el.beidseitig) teile.push('beidseitig');
  if (el.gruppeId) teile.push(`Gruppe ${el.gruppeId}`);
  if (el.gesperrt) teile.push('gesperrt');
  if (el.beschriftung) teile.push(`Text "${el.beschriftung}"`);
  if (el.warengruppe) teile.push(`WG "${el.warengruppe}"`);

  const unten = seitentext(el.felderUnten);
  const oben = seitentext(el.felderOben);
  if (unten) teile.push(`unten[${unten}]`);
  if (oben) teile.push(`oben[${oben}]`);

  const koepfe: string[] = [];
  if (el.kopfgondeln?.anfang) koepfe.push(`Anfang "${el.kopfgondeln.anfang}"`);
  if (el.kopfgondeln?.ende) koepfe.push(`Ende "${el.kopfgondeln.ende}"`);
  if (koepfe.length > 0) teile.push(`Kopf: ${koepfe.join(', ')}`);

  return teile.join(' | ');
}

/** Zählt, wie viele Elemente je Kategorie im Plan stehen. */
function nachKategorie(elemente: PlanElement[]): string {
  const zaehler = new Map<string, number>();
  for (const el of elemente) zaehler.set(el.kategorie, (zaehler.get(el.kategorie) ?? 0) + 1);
  return [...zaehler.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
}

/**
 * Der kurze Stand, der bei jeder Frage mitgeht.
 *
 * Was hier fehlt, kann der Assistent über `plan_lesen` nachholen. Was hier
 * steht, muss er nicht erfragen – und das spart in jeder Runde einen
 * Werkzeugaufruf.
 */
export function ueberblick(projekt: Projekt, auswahl: string[]): string {
  const zeilen: string[] = [];
  zeilen.push(`Planung: "${projekt.name}"`);

  const umriss = projekt.grundflaeche.umriss;
  if (umriss.length > 0) {
    const g = umrissMasse(umriss);
    zeilen.push(
      `Grundfläche: ${umriss.length} Ecken, ${meter(g.breite)} × ${meter(g.hoehe)}, ` +
        `von ${cm(g.x)}/${cm(g.y)} bis ${cm(g.x + g.breite)}/${cm(g.y + g.hoehe)}`,
    );
  }

  zeilen.push(
    `Elemente: ${projekt.elemente.length}` +
      (projekt.elemente.length > 0 ? ` (${nachKategorie(projekt.elemente)})` : ''),
  );

  if (projekt.raeume.length > 0) {
    zeilen.push(
      `Räume: ` +
        projekt.raeume.map((r) => `${kurzeKennung(r.id)} "${r.name}" (${r.art})`).join(', '),
    );
  }
  if (projekt.verkaufsflaechen.length > 0) {
    zeilen.push(
      `Verkaufsflächen: ` +
        projekt.verkaufsflaechen.map((f) => `${kurzeKennung(f.id)} "${f.name}"`).join(', '),
    );
  }
  if (projekt.waende.length > 0) zeilen.push(`Freie Wände: ${projekt.waende.length}`);
  if (projekt.oeffnungen.length > 0) zeilen.push(`Öffnungen: ${projekt.oeffnungen.length}`);
  if (projekt.gruppen.length > 0) {
    zeilen.push(
      `Gruppen: ` +
        projekt.gruppen.map((g) => `${kurzeKennung(g.id)} "${g.name}" (${g.art})`).join(', '),
    );
  }
  if (projekt.masslinien.length > 0) zeilen.push(`Maßlinien: ${projekt.masslinien.length}`);

  zeilen.push(
    `Einstellungen: Anzeige in ${projekt.einstellungen.anzeigeEinheit}, ` +
      `Raster ${projekt.einstellungen.rasterWeite} cm` +
      (projekt.einstellungen.amRasterEinrasten ? ' (einrastend)' : ''),
  );

  if (auswahl.length > 0) {
    const namen = auswahl
      .map((id) => projekt.elemente.find((e) => e.id === id))
      .filter((e): e is PlanElement => !!e)
      .map((e) => `${kurzeKennung(e.id)} "${e.name}"`);
    zeilen.push(`Gerade ausgewählt (${auswahl.length}): ${namen.join(', ')}`);
  } else {
    zeilen.push('Gerade ist nichts ausgewählt.');
  }

  return zeilen.join('\n');
}

/** Umgrenzendes Rechteck eines Umrisses. */
function umrissMasse(umriss: Punkt[]): { x: number; y: number; breite: number; hoehe: number } {
  const xs = umriss.map((p) => p.x);
  const ys = umriss.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, breite: Math.max(...xs) - x, hoehe: Math.max(...ys) - y };
}
