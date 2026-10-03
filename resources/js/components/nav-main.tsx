import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';

export function NavMain({
    items = [],
    label,
}: {
    items: NavItem[];
    label?: string;
}) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="px-2 py-0">
            {label && (
                <SidebarGroupLabel className="hidden text-[9px] font-bold tracking-widest text-foreground/20 uppercase group-data-[collapsible=icon]:hidden">
                    {label}
                </SidebarGroupLabel>
            )}
            <SidebarMenu className="gap-px">
                {items.map((item) => {
                    const active = isCurrentUrl(item.href);

                    return (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={active}
                                tooltip={{ children: item.title }}
                                className={`h-7.5 gap-2.5 rounded-md px-2 text-[13px] transition-colors ${
                                    active
                                        ? 'bg-sidebar-accent font-medium text-foreground'
                                        : 'text-foreground/60 hover:bg-sidebar-accent/60 hover:text-foreground'
                                }`}
                            >
                                <Link href={item.href} prefetch>
                                    {item.icon && (
                                        <item.icon
                                            className={`size-4 ${active ? 'text-foreground' : 'text-foreground/40'}`}
                                        />
                                    )}
                                    <span className="tracking-tight">
                                        {item.title}
                                    </span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
