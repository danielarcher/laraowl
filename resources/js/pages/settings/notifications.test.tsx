import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as PwaLib from '@/lib/pwa';
import { inertiaMock, router } from '@/test/inertia-mock';

type PwaModule = typeof PwaLib;

vi.mock('@inertiajs/react', () => inertiaMock);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/pwa', async (original) => ({
    ...(await original<PwaModule>()),
    pushSupport: vi.fn(() => 'supported'),
    currentSubscription: vi.fn(async () => null),
    subscribe: vi.fn(async () => ({
        endpoint: 'https://push.test/me',
        keys: { p256dh: 'p', auth: 'a' },
        content_encoding: 'aes128gcm',
        device: 'Chrome on Linux',
    })),
    unsubscribe: vi.fn(async () => {}),
    isIos: () => false,
}));

const { default: Notifications, deviceStateFor } =
    await import('@/pages/settings/notifications');
const pwa = await import('@/lib/pwa');

const apps = [
    {
        id: 1,
        name: 'Shop',
        team: 'Archer',
        settings_url: '/archer/shop/settings',
        rules_count: 3,
        push_enabled: false,
    },
    {
        id: 2,
        name: 'Blog',
        team: 'Archer',
        settings_url: '/archer/blog/settings',
        rules_count: 0,
        push_enabled: true,
    },
];

beforeEach(() => {
    vi.stubGlobal('Notification', { permission: 'default' });
});

describe('notifications settings', () => {
    it('offers to turn push on, and sends the subscription to the server', async () => {
        render(<Notifications vapidPublicKey="key" devices={[]} apps={apps} />);

        const button = await screen.findByRole('button', {
            name: /turn on push/i,
        });
        await userEvent.click(button);

        await waitFor(() =>
            expect(router.post).toHaveBeenCalledWith(
                '/settings/notifications/devices',
                expect.objectContaining({
                    endpoint: 'https://push.test/me',
                    device: 'Chrome on Linux',
                }),
                expect.anything(),
            ),
        );
    });

    it('lists each app with its rules and switches push per app', async () => {
        render(<Notifications vapidPublicKey="key" devices={[]} apps={apps} />);

        expect(screen.getByText('3 alert rules')).toBeTruthy();
        expect(screen.getByText('1 of 2 apps')).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'add one' }).getAttribute('href'),
        ).toBe('/archer/blog/settings');

        await userEvent.click(
            screen.getByRole('switch', { name: 'Push alerts from Shop' }),
        );

        expect(router.put).toHaveBeenCalledWith(
            '/settings/notifications/apps/1',
            { enabled: true },
            expect.anything(),
        );
    });

    it('marks this device in the list and lets you send a test', async () => {
        vi.mocked(pwa.currentSubscription).mockResolvedValue({
            endpoint: 'https://push.test/me',
        } as PushSubscription);
        const hash = await pwa.sha256Hex('https://push.test/me');

        render(
            <Notifications
                vapidPublicKey="key"
                devices={[
                    {
                        id: 7,
                        device: 'Chrome on Linux',
                        endpoint_hash: hash,
                        last_used_at: null,
                        created_at: '2026-11-03T10:00:00Z',
                    },
                ]}
                apps={apps}
            />,
        );

        expect(await screen.findByText('This device')).toBeTruthy();
        expect(screen.getByText(/Added 03\/11\/2026/)).toBeTruthy();

        await userEvent.click(
            screen.getByRole('button', { name: /send test/i }),
        );
        expect(router.post).toHaveBeenCalledWith(
            '/settings/notifications/test',
            {},
            expect.anything(),
        );
    });

    it('explains when the server has no push keys', async () => {
        render(<Notifications vapidPublicKey={null} devices={[]} apps={[]} />);

        expect(await screen.findByText(/push not set up/i)).toBeTruthy();
        expect(screen.queryByRole('button', { name: /turn on push/i })).toBe(
            null,
        );
        expect(screen.getByText('No apps yet.')).toBeTruthy();
    });
});

describe('deviceStateFor', () => {
    it.each([
        [
            {
                support: 'needs-install',
                configured: true,
                permission: null,
                subscribed: false,
            },
            'needs-install',
        ],
        [
            {
                support: 'unsupported',
                configured: true,
                permission: null,
                subscribed: false,
            },
            'unsupported',
        ],
        [
            {
                support: 'supported',
                configured: false,
                permission: 'default',
                subscribed: false,
            },
            'not-configured',
        ],
        [
            {
                support: 'supported',
                configured: true,
                permission: 'denied',
                subscribed: false,
            },
            'blocked',
        ],
        [
            {
                support: 'supported',
                configured: true,
                permission: 'granted',
                subscribed: true,
            },
            'on',
        ],
        [
            {
                support: 'supported',
                configured: true,
                permission: 'granted',
                subscribed: false,
            },
            'off',
        ],
    ] as const)('%o → %s', (input, expected) => {
        expect(deviceStateFor(input)).toBe(expected);
    });
});
