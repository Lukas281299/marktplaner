# Marktplaner

Ein Planungswerkzeug für EDEKA-Marktlayouts. React + TypeScript + Konva,
Zustand als Speicher, IndexedDB als Ablage. Veröffentlicht auf
<https://lukas281299.github.io/marktplaner/>.

## Sprache

**Alles auf Deutsch** — Oberfläche, Code-Kommentare, Namen im Code,
Commit-Nachrichten, Antworten. Keine englischen Bezeichner in neuem Code.

## Die Bedienungsanleitung mitführen

`unterlagen/Bedienungsanleitung.md` ist die Anleitung für den ganzen
Marktplaner. Sie liegt bewusst **außerhalb der Versionsverwaltung**
(`unterlagen/` ist in `.gitignore`), weil die Pläne und die Sortimentsliste
nicht öffentlich sein dürfen.

**Nach jeder Änderung, die an der Oberfläche etwas ändert, wird sie
mitgeführt** — im selben Arbeitsgang, nicht später:

1. Den betroffenen Abschnitt berichtigen oder ergänzen.
2. Einen Eintrag unter *18. Was sich wann geändert hat* anlegen, mit Datum
   und Verweis auf den Abschnitt.
3. Das **Stand**-Datum oben aktualisieren.

Das gilt für neue Funktionen, geänderte Bedienwege, verschobene oder
entfernte Felder, geänderte Rechenregeln und geänderte Tastenbelegungen.
Reine Innenarbeiten (Umbauten ohne sichtbare Wirkung) brauchen keinen
Eintrag.

Widerspricht die Anleitung dem Code, gilt der Code — dann ist die Anleitung
zu berichtigen.

## Was nicht ins Repository gehört

`unterlagen/` bleibt vollständig ungetrackt: Sortimentsliste, Ladenpläne,
Kataloge, die Anleitung. Nichts davon darf in einen Commit, in eine
Beispieldatei oder in einen Test wandern.

## Prüfen vor dem Festschreiben

```bash
npx tsc --noEmit && npx vitest run && npx vite build
```

Lukas arbeitet **nur auf der veröffentlichten Seite**. Ohne Push sieht er
keine Änderung; die GitHub Action braucht etwa 25 Sekunden, danach
**Strg+F5**.
