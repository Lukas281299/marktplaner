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

Die Prüfungen laufen mit:

```bash
npm test
```

Sie decken die Stellen ab, an denen ein Fehler still Daten kosten würde: das
Zusammenführen beim Abgleich und das Vermittlungsprogramm auf dem Server.

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
| Abgleich mit anderen Rechnern | Knopf „Abgleich" in der Werkzeugleiste (einmal einrichten, danach von allein) |
| Grundriss umformen | dritte Werkzeugzeile, siehe unten |
| Regale zusammenfassen | auswählen, dann **Gruppieren** (Strg+G); lösen mit Strg+Umschalt+G |
| Ganze Gondel verschieben | einfach anklicken – ein Klick nimmt die ganze Gruppe |
| Einzelnes Feld herausgreifen | **Alt** + Klick |
| Lückenlos aneinanderreihen | auswählen, dann **Aneinanderreihen** |
| Abstand messen | Werkzeug **Maß**, von Punkt zu Punkt ziehen |
| Etwas sagen statt klicken | Knopf „Assistent" in der Werkzeugleiste (einmal einrichten) |
| Plan als PDF oder für eine andere Webanwendung | Knopf „Ausgeben" in der Werkzeugleiste |

## Grundriss und Räume

Ein Markt ist selten ein sauberer Kasten. Deshalb ist der Grundriss ein
**Polygon**, kein Rechteck – ein Rechteck ist davon nur der einfachste Fall.
Die Werkzeuge dafür stehen in der dritten Zeile der Werkzeugleiste:

| Werkzeug | Was es tut |
| --- | --- |
| **Umriss** | Blaue Ecken ziehen. Die kleinen Kreise auf den Wänden setzen eine neue Ecke, Doppelklick auf eine Ecke entfernt sie. |
| **Fläche anfügen** | Rechteck aufziehen – es wird zur Grundfläche hinzugerechnet. So entstehen zusammengesetzte Formen und Anbauten. |
| **Fläche abziehen** | Rechteck aufziehen – dieser Bereich wird herausgeschnitten. Für ausgesparte Ecken und Kerben. |
| **Raum abtrennen** | Rechteck aufziehen – daraus wird ein Raum. Art, Name, Wandstärke und Farbe danach rechts einstellen. |
| **Innenwand** | Von einem Punkt zum anderen ziehen. Fast waagerechte und fast senkrechte Wände werden automatisch gerade gezogen. |
| **Tür / Durchgang** | Auf eine Wand klicken. Die Öffnung übernimmt Richtung und Wandstärke von selbst – egal ob Außenwand, Raumwand oder Innenwand. |

Eine **Öffnung** hängt bewusst nicht an einer bestimmten Wand, sondern liegt
frei auf dem Plan und unterbricht optisch, was unter ihr liegt. Der Grund ist
praktisch: Türen sitzen oft genau dort, wo eine Raumwand auf die Außenwand
trifft. Müsste sich die Tür für eine der beiden entscheiden, ginge sie beim
Verschieben der anderen kaputt. Zieht man sie an eine andere Wand, rastet sie
dort von selbst wieder ein.

Zur Auswahl: Türen gibt es als Tür, Doppeltür, Schiebetür, Durchgang ohne Tür,
Rolltor und Fenster. Bei Türen lässt sich der Anschlag wechseln – der
Aufschlagbogen zeigt dann, ob die Tür genug Platz hat.

Solange der Grundriss ein Rechteck ist, lassen sich Breite und Länge weiterhin
rechts als Zahlen eintippen. Sobald die Form zusammengesetzt ist, steht dort
stattdessen die Umgrenzung – zwei Zahlen würden eine L-Form ja nicht
beschreiben.

**Verkaufsfläche oder Nebenfläche?** Die Art eines Raums entscheidet darüber.
Nur „Verkaufsraum" zählt zur Verkaufsfläche; Lager, Kühlraum, Sozialraum und
Technik sind Nebenfläche und werden von der Innenfläche abgezogen. Das ist die
Trennlinie, auf die es im Ladenbau ankommt, deshalb steht sie so in der
Flächenübersicht.

