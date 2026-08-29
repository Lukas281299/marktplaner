import { describe, expect, it } from 'vitest';
import { rechteck, rahmen } from '../../logik/polygon';
import type { Raum } from '../../typen/modell';
import { beschriftungsplatz, kantenmasse, schwerpunkt, textbreite } from './Raeume';

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

  it('findet den Flächenschwerpunkt eines Rechtecks in seiner Mitte', () => {
    const s = schwerpunkt(rechteck(0, 0, 800, 400));
    expect(Math.round(s.x)).toBe(400);
    expect(Math.round(s.y)).toBe(200);
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
