# MPK-Bialogard-Rozklady

Prosta strona do sprawdzania najbliższych **odjazdów** i **przyjazdów** autobusów
ZKM Białogard na wybranym przystanku.

**👉 Strona: https://nowakjakub.github.io/MPK-Bialogard-Rozklady/**

Dane pochodzą z tabliczek PDF na https://www.zkmb.pl/rozklad-jazdy/
(linie 1–4, rozkład szkolny ważny od 01.09.2026).

## Na telefonie

Otwórz link powyżej i wybierz w przeglądarce **„Dodaj do ekranu głównego”** –
będziesz mieć ikonkę jak zwykłą aplikację, a strona zapamięta Twój przystanek.

## Co umie

- wybór przystanku (zapamiętywany w przeglądarce),
- **Odjazdy**: linia, kierunek, godzina, „za ile minut”, objaśnienia oznaczeń z rozkładu i link do tabliczki PDF,
- **Dokąd jadę**: pokazuje tylko kursy, które tam dojeżdżają (z uwzględnieniem wariantów tras
  i kursów skróconych), oraz przybliżoną godzinę dojazdu,
- **Przyjazdy**: szacowana godzina przyjazdu (odjazd z wcześniejszego przystanku + czas jazdy) –
  działa też na pętlach, które nie mają własnych tabliczek,
- rozpoznaje dzień powszedni oraz soboty, niedziele i święta (także ruchome, np. Wielkanoc),
- sprawdzenie rozkładu na inną datę i godzinę,
- tryb ciemny i widok dopasowany do telefonu.

## Znane ograniczenia

- Przyjazdy i godziny dojazdu są **szacowane** z kolumny „czas jazdy” w PDF-ach.
  Niektóre tabliczki ZKMB mają w niej błędy, więc wynik może się różnić o kilka minut.
- Ten sam kurs bywa wpisany w rozkładach dwóch linii (np. 1 i 2), więc może pojawić się dwa razy.
- Tolerancja punktualności wg ZKMB: +1 / −3 min. W razie wątpliwości sprawdź tabliczkę PDF.

## Uruchomienie lokalnie

Otwórz `index.html` w przeglądarce – działa bez serwera.

Strona jest publikowana przez GitHub Pages z gałęzi `master` (folder `/ (root)`),
więc każda zmiana wmergowana do `master` po 1–2 minutach pojawia się pod linkiem powyżej.

## Aktualizacja rozkładu

Gdy ZKMB zmieni rozkład (np. ferie, wakacje), uruchom:

```bash
pip install pymupdf
python3 narzedzia/pobierz_rozklad.py
```

Skrypt pobierze wszystkie PDF-y, odczyta z nich godziny i nadpisze `data/rozklad.js`.
Potem wystarczy zrobić commit i merge do `master`.

## Pliki

| Plik | Co to jest |
| --- | --- |
| `index.html` | wygląd strony |
| `app.js` | logika: szukanie odjazdów, przyjazdów, rozpoznawanie dni i świąt |
| `data/rozklad.js` | rozkład (generowany automatycznie – nie edytuj ręcznie) |
| `narzedzia/pobierz_rozklad.py` | skrypt pobierający i odczytujący PDF-y z zkmb.pl |
