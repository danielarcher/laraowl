import { router, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronsUpDown,
    Plus,
    Radar,
    Layout,
    Terminal,
    Search,
    Server,
    Settings2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import CreateProjectModal from '@/components/create-project-modal';
import { ProjectTile } from '@/components/project-tile';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

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
    const onOverview = usePage().component === 'overview/index';
    const currentProject = onOverview ? null : props.currentProject;
    const currentServer = (props.availableServers ?? []).find(
        (server: any) =>
            server.id ===
            (props.projects ?? []).find(
                (project: any) => project.id === currentProject?.id,
            )?.server_id,
    );

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
                {inHeader ? (
                    <Button
                        variant="ghost"
                        className="h-9 max-w-[200px] gap-2 rounded-lg border border-border px-3 text-foreground/70 transition-all hover:bg-muted hover:text-foreground"
                    >
                        <div className="flex aspect-square size-5 shrink-0 items-center justify-center rounded bg-blue-600/20 text-blue-400">
                            <Terminal className="size-3" />
                        </div>
                        <div className="flex min-w-0 flex-col items-start leading-tight">
                            <span
                                title={currentTeam?.name}
                                className="truncate text-[11px] font-bold tracking-tight text-foreground"
                            >
                                {currentTeam?.name ?? 'Select Team'}
                            </span>
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
                        <ChevronsUpDown className="ml-1 size-3 shrink-0 text-foreground/20" />
                    </Button>
                ) : (
                    <button
                        type="button"
                        className="group/switcher flex h-10 w-full min-w-0 items-center gap-2.5 rounded-lg px-1.5 text-left transition-colors outline-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent"
                    >
                        {onOverview ? (
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06] text-foreground/70 ring-1 ring-sidebar-border ring-inset">
                                <Radar className="size-3.5" />
                            </span>
                        ) : currentProject ? (
                            <ProjectTile
                                project={currentProject}
                                className="size-7 text-[10px]"
                            />
                        ) : (
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/50 ring-1 ring-sidebar-border ring-inset">
                                <Plus className="size-3.5" />
                            </span>
                        )}
                        <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                            <span
                                title={currentProject?.name}
                                className="truncate text-[13px] font-medium text-foreground"
                            >
                                {onOverview
                                    ? 'All applications'
                                    : (currentProject?.name ??
                                      'No project yet')}
                            </span>
                            <span className="mt-0.5 truncate text-[11px] text-foreground/45">
                                {[
                                    currentTeam?.name,
                                    onOverview
                                        ? `${(props.projects ?? []).length} apps`
                                        : currentServer?.name,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                        </span>
                        <ChevronsUpDown className="size-3.5 shrink-0 text-foreground/30 transition-colors group-hover/switcher:text-foreground/60 group-data-[collapsible=icon]:hidden" />
                    </button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-72 overflow-hidden rounded-lg border-border bg-card p-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                side={inHeader ? 'bottom' : isMobile ? 'bottom' : 'right'}
                align={inHeader ? 'end' : 'start'}
                sideOffset={inHeader ? 8 : 4}
            >
                {/* Search Bar */}
                <div className="flex items-center gap-2 border-b border-border px-3 py-3">
                    <Search className="size-4 text-foreground/20" />
                    <input
                        className="w-full border-none bg-transparent p-0 text-[13px] text-foreground placeholder:text-foreground/30 focus:ring-0"
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
                                            className="truncate text-[10px] font-semibold tracking-wider text-foreground/35 uppercase"
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
                                        {search.trim() === '' && (
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    router.visit(
                                                        `/${team.slug}/overview`,
                                                    )
                                                }
                                                className="mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-sidebar-accent/60"
                                            >
                                                <span className="flex min-w-0 items-center gap-2.5">
                                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06] text-foreground/70 ring-1 ring-sidebar-border ring-inset">
                                                        <Radar className="size-3" />
                                                    </span>
                                                    <span
                                                        className={`truncate text-[13px] ${onOverview && team.id === currentTeam?.id ? 'font-medium text-foreground' : 'text-foreground/65'}`}
                                                    >
                                                        All applications
                                                    </span>
                                                </span>
                                                {onOverview &&
                                                    team.id ===
                                                        currentTeam?.id && (
                                                        <Check className="size-4 shrink-0 text-foreground" />
                                                    )}
                                            </DropdownMenuItem>
                                        )}
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
                                                        <span className="truncate text-[11px] font-medium">
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
                                                            <span className="text-[11px] font-medium">
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
                                                                className="group mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-sidebar-accent/60"
                                                            >
                                                                <div className="flex min-w-0 items-center gap-2.5">
                                                                    <ProjectTile
                                                                        project={
                                                                            project
                                                                        }
                                                                    />
                                                                    <span
                                                                        title={
                                                                            project.name
                                                                        }
                                                                        className={`truncate text-[13px] ${currentProject?.id === project.id ? 'font-medium text-foreground' : 'text-foreground/65'}`}
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
                            <span className="text-[13px] font-medium">
                                New Application
                            </span>
                        </DropdownMenuItem>
                    </CreateProjectModal>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
