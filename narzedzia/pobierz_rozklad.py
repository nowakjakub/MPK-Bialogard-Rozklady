#!/usr/bin/env python3
"""Pobiera rozkład jazdy ZKM Białogard (PDF-y z zkmb.pl) i zapisuje go do data/rozklad.js.

Użycie:
    pip install pymupdf
    python3 narzedzia/pobierz_rozklad.py

Każdy PDF na zkmb.pl to jedna tabliczka: linia + przystanek + kierunek.
Skrypt czyta z niego godziny odjazdów (dzień powszedni oraz sobota/niedziela),
listę przystanków z czasem jazdy i objaśnienia oznaczeń.
"""
import datetime
import json
import os
import re
import sys
import unicodedata
import urllib.request

import pymupdf

STRONA = "https://www.zkmb.pl/rozklad-jazdy/"
KATALOG = os.path.dirname(os.path.abspath(__file__))
WYJSCIE = os.path.join(KATALOG, "..", "data", "rozklad.js")

# Kursy zaznaczone na żółto w PDF dostają ten znak (w objaśnieniach: żółty prostokąt).
ZNAK_ZOLTY = "#"


# Te same przystanki bywają w PDF-ach zapisane różnie (literówki, skróty).
ALIASY = {
    "rondo": "stamma rondo",
    "zwyciestwa": "zwyciestwa rondo",
    "polczynska 22": "polczynska 22 i",
    "gruwaldzka mdk": "grunwaldzka mdk",
    "wojska poslkiego poczta": "wojska polskiego poczta",
    "kisielice duze zaklad doswiadcz": "kisielice duze zaklad dosw",
}


def klucz(nazwa):
    """Wspólny identyfikator przystanku niezależny od pisowni."""
    n = nazwa.replace("(NŻ)", "").replace("ł", "l").replace("Ł", "L").lower()
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode()
    n = re.sub(r"\bosiedle\b", "os", n)
    n = " ".join(re.sub(r"[-.,]", " ", n).split())
    return ALIASY.get(n, n)


