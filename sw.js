// Service Worker: App-Hülle für Offline/Installation. Daten immer frisch vom Netz (Fallback: letzter Stand).
const CACHE = "jobsuche-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(url.pathname.endsWith("jobs.json") ? new Request("data/jobs.json") : e.request, copy)); }
    return r;
  }).catch(() => caches.match(url.pathname.endsWith("jobs.json") ? "data/jobs.json" : e.request)));
});
