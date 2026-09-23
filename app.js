(function () {
  "use strict";

  var DANE = window.ROZKLAD;
  var ILE_POZYCJI = 12;
  var NAZWY_DNI = { R: "dzień roboczy", S: "sobota", N: "niedziela / święto" };

  var el = {
    przystanek: document.getElementById("przystanek"),
    cel: document.getElementById("cel"),
    czas: document.getElementById("czas"),
    teraz: document.getElementById("teraz"),
    info: document.getElementById("info"),
    lista: document.getElementById("lista"),
    zakladki: document.querySelectorAll("[data-tryb]"),
    ostrzezenie: document.getElementById("ostrzezenie"),
    naglowekCel: document.getElementById("naglowek-cel")
  };

  var tryb = "odjazdy";

  // ---------- pomocnicze: czas ----------

  function naMinuty(hhmm) {
    var p = hhmm.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function naTekst(min) {
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function wielkanoc(rok) {
    // algorytm Meeusa/Jonesa/Butchera
    var a = rok % 19, b = Math.floor(rok / 100), c = rok % 100,
      d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451),
      miesiac = Math.floor((h + l - 7 * m + 114) / 31),
      dzien = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(rok, miesiac - 1, dzien);
  }

  function klucz(d) {
    return d.getMonth() + 1 + "-" + d.getDate();
  }

  function swieta(rok) {
    var stale = ["1-1", "1-6", "5-1", "5-3", "8-15", "11-1", "11-11", "12-25", "12-26"];
    if (rok >= 2025) stale.push("12-24"); // Wigilia wolna od 2025 r.
    var w = wielkanoc(rok);
    function przesun(dni) { return new Date(w.getFullYear(), w.getMonth(), w.getDate() + dni); }
    return stale.concat([klucz(w), klucz(przesun(1)), klucz(przesun(49)), klucz(przesun(60))]);
  }

  function typDnia(data) {
    if (data.getDay() === 0 || swieta(data.getFullYear()).indexOf(klucz(data)) !== -1) return "N";
    if (data.getDay() === 6) return "S";
    return "R";
  }

  // ---------- dane ----------

  // Zamienia rozkład na płaską listę kursów: każdy kurs ma listę { przystanek, min }.
  function zbudujKursy() {
    var kursy = [];
    DANE.linie.forEach(function (linia) {
      linia.trasy.forEach(function (trasa) {
        trasa.kursy.forEach(function (kurs) {
          var start = kurs.start ? naMinuty(kurs.start) : null;
          var przejazd = trasa.przystanki.map(function (nazwa, i) {
            var t = kurs.czasy ? kurs.czasy[i] : null;
            var min = t ? naMinuty(t) : (start !== null && trasa.minuty ? start + trasa.minuty[i] : null);
            // godziny po północy w jednym kursie (np. 23:58 -> 00:03)
            if (t && i > 0 && min !== null && start === null && min < naMinuty(kurs.czasy[0])) min += 1440;
            return { przystanek: nazwa, min: min };
          });
          kursy.push({ linia: linia.numer, kierunek: trasa.kierunek, dni: kurs.dni, przejazd: przejazd });
        });
      });
    });
    return kursy;
  }

  var KURSY = zbudujKursy();

  var PRZYSTANKI = (function () {
    var zbior = {};
    KURSY.forEach(function (k) { k.przejazd.forEach(function (p) { zbior[p.przystanek] = true; }); });
    return Object.keys(zbior).sort(function (a, b) { return a.localeCompare(b, "pl"); });
  })();

  // ---------- zapamiętywanie wyboru ----------

  function zapisz(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* brak dostępu */ } }
  function wczytaj(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // ---------- szukanie ----------

  // Zwraca najbliższe zdarzenia (odjazdy albo przyjazdy) na przystanku od chwili "od".
  function szukaj(przystanek, cel, od) {
    var wyniki = [];
    var poczatekDnia = new Date(od.getFullYear(), od.getMonth(), od.getDate());
    var teraz = od.getHours() * 60 + od.getMinutes();

    // dziś + jutro, żeby wieczorem pokazać też pierwsze poranne kursy
    [0, 1].forEach(function (przesuniecie) {
      var dzien = new Date(poczatekDnia.getFullYear(), poczatekDnia.getMonth(), poczatekDnia.getDate() + przesuniecie);
      var typ = typDnia(dzien);

      KURSY.forEach(function (k) {
        if (k.dni.indexOf(typ) === -1) return;
        var idx = -1;
        for (var i = 0; i < k.przejazd.length; i++) {
          if (k.przejazd[i].przystanek === przystanek && k.przejazd[i].min !== null) { idx = i; break; }
        }
        if (idx === -1) return;
        var ostatni = idx === k.przejazd.length - 1;
        var pierwszy = idx === 0;
        if (tryb === "odjazdy" && ostatni) return; // tu kurs się kończy – nic nie odjeżdża
        if (tryb === "przyjazdy" && pierwszy) return; // tu kurs dopiero startuje

        var przyjazdDoCelu = null;
        if (cel) {
          for (var j = idx + 1; j < k.przejazd.length; j++) {
            if (k.przejazd[j].przystanek === cel && k.przejazd[j].min !== null) { przyjazdDoCelu = k.przejazd[j].min; break; }
          }
          if (przyjazdDoCelu === null) return;
        }

        var min = k.przejazd[idx].min + przesuniecie * 1440;
        if (min < teraz) return;
        wyniki.push({
          linia: k.linia,
          kierunek: k.kierunek,
          skad: k.przejazd[0].przystanek,
          koniec: ostatni,
          min: min,
          za: min - teraz,
          cel: przyjazdDoCelu,
          jutro: min >= 1440
        });
      });
    });

    wyniki.sort(function (a, b) { return a.min - b.min || a.linia.localeCompare(b.linia, "pl", { numeric: true }); });
    return wyniki.slice(0, ILE_POZYCJI);
  }

  // ---------- widok ----------

  function opisZa(za) {
    if (za <= 0) return "teraz";
    if (za < 60) return "za " + za + " min";
    var h = Math.floor(za / 60), m = za % 60;
    return "za " + h + " h" + (m ? " " + m + " min" : "");
  }

  function wybranyCzas() {
    if (el.czas.value) {
      var d = new Date(el.czas.value);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  function odswiezCele() {
    var przystanek = el.przystanek.value;
    var poprzedni = el.cel.value;
    var osiagalne = {};
    KURSY.forEach(function (k) {
      var idx = k.przejazd.findIndex(function (p) { return p.przystanek === przystanek; });
      if (idx === -1) return;
      k.przejazd.slice(idx + 1).forEach(function (p) { osiagalne[p.przystanek] = true; });
    });
    delete osiagalne[przystanek];
    el.cel.innerHTML = '<option value="">— dowolny —</option>';
    Object.keys(osiagalne).sort(function (a, b) { return a.localeCompare(b, "pl"); }).forEach(function (n) {
      var o = document.createElement("option");
      o.value = n; o.textContent = n;
      el.cel.appendChild(o);
    });
    el.cel.value = osiagalne[poprzedni] ? poprzedni : "";
  }

  function rysuj() {
    var przystanek = el.przystanek.value;
    var cel = tryb === "odjazdy" ? el.cel.value : "";
    var od = wybranyCzas();
    var typ = typDnia(od);

    el.teraz.textContent = naTekst(od.getHours() * 60 + od.getMinutes()) + " · " + NAZWY_DNI[typ];
    el.naglowekCel.hidden = tryb !== "odjazdy";

    var wyniki = szukaj(przystanek, cel, od);
    el.lista.innerHTML = "";

    if (!wyniki.length) {
      el.info.textContent = "Brak kursów w najbliższym czasie.";
      return;
    }
    el.info.textContent = tryb === "odjazdy"
      ? "Najbliższe odjazdy z przystanku " + przystanek + (cel ? " do " + cel : "")
      : "Najbliższe przyjazdy na przystanek " + przystanek;

    wyniki.forEach(function (w) {
      var li = document.createElement("li");
      li.className = "kurs" + (w.za <= 5 ? " zaraz" : "");

      var linia = document.createElement("span");
      linia.className = "linia";
      linia.textContent = w.linia;

      var opis = document.createElement("div");
      opis.className = "opis";
      var gl = document.createElement("div");
      gl.className = "kierunek";
      var dod = document.createElement("div");
      dod.className = "dodatkowe";

      if (tryb === "odjazdy") {
        gl.textContent = "→ " + w.kierunek;
        if (w.cel !== null) dod.textContent = "Na miejscu (" + cel + ") o " + naTekst(w.cel) + " · jazda " + (w.cel - (w.min % 1440)) + " min";
      } else {
        gl.textContent = "z: " + w.skad;
        dod.textContent = w.koniec ? "Kończy tu trasę" : "Jedzie dalej → " + w.kierunek;
      }
      if (w.jutro) dod.textContent = "jutro" + (dod.textContent ? " · " + dod.textContent : "");
      opis.appendChild(gl);
      if (dod.textContent) opis.appendChild(dod);

      var czas = document.createElement("div");
      czas.className = "czas";
      var godz = document.createElement("div");
      godz.className = "godzina";
      godz.textContent = naTekst(w.min);
      var za = document.createElement("div");
      za.className = "za";
      za.textContent = opisZa(w.za);
      czas.appendChild(godz);
      czas.appendChild(za);

      li.appendChild(linia);
      li.appendChild(opis);
      li.appendChild(czas);
      el.lista.appendChild(li);
    });
  }

  // ---------- start ----------

  if (DANE.przyklad) el.ostrzezenie.hidden = false;

  PRZYSTANKI.forEach(function (n) {
    var o = document.createElement("option");
    o.value = n; o.textContent = n;
    el.przystanek.appendChild(o);
  });
  var zapamietany = wczytaj("przystanek");
  if (zapamietany && PRZYSTANKI.indexOf(zapamietany) !== -1) el.przystanek.value = zapamietany;
  odswiezCele();
  var zapamietanyCel = wczytaj("cel");
  if (zapamietanyCel) {
    el.cel.value = zapamietanyCel;
    if (el.cel.value !== zapamietanyCel) el.cel.value = "";
  }

  el.przystanek.addEventListener("change", function () {
    zapisz("przystanek", el.przystanek.value);
    odswiezCele();
    zapisz("cel", el.cel.value);
    rysuj();
  });
  el.cel.addEventListener("change", function () { zapisz("cel", el.cel.value); rysuj(); });
  el.czas.addEventListener("change", rysuj);
  document.getElementById("reset-czasu").addEventListener("click", function () { el.czas.value = ""; rysuj(); });

  Array.prototype.forEach.call(el.zakladki, function (b) {
    b.addEventListener("click", function () {
      tryb = b.getAttribute("data-tryb");
      Array.prototype.forEach.call(el.zakladki, function (x) { x.setAttribute("aria-selected", String(x === b)); });
      rysuj();
    });
  });

  rysuj();
  setInterval(function () { if (!el.czas.value) rysuj(); }, 20000);
})();
