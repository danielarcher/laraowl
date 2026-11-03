import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { inertiaMock, router } from '@/test/inertia-mock';

vi.mock('@inertiajs/react', () => inertiaMock);

const { PullToRefresh } = await import('@/components/pull-to-refresh');

const pull = (distance: number) => {
    act(() => {
        fireEvent.touchStart(window, { touches: [{ clientY: 100 }] });
        fireEvent.touchMove(window, { touches: [{ clientY: 100 + distance }] });
        fireEvent.touchEnd(window);
    });
};

describe('pull to refresh', () => {
    it('reloads the page data after a long enough pull', () => {
        render(<PullToRefresh enabled />);

        pull(200);

        expect(router.reload).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('status').textContent).toContain('Refreshing');
    });

    it('springs back without reloading on a short pull', () => {
        render(<PullToRefresh enabled />);

        pull(60);

        expect(router.reload).not.toHaveBeenCalled();
        expect(screen.queryByRole('status')).toBe(null);
    });

    it('does nothing in a normal browser tab', () => {
        render(<PullToRefresh enabled={false} />);

        pull(200);

        expect(router.reload).not.toHaveBeenCalled();
    });
});
