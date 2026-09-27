#!/usr/bin/env python3
"""Pobiera położenie przystanków z OpenStreetMap i zapisuje je do data/przystanki_gps.js.

ZKMB nie publikuje współrzędnych przystanków, więc bierzemy je z OSM (dane © autorzy OpenStreetMap,
licencja ODbL). Nazwy z OSM dopasowujemy do przystanków z data/rozklad.js tą samą funkcją klucz(),
a przystanki, których w OSM nie ma, szacujemy jako środek między sąsiednimi przystankami na trasie.

Użycie:
    python3 narzedzia/pobierz_gps.py
"""
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pobierz_rozklad import WYJSCIE as ROZKLAD, klucz  # noqa: E402

KATALOG = os.path.dirname(os.path.abspath(__file__))
WYJSCIE = os.path.join(KATALOG, "..", "data", "przystanki_gps.js")

# Białogard z okolicznymi wsiami (Zwinisław, Kisielice, Pękanino, Ustronie)
OBSZAR = (53.93, 15.85, 54.08, 16.12)
SERWERY = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Nazwy z OSM, które różnią się od nazw na tabliczkach ZKMB (klucz OSM -> klucze ZKMB).
ALIASY_OSM = {
    "bg production": ["zaklad bg p"],
    "wladyslawa komara": ["komara"],
    "kolobrzeska zaklad energetyczny": ["kolobrzeska energetyka", "kolobrzeska zaklad energ"],
    "chopina szkola nr 3": ["os chopina szkola nr 3"],
    "os zwyciestwa": ["os zwyciestwa i"],
    "zwyciestwa budynek 19 i nz": ["zwyciestwa budynek 19 i"],
    "zwyciestwa budynek 19 ii nz": ["zwyciestwa budynek 19 ii"],
    "kisielice duze zaklad doswiadczalny": ["kisielice duze zaklad dosw"],
    "kisielice duze": ["kisielice"],
    "wysznskiego 86a": ["wyszynskiego 86a"],
    "wojska polskiego": ["wojska polskiego sklep"],
    "pekanino petla": ["pekanino cmentarz"],
    "polczynska 22 i": ["polczynska 22 i", "polczynska 22 ii"],  # klucz() zamienia "Połczyńska 22" na "22 i"
}


def overpass():
    obszar = "(" + ",".join(str(x) for x in OBSZAR) + ")"
    zapytanie = (f"[out:json][timeout:90];"
                 f"(node[\"highway\"=\"bus_stop\"]{obszar};node[\"public_transport\"=\"platform\"]{obszar};);"
                 f"out body;")
    dane = urllib.parse.urlencode({"data": zapytanie}).encode()
    for proba in range(2):
        for url in SERWERY:
            try:
                req = urllib.request.Request(url, data=dane, headers={"User-Agent": "rozklad-bialogard"})
                with urllib.request.urlopen(req, timeout=100) as r:
                    return json.load(r)["elements"]
            except (OSError, ValueError) as e:
                print(f"{url}: {e}", file=sys.stderr)
        time.sleep(10)
    sys.exit("Nie udało się pobrać danych z OpenStreetMap.")


def wczytaj_rozklad():
    with open(ROZKLAD, encoding="utf-8") as f:
        tekst = f.read()
    return json.loads(tekst[tekst.index("=") + 1:].strip().rstrip(";"))


def main():
    rozklad = wczytaj_rozklad()
    przystanki = rozklad["przystanki"]

    punkty = {}
    for e in overpass():
        nazwa = e.get("tags", {}).get("name")
        if not nazwa:
            continue
        k = klucz(nazwa)
        for cel in ALIASY_OSM.get(k, [k]):
            if cel in przystanki:
                punkty.setdefault(cel, set()).add((round(e["lat"], 6), round(e["lon"], 6)))

    wynik = {k: {"p": sorted(v)} for k, v in punkty.items()}

    # brakujące: środek między sąsiadami na trasie (powtarzamy, bo sąsiad też mógł być brakujący)
    for _ in range(3):
        for t in rozklad["tabliczki"]:
            trasa = [w["k"] for w in t["trasa"]]
            for i, k in enumerate(trasa):
                if k in wynik or not 0 < i < len(trasa) - 1:
                    continue
                a, b = wynik.get(trasa[i - 1]), wynik.get(trasa[i + 1])
                if a and b:
                    (la, oa), (lb, ob) = a["p"][0], b["p"][0]
                    wynik[k] = {"p": [(round((la + lb) / 2, 6), round((oa + ob) / 2, 6))], "szac": 1}

    brak = sorted(k for k in przystanki if k not in wynik)
    szac = sorted(k for k, v in wynik.items() if v.get("szac"))
    print(f"Z OpenStreetMap: {len(przystanki) - len(brak) - len(szac)}, "
          f"szacowane: {len(szac)} {szac}, brak: {len(brak)} {brak}")

    with open(WYJSCIE, "w", encoding="utf-8") as f:
        f.write("// Wygenerowane przez narzedzia/pobierz_gps.py – nie edytuj ręcznie.\n")
        f.write("// Położenie przystanków: © autorzy OpenStreetMap (ODbL), \"szac\" = położenie szacowane.\n")
        f.write("window.PRZYSTANKI_GPS = ")
        json.dump({k: wynik[k] for k in sorted(wynik)}, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("Zapisano", os.path.relpath(WYJSCIE))


if __name__ == "__main__":
    main()
