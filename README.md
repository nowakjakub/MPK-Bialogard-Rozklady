# MPK-Bialogard-Rozklady

[![Testy](https://github.com/nowakjakub/MPK-Bialogard-Rozklady/actions/workflows/testy.yml/badge.svg)](https://github.com/nowakjakub/MPK-Bialogard-Rozklady/actions/workflows/testy.yml)
[![Aktualizacja rozkładu](https://github.com/nowakjakub/MPK-Bialogard-Rozklady/actions/workflows/aktualizacja-rozkladu.yml/badge.svg)](https://github.com/nowakjakub/MPK-Bialogard-Rozklady/actions/workflows/aktualizacja-rozkladu.yml)

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
- **Skąd** – jedno pole: wybierz przystanek, wpisz adres albo użyj **📍 najbliższego przystanku** (GPS).
  Przy adresie lub lokalizacji odjazdy pokazują się z najbliższego przystanku (z odległością i czasem dojścia).
  Wyszukiwanie działa bez polskich znaków (np. „polcz petl”), są też **ulubione ★** i ostatnio wybierane,
- **Dokąd** (opcjonalnie) – takie samo pole pod spodem: przystanek lub adres. Po wybraniu zakładka
  „Odjazdy” zmienia się w **Połączenia**: o której wyjść, którym autobusem i o której będziesz na miejscu
  (dojście + autobus + dojście, dotknij, by zobaczyć kroki), a gdy szybciej – także opcja pieszo.
  **⇅** zamienia skąd i dokąd, **✕** wraca do zwykłej tablicy odjazdów,
- **filtr kierunku** na tablicy odjazdów,
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
- ZKMB nie publikuje położenia przystanków, więc bierzemy je z [OpenStreetMap](https://www.openstreetmap.org/copyright).
  Kilku przystanków (np. Inkubator, Stamma Sklep) nie ma na mapie – ich położenie jest szacowane
  jako środek między sąsiednimi przystankami na trasie. Lokalizacja działa tylko przez https (GitHub Pages).
- Połączenia są pokazywane **bez przesiadek**. Adresy wyszukuje [Photon](https://photon.komoot.io)
  (dane OpenStreetMap) – wpisany adres jest wysyłany do tej wyszukiwarki. Czas dojścia pieszo jest szacowany
  z odległości w linii prostej (+25% na ulice, 4,8 km/h).

## Uruchomienie lokalnie

Otwórz `index.html` w przeglądarce – działa bez serwera.

Strona jest publikowana przez GitHub Pages z gałęzi `master` (folder `/ (root)`),
więc każda zmiana wmergowana do `master` po 1–2 minutach pojawia się pod linkiem powyżej.

## Aktualizacja rozkładu

**Automatycznie:** GitHub Action [„Aktualizacja rozkładu”](.github/workflows/aktualizacja-rozkladu.yml)
codziennie rano pobiera PDF-y z zkmb.pl i porównuje je z `data/rozklad.js`:

- **bez zmian** – zapisuje na `master` tylko datę sprawdzenia (`data/sprawdzono.js`), więc w stopce strony
  widać „Zgodność z zkmb.pl sprawdzono 9.10.2026 o 07:17” z dzisiejszą datą,
- **zmiany** – uruchamia testy i otwiera pull request z nowymi danymi (i datą sprawdzenia) –
  wystarczy go zmergować.

Można ją też uruchomić ręcznie: *Actions → Aktualizacja rozkładu → Run workflow*.

> Żeby Action mogła otwierać pull requesty, włącz w repozytorium:
> *Settings → Actions → General → Workflow permissions →*
> **„Allow GitHub Actions to create and approve pull requests”**.

**Ręcznie:**

```bash
pip install pymupdf
python3 narzedzia/pobierz_gps.py                # położenie przystanków z OpenStreetMap
python3 narzedzia/pobierz_rozklad.py            # pobierz i zapisz, jeśli coś się zmieniło
python3 narzedzia/pobierz_rozklad.py --sprawdz  # tylko sprawdź (kod wyjścia 1 = dane nieaktualne)
```

## Testy

GitHub Action [„Testy”](.github/workflows/testy.yml) uruchamia się przy każdym pull requeście i pushu do `master`:

- **Dane i parser PDF** (`tests/test_*.py`) – poprawność `data/rozklad.js` (godziny, trasy,
  objaśnienia oznaczeń) oraz odczyt prawdziwej tabliczki PDF zapisanej w `tests/pdf/`,
- **Strona w przeglądarce** (`tests/e2e/`, Playwright na ekranie telefonu) – odjazdy zgodne z rozkładem,
  wyszukiwarka, ulubione, skąd/dokąd (przystanek, adres, GPS), połączenia, przyjazdy, pełny rozkład, święta, kursy „jutro”
  i otwarcie każdego przystanku w każdej zakładce bez błędów.

Lokalnie:

```bash
pip install pymupdf && python3 -m unittest discover tests
npm ci && npx playwright install chromium && npx playwright test
```

## Pliki

| Plik | Co to jest |
| --- | --- |
| `index.html` | układ strony |
| `styl.css` | wygląd (kolory, tryb ciemny, układ na telefon) |
| `app.js` | logika: odjazdy, przyjazdy, trasa kursu, wyszukiwarka, rozpoznawanie dni i świąt |
| `sw.js`, `manifest.webmanifest`, `ikony/` | instalacja na telefonie i działanie offline |
| `data/rozklad.js` | rozkład (generowany automatycznie – nie edytuj ręcznie) |
| `data/sprawdzono.js` | data ostatniego sprawdzenia rozkładu na zkmb.pl (aktualizowana codziennie) |
| `data/przystanki_gps.js` | położenie przystanków z OpenStreetMap (generowane przez `narzedzia/pobierz_gps.py`) |
| `narzedzia/pobierz_rozklad.py` | skrypt pobierający i odczytujący PDF-y z zkmb.pl |
| `tests/` | testy danych, parsera PDF i strony |
| `.github/workflows/` | automatyczne testy i codzienne sprawdzanie rozkładu |
