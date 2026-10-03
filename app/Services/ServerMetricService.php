<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Record;
use App\Models\Server;
use App\Models\ServerMetric;
use App\Models\Team;
use Carbon\CarbonInterface;

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
     * Every server of the team with its latest sample, a one-hour sparkline and
     * the projects linked to it.
     *
     * @return list<array<string, mixed>>
     */
    public function overview(Team $team): array
    {
        $sparklineStart = now()->subHour();

        return $team->servers()
            ->with(['latestMetric', 'projects' => fn ($query) => $query->orderBy('name')])
            ->orderBy('name')
            ->get()
            ->map(fn (Server $server) => [
                ...$this->summary($server),
                'latest' => $server->latestMetric ? $this->presentSample($server->latestMetric) : null,
                'sparkline' => $this->series($server, $sparklineStart, now(), 60),
                'projects' => $this->presentProjects($server),
            ])
            ->values()
            ->all();
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
        $bucketExpression = sprintf('(recorded_ts / %1$d) * %1$d', $bucket);

        return ServerMetric::query()
            ->where('server_id', $server->id)
            ->whereBetween('recorded_ts', [$from->getTimestamp(), $to->getTimestamp()])
            ->selectRaw("{$bucketExpression} as bucket")
            ->selectRaw('avg(cpu_percent) as cpu_avg, max(cpu_percent) as cpu_max')
            ->selectRaw('avg(memory_used) as memory_used, max(memory_total) as memory_total')
            ->selectRaw('avg(swap_used) as swap_used, max(swap_total) as swap_total')
            ->selectRaw('avg(load_1) as load_1, avg(load_5) as load_5, avg(load_15) as load_15')
            ->selectRaw('max(disk_used) as disk_used, max(disk_total) as disk_total')
            ->groupByRaw($bucketExpression)
            ->orderBy('bucket')
            ->toBase()
            ->get()
            ->map(fn (object $row) => [
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
            ])
            ->values()
            ->all();
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
     * The hostname that sent the project's most recent record.
     */
    public function reportedHostname(Project $project): string
    {
        $hostname = Record::query()
            ->where('project_id', $project->id)
            ->orderByDesc('id')
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
