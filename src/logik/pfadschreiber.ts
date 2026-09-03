/**
 * Ein Mitschreiber, der sich als Zeichenleinwand ausgibt.
 *
 * **Das Problem, das er löst.** Die Zeichnung eines Möbels steckt in gut
 * zweitausend Zeilen in `ElementSymbol.tsx`. Bisher stand in `webExport.ts`
 * die Begründung, warum die Ausgabe trotzdem ein eingebettetes Bild ist: Die
 * Zeichnung ein zweites Mal als SVG zu schreiben hieße, sie doppelt zu
 * pflegen – und die zweite Fassung wäre nach dem ersten neuen Möbel falsch.
 *
 * Das stimmt, aber es gibt einen dritten Weg: die Zeichnung **nicht noch
 * einmal schreiben, sondern mitschreiben**. `zeichneForm` bekommt ihre
 * Leinwand von außen und ruft darauf nur `moveTo`, `lineTo`, `rect`,
 * `arc`, `ellipse`, `arcTo` und `closePath`. Wer statt einer Leinwand dieses
 * Objekt hier hineingibt, bekommt dieselbe Geometrie als SVG-Pfad zurück.
 *
 * Damit gibt es weiterhin **eine** Quelle für jedes Symbol. Ein neues Möbel
 * erscheint in der Vektorausgabe von selbst, ohne dass jemand daran denkt.
 *
 * Ein Bogen wird in SVG als `A` geschrieben. Ein voller Kreis geht damit
 * nicht in einem Zug – ein Bogen von 360° hat Anfangs- und Endpunkt an
 * derselben Stelle, und SVG zeichnet dann gar nichts. Deshalb werden volle
 * Umläufe in zwei Hälften zerlegt.
 */

/**
 * Rundet und wirft überflüssige Nullen weg.
 *
 * Vier Stellen, gemessen und nicht geschätzt: Bei zwei Stellen wanderten die
 * Bögen um Bruchteile eines Bildpunkts, und im Vergleich Bildpunkt für
 * Bildpunkt gegen die Leinwand blieben rund 2400 Abweichungen an den
 * Topfrändern stehen. Mit vier Stellen sind es null. Die Zahlen stehen in
 * Zentimetern des Marktes, vier Stellen sind also ein Hundertstel Millimeter –
 * mehr als jeder Drucker auflöst, und der Zugewinn an Dateigröße ist klein.
 */
function z(wert: number): string {
  if (!Number.isFinite(wert)) return '0';
  return String(Math.round(wert * 10000) / 10000);
}

/** Ein Punkt auf einer Ellipse, gedreht um `drehung`. */
function aufEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  drehung: number,
  winkel: number,
): [number, number] {
  const cos = Math.cos(drehung);
  const sin = Math.sin(drehung);
  const x = rx * Math.cos(winkel);
  const y = ry * Math.sin(winkel);
  return [cx + x * cos - y * sin, cy + x * sin + y * cos];
}

export class Pfadschreiber {
  private teile: string[] = [];
  /** Wo der Stift gerade steht – für `arcTo` und für Bögen ohne `moveTo`. */
  private x = 0;
  private y = 0;
  private begonnen = false;

  moveTo(x: number, y: number): void {
    this.teile.push(`M ${z(x)} ${z(y)}`);
    this.x = x;
    this.y = y;
    this.begonnen = true;
  }

  lineTo(x: number, y: number): void {
    // Eine Linie ohne vorheriges `moveTo` fängt am Ursprung an – so macht es
    // die Leinwand auch, und der Plan sähe sonst anders aus als das PDF.
    if (!this.begonnen) this.moveTo(0, 0);
    this.teile.push(`L ${z(x)} ${z(y)}`);
    this.x = x;
    this.y = y;
  }

  /**
   * Ein Rechteck ist ein eigener Teilpfad.
   *
   * Wichtig für die Füllregel: Die Leinwand füllt nach „nonzero", und die
   * Blenden und Blumentöpfe nutzen das aus – ein Teilpfad in Gegenrichtung
   * schneidet ein Loch. Das SVG muss deshalb dieselbe Regel bekommen
   * (`fill-rule="nonzero"`, der Standard) und dieselben Teilpfade.
   */
  rect(x: number, y: number, breite: number, tiefe: number): void {
    this.teile.push(
      `M ${z(x)} ${z(y)} L ${z(x + breite)} ${z(y)} L ${z(x + breite)} ${z(y + tiefe)} ` +
        `L ${z(x)} ${z(y + tiefe)} Z`,
    );
    this.x = x;
    this.y = y;
    this.begonnen = true;
  }

  closePath(): void {
    if (this.begonnen) this.teile.push('Z');
  }