def pobierz(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (rozklad-bialogard)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def wiersze(slowa, tol=4):
    """Grupuje słowa w wiersze po współrzędnej y."""
    out = []
    for w in sorted(slowa, key=lambda w: (w[1], w[0])):
        yc = (w[1] + w[3]) / 2
        if out and abs(out[-1][0] - yc) <= tol:
            out[-1][1].append(w)
        else:
            out.append([yc, [w]])
    return [(y, sorted(ws, key=lambda w: w[0])) for y, ws in out]


def tekst(ws):
    return " ".join(w[4] for w in ws)


def czytaj_pdf(pdf, nazwa_pliku=""):
    strona = pymupdf.open(stream=pdf, filetype="pdf")[0]
    m = strona.rotation_matrix  # PDF-y są obrócone o 90°, pracujemy na współrzędnych "jak widać"
    W = [tuple(pymupdf.Rect(w[:4]) * m) + (w[4],) for w in strona.get_text("words")]
    rysunki = strona.get_drawings()

    def znajdz(t):
        return next(w for w in W if w[4] == t)

    przyst, kier, godz, czas, sob = (znajdz(t) for t in ("Przystanek:", "Kierunek", "Godz.", "Czas", "SOBOTA"))
    lista = znajdz("Przystanki:")

    granica_godzin = godz[0] + 24
    ostatnia = max((w for w in W if (w[0] + w[2]) / 2 < granica_godzin and w[4] in ("22", "23") and w[1] > godz[3]),
                   key=lambda w: w[3])
    koniec_tabeli = ostatnia[3] + 2
    objasnienia_start = min((w for w in W if w[4].startswith(("Objaś", "Tolerancja")) and w[1] > koniec_tabeli - 5),
                            key=lambda w: w[1], default=None)

    def wypelnienie(r, g, b, tol):
        return [d["rect"] * m for d in rysunki if d.get("fill")
                and abs(d["fill"][0] - r) < tol and abs(d["fill"][1] - g) < tol and abs(d["fill"][2] - b) < tol]

    zolte = wypelnienie(1.0, 0.95, 0.8, 0.06)
    kolumna_sob = wypelnienie(0.85, 0.88, 0.95, 0.03)
    lewa_sob = min(r.x0 for r in kolumna_sob) if kolumna_sob else sob[0] - 11

    def na_zolto(w):
        cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
        return any(r.x0 <= cx <= r.x1 and r.y0 <= cy <= r.y1 for r in zolte)

    # nagłówek
    nazwa = tekst([w for w in W if przyst[3] < w[1] < kier[1] - 1 and przyst[0] - 2 <= w[0] < 450])
    kierunek = tekst([w for w in W if kier[3] < w[1] < kier[3] + 16 and kier[0] - 2 <= w[0] < 450])
    wazny = next((w[4] for w in W if re.match(r"\d\d\.\d\d\.\d{4}$", w[4])), None)

    # tabela godzin
    siatka = [w for w in W if godz[3] < (w[1] + w[3]) / 2 < koniec_tabeli and w[0] < lista[0] - 5]
    godziny = [(w, int(w[4])) for w in siatka if (w[0] + w[2]) / 2 < granica_godzin and re.fullmatch(r"\d{1,2}", w[4])]
    odjazdy = {"R": [], "SN": []}
    for w in siatka:
        if (w[0] + w[2]) / 2 < granica_godzin or w[4] == "Minuty":
            continue
        czesci = re.findall(r"(\d{2})([^\d\s]*)", w[4])
        if not czesci or "".join(a + b for a, b in czesci) != w[4]:
            print("Nie rozumiem:", nazwa_pliku, w[4], file=sys.stderr)
            continue
        yc = (w[1] + w[3]) / 2
        g, h = min(godziny, key=lambda gh: abs((gh[0][1] + gh[0][3]) / 2 - yc))
        if abs((g[1] + g[3]) / 2 - yc) > 6:
            print("Niepewny wiersz:", nazwa_pliku, w[4], file=sys.stderr)
        dzien = "SN" if w[0] >= lewa_sob - 4 else "R"
        for minuty, znak in czesci:
            if na_zolto(w):
                znak = ZNAK_ZOLTY + znak
            odjazdy[dzien].append([f"{h:02d}:{minuty}", znak])
    for d in odjazdy:
        odjazdy[d].sort()

    # lista przystanków z czasem jazdy (czasem w dwóch kolumnach – dwa warianty trasy)
    trasa = []
    nazwy = [w for w in W if w[1] > lista[3] and lista[0] - 3 <= w[0] < czas[0] - 3 and w[1] < koniec_tabeli]
    czasy = [w for w in W if (w[1] + w[3]) / 2 > czas[3] + 2 and w[0] >= czas[0] - 6 and w[1] < koniec_tabeli
             and w[4] != "jazdy"]
    kolumny = sorted({round(w[0] / 12) for w in czasy})
    for y, ws in wiersze(nazwy):
        nazwa_p = tekst(ws)
        nz = "(NŻ)" in nazwa_p
        wiersz = {"n": nazwa_p.replace("(NŻ)", "").strip(), "m": [None] * len(kolumny)}
        for o in czasy:
            if abs((o[1] + o[3]) / 2 - y) < 5:
                k = kolumny.index(round(o[0] / 12))
                wiersz["m"][k] = int(o[4]) if o[4].isdigit() else o[4]
        if nz:
            wiersz["nz"] = 1
        trasa.append(wiersz)

    # objaśnienia
    obj, uwagi = {}, []
    if objasnienia_start:
        for y, ws in wiersze([w for w in W if w[1] > objasnienia_start[1] - 2 and w[0] < 560
                              and not w[4].startswith("Objaś")]):
            if any(r.y0 - 2 <= y <= r.y1 + 2 and r.x1 <= ws[0][0] + 3 for r in zolte):
                obj[ZNAK_ZOLTY] = tekst(ws)
            elif len(ws[0][4]) <= 3 and len(ws) > 1 and ws[1][0] - ws[0][2] > 6:
                obj[ws[0][4]] = tekst(ws[1:])
            else:
                uwagi.append(tekst(ws))

    nazwa = nazwa.replace("(NŻ)", "").strip()
    for i, w in enumerate(trasa):
        w["k"] = klucz(nazwa) if i == 0 else klucz(w["n"])  # 1. pozycja to zawsze ten przystanek
    return {"przystanek": nazwa, "k": klucz(nazwa), "kierunek": kierunek, "waznyOd": wazny, "odjazdy": odjazdy,
            "trasa": trasa, "obj": obj, "uwagi": uwagi}


def main():
    html = pobierz(STRONA).decode("utf-8", "replace")
    linki = sorted(set(re.findall(r'href="([^"]+/rozklad/[^"]+\.pdf)"', html)))
    if not linki:
        sys.exit("Nie znalazłem żadnych PDF-ów z rozkładem na " + STRONA)
    tabliczki = []
    for url in linki:
        m = re.search(r"/rozklad/([^/]+)/([^/]+)/([^/]+)$", url)
        rodzaj, linia, plik = m.groups()
        t = czytaj_pdf(pobierz(url), plik)
        t = {"linia": linia, "rodzaj": rodzaj, "pdf": url, **t}
        tabliczki.append(t)
        print(f"linia {linia:>2}  {t['przystanek']:<35} → {t['kierunek']}")

    # nazwa do wyświetlania: z nagłówka tabliczki, a dla pętli bez tabliczki – z listy przystanków
    przystanki = {}
    for t in tabliczki:
        przystanki.setdefault(t["k"], t["przystanek"])
    for t in tabliczki:
        for w in t["trasa"]:
            przystanki.setdefault(w["k"], w["n"])

    dane = {
        "zrodlo": STRONA,
        "przystanki": przystanki,
        "pobrano": datetime.date.today().isoformat(),
        "waznyOd": sorted({t["waznyOd"] for t in tabliczki if t["waznyOd"]}),
        "tabliczki": tabliczki,
    }
    with open(WYJSCIE, "w", encoding="utf-8") as f:
        f.write("// Wygenerowane przez narzedzia/pobierz_rozklad.py – nie edytuj ręcznie.\n")
        f.write("window.ROZKLAD = ")
        json.dump(dane, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print(f"\nZapisano {len(tabliczki)} tabliczek do {os.path.relpath(WYJSCIE)}")


if __name__ == "__main__":
    main()
