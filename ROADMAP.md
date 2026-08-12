# Entwicklungsplan

Der Plan ist in Phasen aufgeteilt. Jede Phase liefert eine benutzbare Version –
es gibt keinen Zwischenstand, mit dem man nicht arbeiten könnte.

## Phase 1 – Grundgerüst ✅ fertig

- [x] Zeichenfläche mit Raster, maßstabsgetreu
- [x] Zoom mit Mausrad, Ansicht verschieben (Leertaste oder mittlere Maustaste)
- [x] Elementbibliothek mit 56 Vorlagen in 6 Kategorien, mit Suche
- [x] Elemente per Ziehen oder Klick einfügen
- [x] Auswahl einzeln, mit Umschalt und mit Auswahlrahmen
- [x] Verschieben mit Maus und Pfeiltasten
- [x] Größe über Anfasser und über Zahleneingabe ändern
- [x] Drehen frei, in 45°-Schritten und über Knöpfe um 90°
- [x] Einrasten am Raster, an Wänden und an Nachbarelementen mit Hilfslinien
- [x] Abstandsmaße beim Verschieben
- [x] Eigenschaftenfenster mit allen Feldern (Maße, Farbe, Form, Beschriftung,
      Warengruppe, Hersteller, Notiz, Sperre, Ebene)
- [x] Ausrichten und gleichmäßig verteilen
- [x] Reihenfolge (Vordergrund / Hintergrund)
- [x] Kopieren, Einfügen, Duplizieren, Löschen
- [x] Rückgängig und Wiederholen
- [x] Ebenen ein- und ausblenden sowie sperren
- [x] Flächenübersicht und Regalmeter
- [x] Speichern, Öffnen, Kopieren, Umbenennen (IndexedDB, automatisch)
- [x] JSON-Export und -Import, PNG-Export

## Phase 2 – GitHub und Online-Abgleich ✅ fertig

- [x] Vermittlungsprogramm als Cloudflare Worker (`sync/worker.js`)
- [x] Verschlüsselung im Browser, Kopplungscode statt Benutzerkonto
- [x] Abgleich aller Planungen zwischen mehreren Rechnern
- [x] Sicherungskopie, wenn an zwei Rechnern gleichzeitig geplant wurde
- [x] Grabsteine, damit Gelöschtes gelöscht bleibt
- [x] Zuletzt geöffnete Planung wandert mit
- [x] Abgleich von selbst: beim Start, nach Ruhe, bei Rückkehr ins Fenster
- [x] Veröffentlichung auf GitHub Pages bei jedem Push
- [x] Prüfungen für Zusammenführung und Worker

## Phase 3 – Grundriss frei festlegen

Der Grundriss ist kein Rechteck mehr, sondern ein Polygon.

- [x] Umriss als Polygon, Ecken ziehen, einfügen und entfernen
- [x] Zusammengesetzte Formen: Rechtecke anfügen und abziehen
- [x] Maße an jeder Wandkante, auch an schrägen
- [x] Breite und Länge weiterhin eintippbar, solange die Form ein Rechteck ist
- [x] Räume als abgetrennte Bereiche: Verkaufsraum, Lager, Kühlraum, Sozialraum,
      Technik
- [x] Raumname, Art, Wandstärke, Farbe, Flächenberechnung je Raum
- [x] Auswertung getrennt nach Verkaufsfläche und Nebenflächen
- [x] Bestehende Planungen werden beim Öffnen umgewandelt (Schemaversion 2)
- [ ] Einzelne Innenwände zeichnen und verschieben (ohne kompletten Raum)
- [ ] Türen und Durchgänge in Wände setzen
- [ ] Wandmaße direkt über Zahleneingabe ändern, auch bei zusammengesetzten Formen

## Phase 4 – Regale und Marktausstattung (Wanzl)

Ersetzt die vorläufige Bibliothek durch die tatsächlich verbauten Möbel.
Grundlage ist der Plan des bestehenden Marktes.

- [ ] Bedientheken
- [ ] Tiefkühlung: Truhen und Schränke
- [ ] Molkerei / SB-Wurst und Fleisch: Truhen und Schränke
- [ ] Trockensortiment in verschiedenen Achsmaßen
- [ ] Obstabteilung in verschiedenen Achsmaßen
- [ ] Backstation
- [ ] Kassen in allen Varianten: Selbstscanner, Tandem, zusammengesetzte
      Tandemkassen, Einzelkassen, Kassen mit Tabakshop
- [ ] Symbole aus dem Plan abgeleitet statt Platzhalter-Rechtecke

## Phase 5 – Bestehende Ladenpläne einlesen

- [ ] PDF einlesen und maßstabsgetreu als Hintergrund einpassen
- [ ] Maßstab über eine bekannte Strecke festlegen
- [ ] Umriss und Räume über dem eingelesenen Plan nachzeichnen
- [ ] Im bestehenden Plan weiterarbeiten: Regale versetzen, austauschen,
      Bereiche verändern

## Phase 6 – Auswertung und Ausgabe

- [ ] Kundenlaufwege und interne Laufwege als Linien und Pfeile
- [ ] Farbige Flächen für Zonen
- [ ] Auswertung je Abteilung und je Warengruppe
- [ ] Gruppieren und Gruppierung aufheben
- [ ] PDF-Export mit Maßstab, Druckansicht
- [ ] SVG-Export (direkt aus dem Datenmodell)
- [ ] Legende und Beschriftungsfeld auf dem Ausdruck

## Phase 7 – Eigene Elemente

- [ ] Editor für eigene Vorlagen (Name, Kategorie, Maße, Farbe, Form)
- [ ] Kombination mehrerer Grundformen
- [ ] Frei definierbare Zusatzeigenschaften
- [ ] Eigene SVG- und PNG-Symbole hochladen

## Zum Schluss

- [ ] **Bedienungsanleitung** – vollständig, mit Bildern, für jemanden
      geschrieben, der den Marktplaner zum ersten Mal öffnet

## Später

- [ ] Mehrere Personen gleichzeitig an einer Planung
- [ ] Tablet-Bedienung mit Touch
- [ ] Versionen einer Planung vergleichen
