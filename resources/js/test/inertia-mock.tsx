import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { vi } from 'vitest';

/**
 * A stand-in for @inertiajs/react: records visits instead of making them.
 */
export const page = { props: {} as Record<string, unknown>, url: '/' };

export const router = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    visit: vi.fn(),
    on: vi.fn(() => () => {}),
};

export const inertiaMock = {
    Head: () => null,
    Link: ({
        href,
        children,
        ...rest
    }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
        href: string | { url: string };
        prefetch?: boolean;
        children?: ReactNode;
    }) => (
        <a
            href={typeof href === 'string' ? href : href.url}
            {...{ ...rest, prefetch: undefined }}
        >
            {children}
        </a>
    ),
    router,
    usePage: () => page,
};
