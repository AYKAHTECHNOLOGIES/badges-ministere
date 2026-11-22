/* Fonctionne hors connexion après la première ouverture. */
var CACHE = 'badges-v1';
var FICHIERS = ['./', 'index.html', 'manifest.json', 'js/app.js', 'js/badge.js', 'js/signature.js', 'lib/jspdf.umd.min.js', 'lib/qrcode.js', 'img/armoiries.png', 'img/icon-192.png', 'img/icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); })); })); self.clients.claim(); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (k) { k.put(e.request, c); }); return r; }).catch(function () { return caches.match(e.request); }));
});
