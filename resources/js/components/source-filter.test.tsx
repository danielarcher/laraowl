import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { inertiaMock } from '@/test/inertia-mock';

vi.mock('@inertiajs/react', () => inertiaMock);

const { SourceFilter, columnTop } = await import('@/components/source-filter');

const allSources = ['human', 'search', 'ai', 'monitor', 'bot'];

/** One point an hour, humans only. */
const hourly = (counts: number[]) =>
    counts.map((human, index) => ({ t: 1_800_000_000 + index * 3600, human }));

function columns() {
    const chart = screen.getByLabelText(
        'Requests per traffic source over the period',
    );

    return Array.from(
        chart.querySelectorAll<HTMLElement>('[data-slot-column]'),
    ).map((column) => {
        const stack = column.firstElementChild as HTMLElement;

        return {
            height: stack.style.height,
            clipped: stack.querySelector('[data-clipped]') !== null,
            title: column.getAttribute('title') ?? '',
        };
    });
}

describe('traffic timeline', () => {
    it('draws quiet and busy hours in their true proportions', () => {
        // A day/night cycle like fasti's: 3k at night, 13.5k at peak.
        render(
            <SourceFilter
                selected={allSources}
                totals={{ human: 33_000 }}
                series={hourly([3_000, 6_750, 13_500, 9_000])}
            />,
        );

        expect(columns().map((column) => column.height)).toEqual([
            `${(3_000 / 13_500) * 100}%`,
            '50%',
            '100%',
            `${(9_000 / 13_500) * 100}%`,
        ]);
        expect(columns().some((column) => column.clipped)).toBe(false);
    });

    it('clips a lone flood instead of flattening every other hour', () => {
        const quiet = Array.from({ length: 40 }, (_, index) =>
            index % 2 ? 100 : 50,
        );

        render(
            <SourceFilter
                selected={allSources}
                totals={{ human: 25_000 }}
                series={hourly([...quiet, 20_000])}
            />,
        );

        const drawn = columns();
        const flood = drawn[drawn.length - 1];

        // The top is three times the busy hours, so a busy hour sits at a third.
        expect(drawn[1].height).toBe(`${(100 / 300) * 100}%`);
        expect(flood.height).toBe('100%');
        expect(flood.clipped).toBe(true);
        expect(flood.title).toContain('Humans 20.0k');
        expect(flood.title).toContain('off the scale');
        expect(drawn.filter((column) => column.clipped)).toHaveLength(1);
    });
});

describe('column top', () => {
    it('is the busiest slot when nothing stands out', () => {
        expect(columnTop([3_000, 13_500, 0, 9_000])).toBe(13_500);
    });

    it('is three times the busy slots when one towers over them', () => {
        expect(columnTop([...Array(40).fill(100), 20_000])).toBe(300);
    });

    it('is zero with no traffic', () => {
        expect(columnTop([0, 0])).toBe(0);
        expect(columnTop([])).toBe(0);
    });
});
