import { usePage } from '@inertiajs/react';
import { ArrowUpCircle, Check, Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { SharedData } from '@/types';

const UPDATE_COMMAND = 'php artisan laraowl:update';

/** Holds the version the operator last dismissed, so a newer one shows again. */
const DISMISSED_KEY = 'laraowl:update-dismissed';

export function UpdateBanner() {
    const { update, version } = usePage<SharedData>().props;
    const [dismissedVersion, setDismissedVersion] = useState(() =>
        typeof window === 'undefined'
            ? null
            : localStorage.getItem(DISMISSED_KEY),
    );
    const [instructionsOpen, setInstructionsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) {
            return;
        }

        const timeout = setTimeout(() => setCopied(false), 2000);

        return () => clearTimeout(timeout);
    }, [copied]);

    if (!update || dismissedVersion === update.version) {
        return null;
    }

    const dismiss = () => {
        localStorage.setItem(DISMISSED_KEY, update.version);
        setDismissedVersion(update.version);
    };

    const copyCommand = () => {
        navigator.clipboard.writeText(UPDATE_COMMAND).then(() => {
            setCopied(true);
        });
    };

    return (
        <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
                <ArrowUpCircle className="size-4 shrink-0 text-primary" />

                <p className="font-medium">
                    LaraOwl v{update.version} is available
                </p>

                <p className="text-muted-foreground">
                    You are running v{version}.
                </p>

                <div className="ms-auto flex items-center gap-2">
                    <Button variant="secondary" size="sm" asChild>
                        <a
                            href={update.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Release notes
                        </a>
                    </Button>

                    <Button size="sm" onClick={() => setInstructionsOpen(true)}>
                        How to update
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Dismiss update notice"
                        onClick={dismiss}
                    >
                        <X className="size-4" />
                    </Button>
                </div>
            </div>

            <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update to v{update.version}</DialogTitle>
                        <DialogDescription>
                            Back up your database first — the update runs
                            migrations. Then run this on the server, from the
                            application root:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
                        <code className="flex-1 truncate">
                            {UPDATE_COMMAND}
                        </code>

                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Copy update command"
                            onClick={copyCommand}
                        >
                            {copied ? (
                                <Check className="size-4" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                        </Button>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        LaraOwl goes into maintenance mode, pulls the release,
                        installs dependencies, rebuilds assets, and migrates.
                        Add <code>--dry-run</code> to preview the steps without
                        running them.
                    </p>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setInstructionsOpen(false)}
                        >
                            Close
                        </Button>

                        <Button asChild>
                            <a
                                href={update.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View release notes
                            </a>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
