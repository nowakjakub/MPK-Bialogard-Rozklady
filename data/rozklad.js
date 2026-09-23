// Rozkład jazdy ZKM Białogard.
//
// UWAGA: to są PRZYKŁADOWE dane (pole "przyklad": true). Zastąp je prawdziwymi
// godzinami z https://www.zkmb.pl/rozklad-jazdy/ i ustaw "przyklad": false.
//
// Format:
//   dni: "R" = dni robocze, "S" = soboty, "N" = niedziele i święta
//   linie[].trasy[]      – jeden kierunek jazdy linii
//     przystanki         – nazwy przystanków w kolejności jazdy
//     minuty             – ile minut od startu kursu autobus jest na danym przystanku
//     kursy              – { dni: "RS", start: "05:10" }  (godzina odjazdu z 1. przystanku)
//                          albo { dni: "R", czasy: ["05:10", "05:14", ...] } gdy czasy
//                          przejazdu w tym kursie są inne niż w "minuty".
window.ROZKLAD = {
  przyklad: true,
  zrodlo: "https://www.zkmb.pl/rozklad-jazdy/",
  aktualizacja: "2026-09-23",
  linie: [
    {
      numer: "1",
      trasy: [
        {
          kierunek: "Zwinisław",
          przystanki: ["Połczyńska Pętla", "Połczyńska", "Plac Wolności", "Dworzec PKP", "Szpital", "Zwinisław"],
          minuty: [0, 3, 7, 10, 14, 20],
          kursy: [
            { dni: "R", start: "05:15" }, { dni: "R", start: "06:15" }, { dni: "RS", start: "07:15" },
            { dni: "R", start: "09:15" }, { dni: "RSN", start: "11:15" }, { dni: "R", start: "13:15" },
            { dni: "RS", start: "15:15" }, { dni: "R", start: "17:15" }, { dni: "RSN", start: "19:15" }
          ]
        },
        {
          kierunek: "Połczyńska Pętla",
          przystanki: ["Zwinisław", "Szpital", "Dworzec PKP", "Plac Wolności", "Połczyńska", "Połczyńska Pętla"],
          minuty: [0, 6, 10, 13, 17, 20],
          kursy: [
            { dni: "R", start: "05:40" }, { dni: "R", start: "06:40" }, { dni: "RS", start: "07:40" },
            { dni: "R", start: "09:40" }, { dni: "RSN", start: "11:40" }, { dni: "R", start: "13:40" },
            { dni: "RS", start: "15:40" }, { dni: "R", start: "17:40" }, { dni: "RSN", start: "19:40" }
          ]
        }
      ]
    },
    {
      numer: "2",
      trasy: [
        {
          kierunek: "Osiedle Zachód",
          przystanki: ["Dworzec PKP", "Plac Wolności", "Kołobrzeska", "Osiedle Zachód"],
          minuty: [0, 4, 8, 12],
          kursy: [
            { dni: "R", start: "05:50" }, { dni: "R", start: "06:50" }, { dni: "RS", start: "08:50" },
            { dni: "R", start: "10:50" }, { dni: "RSN", start: "12:50" }, { dni: "R", start: "14:50" },
            { dni: "RS", start: "16:50" }, { dni: "R", start: "18:50" }
          ]
        },
        {
          kierunek: "Dworzec PKP",
          przystanki: ["Osiedle Zachód", "Kołobrzeska", "Plac Wolności", "Dworzec PKP"],
          minuty: [0, 4, 8, 12],
          kursy: [
            { dni: "R", start: "06:10" }, { dni: "R", start: "07:10" }, { dni: "RS", start: "09:10" },
            { dni: "R", start: "11:10" }, { dni: "RSN", start: "13:10" }, { dni: "R", start: "15:10" },
            { dni: "RS", start: "17:10" }, { dni: "R", start: "19:10" }
          ]
        }
      ]
    }
  ]
};
