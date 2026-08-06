# Marktplaner

Eine Planungssoftware für den Grundriss und die Einrichtung eines Lebensmittelmarktes.
Der Markt wird von oben als maßstabsgetreuer Grundriss gezeigt. Regale, Kühlmöbel,
Theken und Kassen werden aus einer Bibliothek auf die Fläche gezogen und dort
frei angeordnet.

## Starten

```bash
npm install
```

```bash
npm run dev
```

Danach im Browser <http://localhost:5180> öffnen.

Für eine fertige, schnelle Version:

```bash
npm run build
```

```bash
npm run preview
```

## Bedienung

| Was du tun willst | Wie es geht |
| --- | --- |
| Element einfügen | aus der linken Liste auf die Fläche ziehen – oder anklicken (landet in der Mitte) |
| Auswählen | anklicken |
| Mehrere auswählen | Umschalt + Klick, oder mit gedrückter Maustaste einen Rahmen aufziehen |
| Verschieben | ziehen, oder Pfeiltasten (Alt = 1 cm, Umschalt = großer Schritt) |
| Größe ändern | an den blauen Anfassern ziehen, oder rechts Zahlen eintragen |
| Drehen | am oberen Anfasser drehen, oder Taste **R**, oder die Knöpfe rechts |
| Zoomen | Mausrad |
| Ansicht verschieben | Leertaste gedrückt halten und ziehen, oder mittlere Maustaste |
| Ganzen Markt anzeigen | Strg + 0 oder „Einpassen" |
| Rückgängig / Wiederholen | Strg + Z / Strg + Y |
| Kopieren / Einfügen / Duplizieren | Strg + C / Strg + V / Strg + D |
| Alles auswählen | Strg + A |
| Löschen | Entf |
| Raster ein/aus | **G** |
| Einrasten ein/aus | **S** |
| Speichern | passiert automatisch; Strg + S speichert sofort |

## Wie die Daten gespeichert werden

Alles liegt lokal im Browser (IndexedDB, Datenbank `marktplaner`). Es wird nichts
ins Internet übertragen. Nach jeder Änderung wird nach kurzer Pause automatisch
gespeichert; beim nächsten Start öffnet sich die zuletzt bearbeitete Planung.

Zur Sicherung gibt es **JSON-Export**: Diese Datei enthält alle Räume, Elemente,
Maße, Positionen, Drehungen, Farben und Beschriftungen und kann jederzeit wieder
eingelesen werden.

## Aufbau des Quellcodes

```
src/
├── typen/modell.ts        Datenmodell: was ist ein Projekt, ein Element, eine Ebene
├── daten/                 mitgelieferte Inhalte
│   ├── bibliothek.ts      alle Elementvorlagen mit Standardmaßen
│   ├── kategorien.ts      die Oberkategorien der Bibliothek
│   ├── warengruppen.ts    Vorschläge für das Feld „Warengruppe"
│   └── standardProjekt.ts leeres Projekt und Standardebenen
├── logik/                 reines Rechnen, ohne Oberfläche
│   ├── masse.ts           Umrechnung cm ↔ m, Maßstab, Formatierung
│   ├── geometrie.ts       Umgrenzungen, Drehung, Flächen einzelner Elemente
│   ├── einrasten.ts       Einrasten am Raster/an Nachbarn, Hilfslinien, Abstände
│   ├── flaechen.ts        Flächenübersicht und Regalmeter
│   ├── tastatur.ts        alle Tastenkombinationen
│   ├── bildExport.ts      PNG-Export
│   ├── buehne.ts          Verbindung Werkzeugleiste ↔ Zeichenfläche
│   └── id.ts              eindeutige Kennungen
├── speicher/              Speicherung
│   ├── datenbank.ts       IndexedDB öffnen
│   └── projektArchiv.ts   speichern, laden, kopieren, JSON-Im-/Export
├── zustand/
│   ├── planStore.ts       zentraler Datenspeicher inkl. Rückgängig/Wiederholen
│   └── statusStore.ts     nur die Mausposition (aus Geschwindigkeitsgründen)
└── komponenten/           Oberfläche
    ├── Werkzeugleiste.tsx
    ├── Elementbibliothek.tsx
    ├── Eigenschaftenfenster.tsx
    ├── Statusleiste.tsx
    ├── ProjektDialog.tsx
    ├── Feld.tsx           wiederverwendbare Eingabefelder
    ├── Symbole.tsx        alle Schaltflächen-Symbole
    └── zeichenflaeche/
        ├── Zeichenflaeche.tsx  Maus, Zoom, Auswahl, Ziehen
        ├── Gebaeude.tsx        Boden, Außenwand, Außenmaße
        ├── Raster.tsx          Hilfsraster
        └── ElementSymbol.tsx   Zeichnung eines einzelnen Elements
```

### Zwei Grundregeln

1. **Intern wird immer in Zentimetern gerechnet.** Ob Meter oder Zentimeter
   angezeigt werden, ist reine Anzeigesache.
2. **Die Oberfläche ändert nie selbst Daten.** Sie ruft nur Aktionen aus
   `planStore.ts` auf. Dadurch funktionieren Rückgängig und die automatische
   Speicherung überall zuverlässig.

### Warum Canvas und nicht SVG?

Ein Markt hat schnell 200 bis 400 Elemente. Bei SVG wäre jedes davon ein eigenes
Element im Browser-Dokument mit eigener Maus-Behandlung – das Verschieben würde
spürbar ruckeln. Canvas (über Konva.js) zeichnet alles in ein Bild und bleibt
flüssig. Konva liefert außerdem die Anfasser zum Vergrößern und Drehen sowie den
PNG-Export mit. Ein späterer SVG-Export wird direkt aus dem Datenmodell erzeugt –
das ist unabhängig von der Bildschirmdarstellung und damit sauberer.

## Eigene Symbole ergänzen

Die Elemente sind absichtlich einfache Platzhalter. Für eine neue Form genügt es,
in `src/komponenten/zeichenflaeche/ElementSymbol.tsx` in der Funktion `zeichneForm`
einen weiteren Fall zu ergänzen und den Namen in `typen/modell.ts` bei `Grundform`
einzutragen. Am Rest der Anwendung ändert sich nichts.

## Verwendete Bausteine

React 19, TypeScript, Vite, Konva.js (react-konva), Zustand, idb.
