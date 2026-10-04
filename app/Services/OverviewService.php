<?php

namespace App\Services;

use App\Models\Issue;
use App\Models\Project;
use App\Models\Record;
use App\Models\RecordRollup;
use App\Models\Server;
use App\Models\Team;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Every app of a team side by side, read from the per-minute rollups so the
 * page costs two grouped queries however many apps there are.
 */
class OverviewService
{
    private const JOB_TYPES = ['job-attempt', 'queued-job'];

    /**
     * Roughly how many points each app's trend line holds.
     */
    private const TREND_POINTS = 60;

    public function __construct(private ServerMetricService $servers)
    {
        //
    }

    /**
     * @return array{totals: array<string, mixed>, groups: list<array<string, mixed>>, slot_seconds: int}
     */
    public function forTeam(Team $team, ?string $period, ?string $from = null, ?string $to = null): array
    {
        [$start, $end] = $this->window($period, $from, $to);
        $slot = $this->slotSeconds($start, $end);

        $projects = $team->projects()->with('media')->orderBy('name')->get();
        $ids = $projects->modelKeys();

        $totals = $ids === [] ? collect() : $this->totalsByProject($ids, $period, $from, $to);
        $trends = $ids === [] ? collect() : $this->requestTrends($ids, $period, $from, $to, $slot);
        $issues = $ids === [] ? collect() : $this->issueTrends($ids, $start, $end, $slot);

        $rows = $projects->map(fn (Project $project) => $this->projectRow(
            $project,
            $totals->get($project->id, collect()),
            $this->trendPoints($trends->get($project->id, collect()), $issues->get($project->id, collect()), $start, $end, $slot),
        ));

        return [
            'totals' => $this->teamTotals($rows, $totals),
            'groups' => $this->groupByServer($team, $rows),
            'slot_seconds' => $slot,
        ];
    }

    /**
     * The window the period covers, matching what the rollup scope filters on.
     *
     * @return array{CarbonInterface, CarbonInterface}
     */
    public function window(?string $period, ?string $from = null, ?string $to = null): array
    {
        if ($period === 'custom' && $from && $to) {
            try {
                $start = Carbon::parse($from);
                $end = Carbon::parse($to);

                if ($start->lt($end)) {
                    return [$start, $end];
                }
            } catch (Throwable) {
                // An unparseable range falls back to the default period.
            }
        }

        return [Record::periodStartsAt($period)->startOfMinute(), now()];
    }

