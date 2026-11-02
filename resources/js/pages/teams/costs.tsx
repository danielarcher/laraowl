import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import CostController from '@/actions/App/Http/Controllers/Teams/CostController';
import { DatePicker } from '@/components/date-picker';
import { formatDay } from '@/components/date-range-calendar';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { Spending } from '@/lib/costs';
import { formatMoney } from '@/lib/costs';
import { edit, index } from '@/routes/teams';
import { index as costsIndex } from '@/routes/teams/costs';

type CostRow = {
    id: number;
    name: string;
    category: string;
    server_id: number | null;
    server_name: string | null;
    amount_cents: number;
    currency: string;
    interval: 'monthly' | 'yearly';
    renews_on: string | null;
    monthly_cents: number;
};

type Props = {
    team: { id: number; name: string; slug: string };
    costs: CostRow[];
    summary: Spending;
    servers: { id: number; name: string }[];
    categories: { value: string; label: string }[];
    intervals: string[];
    currencies: string[];
};

const NO_SERVER = 'none';

/**
 * Adds a cost, or edits the one given. Selects keep their value in state
 * and post it through a hidden input, so "no server" can be an empty value.
 */
function CostForm({
    team,
    cost,
    servers,
    categories,
    intervals,
    currencies,
    onDone,
}: Omit<Props, 'costs' | 'summary'> & {
    cost: CostRow | null;
    onDone: () => void;
}) {
    const [category, setCategory] = useState(cost?.category ?? 'server');
    const [serverId, setServerId] = useState(
        cost?.server_id ? String(cost.server_id) : NO_SERVER,
    );
    const [currency, setCurrency] = useState(cost?.currency ?? currencies[0]);
    const [interval, setBilledInterval] = useState<string>(
        cost?.interval ?? 'monthly',
    );
    const [renewsOn, setRenewsOn] = useState(cost?.renews_on ?? '');
    const action = cost
        ? CostController.update.form([team.slug, cost.id])
        : CostController.store.form(team.slug);

    return (
        <Form
            {...action}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            resetOnSuccess
            className="space-y-4 rounded-lg border border-border p-4"
        >
            {({ processing, errors }) => (
                <>
                    <input type="hidden" name="category" value={category} />
                    <input
                        type="hidden"
                        name="server_id"
                        value={
                            category === 'server' && serverId !== NO_SERVER
                                ? serverId
                                : ''
                        }
                    />
                    <input type="hidden" name="currency" value={currency} />
                    <input type="hidden" name="interval" value={interval} />
                    <input type="hidden" name="renews_on" value={renewsOn} />

                    <div className="grid gap-2">
                        <Label htmlFor="cost-name">Name</Label>
                        <Input
                            id="cost-name"
                            name="name"
                            defaultValue={cost?.name}
                            placeholder="web-1, Forge plan, example.com"
                            required
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="cost-category">Type</Label>
                            <Select
                                value={category}
                                onValueChange={setCategory}
                            >
                                <SelectTrigger id="cost-category">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.category} />
                        </div>

                        {category === 'server' && (
                            <div className="grid gap-2">
                                <Label htmlFor="cost-server">Server</Label>
                                <Select
                                    value={serverId}
                                    onValueChange={setServerId}
                                >
                                    <SelectTrigger id="cost-server">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_SERVER}>
                                            Not linked
                                        </SelectItem>
                                        {servers.map((server) => (
                                            <SelectItem
                                                key={server.id}
                                                value={String(server.id)}
                                            >
                                                {server.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.server_id} />
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="grid gap-2">
                            <Label htmlFor="cost-amount">Amount</Label>
                            <Input
                                id="cost-amount"
                                name="amount"
                                inputMode="decimal"
                                defaultValue={
                                    cost
                                        ? (cost.amount_cents / 100).toFixed(2)
                                        : undefined
                                }
                                placeholder="17.10"
                                required
                            />
                            <InputError message={errors.amount} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cost-currency">Currency</Label>
                            <Select
                                value={currency}
                                onValueChange={setCurrency}
                            >
                                <SelectTrigger id="cost-currency">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {currencies.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.currency} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cost-interval">Billed</Label>
                            <Select
                                value={interval}
                                onValueChange={setBilledInterval}
                            >
                                <SelectTrigger id="cost-interval">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {intervals.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option === 'monthly'
                                                ? 'Monthly'
                                                : 'Yearly'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.interval} />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="grid gap-2">
                            <Label htmlFor="cost-renews-on">Renews on</Label>
                            <DatePicker
                                id="cost-renews-on"
                                value={renewsOn}
                                onChange={setRenewsOn}
                                placeholder="Not set"
                            />
                            <InputError message={errors.renews_on} />
                        </div>
                        <p className="self-end pb-2 text-xs text-muted-foreground sm:col-span-2">
                            For yearly costs: the bill lands on this month in
                            the forecast.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button type="submit" disabled={processing}>
                            {cost ? 'Save cost' : 'Add cost'}
                        </Button>
                        {cost && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onDone}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </>
            )}
        </Form>
    );
}

export default function TeamCosts({
    team,
    costs,
    summary,
    servers,
    categories,
    intervals,
    currencies,
}: Props) {
    const [editing, setEditing] = useState<CostRow | null>(null);
    const prefix = summary.approximate ? '≈ ' : '';
    const label = (value: string) =>
        categories.find((category) => category.value === value)?.label ?? value;

    return (
        <>
            <Head title={`Costs - ${team.name}`} />

            <h1 className="sr-only">Costs</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Costs"
                    description="What the team pays for. Server prices are shared across the apps on each server."
                />

                <div className="flex items-baseline gap-3">
                    <span
                        className="text-2xl font-semibold tracking-tight tabular-nums"
                        data-test="costs-monthly-total"
                    >
                        {prefix}
                        {formatMoney(summary.monthly_cents, summary.currency)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                        per month · {prefix}
                        {formatMoney(
                            summary.yearly_cents,
                            summary.currency,
                            true,
                        )}{' '}
                        a year
                    </span>
                </div>

                <CostForm
                    key={editing?.id ?? 'new'}
                    team={team}
                    cost={editing}
                    servers={servers}
                    categories={categories}
                    intervals={intervals}
                    currencies={currencies}
                    onDone={() => setEditing(null)}
                />

                {costs.length > 0 && (
                    <ul className="divide-y divide-border">
                        {costs.map((cost) => (
                            <li
                                key={cost.id}
                                className="flex items-center justify-between gap-4 py-2.5"
                                data-test="cost-row"
                            >
                                <div className="min-w-0">
                                    <div className="truncate text-sm">
                                        {cost.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {label(cost.category)}
                                        {cost.server_name &&
                                            ` · ${cost.server_name}`}
                                        {cost.renews_on &&
                                            ` · renews ${formatDay(cost.renews_on)}`}
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <div className="text-right tabular-nums">
                                        <div className="text-sm">
                                            {formatMoney(
                                                cost.amount_cents,
                                                cost.currency,
                                            )}
                                            <span className="text-muted-foreground">
                                                {cost.interval === 'monthly'
                                                    ? '/mo'
                                                    : '/yr'}
                                            </span>
                                        </div>
                                        {(cost.interval === 'yearly' ||
                                            cost.currency !==
                                                summary.currency) && (
                                            <div className="text-xs text-muted-foreground">
                                                ≈{' '}
                                                {formatMoney(
                                                    cost.monthly_cents,
                                                    summary.currency,
                                                )}
                                                /mo
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditing(cost)}
                                    >
                                        Edit
                                    </Button>
                                    <Form
                                        {...CostController.destroy.form([
                                            team.slug,
                                            cost.id,
                                        ])}
                                        options={{ preserveScroll: true }}
                                    >
                                        {({ processing }) => (
                                            <Button
                                                type="submit"
                                                variant="ghost"
                                                size="sm"
                                                disabled={processing}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </Form>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

TeamCosts.layout = (props: { team: { name: string; slug: string } }) => ({
    breadcrumbs: [
        {
            title: 'Teams',
            href: index(),
        },
        {
            title: props.team.name,
            href: edit(props.team.slug),
        },
        {
            title: 'Costs',
            href: costsIndex(props.team.slug),
        },
    ],
});
