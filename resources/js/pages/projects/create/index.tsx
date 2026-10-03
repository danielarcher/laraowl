import { Head, useForm, usePage } from '@inertiajs/react';
import { Loader2, Upload, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CreateProject() {
    const { props }: any = usePage();
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        logo: null as File | null,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/${props.currentTeam.slug}/projects`);
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
            <Head title="New Project" />

            <div className="w-full max-w-sm space-y-10">
                <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Create Project
                    </h1>
                    <p className="text-sm font-medium text-muted-foreground">
                        Setup your new monitoring workspace.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-8">
                    <div className="space-y-6">
                        {/* Icon Upload Area */}
                        <div className="flex flex-col items-center gap-4">
                            <div
                                className="group relative flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30 transition-all hover:border-primary/50 hover:bg-muted/50"
                                onClick={() =>
                                    document
                                        .getElementById('logo-input')
                                        ?.click()
                                }
                            >
                                {data.logo ? (
                                    <div className="flex flex-col items-center p-2 text-center">
                                        <Layout className="mb-1 h-6 w-6 text-primary" />
                                        <span className="max-w-[80px] truncate text-[8px] font-bold text-primary">
                                            {data.logo.name}
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
                                        <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-primary">
                                            Icon
                                        </span>
                                    </>
                                )}
                                <input
                                    id="logo-input"
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) =>
                                        setData(
                                            'logo',
                                            e.target.files?.[0] || null,
                                        )
                                    }
                                />
                            </div>
                            {errors.logo && (
                                <p className="text-[10px] font-bold text-red-500">
                                    {errors.logo}
                                </p>
                            )}
                        </div>

                        {/* Name Field */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="name"
                                className="ml-1 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
                            >
                                Project Name
                            </Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder="e.g. Production API"
                                required
                                autoFocus
                                className="h-12 rounded-lg border-border bg-card px-4 text-base shadow-sm focus:ring-1 focus:ring-primary"
                            />
                            {errors.name && (
                                <p className="ml-1 text-[10px] font-bold text-red-500">
                                    {errors.name}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button
                            type="submit"
                            className="h-12 w-full rounded-lg bg-primary text-[10px] font-semibold tracking-widest text-primary-foreground uppercase shadow-lg transition-all active:scale-[0.98]"
                            disabled={processing}
                        >
                            {processing && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Create Project
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
