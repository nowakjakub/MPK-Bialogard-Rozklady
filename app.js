(function () {
  "use strict";

  var DANE = window.ROZKLAD;
  var ILE_POZYCJI = 15;
  var NAZWY_DNI = { R: "dzień powszedni", SN: "sobota / niedziela / święto" };
  var ZNAK_ZOLTY = "#";

  var el = {
    przystanek: document.getElementById("przystanek"),
    cel: document.getElementById("cel"),
    czas: document.getElementById("czas"),
    teraz: document.getElementById("teraz"),
    info: document.getElementById("info"),
    lista: document.getElementById("lista"),
    zakladki: document.querySelectorAll("[data-tryb]"),
    naglowekCel: document.getElementById("naglowek-cel"),
    wersja: document.getElementById("wersja")
  };

  var tryb = "odjazdy";

  // ---------- czas i kalendarz ----------

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

  function kluczDaty(d) {
    return d.getMonth() + 1 + "-" + d.getDate();
  }

  function swieta(rok) {
    var stale = ["1-1", "1-6", "5-1", "5-3", "8-15", "11-1", "11-11", "12-25", "12-26"];
    if (rok >= 2025) stale.push("12-24"); // Wigilia wolna od 2025 r.
    var w = wielkanoc(rok);
    function przesun(dni) { return new Date(w.getFullYear(), w.getMonth(), w.getDate() + dni); }
    return stale.concat([kluczDaty(w), kluczDaty(przesun(1)), kluczDaty(przesun(49)), kluczDaty(przesun(60))]);
  }

  // Rozkład ZKMB ma dwie kolumny: dzień powszedni (R) oraz sobota/niedziela (SN).
  function typDnia(data) {
    var dzien = data.getDay();
    if (dzien === 0 || dzien === 6 || swieta(data.getFullYear()).indexOf(kluczDaty(data)) !== -1) return "SN";
    return "R";
  }

  // ---------- dane ----------

  function porownajNazwy(a, b) {
    return DANE.przystanki[a].localeCompare(DANE.przystanki[b], "pl");
  }

  // pierwszy liczbowy czas jazdy w wierszu trasy (PDF-y mają czasem 2 warianty trasy)
  function czasJazdy(wiersz) {
    for (var i = 0; i < wiersz.m.length; i++) if (typeof wiersz.m[i] === "number") return wiersz.m[i];
    return null;
  }

  // literki z kolumny czasu jazdy, np. "k" = tylko kursy oznaczone "k" jadą przez ten przystanek
  function wymaganyZnak(wiersz) {
    for (var i = 0; i < wiersz.m.length; i++) {
      if (typeof wiersz.m[i] === "string" && /^[a-z]$/i.test(wiersz.m[i])) return wiersz.m[i];
    }
    return null;
  }

  function znaki(oznaczenie) {
    var wynik = [];
    for (var i = 0; i < oznaczenie.length; i++) wynik.push(oznaczenie.charAt(i));
    return wynik;
  }

  function koniecTrasy(t) {
    return t.trasa[t.trasa.length - 1].k;
  }

  function indeksNaTrasie(t, klucz) {
    for (var i = 1; i < t.trasa.length; i++) if (t.trasa[i].k === klucz) return i;
    return -1;
  }

  // ---------- zapamiętywanie wyboru ----------

  function zapisz(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* brak dostępu */ } }
  function wczytaj(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // ---------- szukanie ----------

  // Dla dziś i jutra wywołuje fn(tabliczka, godzina, oznaczenie, przesunięcieDni).
  function dlaKazdegoOdjazdu(tabliczki, od, fn) {
    [0, 1].forEach(function (przesuniecie) {
      var dzien = new Date(od.getFullYear(), od.getMonth(), od.getDate() + przesuniecie);
      var typ = typDnia(dzien);
      tabliczki.forEach(function (t) {
        t.odjazdy[typ].forEach(function (o) { fn(t, o[0], o[1], przesuniecie); });
      });
    });
  }

  function odjazdy(klucz, cel, od) {
    var teraz = od.getHours() * 60 + od.getMinutes();
    var tabliczki = DANE.tabliczki.filter(function (t) { return t.k === klucz; });
    var wyniki = [];
    dlaKazdegoOdjazdu(tabliczki, od, function (t, godzina, oznaczenie, przesuniecie) {
      var min = naMinuty(godzina) + przesuniecie * 1440;
      if (min < teraz) return;
      var wynik = { t: t, min: min, za: min - teraz, oznaczenie: oznaczenie, jutro: przesuniecie > 0 };
      if (cel) {
        var j = indeksNaTrasie(t, cel);
        if (j === -1) return;
        var znak = wymaganyZnak(t.trasa[j]);
        if (znak && oznaczenie.indexOf(znak) === -1) return;
        if (!dojezdza(t, oznaczenie, j)) return;
        var jazda = czasJazdy(t.trasa[j]);
        wynik.przyjazd = jazda === null ? null : min + jazda;
      }
      wyniki.push(wynik);
    });
    return posortuj(wyniki);
  }

  // Kurs oznaczony np. "x – tylko do Połczyńska Cmentarz" nie dojeżdża dalej niż ten przystanek.
  function dojezdza(t, oznaczenie, j) {
    return znaki(oznaczenie).every(function (z) {
      var opis = (t.obj[z] || "").toLowerCase();
      var m = opis.match(/tylko do (.+)/);
      if (!m) return true;
      for (var i = 1; i < j; i++) {
        if (m[1].indexOf(t.trasa[i].n.toLowerCase()) !== -1) return false;
      }
      return true;
    });
  }

  // Przyjazd = odjazd z wcześniejszego przystanku + czas jazdy. Liczymy ze wszystkich tabliczek
  // i usuwamy powtórki, więc działa też na pętlach, które nie mają własnych tabliczek.
  function przyjazdy(klucz, od) {
    var teraz = od.getHours() * 60 + od.getMinutes();
    var zrodla = [];
    DANE.tabliczki.forEach(function (t) {
      var j = indeksNaTrasie(t, klucz);
      if (j === -1) return;
      var jazda = czasJazdy(t.trasa[j]);
      if (jazda !== null) zrodla.push({ t: t, j: j, jazda: jazda, znak: wymaganyZnak(t.trasa[j]) });
    });
    zrodla.sort(function (a, b) { return a.jazda - b.jazda; }); // najbliższa tabliczka jest najdokładniejsza

    var wyniki = [];
    zrodla.forEach(function (z) {
      dlaKazdegoOdjazdu([z.t], od, function (t, godzina, oznaczenie, przesuniecie) {
        if (z.znak && oznaczenie.indexOf(z.znak) === -1) return;
        if (!dojezdza(t, oznaczenie, z.j)) return;
        var min = naMinuty(godzina) + z.jazda + przesuniecie * 1440;
        if (min < teraz) return;
        var powtorka = wyniki.some(function (w) {
          return w.t.linia === t.linia && koniecTrasy(w.t) === koniecTrasy(t) && Math.abs(w.min - min) <= 3;
        });
        if (powtorka) return;
        wyniki.push({ t: t, min: min, za: min - teraz, oznaczenie: oznaczenie, jutro: min >= 1440,
          skad: t.przystanek, odjazd: min - z.jazda });
      });
    });
    return posortuj(wyniki);
  }

  function posortuj(wyniki) {
    wyniki.sort(function (a, b) {
      return a.min - b.min || a.t.linia.localeCompare(b.t.linia, "pl", { numeric: true });
    });
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

  function dodaj(rodzic, tag, klasa, tekst) {
    var e = document.createElement(tag);
    if (klasa) e.className = klasa;
    if (tekst !== undefined) e.textContent = tekst;
    rodzic.appendChild(e);
    return e;
  }

  function wypelnijSelect(select, klucze, pusta) {
    select.innerHTML = "";
    if (pusta) dodaj(select, "option", "", pusta).value = "";
    klucze.forEach(function (k) {
      var o = dodaj(select, "option", "", DANE.przystanki[k]);
      o.value = k;
    });
  }

  function odswiezCele() {
    var klucz = el.przystanek.value;
    var poprzedni = el.cel.value;
    var osiagalne = {};
    DANE.tabliczki.forEach(function (t) {
      if (t.k !== klucz) return;
      t.trasa.slice(1).forEach(function (w) { if (w.k !== klucz) osiagalne[w.k] = true; });
    });
    wypelnijSelect(el.cel, Object.keys(osiagalne).sort(porownajNazwy), "— dowolny —");
    el.cel.value = osiagalne[poprzedni] ? poprzedni : "";
  }

  function rysujZnaki(rodzic, w) {
    var lista = znaki(w.oznaczenie);
    if (!lista.length) return;
    var box = dodaj(rodzic, "div", "znaki");
    lista.forEach(function (z) {
      var opis = w.t.obj[z] || "oznaczenie w rozkładzie";
      var wiersz = dodaj(box, "div", "znak");
      dodaj(wiersz, "span", z === ZNAK_ZOLTY ? "symbol zolty" : "symbol", z === ZNAK_ZOLTY ? "" : z);
      dodaj(wiersz, "span", "", opis);
    });
  }

  function rysuj() {
    var klucz = el.przystanek.value;
    var cel = tryb === "odjazdy" ? el.cel.value : "";
    var od = wybranyCzas();

    el.teraz.textContent = naTekst(od.getHours() * 60 + od.getMinutes()) + " · " + NAZWY_DNI[typDnia(od)];
    el.naglowekCel.hidden = tryb !== "odjazdy";

    var wyniki = tryb === "odjazdy" ? odjazdy(klucz, cel, od) : przyjazdy(klucz, od);
    el.lista.innerHTML = "";

    var nazwa = DANE.przystanki[klucz];
    if (!wyniki.length) {
      var maTabliczki = DANE.tabliczki.some(function (t) { return t.k === klucz; });
      el.info.textContent = tryb === "odjazdy" && !maTabliczki
        ? "Z przystanku " + nazwa + " nie ma odjazdów w rozkładzie (to pewnie pętla) – zobacz zakładkę Przyjazdy."
        : "Brak kursów w najbliższym czasie.";
      return;
    }
    el.info.textContent = tryb === "odjazdy"
      ? "Najbliższe odjazdy z przystanku " + nazwa + (cel ? " do " + DANE.przystanki[cel] : "")
      : "Najbliższe przyjazdy na przystanek " + nazwa + " (szacowane z czasu jazdy)";

    wyniki.forEach(function (w) {
      var li = dodaj(el.lista, "li", "kurs" + (w.za <= 5 ? " zaraz" : ""));
      dodaj(li, "span", "linia", w.t.linia);

      var opis = dodaj(li, "div", "opis");
      var dodatkowe = [];
      if (tryb === "odjazdy") {
        dodaj(opis, "div", "kierunek", "→ " + w.t.kierunek);
        if (cel) {
          dodatkowe.push(w.przyjazd === null
            ? "Czas dojazdu do " + DANE.przystanki[cel] + ": patrz objaśnienia"
            : "Na miejscu ok. " + naTekst(w.przyjazd) + " (" + (w.przyjazd - w.min) + " min)");
        }
      } else {
        dodaj(opis, "div", "kierunek", "→ " + w.t.kierunek);
        dodatkowe.push("odjazd z " + w.skad + " o " + naTekst(w.odjazd));
      }
      if (w.jutro) dodatkowe.unshift("jutro");
      if (dodatkowe.length) dodaj(opis, "div", "dodatkowe", dodatkowe.join(" · "));
      rysujZnaki(opis, w);

      var czas = dodaj(li, "div", "czas");
      dodaj(czas, "div", "godzina", (tryb === "przyjazdy" ? "ok. " : "") + naTekst(w.min));
      dodaj(czas, "div", "za", opisZa(w.za));
      var pdf = dodaj(czas, "a", "pdf", "PDF");
      pdf.href = w.t.pdf;
      pdf.target = "_blank";
      pdf.rel = "noopener";
      pdf.title = "Tabliczka z rozkładem: linia " + w.t.linia + ", " + w.t.przystanek;
    });
  }

  // ---------- start ----------

  el.wersja.textContent = "Rozkład ważny od " + DANE.waznyOd[DANE.waznyOd.length - 1] +
    " (pobrany " + DANE.pobrano + ").";

  wypelnijSelect(el.przystanek, Object.keys(DANE.przystanki).sort(porownajNazwy));
  var zapamietany = wczytaj("przystanek");
  if (zapamietany && DANE.przystanki[zapamietany]) el.przystanek.value = zapamietany;
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
