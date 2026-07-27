/* Foco · Hábitos — service worker (PWA)
   Estratégia segura para um app single-file que muda com frequência:
   - Navegação (abrir o app): network-first -> sempre pega o index.html mais novo quando online;
     se estiver offline, cai no cache (app abre mesmo sem internet).
   - Supabase (dados do usuário): NUNCA passa pelo cache. Sempre rede.
   - Demais GET (CDNs: fontes, ícones Tabler, supabase-js): stale-while-revalidate.
   Bump CACHE quando quiser forçar limpeza do cache antigo. */
var CACHE = 'foco-v2';
var SHELL = ['./', './index.html', './manifest.json',
             './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll falha tudo se 1 recurso falhar; usamos add individual tolerante
      return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       // não toca em POST/PUT/etc.
  var url = new URL(req.url);

  // Dados do usuário: deixa passar direto, sem cache.
  if (/supabase\.(co|in)/.test(url.hostname)) return;

  // Abrir o app: network-first com fallback pro cache (offline).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (m) { return m || caches.match('./'); });
      })
    );
    return;
  }

  // Outros recursos (CDNs estáticos): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});

// ===== Web Push =====
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Foco', body: (e.data && e.data.text()) || '' }; }
  var title = d.title || 'Foco';
  var opts = {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.tag || 'foco',
    renotify: true,
    data: { url: d.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf('/Foco') >= 0 && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
