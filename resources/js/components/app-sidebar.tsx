import { Link, usePage } from '@inertiajs/react';

import {
    LayoutGrid,
    AlertCircle,
    Activity,
    Repeat,
    Terminal,
    Calendar,
    Zap,
    Search,
    Bell,
    Mail,
    Database,
    ExternalLink,
    Users,
    FileText,
    Settings,
    Globe,
    Shield,
    Lock as LockIcon,
    Server as ServerIcon,
    Radar,
} from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
} from '@/components/ui/sidebar';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import type { PageProps } from '@/types';
import type { NavItem } from '@/types';

export function AppSidebar() {
    const { props } = usePage<PageProps>();
    const teamSlug = props.currentTeam?.slug || '';

    const projects = (props as any).projects || [];
    const currentProject = (props as any).currentProject;
    const projectSlug =
        currentProject?.slug || (projects.length > 0 ? projects[0].slug : '');

    const currentPeriod = (props as any).period || '1h';
    const from = (props as any).from;
    const to = (props as any).to;

    const withPeriod = (url: string) => {
        if (!url || url === '#' || url.startsWith('http')) {
            return url;
        }

        const [base, query] = url.split('?');
        const searchParams = new URLSearchParams(query || '');

        searchParams.set('period', currentPeriod);

        if (from) {
            searchParams.set('from', from);
        }

        if (to) {
            searchParams.set('to', to);
        }

        return `${base}?${searchParams.toString()}`;
    };

    const overviewUrl = teamSlug ? withPeriod(`/${teamSlug}/overview`) : '/';

    const dashboardUrl = projectSlug
        ? withPeriod(`/${teamSlug}/${projectSlug}/dashboard`)
        : teamSlug
          ? `/${teamSlug}/projects/create`
          : '/';

    const activityNavItems: NavItem[] = [
        {
            title: 'Requests',
            href: withPeriod(`/${teamSlug}/${projectSlug}/requests`),
            icon: Activity,
        },
        {
            title: 'Jobs',
            href: withPeriod(`/${teamSlug}/${projectSlug}/jobs`),
            icon: Repeat,
        },
        {
            title: 'Commands',
            href: withPeriod(`/${teamSlug}/${projectSlug}/commands`),
            icon: Terminal,
        },
        {
            title: 'Scheduled Tasks',
            href: withPeriod(`/${teamSlug}/${projectSlug}/scheduled-tasks`),
            icon: Calendar,
        },
        {
            title: 'Exceptions',
            href: withPeriod(`/${teamSlug}/${projectSlug}/exceptions`),
            icon: Zap,
        },
        {
            title: 'Queries',
            href: withPeriod(`/${teamSlug}/${projectSlug}/queries`),
            icon: Search,
        },
        {
            title: 'Notifications',
            href: withPeriod(`/${teamSlug}/${projectSlug}/notifications`),
            icon: Bell,
        },
        {
            title: 'Mail',
            href: withPeriod(`/${teamSlug}/${projectSlug}/mail`),
            icon: Mail,
        },
        {
            title: 'Cache',
            href: withPeriod(`/${teamSlug}/${projectSlug}/cache`),
            icon: Database,
        },
        {
            title: 'Outgoing Requests',
            href: withPeriod(`/${teamSlug}/${projectSlug}/outgoing-requests`),
            icon: ExternalLink,
        },
    ];

    const uptimeEnabled = currentProject?.uptime_monitoring_enabled ?? true;

    const monitoringNavItems: NavItem[] = [
        {
            title: 'Users',
            href: withPeriod(`/${teamSlug}/${projectSlug}/users`),
            icon: Users,
        },
        ...(uptimeEnabled
            ? [
                  {
                      title: 'Uptime',
                      href: withPeriod(`/${teamSlug}/${projectSlug}/uptime`),
                      icon: Globe,
                  },
              ]
            : []),
        {
            title: 'Logs',
            href: withPeriod(`/${teamSlug}/${projectSlug}/logs`),
            icon: FileText,
        },
    ];

    const securityNavItems: NavItem[] = [
        {
            title: 'Security',
            href: withPeriod(`/${teamSlug}/${projectSlug}/security`),
            icon: Shield,
        },
        {
            title: 'Firewall',
            href: withPeriod(`/${teamSlug}/${projectSlug}/firewall`),
            icon: LockIcon,
            items: [
                {
                    title: 'Overview',
                    href: withPeriod(`/${teamSlug}/${projectSlug}/firewall`),
                },
                {
                    title: 'Traffic',
                    href: withPeriod(
                        `/${teamSlug}/${projectSlug}/firewall/traffic`,
                    ),
                },
                {
                    title: 'Rules',
                    href: withPeriod(
                        `/${teamSlug}/${projectSlug}/firewall/rules`,
                    ),
                },
                {
                    title: 'Audit Log',
                    href: withPeriod(
                        `/${teamSlug}/${projectSlug}/firewall/audit`,
                    ),
                },
            ],
        },
    ];

    return (
        <Sidebar
            collapsible="icon"
            variant="inset"
            className="border-r border-sidebar-border bg-sidebar"
        >
            <SidebarHeader className="gap-1 border-b border-sidebar-border/60 p-2">
                <Link
                    href={overviewUrl}
                    prefetch
                    className="flex h-8 items-center gap-2 rounded-md px-1.5 text-foreground/85 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 hover:text-foreground"
                >
                    <AppLogoIcon className="size-5 shrink-0 rounded object-contain" />
                    <span className="text-[13px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                        {(props as any).name ?? 'LaraOwl'}
                    </span>
                </Link>
                <WorkspaceSwitcher />
            </SidebarHeader>

            <SidebarContent className="px-2 py-3">
                <div className="space-y-3">
                    <NavMain
                        items={[
                            {
                                title: 'Overview',
                                href: overviewUrl,
                                icon: Radar,
                            },
                            {
                                title: 'Dashboard',
                                href: dashboardUrl,
                                icon: LayoutGrid,
                            },
                            {
                                title: 'Servers',
                                href: `/${teamSlug}/servers`,
                                icon: ServerIcon,
                            },
                            {
                                title: 'Issues',
                                href: withPeriod(
                                    `/${teamSlug}/${projectSlug}/issues`,
                                ),
                                icon: AlertCircle,
                            },
                        ]}
                        label="Platform"
                    />

                    <NavMain items={activityNavItems} label="Activity" />

                    <NavMain items={securityNavItems} label="Security" />

                    <NavMain items={monitoringNavItems} label="Monitoring" />

                    <NavMain
                        items={[
                            {
                                title: 'Settings',
                                href: `/${teamSlug}/${projectSlug}/settings`,
                                icon: Settings,
                            },
                        ]}
                        label="Manage"
                    />
                </div>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border/60 p-2">
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
