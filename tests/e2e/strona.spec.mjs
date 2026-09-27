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

test("dokąd jadę: tylko kursy przez Kisielice (oznaczenie k)", async ({ page }) => {
  await otworz(page, "/?p=dworcowa");
  await page.locator("#filtry .chip", { hasText: "Dokąd jadę?" }).click();
  await page.fill("#cel-pole", "kisielice");
  await page.locator("#cel-wyniki .pozycja", { hasText: /^Kisielice/ }).first().click();
  const kursy = page.locator(".kurs > button");
  expect(await kursy.count()).toBeGreaterThan(0);
  for (const kurs of await kursy.all()) {
    await expect(kurs.locator(".znaczek", { hasText: "k" })).toHaveCount(1);
  }
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
