// Service Worker for offline-first caching
// NOTE: this app is served from /sp16/ (GitHub Pages / subpath), so we scope URLs accordingly.

const CACHE_VERSION = 'v3';
const CACHE_NAME = `spotit-${CACHE_VERSION}`;

// Use explicit files; avoid caching the directory URL `/sp16/` because it can 404 on some dev servers.
const APP_SHELL = [
    '/sp16/index.html',
    '/sp16/game.js',
    '/sp16/manifest.json',
    '/sp16/sw.js',
    '/sp16/icons/icon-192.png',
    '/sp16/icons/icon-512.png'
];

// Also precache mini.json because the game fetches it at runtime
const DATA_FILES = [
    '/sp16/mini.json'
];

// Generate paths to 16 card images
const IMAGE_FILES = Array.from({ length: 16 }, (_, i) => `/sp16/images/${i}.jpg`);

const ALL_FILES = [...APP_SHELL, ...DATA_FILES, ...IMAGE_FILES];

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // cache.addAll() fails the whole install if ANY single request fails.
            // To make installation robust, we add items one-by-one.
            const results = await Promise.allSettled(
                ALL_FILES.map(async (url) => {
                    const req = new Request(url, { cache: 'reload' });
                    const res = await fetch(req);
                    await cache.put(req, res);
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
    if (url.origin !== self.location.origin) return;

    // Navigation: serve cached index.html for offline
    if (req.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const fresh = await fetch(req);
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(req, fresh.clone());
                    return fresh;
                } catch {
                    return (await caches.match('/sp16/index.html')) || Response.error();
                }
            })()
        );
        return;
    }

    // Static assets: cache-first, then network, then offline fallback
    event.respondWith(
        (async () => {
            const cached = await caches.match(req);
            if (cached) return cached;

            try {
                const fresh = await fetch(req);
                // Cache successful basic responses
                if (fresh && (fresh.status === 200 || fresh.type === 'basic')) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(req, fresh.clone());
                }
                return fresh;
            } catch {
                // Optional: fallback for images
                if (req.destination === 'image') {
                    return (await caches.match('/sp16/icons/icon-192.png')) || Response.error();
                }
                return Response.error();
            }
        })()
    );
});
