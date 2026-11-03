/**
 * The installable-app side of LaraOwl: service worker, install prompt,
 * push subscriptions and the app badge.
 */

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type PushSupport =
    | 'supported'
    // iPhone/iPad Safari: push exists only inside the Home Screen app.
    | 'needs-install'
    | 'unsupported';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

const notifyInstall = () => installListeners.forEach((listener) => listener());

export function isStandalone(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return (
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

export function isIos(userAgent = navigator.userAgent): boolean {
    return (
        /iphone|ipad|ipod/i.test(userAgent) ||
        // iPadOS reports itself as a Mac with touch.
        (/macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)
    );
}

export function pushSupport(): PushSupport {
    if (typeof window === 'undefined') {
        return 'unsupported';
    }

    const hasApis =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

    if (hasApis) {
        return 'supported';
    }

    return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
}

/**
 * A short, human name for this browser, shown in the device list.
 */
export function deviceLabel(userAgent = navigator.userAgent): string {
    const browser = /edg\//i.test(userAgent)
        ? 'Edge'
        : /firefox|fxios/i.test(userAgent)
          ? 'Firefox'
          : /chrome|crios|chromium/i.test(userAgent)
            ? 'Chrome'
            : /safari/i.test(userAgent)
              ? 'Safari'
              : 'Browser';

    const platform = /iphone/i.test(userAgent)
        ? 'iPhone'
        : /ipad/i.test(userAgent)
          ? 'iPad'
          : /android/i.test(userAgent)
            ? 'Android'
            : /mac os x|macintosh/i.test(userAgent)
              ? 'Mac'
              : /windows/i.test(userAgent)
                ? 'Windows'
                : /linux/i.test(userAgent)
                  ? 'Linux'
                  : 'Unknown device';

    return `${browser} on ${platform}${isStandalone() ? ' · app' : ''}`;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));

    for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
    }

    return bytes;
}

export async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text),
    );

    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        return null;
    }

    return (
        (await navigator.serviceWorker.getRegistration('/')) ??
        (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
    );
}

export async function currentSubscription(): Promise<PushSubscription | null> {
    const reg = await registration();

    return (await reg?.pushManager.getSubscription()) ?? null;
}

export type SubscriptionPayload = {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    content_encoding: string;
    device: string;
};

/**
 * Ask for permission and subscribe this browser. Returns what the server stores.
 */
export async function subscribe(
    vapidPublicKey: string,
): Promise<SubscriptionPayload> {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
        throw new Error(
            permission === 'denied'
                ? 'Notifications are blocked for this site. Allow them in the browser settings.'
                : 'Notifications were not allowed.',
        );
    }

    const reg = await registration();

    if (!reg) {
        throw new Error('This browser cannot run the LaraOwl app.');
    }

    await navigator.serviceWorker.ready;

    const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

    const json = subscription.toJSON();
    const encodings = (
        PushManager as unknown as { supportedContentEncodings?: string[] }
    ).supportedContentEncodings;

    return {
        endpoint: subscription.endpoint,
        keys: {
            p256dh: json.keys?.p256dh ?? '',
            auth: json.keys?.auth ?? '',
        },
        content_encoding: encodings?.includes('aes128gcm')
            ? 'aes128gcm'
            : (encodings?.[0] ?? 'aes128gcm'),
        device: deviceLabel(),
    };
}

export async function unsubscribe(): Promise<void> {
    await (await currentSubscription())?.unsubscribe();
}

export function canPromptInstall(): boolean {
    return deferredPrompt !== null;
}

export function onInstallAvailabilityChange(listener: () => void): () => void {
    installListeners.add(listener);

    return () => installListeners.delete(listener);
}

export async function promptInstall(): Promise<boolean> {
    if (!deferredPrompt) {
        return false;
    }

    const prompt = deferredPrompt;
    deferredPrompt = null;
    notifyInstall();

    await prompt.prompt();

    return (await prompt.userChoice).outcome === 'accepted';
}

export function clearBadge(): void {
    navigator.serviceWorker?.controller?.postMessage({
        type: 'laraowl:clear-badge',
    });
    (navigator as Navigator & { clearAppBadge?: () => Promise<void> })
        .clearAppBadge?.()
        .catch(() => {});
}

/**
 * Keep the browser chrome the colour of the theme in use, not just the OS's.
 */
export function syncThemeColor(): void {
    const dark = document.documentElement.classList.contains('dark');
    const colour = dark ? '#0a0a0a' : '#ffffff';

    document
        .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
        .forEach((meta) => {
            meta.content = colour;
            meta.removeAttribute('media');
        });
}

export type PushMessage = {
    type: 'laraowl:push';
    title: string;
    body: string;
    data?: { url?: string };
};

/**
 * Register the service worker and wire the app-wide bits. Call once on boot.
 */
export function initPwa(onPush: (message: PushMessage) => void): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event as BeforeInstallPromptEvent;
        notifyInstall();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        notifyInstall();
    });

    syncThemeColor();
    new MutationObserver(syncThemeColor).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
    });

    if (!('serviceWorker' in navigator)) {
        return;
    }

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'laraowl:push') {
            onPush(event.data as PushMessage);
        }
    });

    const clearWhenVisible = () => {
        if (document.visibilityState === 'visible') {
            clearBadge();
        }
    };

    document.addEventListener('visibilitychange', clearWhenVisible);
    clearWhenVisible();
}
