<?php

namespace App\Services;

use App\Enums\CostCategory;
use App\Enums\TeamPermission;
use App\Models\Cost;
use App\Models\Project;
use App\Models\RecordRollup;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * What the team pays per month, and each server's price shared across the
 * apps that run on it: evenly, and by their share of requests.
 */
class CostService
{
    /**
     * How long the 30-day request totals are kept: summing a month of minute
     * rollups is the slowest part of every page that splits prices.
     */
    private const TRAFFIC_CACHE_SECONDS = 600;

    /**
     * Whether the user may see and edit the team's costs.
     */
    public function canManage(?User $user, Team $team): bool
    {
        return $user !== null && $user->hasTeamPermission($team, TeamPermission::ManageCosts);
    }

    /**
     * The currencies a cost can be entered in.
     *
     * @return list<string>
     */
    public function currencies(): array
    {
        return array_keys(config('laraowl.costs.rates'));
    }

    public function baseCurrency(): string
    {
        return config('laraowl.costs.currency');
    }

    /**
     * One month of the cost in cents of the base currency: yearly costs count
     * a twelfth, other currencies are converted at the configured rate.
     */
    public function monthlyCents(Cost $cost): float
    {
        return $this->billCents($cost) / $cost->interval->months();
    }

    /**
     * One bill of the cost in cents of the base currency.
     */
    public function billCents(Cost $cost): float
    {
        $rate = (float) (config('laraowl.costs.rates')[$cost->currency] ?? 1.0);

        return $cost->amount_cents * $rate;
    }

    /**
     * The team's monthly run-rate, by category, plus the most expensive apps.
     *
     * @return array<string, mixed>
     */
    public function summary(Team $team): array
    {
        $costs = $team->costs()->with('server:id,name')->get();
        $monthly = $costs->sum(fn (Cost $cost) => $this->monthlyCents($cost));

        $categories = collect(CostCategory::cases())
            ->map(fn (CostCategory $category) => [
                'category' => $category->value,
                'label' => $category->label(),
                'monthly_cents' => (int) round($costs
                    ->where('category', $category)
                    ->sum(fn (Cost $cost) => $this->monthlyCents($cost))),
            ])
            ->filter(fn (array $row) => $row['monthly_cents'] > 0)
            ->values()
            ->all();

        $apps = collect($this->serverShares($team))
            ->flatMap(fn (array $server) => $server['apps'])
            ->values()
            ->all();

        return [
            'currency' => $this->baseCurrency(),
            'monthly_cents' => (int) round($monthly),
            'yearly_cents' => (int) round($monthly * 12),
            'approximate' => $costs->contains(fn (Cost $cost) => $cost->currency !== $this->baseCurrency()),
            'count' => $costs->count(),
            'categories' => $categories,
            'items' => $this->items($costs),
            'apps' => $apps,
            'requests' => array_sum(array_column($apps, 'requests')),
            'traffic_days' => $this->trafficDays(),
            ...$this->forecast($costs),
        ];
    }

    /**
     * Every cost as a line of the statement, biggest first within its
     * category.
     *
     * @param  Collection<int, Cost>  $costs
     * @return list<array<string, mixed>>
     */
    private function items(Collection $costs): array
    {
        return $costs
            ->map(fn (Cost $cost) => [
                'id' => $cost->id,
                'name' => $cost->name,
                'category' => $cost->category->value,
                'server_name' => $cost->server?->name,
                'interval' => $cost->interval->value,
                'amount_cents' => $cost->amount_cents,
                'currency' => $cost->currency,
                'monthly_cents' => (int) round($this->monthlyCents($cost)),
                'renews_on' => $cost->renews_on?->toDateString(),
            ])
            ->sortBy([
                fn (array $a, array $b) => array_search(CostCategory::from($a['category']), CostCategory::cases(), true)
                    <=> array_search(CostCategory::from($b['category']), CostCategory::cases(), true),
                fn (array $a, array $b) => $b['monthly_cents'] <=> $a['monthly_cents'],
            ])
            ->values()
            ->all();
    }

    /**
     * What gets billed in each of the coming months: monthly costs every
     * month, yearly ones in full on their renewal month. Yearly costs
     * without a renewal date are spread a twelfth a month.
     *
     * @param  Collection<int, Cost>  $costs
     * @return array{forecast: list<array<string, mixed>>, renewals: list<array<string, mixed>>, unscheduled_cents: int}
     */
    private function forecast(Collection $costs): array
    {
        $today = CarbonImmutable::today();
        $first = $today->startOfMonth();
        $end = $first->addMonths(self::FORECAST_MONTHS);
        $empty = array_fill_keys(array_map(fn (CostCategory $category) => $category->value, CostCategory::cases()), 0.0);

        $months = collect(range(0, self::FORECAST_MONTHS - 1))
            ->mapWithKeys(fn (int $offset) => [$first->addMonths($offset)->format('Y-m') => ['categories' => $empty, 'renewals' => []]])
            ->all();
        $renewals = [];
        $unscheduled = 0.0;

        foreach ($costs as $cost) {
            $category = $cost->category->value;

            if ($cost->interval->months() === 1) {
                foreach ($months as $key => $month) {
                    $months[$key]['categories'][$category] += $this->monthlyCents($cost);
                }

                continue;
            }

            if ($cost->renews_on === null) {
                $unscheduled += $this->monthlyCents($cost);

                foreach ($months as $key => $month) {
                    $months[$key]['categories'][$category] += $this->monthlyCents($cost);
                }

                continue;
            }

            $next = $this->nextRenewal(CarbonImmutable::parse($cost->renews_on), $today, $cost->interval->months());
            $renewals[] = [
                'id' => $cost->id,
                'name' => $cost->name,
                'category' => $category,
                'date' => $next->toDateString(),
                'days' => (int) $today->diffInDays($next),
                'cents' => (int) round($this->billCents($cost)),
            ];

            for ($date = $next; $date < $end; $date = $date->addMonthsNoOverflow($cost->interval->months())) {
                $key = $date->format('Y-m');
                $months[$key]['categories'][$category] += $this->billCents($cost);
                $months[$key]['renewals'][] = ['name' => $cost->name, 'date' => $date->toDateString(), 'cents' => (int) round($this->billCents($cost))];
            }
        }

        usort($renewals, fn (array $a, array $b) => $a['date'] <=> $b['date'] ?: $a['name'] <=> $b['name']);

        return [
            'forecast' => collect($months)
                ->map(fn (array $month, string $key) => [
                    'month' => $key,
                    'total_cents' => (int) round(array_sum($month['categories'])),
                    'categories' => array_map(fn (float $cents) => (int) round($cents), $month['categories']),
                    'renewals' => $month['renewals'],
                ])
                ->values()
                ->all(),
            'renewals' => array_slice($renewals, 0, self::RENEWALS_SHOWN),
            'unscheduled_cents' => (int) round($unscheduled),
        ];
    }

