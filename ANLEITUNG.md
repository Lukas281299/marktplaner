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
11. [Speichern, Sichern, Exportieren](#11-speichern-sichern-exportieren)
12. [Abgleich zwischen mehreren Rechnern](#12-abgleich-zwischen-mehreren-rechnern)
13. [Die Symbolbibliothek](#13-die-symbolbibliothek)
14. [Alle Tastenkürzel](#14-alle-tastenkürzel)
15. [Was noch nicht geht](#15-was-noch-nicht-geht)

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
| Ansicht verschieben | **Leertaste gedrückt halten** und ziehen, oder mittlere Maustaste |
| Alles anzeigen | Knopf *Einpassen* oder **Strg + 0** |

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

### Innenwand

Von einem Punkt zum anderen ziehen, ohne gleich einen ganzen Raum abzutrennen.
Fast waagerechte und fast senkrechte Wände werden automatisch gerade gezogen.

### Tür / Durchgang

Auf eine Wand klicken. Die Öffnung übernimmt Richtung und Wandstärke von
selbst. Danach rechts einstellen:

- **Art**: Tür, Durchgang, Tor
- **Lichte Breite**
- **Drehung** — bei einer Tür bestimmt sie, wohin der Flügel aufschlägt

Türen werden mit ihrem Schwenkbogen gezeichnet. Im Plan sieht man dadurch
sofort, wie viel Platz eine geöffnete Tür braucht.

---

## 5. Elemente einfügen und bewegen

### Einfügen

Zwei Wege:

- **Ziehen**: eine Vorlage aus der Bibliothek auf die Zeichenfläche ziehen.
  Das Element landet dort, wo man loslässt.
- **Klicken**: eine Vorlage anklicken. Das Element wird in der Mitte der
  Ansicht eingefügt.

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

Rechts unter *Ebenen* stehen fünf Ebenen: Gebäude & Wände, Räume, Einrichtung,
Beschriftungen und Laufwege. Dahinter steht, wie viele Elemente darauf liegen.

Zu jeder Ebene gibt es zwei Knöpfe:

- **Auge** — Ebene ein- oder ausblenden
- **Schloss** — Ebene sperren, dann lässt sich nichts darauf verschieben

Das ist nützlich, wenn man die Einrichtung umstellt und das Gebäude dabei in
Ruhe lassen will.

---

## 10. Flächenübersicht und Regalmeter

Ohne Auswahl rechnet das Programm unten rechts durchgehend mit:

| Zeile | Bedeutung |
|---|---|
| **Gebäude (Außenmaß)** | die ganze Grundfläche einschließlich Außenwand |
| **Innenfläche** | dasselbe ohne die Außenwand |
| **Nebenflächen** | Lager, Kühlräume, Technik — alles, was nicht Verkauf ist |
| **Verkaufsfläche** | Innenfläche minus Nebenflächen |
| **Belegt durch Elemente** | die Standfläche aller Möbel |
| **Freie Verkaufsfläche** | was davon übrig bleibt |
| **Regalmeter** | die laufenden Meter Regal, bei Gondeln beide Seiten |

Darunter steht die Fläche jedes einzelnen Raums — ein Klick darauf wählt den
Raum aus. Und darunter die belegte Fläche je Abteilung.

---

## 11. Speichern, Sichern, Exportieren

| Knopf | Was er tut |
|---|---|
| **Speichern** | speichert sofort (passiert sonst automatisch) |
| **JSON** | sichert die ganze Planung als Datei — alle Daten, zum Archivieren oder Weitergeben |
| **Import** | liest so eine Datei wieder ein |
| **Bild** | speichert den Plan als PNG |

Die JSON-Datei ist das vollständige Sicherungsformat. Wer eine Planung an
jemanden weitergeben will, der kein Konto hat, schickt diese Datei.

---

## 12. Abgleich zwischen mehreren Rechnern

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

## 13. Die Symbolbibliothek

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

Jede Abteilung hat außerdem ein **freies Element**, dessen Maße man beliebig
einstellen kann.

### Zwei Regeln, die man im Plan sieht

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

---

## 14. Alle Tastenkürzel

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
| **S** | Am Raster einrasten ein- oder ausschalten |
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

## 15. Was noch nicht geht

**PDF-Import.** Einen bestehenden Marktplan als Hintergrund einlesen, auf
Maßstab kalibrieren und darin weiterarbeiten — das ist gebaut, aber noch nicht
im Programm.

**Eigene Vorlagen speichern.** Das Datenmodell kann eigene Vorlagen, und der
Abgleich überträgt sie. Es fehlt der Knopf, mit dem man ein platziertes
Element als Vorlage ablegt. Bis dahin hilft *Duplizieren*.

**Smokytheke.** Der Zigarettenschrank über dem Kassenband fehlt noch als
eigenes Symbol.
