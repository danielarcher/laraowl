import { router, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronsUpDown,
    Plus,
    Layout,
    Terminal,
    Search,
    Server,
    Settings2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import CreateProjectModal from '@/components/create-project-modal';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

const PROJECT_GRADIENTS = [
    'from-indigo-500 to-purple-600',
    'from-blue-500 to-cyan-400',
    'from-emerald-500 to-teal-400',
    'from-orange-500 to-amber-400',
    'from-rose-500 to-pink-400',
];

type ServerGroup = {
    server: any | null;
    projects: any[];
};

/**
 * The team's projects grouped under the server each one runs on, servers in
 * name order and unlinked projects last. A search term keeps a project when
 * its own name, its server's name or its team's name matches.
 */
function groupTeamProjects(
    team: any,
    projects: any[],
    servers: any[],
    term: string,
): ServerGroup[] {
    const matches = (value?: string) =>
        (value ?? '').toLowerCase().includes(term);
    const teamMatches = matches(team.name);
    const teamServers = servers.filter((s: any) => s.team_id === team.id);
    const serverIds = new Set(teamServers.map((s: any) => s.id));
    const teamProjects = projects.filter((p: any) => p.team_id === team.id);

    const groups: ServerGroup[] = teamServers.map((server: any) => {
        const own = teamProjects.filter((p: any) => p.server_id === server.id);

        return {
            server,
            projects:
                teamMatches || matches(server.name)
                    ? own
                    : own.filter((p: any) => matches(p.name)),
        };
    });

    groups.push({
        server: null,
        projects: teamProjects.filter(
            (p: any) =>
                !serverIds.has(p.server_id) && (teamMatches || matches(p.name)),
        ),
    });

    return groups.filter(
        (group) =>
            group.projects.length > 0 ||
            (group.server !== null &&
                (teamMatches || matches(group.server.name))),
    );
}

export function WorkspaceSwitcher({
    inHeader = false,
}: {
    inHeader?: boolean;
}) {
    const { props }: any = usePage();
    const isMobile = useIsMobile();
    const currentTeam = props.currentTeam;
    const currentProject = props.currentProject;

    const [search, setSearch] = useState('');

    const filteredTeams = useMemo(() => {
        const term = search.trim().toLowerCase();

        return (props.teams ?? [])
            .map((team: any) => ({
                team,
                groups: groupTeamProjects(
                    team,
                    props.projects ?? [],
                    props.availableServers ?? [],
                    term,
                ),
            }))
            .filter(
                ({ team, groups }: any) =>
                    groups.length > 0 || team.name.toLowerCase().includes(term),
            );
    }, [props.teams, props.projects, props.availableServers, search]);

    const switchProject = (project: any) => {
        const projectTeam =
            (props.teams ?? []).find((t: any) => t.id === project.team_id) ??
            currentTeam;
        const newPrefix = `/${projectTeam.slug}/${project.slug}`;

        const currentUrl = window.location.pathname;
        const oldPrefix =
            currentTeam && currentProject
                ? `/${currentTeam.slug}/${currentProject.slug}`
                : null;

        if (oldPrefix && currentUrl.includes(oldPrefix)) {
            router.visit(currentUrl.replace(oldPrefix, newPrefix));
        } else {
            router.visit(newPrefix + '/dashboard');
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className={
                        inHeader
                            ? 'h-9 max-w-[200px] gap-2 rounded-lg border border-border px-3 text-foreground/70 transition-all hover:bg-muted hover:text-foreground'
                            : 'group w-full justify-start border border-border bg-muted/30 px-2 py-8 transition-all group-data-[collapsible=icon]:py-4 hover:bg-white/[0.05]'
                    }
                >
                    <div
                        className={
                            inHeader
                                ? 'flex aspect-square size-5 shrink-0 items-center justify-center rounded bg-blue-600/20 text-blue-400'
                                : 'mr-3 flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:size-6'
                        }
                    >
                        <Terminal className={inHeader ? 'size-3' : 'size-4'} />
                    </div>
                    <div
                        className={
                            inHeader
                                ? 'flex min-w-0 flex-col items-start leading-tight'
                                : 'grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden'
                        }
                    >
                        <div className="flex w-full items-center gap-1.5">
                            <span
                                title={currentTeam?.name}
                                className={
                                    inHeader
                                        ? 'truncate text-[11px] font-bold tracking-tight text-foreground'
                                        : 'truncate text-sm font-bold tracking-tight text-foreground uppercase'
                                }
                            >
                                {currentTeam?.name ?? 'Select Team'}
                            </span>
                        </div>
                        <div className="mt-0.5 flex w-full items-center gap-1">
                            <Layout className="size-2.5 shrink-0 text-foreground/40" />
                            <span
                                title={currentProject?.name}
                                className="truncate text-[10px] font-medium tracking-tight text-foreground/60"
                            >
                                {currentProject?.name ?? 'No Project'}
                            </span>
                        </div>
                    </div>
                    <ChevronsUpDown
                        className={
                            inHeader
                                ? 'ml-1 size-3 shrink-0 text-foreground/20'
                                : 'ml-auto size-4 shrink-0 text-foreground/20 group-data-[collapsible=icon]:hidden'
                        }
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-72 overflow-hidden rounded-xl border-border bg-card p-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                side={inHeader ? 'bottom' : isMobile ? 'bottom' : 'right'}
                align={inHeader ? 'end' : 'start'}
                sideOffset={inHeader ? 8 : 4}
            >
                {/* Search Bar */}
                <div className="flex items-center gap-2 border-b border-border px-3 py-3">
                    <Search className="size-4 text-foreground/20" />
                    <input
                        className="w-full border-none bg-transparent p-0 text-sm text-foreground placeholder:text-foreground/20 focus:ring-0"
                        placeholder="Find application, server or team"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="custom-scrollbar max-h-[min(70vh,560px)] overflow-y-auto">
                    {/* Teams, each with its apps grouped by server */}
                    <div className="p-1">
                        {filteredTeams.length === 0 && (
                            <p className="px-3 py-6 text-center text-xs text-foreground/40">
                                Nothing matches "{search}"
                            </p>
                        )}
                        {filteredTeams.map(({ team, groups }: any) => {
                            const hasServers = groups.some(
                                (group: ServerGroup) => group.server !== null,
                            );

                            return (
                                <div key={team.id} className="mb-3 last:mb-0">
                                    <div className="flex items-center justify-between px-3 py-2">
                                        <span
                                            className="truncate text-[11px] font-black tracking-[0.1em] text-foreground/30 uppercase"
                                            title={team.name}
                                        >
                                            {team.name}
                                        </span>
                                        <Settings2
                                            className="size-3.5 shrink-0 cursor-pointer text-foreground/20 transition-colors hover:text-foreground/60"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.visit(
                                                    `/settings/teams/${team.slug}`,
                                                );
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        {groups.map((group: ServerGroup) => (
                                            <div
                                                key={group.server?.id ?? 'none'}
                                            >
                                                {group.server ? (
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            router.visit(
                                                                `/${team.slug}/servers/${group.server.id}`,
                                                            )
                                                        }
                                                        title={`Open ${group.server.name}`}
                                                        className="mx-1 flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-foreground/50 transition-colors hover:bg-white/[0.03] hover:text-foreground"
                                                    >
                                                        <Server className="size-3.5 shrink-0" />
                                                        <span className="truncate text-xs font-semibold">
                                                            {group.server.name}
                                                        </span>
                                                        <span
                                                            title={
                                                                group.server
                                                                    .is_online
                                                                    ? 'Online'
                                                                    : 'Offline'
                                                            }
                                                            className={`size-1.5 shrink-0 rounded-full ${group.server.is_online ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                        />
                                                        <span className="ml-auto text-[10px] font-medium text-foreground/30 tabular-nums">
                                                            {
                                                                group.projects
                                                                    .length
                                                            }
                                                        </span>
                                                    </DropdownMenuItem>
                                                ) : (
                                                    hasServers && (
                                                        <div className="mx-1 flex items-center gap-2 px-3 py-1.5 text-foreground/30">
                                                            <Server className="size-3.5 shrink-0" />
                                                            <span className="text-xs font-semibold">
                                                                No server
                                                            </span>
                                                        </div>
                                                    )
                                                )}

                                                <div
                                                    className={
                                                        hasServers
                                                            ? 'ml-5 space-y-0.5 border-l border-border pl-1'
                                                            : 'space-y-0.5'
                                                    }
                                                >
                                                    {group.projects.map(
                                                        (project: any) => (
                                                            <DropdownMenuItem
                                                                key={project.id}
                                                                onSelect={() =>
                                                                    switchProject(
                                                                        project,
                                                                    )
                                                                }
                                                                className="group mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                                                            >
                                                                <div className="flex min-w-0 items-center gap-2.5">
                                                                    <div
                                                                        className={`size-7 shrink-0 rounded-md bg-gradient-to-br ${
                                                                            PROJECT_GRADIENTS[
                                                                                project.id %
                                                                                    PROJECT_GRADIENTS.length
                                                                            ]
                                                                        } flex items-center justify-center text-foreground shadow-lg`}
                                                                    >
                                                                        <Layout className="size-4" />
                                                                    </div>
                                                                    <span
                                                                        title={
                                                                            project.name
                                                                        }
                                                                        className={`truncate text-sm font-semibold ${currentProject?.id === project.id ? 'text-foreground' : 'text-foreground/60'}`}
                                                                    >
                                                                        {
                                                                            project.name
                                                                        }
                                                                    </span>
                                                                </div>
                                                                {currentProject?.id ===
                                                                    project.id && (
                                                                    <Check className="size-4 shrink-0 text-foreground" />
                                                                )}
                                                            </DropdownMenuItem>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DropdownMenuSeparator className="m-0 bg-muted" />

                <div className="p-1.5">
                    <CreateProjectModal>
                        <DropdownMenuItem
                            onSelect={(e) => {
                                e.preventDefault();
                            }}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-3 text-foreground/50 transition-colors hover:text-foreground"
                        >
                            <Plus className="size-4" />
                            <span className="text-sm font-semibold">
                                New Application
                            </span>
                        </DropdownMenuItem>
                    </CreateProjectModal>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
