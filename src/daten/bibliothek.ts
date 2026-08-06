import type { BibliothekEintrag } from '../typen/modell';

/**
 * Die mitgelieferte Elementbibliothek.
 *
 * Alle Maße sind in Zentimetern angegeben und entsprechen üblichen Größen im
 * Lebensmitteleinzelhandel. Sie sind nur Startwerte – nach dem Platzieren kann
 * jedes Element frei verändert werden.
 *
 * Die Symbole sind bewusst einfache Grundformen. Sie lassen sich später ohne
 * Änderungen an der übrigen Anwendung durch eigene Zeichnungen ersetzen:
 * Es muss nur die Eigenschaft `form` erweitert und in `ElementSymbol.tsx`
 * ein weiterer Fall ergänzt werden.
 */
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
  { id: 'frische-og-flaeche', name: 'Obst- und Gemüsefläche', kategorie: 'frische', breite: 500, tiefe: 400, hoehe: 0, form: 'rechteck', farbe: '#cfe4c2', hinweis: 'Gesamte O&G-Zone als Fläche' },
  { id: 'frische-og-tisch', name: 'Obst- und Gemüsetisch', kategorie: 'frische', breite: 200, tiefe: 100, hoehe: 90, form: 'abgerundet', farbe: '#c3ddb8' },
  { id: 'theke-fleisch', name: 'Fleischtheke', kategorie: 'frische', breite: 250, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#e2bdbd' },
  { id: 'theke-wurst', name: 'Wursttheke', kategorie: 'frische', breite: 250, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#e5c6c2' },
  { id: 'theke-kaese', name: 'Käsetheke', kategorie: 'frische', breite: 200, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#eeddb4' },
  { id: 'theke-fisch', name: 'Fischtheke', kategorie: 'frische', breite: 200, tiefe: 120, hoehe: 130, form: 'rechteck', farbe: '#c2dbe2' },
  { id: 'frische-backshop', name: 'Backshop', kategorie: 'frische', breite: 300, tiefe: 200, hoehe: 200, form: 'rechteck', farbe: '#e9d5ae' },
  { id: 'theke-backwaren', name: 'Backwarentheke', kategorie: 'frische', breite: 250, tiefe: 100, hoehe: 130, form: 'rechteck', farbe: '#e6cfa4' },
  { id: 'frische-salatbar', name: 'Salatbar', kategorie: 'frische', breite: 150, tiefe: 100, hoehe: 120, form: 'abgerundet', farbe: '#cbe3bb' },
  { id: 'theke-heiss', name: 'Heiße Theke', kategorie: 'frische', breite: 200, tiefe: 100, hoehe: 130, form: 'rechteck', farbe: '#e7c39c' },

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
