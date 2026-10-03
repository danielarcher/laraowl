import { Head, useForm, Link } from '@inertiajs/react';
import { Loader2, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CreateTeam() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/teams');
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-6">
            <Head title="Create your team" />

            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
                        <Users className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground uppercase">
                            Laraowl
                        </h1>
                        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase opacity-60">
                            Workspace Setup
                        </p>
                    </div>
                </div>

                <Card className="rounded-lg border-border bg-card shadow-xl">
                    <CardHeader className="space-y-1 pb-4">
                        <CardTitle className="text-xl font-bold text-foreground">
                            Create a Team
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Start by giving your team or workspace a name.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="space-y-6">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="name"
                                    className="ml-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
                                >
                                    Team Name
                                </Label>
                                <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    placeholder="e.g. Acme Corp"
                                    required
                                    autoFocus
                                    className="h-12 rounded-lg border-border bg-muted/50 px-4 transition-all focus:border-primary focus:ring-primary/20"
                                />
                                {errors.name && (
                                    <p className="mt-1 text-[10px] font-bold text-red-500">
                                        {errors.name}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-4 pt-2">
                                <Button
                                    type="submit"
                                    className="h-12 w-full rounded-lg bg-primary text-[11px] font-semibold tracking-widest text-primary-foreground uppercase shadow-lg transition-all active:scale-[0.98]"
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Continue to Projects
                                </Button>

                                <Link
                                    href="/"
                                    className="flex items-center justify-center gap-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
                                >
                                    <ArrowLeft className="h-3 w-3" />
                                    Back
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <p className="text-center text-[10px] font-bold tracking-[0.2em] text-muted-foreground/40 uppercase">
                    Laraowl Monitoring System &copy; 2026
                </p>
            </div>
        </div>
    );
}
