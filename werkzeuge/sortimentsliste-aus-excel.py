"""
Macht aus der Sortimentsliste des Marktes eine JSON-Datei für den Marktplaner.

    python werkzeuge/sortimentsliste-aus-excel.py "Edeka Sortimentsliste.xlsx"

Heraus kommt `sortimentsliste.json` neben der Tabelle. Die lädt man im
Marktplaner im Reiter *Warengruppen* über **Liste ergänzen** – dann kommt
dazu, was neu ist, und alles Vorhandene bleibt samt Haken stehen.

Gelesen wird die **Gliederung der Tabelle**, nicht ihre Schrift: Excel merkt
sich zu jeder Zeile, wie tief sie eingerückt gruppiert ist, und genau das ist
die Hierarchie.

    keine Stufe   Abteilung
    Stufe 1       Warengruppe
    Stufe 2+      Sortiment

Alles unterhalb einer Warengruppe zählt als Sortiment – auch Stufe 3. In der
Vorlage sitzen die Sortimente einer Warengruppe eine Stufe zu tief; ohne diese
Regel fielen sie weg.

Gebraucht wird nur Python. Eine .xlsx-Datei ist ein Zip-Archiv mit XML darin,
und beides kann Python von Haus aus – kein zusätzliches Paket nötig.
"""

import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def lies(tabelle: Path, blatt: int = 1) -> dict:
    """Liest das erste Blatt und gibt die Liste als verschachtelte Struktur."""
    with zipfile.ZipFile(tabelle) as archiv:
        texte = zeichenketten(archiv)
        wurzel = ET.fromstring(archiv.read(f"xl/worksheets/sheet{blatt}.xml"))

    abteilungen: list[dict] = []
    for zeile in wurzel.iter(f"{{{NS}}}row"):
        name = erste_spalte(zeile, texte)
        if not name:
            continue

        stufe = int(zeile.get("outlineLevel") or 0)
        if stufe == 0:
            # Die Kopfzeile der Tabelle ist keine Abteilung.
            if name.lower() in ("sortiment", "abteilung"):
                continue
            abteilungen.append({"name": name, "warengruppen": []})
        elif stufe == 1:
            if abteilungen:
                abteilungen[-1]["warengruppen"].append({"name": name, "sortimente": []})
        else:
            if abteilungen and abteilungen[-1]["warengruppen"]:
                abteilungen[-1]["warengruppen"][-1]["sortimente"].append(name)

    return {"abteilungen": abteilungen}


def zeichenketten(archiv: zipfile.ZipFile) -> list[str]:
    """Die gemeinsame Zeichenkettentabelle – dort stehen alle Texte."""
    if "xl/sharedStrings.xml" not in archiv.namelist():
        return []
    wurzel = ET.fromstring(archiv.read("xl/sharedStrings.xml"))
    return [
        "".join(t.text or "" for t in eintrag.iter(f"{{{NS}}}t"))
        for eintrag in wurzel.findall(f"{{{NS}}}si")
    ]


def erste_spalte(zeile, texte: list[str]) -> str:
    """Der Text in Spalte A dieser Zeile."""
    for zelle in zeile.findall(f"{{{NS}}}c"):
        if "".join(c for c in zelle.get("r", "") if c.isalpha()) != "A":
            continue
        wert = zelle.find(f"{{{NS}}}v")
        if wert is None or wert.text is None:
            return ""
        roh = texte[int(wert.text)] if zelle.get("t") == "s" else wert.text
        return roh.strip()
    return ""


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    tabelle = Path(sys.argv[1])
    if not tabelle.exists():
        print(f"Nicht gefunden: {tabelle}")
        return 1

    liste = lies(tabelle)
    ziel = tabelle.with_name("sortimentsliste.json")
    ziel.write_text(json.dumps(liste, ensure_ascii=False, indent=2), encoding="utf-8")

    warengruppen = sum(len(a["warengruppen"]) for a in liste["abteilungen"])
    sortimente = sum(
        len(w["sortimente"]) for a in liste["abteilungen"] for w in a["warengruppen"]
    )
    print(f"{ziel}")
    print(
        f"{len(liste['abteilungen'])} Abteilungen, "
        f"{warengruppen} Warengruppen, {sortimente} Sortimente"
    )
    for abteilung in liste["abteilungen"]:
        print(f"  {abteilung['name']}: {len(abteilung['warengruppen'])} Warengruppen")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
