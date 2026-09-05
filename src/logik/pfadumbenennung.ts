import type { PlanElement, Projekt, Warengruppenabschnitt } from '../typen/modell';

/**
 * Wenn ein Name in der Sortimentsliste sich ändert, ziehen die Pfade nach.
 *
 * Eine Warengruppenstrecke merkt sich, wohin sie zählt, als **Pfad** –
 * `Lebensmittel & Tabak (TroSo) › Feinbackwaren › Kuchen`. Derselbe Pfad ist
 * der Schlüssel des grünen Hakens in `Projekt.sortimentsstand`. Beides sind
 * Zeichenketten, und beide zeigen ins Leere, sobald jemand die Liste über den
 * Stift umbenennt.
 *
 * **Mit umgezogen wird auch die Beschriftung im Plan** – dort, wo sie den
 * Namen trägt und nichts Eigenes sagt. Sonst stünde am Möbel weiter der alte
 * Name, während die Rechnung schon den neuen benutzt: dieselbe Strecke mit
 * zwei Namen, und einer davon falsch.
 *
 * Ohne dieses Nachziehen sähe es so aus: „Feinbackwaren" wird zu „Feine
 * Backwaren", und in der Auswertung stehen danach **zwei** Abteilungen
 * nebeneinander – die neue, leere aus der Liste und die alte aus den
 * Strecken, ans Ende sortiert, weil die Liste sie nicht mehr kennt. Die
 * Haken des Zweigs wären ebenfalls weg.
 *
 * **Umbenannt wird nur, nicht gelöscht.** Wer eine Warengruppe entfernt,
 * behält ihre Meter im Plan – die Strecke steht ja weiter dort. Sie erscheint
 * dann unter einer Abteilung, die die Liste nicht mehr führt, und genau das
 * soll man sehen: Im Markt steht die Ware noch.
 */

/** Gilt dieser Pfad für den umbenannten Zweig – er selbst oder etwas darunter? */
function betroffen(pfad: string, alt: string): boolean {
  return pfad === alt || pfad.startsWith(`${alt} › `);
}

/** Setzt den neuen Anfang vor den Rest des Pfades. */
function ersetzt(pfad: string, alt: string, neu: string): string {
  return pfad === alt ? neu : neu + pfad.slice(alt.length);
}

/** Zwei Namen vergleichen, wie der Markt sie vergleicht. */
function gleich(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('de-DE') === b.trim().toLocaleLowerCase('de-DE');
}

/**
 * Die Beschriftung im Plan mit umbenennen – aber nur, wo sie den Namen trägt.
 *
 * **Der Text im Plan ist nicht der Pfad.** Wer „Marmorkuchen Aktion" auf drei
 * Meter schreibt und sie dem Kuchen zuordnet, meint beides so: Im Plan steht
 * seine Beschreibung, gezählt wird der Kuchen. Wird der Kuchen umbenannt,
 * bleibt „Marmorkuchen Aktion" stehen – der Satz gehört ihm und nicht der
 * Liste.
 *
 * Steht dort aber schlicht der Name, ist er derselbe Name und geht denselben
 * Weg. Sonst zeigte der Plan nach dem Umbenennen einen Namen, den die Liste
 * nicht mehr führt, und man müsste jede Strecke von Hand nachziehen.
 *
 * Bei zwei Sortimenten auf einer Strecke – „Nüsse, Trockenobst" – wird nur
 * der Teil ausgetauscht, um den es geht.
 */
function mitText(text: string, altName: string, neuName: string): string {
  if (!text.trim() || gleich(altName, neuName)) return text;
  // Erst der ganze Text: „Baguette, Stangen, Ciab." ist **ein** Name und
  // keine drei. Wer hier am Komma schnitte, machte drei halbe daraus.
  if (gleich(text, altName)) return text.trim() === text ? neuName : text.replace(text.trim(), neuName);

  if (!text.includes(',')) return text;
  const teile = text.split(',');
  let getroffen = false;
  const neue = teile.map((teil) => {
    if (!gleich(teil, altName)) return teil;
    getroffen = true;
    // Die Abstände ringsum bleiben, wie sie waren.
    return teil.replace(teil.trim(), neuName);
  });
  return getroffen ? neue.join(',') : text;
}

