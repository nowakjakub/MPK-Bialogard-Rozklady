(function () {
  "use strict";

  var DANE = window.ROZKLAD;
  var ILE_POZYCJI = 20;
  var NAZWY_DNI = { R: "dzień powszedni", SN: "sobota / niedziela / święto" };
  var DNI_TYGODNIA = ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."];
  var ZNAK_ZOLTY = "#";

  function $(id) { return document.getElementById(id); }

  var el = {
    ulubiony: $("ulubiony"), wybierz: $("wybierz"), nazwa: $("nazwa-przystanku"),
    teraz: $("teraz"), zmienCzas: $("zmien-czas"), panelCzasu: $("panel-czasu"), czas: $("czas"),
    zakladki: document.querySelectorAll("[data-tryb]"),
    filtry: $("filtry"), info: $("info"), lista: $("lista"), tabliczka: $("tabliczka"), wersja: $("wersja"),
    szukaj: $("szukaj"), szukajPole: $("szukaj-pole"), szukajWyniki: $("szukaj-wyniki"),
    celOkno: $("cel-okno"), celPole: $("cel-pole"), celWyniki: $("cel-wyniki")
  };

  var stan = {
    przystanek: null,
    tryb: "odjazdy",
    kierunek: "",      // filtr kierunku (klucz grupy)
    cel: "",           // przystanek docelowy
    otwarty: null,     // rozwinięty kurs
    tabliczka: null,   // indeks tabliczki w zakładce Rozkład
    dzienTabliczki: null
  };

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

  function czySwieto(data) {
    return swieta(data.getFullYear()).indexOf(kluczDaty(data)) !== -1;
  }

  // Rozkład ZKMB ma dwie kolumny: dzień powszedni (R) oraz sobota/niedziela (SN).
  function typDnia(data) {
    var dzien = data.getDay();
    if (dzien === 0 || dzien === 6 || czySwieto(data)) return "SN";
    return "R";
  }

  function wybranyCzas() {
    if (el.czas.value) {
      var d = new Date(el.czas.value);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  // ---------- dane ----------

  function porownajNazwy(a, b) {
    return DANE.przystanki[a].localeCompare(DANE.przystanki[b], "pl");
  }

  function porownajLinie(a, b) {
    return a.localeCompare(b, "pl", { numeric: true });
  }

  // pierwszy liczbowy czas jazdy w wierszu trasy (PDF-y mają czasem 2 warianty trasy)
  function czasJazdy(wiersz) {
    for (var i = 0; i < wiersz.m.length; i++) if (typeof wiersz.m[i] === "number") return wiersz.m[i];
    return null;
  }

  // literka z kolumny czasu jazdy, np. "k" = tylko kursy oznaczone "k" jadą przez ten przystanek
  function wymaganyZnak(wiersz) {
    for (var i = 0; i < wiersz.m.length; i++) {
      if (typeof wiersz.m[i] === "string" && /^[a-z]$/i.test(wiersz.m[i])) return wiersz.m[i];
    }
    return null;
  }

  function znaki(oznaczenie) {
    return oznaczenie ? oznaczenie.split("") : [];
  }

  function koniecTrasy(t) {
    return t.trasa[t.trasa.length - 1].k;
  }

  function indeksNaTrasie(t, klucz) {
    for (var i = 1; i < t.trasa.length; i++) if (t.trasa[i].k === klucz) return i;
    return -1;
  }

  function kluczKierunku(t) {
    return t.kierunek.toLowerCase();
  }

  function bezOgonkow(s) {
    return s.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-.,]/g, " ");
  }

  // Czy tekst objaśnienia wymienia przystanek (odporne na odmianę: "Zakładu BG P" ~ "Zakład BG P").
  function wymienia(tekst, nazwa) {
    var slowaTekstu = bezOgonkow(tekst).split(/\s+/);
    var slowa = bezOgonkow(nazwa).split(/\s+/).filter(Boolean);
    return slowa.length > 0 && slowa.every(function (s) {
      var rdzen = s.length > 4 ? s.slice(0, 4) : s;
      return slowaTekstu.some(function (w) { return s.length > 4 ? w.indexOf(rdzen) === 0 : w === s; });
    });
  }

  function fragment(tekst, wzor) {
    var m = tekst.match(wzor);
    return m ? m[1].split(" - ")[0] : null;
  }

  // Czy kurs z danym oznaczeniem zatrzymuje się na i-tym przystanku trasy tabliczki.
  // Korzysta z objaśnień w rozkładzie: "tylko do X", "brak dojazdu do X", "wydłużony do X"
  // oraz literek w kolumnie czasu jazdy (np. "k" = tylko kursy "k").
  function przejezdza(t, oznaczenie, i) {
    var znak = wymaganyZnak(t.trasa[i]);
    if (znak && oznaczenie.indexOf(znak) === -1) return false;
    var nazwa = t.trasa[i].n;
    return Object.keys(t.obj).every(function (z) {
      var opis = t.obj[z];
      var ma = oznaczenie.indexOf(z) !== -1;
      var tylko = fragment(opis, /tylko do (.+)/i);
      if (ma && tylko) {
        for (var j = 1; j < i; j++) if (wymienia(tylko, t.trasa[j].n)) return false;
      }
      var brak = fragment(opis, /brak dojazdu do (.+)/i);
      if (ma && brak && wymienia(brak, nazwa)) return false;
      var dluzszy = fragment(opis, /wydłużony do (.+)/i);
      if (!ma && dluzszy && wymienia(dluzszy, nazwa)) return false;
      return true;
    });
  }

  // Dodatkowe minuty z objaśnień typu "Kurs przez Kisielice (należy doliczyć ok 7 min)" – liczone
  // od przystanku objazdu (literka w kolumnie czasu jazdy), a gdy go nie ma na liście – od początku.
  function doliczone(t, oznaczenie, i) {
    var suma = 0;
    znaki(oznaczenie).forEach(function (z) {
      var m = (t.obj[z] || "").match(/dolicz\S*\s+(?:ok\.?\s*)?(\d+)\s*min/i);
      if (!m) return;
      var od = -1;
      for (var j = 1; j < t.trasa.length; j++) if (wymaganyZnak(t.trasa[j]) === z) { od = j; break; }
      if (od === -1 || i > od) suma += parseInt(m[1], 10);
    });
    return suma;
  }

  // Szacowany czas jazdy od przystanku tabliczki do i-tego przystanku trasy (null = nieznany).
  function jazdaDo(t, oznaczenie, i) {
    var jazda = czasJazdy(t.trasa[i]);
    return jazda === null ? null : jazda + doliczone(t, oznaczenie, i);
  }

  function tabliczkiPrzystanku(klucz) {
    return DANE.tabliczki.filter(function (t) { return t.k === klucz; });
  }

  // linie zatrzymujące się na przystanku (do wyszukiwarki)
  var LINIE_NA = (function () {
    var wynik = {};
    DANE.tabliczki.forEach(function (t) {
      t.trasa.forEach(function (w) {
        wynik[w.k] = wynik[w.k] || {};
        wynik[w.k][t.linia] = true;
      });
    });
    Object.keys(wynik).forEach(function (k) { wynik[k] = Object.keys(wynik[k]).sort(porownajLinie); });
    return wynik;
  })();

  // ---------- pamięć przeglądarki ----------

  function zapisz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* brak dostępu */ } }
  function wczytaj(k, domyslnie) {
    try {
      var v = JSON.parse(localStorage.getItem(k));
      return v === null ? domyslnie : v;
    } catch (e) { return domyslnie; }
  }

  // ---------- szukanie kursów ----------

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

  // ostatni odjazd dnia dla każdej tabliczki (żeby oznaczyć "ostatni kurs")
  function ostatnieOdjazdy(tabliczki, od) {
    var wynik = {};
    [0, 1].forEach(function (przesuniecie) {
      var dzien = new Date(od.getFullYear(), od.getMonth(), od.getDate() + przesuniecie);
      var typ = typDnia(dzien);
      tabliczki.forEach(function (t, i) {
        var o = t.odjazdy[typ];
        if (o.length) wynik[i + "|" + przesuniecie] = o[o.length - 1][0];
      });
    });
    return wynik;
  }

  function odjazdy(klucz, od) {
    var teraz = od.getHours() * 60 + od.getMinutes();
    var tabliczki = tabliczkiPrzystanku(klucz);
    var ostatnie = ostatnieOdjazdy(tabliczki, od);
    var wyniki = [];
    dlaKazdegoOdjazdu(tabliczki, od, function (t, godzina, oznaczenie, przesuniecie) {
      var min = naMinuty(godzina) + przesuniecie * 1440;
      if (min < teraz) return;
      if (stan.kierunek && kluczKierunku(t) !== stan.kierunek) return;
      var w = { t: t, linie: [t.linia], min: min, oznaczenie: oznaczenie, jutro: przesuniecie > 0,
        ostatni: ostatnie[tabliczki.indexOf(t) + "|" + przesuniecie] === godzina, start: min, indeks: 0 };
      if (stan.cel) {
        var j = indeksNaTrasie(t, stan.cel);
        if (j === -1 || !przejezdza(t, oznaczenie, j)) return;
        var jazda = jazdaDo(t, oznaczenie, j);
        w.przyjazd = jazda === null ? null : min + jazda;
      }
      // ten sam kurs bywa wpisany w tabliczki dwóch linii – łączymy je w jeden wiersz
      var ten = wyniki.filter(function (x) {
        return x.min === min && kluczKierunku(x.t) === kluczKierunku(t) && x.oznaczenie === oznaczenie;
      })[0];
      if (ten) {
        if (ten.linie.indexOf(t.linia) === -1) ten.linie.push(t.linia);
        return;
      }
      wyniki.push(w);
    });
    return posortuj(wyniki);
  }

  // Przyjazd = odjazd z wcześniejszego przystanku + czas jazdy. Liczymy ze wszystkich tabliczek
  // i usuwamy powtórki, więc działa też na pętlach, które nie mają własnych tabliczek.
  function przyjazdy(klucz, od) {
    var teraz = od.getHours() * 60 + od.getMinutes();
    var zrodla = [];
    DANE.tabliczki.forEach(function (t) {
      var j = indeksNaTrasie(t, klucz);
      if (j === -1) return;
      if (stan.kierunek && kluczKierunku(t) !== stan.kierunek) return;
      var jazda = czasJazdy(t.trasa[j]);
      if (jazda !== null) zrodla.push({ t: t, j: j, jazda: jazda });
    });
    zrodla.sort(function (a, b) { return a.jazda - b.jazda; }); // najbliższa tabliczka jest najdokładniejsza

    var wyniki = [];
    zrodla.forEach(function (z) {
      dlaKazdegoOdjazdu([z.t], od, function (t, godzina, oznaczenie, przesuniecie) {
        if (!przejezdza(t, oznaczenie, z.j)) return;
        var start = naMinuty(godzina) + przesuniecie * 1440;
        var min = start + jazdaDo(t, oznaczenie, z.j);
        if (min < teraz) return;
        var powtorka = wyniki.some(function (w) {
          return w.linie[0] === t.linia && koniecTrasy(w.t) === koniecTrasy(t) && Math.abs(w.min - min) <= 3;
        });
        if (powtorka) return;
        wyniki.push({ t: t, linie: [t.linia], min: min, oznaczenie: oznaczenie, jutro: min >= 1440,
          skad: t.przystanek, start: start, indeks: z.j });
      });
    });
    return posortuj(wyniki);
  }

  function posortuj(wyniki) {
    wyniki.forEach(function (w) { w.linie.sort(porownajLinie); });
    wyniki.sort(function (a, b) { return a.min - b.min || porownajLinie(a.linie[0], b.linie[0]); });
    return wyniki.slice(0, ILE_POZYCJI);
  }

  // Przebieg kursu: godziny na kolejnych przystankach (z czasu jazdy w tabliczce).
  function przebieg(t, start, oznaczenie) {
    var wynik = [];
    t.trasa.forEach(function (w, i) {
      var jazda = i === 0 ? 0 : jazdaDo(t, oznaczenie, i);
      if (i > 0 && (jazda === null || !przejezdza(t, oznaczenie, i))) return;
      wynik.push({ k: w.k, n: DANE.przystanki[w.k] || w.n, min: start + jazda, nz: w.nz });
    });
    return wynik;
  }

  // ---------- rysowanie: pomocnicze ----------

  function dodaj(rodzic, tag, klasa, tekst) {
    var e = document.createElement(tag);
    if (klasa) e.className = klasa;
    if (tekst !== undefined && tekst !== null) e.textContent = tekst;
    rodzic.appendChild(e);
    return e;
  }

  function odznakaLinii(rodzic, linia, mala) {
    var s = dodaj(rodzic, "span", "linia" + (mala ? " mala" : ""), linia);
    s.setAttribute("data-l", linia);
    s.setAttribute("aria-label", "linia " + linia);
    return s;
  }

  function znaczek(rodzic, z) {
    var s = dodaj(rodzic, "span", "znaczek" + (z === ZNAK_ZOLTY ? " zolty" : ""), z === ZNAK_ZOLTY ? "" : z);
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  function opisZa(za) {
    if (za <= 0) return "teraz";
    if (za < 60) return za + " min";
    var h = Math.floor(za / 60), m = za % 60;
    return h + " h" + (m ? " " + m + " min" : "");
  }

  function minutyTeraz() {
    var od = wybranyCzas();
    return od.getHours() * 60 + od.getMinutes();
  }

  // ---------- rysowanie: nagłówek ----------

  function rysujNaglowek() {
    var od = wybranyCzas();
    var typ = typDnia(od);
    var tekst = DNI_TYGODNIA[od.getDay()] + " " + naTekst(od.getHours() * 60 + od.getMinutes()) + " · " + NAZWY_DNI[typ];
    if (czySwieto(od)) tekst += " (święto)";
    el.teraz.textContent = tekst;
    el.zmienCzas.textContent = el.czas.value ? "Inny czas ✎" : "Zmień czas";
    el.nazwa.textContent = DANE.przystanki[stan.przystanek];
    var ulub = wczytaj("ulubione", []).indexOf(stan.przystanek) !== -1;
    el.ulubiony.textContent = ulub ? "★" : "☆";
    el.ulubiony.setAttribute("aria-pressed", String(ulub));
    el.ulubiony.setAttribute("aria-label", ulub ? "Usuń z ulubionych" : "Dodaj do ulubionych");
    Array.prototype.forEach.call(el.zakladki, function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-tryb") === stan.tryb));
    });
  }

  // ---------- rysowanie: filtry ----------

  function kierunkiPrzystanku() {
    var wynik = {};
    var tabliczki = stan.tryb === "przyjazdy"
      ? DANE.tabliczki.filter(function (t) { return indeksNaTrasie(t, stan.przystanek) !== -1; })
      : tabliczkiPrzystanku(stan.przystanek);
    tabliczki.forEach(function (t) {
      var k = kluczKierunku(t);
      wynik[k] = wynik[k] || { nazwa: t.kierunek, linie: [] };
      if (wynik[k].linie.indexOf(t.linia) === -1) wynik[k].linie.push(t.linia);
    });
    return wynik;
  }

  function chip(tekst, wcisniety, onclick) {
    var b = dodaj(el.filtry, "button", "chip");
    b.type = "button";
    b.setAttribute("aria-pressed", String(!!wcisniety));
    if (tekst) dodaj(b, "span", "", tekst);
    b.addEventListener("click", onclick);
    return b;
  }

  function rysujFiltry() {
    el.filtry.innerHTML = "";
    if (stan.tryb === "rozklad") return;
    var kierunki = kierunkiPrzystanku();
    Object.keys(kierunki).forEach(function (k) { kierunki[k].linie.sort(porownajLinie); });
    var klucze = Object.keys(kierunki).sort(function (a, b) {
      return porownajLinie(kierunki[a].linie[0], kierunki[b].linie[0]) || a.localeCompare(b, "pl");
    });
    if (stan.kierunek && !kierunki[stan.kierunek]) stan.kierunek = "";

    if (stan.tryb === "odjazdy") {
      var celChip = chip(stan.cel ? "Do: " + DANE.przystanki[stan.cel] + "  ✕" : "Dokąd jadę?", !!stan.cel, function () {
        if (stan.cel) { stan.cel = ""; zapiszCel(); odswiez(); } else otworzCel();
      });
      celChip.setAttribute("aria-label", stan.cel ? "Usuń przystanek docelowy " + DANE.przystanki[stan.cel] : "Wybierz, dokąd jedziesz");
    }
    if (klucze.length > 1) {
      chip("Wszystkie", !stan.kierunek, function () { stan.kierunek = ""; odswiez(); });
      klucze.forEach(function (k) {
        var b = chip(null, stan.kierunek === k, function () { stan.kierunek = stan.kierunek === k ? "" : k; odswiez(); });
        kierunki[k].linie.forEach(function (l) { odznakaLinii(b, l, true); });
        dodaj(b, "span", "", "→ " + kierunki[k].nazwa);
      });
    }
  }

  function zapiszCel() {
    var cele = wczytaj("cele", {});
    if (stan.cel) cele[stan.przystanek] = stan.cel; else delete cele[stan.przystanek];
    zapisz("cele", cele);
  }

  // ---------- rysowanie: lista kursów ----------

  function rysujListe() {
    el.lista.innerHTML = "";
    var teraz = minutyTeraz();
    var wyniki = stan.tryb === "odjazdy" ? odjazdy(stan.przystanek, wybranyCzas()) : przyjazdy(stan.przystanek, wybranyCzas());
    var nazwa = DANE.przystanki[stan.przystanek];

    el.info.innerHTML = "";
    if (stan.tryb === "przyjazdy") {
      el.info.textContent = "Szacowane godziny przyjazdu na przystanek (odjazd z wcześniejszego przystanku + czas jazdy).";
    } else if (stan.cel) {
      dodaj(el.info, "span", "", "Tylko kursy, które dojeżdżają do: ");
      dodaj(el.info, "strong", "", DANE.przystanki[stan.cel]);
    } else {
      el.info.textContent = "Dotknij kursu, aby zobaczyć trasę i znaczenie oznaczeń.";
    }

    if (!wyniki.length) {
      var maTabliczki = tabliczkiPrzystanku(stan.przystanek).length > 0;
      var li = dodaj(el.lista, "li", "pusto");
      if (stan.tryb === "odjazdy" && !maTabliczki) {
        li.textContent = "Z przystanku " + nazwa + " autobusy nie odjeżdżają (to pętla). ";
        var b = dodaj(li, "button", "chip", "Pokaż przyjazdy");
        b.type = "button";
        b.addEventListener("click", function () { ustawTryb("przyjazdy"); });
      } else {
        li.textContent = "Brak kursów do końca jutrzejszego dnia" + (stan.kierunek || stan.cel ? " dla wybranego filtra." : ".");
      }
      return;
    }

    wyniki.forEach(function (w, i) {
      var id = stan.tryb + "|" + w.linie.join(",") + "|" + w.t.kierunek + "|" + w.min;
      var za = w.min - teraz;
      var li = dodaj(el.lista, "li", "kurs" + (za <= 5 ? " zaraz" : ""));
      var btn = dodaj(li, "button");
      btn.type = "button";
      btn.setAttribute("aria-expanded", String(stan.otwarty === id));

      var linie = dodaj(btn, "span", "linie");
      w.linie.forEach(function (l) { odznakaLinii(linie, l); });

      var srodek = dodaj(btn, "span", "srodek");
      dodaj(srodek, "span", "kierunek", w.t.kierunek);
      var pod = dodaj(srodek, "span", "pod");
      if (w.jutro) dodaj(pod, "span", "tag", "jutro");
      if (w.ostatni) dodaj(pod, "span", "tag ostatni", "ostatni kurs");
      if (stan.tryb === "odjazdy" && stan.cel) {
        dodaj(pod, "span", "", w.przyjazd === null ? "dojazd: patrz szczegóły" : "na miejscu ok. " + naTekst(w.przyjazd));
      }
      if (stan.tryb === "przyjazdy") dodaj(pod, "span", "", "z " + w.skad + " " + naTekst(w.start));
      znaki(w.oznaczenie).forEach(function (z) { znaczek(pod, z); });

      var prawa = dodaj(btn, "span", "prawa");
      var przybl = stan.tryb === "przyjazdy" ? "ok. " : "";
      if (za < 60) {
        dodaj(prawa, "span", "duzy", opisZa(za)).style.display = "block";
        dodaj(prawa, "span", "maly", przybl + naTekst(w.min)).style.display = "block";
      } else {
        dodaj(prawa, "span", "duzy", naTekst(w.min)).style.display = "block";
        dodaj(prawa, "span", "maly", "za " + opisZa(za)).style.display = "block";
      }
      btn.setAttribute("aria-label", "Linia " + w.linie.join(" i ") + " w kierunku " + w.t.kierunek + ", " +
        przybl + naTekst(w.min) + (za < 60 ? ", za " + opisZa(za) : ""));

      btn.addEventListener("click", function () {
        stan.otwarty = stan.otwarty === id ? null : id;
        rysujListe();
      });
      if (stan.otwarty === id) rysujSzczegoly(li, w);
      if (i === 0 && za > 120) {
        dodaj(li, "div", "szczegoly", "Najbliższy kurs dopiero za " + opisZa(za) + ".").style.color = "var(--szary)";
      }
    });
  }

  function rysujSzczegoly(li, w) {
    var box = dodaj(li, "div", "szczegoly");
    znaki(w.oznaczenie).forEach(function (z) {
      var r = dodaj(box, "div", "objasnienie");
      znaczek(r, z);
      dodaj(r, "span", "", w.t.obj[z] || "oznaczenie w rozkładzie – szczegóły w tabliczce PDF");
    });
    if (w.linie.length > 1) {
      dodaj(box, "div", "objasnienie", "Ten kurs jest wpisany w rozkładzie linii " + w.linie.join(" i ") + ".");
    }
    dodaj(box, "div", "maly", "Przebieg kursu (godziny szacowane):");
    var ol = dodaj(box, "ol", "trasa");
    przebieg(w.t, w.start, w.oznaczenie).forEach(function (p) {
      var klasa = p.k === stan.przystanek ? "tu" : (p.k === stan.cel ? "cel" : "");
      var r = dodaj(ol, "li", klasa);
      dodaj(r, "span", "", p.n + (p.nz ? " (na żądanie)" : ""));
      dodaj(r, "span", "g", naTekst(p.min));
    });
    var linki = dodaj(box, "div", "linki");
    var a = dodaj(linki, "a", "", "Tabliczka PDF ↗");
    a.href = w.t.pdf; a.target = "_blank"; a.rel = "noopener";
    // przyjazdy liczymy z tabliczki innego przystanku – szukamy tabliczki tej linii na wybranym
    var tab = tabliczkiPrzystanku(stan.przystanek);
    var idx = tab.indexOf(w.t);
    if (idx === -1) {
      tab.forEach(function (x, i) { if (idx === -1 && x.linia === w.t.linia && kluczKierunku(x) === kluczKierunku(w.t)) idx = i; });
    }
    if (idx !== -1) {
      var pelny = dodaj(linki, "button", "", "Pełny rozkład tej linii");
      pelny.type = "button";
      pelny.addEventListener("click", function () {
        stan.tabliczka = idx;
        ustawTryb("rozklad");
      });
    }
  }

  // ---------- rysowanie: pełny rozkład (tabliczka) ----------

  function rysujTabliczke() {
    var box = el.tabliczka;
    box.innerHTML = "";
    var tab = tabliczkiPrzystanku(stan.przystanek);
    if (!tab.length) {
      dodaj(box, "p", "pusto", "Ten przystanek nie ma własnej tabliczki (to pętla). Zobacz zakładkę Przyjazdy.");
      return;
    }
    tab = tab.slice().sort(function (a, b) { return porownajLinie(a.linia, b.linia) || a.kierunek.localeCompare(b.kierunek, "pl"); });
    if (stan.tabliczka === null || stan.tabliczka >= tab.length) stan.tabliczka = 0;
    var wszystkie = tabliczkiPrzystanku(stan.przystanek);
    var t = wszystkie[stan.tabliczka] || tab[0];

    var wybor = dodaj(box, "div", "filtry");
    tab.forEach(function (x) {
      var b = dodaj(wybor, "button", "chip");
      b.type = "button";
      b.setAttribute("aria-pressed", String(x === t));
      odznakaLinii(b, x.linia, true);
      dodaj(b, "span", "", "→ " + x.kierunek);
      b.addEventListener("click", function () { stan.tabliczka = wszystkie.indexOf(x); rysujTabliczke(); });
    });

    var od = wybranyCzas();
    var dzisTyp = typDnia(od);
    var typ = stan.dzienTabliczki || dzisTyp;
    var dni = dodaj(box, "div", "dni");
    [["R", "Dni powszednie"], ["SN", "Soboty, niedziele, święta"]].forEach(function (d) {
      var b = dodaj(dni, "button", "chip", d[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", String(typ === d[0]));
      b.addEventListener("click", function () { stan.dzienTabliczki = d[0]; rysujTabliczke(); });
    });

    var siatka = dodaj(box, "div", "siatka");
    var godziny = {};
    t.odjazdy[typ].forEach(function (o) {
      var h = parseInt(o[0], 10);
      (godziny[h] = godziny[h] || []).push(o);
    });
    var klucze = Object.keys(godziny).map(Number).sort(function (a, b) { return a - b; });
    var teraz = od.getHours() * 60 + od.getMinutes();
    if (!klucze.length) dodaj(siatka, "p", "pusto", "W te dni brak kursów.");
    klucze.forEach(function (h) {
      var wiersz = dodaj(siatka, "div", "godz" + (typ === dzisTyp && h === od.getHours() ? " teraz" : ""));
      dodaj(wiersz, "div", "h", String(h));
      var m = dodaj(wiersz, "div", "m");
      godziny[h].forEach(function (o) {
        var zolty = o[1].indexOf(ZNAK_ZOLTY) !== -1;
        var klasa = (typ === dzisTyp && naMinuty(o[0]) < teraz ? "minelo " : "") + (zolty ? "zolty" : "");
        var s = dodaj(m, "span", klasa.trim(), o[0].slice(3));
        var litery = o[1].replace(ZNAK_ZOLTY, "");
        if (litery) dodaj(s, "sup", "", litery);
      });
    });

    var legenda = dodaj(box, "div", "legenda");
    Object.keys(t.obj).forEach(function (z) {
      var r = dodaj(legenda, "div", "objasnienie");
      if (z === "NŻ") dodaj(r, "span", "znaczek", "NŻ"); else znaczek(r, z);
      dodaj(r, "span", "", t.obj[z]);
    });
    (t.uwagi || []).forEach(function (u) { dodaj(legenda, "div", "objasnienie", u); });
    var linki = dodaj(box, "div", "linki");
    var a = dodaj(linki, "a", "", "Oryginalna tabliczka PDF ↗");
    a.href = t.pdf; a.target = "_blank"; a.rel = "noopener";

    dodaj(box, "h2", "", "Trasa");
    var ol = dodaj(box, "ol", "trasa");
    t.trasa.forEach(function (w, i) {
      var jazda = czasJazdy(w);
      var r = dodaj(ol, "li", i === 0 ? "tu" : "");
      dodaj(r, "span", "", (DANE.przystanki[w.k] || w.n) + (w.nz ? " (na żądanie)" : ""));
      var znak = wymaganyZnak(w);
      dodaj(r, "span", "g", jazda !== null ? "+" + jazda + " min" : (znak ? "tylko kursy „" + znak + "”" : ""));
    });
  }

  // ---------- główne odświeżanie ----------

  function odswiez() {
    rysujNaglowek();
    rysujFiltry();
    var rozklad = stan.tryb === "rozklad";
    el.lista.hidden = rozklad;
    el.info.hidden = rozklad;
    el.tabliczka.hidden = !rozklad;
    if (rozklad) rysujTabliczke(); else rysujListe();
    zapiszAdres();
  }

  function zapiszAdres() {
    try {
      var url = new URL(location.href);
      url.searchParams.set("p", stan.przystanek);
      if (stan.tryb !== "odjazdy") url.searchParams.set("t", stan.tryb); else url.searchParams.delete("t");
      history.replaceState(null, "", url);
    } catch (e) { /* np. file:// w niektórych przeglądarkach */ }
  }

  function ustawTryb(tryb) {
    stan.tryb = tryb;
    stan.otwarty = null;
    window.scrollTo(0, 0);
    odswiez();
  }

  function ustawPrzystanek(klucz) {
    if (!DANE.przystanki[klucz]) return;
    stan.przystanek = klucz;
    stan.kierunek = "";
    stan.otwarty = null;
    stan.tabliczka = null;
    stan.cel = wczytaj("cele", {})[klucz] || "";
    zapisz("przystanek", klucz);
    var ostatnie = wczytaj("ostatnie", []).filter(function (k) { return k !== klucz; });
    ostatnie.unshift(klucz);
    zapisz("ostatnie", ostatnie.slice(0, 5));
  }

  // ---------- wyszukiwarka przystanków ----------

  var INDEKS = Object.keys(DANE.przystanki).map(function (k) {
    return { k: k, tekst: bezOgonkow(DANE.przystanki[k]) };
  });

  function pasuje(tekst, zapytanie) {
    var slowa = bezOgonkow(zapytanie).split(/\s+/).filter(Boolean);
    return slowa.every(function (s) { return tekst.indexOf(s) !== -1; });
  }

  function pozycja(rodzic, klucz, onclick, opis) {
    var b = dodaj(rodzic, "button", "pozycja");
    b.type = "button";
    var n = dodaj(b, "span", "n", DANE.przystanki[klucz]);
    if (opis) dodaj(n, "span", "odleglosc", opis);
    var linie = dodaj(b, "span", "linie");
    (LINIE_NA[klucz] || []).forEach(function (l) { odznakaLinii(linie, l, true); });
    b.addEventListener("click", function () { onclick(klucz); });
  }

  function grupa(rodzic, tytul, klucze, onclick, opisy) {
    if (!klucze.length) return;
    if (tytul) dodaj(rodzic, "h3", "", tytul);
    var g = dodaj(rodzic, "div", "grupa");
    klucze.forEach(function (k) { pozycja(g, k, onclick, opisy && opisy[k]); });
  }

  function rysujWyszukiwarke() {
    var q = el.szukajPole.value.trim();
    var box = el.szukajWyniki;
    box.innerHTML = "";
    var wszystkie = Object.keys(DANE.przystanki).sort(porownajNazwy);
    function wybierz(k) { el.szukaj.close(); ustawPrzystanek(k); odswiez(); }
    if (q) {
      var trafienia = INDEKS.filter(function (x) { return pasuje(x.tekst, q); }).map(function (x) { return x.k; }).sort(porownajNazwy);
      if (!trafienia.length) dodaj(box, "p", "pusto", "Nie znaleziono przystanku „" + q + "”.");
      grupa(box, "Wyniki", trafienia, wybierz);
      return;
    }
    rysujWPoblizu(box, wybierz);
    grupa(box, "Ulubione", wczytaj("ulubione", []).filter(function (k) { return DANE.przystanki[k]; }), wybierz);
    grupa(box, "Ostatnio wybierane", wczytaj("ostatnie", []).filter(function (k) { return DANE.przystanki[k]; }), wybierz);
    grupa(box, "Wszystkie przystanki", wszystkie, wybierz);
  }

  function otworzOkno(okno, pole, rysuj, bezKlawiatury) {
    pole.value = "";
    rysuj();
    // bez klawiatury: pole tylko do odczytu, żeby okno nie ustawiło w nim kursora (klawiatura zasłoniłaby listę)
    if (bezKlawiatury) pole.readOnly = true;
    if (okno.showModal) okno.showModal(); else okno.setAttribute("open", "");
    okno.scrollTop = 0;
    if (bezKlawiatury) {
      pole.blur();
      setTimeout(function () { pole.readOnly = false; }, 100);
    } else {
      setTimeout(function () { pole.focus(); }, 50);
    }
  }

  // ---------- najbliższe przystanki (lokalizacja) ----------

  var GPS = window.PRZYSTANKI_GPS || {};
  var lokalizacja = { stan: "brak", pozycja: null, czas: 0, blad: "" };
  var ILE_W_POBLIZU = 5;

  function odleglosc(a, b) {
    // metry; przybliżenie równoprostokątne wystarcza na odległości w mieście
    var sr = (a[0] + b[0]) / 2 * Math.PI / 180;
    var dx = (b[1] - a[1]) * Math.PI / 180 * Math.cos(sr);
    var dy = (b[0] - a[0]) * Math.PI / 180;
    return 6371000 * Math.sqrt(dx * dx + dy * dy);
  }

  function najblizsze(pozycja) {
    return Object.keys(GPS).filter(function (k) { return DANE.przystanki[k]; }).map(function (k) {
      var m = Math.min.apply(null, GPS[k].p.map(function (p) { return odleglosc(pozycja, p); }));
      return { k: k, m: m, szac: !!GPS[k].szac };
    }).sort(function (a, b) { return a.m - b.m; });
  }

  function opisOdleglosci(x) {
    var tekst = x.m < 1000 ? Math.round(x.m / 10) * 10 + " m" : (x.m / 1000).toFixed(1).replace(".", ",") + " km";
    var pieszo = Math.max(1, Math.round(x.m / 80)); // ok. 4,8 km/h
    return (x.szac ? "ok. " : "") + tekst + (x.m < 3000 ? " · " + pieszo + " min pieszo" : "");
  }

  function pobierzLokalizacje(gotowe) {
    if (!("geolocation" in navigator)) {
      lokalizacja.stan = "blad"; lokalizacja.blad = "Ta przeglądarka nie udostępnia lokalizacji.";
      return gotowe();
    }
    if (window.isSecureContext === false) {
      lokalizacja.stan = "blad"; lokalizacja.blad = "Lokalizacja działa tylko na stronie https (np. na GitHub Pages).";
      return gotowe();
    }
    if (lokalizacja.pozycja && Date.now() - lokalizacja.czas < 120000) {
      lokalizacja.stan = "ok";
      return gotowe();
    }
    lokalizacja.stan = "szukam";
    gotowe();
    navigator.geolocation.getCurrentPosition(function (p) {
      lokalizacja.stan = "ok";
      lokalizacja.pozycja = [p.coords.latitude, p.coords.longitude];
      lokalizacja.czas = Date.now();
      gotowe();
    }, function (e) {
      lokalizacja.stan = "blad";
      lokalizacja.blad = e.code === 1
        ? "Brak zgody na lokalizację. Zezwól na nią w ustawieniach przeglądarki dla tej strony."
        : "Nie udało się ustalić lokalizacji. Spróbuj ponownie na zewnątrz lub z włączonym GPS.";
      gotowe();
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function rysujWPoblizu(box, wybierz) {
    if (!Object.keys(GPS).length) return;
    var sekcja = dodaj(box, "div", "w-poblizu");
    if (lokalizacja.stan === "brak") {
      var b = dodaj(sekcja, "button", "chip lokalizuj", "📍 Pokaż najbliższe przystanki");
      b.type = "button";
      b.addEventListener("click", function () { pobierzLokalizacje(rysujWyszukiwarke); });
      return;
    }
    dodaj(sekcja, "h3", "", "W pobliżu");
    if (lokalizacja.stan === "szukam") {
      dodaj(sekcja, "p", "pusto", "Szukam Twojej lokalizacji…");
      return;
    }
    if (lokalizacja.stan === "blad") {
      dodaj(sekcja, "p", "pusto", lokalizacja.blad);
      var ponow = dodaj(sekcja, "button", "chip lokalizuj", "Spróbuj ponownie");
      ponow.type = "button";
      ponow.addEventListener("click", function () { pobierzLokalizacje(rysujWyszukiwarke); });
      return;
    }
    var lista = najblizsze(lokalizacja.pozycja);
    if (lista.length && lista[0].m > 10000) {
      dodaj(sekcja, "p", "pusto", "Jesteś ok. " + Math.round(lista[0].m / 1000) + " km od najbliższego przystanku ZKMB.");
    }
    var opisy = {};
    lista = lista.slice(0, ILE_W_POBLIZU);
    lista.forEach(function (x) { opisy[x.k] = opisOdleglosci(x); });
    grupa(sekcja, null, lista.map(function (x) { return x.k; }), wybierz, opisy);
  }

  // ---------- wybór celu ----------

  function osiagalneCele() {
    var osiagalne = {};
    tabliczkiPrzystanku(stan.przystanek).forEach(function (t) {
      t.trasa.slice(1).forEach(function (w) {
        if (w.k !== stan.przystanek && (czasJazdy(w) !== null || wymaganyZnak(w))) osiagalne[w.k] = true;
      });
    });
    return Object.keys(osiagalne).sort(porownajNazwy);
  }

  function rysujCele() {
    var q = el.celPole.value.trim();
    var box = el.celWyniki;
    box.innerHTML = "";
    var cele = osiagalneCele();
    if (q) cele = cele.filter(function (k) { return pasuje(bezOgonkow(DANE.przystanki[k]), q); });
    if (!cele.length) {
      dodaj(box, "p", "pusto", q ? "Z tego przystanku nie dojedziesz bezpośrednio do „" + q + "”." : "Brak bezpośrednich połączeń.");
      return;
    }
    grupa(box, "Bezpośrednio z: " + DANE.przystanki[stan.przystanek], cele, function (k) {
      el.celOkno.close();
      stan.cel = k;
      zapiszCel();
      odswiez();
    });
  }

  function otworzCel() { otworzOkno(el.celOkno, el.celPole, rysujCele); }

  // ---------- start ----------

  var najnowsza = DANE.waznyOd.slice().sort(function (a, b) {
    return a.split(".").reverse().join("").localeCompare(b.split(".").reverse().join(""));
  }).pop();
  el.wersja.textContent = "Rozkład szkolny ważny od " + najnowsza +
    ", dane pobrane " + DANE.pobrano + ".";

  var parametry = new URLSearchParams(location.search);
  var startowy = parametry.get("p");
  if (!DANE.przystanki[startowy]) startowy = wczytaj("przystanek", null);
  if (!DANE.przystanki[startowy]) startowy = "dworcowa";
  if (!DANE.przystanki[startowy]) startowy = Object.keys(DANE.przystanki).sort(porownajNazwy)[0];
  ustawPrzystanek(startowy);
  if (["odjazdy", "przyjazdy", "rozklad"].indexOf(parametry.get("t")) !== -1) stan.tryb = parametry.get("t");

  el.wybierz.addEventListener("click", function () { otworzOkno(el.szukaj, el.szukajPole, rysujWyszukiwarke); });
  var bliskoBtn = $("blisko");
  if (!Object.keys(GPS).length) bliskoBtn.hidden = true;
  bliskoBtn.addEventListener("click", function () {
    otworzOkno(el.szukaj, el.szukajPole, rysujWyszukiwarke, true);
    pobierzLokalizacje(rysujWyszukiwarke);
  });
  el.szukajPole.addEventListener("input", rysujWyszukiwarke);
  $("szukaj-zamknij").addEventListener("click", function () { el.szukaj.close(); });
  el.celPole.addEventListener("input", rysujCele);
  $("cel-zamknij").addEventListener("click", function () { el.celOkno.close(); });

  el.ulubiony.addEventListener("click", function () {
    var ulubione = wczytaj("ulubione", []);
    var i = ulubione.indexOf(stan.przystanek);
    if (i === -1) ulubione.push(stan.przystanek); else ulubione.splice(i, 1);
    zapisz("ulubione", ulubione);
    rysujNaglowek();
  });

  el.zmienCzas.addEventListener("click", function () {
    el.panelCzasu.hidden = !el.panelCzasu.hidden;
    el.zmienCzas.setAttribute("aria-expanded", String(!el.panelCzasu.hidden));
    if (!el.panelCzasu.hidden && !el.czas.value) {
      var d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
      el.czas.value = d.toISOString().slice(0, 16);
    }
  });
  el.czas.addEventListener("change", odswiez);
  $("reset-czasu").addEventListener("click", function () {
    el.czas.value = "";
    el.panelCzasu.hidden = true;
    el.zmienCzas.setAttribute("aria-expanded", "false");
    odswiez();
  });

  Array.prototype.forEach.call(el.zakladki, function (b) {
    b.addEventListener("click", function () { ustawTryb(b.getAttribute("data-tryb")); });
  });

  odswiez();

  // odświeżanie co 20 s i po powrocie do karty
  function odswiezJesliTeraz() { if (!el.czas.value && stan.tryb !== "rozklad") odswiez(); }
  setInterval(odswiezJesliTeraz, 20000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) odswiezJesliTeraz(); });

  // tryb offline i instalacja na telefonie (działa tylko przez http/https, np. GitHub Pages)
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("sw.js").catch(function () { /* bez trybu offline */ });
  }
})();
