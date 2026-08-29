import { describe, expect, it } from 'vitest';
import { rechteck, rahmen } from '../../logik/polygon';
import type { Raum } from '../../typen/modell';
import { textbreite } from '../../logik/beschriftung';
import { beschriftungsplatz, kantenmasse, kantenmasseOhneUeberdeckung } from './Raeume';

/**
 * Beschriftung und Kantenmaße abgetrennter Räume.
 *
 * Beides fiel im Plan negativ auf: Der Name stand quer über der Wand oder im
 * Nachbarraum, und an den Kanten fehlte das Maß, obwohl man beim Abzeichnen
 * eines Bestandsplans genau danach zieht.
 */

const raum = (breite: number, tiefe: number, name = 'Lager', wandstaerke = 15): Raum => ({
  id: 'r1',
  name,
  umriss: rechteck(0, 0, breite, tiefe),
  art: 'lager',
  wandstaerke,
  farbe: '#f0e9db',
  beschriftungSichtbar: true,
  gesperrt: false,
});

describe('Kantenmaße', () => {
  it('gibt jeder Kante ihr Maß', () => {
    const kanten = kantenmasse(raum(1000, 600));
    expect(kanten.map((k) => Math.round(k.laenge))).toEqual([1000, 600, 1000, 600]);
  });

  it('dreht die Zahlen so, dass sie lesbar bleiben', () => {
    // Kopfstehend wäre alles jenseits von ±90 Grad.
    for (const k of kantenmasse(raum(1000, 600))) {
      expect(k.drehung).toBeGreaterThanOrEqual(-90);
      expect(k.drehung).toBeLessThanOrEqual(90);
    }
  });

  it('rückt die Zahl nach innen, nicht in die Wand', () => {
    const kanten = kantenmasse(raum(1000, 600));
    // Die obere Kante liegt bei y=0; ihre Zahl muss darunter stehen.
    const oben = kanten.find((k) => Math.abs(k.laenge - 1000) < 1 && k.y < 300);
    expect(oben!.y).toBeGreaterThan(0);
  });

  it('lässt sehr kurze Kanten aus', () => {
    // Ein Türversatz von 20 cm – die Zahl wäre länger als die Kante.
    const eckig: Raum = {
      ...raum(1000, 600),
      umriss: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 600 },
        { x: 980, y: 600 },
        { x: 980, y: 620 },
        { x: 0, y: 620 },
      ],
    };
    expect(kantenmasse(eckig).every((k) => k.laenge >= 30)).toBe(true);
  });
});

describe('Beschriftung im Raum', () => {
  it('nimmt in einem großen Raum die volle Größe', () => {
    const platz = beschriftungsplatz(raum(2000, 1200), rahmen(rechteck(0, 0, 2000, 1200)));
    expect(platz!.schrift).toBeGreaterThan(30);
  });

  it('macht die Schrift in einem kleinen Raum kleiner', () => {
    const gross = beschriftungsplatz(raum(2000, 1200), rahmen(rechteck(0, 0, 2000, 1200)));
    const klein = beschriftungsplatz(raum(220, 160, 'WC'), rahmen(rechteck(0, 0, 220, 160)));
    expect(klein!.schrift).toBeLessThan(gross!.schrift);
  });

  it('hält den Text im Inneren – nicht in der Wand', () => {
    const r = raum(600, 400, 'Kühlraum', 20);
    const platz = beschriftungsplatz(r, rahmen(r.umriss))!;
    expect(platz.x).toBeGreaterThanOrEqual(r.wandstaerke);
    expect(platz.x + platz.breite).toBeLessThanOrEqual(600 - r.wandstaerke);
  });

  it('setzt den Namen in den breiten Schenkel eines L-Raums', () => {
    // Eine Metzgerei wie im Bestandsplan: ein schmaler langer Schenkel und
    // ein breiterer Kopf. In den schmalen passt der Name nicht.
    const metzgerei: Raum = {
      ...raum(0, 0, 'Metzgerei', 15),
      umriss: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 600 },
        { x: 900, y: 600 },
        { x: 900, y: 1000 },
        { x: 0, y: 1000 },
      ],
    };
    const platz = beschriftungsplatz(metzgerei, rahmen(metzgerei.umriss));
    expect(platz).not.toBeNull();
    // Der Text muss im unteren, breiten Teil liegen – nicht im schmalen Arm.
    expect(platz!.y).toBeGreaterThan(600);
    // Und er darf nicht über den Raum hinausragen.
    expect(platz!.x).toBeGreaterThanOrEqual(0);
    expect(platz!.x + platz!.breite).toBeLessThanOrEqual(900);
  });

  it('setzt den Namen eines umgreifenden Lagers in seinen breitesten Teil', () => {
    // Ein Hauptlager, das um einen Kühlraum herumgreift: oben schmal,
    // rechts breit. Die Mitte des umschließenden Kastens läge im Kühlraum.
    const lager: Raum = {
      ...raum(0, 0, 'Hauptlager', 24),
      umriss: [
        { x: 0, y: 0 },
        { x: 1600, y: 0 },
        { x: 1600, y: 1200 },
        { x: 0, y: 1200 },
        { x: 0, y: 900 },
        { x: 700, y: 900 },
        { x: 700, y: 300 },
        { x: 0, y: 300 },
      ],
    };
    const platz = beschriftungsplatz(lager, rahmen(lager.umriss))!;
    expect(platz).not.toBeNull();
    // Der ausgesparte Block liegt zwischen x 0–700 und y 300–900.
    const mitteX = platz.x + platz.breite / 2;
    const mitteY = platz.y;
    const inDerAussparung = mitteX < 700 && mitteY > 300 && mitteY < 900;
    expect(inDerAussparung).toBe(false);
  });

  it('lässt die Beschriftung weg, wo nichts mehr hineinpasst', () => {
    // Eine Putzkammer von 60 auf 40 cm: Dort ist kein Platz für Text.
    expect(beschriftungsplatz(raum(60, 40, 'Putz'), rahmen(rechteck(0, 0, 60, 40)))).toBeNull();
  });

  it('setzt den Text mittig – auch bei einem L-förmigen Raum', () => {
    // Die Mitte des umschließenden Kastens läge hier in der Kerbe, also
    // außerhalb des Raums.
    const l: Raum = {
      ...raum(1000, 1000),
      umriss: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 600 },
        { x: 1000, y: 600 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ],
    };
    const platz = beschriftungsplatz(l, rahmen(l.umriss))!;
    const mitte = { x: platz.x + platz.breite / 2, y: platz.y };
    // Der Schwerpunkt liegt im unteren Balken des L – dort gehört der Text
    // hin, nicht in die Kerbe oben rechts.
    expect(mitte.y).toBeGreaterThan(500);
  });


  it('schätzt die Textbreite auch ohne Leinwand nach oben ab', () => {
    // In den Prüfungen gibt es kein Canvas – die Schätzung muss trotzdem
    // mit der Schriftgröße wachsen, sonst wäre jede Schrift gleich groß.
    expect(textbreite('Lager', 40)).toBeGreaterThan(textbreite('Lager', 20));
    expect(textbreite('Getränkelager', 40)).toBeGreaterThan(textbreite('WC', 40));
  });

  it('rechnet mit dem längsten Wort, nicht mit dem ganzen Text', () => {
    const kurz = beschriftungsplatz(raum(400, 300, 'WC'), rahmen(rechteck(0, 0, 400, 300)))!;
    const lang = beschriftungsplatz(
      raum(400, 300, 'Sozialraum mit Umkleide'),
      rahmen(rechteck(0, 0, 400, 300)),
    )!;
    expect(lang.schrift).toBeLessThan(kurz.schrift);
  });
});

