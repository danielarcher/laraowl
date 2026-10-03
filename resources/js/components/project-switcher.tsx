import { router, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, Plus, Layout } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from './ui/input';

export function ProjectSwitcher() {
    const { props }: any = usePage();
    const currentTeam = props.currentTeam;
    const projects = props.projects ?? [];
    const currentProject = props.currentProject;

    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');

    const switchProject = (project: any) => {
        if (!currentProject) {
            router.visit(`/${currentTeam.slug}/${project.slug}/dashboard`);

            return;
        }

        const currentUrl = window.location.pathname;
        const oldPrefix = `/${currentTeam.slug}/${currentProject.slug}`;
        const newPrefix = `/${currentTeam.slug}/${project.slug}`;

        if (currentUrl.includes(oldPrefix)) {
            router.visit(currentUrl.replace(oldPrefix, newPrefix));
        } else {
            router.visit(newPrefix + '/dashboard');
        }
    };

    const handleAddProject = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(
            `/${currentTeam.slug}/projects`,
            { name: newName },
            {
                onSuccess: () => {
                    setIsAdding(false);
                    setNewName('');
                },
            },
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="group w-full justify-start border border-border bg-muted/30 px-2 py-6 transition-all group-data-[collapsible=icon]:px-2 hover:bg-white/[0.05]"
                >
                    <div className="mr-2 flex aspect-square size-6 items-center justify-center rounded bg-purple-600/20 text-purple-400 group-data-[collapsible=icon]:mr-0">
                        <Layout className="size-3" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="truncate font-bold tracking-tight text-foreground/90">
                            {currentProject?.name ?? 'Select project'}
                        </span>
                        <span className="mt-0.5 text-[10px] leading-none font-semibold tracking-widest text-foreground/40 uppercase">
                            Project
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-3 text-foreground/20 group-data-[collapsible=icon]:hidden" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="start">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Projects
                </DropdownMenuLabel>
                {projects.map((project: any) => (
                    <DropdownMenuItem
                        key={project.id}
                        onSelect={() => switchProject(project)}
                        className="flex cursor-pointer items-center justify-between"
                    >
                        <span>{project.name}</span>
                        {currentProject?.id === project.id && (
                            <Check className="h-4 w-4" />
                        )}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {isAdding ? (
                    <div className="space-y-2 p-2">
                        <Input
                            autoFocus
                            placeholder="Project name..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === 'Enter' && handleAddProject(e)
                            }
                            className="h-8 text-sm"
                        />
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="h-7 flex-1"
                                onClick={handleAddProject}
                            >
                                Add
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 flex-1"
                                onClick={() => setIsAdding(false)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <DropdownMenuItem
                        onSelect={(e) => {
                            e.preventDefault();
                            setIsAdding(true);
                        }}
                        className="cursor-pointer"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        <span>New project</span>
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
