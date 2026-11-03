import { Link, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    LayoutGrid,
    Menu,
    Radar,
    Server as ServerIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

type Tab = {
    title: string;
    href: string;
    match: (path: string) => boolean;
    icon: ComponentType<{ className?: string }>;
};

/**
 * Phone navigation: the four places people check most, plus the full menu.
 * Hidden from md up, where the sidebar is always there.
 */
export function MobileTabBar() {
    const { props, url } = usePage<{
        currentTeam?: { slug: string } | null;
        currentProject?: { slug: string } | null;
        projects?: { slug: string }[];
        period?: string;
    }>();
    const { setOpenMobile } = useSidebar();

    const team = props.currentTeam?.slug;

    if (!team) {
        return null;
    }

    const project =
        props.currentProject?.slug ?? props.projects?.[0]?.slug ?? null;
    const period = props.period ? `?period=${props.period}` : '';
    const path = url.split('?')[0];

    const tabs: Tab[] = [
        {
            title: 'Overview',
            href: `/${team}/overview${period}`,
            match: (p) => p === `/${team}/overview`,
            icon: Radar,
        },
        {
            title: 'App',
            href: project
                ? `/${team}/${project}/dashboard${period}`
                : `/${team}/projects/create`,
            match: (p) =>
                project !== null &&
                p.startsWith(`/${team}/${project}/`) &&
                !p.endsWith('/issues'),
            icon: LayoutGrid,
        },
        {
            title: 'Servers',
            href: `/${team}/servers`,
            match: (p) => p.startsWith(`/${team}/servers`),
            icon: ServerIcon,
        },
        {
            title: 'Issues',
            href: project ? `/${team}/${project}/issues${period}` : '#',
            match: (p) => p.includes('/issues'),
            icon: AlertCircle,
        },
    ];

    return (
        <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        >
            <ul className="mx-auto grid h-14 max-w-md grid-cols-5">
                {tabs.map((tab) => {
                    const active = tab.match(path);

                    return (
                        <li key={tab.title}>
                            <Link
                                href={tab.href}
                                prefetch
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'relative flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide transition-colors',
                                    active
                                        ? 'text-foreground'
                                        : 'text-muted-foreground active:text-foreground',
                                )}
                            >
                                {active && (
                                    <span className="absolute inset-x-5 top-0 h-px bg-foreground" />
                                )}
                                <tab.icon className="size-[18px]" />
                                {tab.title}
                            </Link>
                        </li>
                    );
                })}
                <li>
                    <button
                        type="button"
                        onClick={() => setOpenMobile(true)}
                        className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground transition-colors active:text-foreground"
                    >
                        <Menu className="size-[18px]" />
                        More
                    </button>
                </li>
            </ul>
        </nav>
    );
}
