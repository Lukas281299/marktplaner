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
 * **Bögen werden zu Bézierkurven.** SVG kennt zwar einen eigenen Bogenbefehl,
 * PDF aber nicht – dort gibt es nur Strecken und kubische Kurven. Damit beide
 * Ausgaben denselben Pfad benutzen können und nicht zwei Fassungen entstehen,
 * wird jeder Bogen schon hier in Kurvenstücke von höchstens 90° zerlegt. Der
 * Fehler dieser Näherung liegt bei einem Zehntausendstel des Halbmessers; bei
 * einem Regal von zwei Metern sind das zwei Hundertstel Millimeter.
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

/**
 * Die Richtung, in die eine gedrehte Ellipse an dieser Stelle läuft.
 *
 * Gebraucht für die Griffe der Bézierkurven: Eine Kurve bildet einen Bogen
 * nur dann sauber nach, wenn ihre Griffe genau auf den Tangenten liegen.
 */
function tangente(
  rx: number,
  ry: number,
  drehung: number,
  winkel: number,
): [number, number] {
  const cos = Math.cos(drehung);
  const sin = Math.sin(drehung);
  const dx = -rx * Math.sin(winkel);
  const dy = ry * Math.cos(winkel);
  return [dx * cos - dy * sin, dx * sin + dy * cos];
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

  /** Eine Strecke, ohne den Ursprungsersatz von `lineTo`. */
  private strecke(x: number, y: number): void {
    this.teile.push(`L ${z(x)} ${z(y)}`);
    this.x = x;
    this.y = y;
  }

  /** Eine kubische Kurve – die einzige Krümmung, die auch PDF kennt. */
  private kurve(
    g1x: number,
    g1y: number,
    g2x: number,
    g2y: number,
    x: number,
    y: number,
  ): void {
    this.teile.push(`C ${z(g1x)} ${z(g1y)} ${z(g2x)} ${z(g2y)} ${z(x)} ${z(y)}`);
    this.x = x;
    this.y = y;
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
    if (this.begonnen) this.strecke(startX, startY);
    else this.moveTo(startX, startY);

    // In Stücken von höchstens 90°: Darüber wird die Näherung durch eine
    // kubische Kurve sichtbar ungenau.
    const stuecke = Math.max(1, Math.ceil(Math.abs(spanne) / (Math.PI / 2)));
    const schritt = spanne / stuecke;
    // Der Griffabstand einer Kurve, die einen Bogen von `schritt` nachbildet.
    const griff = (4 / 3) * Math.tan(schritt / 4);

    let winkel = von;
    for (let i = 0; i < stuecke; i++) {
      const naechster = winkel + schritt;
      const [x1, y1] = aufEllipse(cx, cy, rx, ry, drehung, winkel);
      const [x2, y2] = aufEllipse(cx, cy, rx, ry, drehung, naechster);
      // Die Ableitung der Ellipse an beiden Enden gibt die Richtung der Griffe.
      const [ax, ay] = tangente(rx, ry, drehung, winkel);
      const [bx, by] = tangente(rx, ry, drehung, naechster);
      this.kurve(x1 + ax * griff, y1 + ay * griff, x2 - bx * griff, y2 - by * griff, x2, y2);
      winkel = naechster;
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

    this.strecke(t1[0], t1[1]);
    // Der Mittelpunkt des Berührkreises liegt auf der Winkelhalbierenden.
    const mx = (t1[0] + t2[0]) / 2 - x1;
    const my = (t1[1] + t2[1]) / 2 - y1;
    const laenge = Math.hypot(mx, my) || 1;
    const zurMitte = r / Math.sin(winkel / 2);
    const cx = x1 + (mx / laenge) * zurMitte;
    const cy = y1 + (my / laenge) * zurMitte;
    const vonWinkel = Math.atan2(t1[1] - cy, t1[0] - cx);
    let bisWinkel = Math.atan2(t2[1] - cy, t2[0] - cx);
    // Über den kurzen Weg – der Bogen einer abgerundeten Ecke ist immer der
    // kleinere der beiden.
    if (richtung === 1 && bisWinkel < vonWinkel) bisWinkel += Math.PI * 2;
    if (richtung === 0 && bisWinkel > vonWinkel) bisWinkel -= Math.PI * 2;
    this.ellipse(cx, cy, r, r, 0, vonWinkel, bisWinkel, richtung === 0);
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
