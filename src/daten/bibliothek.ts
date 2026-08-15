import type { BibliothekEintrag } from '../typen/modell';

/**
 * Die mitgelieferte Elementbibliothek.
 *
 * Alle Maße sind in Zentimetern angegeben und entsprechen üblichen Größen im
 * Lebensmitteleinzelhandel. Sie sind nur Startwerte – nach dem Platzieren kann
 * jedes Element frei verändert werden.
 *
 * Die allgemeinen Einträge benutzen einfache Grundformen. Daneben stehen
 * nachgezeichnete Wanzl-Symbole (BakeOff, Vitable) mit den Maßen aus den
 * zugehörigen Workbooks – erkennbar an der Form, die den Systemnamen trägt.
 * Für ein neues Symbol muss nur `Grundform` erweitert und in
 * `ElementSymbol.tsx` ein weiterer Fall ergänzt werden.
 */

/**
 * Das Grün der Obst- und Gemüsemöbel, abgenommen aus dem Wanzl-Plan.
 * Steht als eigener Wert hier oben, weil es in vielen Einträgen vorkommt.
 */
const OG_GRUEN = '#1a7a1a';
export const BIBLIOTHEK: BibliothekEintrag[] = [
  // ---------------------------------------------------------------- Regale
  { id: 'regal-trocken', name: 'Trockensortimentsregal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 200, form: 'rechteck', farbe: '#d9d0c1', hinweis: 'Einseitiges Regalfeld, 125 cm' },
  { id: 'regal-wand', name: 'Wandregal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 220, form: 'rechteck', farbe: '#d4c9b6', hinweis: 'Regal an der Außenwand' },
  { id: 'regal-gondel', name: 'Gondelregal', kategorie: 'regale', breite: 125, tiefe: 120, hoehe: 180, form: 'rechteck', farbe: '#cfc3ad', hinweis: 'Doppelseitiges Regal in der Gasse' },
  { id: 'regal-kopf', name: 'Kopfregal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 180, form: 'rechteck', farbe: '#e2d6c2', hinweis: 'Stirnseite einer Gondel' },
  { id: 'regal-getraenke', name: 'Getränkeregal', kategorie: 'regale', breite: 125, tiefe: 80, hoehe: 180, form: 'rechteck', farbe: '#cdd3c0', hinweis: 'Für Kästen und Mehrwegflaschen' },
  { id: 'regal-wein', name: 'Weinregal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 200, form: 'rechteck', farbe: '#cbbfae' },
  { id: 'regal-drogerie', name: 'Drogerieregal', kategorie: 'regale', breite: 125, tiefe: 50, hoehe: 200, form: 'rechteck', farbe: '#ded5c7' },
  { id: 'regal-nonfood', name: 'Non-Food-Regal', kategorie: 'regale', breite: 125, tiefe: 60, hoehe: 200, form: 'rechteck', farbe: '#d7cdbd' },
  { id: 'regal-brot', name: 'Brotregal', kategorie: 'regale', breite: 100, tiefe: 80, hoehe: 180, form: 'rechteck', farbe: '#e3d3b6' },
  { id: 'regal-zeitschriften', name: 'Zeitschriftenregal', kategorie: 'regale', breite: 125, tiefe: 50, hoehe: 160, form: 'rechteck', farbe: '#dcd4c6' },

  // ------------------------------------------------ Kühlung & Tiefkühlung
  { id: 'kuehl-regal', name: 'Kühlregal', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#b9d7ea', hinweis: 'Offenes Kühlregal' },
  { id: 'kuehl-wand', name: 'Wandkühlregal', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#aecfe4' },
  { id: 'kuehl-gondel', name: 'Kühlgondel', kategorie: 'kuehlung', breite: 250, tiefe: 110, hoehe: 120, form: 'abgerundet', farbe: '#a5c9e0' },
  { id: 'tk-truhe', name: 'Tiefkühltruhe', kategorie: 'kuehlung', breite: 200, tiefe: 90, hoehe: 90, form: 'abgerundet', farbe: '#94bedb', hinweis: 'Waagerechte Truhe' },
  { id: 'tk-schrank', name: 'Tiefkühlschrank', kategorie: 'kuehlung', breite: 125, tiefe: 90, hoehe: 200, form: 'rechteck', farbe: '#88b6d6', hinweis: 'Stehender TK-Schrank mit Glastüren' },
  { id: 'kuehl-molkerei', name: 'Molkereiprodukte-Kühlung', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#c3ddec' },
  { id: 'kuehl-fleisch-sb', name: 'Fleisch-SB-Kühlung', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#d9c2c8' },
  { id: 'kuehl-wurst-sb', name: 'Wurst-SB-Kühlung', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#dcc8cd' },
  { id: 'kuehl-getraenke', name: 'Getränke-Kühlung', kategorie: 'kuehlung', breite: 125, tiefe: 80, hoehe: 200, form: 'rechteck', farbe: '#b0d4e6' },

  // ------------------------------------------------------ Frischeabteilung
  { id: 'frische-og-flaeche', name: 'Obst- und Gemüsefläche', kategorie: 'obstgemuese', breite: 500, tiefe: 400, hoehe: 0, form: 'rechteck', farbe: '#cfe4c2', hinweis: 'Gesamte O&G-Zone als Fläche – Zonenmarkierung, kein Möbel' },
  { id: 'theke-fleisch', name: 'Fleischtheke', kategorie: 'frische', breite: 250, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#e2bdbd' },
  { id: 'theke-wurst', name: 'Wursttheke', kategorie: 'frische', breite: 250, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#e5c6c2' },
  { id: 'theke-kaese', name: 'Käsetheke', kategorie: 'frische', breite: 200, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#eeddb4' },
  { id: 'theke-fisch', name: 'Fischtheke', kategorie: 'frische', breite: 200, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#c2dbe2' },
  { id: 'theke-backwaren', name: 'Backwarentheke', kategorie: 'frische', breite: 250, tiefe: 100, hoehe: 130, form: 'rechteck', farbe: '#e6cfa4', hinweis: 'Bedientheke – für Selbstbedienung siehe Backwaren' },
  { id: 'frische-salatbar', name: 'Salatbar', kategorie: 'frische', breite: 150, tiefe: 100, hoehe: 120, form: 'abgerundet', farbe: '#cbe3bb' },
  { id: 'theke-heiss', name: 'Heiße Theke', kategorie: 'frische', breite: 200, tiefe: 100, hoehe: 130, form: 'rechteck', farbe: '#e7c39c' },

  // ------------------------------------------------------- Obst und Gemüse
  //
  // Vitable von Wanzl. Maße aus dem Workbook (Version 38 / 10-2025).
  //
  // Achsmaße: 1000 und 1250 mm. Höhen: 1100, 1300, 1600, 1800, 2000 mm.
  // Auflagen gibt es in 400, 600, 800 und 1200 mm Tiefe.
  //
  // Die Varianten stehen im Workbook als Auflagenkette, zum Beispiel
  // „H 1800 / T 800 + T600 + T400": unterste Auflage 800 tief, darüber 600,
  // oben 400. Die Gesamttiefe des Möbels ist die tiefste Auflage – genau so
  // steht es unten in `tiefe`, und die Kette in `stufen`.
  // Die Gesamttiefe ist NICHT die tiefste Auflage: Die Front kragt über den
  // Korpus hinaus. Beide Maße stehen in den Schnittzeichnungen des Workbooks
  // und sind hier eingetragen – `tiefe` ist der Platzbedarf am Boden,
  // `korpustiefe` das, was tatsächlich darauf steht.
  //
  //   T800-Varianten   Korpus  726 mm   Gesamttiefe   955 mm
  //   T1200-Varianten  Korpus  908 mm   Gesamttiefe  1317 mm

  // ---- einseitig, Achsmaß 1000
  { id: 'vt-1000-h1100-800', name: 'O&G 1,00 m · H1100 · T800', kategorie: 'obstgemuese', breite: 100, tiefe: 95.5, korpustiefe: 72.6, hoehe: 110, form: 'vitable', farbe: OG_GRUEN, stufen: [80], hinweis: 'Einetagig' },
  { id: 'vt-1000-h1100-800-600', name: 'O&G 1,00 m · H1100 · T800+600', kategorie: 'obstgemuese', breite: 100, tiefe: 95.5, korpustiefe: 72.6, hoehe: 110, form: 'vitable', farbe: OG_GRUEN, stufen: [80, 60] },
  { id: 'vt-1000-h1300-1200', name: 'O&G 1,00 m · H1300 · T1200', kategorie: 'obstgemuese', breite: 100, tiefe: 131.7, korpustiefe: 90.8, hoehe: 130, form: 'vitable', farbe: OG_GRUEN, stufen: [120] },
  { id: 'vt-1000-h1600-800-600', name: 'O&G 1,00 m · H1600 · T800+600', kategorie: 'obstgemuese', breite: 100, tiefe: 95.5, korpustiefe: 72.6, hoehe: 160, form: 'vitable', farbe: OG_GRUEN, stufen: [80, 60] },
  { id: 'vt-1000-h1800-800-600-400', name: 'O&G 1,00 m · H1800 · T800+600+400', kategorie: 'obstgemuese', breite: 100, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitable', farbe: OG_GRUEN, stufen: [80, 60, 40], hinweis: 'Dreietagig' },
  { id: 'vt-1000-h1800-1200-600', name: 'O&G 1,00 m · H1800 · T1200+600', kategorie: 'obstgemuese', breite: 100, tiefe: 131.7, korpustiefe: 90.8, hoehe: 180, form: 'vitable', farbe: OG_GRUEN, stufen: [120, 60] },

  // ---- einseitig, Achsmaß 1250
  { id: 'vt-1250-h1100-800', name: 'O&G 1,25 m · H1100 · T800', kategorie: 'obstgemuese', breite: 125, tiefe: 95.5, korpustiefe: 72.6, hoehe: 110, form: 'vitable', farbe: OG_GRUEN, stufen: [80] },
  { id: 'vt-1250-h1300-800-600', name: 'O&G 1,25 m · H1300 · T800+600', kategorie: 'obstgemuese', breite: 125, tiefe: 95.5, korpustiefe: 72.6, hoehe: 130, form: 'vitable', farbe: OG_GRUEN, stufen: [80, 60] },
  { id: 'vt-1250-h1300-1200', name: 'O&G 1,25 m · H1300 · T1200', kategorie: 'obstgemuese', breite: 125, tiefe: 131.7, korpustiefe: 90.8, hoehe: 130, form: 'vitable', farbe: OG_GRUEN, stufen: [120] },
  { id: 'vt-1250-h1600-800-600', name: 'O&G 1,25 m · H1600 · T800+600', kategorie: 'obstgemuese', breite: 125, tiefe: 95.5, korpustiefe: 72.6, hoehe: 160, form: 'vitable', farbe: OG_GRUEN, stufen: [80, 60] },
  { id: 'vt-1250-h1800-800-600-400', name: 'O&G 1,25 m · H1800 · T800+600+400', kategorie: 'obstgemuese', breite: 125, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitable', farbe: OG_GRUEN, stufen: [80, 60, 40] },
  { id: 'vt-1250-h1800-1200-600', name: 'O&G 1,25 m · H1800 · T1200+600', kategorie: 'obstgemuese', breite: 125, tiefe: 131.7, korpustiefe: 90.8, hoehe: 180, form: 'vitable', farbe: OG_GRUEN, stufen: [120, 60] },

  // ---- beidseitige Gondeln. Auch diese Maße stehen im Workbook; sie sind
  //      weniger als das Doppelte, weil sich beide Seiten eine Mittelsäule teilen.
  { id: 'vt-gondel-1000-h1100-800', name: 'O&G Gondel 1,00 m · H1100 · T800', kategorie: 'obstgemuese', breite: 100, tiefe: 182.9, korpustiefe: 137.2, hoehe: 110, form: 'vitable', farbe: OG_GRUEN, stufen: [80], beidseitig: true, hinweis: 'Beidseitig, Korpus 1372 mm, gesamt 1829 mm' },
  { id: 'vt-gondel-1250-h1100-800', name: 'O&G Gondel 1,25 m · H1100 · T800', kategorie: 'obstgemuese', breite: 125, tiefe: 182.9, korpustiefe: 137.2, hoehe: 110, form: 'vitable', farbe: OG_GRUEN, stufen: [80], beidseitig: true },
  { id: 'vt-gondel-1000-h1300-1200', name: 'O&G Gondel 1,00 m · H1300 · T1200', kategorie: 'obstgemuese', breite: 100, tiefe: 255.4, korpustiefe: 173.4, hoehe: 130, form: 'vitable', farbe: OG_GRUEN, stufen: [120], beidseitig: true, hinweis: 'Beidseitig, Korpus 1734 mm, gesamt 2554 mm' },
  { id: 'vt-gondel-1250-h1300-1200', name: 'O&G Gondel 1,25 m · H1300 · T1200', kategorie: 'obstgemuese', breite: 125, tiefe: 255.4, korpustiefe: 173.4, hoehe: 130, form: 'vitable', farbe: OG_GRUEN, stufen: [120], beidseitig: true },

  // ---- Ecken, Abschlüsse und Gondelköpfe
  { id: 'vt-eck-innen-800', name: 'O&G Inneneck 45° · T800', kategorie: 'obstgemuese', breite: 95.5, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitableEckInnen', farbe: OG_GRUEN, stufen: [80, 60, 40], hinweis: 'Zwei davon ergeben ein Inneneck 90°. Danach muss eine gerade Einheit folgen.' },
  { id: 'vt-eck-innen-1200', name: 'O&G Inneneck 45° · T1200', kategorie: 'obstgemuese', breite: 131.7, tiefe: 131.7, korpustiefe: 90.8, hoehe: 180, form: 'vitableEckInnen', farbe: OG_GRUEN, stufen: [120, 60] },
  { id: 'vt-eck-aussen', name: 'O&G Außeneck 90°', kategorie: 'obstgemuese', breite: 95.5, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitableEckAussen', farbe: OG_GRUEN },
  { id: 'vt-abschluss-800', name: 'O&G Abschluss gerade · T800', kategorie: 'obstgemuese', breite: 95.5, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitableAbschluss', farbe: OG_GRUEN, stufen: [80, 60, 40], hinweis: 'Abschluss 90° – gerader Kopf am Ende eines Zuges' },
  { id: 'vt-abschluss-1200', name: 'O&G Abschluss gerade · T1200', kategorie: 'obstgemuese', breite: 131.7, tiefe: 131.7, korpustiefe: 90.8, hoehe: 180, form: 'vitableAbschluss', farbe: OG_GRUEN, stufen: [120, 60] },
  { id: 'vt-kopf-rund-800', name: 'O&G Kopfgondel rund · T800', kategorie: 'obstgemuese', breite: 95.5, tiefe: 182.9, korpustiefe: 137.2, hoehe: 180, form: 'vitableAbschlussRund', farbe: OG_GRUEN, stufen: [80, 60, 40], beidseitig: true, hinweis: 'Abschluss 180° – runder Kopf einer freistehenden Gondel' },
  { id: 'vt-kopf-rund-1200', name: 'O&G Kopfgondel rund · T1200', kategorie: 'obstgemuese', breite: 131.7, tiefe: 255.4, korpustiefe: 173.4, hoehe: 180, form: 'vitableAbschlussRund', farbe: OG_GRUEN, stufen: [120, 60], beidseitig: true },

  // Das freie Element: gleiches Symbol, alle Maße selbst bestimmbar.
  { id: 'vt-frei', name: 'O&G frei', kategorie: 'obstgemuese', breite: 200, tiefe: 95.5, korpustiefe: 72.6, hoehe: 180, form: 'vitable', farbe: OG_GRUEN, stufen: [80, 60, 40], hinweis: 'Maße, Korpustiefe und Stufen frei einstellbar' },

  // ------------------------------------------------------------ Backwaren
  //
  // BakeOff 3.0 von Wanzl. Maße aus dem Workbook (Version 18 / 08-2025):
  // Der Backwarenturm gibt es in genau einer Größe – 1000 x 1855 x 885 mm
  // (Breite x Höhe x Tiefe). Die Varianten unterscheiden sich nicht im Maß,
  // sondern in der Ausstattung. Deshalb ist die Breite hier überall 100 cm:
  // Eine 5-Meter-Zeile sind fünf Türme nebeneinander.
  { id: 'bakeoff-turm', name: 'BakeOff-Turm', kategorie: 'backwaren', breite: 100, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d8bc98', hinweis: 'Grundmodul BO3.0 01.001 – 1000 x 1855 x 885 mm' },
  { id: 'bakeoff-turm-strom', name: 'BakeOff-Turm mit Strom', kategorie: 'backwaren', breite: 100, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d0ad82', hinweis: 'Stromführend, Anschluss 230 V – BO3.0 01.002' },
  { id: 'bakeoff-turm-schneider', name: 'BakeOff-Turm Brotschneider', kategorie: 'backwaren', breite: 100, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d0ad82', hinweis: 'Für Brotschneidemaschine – BO3.0 01.003' },
  { id: 'bakeoff-turm-einzel', name: 'BakeOff-Turm einzeln', kategorie: 'backwaren', breite: 100, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d8bc98', hinweis: 'Stand-Alone, freistehend – BO3.0 01.004' },
  { id: 'bakeoff-ecke', name: 'BakeOff-Eckstück 45°', kategorie: 'backwaren', breite: 88.5, tiefe: 88.5, hoehe: 185.5, form: 'bakeoffEcke', farbe: '#c49a6c', hinweis: 'Füllt die Ecke, wenn die Zeile abknickt' },
  { id: 'bakeoff-ablage', name: 'Klappbare Ablage', kategorie: 'backwaren', breite: 100, tiefe: 40, hoehe: 90, form: 'rechteck', farbe: '#e8dcc8', hinweis: 'Vor der Zeile, im Plan gestrichelt' },
  // Das freie Element: gleiches Symbol, aber alle Maße selbst bestimmbar –
  // für Sonderbauten und für alles, was das Workbook nicht hergibt.
  { id: 'bakeoff-frei', name: 'BakeOff frei', kategorie: 'backwaren', breite: 200, tiefe: 88.5, hoehe: 185.5, form: 'bakeoff', farbe: '#d8bc98', hinweis: 'Maße frei einstellbar – Breite, Tiefe und Höhe rechts eintragen' },

  // ------------------------------------------------------ Kassen & Eingang
  { id: 'kasse-normal', name: 'Kasse', kategorie: 'kassen', breite: 300, tiefe: 100, hoehe: 110, form: 'rechteck', farbe: '#f5dda0', hinweis: 'Bediente Kasse mit Warenband' },
  { id: 'kasse-sb', name: 'Selbstbedienungskasse', kategorie: 'kassen', breite: 100, tiefe: 100, hoehe: 140, form: 'rechteck', farbe: '#f7e5b8', hinweis: 'SB-Kasse' },
  { id: 'kassentisch', name: 'Kassentisch', kategorie: 'kassen', breite: 200, tiefe: 80, hoehe: 90, form: 'rechteck', farbe: '#efdcaa' },
  { id: 'kassensperre', name: 'Kassensperre', kategorie: 'kassen', breite: 100, tiefe: 15, hoehe: 100, form: 'rechteck', farbe: '#c9b47a' },
  { id: 'eingangsbereich', name: 'Eingangsbereich', kategorie: 'kassen', breite: 300, tiefe: 200, hoehe: 0, form: 'rechteck', farbe: '#d8e6c8' },
  { id: 'ausgangsbereich', name: 'Ausgangsbereich', kategorie: 'kassen', breite: 300, tiefe: 200, hoehe: 0, form: 'rechteck', farbe: '#e6d8c8' },
  { id: 'einkaufswagenbox', name: 'Einkaufswagenbox', kategorie: 'kassen', breite: 200, tiefe: 120, hoehe: 100, form: 'abgerundet', farbe: '#dfe3e6' },
  { id: 'kundendienst', name: 'Kundendienst', kategorie: 'kassen', breite: 200, tiefe: 100, hoehe: 110, form: 'rechteck', farbe: '#f1e2bb' },
  { id: 'information', name: 'Information', kategorie: 'kassen', breite: 150, tiefe: 80, hoehe: 110, form: 'rechteck', farbe: '#f1e2bb' },
  { id: 'leergutautomat', name: 'Leergutautomat', kategorie: 'kassen', breite: 120, tiefe: 100, hoehe: 200, form: 'rechteck', farbe: '#cddac2' },

  // -------------------------------------------- Aktions- & Sonderflächen
  { id: 'aktionsflaeche', name: 'Aktionsfläche', kategorie: 'aktion', breite: 200, tiefe: 200, hoehe: 0, form: 'rechteck', farbe: '#f0c4b3' },
  { id: 'aktionspalette', name: 'Aktionspalette', kategorie: 'aktion', breite: 120, tiefe: 80, hoehe: 120, form: 'rechteck', farbe: '#e8b49f', hinweis: 'Europalette 120 × 80 cm' },
  { id: 'display', name: 'Display', kategorie: 'aktion', breite: 80, tiefe: 60, hoehe: 150, form: 'rechteck', farbe: '#eebda9' },
  { id: 'schuette', name: 'Schütte', kategorie: 'aktion', breite: 100, tiefe: 80, hoehe: 90, form: 'abgerundet', farbe: '#f2cdbe' },
  { id: 'kuehldisplay', name: 'Kühldisplay', kategorie: 'aktion', breite: 100, tiefe: 80, hoehe: 120, form: 'abgerundet', farbe: '#c8d9e4' },
  { id: 'saisonflaeche', name: 'Saisonfläche', kategorie: 'aktion', breite: 300, tiefe: 300, hoehe: 0, form: 'rechteck', farbe: '#f4d3c4' },
  { id: 'verkostungsstand', name: 'Verkostungsstand', kategorie: 'aktion', breite: 120, tiefe: 80, hoehe: 110, form: 'abgerundet', farbe: '#eec6ae' },

  // ------------------------------------------------------ Weitere Ausstattung
  { id: 'saeule', name: 'Säule', kategorie: 'ausstattung', breite: 40, tiefe: 40, hoehe: 300, form: 'kreis', farbe: '#b9bec4', hinweis: 'Tragende Säule' },
  { id: 'treppe', name: 'Treppe', kategorie: 'ausstattung', breite: 300, tiefe: 120, hoehe: 0, form: 'rechteck', farbe: '#cfd4d9' },
  { id: 'aufzug', name: 'Aufzug', kategorie: 'ausstattung', breite: 200, tiefe: 200, hoehe: 0, form: 'rechteck', farbe: '#c6ccd2' },
  { id: 'tuer', name: 'Tür', kategorie: 'ausstattung', breite: 100, tiefe: 15, hoehe: 210, form: 'rechteck', farbe: '#9aa4ae' },
  { id: 'fenster', name: 'Fenster', kategorie: 'ausstattung', breite: 150, tiefe: 15, hoehe: 150, form: 'rechteck', farbe: '#b6d3e2' },
  { id: 'sitzbereich', name: 'Sitzbereich', kategorie: 'ausstattung', breite: 300, tiefe: 200, hoehe: 0, form: 'abgerundet', farbe: '#dbd3c4' },
  { id: 'werbeschild', name: 'Werbeschild', kategorie: 'ausstattung', breite: 100, tiefe: 15, hoehe: 60, form: 'rechteck', farbe: '#f2d06b' },
  { id: 'bildschirm', name: 'Bildschirm', kategorie: 'ausstattung', breite: 80, tiefe: 12, hoehe: 50, form: 'rechteck', farbe: '#8d99a6' },
  { id: 'abfallbehaelter', name: 'Abfallbehälter', kategorie: 'ausstattung', breite: 60, tiefe: 60, hoehe: 90, form: 'kreis', farbe: '#b0b6bc' },
  { id: 'hubwagen', name: 'Hubwagenstellplatz', kategorie: 'ausstattung', breite: 200, tiefe: 100, hoehe: 0, form: 'rechteck', farbe: '#d9dde1' },
];

/** Sucht eine Vorlage. Gibt `undefined` zurück, wenn es sie nicht (mehr) gibt. */
export function findeVorlage(
  id: string,
  eigene: BibliothekEintrag[] = [],
): BibliothekEintrag | undefined {
  return [...BIBLIOTHEK, ...eigene].find((v) => v.id === id);
}