/** Die Abschnitte einer Seite mit nachgezogenen Pfaden – oder unverändert. */
function mitPfaden(
  abschnitte: Warengruppenabschnitt[] | undefined,
  alt: string,
  neu: string,
): Warengruppenabschnitt[] | undefined {
  if (!abschnitte) return abschnitte;
  const altName = alt.split(' › ').pop() ?? alt;
  const neuName = neu.split(' › ').pop() ?? neu;

  let geaendert = false;
  const gezogen = abschnitte.map((a) => {
    if (!a.pfad || !betroffen(a.pfad, alt)) return a;
    geaendert = true;
    // **Nur an Strecken, deren Pfad betroffen ist.** Ein „Kuchen" ohne Pfad
    // kann der aus den Backwaren sein oder der aus den Feinbackwaren; ihn
    // mit umzubenennen hieße raten.
    return { ...a, pfad: ersetzt(a.pfad, alt, neu), text: mitText(a.text, altName, neuName) };
  });
  return geaendert ? gezogen : abschnitte;
}

/**
 * Zieht einen umbenannten Pfad durch die ganze Planung.
 *
 * `alt` und `neu` sind volle Pfade: Für eine umbenannte Abteilung eine Stufe,
 * für eine Warengruppe zwei, für ein Sortiment drei. Was darunter hängt,
 * kommt mit – wer eine Abteilung umbenennt, benennt alle ihre Sortimente mit
 * um.
 *
 * Gibt dieselbe Planung zurück, wenn es nichts zu tun gab: So legt der
 * Datenspeicher keinen Schritt für Rückgängig an, bei dem sich nichts ändert.
 */
export function mitUmbenanntemPfad(projekt: Projekt, alt: string, neu: string): Projekt {
  if (!alt || !neu || alt === neu) return projekt;

  let geaendert = false;
  const elemente = (projekt.elemente ?? []).map((el): PlanElement => {
    const unten = mitPfaden(el.warengruppenUnten, alt, neu);
    const oben = mitPfaden(el.warengruppenOben, alt, neu);
    if (unten === el.warengruppenUnten && oben === el.warengruppenOben) return el;
    geaendert = true;
    return { ...el, warengruppenUnten: unten, warengruppenOben: oben };
  });

  // Der grüne Haken hängt am selben Pfad und muss denselben Weg gehen.
  let stand = projekt.sortimentsstand;
  if (stand) {
    const neuerStand: NonNullable<Projekt['sortimentsstand']> = {};
    let standGeaendert = false;
    for (const [pfad, wert] of Object.entries(stand)) {
      if (betroffen(pfad, alt)) {
        neuerStand[ersetzt(pfad, alt, neu)] = wert;
        standGeaendert = true;
      } else {
        neuerStand[pfad] = wert;
      }
    }
    if (standGeaendert) {
      stand = neuerStand;
      geaendert = true;
    }
  }

  // Und die Zuordnung „zählt zu": Sie steht auf Namen, nicht auf Pfaden – hier
  // zählt deshalb nur die **letzte** Stufe, und nur wenn sie sich ändert.
  const altName = alt.split(' › ').pop() ?? alt;
  const neuName = neu.split(' › ').pop() ?? neu;
  let zuordnungen = projekt.zuordnungen;
  if (zuordnungen && altName !== neuName) {
    const schluessel = altName.trim().toLocaleLowerCase('de-DE');
    const neue: Record<string, string> = {};
    let zuGeaendert = false;
    for (const [quelle, ziel] of Object.entries(zuordnungen)) {
      const quelleNeu = quelle === schluessel ? neuName.trim().toLocaleLowerCase('de-DE') : quelle;
      const zielNeu = ziel.trim().toLocaleLowerCase('de-DE') === schluessel ? neuName : ziel;
      if (quelleNeu !== quelle || zielNeu !== ziel) zuGeaendert = true;
      neue[quelleNeu] = zielNeu;
    }
    if (zuGeaendert) {
      zuordnungen = neue;
      geaendert = true;
    }
  }

  if (!geaendert) return projekt;
  return { ...projekt, elemente, sortimentsstand: stand, zuordnungen };
}