  arc(
    cx: number,
    cy: number,
    r: number,
    von: number,
    bis: number,
    gegenUhrzeiger = false,
  ): void {
    this.ellipse(cx, cy, r, r, 0, von, bis, gegenUhrzeiger);
  }

  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    drehung = 0,
    von = 0,
    bis = Math.PI * 2,
    gegenUhrzeiger = false,
  ): void {
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return;

    // Der überstrichene Winkel, mit Vorzeichen – so wie die Leinwand rechnet.
    //
    // Der volle Umlauf wird **zuerst** abgefangen. Ohne das fiel ein Kreis
    // gegen den Uhrzeigersinn – `arc(x, y, r, 0, 2π, true)`, so entstehen die
    // Löcher der Blumentöpfe – auf eine Spanne von null zusammen und
    // verschwand spurlos. Auf dem Bildschirm war er da, im PDF nicht.
    let spanne = bis - von;
    if (Math.abs(spanne) >= Math.PI * 2 - 1e-9) {
      spanne = gegenUhrzeiger ? -Math.PI * 2 : Math.PI * 2;
    } else if (gegenUhrzeiger) {
      if (spanne > 0) spanne -= Math.PI * 2;
    } else {
      if (spanne < 0) spanne += Math.PI * 2;
    }

    const [startX, startY] = aufEllipse(cx, cy, rx, ry, drehung, von);
    // Die Leinwand zieht eine Linie zum Bogenanfang, wenn schon ein Pfad
    // läuft. Ohne das hinge jeder Kreis frei in der Luft, und aus einer
    // durchgezogenen Kontur würden lauter Bruchstücke.
    if (this.begonnen) this.teile.push(`L ${z(startX)} ${z(startY)}`);
    else this.moveTo(startX, startY);

    const grad = (drehung * 180) / Math.PI;
    const richtung = spanne >= 0 ? 1 : 0;

    // In Halbkreisen: Ein Bogen von genau 360° hätte Anfang und Ende am
    // selben Punkt, und SVG zeichnete nichts. Ein voller Umlauf wird so zu
    // genau zwei Hälften; bei genau 180° ist der Bogen eindeutig, weil die
    // Laufrichtung ihn bestimmt.
    const stuecke = Math.max(1, Math.ceil(Math.abs(spanne) / Math.PI));
    for (let i = 1; i <= stuecke; i++) {
      const winkel = von + (spanne * i) / stuecke;
      const [px, py] = aufEllipse(cx, cy, rx, ry, drehung, winkel);
      const gross = Math.abs(spanne / stuecke) > Math.PI ? 1 : 0;
      this.teile.push(`A ${z(rx)} ${z(ry)} ${z(grad)} ${gross} ${richtung} ${z(px)} ${z(py)}`);
      this.x = px;
      this.y = py;
    }
    this.begonnen = true;
  }

  /**
   * Die abgerundete Ecke – zwei Strecken und der Bogen, der sie verbindet.
   *
   * Gebraucht von der Form `abgerundet`. Gerechnet wird wie auf der
   * Leinwand: der Kreis mit Halbmesser `r`, der beide Strecken berührt.
   */
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void {
    if (!this.begonnen) this.moveTo(x1, y1);
    const [x0, y0] = [this.x, this.y];

    const a = Math.hypot(x0 - x1, y0 - y1);
    const b = Math.hypot(x2 - x1, y2 - y1);
    if (r <= 0 || a === 0 || b === 0) {
      this.lineTo(x1, y1);
      return;
    }

    // Der Winkel an der Ecke; daraus der Abstand der Berührpunkte.
    const cos = ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / (a * b);
    const winkel = Math.acos(Math.min(1, Math.max(-1, cos)));
    if (winkel === 0 || Math.abs(winkel - Math.PI) < 1e-9) {
      this.lineTo(x1, y1);
      return;
    }
    const abstand = r / Math.tan(winkel / 2);
    // Mit einer Winzigkeit Luft: Bei einer rechtwinkligen Ecke ist
    // `Math.tan(Math.PI / 4)` nicht ganz 1, sondern 0,9999999999999999. Der
    // Abstand fiele damit um ein Billionstel zu groß aus, der Bogen würde
    // verworfen – und aus der runden Kopfgondel würde ein Rechteck. Genau das
    // ist beim Bildpunktvergleich gegen die Leinwand aufgefallen.
    const luft = 1 + 1e-9;
    if (abstand > a * luft || abstand > b * luft) {
      // Der Bogen passt wirklich nicht zwischen die Ecken – dann die Ecke.
      this.lineTo(x1, y1);
      return;
    }

    const aufA = Math.min(abstand, a);
    const aufB = Math.min(abstand, b);
    const t1: [number, number] = [x1 + ((x0 - x1) / a) * aufA, y1 + ((y0 - y1) / a) * aufA];
    const t2: [number, number] = [x1 + ((x2 - x1) / b) * aufB, y1 + ((y2 - y1) / b) * aufB];

    // Über welche Seite der Bogen läuft – am Kreuzprodukt abgelesen.
    const kreuz = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1);
    const richtung = kreuz > 0 ? 1 : 0;

    this.teile.push(`L ${z(t1[0])} ${z(t1[1])}`);
    this.teile.push(`A ${z(r)} ${z(r)} 0 0 ${richtung} ${z(t2[0])} ${z(t2[1])}`);
    this.x = t2[0];
    this.y = t2[1];
  }

  /** Fängt einen neuen Pfad an – das Bisherige bleibt stehen. */
  beginPath(): void {
    this.begonnen = false;
  }

  /** Der aufgezeichnete Pfad als SVG-Angabe. Leer, wenn nichts gezeichnet wurde. */
  get d(): string {
    return this.teile.join(' ');
  }

  get leer(): boolean {
    return this.teile.length === 0;
  }
}

/**
 * Nimmt eine Zeichenfunktion ab und gibt ihren Pfad zurück.
 *
 * Der Umweg über `unknown` ist nötig, weil die Zeichenfunktionen eine
 * `Konva.Context` erwarten. Sie rufen davon nur die Pfadbefehle auf – genau
 * die, die hier stehen. Ein Typ, der beides umfasst, gäbe es nur, wenn man
 * Konva selbst änderte.
 */
export function pfadVon(zeichne: (ctx: never) => void): string {
  const schreiber = new Pfadschreiber();
  zeichne(schreiber as never);
  return schreiber.d;
}
