# Synchronisation einrichten

Damit du an einem Rechner anfängst und am anderen genau dort weitermachst.
Einmal einrichten, danach läuft es von allein.

**Was hier passiert:** Ein winziges Programm bei Cloudflare nimmt einen
verschlüsselten Block entgegen und gibt ihn wieder heraus. Es kann die Planungen
nicht lesen — der Marktplaner verschlüsselt sie im Browser, bevor etwas
hochgeht.

**Kosten:** keine. Die kostenlose Stufe von Cloudflare erlaubt 100.000 Zugriffe
und 1.000 Schreibvorgänge pro Tag. Du brauchst vielleicht dreißig.

**Dauer:** rund zehn Minuten.

---

## Schritt 1: Konto anlegen

1. [cloudflare.com](https://cloudflare.com) → **Sign Up**
2. E-Mail und Passwort wählen. **Kein Zahlungsmittel nötig.**
3. Bestätigungsmail anklicken

Falls du vom Kraft Tracker schon ein Cloudflare-Konto hast: dasselbe verwenden.
Ein zweites brauchst du nicht.

---

> **Cloudflare auf Deutsch oder Englisch?** Die Oberfläche wechselt je nach
> Spracheinstellung. Unten steht jeweils die deutsche Bezeichnung, die
> englische in Klammern.

## Schritt 2: Ablage anlegen

Im Dashboard links: **Speicher und Datenbanken** (Storage & Databases) →
**Workers KV**

1. **Instanz erstellen** (Create Instance)
2. Name: `marktplaner`
3. **Hinzufügen** (Add)

---

## Schritt 3: Programm anlegen

Links: **Compute** → **Workers und Pages** (Workers & Pages)

1. **Erstellen** (Create) → **Start with Hello World!**
2. Namen ändern auf `marktplaner-sync`
3. **Bereitstellen** (Deploy)

Nach dem Anlegen zeigt Cloudflare eine Adresse der Form

```
https://marktplaner-sync.DEIN-NAME.workers.dev
```

**Diese Adresse brauchst du später — kopier sie dir raus.**

---

## Schritt 4: Ablage mit dem Programm verbinden

Beim Worker: **Einstellungen** (Settings) → **Bindungen** (Bindings) →
**Hinzufügen** (Add) → **KV-Namespace**

- **Typ: KV-Namespace** — das ist der Klick, auf den es ankommt. Wird hier
  „Variable" oder „Secret" gewählt, liegt unter dem Namen später eine
  Zeichenkette statt einer Ablage.
- **Variablenname** (Variable name): `MARKTPLANER` — genau so, groß geschrieben
- **KV-Namespace:** `marktplaner` auswählen
- **Bereitstellen** (Deploy)

> Ohne diesen Schritt meldet der Worker später „Der KV-Namensraum MARKTPLANER
> ist nicht verbunden".

> **Achtung:** Stellst du später den Code neu bereit, kann Cloudflare eine über
> das Dashboard angelegte Bindung wieder entfernen. Nach jedem *Deploy* aus dem
> Code-Editor also kurz nachsehen, ob sie noch da ist.

---

## Schritt 5: Code einfügen

Beim Worker: **Code bearbeiten** (Edit code)

1. Alles im Editor markieren und löschen
2. Den kompletten Inhalt von [worker.js](worker.js) einfügen
3. **Bereitstellen** (Deploy)

**Prüfen:** Ruf die Adresse aus Schritt 3 im Browser auf. Dort muss stehen:

```json
{"dienst":"marktplaner-sync","bereit":true,"version":1,"ablage":true}
```

Steht dort `"ablage":false`, läuft das Programm, aber Schritt 4 hat nicht
geklappt — dann dorthin zurück.

---

## Schritt 6: Im Marktplaner verbinden

In der Werkzeugleiste: **Abgleich**

1. Adresse aus Schritt 3 eintragen
2. **Verbinden** → der Marktplaner zeigt einen **Kopplungscode**
3. Diesen Code auf dem zweiten Rechner unter derselben Stelle eingeben

**Den Code gut aufheben.** Er ist zugleich der Schlüssel: Ohne ihn kommt niemand
an die Planungen — auch du nicht.

---

## Was abgeglichen wird

| | |
|---|---|
| ✅ | Alle Marktplanungen mit Grundriss, Räumen, Elementen und Ebenen |
| ✅ | Selbst angelegte Vorlagen der Elementbibliothek |
| ✅ | Welche Planung zuletzt offen war — damit du am anderen Rechner dort weitermachst |
| ❌ | Zoom und Bildausschnitt — die sind absichtlich pro Gerät |

## Wie zusammengeführt wird

Beide Rechner halten den vollständigen Bestand. Beim Abgleich gilt **pro
Planung: die zuletzt geänderte gewinnt.** Eine Planung ist ein Ganzes — sie
wird nicht zeilenweise verschmolzen.

Das heißt auch: Arbeitest du an **derselben** Planung gleichzeitig an zwei
Rechnern, gewinnt der Stand, der zuletzt gespeichert wurde. Der andere ist
dann weg. Sobald der Marktplaner das bemerkt, legt er vorher automatisch eine
Sicherungskopie unter „Name (Stand vom …)" an, damit nichts verloren geht.

Gelöschtes bleibt gelöscht: Der Marktplaner merkt sich Löschungen getrennt,
sonst käme eine gelöschte Planung beim nächsten Abgleich vom anderen Rechner
zurück.

## Wenn etwas nicht klappt

| Meldung | Ursache |
|---|---|
| „Server nicht erreichbar" | Adresse falsch, oder der Worker wurde nicht veröffentlicht. Adresse im Browser aufrufen und auf die Statusmeldung prüfen. |
| „Unter dieser Adresse läuft etwas anderes" | Im Worker steht noch das Hello-World-Beispiel. Schritt 5 wiederholen. |
| „Der KV-Namensraum MARKTPLANER ist nicht verbunden" | Schritt 4 fehlt oder der Variablenname ist nicht exakt `MARKTPLANER`. |
| „Die Bindung MARKTPLANER ist kein KV-Namensraum" | Bei Schritt 4 wurde der falsche Typ gewählt (z. B. „Variable" statt „KV-Namespace"). Eintrag löschen und neu anlegen. |
| „Keine Antwort vom Server" — im Browser steht `error code: 1101` | Der Worker ist abgestürzt. Fast immer Schritt 4: Bindung fehlt oder hat den falschen Typ. |
| „Der Block ließ sich nicht entschlüsseln" | Auf den beiden Rechnern stehen verschiedene Kopplungscodes. Auf dem zweiten Rechner den Code des ersten eintragen, nicht einen neuen erzeugen. |
| „Zwischenzeitlich geändert" | Zwei Rechner haben gleichzeitig geschrieben. Der Marktplaner versucht es von selbst erneut — nur wenn es dauerhaft bleibt, ist etwas faul. |
| Code verloren | Dann kommst du an den Serverstand nicht mehr heran. Die Planungen auf deinen Rechnern bleiben aber unangetastet: neuen Code erzeugen und neu koppeln. |
