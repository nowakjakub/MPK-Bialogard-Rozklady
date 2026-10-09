// Testy strony w przeglądarce – zachowują się jak użytkownik na telefonie.
// Oczekiwane godziny liczymy z data/rozklad.js, więc testy działają też po aktualizacji rozkładu.
import { test, expect } from "@playwright/test";

const PONIEDZIALEK_7 = new Date("2026-09-28T07:00:00+02:00");

async function otworz(page, adres, czas = PONIEDZIALEK_7) {
  const bledy = [];
  page.on("pageerror", (e) => bledy.push(e.message));
  await page.clock.install({ time: czas });
  await page.goto(adres);
  return bledy;
}

// Pierwszy odjazd z przystanku po danej minucie wg danych (dzień powszedni).
function pierwszyOdjazd(dane, klucz, odMinuty, typ = "R") {
  const min = (g) => +g.slice(0, 2) * 60 + +g.slice(3);
  return dane.tabliczki
    .filter((t) => t.k === klucz)
    .flatMap((t) => t.odjazdy[typ].map(([g]) => ({ g, linia: t.linia, kierunek: t.kierunek })))
    .filter((o) => min(o.g) >= odMinuty)
    .sort((a, b) => min(a.g) - min(b.g) || a.linia.localeCompare(b.linia))[0];
}

test("odjazdy: pierwszy kurs z Dworcowej zgadza się z rozkładem", async ({ page }) => {
  const bledy = await otworz(page, "/?p=dworcowa");
  const dane = await page.evaluate(() => window.ROZKLAD);
  const oczekiwany = pierwszyOdjazd(dane, "dworcowa", 7 * 60);

  const pierwszy = page.locator(".kurs > button").first();
  await expect(pierwszy.locator(".linia").first()).toHaveText(oczekiwany.linia);
  await expect(pierwszy.locator(".kierunek")).toHaveText(oczekiwany.kierunek);
  await expect(pierwszy.locator(".maly")).toHaveText(oczekiwany.g);
  const za = +oczekiwany.g.slice(3) + (+oczekiwany.g.slice(0, 2) - 7) * 60;
  await expect(pierwszy.locator(".duzy")).toHaveText(`${za} min`);
  await expect(page.locator("#teraz")).toContainText("dzień powszedni");
  expect(bledy).toEqual([]);
});

test("odjazdy: widać kilka kursów bez przewijania na telefonie", async ({ page }) => {
  await otworz(page, "/?p=dworcowa");
  const widoczne = await page.evaluate(() =>
    [...document.querySelectorAll(".kurs")].filter((e) => e.getBoundingClientRect().bottom <= innerHeight).length);
  expect(widoczne).toBeGreaterThanOrEqual(4);
  const poziomyScroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(poziomyScroll).toBe(false);
});

test("dotknięcie kursu pokazuje trasę i link do PDF", async ({ page }) => {
  await otworz(page, "/?p=dworcowa");
  await page.locator(".kurs > button").first().click();
  const trasa = page.locator(".szczegoly .trasa li");
  await expect(trasa.first()).toContainText("Dworcowa");
  expect(await trasa.count()).toBeGreaterThan(3);
  await expect(page.locator(".szczegoly a", { hasText: "Tabliczka PDF" })).toHaveAttribute("href", /zkmb\.pl\/.+\.pdf$/);
});

test("wyszukiwarka działa bez polskich znaków", async ({ page }) => {
  await otworz(page, "/?p=dworcowa");
  await page.click("#wybierz");
  await page.fill("#szukaj-pole", "polcz petl");
  const wyniki = page.locator("#szukaj-wyniki .pozycja");
  await expect(wyniki).toHaveCount(1);
  await wyniki.first().click();
  await expect(page.locator("#nazwa-przystanku")).toHaveText("Połczyńska Pętla");
  await expect(page).toHaveURL(/p=polczynska(\+|%20)petla/);
});

test("ulubione i wybrany przystanek zostają po odświeżeniu", async ({ page }) => {
  await otworz(page, "/?p=komara");
  await page.click("#ulubiony");
  await expect(page.locator("#ulubiony")).toHaveText("★");
  await page.goto("/");
  await expect(page.locator("#nazwa-przystanku")).toHaveText("Komara");
  await page.click("#wybierz");
  await expect(page.locator("#szukaj-wyniki h3").first()).toHaveText("Ulubione");
});

test("przyjazdy działają na pętli bez własnej tabliczki", async ({ page }) => {
  const bledy = await otworz(page, "/?p=polczynska%20petla&t=przyjazdy");
  expect(await page.locator(".kurs").count()).toBeGreaterThan(0);
  await expect(page.locator(".kurs .maly").first()).toContainText("ok.");
  expect(bledy).toEqual([]);
});

