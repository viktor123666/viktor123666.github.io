/* Scalelist VIDEOSHOWER service worker — offline freedom.
   Strategy:
   - shell (videos.html, embed, data, manifest, icons): network-first, cache fallback
   - YouTube thumbnails (i.ytimg.com): cache-first (tiny files, immutable per id)
   - everything else (api/, vault, dashboards): network only — never cached  */
const SHELL = 'vs-shell-v2';
const THUMBS = 'vs-thumbs-v1';
const SHELL_URLS = ['/videos.html', '/videoshower_data.js', '/videoshower_mirror.js',
                    '/videoshower_embed.html', '/manifest.webmanifest', '/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c =>
    Promise.allSettled(SHELL_URLS.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== SHELL && k !== THUMBS).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // thumbnails: cache-first
  if (url.hostname === 'i.ytimg.com') {
    e.respondWith(
      caches.open(THUMBS).then(c => c.match(e.request).then(hit => hit ||
        fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; })
      )).catch(() => new Response('', {status: 408}))
    );
    return;
  }

  // shell: network-first with cache fallback (so updates land, offline still works)
  if (url.origin === location.origin && SHELL_URLS.includes(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(SHELL).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request, {ignoreSearch: true}))
    );
    return;
  }
  // everything else: untouched (network)
});
