const CACHE_NAME = 'spotit-v1';
const STATIC_FILES = [
    '.',
    'index.html',
    'game.js',
    'manifest.json',
    'mini.json',
    'icon-192.png',
    'icon-512.png'
];
// Генерируем пути к 16 картинкам
const IMAGE_FILES = Array.from({length: 16}, (_, i) => `images/${i}.jpg`);

const ALL_FILES = [...STATIC_FILES, ...IMAGE_FILES];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ALL_FILES))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
});