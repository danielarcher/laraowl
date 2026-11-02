<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Record;
use App\Models\Server;
use App\Models\ServerMetric;
use App\Models\Team;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class ServerMetricService
{
    /**
     * Chart bucket sizes in seconds, smallest first.
     *
     * @var list<int>
     */
    private const BUCKETS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400];

    /**
     * Roughly how many points a chart should hold.
     */
    private const TARGET_POINTS = 300;

    /**
     * How long the slow-moving insights (7-day averages, disk forecast) are
     * kept before they are read again.
     */
    private const INSIGHT_CACHE_SECONDS = 600;

    /**
     * Days of daily disk peaks the forecast fits a line through.
     */
    private const FORECAST_DAYS = 14;

    /**
     * Every server of the team with its latest sample, a one-hour sparkline,
     * the projects linked to it and its 7-day insights. The sparklines of all
     * servers come from one query.
     *
     * @return list<array<string, mixed>>
     */
    public function overview(Team $team): array
    {
        $servers = $team->servers()
            ->with(['projects' => fn ($query) => $query->orderBy('name')])
            ->orderBy('name')
            ->get();
        $latest = $this->latestSamples($servers->modelKeys());
        $sparklines = $this->sparklines($servers->modelKeys(), now()->subHour(), now(), 60);
        $insights = $this->insights($team);

        return $servers
            ->map(fn (Server $server) => [
                ...$this->summary($server),
                'latest' => $latest->has($server->id) ? $this->presentSample($latest[$server->id]) : null,
                'sparkline' => $sparklines->get($server->id, []),
                'projects' => $this->presentProjects($server),
                'insights' => $insights[$server->id] ?? null,
            ])
            ->values()
            ->all();
    }

    /**
     * The newest sample of each server, keyed by server id. Each id is looked
     * up on the (server_id, recorded_ts) index; latestOfMany() groups the whole
     * table first, which took ~200ms on a few hundred thousand samples.
     *
     * @param  list<int>  $ids
     * @return Collection<int, ServerMetric>
     */
    private function latestSamples(array $ids): Collection
    {
        if ($ids === []) {
            return collect();
        }

        $newest = Server::query()
            ->whereKey($ids)
            ->toBase()
            ->select(['latest_id' => ServerMetric::query()
                ->select('id')
                ->whereColumn('server_metrics.server_id', 'servers.id')
                ->orderByDesc('recorded_ts')
                ->orderByDesc('id')
                ->limit(1)])
            ->pluck('latest_id')
            ->filter();

        return ServerMetric::query()->whereKey($newest)->get()->keyBy('server_id');
    }

    /**
     * Seven-day averages, a disk-full forecast and the flags they raise, per
     * server id. Cached for a few minutes: they barely move between polls.
     *
     * @return array<int, array<string, mixed>>
     */
    public function insights(Team $team): array
    {
        return Cache::remember(
            "laraowl.servers.insights.{$team->id}",
            self::INSIGHT_CACHE_SECONDS,
            fn () => $this->readInsights($team),
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function readInsights(Team $team): array
    {
        $ids = $team->servers()->pluck('id')->all();

        if ($ids === []) {
            return [];
        }

        $averages = ServerMetric::query()
            ->whereIn('server_id', $ids)
            ->where('recorded_ts', '>=', now()->subDays(7)->getTimestamp())
            ->groupBy('server_id')
            ->select('server_id')
            ->selectRaw('avg(cpu_percent) as cpu_avg, max(cpu_percent) as cpu_max')
            ->selectRaw('avg(memory_used) as memory_used, avg(memory_total) as memory_total')
            ->selectRaw('avg(swap_used) as swap_used, avg(swap_total) as swap_total')
            ->toBase()
            ->get()
            ->keyBy('server_id');

        $dailyDisk = ServerMetric::query()
            ->whereIn('server_id', $ids)
            ->where('recorded_ts', '>=', now()->subDays(self::FORECAST_DAYS)->getTimestamp())
            ->groupByRaw('server_id, recorded_ts / 86400')
            ->selectRaw('server_id, recorded_ts / 86400 as day, max(disk_used) as disk_used, max(disk_total) as disk_total')
            ->toBase()
            ->get()
            ->groupBy('server_id');

        return collect($ids)
            ->mapWithKeys(function (int $id) use ($averages, $dailyDisk) {
                $row = $averages->get($id);

                if ($row === null) {
                    return [$id => null];
                }

                $insight = [
                    'cpu_avg' => round((float) $row->cpu_avg, 1),
                    'cpu_max' => round((float) $row->cpu_max, 1),
                    'memory_avg' => $this->percent((float) $row->memory_used, (float) $row->memory_total),
                    'swap_avg' => $this->percent((float) $row->swap_used, (float) $row->swap_total),
                    'disk_full_in_days' => $this->daysUntilDiskFull($dailyDisk->get($id, collect())),
                ];

                return [$id => [...$insight, 'flags' => $this->flags($insight)]];
            })
            ->all();
    }

    /**
     * Fits a straight line through the daily disk peaks and reads off when it
     * reaches the disk size. Null while the disk isn't growing, with too few
     * days to tell, or when full is more than a year away.
     *
     * @param  Collection<int, object>  $days
     */
    public function daysUntilDiskFull(Collection $days): ?int
    {
        if ($days->count() < 3) {
            return null;
        }

        $points = $days->map(fn (object $day) => [(float) $day->day, (float) $day->disk_used])->values();
        $meanX = $points->avg(0);
        $meanY = $points->avg(1);
        $variance = $points->sum(fn (array $point) => ($point[0] - $meanX) ** 2);

        if ($variance <= 0) {
            return null;
        }

        $slope = $points->sum(fn (array $point) => ($point[0] - $meanX) * ($point[1] - $meanY)) / $variance;

        if ($slope <= 0) {
            return null;
        }

        $latest = $days->sortBy('day')->last();
        $remaining = (int) ceil(((float) $latest->disk_total - (float) $latest->disk_used) / $slope);

        return $remaining > 365 ? null : max(0, $remaining);
    }

    /**
     * What deserves a look, judged on the 7-day averages.
     *
     * @param  array<string, mixed>  $insight
     * @return list<array{key: string, label: string, tone: string}>
     */
    public function flags(array $insight): array
    {
        $flags = [];
        $diskDays = $insight['disk_full_in_days'];

        if ($diskDays !== null && $diskDays <= 60) {
            $flags[] = ['key' => 'disk', 'label' => "Disk full in ~{$diskDays}d", 'tone' => $diskDays <= 14 ? 'error' : 'warn'];
        }

        if (($insight['memory_avg'] ?? 0) >= 85) {
            $flags[] = ['key' => 'memory', 'label' => 'Memory pressure', 'tone' => 'error'];
        }

        if (($insight['swap_avg'] ?? 0) >= 50) {
            $flags[] = ['key' => 'swap', 'label' => 'Swapping', 'tone' => 'warn'];
        }

        if ($insight['cpu_avg'] >= 70) {
            $flags[] = ['key' => 'cpu', 'label' => 'CPU busy', 'tone' => 'warn'];
        }

        if ($flags === [] && $insight['cpu_avg'] < 5 && $insight['cpu_max'] < 40 && ($insight['memory_avg'] ?? 100) < 50) {
            $flags[] = ['key' => 'idle', 'label' => 'Underused', 'tone' => 'info'];
        }

        return $flags;
    }

    /**
     * One-hour CPU sparklines for several servers in a single query, keyed
     * by server id.
     *
     * @param  list<int>  $ids
     * @return Collection<int, list<array<string, float|int|null>>>
     */
    public function sparklines(array $ids, CarbonInterface $from, CarbonInterface $to, int $bucket): Collection
    {
        if ($ids === []) {
            return collect();
        }

        return $this->seriesQuery($from, $to, $bucket)
            ->whereIn('server_id', $ids)
            ->addSelect('server_id')
            ->groupBy('server_id')
            ->toBase()
            ->get()
            ->groupBy('server_id')
            ->map(fn (Collection $rows) => $rows->map(fn (object $row) => $this->presentPoint($row))->values()->all());
    }

    /**
     * One server's latest sample plus bucketed history for the requested window.
     *
     * @return array<string, mixed>
     */
    public function detail(Server $server, CarbonInterface $from, CarbonInterface $to): array
    {
        $bucket = $this->bucketFor($from, $to);
        $latest = $server->latestMetric;

        return [
            'server' => [
                ...$this->summary($server),
                'projects' => $this->presentProjects($server->load(['projects' => fn ($query) => $query->orderBy('name')])),
            ],
            'latest' => $latest ? $this->presentSample($latest) : null,
            'history' => $this->series($server, $from, $to, $bucket),
            'bucket_seconds' => $bucket,
        ];
    }

    /**
     * The smallest bucket that keeps the window near the target point count.
     */
    public function bucketFor(CarbonInterface $from, CarbonInterface $to): int
    {
        $wanted = max(1, $to->getTimestamp() - $from->getTimestamp()) / self::TARGET_POINTS;

        foreach (self::BUCKETS as $bucket) {
            if ($bucket >= $wanted) {
                return $bucket;
            }
        }

        return self::BUCKETS[array_key_last(self::BUCKETS)];
    }

    /**
     * Averages (and CPU peaks) per bucket. The bucket is an internal integer,
     * never user input, so it is safe to inline into the expression.
     *
     * @return list<array<string, float|int|null>>
     */
    public function series(Server $server, CarbonInterface $from, CarbonInterface $to, int $bucket): array
    {
        return $this->seriesQuery($from, $to, $bucket)
            ->where('server_id', $server->id)
            ->toBase()
            ->get()
            ->map(fn (object $row) => $this->presentPoint($row))
            ->values()
            ->all();
    }

    /**
     * The bucketed averages behind every chart; callers pick the servers.
     *
     * @return Builder<ServerMetric>
     */
    private function seriesQuery(CarbonInterface $from, CarbonInterface $to, int $bucket): Builder
    {
        $bucketExpression = sprintf('(recorded_ts / %1$d) * %1$d', $bucket);

        return ServerMetric::query()
            ->whereBetween('recorded_ts', [$from->getTimestamp(), $to->getTimestamp()])
            ->selectRaw("{$bucketExpression} as bucket")
            ->selectRaw('avg(cpu_percent) as cpu_avg, max(cpu_percent) as cpu_max')
            ->selectRaw('avg(memory_used) as memory_used, max(memory_total) as memory_total')
            ->selectRaw('avg(swap_used) as swap_used, max(swap_total) as swap_total')
            ->selectRaw('avg(load_1) as load_1, avg(load_5) as load_5, avg(load_15) as load_15')
            ->selectRaw('max(disk_used) as disk_used, max(disk_total) as disk_total')
            ->groupByRaw($bucketExpression)
            ->orderBy('bucket');
    }

    /**
     * @return array<string, float|int|null>
     */
    private function presentPoint(object $row): array
    {
        return [
            'timestamp' => (int) $row->bucket,
            'cpu' => round((float) $row->cpu_avg, 1),
            'cpu_max' => round((float) $row->cpu_max, 1),
            'memory' => $this->percent((float) $row->memory_used, (float) $row->memory_total),
            'memory_used' => (int) round((float) $row->memory_used),
            'swap' => $this->percent((float) $row->swap_used, (float) $row->swap_total),
            'swap_used' => (int) round((float) $row->swap_used),
            'load_1' => round((float) $row->load_1, 2),
            'load_5' => round((float) $row->load_5, 2),
            'load_15' => round((float) $row->load_15, 2),
            'disk' => $this->percent((float) $row->disk_used, (float) $row->disk_total),
            'disk_used' => (int) $row->disk_used,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(Server $server): array
    {
        return [
            'id' => $server->id,
            'name' => $server->name,
            'hostname' => $server->hostname,
            'ip_address' => $server->ip_address,
            'os' => $server->os,
            'cpu_count' => $server->cpu_count,
            'last_seen_at' => $server->last_seen_at?->toIso8601String(),
            'is_online' => $server->is_online,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function presentSample(ServerMetric $metric): array
    {
        return [
            'recorded_at' => $metric->recorded_at->toIso8601String(),
            'cpu' => round($metric->cpu_percent, 1),
            'load' => [$metric->load_1, $metric->load_5, $metric->load_15],
            'memory_total' => $metric->memory_total,
            'memory_used' => $metric->memory_used,
            'memory' => $this->percent($metric->memory_used, $metric->memory_total),
            'swap_total' => $metric->swap_total,
            'swap_used' => $metric->swap_used,
            'swap' => $this->percent($metric->swap_used, $metric->swap_total),
            'disk_total' => $metric->disk_total,
            'disk_used' => $metric->disk_used,
            'disk' => $this->percent($metric->disk_used, $metric->disk_total),
            'disks' => collect($metric->disks ?? [])
                ->map(fn (array $disk) => [
                    ...$disk,
                    'percent' => $this->percent((float) $disk['used'], (float) $disk['total']),
                ])
                ->values()
                ->all(),
            'uptime_seconds' => $metric->uptime_seconds,
        ];
    }

    /**
     * Point each of the team's projects at the server its latest record came
     * from. Records carry the sending machine's hostname as `payload.server`;
     * projects without records, or whose host isn't a known server, keep the
     * server they were given by hand.
     *
     * @return int The number of projects whose server changed.
     */
    public function linkProjects(Team $team): int
    {
        $serverIds = $team->servers()->whereNotNull('hostname')->pluck('id', 'hostname');

        if ($serverIds->isEmpty()) {
            return 0;
        }

        $changed = 0;

        foreach ($team->projects()->get(['id', 'server_id']) as $project) {
            $serverId = $serverIds[$this->reportedHostname($project)] ?? null;

            if ($serverId !== null && $project->server_id !== $serverId) {
                $project->update(['server_id' => $serverId]);
                $changed++;
            }
        }

        return $changed;
    }

    /**
     * The hostname that sent the project's most recent record in the last day.
     *
     * Ordered by created_at so Postgres walks the (project_id, created_at)
     * index: ordering by id walks the primary key backwards through the whole
     * table for a project without records.
     */
    public function reportedHostname(Project $project): string
    {
        $hostname = Record::query()
            ->where('project_id', $project->id)
            ->where('created_at', '>=', now()->subDay())
            ->orderByDesc('created_at')
            ->first(['payload'])
            ?->payload['server'] ?? null;

        return is_string($hostname) ? $hostname : '';
    }

    /**
     * @return list<array{name: string, slug: string}>
     */
    private function presentProjects(Server $server): array
    {
        return $server->projects
            ->map(fn (Project $project) => ['name' => $project->name, 'slug' => $project->slug])
            ->values()
            ->all();
    }

    private function percent(float $used, float $total): ?float
    {
        if ($total <= 0) {
            return null;
        }

        return round($used / $total * 100, 1);
    }
}
