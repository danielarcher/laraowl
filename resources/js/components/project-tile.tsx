const PROJECT_TINTS = [
    'bg-indigo-500/15 text-indigo-600 ring-indigo-500/25 dark:text-indigo-300',
    'bg-sky-500/15 text-sky-600 ring-sky-500/25 dark:text-sky-300',
    'bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300',
    'bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300',
    'bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300',
    'bg-violet-500/15 text-violet-600 ring-violet-500/25 dark:text-violet-300',
    'bg-teal-500/15 text-teal-600 ring-teal-500/25 dark:text-teal-300',
    'bg-orange-500/15 text-orange-600 ring-orange-500/25 dark:text-orange-300',
];

/**
 * "Keep It Five" → "KI", "iaang" → "IA".
 */
function projectInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const initials =
        words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2);

    return initials.toUpperCase();
}

/**
 * The project's uploaded logo, or its initials on a tint picked by id.
 */
export function ProjectTile({
    project,
    className = 'size-6 text-[9px]',
}: {
    project: any;
    className?: string;
}) {
    const logo =
        project?.logo_url && !project.logo_url.includes('ui-avatars.com')
            ? project.logo_url
            : null;

    if (logo) {
        return (
            <img
                src={logo}
                alt=""
                className={`shrink-0 rounded-md object-cover ring-1 ring-sidebar-border ${className}`}
            />
        );
    }

    return (
        <span
            className={`flex shrink-0 items-center justify-center rounded-md font-semibold tracking-tight ring-1 ring-inset ${PROJECT_TINTS[(project?.id ?? 0) % PROJECT_TINTS.length]} ${className}`}
        >
            {projectInitials(project?.name ?? '?')}
        </span>
    );
}