test("rozkład: pełna tabliczka z bieżącą godziną", async ({ page }) => {
  await otworz(page, "/?p=dworcowa&t=rozklad");
  await expect(page.locator(".godz.teraz .h")).toHaveText("7");
  await page.locator(".tabliczka .chip", { has: page.locator('.linia[data-l="2"]') }).first().click();
  await expect(page.locator(".legenda")).toContainText("Kisielice");
  await page.locator(".dni .chip", { hasText: "Soboty" }).click();
  await expect(page.locator(".godz.teraz")).toHaveCount(0);
});

test("święto (25 grudnia) używa rozkładu niedzielnego", async ({ page }) => {
  await otworz(page, "/?p=dworcowa", new Date("2026-12-25T10:00:00+01:00"));
  await expect(page.locator("#teraz")).toContainText("sobota / niedziela / święto");
  const dane = await page.evaluate(() => window.ROZKLAD);
  const oczekiwany = pierwszyOdjazd(dane, "dworcowa", 10 * 60, "SN");
  await expect(page.locator(".kurs > button .maly").first()).toHaveText(oczekiwany.g);
});

test("późnym wieczorem pokazuje kursy na jutro", async ({ page }) => {
  await otworz(page, "/?p=dworcowa", new Date("2026-09-28T23:50:00+02:00"));
  await expect(page.locator(".kurs .tag", { hasText: "jutro" }).first()).toBeVisible();
});

test("wszystkie przystanki i zakładki otwierają się bez błędów", async ({ page }) => {
  const bledy = await otworz(page, "/");
  const klucze = await page.evaluate(() => Object.keys(window.ROZKLAD.przystanki));
  expect(klucze.length).toBeGreaterThan(40);
  for (const k of klucze) {
    for (const t of ["odjazdy", "przyjazdy", "rozklad"]) {
      await page.goto(`/?p=${encodeURIComponent(k)}&t=${t}`);
      const kurs = page.locator(".kurs > button").first();
      if (await kurs.count()) await kurs.click();
    }
  }
  expect(bledy).toEqual([]);
});

// ---------- Skąd / Dokąd: przystanek, adres lub moja lokalizacja ----------

// Photon (wyszukiwarka adresów) jest podstawiony, żeby testy nie zależały od zewnętrznego serwera.
async function podstawAdresy(page, odpowiedz) {
  await page.route("https://photon.komoot.io/**", (route) =>
    typeof odpowiedz === "function" ? odpowiedz(route) : route.fulfill({
      json: odpowiedz, headers: { "access-control-allow-origin": "*" },
    }));
}

function adres(nazwa, ulica, lat, lon) {
  return { type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] },
    properties: { name: nazwa, street: ulica, city: "Białogard", type: "house" } };
}

async function wybierz(page, pole, tekst, pozycja) {
  await page.click(pole === "skad" ? "#wybierz" : "#wybierz-cel");
  await page.fill("#szukaj-pole", tekst);
  await page.locator("#szukaj-wyniki .pozycja", { hasText: pozycja }).first().click();
}

test("skąd: 📍 wybiera najbliższy przystanek według lokalizacji", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await otworz(page, "/?p=komara");
  const [lat, lon] = await page.evaluate(() => window.PRZYSTANKI_GPS.dworcowa.p[0]);
  await context.setGeolocation({ latitude: lat, longitude: lon });
  await page.click("#wybierz");
  await page.getByText("Najbliższy przystanek (moja lokalizacja)").click();
  await expect(page.locator("#nazwa-przystanku")).toHaveText("📍 Moja lokalizacja");
  await expect(page.locator("#skad-opis")).toContainText("najbliższy przystanek: Dworcowa");
  await expect(page.locator("#info")).toContainText("Odjazdy z najbliższego przystanku");
  await expect(page.locator(".kurs").first()).toBeVisible();
});

test("skąd: bez zgody na lokalizację pokazuje zrozumiały komunikat", async ({ page }) => {
  await otworz(page, "/?p=komara");
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (ok, blad) => blad({ code: 1, message: "denied" });
  });
  await page.click("#wybierz");
  await page.getByText("Najbliższy przystanek (moja lokalizacja)").click();
  await expect(page.locator("#szukaj-wyniki")).toContainText("Brak zgody na lokalizację");
  await expect(page.locator("#nazwa-przystanku")).toHaveText("Komara");
});