**Löcher kann der Umriss nicht.** Wer mitten aus der Fläche etwas
herausschneidet, bekommt einen Hinweis – für ausgesparte Bereiche innerhalb
des Gebäudes ist ein Raum das richtige Mittel.

## Gruppen, Gondeln und Maße

**Gruppen** halten zusammen, was gemeinsam bewegt werden soll. Ein Klick auf
ein gruppiertes Regal nimmt die ganze Gruppe – wer eine Gondel anfasst, will
sie im Ganzen schieben. Mit **Alt** greift man ein einzelnes Feld heraus.

**Beidseitig bestückt** ist dagegen eine Eigenschaft des einzelnen Möbels,
keine der Gruppe: Eine Wanzl-Gondel ist *ein* Möbel mit zwei Seiten und zählt
bei den Regalmetern doppelt. Zwei Wandregale Rücken an Rücken sind *zwei*
einseitige Möbel und werden schon von selbst zweimal gezählt. Die Verwechslung
kostet sonst die Hälfte der Kennzahl.

**Aneinanderreihen** schiebt die Auswahl lückenlos zusammen. Das erste Regal
bleibt stehen, die übrigen rücken heran – von Hand trifft man das nie genau,
und ein Millimeter Luft je Feld summiert sich über einen 20-Meter-Zug.

**Maße** bleiben im Plan stehen, anders als die Abstände, die beim Verschieben
kurz aufblitzen. Das Maßband rastet an Regalecken, Wandenden und Raumecken
ein — ein Maß ist nur so gut wie sein Anfangspunkt. Statt der gemessenen Zahl
lässt sich auch ein eigener Text eintragen, etwa „min. 1,20 m" für eine
Vorgabe.

## Wie die Daten gespeichert werden

Alles liegt lokal im Browser (IndexedDB, Datenbank `marktplaner`). Nach jeder
Änderung wird nach kurzer Pause automatisch gespeichert; beim nächsten Start
öffnet sich die zuletzt bearbeitete Planung.

Zur Sicherung gibt es **JSON-Export**: Diese Datei enthält alle Räume, Elemente,
Maße, Positionen, Drehungen, Farben und Beschriftungen und kann jederzeit wieder
eingelesen werden.

## Abgleich zwischen mehreren Rechnern

Auf Wunsch gleicht der Marktplaner alle Planungen zwischen mehreren Rechnern ab –
man fängt im Büro an und macht am Laptop an derselben Stelle weiter. Solange das
nicht eingerichtet ist, verlässt keine Zeile den Rechner.

Die Einrichtung dauert etwa zehn Minuten und ist Schritt für Schritt in
[sync/LIESMICH.md](sync/LIESMICH.md) beschrieben. Kurz gefasst:

- Ein winziges Programm (`sync/worker.js`) läuft bei **Cloudflare** auf der
  kostenlosen Stufe und tut nichts weiter, als einen Block abzulegen und wieder
  herauszugeben.
- Alles wird **im Browser verschlüsselt** (AES-GCM), bevor es hochgeht. Der
  Schlüssel wird aus dem Kopplungscode abgeleitet und nie übertragen. Cloudflare
  sieht eine Zeichenkette und sonst nichts.
- Zusammengeführt wird **pro Planung: die zuletzt geänderte gewinnt.** Haben
  beide Rechner an derselben Planung gearbeitet, wird die ältere Fassung
  automatisch als Kopie „Name (Stand vom …)" gesichert. Verloren geht nichts.
- Gelöschtes bleibt gelöscht – dafür sorgen Grabsteine (`graeber`), sonst käme
  eine gelöschte Planung vom anderen Rechner zurück.

Wer entscheidet was, steht in `src/speicher/abgleich.ts`; diese Datei rechnet nur
und ist vollständig durch Prüfungen abgedeckt.

## Den Plan herausgeben

Über **Ausgeben** verlässt der Plan das Programm – als PDF zum Drucken oder
als SVG für eine andere Webanwendung.

