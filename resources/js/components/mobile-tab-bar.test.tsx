import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { inertiaMock, page } from '@/test/inertia-mock';

const setOpenMobile = vi.fn();

vi.mock('@inertiajs/react', () => inertiaMock);
vi.mock('@/components/ui/sidebar', () => ({
    useSidebar: () => ({ setOpenMobile }),
}));

const { MobileTabBar } = await import('@/components/mobile-tab-bar');

describe('mobile tab bar', () => {
    it('links the main places for the current team and app, keeping the period', () => {
        page.url = '/archer/servers';
        page.props = {
            currentTeam: { slug: 'archer' },
            currentProject: { slug: 'shop' },
            period: '24h',
        };

        render(<MobileTabBar />);

        const href = (name: string) =>
            screen.getByRole('link', { name }).getAttribute('href');

        expect(href('Overview')).toBe('/archer/overview?period=24h');
        expect(href('App')).toBe('/archer/shop/dashboard?period=24h');
        expect(href('Servers')).toBe('/archer/servers');
        expect(href('Issues')).toBe('/archer/shop/issues?period=24h');
        expect(
            screen
                .getByRole('link', { name: 'Servers' })
                .getAttribute('aria-current'),
        ).toBe('page');
    });

    it('opens the full menu from More', () => {
        page.url = '/archer/overview';
        page.props = {
            currentTeam: { slug: 'archer' },
            projects: [{ slug: 'shop' }],
        };

        render(<MobileTabBar />);
        fireEvent.click(screen.getByRole('button', { name: 'More' }));

        expect(setOpenMobile).toHaveBeenCalledWith(true);
    });

    it('stays out of the way without a team', () => {
        page.props = {};
        const { container } = render(<MobileTabBar />);

        expect(container.innerHTML).toBe('');
    });
});
