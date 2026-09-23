# MPK-Bialogard-Rozklady

Prosta strona do sprawdzania najbliższych **odjazdów** i **przyjazdów** autobusów
ZKM Białogard na wybranym przystanku (na podstawie https://www.zkmb.pl/rozklad-jazdy/).

## Jak uruchomić

Otwórz `index.html` w przeglądarce (działa też bez serwera) albo włącz GitHub Pages
dla tego repozytorium.

## Co umie

- wybór przystanku (zapamiętywany w przeglądarce),
- zakładka **Odjazdy**: linia, kierunek, godzina i „za ile minut”,
- opcjonalnie „Dokąd jadę” – pokazuje, o której będziesz na miejscu,
- zakładka **Przyjazdy**: skąd jedzie autobus i czy kończy trasę na tym przystanku,
- automatyczne rozpoznanie dnia: roboczy / sobota / niedziela i święta (także ruchome, np. Wielkanoc),
- sprawdzenie rozkładu na inną datę i godzinę.

## Dane rozkładu

Rozkład jest w pliku `data/rozklad.js` (opis formatu na górze pliku).
**Obecnie są tam przykładowe dane** – trzeba je zastąpić prawdziwymi godzinami ze strony ZKMB
i ustawić `przyklad: false`.