Beide zeichnen dieselbe Bühne (`logik/planAufnahme.ts`), nur verschieden groß.
Dabei wird der Zoom auf 1 gestellt und danach zurückgesetzt: Beschriftungen
zeichnet der Plan nur, wenn sie auf dem Bildschirm lesbar wären – wer
herausgezoomt exportiert, bekäme sonst einen Plan ohne Warengruppen.

**PDF** (`logik/pdf.ts`) wird selbst geschrieben, ohne fremde Bibliothek: Ein
Marktplan ist ein Bild, ein Titel und eine Fußzeile, dafür wären 500 kB
Abhängigkeit unverhältnismäßig. Die Bildpunkte gehen verlustfrei hinein –
roh, mit `CompressionStream` gepackt, als `FlateDecode`; JPEG zeigte an den
feinen Linien eines Grundrisses sofort seine Artefakte. Geprüft wird das
Ergebnis in `pdf.test.ts` am Ende von pdf.js, also von einem echten Leser.

**SVG** (`logik/webExport.ts`) trägt ein Koordinatensystem in **Zentimetern**:
Die `viewBox` läuft über die Maße des Grundrisses, ein Punkt ist ein
Zentimeter. Eine fremde Anwendung, die Kamerasymbole darauflegt, rechnet
nichts um – und ihre Positionen überleben einen zweiten Export mit anderer
Auflösung. Bei einem gewöhnlichen Bild säßen sie danach daneben. Die Maße
stehen zusätzlich als `data-`Attribute am Wurzelelement, alle Möbel als JSON
im `<metadata>`-Block.

Das Bild ist im SVG eingebettet und nicht als Vektor nachgebaut: Die Zeichnung
eines Möbels steckt in gut tausend Zeilen Konva-Code, und eine zweite Fassung
davon wäre nach dem ersten neuen Möbel falsch.

Auf Wunsch kommt eine **Beispielseite** mit – eine fertige HTML-Datei mit
klickbaren Kamerasymbolen. Wer die andere Anwendung baut, hat sonst nur eine
Datei und muss raten, wie das Koordinatensystem gemeint ist.

## Warengruppen messen in Zentimetern

Was unter einem Zug steht, gehört zu einer **Strecke** und nicht zu einem Feld
(`logik/warengruppe.ts`). Der Unterschied ist nicht kosmetisch: Ein Feld ist
eine bauliche Größe — ein Regalboden im Achsmaß —, ein Sortiment richtet sich
nicht danach. Teilen sich zwei Sortimente drei Meter, läuft die Grenze mitten
durch ein Feld. Solange beides in Feldern zählte, ging das nur, indem man die
Felder umbaute; danach zeigte der Plan ein Möbel mit zwei Böden statt drei.

- Gespeichert wird in der **Achse des Möbels**, nicht in Leserichtung. Gedreht
  wird erst beim Zeichnen — sonst müsste jede Drehung die Daten umschreiben.
- Die Felder sind für die Beschriftung nur noch **Rastpunkte**: Beim Ziehen
  einer Grenze rasten Feldgrenzen, Hälften und Viertel ein.
- Grenzen zwei Abschnitte aneinander, wandern ihre Kanten **gemeinsam** —
  sonst risse beim Ziehen ein Loch auf oder sie überlappten sich.
- Fassung 15 rechnet alte Pläne um. Zwei Feinheiten stecken darin: Gezählt
  wurde in Leserichtung (an einem gedrehten Möbel also andersherum), und eine
  Strecke endete an der nächsten Beschriftung.

## Der Assistent

Auf Wunsch lässt sich der Marktplaner ansprechen statt anklicken: *„Schieb die
Kassen zwei Meter nach unten"*, *„Welche Warengruppen fehlen noch?"*. Solange
das nicht eingerichtet ist, verlässt keine Zeile den Rechner.

Die Einrichtung dauert etwa zehn Minuten und steht Schritt für Schritt in
[assistent/LIESMICH.md](assistent/LIESMICH.md). Kurz gefasst:

