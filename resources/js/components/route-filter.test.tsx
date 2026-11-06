import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inertiaMock, router } from '@/test/inertia-mock';

vi.mock('@inertiajs/react', () => inertiaMock);

const { RouteFilter } = await import('@/components/route-filter');

const input = () => screen.getByRole('searchbox', { name: 'Filter routes' });

/** The URL of the last visit the filter asked for. */
const visited = () => {
    const call = router.get.mock.calls.at(-1);

    return call ? new URL(String(call[0]), 'https://laraowl.test') : null;
};

describe('route filter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.history.replaceState(
            {},
            '',
            '/archer/fastidious/requests?period=7d&sort=avg_duration&page=3',
        );
    });

    afterEach(() => vi.useRealTimers());

    it('asks for the filtered list once typing pauses, back on page one', () => {
        render(<RouteFilter value={null} />);

        fireEvent.change(input(), { target: { value: '/a' } });
        fireEvent.change(input(), { target: { value: '/admin/*' } });

        expect(router.get).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(250));

        expect(router.get).toHaveBeenCalledTimes(1);
        expect(visited()?.pathname).toBe('/archer/fastidious/requests');
        expect(visited()?.searchParams.get('filter')).toBe('/admin/*');
        expect(visited()?.searchParams.get('period')).toBe('7d');
        expect(visited()?.searchParams.get('sort')).toBe('avg_duration');
        expect(visited()?.searchParams.has('page')).toBe(false);
        expect(router.get.mock.calls[0][2]).toMatchObject({
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    });

    it('starts from the filter the page was answered with', () => {
        render(<RouteFilter value="POST /api/*" />);

        expect(input()).toHaveProperty('value', 'POST /api/*');

        act(() => vi.advanceTimersByTime(1000));

        expect(router.get).not.toHaveBeenCalled();
    });

    it('drops the filter with Escape or the clear button', () => {
        render(<RouteFilter value="/admin/*" />);

        fireEvent.keyDown(input(), { key: 'Escape' });
        act(() => vi.advanceTimersByTime(250));

        expect(input()).toHaveProperty('value', '');
        expect(visited()?.searchParams.has('filter')).toBe(false);

        fireEvent.change(input(), { target: { value: 'ideas' } });
        act(() => vi.advanceTimersByTime(250));
        fireEvent.click(
            screen.getByRole('button', { name: 'Clear the route filter' }),
        );
        act(() => vi.advanceTimersByTime(250));

        expect(input()).toHaveProperty('value', '');
        expect(visited()?.searchParams.has('filter')).toBe(false);
        expect(router.get).toHaveBeenCalledTimes(3);
    });

    it('does not ask again for spaces around the same filter', () => {
        render(<RouteFilter value="/admin/*" />);

        fireEvent.change(input(), { target: { value: '/admin/*  ' } });
        act(() => vi.advanceTimersByTime(250));

        expect(router.get).not.toHaveBeenCalled();
    });
});
