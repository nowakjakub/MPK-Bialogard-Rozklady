// Tryb offline: najpierw sieć (żeby zawsze mieć świeży rozkład), a bez internetu – kopia z pamięci.
var PAMIEC = "autobusy-v2";
var PLIKI = ["./", "index.html", "styl.css", "app.js", "data/rozklad.js", "data/przystanki_gps.js", "manifest.webmanifest",
  "ikony/ikona.svg", "ikony/ikona-192.png", "ikony/ikona-180.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(PAMIEC).then(function (c) { return c.addAll(PLIKI); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (klucze) {
    return Promise.all(klucze.filter(function (k) { return k !== PAMIEC; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (odp) {
    var kopia = odp.clone();
    caches.open(PAMIEC).then(function (c) { c.put(e.request, kopia); });
    return odp;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true });
  }));
});
