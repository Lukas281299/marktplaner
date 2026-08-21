# Marktplaner — Bedienungsanleitung

Der Marktplaner ist ein Werkzeug, um einen Lebensmittelmarkt im Grundriss zu
planen: Gebäude, Räume, Wände, und darin die Einrichtung — Regale, Kühlmöbel,
Theken, Kassen. Alle Maße sind echte Maße. Was im Plan 1,25 m breit ist, ist
im Markt 1,25 m breit, und die Flächenübersicht rechnet damit.

Die Anwendung läuft im Browser unter
<https://lukas281299.github.io/marktplaner/> und speichert alles auf dem
eigenen Rechner. Über den Abgleich lässt sich derselbe Stand auf mehreren
Rechnern weiterbearbeiten.

---

## Inhalt

1. [Die Oberfläche](#1-die-oberfläche)
2. [Eine Planung anlegen](#2-eine-planung-anlegen)
3. [Der Grundriss](#3-der-grundriss)
4. [Räume, Wände und Türen](#4-räume-wände-und-türen)
5. [Elemente einfügen und bewegen](#5-elemente-einfügen-und-bewegen)
6. [Eigenschaften eines Elements](#6-eigenschaften-eines-elements)
7. [Regalzüge: Gruppieren und Aneinanderreihen](#7-regalzüge-gruppieren-und-aneinanderreihen)
8. [Messen und Maßlinien](#8-messen-und-maßlinien)
9. [Ebenen](#9-ebenen)
10. [Flächenübersicht und Regalmeter](#10-flächenübersicht-und-regalmeter)
11. [Bestehenden Plan einlesen](#11-bestehenden-plan-einlesen)
12. [Speichern, Sichern, Exportieren](#12-speichern-sichern-exportieren)
13. [Abgleich zwischen mehreren Rechnern](#13-abgleich-zwischen-mehreren-rechnern)
14. [Die Symbolbibliothek](#14-die-symbolbibliothek)
15. [Alle Tastenkürzel](#15-alle-tastenkürzel)
16. [Was noch nicht geht](#16-was-noch-nicht-geht)

---

## 1. Die Oberfläche

Das Fenster hat vier Bereiche:

**Oben die Werkzeugleiste.** Links der Name der Planung und die Knöpfe zum
Anlegen, Öffnen, Speichern und Abgleichen. Daneben Rückgängig, die
Zwischenablage, Drehen, Raster und Zoom. In der zweiten Zeile stehen unter
*Grundriss* die Zeichenwerkzeuge.

**Links die Elementbibliothek.** Alle Möbel, nach Abteilungen sortiert. Ein
Klick auf eine Abteilung klappt sie auf, darin liegen Untergruppen. Ganz oben
ist ein Suchfeld — die Suche geht über alle Abteilungen hinweg.

**In der Mitte die Zeichenfläche.** Hier steht der Plan.

**Rechts das Eigenschaftenfenster.** Was dort steht, hängt davon ab, was
ausgewählt ist. Ohne Auswahl zeigt es die Einstellungen des Projekts:
Grundfläche, Raster, Ebenen und die Flächenübersicht. Ist ein Element
ausgewählt, stehen dort seine Maße und Einstellungen.

**Unten die Statusleiste** mit der Mausposition in Planmaßen, dem Maßstab, der
Zahl der Elemente, dem Zoom und dem Stand des Abgleichs.

### Ansicht bewegen

| Aktion | Bedienung |
|---|---|
| Zoomen | Mausrad, oder die Knöpfe **−** / **+** |
| Greifen und schieben | **rechte Maustaste** gedrückt halten und ziehen |
| Dasselbe mit anderer Taste | mittlere Maustaste, oder **Leertaste** halten und ziehen |
| Schrittweise bewegen | **W A S D** |
| Dasselbe mit den Pfeiltasten | **← ↑ → ↓**, solange nichts ausgewählt ist |
| Vier Schritte auf einmal | **Umschalt** dazu |
| Alles anzeigen | Knopf *Einpassen* oder **Strg + 0** |

> **Achtung, geändert:** *Am Raster einrasten* lag früher auf **S**. Weil
> **W A S D** jetzt durch den Plan bewegt, sitzt es nun auf **E**. Das Raster
> ein- und auszublenden bleibt auf **G**.

---

## 2. Eine Planung anlegen

Beim ersten Start legt das Programm eine leere Planung an. Über **Neu** wird
eine weitere angelegt, über **Öffnen** wird zwischen gespeicherten Planungen
gewechselt. Es können beliebig viele nebeneinander bestehen.

Den **Namen** ändert man oben links im Textfeld.

Gespeichert wird **automatisch**, etwa eine Sekunde nachdem man aufgehört hat
zu arbeiten. Der Knopf *Speichern* (**Strg + S**) erzwingt es sofort. Beim
nächsten Start öffnet sich die zuletzt bearbeitete Planung von selbst.

### Grundfläche festlegen

Ohne Auswahl steht rechts oben **Grundfläche des Marktes**:

- **Breite** und **Länge** in Metern — daraus entsteht ein Rechteck
- **Wandstärke** der Außenwand
- **Maßeinheit**: Meter oder Zentimeter. Diese Einstellung gilt für alle
  Anzeigen im Programm.

Das Rechteck ist nur der Anfang. Wie daraus eine beliebige Form wird, steht im
nächsten Abschnitt.

---

## 3. Der Grundriss

Ein Markt ist selten ein Rechteck. Drei Werkzeuge in der Leiste *Grundriss*
formen den Umriss:

### Umriss

Zeigt die Ecken des Gebäudes als blaue Punkte.

- **Ecke ziehen** verschiebt sie.
- **Kleiner Kreis auf einer Wand**: anklicken setzt dort eine neue Ecke.
- **Doppelklick auf eine Ecke** entfernt sie.

### Frei zeichnen

Für einen Markt, den es noch nicht gibt: einen Grundriss von Grund auf auf das
leere Raster setzen.

| Aktion | Wirkung |
|---|---|
| **Klicken** | setzt eine Ecke |
| **Ziehen statt klicken** | macht aus der letzten Kante einen **Bogen**, der der Maus folgt |
| **Auf die erste Ecke klicken** | schließt den Umriss |
| **Enter** | schließt ebenfalls |
| **Rückschritt** | nimmt die zuletzt gesetzte Ecke zurück |
| **Escape** | wirft den angefangenen Zug weg |

Danach steht der Grundriss, und es geht ganz normal weiter — Räume abtrennen,
Regale setzen, messen.

Beim Anlegen einer neuen Planung gibt es dafür den Haken **Grundriss selbst
zeichnen**; dann ist das Werkzeug gleich aktiv.

> **Was mit Bögen passiert:** Ein Bogen wird beim Zeichnen in viele kurze
> Strecken aufgelöst — ein Halbkreis in achtundvierzig. Sichtbar macht das
> keinen Unterschied, und alles Weitere (Flächenberechnung, Wände, Anfügen und
> Abziehen) rechnet damit weiter wie gewohnt. Der Preis: Hinterher lässt sich
> ein Bogen nicht mehr als Bogen anfassen, nur noch als Kette von Ecken.

### Fläche anfügen

Ein Rechteck aufziehen — es wird zur Grundfläche hinzugerechnet. So entstehen
L-Formen, Anbauten, Vorkassenzonen.

### Fläche abziehen

Ein Rechteck aufziehen — dieser Bereich wird aus der Grundfläche
herausgeschnitten. Für Innenhöfe, Treppenhäuser oder eingerückte Ecken.

> Beide Werkzeuge rechnen mit echten Polygonen. Man kann also mehrfach anfügen
> und abziehen, ohne dass die Form kaputtgeht.

**Escape** legt jedes Werkzeug wieder weg und schaltet zurück auf
*Bearbeiten*.

---

## 4. Räume, Wände und Türen

### Raum abtrennen

Ein Rechteck aufziehen. Danach rechts einstellen:

- **Name** — steht im Plan
- **Art des Raums**: Verkaufsraum, Lager, Kühlraum, Sozialraum, Technik,
  Sonstiges
- **Wandstärke** und **Farbe**
- **Name und Fläche anzeigen** blendet die Beschriftung ein oder aus

Die Art entscheidet, ob der Raum als **Verkaufsfläche** zählt. Ein Lager oder
Kühlraum wird in der Flächenübersicht als Nebenfläche abgezogen.

Wer die Verkaufsfläche lieber selbst festlegt, statt sie aus den Räumen
rechnen zu lassen, zeichnet sie ein — siehe
[Die Verkaufsfläche einzeichnen](#die-verkaufsfläche-einzeichnen).

### Innenwand

Von einem Punkt zum anderen ziehen, ohne gleich einen ganzen Raum abzutrennen.
Fast waagerechte und fast senkrechte Wände werden automatisch gerade gezogen.

### Tür / Durchgang

Auf eine Wand klicken. Die Öffnung übernimmt Richtung und Wandstärke von
selbst. Danach rechts einstellen:

- **Art**: Tür, Durchgang, Tor
- **Lichte Breite**
- **Drehung** — bei einer Tür bestimmt sie, wohin der Flügel aufschlägt

Türen werden mit ihrem Schwenkbogen gezeichnet — einem **Viertelkreis**, vom
offenen Blatt bis zur geschlossenen Lage an der Wand. Im Plan sieht man
dadurch sofort, wie viel Gang eine geöffnete Tür braucht.

**Verschieben:** Eine gesetzte Öffnung lässt sich anfassen und ziehen. Sie
gleitet dabei **in ihrer Wand** entlang und übernimmt deren Richtung und
Stärke. Zieht man sie weit von jeder Wand weg, folgt sie frei — so bringt man
sie in eine ganz andere Wand.

---

## 5. Elemente einfügen und bewegen

### Einfügen

Zwei Wege:

- **Ziehen**: eine Vorlage aus der Bibliothek auf die Zeichenfläche ziehen.
  Das Element landet dort, wo man loslässt.
- **Klicken**: eine Vorlage anklicken. Das Element wird in der Mitte der
  Ansicht eingefügt.

### Favoriten

Jede Vorlage hat links einen **Stern**. Ein Klick darauf heftet sie oben in
**ihrer Untergruppe** an — mit gelbem Rand, damit erkennbar ist, dass es eine
Wiederholung ist. An ihrem gewohnten Platz weiter unten steht sie
**zusätzlich** weiterhin; wer dort sucht, findet sie auch dort.

Angeheftet wird in der Untergruppe, nicht am Kopf der ganzen Abteilung: Ein
angehefteter 1800er steht oben bei den 1800ern, nicht oben bei „Regale". So
bleibt die Höhe — das Erste, wonach man greift — der Einstieg in die Liste.

Favoriten gehören zum Rechner, nicht zur Planung: Wer meist mit 1250er
Gondeln plant, hat sie in jedem Markt oben stehen und muss sie nicht in jeder
Planung neu anhaken.

### Auswählen

| Aktion | Bedienung |
|---|---|
| Ein Element | anklicken |
| Mehrere | **Umschalt + Klick** |
| Ein Bereich | ins Leere klicken und einen Rahmen aufziehen |
| Alles | **Strg + A** |
| Auswahl aufheben | **Escape** oder ins Leere klicken |

### Bewegen und verformen

Ein ausgewähltes Element hat blaue Anfasser:

- **Ecken und Kanten ziehen** ändert die Größe.
- **Der Griff über dem Element** dreht es frei.
- **Ziehen in der Mitte** verschiebt es.

Mit den **Pfeiltasten** geht es genauer:

| Taste | Schritt |
|---|---|
| Pfeiltaste | eine Rasterweite |
| **Alt** + Pfeiltaste | genau 1 cm |
| **Umschalt** + Pfeiltaste | das Zehnfache der Rasterweite |

**R** dreht um 90° im Uhrzeigersinn, **Umschalt + R** dagegen.

### Einrasten und Hilfslinien

Rechts unter *Raster & Einrasten*:

- **Rasterweite** — der Abstand des Rasters in Metern
- **Raster anzeigen** (**G**)
- **Am Raster einrasten** (**S**)
- **Hilfslinien an Wänden und Nachbarn** — beim Verschieben erscheinen Linien,
  sobald ein Element mit einer Wand oder einem Nachbarn fluchtet
- **Abstände beim Verschieben anzeigen** — blendet die Maße zu den Nachbarn ein

### Beschriftungen auf dem Plan

Unter *Beschriftungen* steht **Namen auf dem Plan** mit drei Stellungen:

| Stellung | Wirkung |
|---|---|
| **Aus** | keine Beschriftung, der Plan bleibt frei |
| **Je Element** | jedes Möbel entscheidet selbst — der Normalfall |
| **Alle** | alles beschriften, auch was einzeln abgeschaltet ist |

Drei Stellungen und nicht zwei, weil jedes Element eine eigene Beschriftung
mitbringt. Ein eingelesener Plan bringt Dutzende Namen auf einmal, die einzeln
abgeschaltet sind, damit der Plan lesbar bleibt. Mit **Alle** holt man sie
hervor, ohne sie an jedem Möbel einzeln anfassen zu müssen.

---

## 6. Eigenschaften eines Elements

Ist ein Element ausgewählt, zeigt das rechte Fenster:

**Bezeichnung, Kategorie, Ebene** — wie das Element heißt, zu welcher
Abteilung es zählt und auf welcher Ebene es liegt.

**Breite, Tiefe, Höhe** — in der eingestellten Maßeinheit. Die Höhe ist reine
Information und wird im Grundriss nicht gezeichnet.

**Korpustiefe** — nur bei Möbeln, deren Front über den Korpus hinauskragt (die
Obst- und Gemüsetische). Der Wert sagt, welcher Teil tatsächlich auf dem Boden
steht. 0 bedeutet: keine auskragende Front.

**Seitenverhältnis beibehalten** — gilt für die Eckanfasser und für die
Eingabefelder.

**X / Y (Mitte)** und **Drehung** — die genaue Position.

**Farbe** und **Form** — die Zeichnung des Symbols.

**Text, Schriftgröße, Sichtbar** — die Beschriftung im Plan.

**Warengruppe, Hersteller / Modell, Notiz** — freie Angaben zur Dokumentation.

**Gesperrt** — das Element lässt sich nicht mehr aus Versehen verschieben.

**Beidseitig bestückt (Gondel)** — ändert die Zeichnung: Eine Gondel bekommt
den Mittelsteg, ein einseitiges Möbel die Rückwand.

### Durch eine andere Vorlage ersetzen

Der Knopf **Durch andere Vorlage ersetzen** tauscht das Möbel aus, ohne es
neu setzen zu müssen. Danach links eine Vorlage anklicken — fertig.

Lage, Drehung, Ebene und Beschriftung bleiben stehen. Bei einem **Regalzug
bleibt die Feldzahl erhalten**: Aus sechs Feldern zu 1,00 m werden sechs
Felder zu 1,25 m und nicht ein einzelnes Feld. Genau so denkt man beim
Umplanen.

Das geht auch für **mehrere Elemente auf einmal** — einfach alle auswählen.
Gesperrte Elemente bleiben unangetastet.

---

## 7. Regalzüge: Gruppieren und Aneinanderreihen

Ein Regalzug besteht aus vielen einzelnen Feldern. Damit man ihn trotzdem als
Ganzes bewegen kann, gibt es zwei Werkzeuge.

### Aneinanderreihen

Mehrere Regale auswählen und auf **Aneinanderreihen** klicken. Die Elemente
werden lückenlos aneinandergeschoben — in der Richtung, in der sie ohnehin
schon überwiegend stehen. Aus drei Feldern von 1,25 m wird ein Zug von genau
3,75 m, ohne Fugen und ohne Überlappung.

### Gruppieren

Mehrere Regale auswählen und **Strg + G** drücken. Danach bewegt ein Klick auf
eines der Regale die ganze Gruppe. **Strg + Umschalt + G** löst sie wieder auf.

> Fertige Gondelzüge stehen auch direkt in der Bibliothek — unter *Regale →
> Gondelzüge* von 2 bis 8 Feldern. Das spart das Aneinanderreihen von Hand.

---

## 8. Messen und Maßlinien

Das Werkzeug **Maß** (Taste **M**) trägt Abstände dauerhaft in den Plan ein.

Von einem Punkt zum anderen ziehen. Das Maßband **rastet an Regalecken,
Wänden und Raumecken ein** — man muss also nicht genau treffen. Das Maß bleibt
danach im Plan stehen.

Eine ausgewählte Maßlinie lässt sich einstellen:

- **Eigener Text statt des Maßes** — zum Beispiel „Gangbreite mind. 1,80 m"
- **Versatz der Maßlinie** — wie weit sie neben der gemessenen Strecke liegt
- **Gegen Verschieben sperren**

Ein zweiter Druck auf **M** legt das Maßband wieder weg.

---

## 9. Ebenen

Rechts unter *Ebenen* stehen sechs Ebenen: Gebäude & Wände, Räume,
Verkaufsfläche, Einrichtung, Beschriftungen und Laufwege. Dahinter steht, wie
viele Elemente darauf liegen — bei *Verkaufsfläche* die Zahl der
eingezeichneten Teilflächen.

Zu jeder Ebene gibt es zwei Knöpfe:

- **Auge** — Ebene ein- oder ausblenden
- **Schloss** — Ebene sperren, dann lässt sich nichts darauf verschieben

Das ist nützlich, wenn man die Einrichtung umstellt und das Gebäude dabei in
Ruhe lassen will. Genauso für die eingezeichnete Verkaufsfläche: Auge zu, und
der Plan ist frei von der Markierung, ohne dass etwas gelöscht wird.

**Ausblenden ändert keine Zahl.** Eine ausgeblendete Ebene ist nur unsichtbar,
nicht weg — die Flächenübersicht rechnet weiter mit ihr. Das gilt für Räume
wie für die Verkaufsfläche.

Eine Planung, die vor dieser Fassung angelegt wurde, bekommt fehlende Ebenen
beim Öffnen nachgetragen. Was du dort eingestellt hattest, bleibt: Eine
ausgeblendete Ebene wird nicht wieder eingeblendet.

---

## 10. Flächenübersicht und Regalmeter

Ohne Auswahl rechnet das Programm unten rechts durchgehend mit:

| Zeile | Bedeutung |
|---|---|
| **Gebäude (Außenmaß)** | die ganze Grundfläche einschließlich Außenwand |
| **Innenfläche** | dasselbe ohne die Außenwand |
| **Nebenflächen** | Lager, Kühlräume, Technik — alles, was nicht Verkauf ist |
| **Verkaufsfläche** | Innenfläche minus Nebenflächen — oder das, was eingezeichnet ist |
| **Belegt durch Elemente** | die Standfläche aller Möbel |
| **Freie Verkaufsfläche** | was davon übrig bleibt |
| **Regalmeter** | die laufenden Meter Regal, bei Gondeln beide Seiten |

Darunter steht die Fläche jedes einzelnen Raums — ein Klick darauf wählt den
Raum aus. Und darunter die belegte Fläche je Abteilung.

### Die Verkaufsfläche einzeichnen

Normalerweise **rechnet** das Programm die Verkaufsfläche aus: Innenfläche
minus alles, was als Nebenraum abgetrennt ist. Das trifft es meistens, aber
nicht immer — die Vorkassenzone gehört nicht dazu, ein Windfang auch nicht,
und eine Fläche aus dem Mietvertrag folgt ohnehin einer eigenen Linie.

Deshalb lässt sie sich stattdessen **einzeichnen**. Werkzeug
**Verkaufsfläche** in der zweiten Zeile der Werkzeugleiste:

| Aktion | Bedienung |
|---|---|
| Ecke setzen | klicken |
| Bogen statt Kante | von der letzten Ecke aus ziehen statt klicken |
| Fläche schließen | auf die erste Ecke klicken, oder <kbd>Enter</kbd> |
| Eine Ecke zurück | <kbd>Rückschritt</kbd> |
| Werkzeug weglegen | <kbd>Esc</kbd> |

Der Umriss darf ein **beliebiger Polygonzug** sein, mit Bögen wie beim freien
Grundriss. Nach dem Schließen bleibt das Werkzeug an, damit sich die nächste
Teilfläche direkt anschließt — **beliebig viele Teilflächen** sind möglich.

Sobald auch nur eine Fläche eingezeichnet ist, gilt das Gezeichnete. Die
Übersicht schreibt dann **· eingezeichnet** hinter die Verkaufsfläche und
listet jede Teilfläche einzeln auf; ein Klick darauf wählt sie aus. Die
Nebenflächen werden weiter ausgewiesen, greifen aber nicht mehr ein — wer
selbst einzeichnet, will nicht, dass ihm daneben noch etwas abgezogen wird.

Zwei Punkte, die man kennen sollte:

- **Überlappungen zählen nur einmal.** Zwei Teilflächen von je 300 m², die
  sich auf 150 m² überschneiden, ergeben 450 m² und nicht 600. Die Einzelwerte
  in der Liste stehen trotzdem so da, wie jede Fläche gezeichnet ist — sonst
  wäre die Liste nicht mehr nachvollziehbar.
- **Belegt wird am Mittelpunkt entschieden.** Für die freie Verkaufsfläche
  zählt nur, was mit seinem Mittelpunkt auf einer markierten Fläche steht.
  Ein Regal im Lager rechnet die Verkaufsfläche also nicht mehr klein.

Eine markierte Fläche liegt **über** dem Boden und den Räumen, aber **unter**
der Einrichtung: Sie überzieht den Raum darunter, verdeckt aber kein Regal.
Gezeichnet wird sie durchscheinend und schraffiert — eine deckende Fläche
würde man für einen Raum halten.

**Ein- und ausblenden** über die eigene Ebene *Verkaufsfläche* (siehe
[Ebenen](#9-ebenen)): Auge zu, und der Plan ist frei von der Markierung. Die
Quadratmeter in der Übersicht bleiben dabei stehen — ausgeblendet heißt
unsichtbar, nicht gelöscht.

Verschieben: die Fläche auf dem Plan ziehen. Rechts lassen sich Name, Farbe,
Beschriftung und die Sperre einstellen. Wird die letzte Teilfläche gelöscht,
rechnet die Übersicht wieder wie zuvor.

---

## 11. Bestehenden Plan einlesen

Mit **Plan-PDF** wird ein bestehender Marktplan eingelesen. Er landet
maßstäblich unter der Zeichnung, und wenn es ein CAD-Plan ist, kommen die
Regale gleich mit.

### Der Befund

Nach dem Auswählen der Datei zeigt der Dialog erst einmal, was er gefunden
hat — geändert wird noch nichts:

| Zeile | Bedeutung |
|---|---|
| **Planart** | *CAD-Plan* heißt: Der Plan lässt sich auswerten. *Bildplan* heißt: Er ist ein Scan und taugt nur als Vorlage zum Darüberzeichnen. |
| **Maßstab** | Wird aus den Maßketten des Plans zurückgerechnet, nicht aus dem Schriftfeld geglaubt. Steht dort etwas anderes, gewinnt die Zeichnung — und der Dialog sagt es. |
| **Gefundener Grundriss** | Wandzüge und Stützen, aus den gefüllten Flächen des Plans. Dazu die Gebäudemaße. |
| **Gefundene Regale** | Züge, Felder und wie viele davon Gondeln sind, dazu die Einschätzung sicher / wahrscheinlich / unsicher. |

Darunter steht **Was zu prüfen ist** — jede Unsicherheit einzeln, mit Grund.
Ein Regal mit falscher Tiefe sieht im Plan richtig aus und fällt erst auf,
wenn danach bestellt wird. Deshalb wird nichts verschwiegen.

### Wie der Grundriss gefunden wird

Ein CAD-Plan zeichnet Wände nicht als Linien, sondern als **gefüllte Flächen
in einer eigenen Farbe** — im Plan Dörnhagen ein Grau von `#696969`. Diese
Farbe sucht das Programm selbst: Es ist die, deren Flächen zusammen den
größten Teil des Blattes umspannen und dabei ringförmig sind. Möbel sind
massiv, Wände sind dünne Ringe um viel Luft.

Übernommen werden die Wandzüge **so, wie sie gezeichnet sind** — mit jedem
Vorsprung, jeder Nische und ihrer echten Stärke. Stützen ebenso: Eine
kreuzförmige Stütze von 975 × 1400 mm füllt ihre Bounding-Box nur zu 46 %,
und genau diese Form wird übernommen, nicht das Rechteck darum.

Ein Möbel von einer Stütze zu unterscheiden gelingt über drei Merkmale:

- **Dünner als 350 mm** ist immer Mauerwerk. In diesem Plan sind Wände und
  Pfeiler 240 bis 300 mm stark, und ein Regal gibt es in dieser Tiefe nicht.
- **Was sich wiederholt, ist ein Möbel.** Der Obst-und-Gemüse-Tisch steht
  neunmal im Plan, eine Stütze kommt in genau ihrer Größe kein zweites Mal vor.
  Bei schmalen Blöcken zählt erst die dritte Wiederholung — zwei gleiche
  Pfeiler nebeneinander sind der Normalfall.
- **Größer als 1,80 m** und massiv ist kein Bauteil mehr.

Als Grundfläche wird ein Rechteck um alles gelegt. Die wirkliche Form steht in
den Wandzügen; das Rechteck ist nur die Bezugsfläche, mit der die
Quadratmeter gerechnet werden.

### Wie die Regale gefunden werden

Nicht aus der Zeichnung, sondern aus den Zahlen darin. Ein Wanzl-Plan trägt
an jedem Regalfeld seine Etagenzahl — „5+", „6+". Deren Abstand ist das
Achsmaß, ihre Reihung die Laufrichtung, ihre Anzahl die Länge des Zuges.
Höhe und Tiefe kommen aus den Etiketten daneben (`wt100 H 1800 T 600`) und
aus den CAD-Blocknamen (`wt100_1250x600_neu`).

### Danach

Die Vorlage **bleibt liegen**. Das ist Absicht: Was übersehen wurde, sieht man
nur, wenn der Plan darunter noch da ist. Rechts unter *Eingelesener Plan*
lässt sich die Deckkraft regeln, die Lage verschieben und die Vorlage
entfernen.

Der ganze Import ist **ein Schritt in der Historie**. Ein einziges
**Strg + Z** nimmt ihn komplett zurück.

---

## 12. Speichern, Sichern, Exportieren

| Knopf | Was er tut |
|---|---|
| **Speichern** | speichert sofort (passiert sonst automatisch) |
| **JSON** | sichert die ganze Planung als Datei — alle Daten, zum Archivieren oder Weitergeben |
| **Import** | liest so eine Datei wieder ein |
| **Bild** | speichert den Plan als PNG |

Die JSON-Datei ist das vollständige Sicherungsformat. Wer eine Planung an
jemanden weitergeben will, der kein Konto hat, schickt diese Datei.

---

## 13. Abgleich zwischen mehreren Rechnern

Mit **Abgleich** arbeitet man an mehreren Rechnern an denselben Planungen.

### Einrichten

1. Am **ersten** Rechner den Abgleich öffnen und einen **Kopplungscode**
   erzeugen lassen. Er sieht aus wie `K7NP-2XQF-8MTR-WD4H`.
2. Den Code notieren.
3. Am **zweiten** Rechner denselben Code eintragen — nicht einen neuen
   erzeugen. Das ist der häufigste Fehler.
4. Optional einen **Gerätenamen** vergeben, damit man sieht, welcher Rechner
   zuletzt abgeglichen hat.

### Wie es funktioniert

Die Planungen werden **auf dem eigenen Rechner verschlüsselt**, bevor sie ihn
verlassen. Lesen kann sie nur, wer den Kopplungscode hat. Der Server sieht nur
verschlüsselte Daten.

Der Abgleich läuft im Hintergrund. Der Stand steht unten rechts in der
Statusleiste: *Abgeglichen: vor 3 min*. Über **Jetzt abgleichen** lässt er
sich sofort anstoßen.

> **Den Kopplungscode niemandem zeigen und nicht auf Bildschirmfotos stehen
> lassen.** Wer ihn hat, kann alle Planungen lesen. Falls das passiert:
> einfach einen neuen Code erzeugen und an allen Rechnern eintragen.

---

## 14. Die Symbolbibliothek

Alle Symbole sind aus den Wanzl- und WSL-Unterlagen nachgezeichnet und tragen
echte Maße.

| Abteilung | Inhalt |
|---|---|
| **Regale** | wire tech 100: Wandregale, Gondeln, Gondelzüge, Kopfgondeln, Eckfelder |
| **Kühlung** | Titan Remote und Cloud Remote, mit Tür und offen |
| **Tiefkühlung** | Truhen, Schränke, Kombigeräte, Inseln |
| **Bedienung & SB-Theken** | Blink Standard, Self und SV in vier Farben |
| **Obst & Gemüse** | Vitable in allen 20 Varianten, beide Achsmaße, Ecken und Abschlüsse |
| **Backwaren** | BakeOff 3.0, Türme und Eckstücke |
| **Kassen & Eingang** | Steh-, Sitz- und Doppelkassen, SB-Kassen, Ausgangsanlage |
| **Aktions- & Sonderflächen** | Aktionsflächen, EPAL und CHEP, Drehständer |
| **Weitere Ausstattung** | Treppe, Aufzug, Säulen, Türen, Stellflächen |
| **Bau und Technik** | Einzelsäule, Stütze, Unterzug, Schacht, Feuerlöscher, Notausgang, RWA, Bodenablauf, Strom- und Wasseranschluss |

Jede Abteilung hat außerdem ein **freies Element**, dessen Maße man beliebig
einstellen kann.

### Drei Regeln, die man im Plan sieht

**Das Achsmaß.** Jedes Regalfeld trägt ein Zeichen, an dem man seine Breite
erkennt, ohne nachzumessen:

| Achsmaß | Zeichen |
|---|---|
| 0,625 m | Kreuz |
| 1,00 m | kein Zeichen |
| 1,25 m | Diagonale von unten links nach oben rechts |
| 1,333 m | Kreuz |

Bei einem Zug steht das Zeichen in **jedem Feld**. Ein 6,25-m-Zug aus 1,25er
Feldern hat also fünf Diagonalen. Zieht man den Zug länger, kommen Felder
dazu.

**Die tote Zone.** Hinter jedem wire-tech-100-Regal bleiben 70 mm für Säule
und Rückwand. Ein Regal mit 600er Grundboden ist deshalb **670 mm tief**, nicht
600. Bei einer Gondel liegt die Zone zwischen beiden Seiten und zählt nur
einmal: 2 × 600 + 70 = **1270 mm**, und gerade nicht 1340. Die Zeichnung stellt
sie maßstäblich dar — bei der Gondel ist das der Strich in der Mitte.

Vor eine Gondel mit 600er Boden kommt eine Kopfgondel im Achsmaß 1250, vor
eine mit 500er Boden eine im Achsmaß 1000. Kopfgondeln gibt es gerade und rund
(Abschluss 180°).

**Die Türteilung.** An Kühlmöbeln und Tiefkühlschränken sitzt **alle 62,5 cm
eine Tür**. Ein 2,50-m-Möbel hat damit vier Türen, ein 3,75-m-Möbel sechs. Die
Zahl wird aus der Länge berechnet, nicht eingestellt: Zieht man den Schrank
länger, kommen Türen dazu — und genauso wird er bestellt.

Gezeichnet wird jede Tür im rechten Winkel offen, mit ihrem Schwenkbogen. Weil
alle in dieselbe Richtung aufschlagen, sieht man auf einen Blick, wie viel Gang
davor frei bleiben muss. Das offene Kühlregal und die Tiefkühlinsel bekommen
keine Bögen — die haben keine Schwenktüren.

---

## 15. Alle Tastenkürzel

### Datei und Bearbeiten

| Kürzel | Wirkung |
|---|---|
| **Strg + S** | Speichern |
| **Strg + Z** | Rückgängig |
| **Strg + Y** oder **Strg + Umschalt + Z** | Wiederholen |
| **Strg + C** | Kopieren |
| **Strg + V** | Einfügen |
| **Strg + D** | Duplizieren |
| **Strg + A** | Alles auswählen |
| **Entf** oder **Rückschritt** | Löschen |

### Auswahl und Werkzeuge

| Kürzel | Wirkung |
|---|---|
| **Escape** | Werkzeug weglegen, dann Auswahl aufheben |
| **Umschalt + Klick** | zur Auswahl hinzufügen |
| **R** | 90° im Uhrzeigersinn drehen |
| **Umschalt + R** | 90° dagegen |
| **M** | Maßband ein- und ausschalten |
| **Strg + G** | Auswahl gruppieren |
| **Strg + Umschalt + G** | Gruppierung auflösen |

### Ansicht

| Kürzel | Wirkung |
|---|---|
| **G** | Raster ein- oder ausblenden |
| **E** | Am Raster einrasten ein- oder ausschalten |
| **W A S D** | im Plan bewegen |
| **← ↑ → ↓** | im Plan bewegen, solange nichts ausgewählt ist |
| **Umschalt** dazu | vier Schritte auf einmal |
| **rechte Maustaste** | Plan greifen und schieben |
| **Strg + 0** | Ganzen Markt anzeigen |
| **Mausrad** | Zoomen |
| **Leertaste + Ziehen** | Ansicht verschieben |

### Verschieben

| Kürzel | Wirkung |
|---|---|
| **Pfeiltasten** | um eine Rasterweite |
| **Alt + Pfeiltaste** | um genau 1 cm |
| **Umschalt + Pfeiltaste** | um das Zehnfache |

> In einem Eingabefeld sind alle Einzeltasten wirkungslos — sonst würde das
> Tippen eines Namens das Raster umschalten.

---

## 16. Was noch nicht geht

**Der Gebäudeumriss ist ein Rechteck um alle Wandzüge.** Die Wandzüge selbst
sind exakt — sie kommen unverändert aus dem Plan. Sie zu einer einzigen
Umrisslinie zu verschmelzen ginge nur, wenn man jedes Polygon vorher um ein
paar Millimeter aufbliese: Ein CAD-Plan zeichnet jeden Wandzug einzeln, und
die stoßen kantengenau aneinander, ohne sich zu überlappen.

**Ein einzelnes Möbel in der Wandfarbe ist nicht zu erkennen.** Steht ein Tisch
nur ein einziges Mal im Plan, hilft auch die Wiederholung nicht mehr — dann
sieht er aus wie eine Stütze und wird als solche übernommen. Am Plan Dörnhagen
gemessen: von 66 grauen Flächen werden 65 richtig eingeordnet, ein
Aktions-Kopfregal von 820 × 370 mm kommt fälschlich als Stütze mit. Deshalb
steht im Befund, wie viele Flächen aussortiert wurden.

**Eigene Vorlagen speichern.** Das Datenmodell kann eigene Vorlagen, und der
Abgleich überträgt sie. Es fehlt der Knopf, mit dem man ein platziertes
Element als Vorlage ablegt. Bis dahin hilft *Duplizieren* oder *Durch andere
Vorlage ersetzen*.

**Smokytheke.** Der Zigarettenschrank über dem Kassenband fehlt noch als
eigenes Symbol.

**Einzelne Ecken einer Verkaufsfläche nachziehen.** Eine eingezeichnete
Verkaufsfläche lässt sich als Ganzes verschieben, aber ihre Ecken noch nicht
einzeln ziehen — das kann bisher nur der Gebäudeumriss. Wer die Linie ändern
will, zeichnet die Teilfläche neu.
