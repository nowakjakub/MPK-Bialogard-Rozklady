# MPK-Bialogard-Rozklady

Prosta strona do sprawdzania najbliższych **odjazdów** i **przyjazdów** autobusów
ZKM Białogard na wybranym przystanku. Dane pochodzą z tabliczek PDF na
https://www.zkmb.pl/rozklad-jazdy/.

## Jak uruchomić

Otwórz `index.html` w przeglądarce (działa bez serwera) albo włącz GitHub Pages
(Settings → Pages → Branch: `master`, folder `/ (root)`).

## Co umie

- wybór przystanku (zapamiętywany w przeglądarce),
- **Odjazdy**: linia, kierunek, godzina, „za ile minut”, objaśnienia oznaczeń z rozkładu i link do tabliczki PDF,
- **Dokąd jadę**: pokazuje tylko kursy, które tam dojeżdżają, i przybliżoną godzinę dojazdu,
- **Przyjazdy**: szacowana godzina przyjazdu (odjazd z wcześniejszego przystanku + czas jazdy) –
  działa też na pętlach, które nie mają własnych tabliczek,
- rozpoznaje dzień powszedni / sobotę, niedzielę i święta (także ruchome, np. Wielkanoc),
- sprawdzenie rozkładu na inną datę i godzinę.

## Aktualizacja rozkładu

Gdy ZKMB zmieni rozkład (np. wakacje), uruchom:

```bash
pip install pymupdf
python3 narzedzia/pobierz_rozklad.py
```

Skrypt pobierze wszystkie PDF-y, odczyta z nich godziny i nadpisze `data/rozklad.js`.
