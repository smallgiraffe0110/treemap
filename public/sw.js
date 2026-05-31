const CACHE = "treemap-shell-v1";
const APP_SHELL = ["/", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Network-first for HTML navigations (so updates land), cache fallback offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/").then((r) => r || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }
  // Cache-first for known static assets
  if (/\.(png|jpg|webp|svg|ico|woff2|webmanifest)$/.test(new URL(req.url).pathname)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req)
            .then((resp) => {
              const copy = resp.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
              return resp;
            })
            .catch(() => caches.match("/"))
      )
    );
  }
});
