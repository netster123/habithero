// Bei jeder Änderung an App-Dateien VERSION erhöhen – dann zeigt die App „Neue Version verfügbar“.
const VERSION = '0.6.1';
const CACHE = `habithero-${VERSION}`;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/time.js',
  'js/progress.js',
  'js/views.js',
  'js/icons.js',
  'js/util.js',
  'js/chart.js',
  'js/rauchfrei.js',
  'js/install.js',
  'js/training.js',
  'js/foods.js',
  'js/recipes.js',
  'js/essen.js',
  'js/schlaf.js',
  'data/foods-de.json',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('habithero-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Offline zuerst: App-Dateien kommen aus dem Cache
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        // Die große USDA-Datei wird erst bei der ersten Online-Suche geladen und dann offline aufbewahrt
        if (res.ok && new URL(req.url).pathname.endsWith('/data/usda.json')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        if (res.ok && req.mode === 'navigate') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('index.html', copy));
        }
        return res;
      }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error());
    })
  );
});
