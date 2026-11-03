import { describe, expect, it } from 'vitest';
import { deviceLabel, urlBase64ToUint8Array } from '@/lib/pwa';

describe('deviceLabel', () => {
    it.each([
        [
            'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
            'Chrome on Android',
        ],
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
            'Safari on iPhone',
        ],
        [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0',
            'Edge on Windows',
        ],
        [
            'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
            'Firefox on Linux',
        ],
    ])('names %s', (userAgent, label) => {
        expect(deviceLabel(userAgent)).toBe(label);
    });
});

describe('urlBase64ToUint8Array', () => {
    it('decodes the URL-safe VAPID key into the 65-byte public key', () => {
        const bytes = urlBase64ToUint8Array(
            'BI59XgxWF4mFcuDV34qBsQoE5pQtcWwaYCKg0dKZAiM6OTt00M2nFhd527Jt-ixGyTGeo9nZw0n3uEkQjpqkOoQ',
        );

        expect(bytes).toHaveLength(65);
        expect(bytes[0]).toBe(4);
    });
});
