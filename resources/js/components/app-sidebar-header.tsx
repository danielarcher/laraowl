import { usePage } from '@inertiajs/react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { TimeFilter } from '@/components/time-filter';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs: providedBreadcrumbs,
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { props }: any = usePage();
    const breadcrumbs =
        providedBreadcrumbs && providedBreadcrumbs.length > 0
            ? providedBreadcrumbs
            : props.breadcrumbs || [];

    return (
        <header className="sticky top-0 z-50 flex h-[calc(4rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-all sm:px-6">
            <div className="flex items-center gap-4">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <SidebarTrigger className="-ml-1" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                        Toggle Sidebar (Ctrl/⌘ + B)
                    </TooltipContent>
                </Tooltip>
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            <div className="flex items-center gap-4">
                <TimeFilter />
            </div>
        </header>
    );
}
