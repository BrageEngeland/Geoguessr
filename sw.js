const CACHE_NAME = "telefonkoder-v5";
const APP_SHELL = [
  "/",
  "/main",
  "/lookup",
  "/pinpoint",
  "/quiz",
  "/stats",
  "/static/lookup.css",
  "/static/lookup.js",
  "/static/pinpoint.css",
  "/static/pinpoint.js",
  "/static/quiz.css",
  "/static/quiz.js",
  "/static/stats.css",
  "/static/stats.js",
  "/static/manifest.webmanifest",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/icon.svg"
];

self.addEventListener("install", (event) => {
  console.log("[SW] install event - cache version:", CACHE_NAME);
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;

const networkFirst = (request) => {
  return fetch(request)
    .then((response) => {
      if (response && response.ok && isSameOrigin(request)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request));
};

self.addEventListener("activate", (event) => {
  console.log("[SW] activate event - cleaning old caches, keeping:", CACHE_NAME);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

console.log("[SW] Loaded service worker with cache", CACHE_NAME);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  const acceptHeader = request.headers.get("accept") || "";
  const isHTMLRequest = request.mode === "navigate" || acceptHeader.includes("text/html");
  const assetDestinations = ["script", "style", "worker"];
  const isCriticalAsset = assetDestinations.includes(request.destination);
  const isMapAsset = request.url.includes("/static/maps/");

  if (isHTMLRequest || isCriticalAsset || isMapAsset) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
