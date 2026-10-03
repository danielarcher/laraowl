import { useForm, usePage } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { useState, useRef } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export default function CreateProjectModal({ children }: PropsWithChildren) {
    const { props }: any = usePage();
    const currentTeam = props.currentTeam;
    const teams = props.teams ?? [];

    const [open, setOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        url: '',
        team_id:
            currentTeam?.id?.toString() || (teams[0]?.id?.toString() ?? ''),
        logo: null as File | null,
    });

    const selectedTeamSlug =
        teams.find((t: any) => t.id.toString() === data.team_id)?.slug ||
        currentTeam?.slug;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/${selectedTeamSlug}/projects`, {
            onSuccess: () => {
                setOpen(false);
                reset();
                setPreviewUrl(null);
            },
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file) {
            setData('logo', file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="overflow-hidden rounded-lg border border-border bg-[#09090b] p-0 text-foreground shadow-2xl sm:max-w-[440px]">
                <form onSubmit={handleSubmit}>
                    <div className="space-y-6 p-6">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground/90">
                                Create Application
                            </DialogTitle>
                            <DialogDescription className="text-sm text-foreground/40">
                                Define your new project settings.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6">
                            {/* Simple Logo Upload */}
                            <div className="flex items-center gap-4">
                                <div
                                    className="relative cursor-pointer"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                >
                                    <div className="flex size-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted transition-all hover:border-border">
                                        {previewUrl ? (
                                            <img
                                                src={previewUrl}
                                                alt="Preview"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <Upload className="size-5 text-foreground/20" />
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-foreground/90">
                                        Icon
                                    </h4>
                                    <button
                                        type="button"
                                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                    >
                                        Upload application logo
                                    </button>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className="space-y-4">
                                {/* Workspace Selection */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-foreground/50">
                                        Workspace
                                    </Label>
                                    <Select
                                        value={data.team_id}
                                        onValueChange={(val) =>
                                            setData('team_id', val)
                                        }
                                    >
                                        <SelectTrigger className="h-10 rounded-lg border-border bg-muted/30 focus:ring-0">
                                            <SelectValue placeholder="Select a workspace" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-lg border-border bg-[#09090b] text-foreground">
                                            {teams.map((team: any) => (
                                                <SelectItem
                                                    key={team.id}
                                                    value={team.id.toString()}
                                                    className="cursor-pointer"
                                                >
                                                    <span className="text-sm">
                                                        {team.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.team_id} />
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="name"
                                        className="text-xs font-medium text-foreground/50"
                                    >
                                        Name
                                    </Label>
                                    <Input
                                        id="name"
                                        value={data.name}
                                        onChange={(e) =>
                                            setData('name', e.target.value)
                                        }
                                        placeholder="Application name"
                                        className="h-10 rounded-lg border-border bg-muted/30 font-medium focus:border-border focus:ring-0"
                                        required
                                    />
                                    <InputError message={errors.name} />
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="url"
                                        className="text-xs font-medium text-foreground/50"
                                    >
                                        URL (Optional)
                                    </Label>
                                    <Input
                                        id="url"
                                        type="url"
                                        value={data.url}
                                        onChange={(e) =>
                                            setData('url', e.target.value)
                                        }
                                        placeholder="https://app.laraowl.com"
                                        className="h-10 rounded-lg border-border bg-muted/30 focus:border-border focus:ring-0"
                                    />
                                    <InputError message={errors.url} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 p-6 pt-2">
                        <DialogClose asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-sm font-medium text-foreground/40 hover:bg-muted hover:text-foreground"
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            disabled={processing}
                            className="h-10 rounded-lg bg-white px-6 text-sm font-semibold text-black transition-all hover:bg-white/90"
                        >
                            {processing ? 'Creating...' : 'Create Application'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
