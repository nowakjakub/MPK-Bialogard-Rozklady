# MPK-Bialogard-Rozklady

Prosta strona do sprawdzania najbliższych **odjazdów** i **przyjazdów** autobusów
ZKM Białogard na wybranym przystanku.

**👉 Strona: https://nowakjakub.github.io/MPK-Bialogard-Rozklady/**

Dane pochodzą z tabliczek PDF na https://www.zkmb.pl/rozklad-jazdy/
(linie 1–4, rozkład szkolny ważny od 01.09.2026).

## Na telefonie

Otwórz link powyżej i wybierz w przeglądarce **„Dodaj do ekranu głównego”** –
strona zainstaluje się jak aplikacja (z ikonką) i będzie działać także bez internetu.

## Co umie

- **Odjazdy** jak na tablicy elektronicznej: numer linii, kierunek i duże odliczanie („6 min”),
  kolejne kursy z godziną; kursy z dwóch linii o tej samej godzinie są połączone w jeden wiersz,
- **dotknięcie kursu** pokazuje znaczenie oznaczeń, cały przebieg trasy z godzinami
  na kolejnych przystankach i link do tabliczki PDF,
- **wyszukiwarka przystanków** (działa bez polskich znaków, np. „polcz petl”), z listą
  **ulubionych ★** i ostatnio wybieranych,
- **filtr kierunku** oraz **„Dokąd jadę?”** – tylko kursy, które tam dojeżdżają, z godziną dojazdu,
- **Przyjazdy** – szacowane godziny przyjazdu (działa też na pętlach),
- **Rozkład** – pełna tabliczka godzinowa z zaznaczoną bieżącą godziną i przekreślonymi kursami, które już odjechały,
- oznaczenie **ostatniego kursu** dnia i kursów **jutro**,
- rozpoznaje dni powszednie, soboty, niedziele i święta (także ruchome, np. Wielkanoc),
- link do konkretnego przystanku, np. `?p=dworcowa` – można go zapisać w zakładkach,
- tryb ciemny, duże przyciski wygodne na telefonie.

## Znane ograniczenia

- Przyjazdy i godziny dojazdu są **szacowane** z kolumny „czas jazdy” w PDF-ach.
  Niektóre tabliczki ZKMB mają w niej błędy, więc wynik może się różnić o kilka minut.
- Ten sam kurs bywa wpisany w rozkładach dwóch linii (np. 1 i 2). W Odjazdach takie kursy są łączone,
  ale w Przyjazdach (liczonych szacunkowo) rzadko ten sam autobus może pojawić się dwa razy.
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
| `index.html` | układ strony |
| `styl.css` | wygląd (kolory, tryb ciemny, układ na telefon) |
| `app.js` | logika: odjazdy, przyjazdy, trasa kursu, wyszukiwarka, rozpoznawanie dni i świąt |
| `sw.js`, `manifest.webmanifest`, `ikony/` | instalacja na telefonie i działanie offline |
| `data/rozklad.js` | rozkład (generowany automatycznie – nie edytuj ręcznie) |
| `narzedzia/pobierz_rozklad.py` | skrypt pobierający i odczytujący PDF-y z zkmb.pl |