- Ein zweites winziges Programm (`assistent/worker.js`) läuft bei **Cloudflare**
  und hält den Anthropic-Schlüssel. Die App kennt ihn nicht – sie liegt
  öffentlich auf GitHub Pages, und was im Browser steht, ist auslesbar.
- Der Worker ist ein **reiner Durchreicher**. Was der Assistent kann und wie er
  denkt, steht in `src/assistent/` – sonst müsste der Worker bei jeder neuen
  Funktion neu eingefügt werden.
- Die **Werkzeugschleife läuft im Browser**, denn dort liegt der Plan. Der
  Worker sieht nur Nachrichten hin und Nachrichten her.
- Kein Werkzeug fasst die Daten selbst an: Jedes ruft dieselbe Store-Aktion
  auf wie ein Klick. Dadurch verhält sich der Assistent zwangsläufig wie die
  Handarbeit, samt Einrasten und Kopfgondel-Ausrichtung.
- **Ein Auftrag ist ein Strg+Z.** Eine Runde wird in eine Historienklammer
  gefasst (`oeffneKlammer`/`schliesseKlammer` im `planStore`), die *faul*
  einträgt: Der Schritt entsteht bei der ersten Änderung, nicht beim Öffnen –
  eine Runde, die nur eine Frage beantwortet, legt gar keinen an.
- Drei Riegel vor dem Schlüssel: erlaubte Herkunft, ein Zugangswort und ein
  Tageslimit als Kostenbremse.

## Veröffentlichung im Web

Bei jedem Push auf `main` baut GitHub den Marktplaner und stellt ihn auf GitHub
Pages bereit (`.github/workflows/deploy.yml`). Schlägt eine Prüfung fehl, wird
nichts veröffentlicht. Danach ist er von jedem Rechner aus erreichbar, ohne
etwas zu installieren.

## Aufbau des Quellcodes

