/*
 * LaraOwl service worker.
 *
 * Caches only what never changes (hashed build assets, fonts, icons) and the
 * offline page. Pages and data always come from the network: a monitoring
 * tool must never show yesterday's numbers as if they were live.
 */
const VERSION = 'v1';
const SHELL = `laraowl-shell-${VERSION}`;
const ASSETS = `laraowl-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const ASSET_LIMIT = 80;

const PRECACHE = [
    OFFLINE_URL,
    '/icons/icon-192.png',
    '/icons/badge-96.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(SHELL)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter(
                            (key) =>
                                key.startsWith('laraowl-') &&
                                key !== SHELL &&
                                key !== ASSETS,
                        )
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

const isImmutableAsset = (url) =>
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/build/assets/') ||
        url.pathname.startsWith('/icons/'));

async function trim(cacheName) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    for (const key of keys.slice(0, Math.max(0, keys.length - ASSET_LIMIT))) {
        await cache.delete(key);
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(ASSETS);
    const hit = await cache.match(request);

    if (hit) {
        return hit;
    }

    const response = await fetch(request);

    if (response.ok) {
        await cache.put(request, response.clone());
        trim(ASSETS);
    }

    return response;
}

async function networkOrOffline(request) {
    try {
        return await fetch(request);
    } catch (error) {
        const offline = await caches.match(OFFLINE_URL);

        if (offline) {
            return offline;
        }

        throw error;
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    if (isImmutableAsset(url)) {
        event.respondWith(cacheFirst(request));

        return;
    }

    // Full page loads only; Inertia visits (XHR) fail loudly in the app instead.
    if (request.mode === 'navigate') {
        event.respondWith(networkOrOffline(request));
    }
});

async function syncBadge() {
    if (!('setAppBadge' in self.navigator)) {
        return;
    }

    const open = await self.registration.getNotifications();

    try {
        if (open.length > 0) {
            await self.navigator.setAppBadge(open.length);
        } else {
            await self.navigator.clearAppBadge();
        }
    } catch {
        // Badging is a nicety; some platforms refuse it outside an installed app.
    }
}

self.addEventListener('push', (event) => {
    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: 'LaraOwl', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'LaraOwl';
    const options = {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        tag: data.tag,
        renotify: Boolean(data.tag),
        timestamp: data.at || Date.now(),
        data: { url: data.url || '/dashboard' },
    };

    event.waitUntil(
        (async () => {
            await self.registration.showNotification(title, options);
            await syncBadge();

            // An open, visible app shows the alert in place as well.
            const windows = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });

            for (const client of windows) {
                client.postMessage({ type: 'laraowl:push', title, ...options });
            }
        })(),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const target = new URL(
        event.notification.data?.url || '/dashboard',
        self.location.origin,
    ).href;

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });
            const existing = windows.find(
                (client) => new URL(client.url).origin === self.location.origin,
            );

            if (existing) {
                await existing.focus();

                if ('navigate' in existing && existing.url !== target) {
                    await existing.navigate(target);
                }
            } else {
                await self.clients.openWindow(target);
            }

            await syncBadge();
        })(),
    );
});

self.addEventListener('notificationclose', (event) => {
    event.waitUntil(syncBadge());
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'laraowl:clear-badge') {
        event.waitUntil(
            (async () => {
                const open = await self.registration.getNotifications();
                open.forEach((n) => n.close());
                await syncBadge();
            })(),
        );
    }
});
