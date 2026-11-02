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
        $rate = (float) (config('laraowl.costs.rates')[$cost->currency] ?? 1.0);

        return $cost->amount_cents * $rate / $cost->interval->months();
    }

    /**
     * The team's monthly run-rate, by category, plus the most expensive apps.
     *
     * @return array<string, mixed>
     */
    public function summary(Team $team): array
    {
        $costs = $team->costs()->get();
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
            'apps' => $apps,
            'traffic_days' => $this->trafficDays(),
        ];
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
