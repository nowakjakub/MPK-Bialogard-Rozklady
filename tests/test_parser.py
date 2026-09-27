"""Testy odczytu tabliczek PDF (narzedzia/pobierz_rozklad.py). Wymaga: pip install pymupdf"""
import os
import sys
import unittest

KATALOG = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(KATALOG, "..", "narzedzia"))

import pobierz_rozklad as p  # noqa: E402


class TestKlucz(unittest.TestCase):
    def test_ta_sama_nazwa_rozna_pisownia(self):
        self.assertEqual(p.klucz("Połczyńska - pętla"), p.klucz("Połczyńska Pętla"))
        self.assertEqual(p.klucz("Osiedle Berki"), p.klucz("os. Berki"))
        self.assertEqual(p.klucz("Zaklad BG P"), p.klucz("Zakład BG P"))
        self.assertEqual(p.klucz("Połczyńska Rondo (NŻ)"), p.klucz("Połczyńska Rondo"))

    def test_aliasy_literowek(self):
        self.assertEqual(p.klucz("Gruwaldzka MDK"), p.klucz("Grunwaldzka MDK"))
        self.assertEqual(p.klucz("Wojska Poslkiego poczta"), p.klucz("Wojska Polskiego Poczta"))
        self.assertEqual(p.klucz("Rondo"), p.klucz("Stamma - Rondo"))

    def test_rozne_przystanki_sie_nie_skleja(self):
        self.assertNotEqual(p.klucz("Połczyńska 22 I"), p.klucz("Połczyńska 22 II"))
        self.assertNotEqual(p.klucz("Os. Zwycięstwa I"), p.klucz("Zwycięstwa - Rondo"))


class TestDaty(unittest.TestCase):
    def test_data_iso(self):
        self.assertEqual(p.data_iso("01.09.2026"), "2026-09-01")
        dni = sorted(["01.09.2026", "01.11.2025"], key=p.data_iso)
        self.assertEqual(dni[-1], "01.09.2026")


class TestPorownanie(unittest.TestCase):
    def test_data_pobrania_nie_jest_zmiana(self):
        a = {"pobrano": "2026-09-01", "waznyOd": ["01.09.2026", "01.11.2025"], "tabliczki": []}
        b = {"pobrano": "2026-09-27", "waznyOd": ["01.11.2025", "01.09.2026"], "tabliczki": []}
        self.assertEqual(p.bez_daty(a), p.bez_daty(b))

    def test_raport_zmian(self):
        t = {"pdf": "https://zkmb.pl/x/1.pdf", "odjazdy": {"R": [["07:00", ""]], "SN": []}}
        t2 = dict(t, odjazdy={"R": [["07:05", ""]], "SN": []})
        raport = p.opisz_roznice({"tabliczki": [t], "waznyOd": []}, {"tabliczki": [t2], "waznyOd": []})
        self.assertEqual(raport, ["zmieniona tabliczka: 1.pdf (odjazdy)"])


class TestCzytajPdf(unittest.TestCase):
    """Prawdziwa tabliczka: linia 2, przystanek Dworcowa, kierunek Stamma / Zwinisław (od 01.09.2026)."""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join(KATALOG, "pdf", "2-Dworcowa-Stamma-Zwinislaw.pdf"), "rb") as f:
            cls.t = p.czytaj_pdf(f.read(), "test.pdf")

    def test_naglowek(self):
        self.assertEqual(self.t["przystanek"], "Dworcowa")
        self.assertEqual(self.t["kierunek"], "Stamma / Zwinisław")
        self.assertEqual(self.t["waznyOd"], "01.09.2026")

    def test_odjazdy_dzien_powszedni(self):
        r = self.t["odjazdy"]["R"]
        self.assertEqual(len(r), 25)
        self.assertEqual(r[0], ["05:16", "#+"])       # żółte pole + znak "+"
        self.assertEqual(r[1], ["05:46", ""])
        self.assertIn(["07:31", "kw"], r)
        self.assertIn(["12:03", "k"], r)
        self.assertEqual(r[-1], ["21:31", "#+"])

    def test_odjazdy_weekend(self):
        sn = self.t["odjazdy"]["SN"]
        self.assertEqual(sn[0], ["05:17", "#+"])
        self.assertEqual(sn[-1], ["21:31", "#+"])
        self.assertEqual(len(sn), 11)

    def test_trasa(self):
        trasa = self.t["trasa"]
        self.assertEqual(trasa[0]["n"], "Dworcowa")
        self.assertEqual(trasa[0]["m"], [0])
        kisielice = next(w for w in trasa if w["n"] == "Kisielice")
        self.assertEqual(kisielice["m"], ["k"])   # tylko kursy "k"
        self.assertEqual(trasa[-1]["n"], "Zakład BG P")
        self.assertEqual(trasa[-1]["m"], [13])

    def test_objasnienia(self):
        obj = self.t["obj"]
        self.assertIn("Kisielice", obj["k"])
        self.assertIn("brak dojazdu do Stamma Sklep", obj["#"])
        self.assertIn("wydłużony", obj["+"])


if __name__ == "__main__":
    unittest.main()
