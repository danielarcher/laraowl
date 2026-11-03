import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { index as mcpTokens } from '@/routes/mcp-tokens';
import { edit as notifications } from '@/routes/notifications';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { index as teams } from '@/routes/teams';
import { index as costs } from '@/routes/teams/costs';
import type { NavItem, Team } from '@/types';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Profile',
        href: edit(),
        icon: null,
    },
    {
        title: 'Security',
        href: editSecurity(),
        icon: null,
    },
    {
        title: 'Notifications',
        href: notifications(),
        icon: null,
    },
    {
        title: 'Teams',
        href: teams(),
        icon: null,
    },
    {
        title: 'MCP Tokens',
        href: mcpTokens(),
        icon: null,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const currentTeam = usePage<{ currentTeam: Team | null }>().props
        .currentTeam;
    const canManageCosts =
        currentTeam?.role === 'owner' || currentTeam?.role === 'admin';
    const navItems: NavItem[] = canManageCosts
        ? [
              ...sidebarNavItems,
              { title: 'Costs', href: costs(currentTeam.slug), icon: null },
          ]
        : sidebarNavItems;

    return (
        <div className="px-4 py-6">
            <Heading
                title="Settings"
                description="Manage your profile and account settings"
            />

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full lg:w-48">
                    <nav
                        className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0 lg:space-y-1 lg:overflow-visible lg:px-0"
                        aria-label="Settings"
                    >
                        {navItems.map((item, index) => (
                            <Button
                                key={`${toUrl(item.href)}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn(
                                    'shrink-0 justify-start lg:w-full',
                                    {
                                        'bg-muted': isCurrentOrParentUrl(
                                            item.href,
                                        ),
                                    },
                                )}
                            >
                                <Link href={item.href}>
                                    {item.icon && (
                                        <item.icon className="h-4 w-4" />
                                    )}
                                    {item.title}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </aside>

                <Separator className="my-4 lg:hidden" />

                <div className="flex-1 md:max-w-2xl">
                    <section className="max-w-xl space-y-12">
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