    /**
     * Round slot widths, so points start on whole hours and the chart's
     * axis can label them.
     */
    private const SLOT_STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];

    /**
     * Seconds per trend point: the first round width that keeps a window to
     * about TREND_POINTS points.
     */
    public function slotSeconds(CarbonInterface $start, CarbonInterface $end): int
    {
        $seconds = max(60, (int) $start->diffInSeconds($end, true));
        $ideal = $seconds / self::TREND_POINTS;

        foreach (self::SLOT_STEPS as $step) {
            if ($step >= $ideal * 0.95) {
                return $step;
            }
        }

        return (int) (ceil($ideal / 86400) * 86400);
    }

    /**
     * Summed counters per project and type.
     *
     * @param  list<int>  $ids
     * @return Collection<int, Collection<string, object>>
     */
    private function totalsByProject(array $ids, ?string $period, ?string $from, ?string $to): Collection
    {
        $sum = fn (string $column) => DB::raw('COALESCE(SUM('.$this->col($column).'), 0) as '.$this->col($column));

        $columns = [
            'project_id',
            'type',
            $sum('count'),
            $sum('client_error_count'),
            $sum('server_error_count'),
            $sum('sum_duration'),
            $sum('count_duration'),
            DB::raw('MAX('.$this->col('max_duration').') as max_duration'),
        ];

        foreach (RollupWriter::latencyColumns() as $column) {
            $columns[] = $sum($column);
        }

        return RecordRollup::query()
            ->whereIn('project_id', $ids)
            ->whereIn('type', ['request', 'exception', ...self::JOB_TYPES])
            ->forPeriod($period, $from, $to)
            ->select($columns)
            ->groupBy('project_id', 'type')
            ->get()
            ->groupBy('project_id')
            ->map(fn (Collection $rows) => $rows->keyBy('type'));
    }

    /**
     * Requests and server errors per project per trend slot.
     *
     * @param  list<int>  $ids
     * @return Collection<int, Collection<int, object>>
     */
    private function requestTrends(array $ids, ?string $period, ?string $from, ?string $to, int $slot): Collection
    {
        $slotSql = $this->slotSql($slot);

        return RecordRollup::query()
            ->whereIn('project_id', $ids)
            ->where('type', 'request')
            ->forPeriod($period, $from, $to)
            ->select([
                'project_id',
                DB::raw("{$slotSql} as slot"),
                DB::raw('SUM('.$this->col('count').') as total'),
                DB::raw('SUM('.$this->col('server_error_count').') as errors'),
            ])
            ->groupBy('project_id', 'slot')
            ->get()
            ->groupBy('project_id')
            ->map(fn (Collection $rows) => $rows->keyBy(fn (object $row) => (int) $row->slot));
    }

    /**
     * Issue occurrences per project, issue type and trend slot: the records
     * linked to an issue. Ignored issues are noise someone chose to hide, so
     * they don't count.
     *
     * @param  list<int>  $ids
     * @return Collection<int, Collection<int, Collection<string, int>>>
     */
    private function issueTrends(array $ids, CarbonInterface $start, CarbonInterface $end, int $slot): Collection
    {
        $slotSql = $this->slotSql($slot, 'records.created_at');

        return Issue::query()
            ->join('records', 'records.issue_id', '=', 'issues.id')
            ->whereIn('issues.project_id', $ids)
            ->where('issues.status', '!=', 'ignored')
            ->whereBetween('records.created_at', [$start, $end])
            ->select([
                'issues.project_id',
                'issues.type',
                DB::raw("{$slotSql} as slot"),
                DB::raw('COUNT(*) as total'),
            ])
            ->groupBy('issues.project_id', 'issues.type', 'slot')
            ->toBase()
            ->get()
            ->groupBy('project_id')
            ->map(fn (Collection $rows) => $rows
                ->groupBy(fn (object $row) => (int) $row->slot)
                ->map(fn (Collection $types) => $types->mapWithKeys(fn (object $row) => [$row->type => (int) $row->total])));
    }

    /**
     * One point per slot across the window, gaps filled with zeros.
     *
     * @param  Collection<int, object>  $rows
     * @param  Collection<int, Collection<string, int>>  $issues
     * @return list<array{t: int, requests: int, errors: int, exception_issues: int, security_issues: int}>
     */
    private function trendPoints(Collection $rows, Collection $issues, CarbonInterface $start, CarbonInterface $end, int $slot): array
    {
        $points = [];

        for ($index = intdiv($start->getTimestamp(), $slot); $index <= intdiv($end->getTimestamp(), $slot); $index++) {
            $row = $rows->get($index);
            $points[] = [
                't' => $index * $slot,
                'requests' => (int) ($row->total ?? 0),
                'errors' => (int) ($row->errors ?? 0),
                'exception_issues' => $issues->get($index)?->get('exception', 0) ?? 0,
                'security_issues' => $issues->get($index)?->get('security', 0) ?? 0,
            ];
        }

        return $points;
    }

    /**
     * @param  Collection<string, object>  $totals
     * @param  list<array{t: int, requests: int, errors: int, exception_issues: int, security_issues: int}>  $trend
     * @return array<string, mixed>
     */
    private function projectRow(Project $project, Collection $totals, array $trend): array
    {
        $requests = $totals->get('request');
        $jobs = $totals->toBase()->only(self::JOB_TYPES);
        $count = (int) ($requests->count ?? 0);
        $serverErrors = (int) ($requests->server_error_count ?? 0);

        return [
            'id' => $project->id,
            'name' => $project->name,
            'slug' => $project->slug,
            'url' => $project->url,
            'logo_url' => $project->logo_url,
            'server_id' => $project->server_id,
            'uptime' => $project->hasUptimeMonitoring() ? ($project->last_uptime_status ?? 'unknown') : 'off',
            'last_uptime_check_at' => $project->last_uptime_check_at?->toIso8601String(),
            'requests' => $count,
            'server_errors' => $serverErrors,
            'client_errors' => (int) ($requests->client_error_count ?? 0),
            'error_rate' => $count > 0 ? round($serverErrors / $count * 100, 2) : null,
            'avg_ms' => $requests ? $this->milliseconds($this->average($requests)) : null,
            'p95_ms' => $requests ? $this->milliseconds($this->p95($requests)) : null,
            'exceptions' => (int) ($totals->get('exception')->count ?? 0),
            'jobs' => (int) $jobs->sum('count'),
            'failed_jobs' => (int) $jobs->sum('server_error_count'),
            'exception_issues' => array_sum(array_column($trend, 'exception_issues')),
            'security_issues' => array_sum(array_column($trend, 'security_issues')),
            'trend' => $trend,
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @param  Collection<int, Collection<string, object>>  $totals
     * @return array<string, mixed>
     */
    private function teamTotals(Collection $rows, Collection $totals): array
    {
        $requests = (int) $rows->sum('requests');
        $serverErrors = (int) $rows->sum('server_errors');

        // Percentiles don't add up, but histograms do: merge every app's
        // request histogram and read the team-wide p95 off that.
        $merged = (object) ['count_duration' => 0, 'max_duration' => null];

        foreach ($totals as $byType) {
            $row = $byType->get('request');

            if (! $row) {
                continue;
            }

            $merged->count_duration += (int) $row->count_duration;
            $merged->max_duration = max((float) $merged->max_duration, (float) $row->max_duration);

            foreach (RollupWriter::latencyColumns() as $column) {
                $merged->{$column} = ($merged->{$column} ?? 0) + (int) $row->{$column};
            }
        }

        return [
            'apps' => $rows->count(),
            'apps_up' => $rows->where('uptime', 'up')->count(),
            'apps_down' => $rows->where('uptime', 'down')->count(),
            'apps_quiet' => $rows->where('requests', 0)->count(),
            'requests' => $requests,
            'server_errors' => $serverErrors,
            'error_rate' => $requests > 0 ? round($serverErrors / $requests * 100, 2) : null,
            'p95_ms' => $merged->count_duration > 0 ? $this->milliseconds($this->p95($merged)) : null,
            'exceptions' => (int) $rows->sum('exceptions'),
            'jobs' => (int) $rows->sum('jobs'),
            'failed_jobs' => (int) $rows->sum('failed_jobs'),
        ];
    }

    /**
     * Servers in name order with their apps and current load; apps without a
     * server come last.
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function groupByServer(Team $team, Collection $rows): array
    {
        $servers = $team->servers()->with('latestMetric')->orderBy('name')->get();

        $groups = $servers->map(fn (Server $server) => [
            'server' => [
                ...$this->servers->summary($server),
                'latest' => $server->latestMetric ? $this->servers->presentSample($server->latestMetric) : null,
            ],
            'projects' => $rows->where('server_id', $server->id)->values()->all(),
        ]);

        $unlinked = $rows->whereNotIn('server_id', $servers->modelKeys())->values();

        if ($unlinked->isNotEmpty()) {
            $groups->push(['server' => null, 'projects' => $unlinked->all()]);
        }

        return $groups->values()->all();
    }

    /**
     * The mean duration in microseconds.
     */
    private function average(object $totals): float
    {
        $samples = (int) ($totals->count_duration ?? 0);

        return $samples > 0 ? ((float) $totals->sum_duration) / $samples : 0.0;
    }

    /**
     * An approximate 95th percentile in microseconds, read off the latency
     * histogram the same way the project dashboard does.
     */
    private function p95(object $totals): float
    {
        $samples = (int) ($totals->count_duration ?? 0);

        if ($samples === 0) {
            return 0.0;
        }

        $target = 0.95 * $samples;
        $cumulative = 0;

        foreach (RollupWriter::LATENCY_BOUNDARIES as $boundary) {
            $cumulative += (int) ($totals->{'lat_le_'.$boundary} ?? 0);

            if ($cumulative >= $target) {
                return (float) $boundary;
            }
        }

        return (float) ($totals->max_duration ?? 0);
    }

    private function milliseconds(float $microseconds): float
    {
        return round($microseconds / 1000, 1);
    }

    /**
     * The trend slot a timestamp column (a rollup bucket by default) falls
     * in, as whole slots since the epoch.
     */
    private function slotSql(int $slot, string $column = 'bucket'): string
    {
        $time = $this->col($column);

        return match (DB::connection()->getDriverName()) {
            'pgsql' => "FLOOR(EXTRACT(EPOCH FROM {$time}) / {$slot})",
            'sqlite' => "(CAST(strftime('%s', {$time}) AS INTEGER) / {$slot})",
            default => "FLOOR(UNIX_TIMESTAMP({$time}) / {$slot})",
        };
    }

    private function col(string $name): string
    {
        return DB::connection()->getQueryGrammar()->wrap($name);
    }
}