    /**
     * The first renewal on or after today: a stale date rolls forward by
     * whole billing periods.
     */
    private function nextRenewal(CarbonImmutable $date, CarbonImmutable $today, int $months): CarbonImmutable
    {
        while ($date < $today) {
            $date = $date->addMonthsNoOverflow($months);
        }

        return $date;
    }

    /**
     * Each server's monthly price and every app's share of it, keyed by
     * server id. Servers with a price but no apps keep it unsplit.
     *
     * @return array<int, array{monthly_cents: int, apps: list<array<string, mixed>>}>
     */
    public function serverShares(Team $team): array
    {
        $prices = $team->costs()
            ->whereNotNull('server_id')
            ->get()
            ->groupBy('server_id')
            ->map(fn (Collection $costs) => $costs->sum(fn (Cost $cost) => $this->monthlyCents($cost)));

        if ($prices->isEmpty()) {
            return [];
        }

        $projects = $team->projects()
            ->whereIn('server_id', $prices->keys())
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'server_id']);
        $requests = $this->requestsByProject($team, $projects->modelKeys());

        return $team->servers()
            ->whereIn('id', $prices->keys())
            ->get(['id', 'name'])
            ->mapWithKeys(fn (Server $server) => [$server->id => [
                'monthly_cents' => (int) round($prices[$server->id]),
                'apps' => $this->split(
                    $server,
                    $prices[$server->id],
                    $projects->where('server_id', $server->id)->values(),
                    $requests,
                ),
            ]])
            ->all();
    }

    /**
     * One server's price over its apps.
     *
     * @param  Collection<int, Project>  $projects
     * @param  Collection<int, int>  $requests
     * @return list<array<string, mixed>>
     */
    private function split(Server $server, float $price, Collection $projects, Collection $requests): array
    {
        if ($projects->isEmpty()) {
            return [];
        }

        $equal = $price / $projects->count();
        $traffic = $projects->sum(fn (Project $project) => $requests->get($project->id, 0));

        return $projects
            ->map(function (Project $project) use ($server, $equal, $price, $traffic, $requests) {
                $count = $requests->get($project->id, 0);
                $share = $traffic > 0 ? $count / $traffic : null;

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'slug' => $project->slug,
                    'server_id' => $server->id,
                    'server_name' => $server->name,
                    'requests' => $count,
                    'traffic_share' => $share === null ? null : round($share * 100, 1),
                    'equal_cents' => (int) round($equal),
                    // Without any requests on the server, traffic can't divide
                    // the price, so it falls back to the even split.
                    'traffic_cents' => (int) round($share === null ? $equal : $price * $share),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * How many months the bill forecast looks ahead, this one included.
     */
    private const FORECAST_MONTHS = 12;

    /**
     * How many renewals the summary lists.
     */
    private const RENEWALS_SHOWN = 5;

    /**
     * Requests per project over the traffic window, from the minute rollups,
     * cached per team and set of projects.
     *
     * @param  list<int>  $ids
     * @return Collection<int, int>
     */
    private function requestsByProject(Team $team, array $ids): Collection
    {
        if ($ids === []) {
            return collect();
        }

        sort($ids);
        $key = sprintf('laraowl.costs.traffic.%d.%d.%s', $team->id, $this->trafficDays(), md5(implode(',', $ids)));

        return collect(Cache::remember($key, self::TRAFFIC_CACHE_SECONDS, fn () => $this->readRequests($ids)->all()));
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, int>
     */
    private function readRequests(array $ids): Collection
    {
        $count = DB::connection()->getQueryGrammar()->wrap('count');

        return RecordRollup::query()
            ->whereIn('project_id', $ids)
            ->where('type', 'request')
            ->where('bucket', '>=', now()->subDays($this->trafficDays())->startOfMinute())
            ->groupBy('project_id')
            ->select(['project_id', DB::raw("COALESCE(SUM({$count}), 0) as total")])
            ->toBase()
            ->get()
            ->mapWithKeys(fn (object $row) => [(int) $row->project_id => (int) $row->total]);
    }

    private function trafficDays(): int
    {
        return max(1, (int) config('laraowl.costs.traffic_days'));
    }
}
