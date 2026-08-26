# Assistenten einrichten

Damit du dem Marktplaner sagen kannst, was er tun soll, statt es zu klicken.
Einmal einrichten, danach läuft es.

**Was hier passiert:** Ein winziges Programm bei Cloudflare hält deinen
Anthropic-Schlüssel und reicht Fragen an Claude weiter. Die App selbst kennt
den Schlüssel **nicht** — sie liegt öffentlich auf GitHub Pages, und was im
Browser steht, kann jeder auslesen, der sich für die Seite interessiert.

**Was es kostet:** Der Worker ist kostenlos. Die Anfragen an Claude gehen über
deinen Anthropic-Schlüssel und kosten nach Verbrauch — grob ein bis drei Cent
je Auftrag. Gegen Ausrutscher steht ein Tageslimit darin.

**Dauer:** rund zehn Minuten. Vieles davon kennst du vom Abgleich.

---

## Was du brauchst

- Ein Cloudflare-Konto — dasselbe wie beim Abgleich, ein zweites brauchst du
  nicht.
- Einen Anthropic-Schlüssel von [console.anthropic.com](https://console.anthropic.com)
  → **API Keys**. Der von der Romanschreibapp geht auch; zwei Programme dürfen
  sich einen teilen.

---

> **Cloudflare auf Deutsch oder Englisch?** Die Oberfläche wechselt je nach
> Spracheinstellung. Unten steht jeweils die deutsche Bezeichnung, die
> englische in Klammern.

## Schritt 1: Programm anlegen

Im Dashboard links: **Compute** → **Workers und Pages** (Workers & Pages)

1. **Erstellen** (Create) → **Start with Hello World!**
2. Namen ändern auf `marktplaner-assistent`
3. **Bereitstellen** (Deploy)

Cloudflare zeigt danach eine Adresse der Form

```
https://marktplaner-assistent.DEIN-NAME.workers.dev
```

**Diese Adresse brauchst du später — kopier sie dir raus.**

---

## Schritt 2: Code einfügen

Beim Worker: **Code bearbeiten** (Edit code)

1. Alles im Editor markieren und löschen
2. Den kompletten Inhalt von [worker.js](worker.js) einfügen
3. **Bereitstellen** (Deploy)

---

## Schritt 3: Ablage verbinden

Der Assistent zählt mit, wie viele Anfragen an einem Tag gelaufen sind. Dafür
nimmt er **dieselbe** Ablage wie der Abgleich — eine zweite brauchst du nicht.

Beim Worker: **Einstellungen** (Settings) → **Bindungen** (Bindings) →
**Hinzufügen** (Add) → **KV-Namespace**

- **Typ: KV-Namespace** — darauf kommt es an. Wird hier „Variable" gewählt,
  liegt unter dem Namen später eine Zeichenkette statt einer Ablage.
- **Variablenname** (Variable name): `MARKTPLANER` — genau so, groß
- **KV-Namespace:** `marktplaner` auswählen

Hast du den Abgleich noch nicht eingerichtet, gibt es die Ablage noch nicht:
dann zuerst **Speicher und Datenbanken** (Storage & Databases) → **Workers
KV** → **Instanz erstellen**, Name `marktplaner`.

---

## Schritt 4: Schlüssel und Zugangswort hinterlegen

Beim Worker: **Einstellungen** (Settings) → **Variablen und Secrets**
(Variables and Secrets) → **Hinzufügen**

Cloudflare fragt nach *Schlüssel* und *Wert* und hat daneben ein Kästchen
**Geheimnis** (Secret). Wo es hier gesetzt ist, muss es gesetzt sein: Ohne
Häkchen steht der Anthropic-Schlüssel danach für jeden lesbar im Dashboard.

| Schlüssel | Wert | Geheimnis |
|---|---|---|
| `ANTHROPIC_API_KEY` | dein Schlüssel, beginnt mit `sk-ant-` | ☑ ja |
| `ASSISTENT_ZUGANG` | ein Wort, das du dir ausdenkst | ☑ ja |
| `ERLAUBTE_HERKUNFT` | `https://lukas281299.github.io` | ☐ nein |
| `TAGESLIMIT` | `200` | ☐ nein |

Über **+ Hinzufügen** kommen weitere Zeilen dazu; der Knopf unten zählt mit
und muss am Ende *Fügen Sie 4 Variablen hinzu* anbieten. Danach
**Bereitstellen** (Deploy) — sonst laufen sie nicht scharf.

**Zum Zugangswort:** Denk dir etwas aus, das niemand rät — es ist der Riegel
vor deinem Schlüssel. Ein Passwortgenerator ist genau richtig. Du brauchst es
gleich noch einmal in der App, also mit abspeichern; nach dem Setzen zeigt
Cloudflare es nicht mehr an.

> **Kein Leerzeichen am Ende** — beim Einfügen rutscht leicht eines mit, und
> die App meldet später nur „Das Zugangswort stimmt nicht".

> **Achtung:** Stellst du später den Code neu bereit, kann Cloudflare eine
> über das Dashboard angelegte KV-Bindung wieder entfernen. Nach jedem *Deploy*
> aus dem Code-Editor also kurz nachsehen, ob sie noch da ist.

---

## Schritt 5: Prüfen

Ruf die Adresse aus Schritt 1 im Browser auf. Dort muss stehen:

```json
{"dienst":"marktplaner-assistent","bereit":true,"version":1,
 "schluessel":true,"zugang":true,"ablage":true}
```

Steht irgendwo `false`, fehlt genau das: `schluessel` und `zugang` kommen aus
Schritt 4, `ablage` aus Schritt 3.

---

## Schritt 6: Im Marktplaner verbinden

In der Werkzeugleiste: **Assistent** → unten **Einrichten**

1. Adresse aus Schritt 1 eintragen
2. Zugangswort aus Schritt 4 eintragen
3. **Verbinden**

Beides bleibt auf diesem Rechner und wandert nicht in die Planung. Am zweiten
Rechner trägst du dasselbe noch einmal ein.

---

## Was der Assistent kann

Alles, was du auch kannst — er greift auf dieselben Funktionen zu wie deine
Klicks:

| | |
|---|---|
| Nachsehen | Was steht wo, welche Warengruppen fehlen, welche Möbel gibt es |
| Einsetzen | Möbel aus der Bibliothek, einzeln oder als Reihe |
| Umstellen | Verschieben, drehen, ausrichten, verteilen, aneinanderschieben |
| Beschriften | Warengruppen in einzelne Meter, Kopfgondeln, Namen |
| Bauen | Räume, Wände, Maßlinien |
| Pflegen | Sortimentsliste abhaken, Projekteinstellungen |

**Ein Auftrag ist ein Strg+Z.** Egal, wie viele Handgriffe er umfasst: Ein
einziger Druck nimmt die ganze Antwort zurück. Deshalb darf der Assistent
handeln, statt zu fragen — ein Fehlgriff kostet dich einen Tastendruck.

---

## Wenn etwas nicht klappt

| Meldung | Ursache |
|---|---|
| „Unter dieser Adresse antwortet nichts" | Adresse falsch, oder der Worker wurde nicht bereitgestellt. |
| „Unter dieser Adresse läuft etwas anderes" | Im Worker steht noch das Hello-World-Beispiel. Schritt 2 wiederholen. |
| „Am Worker fehlt der ANTHROPIC_API_KEY" | Schritt 4, erste Zeile — Häkchen **Geheimnis** nicht vergessen. |
| „Am Worker fehlt das ASSISTENT_ZUGANG" | Schritt 4, zweite Zeile. |
| „Am Worker fehlt der KV-Namensraum MARKTPLANER" | Schritt 3 fehlt oder der Name ist nicht exakt `MARKTPLANER`. |
| „Das Zugangswort stimmt nicht" | In der App steht ein anderes als am Worker. Auf Leerzeichen am Ende achten. |
| „Der hinterlegte Schlüssel wird nicht angenommen" | Der Anthropic-Schlüssel ist abgelaufen oder falsch kopiert. |
| „Nicht erlaubt" (403) | `ERLAUBTE_HERKUNFT` passt nicht zur Adresse, unter der du den Marktplaner aufrufst — ohne Pfad am Ende, also `https://lukas281299.github.io`. |
| „Für heute ist Schluss" | Das Tageslimit ist erreicht. In Schritt 4 höher setzen, oder bis morgen warten. |
| „Gerade zu viele Anfragen" | Anthropic bremst. Eine Minute warten. |

## Was der Worker sieht und was nicht

Er sieht deine Frage, den Stand der Planung und die Antworten der Werkzeuge —
alles, was zum Beantworten nötig ist. Er speichert davon **nichts**: In der
Ablage liegt nur ein Zähler je Gerät und Tag.

Anders als beim Abgleich ist hier nichts verschlüsselt, und das geht auch
nicht — Claude muss den Plan ja lesen können, um über ihn zu reden.