test("skąd: adres ustawia odjazdy z najbliższego przystanku i przetrwa odświeżenie", async ({ page }) => {
  await otworz(page, "/?p=komara");
  const [lat, lon] = await page.evaluate(() => window.PRZYSTANKI_GPS.dworcowa.p[0]);
  await podstawAdresy(page, { features: [adres("Blok 1", "Kolejowa", lat + 0.0005, lon)] });
  await wybierz(page, "skad", "kolejowa 1", "Blok 1, Kolejowa");
  await expect(page.locator("#nazwa-przystanku")).toHaveText("🏠 Blok 1, Kolejowa");
  await expect(page.locator("#skad-opis")).toContainText("przystanek: Dworcowa");
  await page.goto(page.url());
  await expect(page.locator("#nazwa-przystanku")).toHaveText("🏠 Blok 1, Kolejowa");
});

test("dokąd: przystanek → połączenia z krokami", async ({ page }) => {
  await podstawAdresy(page, { features: [] });
  const bledy = await otworz(page, "/?p=dworcowa");
  await wybierz(page, "cel", "ciszewsk", "Ciszewskiego");
  await expect(page.locator("#nazwa-celu")).toHaveText("Ciszewskiego");
  await expect(page.locator('[data-tryb="odjazdy"]')).toHaveText("Połączenia");

  const opcje = page.locator("#lista .opcja button");
  await expect(opcje.first()).toBeVisible();
  await expect(opcje.first().locator(".kierunek")).toHaveText(/^Na miejscu \d\d:\d\d$/);
  await opcje.first().click();
  await expect(page.locator(".kroki")).toContainText("Wysiądź: Ciszewskiego");

  await page.click("#usun-cel");
  await expect(page.locator('[data-tryb="odjazdy"]')).toHaveText("Odjazdy");
  await expect(page.locator("#nazwa-celu")).toHaveText("Wybierz, żeby zobaczyć połączenia");
  expect(bledy).toEqual([]);
});

test("trasa kursu uwzględnia objaśnienia (żółty kurs omija Stamma Sklep)", async ({ page }) => {
  await otworz(page, "/?p=dworcowa");
  const kursy = page.locator(".kurs", { hasText: "Stamma / Zwinisław" });
  const zolty = kursy.filter({ has: page.locator(".znaczek.zolty") }).first();
  const zwykly = kursy.filter({ hasNot: page.locator(".znaczek.zolty") }).first();

  await zolty.locator("> button").click();
  await expect(zolty.locator(".trasa")).toContainText("Komara");
  await expect(zolty.locator(".trasa")).not.toContainText("Stamma Sklep");

  await zwykly.locator("> button").click();
  await expect(zwykly.locator(".trasa")).toContainText("Stamma Sklep");
});

test("dokąd: adres z wyszukiwarki i dojście pieszo", async ({ page }) => {
  await otworz(page, "/?p=dworcowa");
  const [lat, lon] = await page.evaluate(() => window.PRZYSTANKI_GPS.ciszewskiego.p[0]);
  // punkt ok. 200 m od przystanku Ciszewskiego
  await podstawAdresy(page, { features: [adres("Blok 7", "Testowa", lat + 0.0015, lon + 0.001)] });
  await wybierz(page, "cel", "testowa 7", "Blok 7, Testowa");
  await expect(page.locator("#nazwa-celu")).toHaveText("🏠 Blok 7, Testowa");
  const pierwsza = page.locator("#lista .opcja button").first();
  await expect(pierwsza).toBeVisible();
  await pierwsza.click();
  await expect(page.locator(".kroki")).toContainText("Dojdź do: Blok 7, Testowa");
});

test("⇅ zamienia skąd i dokąd", async ({ page }) => {
  await podstawAdresy(page, { features: [] });
  await otworz(page, "/?p=dworcowa");
  await expect(page.locator("#zamien")).toBeHidden();
  await wybierz(page, "cel", "komara", "Komara");
  await page.click("#zamien");
  await expect(page.locator("#nazwa-przystanku")).toHaveText("Komara");
  await expect(page.locator("#nazwa-celu")).toHaveText("Dworcowa");
});

test("gdy wyszukiwarka adresów nie działa, można wybrać przystanek", async ({ page }) => {
  await podstawAdresy(page, (route) => route.abort());
  await otworz(page, "/?p=dworcowa");
  await page.click("#wybierz-cel");
  await page.fill("#szukaj-pole", "komara");
  await expect(page.locator("#szukaj-wyniki")).toContainText("Wyszukiwarka adresów nie odpowiada");
  await expect(page.locator("#szukaj-wyniki .pozycja", { hasText: "Komara" }).first()).toBeVisible();
});

test("stopka pokazuje, kiedy sprawdzono zgodność z zkmb.pl", async ({ page }) => {
  await otworz(page, "/?p=dworcowa");
  const s = await page.evaluate(() => window.SPRAWDZONO);
  const [r, m, d] = s.data.split("-");
  await expect(page.locator("#wersja")).toContainText(`sprawdzono ${+d}.${m}.${r} o ${s.godzina}`);
});