```
src/
├── typen/modell.ts        Datenmodell: was ist ein Projekt, ein Element, eine Ebene
├── daten/                 mitgelieferte Inhalte
│   ├── bibliothek.ts      alle Elementvorlagen mit Standardmaßen
│   ├── kategorien.ts      die Oberkategorien der Bibliothek
│   ├── warengruppen.ts    Vorschläge für das Feld „Warengruppe"
│   ├── raumarten.ts       Raumarten, Farben und was zur Verkaufsfläche zählt
│   └── standardProjekt.ts leeres Projekt und Standardebenen
├── logik/                 reines Rechnen, ohne Oberfläche
│   ├── masse.ts           Umrechnung cm ↔ m, Maßstab, Formatierung
│   ├── geometrie.ts       Umgrenzungen, Drehung, Flächen einzelner Elemente
│   ├── polygon.ts         Umrisse: Fläche, Kanten, Anfügen und Abziehen
│   ├── umrissBearbeiten.ts  Ecken verschieben, einfügen, entfernen
│   ├── waende.ts          Wandachsen finden – wo sitzt eine Tür?
│   ├── einrasten.ts       Einrasten am Raster/an Nachbarn, Hilfslinien, Abstände
│   ├── flaechen.ts        Flächenübersicht, Verkaufs- und Nebenflächen
│   ├── warengruppe.ts     Beschriftungen als Strecken in Zentimetern
│   ├── tastatur.ts        alle Tastenkombinationen
│   ├── bildExport.ts      PNG-Export
│   ├── planAufnahme.ts    Plan in wählbarer Auflösung aufnehmen
│   ├── pdf.ts             kleiner PDF-Schreiber (Bild, Titel, Fußzeile)
│   ├── webExport.ts       SVG mit Koordinatensystem in Zentimetern
│   ├── buehne.ts          Verbindung Werkzeugleiste ↔ Zeichenfläche
│   ├── abgleichSteuerung.ts  wann von selbst abgeglichen wird
│   └── id.ts              eindeutige Kennungen
├── speicher/              Speicherung
│   ├── datenbank.ts       IndexedDB öffnen
│   ├── projektArchiv.ts   speichern, laden, kopieren, JSON-Im-/Export
│   ├── krypto.ts          Verschlüsselung und Kopplungscode
│   ├── abgleich.ts        entscheidet, was geholt, geschickt, gelöscht wird
│   ├── syncClient.ts      spricht mit dem Server
│   └── wandlung.ts        bringt ältere Planungen auf das aktuelle Modell
├── assistent/             der KI-Assistent
│   ├── werkzeuge.ts       was er tun kann – jedes Werkzeug ruft eine Store-Aktion
│   ├── gespraech.ts       Auftrag, Worker-Aufruf und die Werkzeugschleife
│   └── planbild.ts        was er vom Plan zu sehen bekommt
├── zustand/
│   ├── planStore.ts       zentraler Datenspeicher inkl. Rückgängig/Wiederholen
│   ├── syncStore.ts       Zustand des Abgleichs
│   ├── assistentStore.ts  Gesprächsverlauf des Assistenten
│   └── statusStore.ts     nur die Mausposition (aus Geschwindigkeitsgründen)
└── komponenten/           Oberfläche
    ├── Werkzeugleiste.tsx
    ├── Elementbibliothek.tsx
    ├── Eigenschaftenfenster.tsx
    ├── Statusleiste.tsx
    ├── Dialog.tsx         Grundgerüst aller Dialoge
    ├── ProjektDialog.tsx
    ├── SyncDialog.tsx     Einrichtung und Stand des Abgleichs
    ├── ExportDialog.tsx    PDF und SVG herausgeben
    ├── Assistentenfenster.tsx  die Spalte des Assistenten
    ├── AssistentDialog.tsx     Adresse und Zugangswort des Workers
    ├── Feld.tsx           wiederverwendbare Eingabefelder
    ├── Symbole.tsx        alle Schaltflächen-Symbole
    └── zeichenflaeche/
        ├── Zeichenflaeche.tsx  Maus, Zoom, Auswahl, Ziehen, Grundriss-Werkzeuge
        ├── Gebaeude.tsx        Boden, Außenwand, Wandmaße
        ├── Raeume.tsx          abgetrennte Räume
        ├── Waende.tsx          freistehende Innenwände
        ├── Oeffnungen.tsx      Türen, Durchgänge, Tore
        ├── UmrissBearbeitung.tsx  Anfasser zum Umformen des Grundrisses
        ├── Raster.tsx          Hilfsraster
        └── ElementSymbol.tsx   Zeichnung eines einzelnen Elements

sync/
├── worker.js              das Programm, das bei Cloudflare läuft
└── LIESMICH.md            Einrichtung Schritt für Schritt

assistent/
├── worker.js              hält den Anthropic-Schlüssel, reicht sonst nur durch
└── LIESMICH.md            Einrichtung Schritt für Schritt
```

### Drei Grundregeln

1. **Intern wird immer in Zentimetern gerechnet.** Ob Meter oder Zentimeter
   angezeigt werden, ist reine Anzeigesache.
2. **Die Oberfläche ändert nie selbst Daten.** Sie ruft nur Aktionen aus
   `planStore.ts` auf. Dadurch funktionieren Rückgängig und die automatische
   Speicherung überall zuverlässig.
3. **Was rechnet, liegt in `logik/` und ist geprüft.** Flächen, Verschneidungen
   und die Zusammenführung beim Abgleich sind reine Funktionen ohne
   Nebenwirkungen. Ein Fehler an diesen Stellen fällt nicht auf – er verschiebt
   still eine Quadratmeterzahl oder verliert eine Planung.

### Beim Entwickeln

In der Entwicklungsfassung liegt der Datenspeicher auf `window`, damit sich in
der Browser-Konsole nachsehen lässt, was gerade drinsteht:

```js
marktplaner.getState().projekt.grundflaeche.umriss
polygon.flaeche(marktplaner.getState().projekt.grundflaeche.umriss) / 10000
```

In der gebauten Fassung fällt das weg.

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
