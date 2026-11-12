const CACHE = "einkaufshelfer-v2";
const LIB = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
const FILES = [
  "./", "index.html", "app.js", "manifest.webmanifest",
  "icon-180.png", "icon-192.png", "icon-512.png", "favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES).then(() => c.add(new Request(LIB, { mode: "cors" })).catch(() => {})))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Scanner-Bibliothek: einmal laden, dann immer aus dem Speicher (ändert sich nie).
  if (url.href === LIB) {
    e.respondWith(
      caches.match(LIB).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(LIB, copy));
        return res;
      }))
    );
    return;
  }

  // Eigene Dateien: erst Netz (für Updates), sonst Speicher. Produktsuche geht direkt ins Netz.
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
