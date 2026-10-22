// Bei jeder Änderung an App-Dateien VERSION erhöhen – die neue Version installiert sich dann selbst.
const VERSION = '0.6.5';
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
  // Neue Version sofort aktivieren, statt zu warten, bis alle Fenster geschlossen sind.
  // cache: 'reload' umgeht den Browser-Zwischenspeicher – sonst landen alte Dateien in der neuen Version.
  event.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
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

// Online: App-Dateien immer frisch vom Server holen (und für offline aufheben).
// Offline oder nach 4 Sekunden ohne Antwort: die gespeicherte Version nehmen.
function networkFirst(req) {
  const key = req.mode === 'navigate' ? 'index.html' : req;
  const fromNet = fetch(req, { cache: 'no-store' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
  return Promise.race([fromNet, timeout]).catch(() =>
    caches.match(key, { ignoreSearch: true }).then(hit => hit || fromNet));
}

// Große oder unveränderliche Dateien (Symbole, USDA-Datenbank): aus dem Speicher, sonst einmal laden
function cacheFirst(req) {
  return caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const stable = url.pathname.includes('/icons/') || url.pathname.endsWith('/data/usda.json');
  event.respondWith(stable ? cacheFirst(req) : networkFirst(req));
});
