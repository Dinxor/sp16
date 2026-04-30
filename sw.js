// Service Worker for максимально агрессивного offline-кэширования (включая картинки)
// NOTE: this app is served from /sp16/ (GitHub Pages / subpath), so we scope URLs accordingly.

const CACHE_VERSION = 'v4';
const CACHE_NAME = `spotit-${CACHE_VERSION}`;

// Use explicit files; avoid caching the directory URL `/sp16/` because it can 404 on some dev servers.
const APP_SHELL = [
    '/sp16/index.html',
    '/sp16/game.js',
    '/sp16/manifest.json',
    '/sp16/sw.js',
    '/sp16/mini.json',
    '/sp16/icons/icon-192.png',
    '/sp16/icons/icon-512.png'
];

// Generate paths to 16 card images
const IMAGE_FILES = Array.from({ length: 16 }, (_, i) => `/sp16/images/${i}.jpg`);

const PRECACHE_URLS = [...APP_SHELL, ...IMAGE_FILES];

function isSameOrigin(url) {
    return url.origin === self.location.origin;
}

function isUnderAppScope(url) {
    return url.pathname.startsWith('/sp16/');
}

function isCacheableResponse(res) {
    // We only cache successful, non-opaque responses
    return !!res && res.ok && (res.type === 'basic' || res.type === 'default');
}

// Network-first for navigations (so HTML updates when online), cache fallback when offline.
async function networkFirst(req) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const fresh = await fetch(req);
        if (isCacheableResponse(fresh)) await cache.put(req, fresh.clone());
        return fresh;
    } catch {
        return (await cache.match(req)) || (await cache.match('/sp16/index.html')) || Response.error();
    }
}

// Cache-first for static assets (JS/CSS/images/json/etc.), with background update.
async function cacheFirstStaleWhileRevalidate(req) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    const fetchPromise = (async () => {
        try {
            const fresh = await fetch(req);
            if (isCacheableResponse(fresh)) await cache.put(req, fresh.clone());
            return fresh;
        } catch {
            return null;
        }
    })();

    // If we have cached, return it immediately; still attempt to update cache in background.
    if (cached) {
        eventLoopDrain(fetchPromise);
        return cached;
    }

    const fresh = await fetchPromise;
    if (fresh) return fresh;

    // Offline fallback for images
    if (req.destination === 'image') {
        return (await cache.match('/sp16/icons/icon-192.png')) || Response.error();
    }

    return Response.error();
}

function eventLoopDrain(p) {
    // best-effort: avoid unhandledrejection
    p && p.catch(() => void 0);
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // cache.addAll() fails the whole install if ANY single request fails.
            // To make installation robust, we add items one-by-one.
            await Promise.allSettled(
                PRECACHE_URLS.map(async (url) => {
                    const req = new Request(url, { cache: 'reload' });
                    const res = await fetch(req);
                    if (isCacheableResponse(res)) {
                        await cache.put(req, res);
                    }
                })
            );

            await self.skipWaiting();
        })()
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
            await self.clients.claim();
        })()
    );
});

self.addEventListener('message', (event) => {
    if (!event.data) return;
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Only handle GET
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Only same-origin requests (avoid opaque/cors issues)
    if (!isSameOrigin(url)) return;

    // Only handle requests within app scope (/sp16/)
    if (!isUnderAppScope(url)) return;

    // Navigation: network-first (fresh HTML when online), cached fallback when offline
    if (req.mode === 'navigate') {
        event.respondWith(networkFirst(req));
        return;
    }

    // Aggressive caching for all other assets (incl. images)
    event.respondWith(cacheFirstStaleWhileRevalidate(req));
});