describe('Kantenmaße mehrerer Räume nebeneinander', () => {
  /**
   * Der Fall aus dem Plan: ein Flur, daneben zwei kleine Räume, alle Wand an
   * Wand. Jeder Raum für sich wüsste nichts von seinen Nachbarn – und wo
   * zwei aneinanderstoßen, landeten beide Zahlen an derselben Stelle. Bei
   * den kleinen Räumen lagen dann drei Maße übereinander.
   */
  const nebeneinander: Raum[] = [
    { ...raum(400, 300, 'Flur', 12), id: 'flur', umriss: rechteck(0, 0, 400, 300) },
    { ...raum(150, 200, 'Personal WC', 12), id: 'wc', umriss: rechteck(400, 0, 150, 200) },
    { ...raum(250, 200, 'Technik', 12), id: 'technik', umriss: rechteck(550, 0, 250, 200) },
  ];

  /** Nimmt den Platz, den eine Zahl einnimmt – wie in der Zeichnung. */
  const kasten = (k: { x: number; y: number; laenge: number; drehung: number }, schrift = 28) => {
    const halbB = (String(k.laenge).length * 0.62 * schrift) / 2 + schrift * 0.3;
    const halbH = schrift * 0.8;
    const quer = Math.abs(k.drehung) > 45;
    return {
      x1: k.x - (quer ? halbH : halbB), y1: k.y - (quer ? halbB : halbH),
      x2: k.x + (quer ? halbH : halbB), y2: k.y + (quer ? halbB : halbH),
    };
  };

  it('lässt keine zwei Zahlen übereinander stehen', () => {
    const je = kantenmasseOhneUeberdeckung(nebeneinander, 'm', 28);
    const alle = [...je.values()].flat();
    for (let i = 0; i < alle.length; i++) {
      for (let j = i + 1; j < alle.length; j++) {
        const a = kasten(alle[i]);
        const b = kasten(alle[j]);
        const ueberlappt = a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
        expect(ueberlappt).toBe(false);
      }
    }
  });

  it('behält dabei die Maße der langen Wände', () => {
    const je = kantenmasseOhneUeberdeckung(nebeneinander, 'm', 28);
    const laengen = [...je.values()].flat().map((k) => Math.round(k.laenge));
    // Die 400er Kante des Flurs ist die längste – sie muss dabei sein.
    expect(laengen).toContain(400);
  });

  it('zeigt bei einem einzelnen Raum weiter alle vier Kanten', () => {
    const je = kantenmasseOhneUeberdeckung([nebeneinander[0]], 'm', 28);
    expect(je.get('flur')).toHaveLength(4);
  });
});
