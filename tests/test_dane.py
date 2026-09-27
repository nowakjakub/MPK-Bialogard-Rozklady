"""Sprawdza, czy data/rozklad.js ma poprawną strukturę i sensowną zawartość.

Uruchomienie:  python3 -m unittest discover tests
"""
import json
import os
import re
import unittest

KATALOG = os.path.dirname(os.path.abspath(__file__))
PLIK = os.path.join(KATALOG, "..", "data", "rozklad.js")

# Oznaczenia, których brakuje w objaśnieniach na oryginalnych tabliczkach ZKMB (błąd w PDF, nie u nas).
ZNANE_BRAKI_OBJASNIEN = {
    ("1-kier-Polczynska-06.-Stamma-rondo.pdf", "b"),
    ("2-kier-os.-Zwyciestwa-02.-Zwinislaw.pdf", "v"),
}


def wczytaj():
    with open(PLIK, encoding="utf-8") as f:
        tekst = f.read()
    return json.loads(tekst[tekst.index("=") + 1:].strip().rstrip(";"))


class TestDaneRozkladu(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dane = wczytaj()
        cls.tabliczki = cls.dane["tabliczki"]

    def test_sa_wszystkie_linie(self):
        linie = {t["linia"] for t in self.tabliczki}
        self.assertEqual(linie, {"1", "2", "3", "4"})
        self.assertGreater(len(self.tabliczki), 100)

    def test_pola_ogolne(self):
        self.assertTrue(self.dane["zrodlo"].startswith("https://www.zkmb.pl/"))
        self.assertRegex(self.dane["pobrano"], r"^\d{4}-\d{2}-\d{2}$")
        for d in self.dane["waznyOd"]:
            self.assertRegex(d, r"^\d{2}\.\d{2}\.\d{4}$")

    def test_godziny_poprawne_i_posortowane(self):
        for t in self.tabliczki:
            for typ in ("R", "SN"):
                godziny = [g for g, _ in t["odjazdy"][typ]]
                self.assertEqual(godziny, sorted(godziny), t["pdf"])
                for g in godziny:
                    self.assertRegex(g, r"^([01]\d|2[0-3]):[0-5]\d$", t["pdf"])

    def test_kazda_tabliczka_ma_kursy(self):
        for t in self.tabliczki:
            self.assertTrue(t["odjazdy"]["R"] or t["odjazdy"]["SN"], "pusta tabliczka: " + t["pdf"])

    def test_trasa_zaczyna_sie_od_przystanku_tabliczki(self):
        for t in self.tabliczki:
            self.assertGreaterEqual(len(t["trasa"]), 2, t["pdf"])
            self.assertEqual(t["trasa"][0]["k"], t["k"], t["pdf"])
            self.assertIn(0, t["trasa"][0]["m"], t["pdf"])

    def test_przystanki_maja_nazwy(self):
        przystanki = self.dane["przystanki"]
        for t in self.tabliczki:
            self.assertIn(t["k"], przystanki)
            for w in t["trasa"]:
                self.assertIn(w["k"], przystanki, t["pdf"])
        self.assertGreater(len(przystanki), 40)

    def test_oznaczenia_sa_objasnione(self):
        braki = set()
        for t in self.tabliczki:
            for typ in ("R", "SN"):
                for _, znaki in t["odjazdy"][typ]:
                    for z in znaki:
                        if z not in t["obj"]:
                            braki.add((t["pdf"].rsplit("/", 1)[-1], z))
        self.assertEqual(braki - ZNANE_BRAKI_OBJASNIEN, set(), "oznaczenia bez objaśnienia")

    def test_linki_do_pdf(self):
        for t in self.tabliczki:
            self.assertRegex(t["pdf"], r"^https://(www\.)?zkmb\.pl/.+\.pdf$")


if __name__ == "__main__":
    unittest.main()
