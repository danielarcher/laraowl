<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Record;
use App\Models\RecordGroupRollup;
use App\Models\RecordGroupUserBucket;
use App\Models\RecordIpBucket;
use App\Models\RecordRollup;
use App\Models\RecordUserBucket;
use App\Support\TimeSlots;
use Carbon\Carbon;
use Cron\CronExpression;
use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RecordService
{
    /**
     * Get aggregated stats for various record types.
     */
    public function getQuickStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $types = ['request', 'exception', 'query', 'queued-job', 'job-attempt', 'scheduled-task', 'cache-event', 'log', 'mail', 'notification', 'outgoing-request'];

        $counts = RecordRollup::query()
            ->where('project_id', $project->id)
            ->whereIn('type', $types)
            ->forPeriod($period, $from, $to)
            ->select('type', DB::raw('SUM('.$this->col('count').') as total'))
            ->groupBy('type')
            ->pluck('total', 'type');

        $stats = [];

        foreach ($types as $type) {
            $stats[str_replace('-', '_', $type).'s'] = (int) ($counts[$type] ?? 0);
        }

        // Aggregate jobs
        $stats['jobs'] = $stats['queued_jobs'] + $stats['job_attempts'];

        return $stats;
    }

    /**
     * Aggregate Request Data
     */
    public function getRequestStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null, string $sort = 'total', string $direction = 'desc'): array
    {
        $allowedSorts = ['method', 'path', 'total', 'ok_count', 'client_error_count', 'server_error_count', 'avg_duration', 'p95_duration'];
        $sort = in_array($sort, $allowedSorts) ? $sort : 'total';
        $direction = $direction === 'asc' ? 'asc' : 'desc';

        $overview = $this->rollupTotals($project, 'request', $period, $from, $to);

        $requests = $this->groupList(
            $project, 'request', $period, $from, $to,
            sort: $sort,
            direction: $direction,
            sortMap: ['method' => 'label', 'path' => 'sublabel', 'p95_duration' => 'max_duration'],
        )->through(function ($row) {
            $row->method = $row->label;
            $row->path = $row->sublabel;

            return $row;
        });

        return [
            'requests' => $requests,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'request', $period, $from, $to),
            'overview' => [
                'ok' => (int) $overview->ok,
                'client_error' => (int) $overview->client_error,
                'server_error' => (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
                'max_duration' => round((float) ($overview->max_duration ?? 0), 2),
                'min_duration' => round((float) ($overview->min_duration ?? 0), 2),
                'latency' => $this->latencySummary($overview),
                'histogram' => $this->latencyHistogram($overview),
            ],
            'sort' => $sort,
            'direction' => $direction,
        ];
    }

    /**
     * Get comprehensive dashboard metrics.
     */
    public function getDashboardStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $requestStats = $this->rollupTotals($project, 'request', $period, $from, $to);
        $exceptionStats = $this->rollupTotals($project, 'exception', $period, $from, $to);
        $jobStats = $this->rollupTotals($project, ['job-attempt', 'queued-job'], $period, $from, $to);

        $impactedUsers = $this->topUsers($project, 'exception', 'error_count', $period, $from, $to);
        $activeUsers = $this->topUsers($project, 'request', 'request_count', $period, $from, $to);

        $this->enrichUserRows($project, $impactedUsers);
        $this->enrichUserRows($project, $activeUsers);

        return [
            'total_requests' => (int) $requestStats->total,
            'request_breakdown' => [
                'ok' => (int) $requestStats->ok,
                'client_error' => (int) $requestStats->client_error,
                'server_error' => (int) $requestStats->server_error,
            ],
            'duration_stats' => $this->latencySummary($requestStats),
            'latency_histogram' => $this->latencyHistogram($requestStats),
            'previous' => $this->previousDashboardTotals($project, $period, $from, $to),
            'total_exceptions' => (int) $exceptionStats->total,
            'recent_issues' => $project->issues()->where('status', 'open')->latest('last_seen_at')->limit(5)->get(),
            'timeSeries' => $this->getDetailedTimeSeries($project, 'request', $period, $from, $to),
            'exceptionTimeSeries' => $this->getDetailedTimeSeries($project, 'exception', $period, $from, $to),
            'jobTimeSeries' => $this->getDetailedTimeSeries($project, 'job-attempt', $period, $from, $to),
            'job_stats' => [
                'total' => (int) $jobStats->total,
                'processed' => (int) $jobStats->ok,
                'failed' => (int) $jobStats->server_error,
                'released' => (int) $jobStats->neutral,
                'avg_duration' => round($this->avgDuration($jobStats) / 1000, 2),
                'p95_duration' => round($this->p95Duration($jobStats) / 1000, 2),
            ],
            'impacted_users' => $impactedUsers,
            'active_users' => $activeUsers,
            'auth_users_count' => $this->distinctUsers($project, 'request', $period, $from, $to),
            'guest_users_count' => (int) $requestStats->total - (int) $requestStats->authed,
            'period' => $period,
            'uptime_status' => [
                'current' => $project->last_uptime_status ?? 'unknown',
                'last_check' => $project->last_uptime_check_at ? $project->last_uptime_check_at->toIso8601String() : null,
                'url' => $project->url,
            ],
        ];
    }

    /**
     * The headline figures over the window before the period.
     *
     * @return array{requests: int, server_error: int, p95: float, exceptions: int, jobs: int, failed_jobs: int}
     */
    protected function previousDashboardTotals(Project $project, ?string $period, ?string $from, ?string $to): array
    {
        $requests = $this->previousRollupTotals($project, 'request', $period, $from, $to);
        $exceptions = $this->previousRollupTotals($project, 'exception', $period, $from, $to);
        $jobs = $this->previousRollupTotals($project, ['job-attempt', 'queued-job'], $period, $from, $to);

        return [
            'requests' => (int) $requests->total,
            'server_error' => (int) $requests->server_error,
            'p95' => round($this->latencyQuantile($requests, 0.95), 2),
            'exceptions' => (int) $exceptions->total,
            'jobs' => (int) $jobs->total,
            'failed_jobs' => (int) $jobs->server_error,
        ];
    }

    /**
     * Aggregate User Data
     */
    public function getUserStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $user = $this->jsonValue('user');
        $statusCode = $this->jsonNumeric('status_code');
        $userHash = "MD5(COALESCE({$this->jsonText('user')}, 'Anonymous'))";

        $requestTotals = $this->rollupTotals($project, 'request', $period, $from, $to);
        $authCount = $this->distinctUsers($project, 'request', $period, $from, $to);
        $totalAuthRequests = (int) $requestTotals->authed;
        $guestCount = (int) $requestTotals->total - $totalAuthRequests;

        $userKey = $this->col('user_key');
        $isRequest = $this->col('type')." = 'request'";
        $isException = $this->col('type')." = 'exception'";

        $users = RecordUserBucket::query()
            ->where('project_id', $project->id)
            ->forPeriod($period, $from, $to)
            ->select([
                DB::raw("{$userKey} as user_id"),
                DB::raw("{$userKey} as user_name"),
                DB::raw("'' as user_email"),
                DB::raw("MD5({$userKey}) as hash"),
                DB::raw("SUM(CASE WHEN {$isRequest} THEN ".$this->col('count').' ELSE 0 END) as total_requests'),
                DB::raw("SUM(CASE WHEN {$isRequest} THEN ".$this->col('error_count').' ELSE 0 END) as error_count'),
                DB::raw("SUM(CASE WHEN {$isException} THEN ".$this->col('count').' ELSE 0 END) as exception_count'),
                DB::raw('MAX('.$this->col('last_seen_at').') as last_seen'),
            ])
            ->groupBy('user_key')
            ->orderBy('last_seen', 'desc');

        // Counted as distinct users rather than by asking the database how
        // many rows the grouping produces: `paginate()` answers that by
        // running the whole aggregate a second time inside a subquery.
        $users = $this->paginateWithKnownTotal(
            $users,
            $this->distinctUsers($project, null, $period, $from, $to),
            perPage: 20,
        );

        return [
            'users' => $this->enrichUserPaginator($project, $users),
            'timeSeries' => $this->getDetailedTimeSeries($project, 'request', $period, $from, $to),
            'overview' => [
                'auth_users' => $authCount,
                'guest_requests' => $guestCount,
                'auth_requests' => $totalAuthRequests,
            ],
        ];
    }

    /**
     * Aggregate Job Data
     */
    public function getJobStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $types = ['job-attempt', 'queued-job'];

        $overview = $this->rollupTotals($project, $types, $period, $from, $to);

        $jobs = $this->groupList($project, $types, $period, $from, $to)
            ->through(function ($row) {
                $row->job_class = $row->label ?? 'Unknown Job';
                $row->processed_count = (int) $row->ok_count;
                $row->failed_count = (int) $row->server_error_count;

                return $row;
            });

        return [
            'jobs' => $jobs,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'job-attempt', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'processed' => (int) $overview->ok,
                'failed' => (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
                'max_duration' => round((float) ($overview->max_duration ?? 0), 2),
                'latency' => $this->latencySummary($overview),
                'histogram' => $this->latencyHistogram($overview),
            ],
        ];
    }

    /**
     * Exceptions Aggregation
     */
    public function getExceptionStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $userDistinct = $this->jsonDistinct('user');

        $overview = $this->rollupTotals($project, 'exception', $period, $from, $to);

        $uniqueTypes = $this->distinctGroups($project, 'exception', $period, $from, $to);

        $exceptions = $this->groupList($project, 'exception', $period, $from, $to, sort: 'last_seen');

        $userCounts = RecordGroupUserBucket::query()
            ->where('project_id', $project->id)
            ->where('type', 'exception')
            ->whereIn('group_key', collect($exceptions->items())->pluck('hash')->all())
            ->forPeriod($period, $from, $to)
            ->select('group_key', DB::raw('COUNT(DISTINCT '.$this->col('user_key').') as users'))
            ->groupBy('group_key')
            ->pluck('users', 'group_key');

        $exceptions->through(function ($row) use ($userCounts) {
            $row->class = $row->label;
            $row->message = $row->sublabel;
            $row->total_count = (int) $row->total;
            $row->user_count = (int) ($userCounts[$row->hash] ?? 0);

            return $row;
        });

        return [
            'exceptions' => $exceptions,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'exception', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'unique' => $uniqueTypes,
            ],
        ];
    }

    /**
     * Commands Aggregation
     */
    public function getCommandStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $exitCode = $this->jsonNumeric('exit_code');
        $duration = $this->jsonNumeric('duration');

        $overview = $this->rollupTotals($project, 'command', $period, $from, $to);

        $commands = $this->groupList($project, 'command', $period, $from, $to)
            ->through(function ($row) {
                $row->command_name = $row->label ?? 'Unknown Command';
                $row->success_count = (int) $row->ok_count;
                $row->failed_count = (int) $row->server_error_count;

                return $row;
            });

        return [
            'commands' => $commands,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'command', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'success' => (int) $overview->ok,
                'failed' => (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
                'latency' => $this->latencySummary($overview),
                'histogram' => $this->latencyHistogram($overview),
            ],
        ];
    }

    /**
     * Scheduled Tasks Aggregation
     */
    public function getScheduledTaskStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $exitCode = $this->jsonNumeric('exit_code');
        $exitCodeValue = $this->jsonValue('exit_code');
        $duration = $this->jsonNumeric('duration');
        $status = $this->jsonText('status');

        $overview = $this->rollupTotals($project, 'scheduled-task', $period, $from, $to);

        $tasks = $this->groupList($project, 'scheduled-task', $period, $from, $to)
            ->through(function ($task) {
                $task->command = $task->label ?? 'Unknown Task';
                $task->schedule = $task->sublabel;
                $task->processed_count = (int) $task->ok_count;
                $task->failed_count = (int) $task->server_error_count;
                $task->skipped_count = (int) $task->neutral_count;

                try {
                    if ($task->schedule) {
                        $cron = new CronExpression($task->schedule);
                        $task->next_run = $cron->getNextRunDate()->format('Y-m-d H:i:s');
                    } else {
                        $task->next_run = 'N/A';
                    }
                } catch (\Exception $e) {
                    $task->next_run = 'Invalid Schedule';
                }

                return $task;
            });

        return [
            'tasks' => $tasks,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'scheduled-task', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'success' => (int) $overview->ok,
                'failed' => (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
                'latency' => $this->latencySummary($overview),
                'histogram' => $this->latencyHistogram($overview),
            ],
        ];
    }

    /**
     * Query Aggregation
     */
    public function getQueryStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $duration = $this->jsonNumeric('duration');

        $overview = $this->rollupTotals($project, 'query', $period, $from, $to);

        $queries = $this->groupList($project, 'query', $period, $from, $to)
            ->through(function ($row) {
                $row->sql_query = $row->sublabel;
                $row->db_connection = $row->label ?? 'mysql';
                $row->total_calls = (int) $row->total;
                $row->total_duration = (float) $row->sum_duration;

                return $row;
            });

        return [
            'queries' => $queries,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'query', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'avg_duration' => round($this->avgDuration($overview), 2),
                'latency' => $this->latencySummary($overview),
                'histogram' => $this->latencyHistogram($overview),
            ],
        ];
    }

    /**
     * Outgoing Requests Aggregation
     */
    public function getOutgoingRequestStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $statusCode = $this->jsonNumeric('status_code');
        $status = $this->jsonNumeric('status');
        $resolvedStatus = "COALESCE({$statusCode}, {$status})";
        $duration = $this->jsonNumeric('duration');

        $overview = $this->rollupTotals($project, 'outgoing-request', $period, $from, $to);

        $hosts = $this->groupList($project, 'outgoing-request', $period, $from, $to)
            ->through(function ($row) {
                $row->host = $row->label;

                return $row;
            });

        return [
            'hosts' => $hosts,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'outgoing-request', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'ok' => (int) $overview->ok,
                'client_error' => (int) $overview->client_error,
                'server_error' => (int) $overview->server_error,
                'failed' => (int) $overview->client_error + (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
                'latency' => $this->latencySummary($overview),
                'histogram' => $this->latencyHistogram($overview),
            ],
        ];
    }

    /**
     * Cache Aggregation
     */
    public function getCacheStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $cacheType = $this->jsonText('type');

        $overview = $this->rollupTotals($project, 'cache-event', $period, $from, $to);

        $keys = $this->groupList($project, 'cache-event', $period, $from, $to)
            ->through(function ($row) {
                $row->cache_key = $row->label;
                $row->hit_rate = $row->total > 0 ? round(((int) $row->hits / (int) $row->total) * 100, 2) : 0;

                return $row;
            });

        return [
            'keys' => $keys,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'cache-event', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'hits' => (int) $overview->hits,
                'misses' => (int) $overview->misses,
                'hit_rate' => $overview->total > 0 ? round(((int) $overview->hits / (int) $overview->total) * 100, 2) : 0,
            ],
        ];
    }

    /**
     * Notification Aggregation
     */
    public function getNotificationStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $channel = $this->jsonDistinct('channel');
        $status = $this->jsonText('status');

        $overview = $this->rollupTotals($project, 'notification', $period, $from, $to);

        $channelsCount = $this->distinctGroups($project, 'notification', $period, $from, $to, 'sublabel');

        $notifications = $this->groupList($project, 'notification', $period, $from, $to)
            ->through(function ($row) {
                $row->notification_class = $row->label;
                $row->channel = $row->sublabel;
                $row->failed_count = (int) $row->server_error_count;
                $row->sent_count = (int) $row->total - $row->failed_count;

                return $row;
            });

        return [
            'notifications' => $notifications,
            'overview' => [
                'total' => (int) $overview->total,
                'channels' => $channelsCount,
            ],
        ];
    }

    /**
     * Mail Aggregation
     */
    public function getMailStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $mailer = $this->jsonText('mailer');

        $overview = $this->rollupTotals($project, 'mail', $period, $from, $to);

        $uniqueMailables = $this->distinctGroups($project, 'mail', $period, $from, $to);

        $mailables = $this->groupList($project, 'mail', $period, $from, $to)
            ->through(function ($row) {
                $row->mailable_class = $row->label;
                $row->queued_count = (int) $row->ok_count;

                return $row;
            });

        return [
            'mailables' => $mailables,
            'overview' => [
                'total' => (int) $overview->total,
                'unique' => $uniqueMailables,
            ],
        ];
    }

    /**
     * Unified History Retriever via Fingerprint
     */
    public function getHistoryByHash(Project $project, string $hash, ?string $period = null, ?string $from = null, ?string $to = null): LengthAwarePaginator
    {
        return $project->records()
            ->where('fingerprint', $hash)
            ->forPeriod($period, $from, $to)
            ->latest()
            ->paginate(50)
            ->withQueryString()
            ->through(function ($record) {
                if (isset($record->payload['payload']) && is_array($record->payload['payload'])) {
                    $record->payload = array_merge($record->payload, $record->payload['payload']);
                }

                return $record;
            });
    }

    /**
     * Get specific user history with additional stats
     */
    public function getUserHistory(Project $project, string $hash, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $userKey = $this->resolveUserKeyFromHash($project, $hash);

        $records = $project->records()
            ->where('user_key', $userKey)
            ->forPeriod($period, $from, $to)
            ->latest()
            ->paginate(50)
            ->withQueryString();

        $first = $records->first();
        $user_name = 'Anonymous';
        $user_email = '';
        $user_id = 'Anonymous';

        if ($first) {
            $p = $first->payload;
            $user_name = $p['user']['name'] ?? $p['user_name'] ?? $p['user'] ?? 'Anonymous';
            $user_email = $p['user']['email'] ?? $p['user_email'] ?? '';
            $user_id = $p['user']['id'] ?? $p['user'] ?? 'Anonymous';
        }

        $details = $this->userDetailsByIds($project, [$user_id]);

        if (isset($details[(string) $user_id])) {
            $user_name = $details[(string) $user_id]['name'] ?: $user_name;
            $user_email = $details[(string) $user_id]['email'] ?: $user_email;
        }

        return [
            'user_name' => $user_name,
            'user_email' => $user_email,
            'user_id' => $user_id,
            'user_identifier' => $user_name, // legacy support
            'records' => $records,
            'stats' => $project->records()->forPeriod($period, $from, $to)
                ->where('user_key', $userKey)
                ->select([
                    DB::raw('COUNT(*) as total'),
                    DB::raw('MIN(created_at) as first_seen'),
                    DB::raw('MAX(created_at) as last_seen'),
                ])->first(),
        ];
    }

    /**
     * Searched over `record_user_buckets`, which holds one row per user per
     * hour rather than one per record.
     */
    protected function resolveUserKeyFromHash(Project $project, string $hash): ?string
    {
        return RecordUserBucket::query()
            ->where('project_id', $project->id)
            ->whereRaw('MD5('.$this->col('user_key').') = ?', [$hash])
            ->value('user_key');
    }

    /**
     * Get general stats methods for other types (Mails, Notifications, etc.)
     */
    public function getMonitoringStats(Project $project, string $type, array $fields, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $select = ['fingerprint as hash', DB::raw('COUNT(*) as total')];
        $groupBy = ['fingerprint'];

        foreach ($fields as $alias => $path) {
            $select[] = DB::raw("{$this->jsonText($path)} as {$alias}");
            $groupBy[] = $alias;
        }

        $key = Str::plural(str_replace('-', '_', $type));

        return [
            $key => $project->records()
                ->ofType($type)
                ->forPeriod($period, $from, $to)
                ->select($select)
                ->groupBy($groupBy)
                ->paginate(20)->withQueryString(),
        ];
    }

    /**
     * Get paginated logs with flattened payload if needed.
     */
    public function getLogRecords(Project $project, ?string $search = null, ?string $period = null, ?string $from = null, ?string $to = null): LengthAwarePaginator
    {
        return $this->paginateRawRecords($project, 'log', $search, $period, $from, $to, searchMessage: true)
            ->through(function ($record) {
                if (isset($record->payload['payload']) && is_array($record->payload['payload'])) {
                    $record->payload = array_merge($record->payload, $record->payload['payload']);
                }

                return $record;
            });
    }

    /**
     * Common method to paginate records for a specific type.
     */
    public function getPaginatedRecords(Project $project, string $type, ?string $search = null, ?string $period = null, ?string $from = null, ?string $to = null): LengthAwarePaginator
    {
        return $this->paginateRawRecords($project, $this->resolveRecordType($type), $search, $period, $from, $to);
    }

    /**
     * A page of raw records, counted by the rollups rather than by the database.
     */
    protected function paginateRawRecords(Project $project, string $type, ?string $search, ?string $period, ?string $from, ?string $to, bool $searchMessage = false): LengthAwarePaginator
    {
        $query = $project->records()
            ->ofType($type)
            ->forPeriod($period, $from, $to)
            ->latest();

        if ($search) {
            if ($searchMessage) {
                $this->applyMessageSearch($query, $search);
            } else {
                $query->where('payload', 'like', '%'.$search.'%');
            }

            return $query->paginate(50)->withQueryString();
        }

        // Sampled types keep fewer raw rows than the rollups count, so their
        // total has to come from the rows themselves.
        if (in_array($type, DetailSampler::DETAIL_TYPES, true)) {
            return $query->paginate(50)->withQueryString();
        }

        return $this->paginateWithKnownTotal($query, $this->rollupCount($project, $type, $period, $from, $to));
    }

    /**
     * Search the FULLTEXT-indexed `message` column.
     *
     * Uses the index on MySQL/MariaDB and PostgreSQL. FULLTEXT ignores tokens
     * shorter than its minimum length, and SQLite has no such index, so those
     * cases fall back to a LIKE over the same narrow column — still far cheaper
     * than scanning the JSON payload.
     *
     * @param  Builder<Record>|HasMany<Record, Project>  $query
     */
    protected function applyMessageSearch($query, string $search): void
    {
        $term = trim($search);
        $driver = DB::connection()->getDriverName();

        if ($term !== '' && mb_strlen($term) >= 3 && in_array($driver, ['mysql', 'mariadb', 'pgsql'], true)) {
            $query->whereFullText('message', $term);

            return;
        }

        $query->where('message', 'like', '%'.$term.'%');
    }

    /**
     * Map a route segment onto the record type the client emits.
     */
    protected function resolveRecordType(string $type): string
    {
        return [
            'job' => 'job-attempt',
            'cache' => 'cache-event',
        ][$type] ?? $type;
    }

    /**
     * Security Threats Aggregation
     */
    public function getSecurityStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $records = $project->records()->ofType('request')->forPeriod($period, $from, $to);
        $status = $this->jsonText('status');

        $uniqueIps = RecordIpBucket::query()
            ->where('project_id', $project->id)
            ->where('type', 'request')
            ->forPeriod($period, $from, $to)
            ->distinct()
            ->count('ip');

        $totalRequests = $this->rollupCount($project, 'request', $period, $from, $to);

        $overview = (object) [
            'unique_ips' => $uniqueIps,
            'total_requests' => $totalRequests,
        ];

        // Failed logins (last 24h or selected period)
        $failedLogins = $project->records()
            ->ofType('auth-event')
            ->forPeriod($period, $from, $to)
            ->whereRaw("{$status} = 'failed'")
            ->count();

        // Recent suspicious auth events
        $recentAuthEvents = $project->records()
            ->ofType('auth-event')
            ->forPeriod($period, $from, $to)
            ->whereRaw("{$status} = 'failed'")
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn ($r) => [
                'user' => $r->payload['user'] ?? $r->payload['email'] ?? 'Anonymous',
                'ip' => $r->payload['ip'] ?? 'Unknown',
                'type' => $r->payload['event_type'] ?? 'Login Failure',
                'location' => $r->payload['location'] ?? 'Unknown',
                'time' => $r->created_at->diffForHumans(),
            ]);

        return [
            'threats' => $project->issues()
                ->where('type', 'security')
                ->where('project_id', $project->id)
                ->select([
                    'id',
                    'hash',
                    'title',
                    'message',
                    'occurrences_count',
                    'last_seen_at',
                ])
                ->orderBy('last_seen_at', 'desc')
                ->paginate(20)->withQueryString(),
            'overview' => [
                'unique_ips' => (int) ($overview->unique_ips ?? 0),
                'total_scanned' => (int) ($overview->total_requests ?? 0),
                'failed_logins' => $failedLogins,
                'recent_auth_events' => $recentAuthEvents,
            ],
        ];
    }

    /**
     * One chart point per slot of the period's grid (see TimeSlots), gap
     * filled so every chart keeps its shape. Each point carries its start as
     * unix seconds (`t`) for the browser to label in local time, the status
     * split, and the latency picture: mean, estimated p50/p95 and the max.
     *
     * @return list<array<string, int|float|string|null>>
     */
    protected function getDetailedTimeSeries(Project $project, string $type, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $period = $period ?: '1h';
        $grid = TimeSlots::for($period, $from, $to);
        $slotSql = TimeSlots::sql($grid->slot, $this->col('bucket'));

        $sum = fn (string $column, string $alias) => DB::raw('SUM('.$this->col($column).') as '.$this->col($alias));

        $columns = [
            DB::raw("{$slotSql} as slot_index"),
            $sum('count', 'total'),
            $sum('ok_count', 'ok'),
            $sum('client_error_count', 'client_error'),
            $sum('server_error_count', 'server_error'),
            $sum('hits', 'hits'),
            $sum('misses', 'misses'),
            $sum('writes', 'writes'),
            $sum('authed_count', 'authed'),
            $sum('sum_duration', 'sum_duration'),
            $sum('count_duration', 'count_duration'),
            DB::raw('MAX('.$this->col('max_duration').') as max_duration'),
            DB::raw('MIN('.$this->col('min_duration').') as min_duration'),
        ];

        foreach (RollupWriter::latencyColumns() as $column) {
            $columns[] = $sum($column, $column);
        }

        $rows = RecordRollup::query()
            ->where('project_id', $project->id)
            ->where('type', $type)
            ->forPeriod($period, $from, $to)
            ->select($columns)
            ->groupBy('slot_index')
            ->get()
            ->keyBy(fn ($row) => (int) $row->slot_index);

        // User buckets are hourly, so a grid finer than an hour shows each
        // point the distinct users of the hour it falls in.
        $userSlot = max($grid->slot, 3600);
        $activeUsers = RecordUserBucket::query()
            ->where('project_id', $project->id)
            ->where('type', $type)
            ->forPeriod($period, $from, $to)
            ->select([
                DB::raw(TimeSlots::sql($userSlot, $this->col('bucket')).' as slot_index'),
                DB::raw('COUNT(DISTINCT '.$this->col('user_key').') as active_users'),
            ])
            ->groupBy('slot_index')
            ->pluck('active_users', 'slot_index')
            ->mapWithKeys(fn ($count, $index) => [(int) $index => (int) $count]);

        $labelFormat = $grid->withinADay() ? 'H:i' : 'd/m H:i';

        return array_map(function (int $index) use ($grid, $rows, $activeUsers, $userSlot, $labelFormat) {
            $start = $index * $grid->slot;
            $row = $rows->get($index);
            $total = (int) ($row->total ?? 0);
            $authed = (int) ($row->authed ?? 0);

            // A slot with nothing timed has no latency rather than a zero one,
            // so lines break there instead of diving to the axis.
            $timed = $row && (int) $row->count_duration > 0 ? $row : null;

            return [
                't' => $start,
                'minute' => Carbon::createFromTimestamp($start, config('app.timezone'))->format($labelFormat),
                'total' => $total,
                'ok' => (int) ($row->ok ?? 0),
                'client_error' => (int) ($row->client_error ?? 0),
                'server_error' => (int) ($row->server_error ?? 0),
                'avg_duration' => $timed ? round($this->avgDuration($timed), 2) : null,
                'p50_duration' => $timed ? round($this->latencyQuantile($timed, 0.5), 2) : null,
                'p95_duration' => $timed ? round($this->latencyQuantile($timed, 0.95), 2) : null,
                'max_duration' => $timed ? round((float) $timed->max_duration, 2) : null,
                'hits' => (int) ($row->hits ?? 0),
                'misses' => (int) ($row->misses ?? 0),
                'writes' => (int) ($row->writes ?? 0),
                'active_users' => $activeUsers[intdiv($start, $userSlot)] ?? 0,
                'total_requests' => $total,
                'authed' => $authed,
                'guest' => max($total - $authed, 0),
            ];
        }, $grid->indexes());
    }

    private function enrichUserPaginator(Project $project, LengthAwarePaginator $paginator): LengthAwarePaginator
    {
        $this->enrichUserRows($project, $paginator->getCollection());

        return $paginator;
    }

    private function enrichUserRows(Project $project, iterable $rows): void
    {
        $ids = collect($rows)
            ->map(fn ($row) => (string) ($row->user_id ?? $row->user_identifier ?? $row->user_name ?? ''))
            ->filter(fn (string $id) => $id !== '' && $id !== 'Anonymous')
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return;
        }

        $details = $this->userDetailsByIds($project, $ids->all());

        foreach ($rows as $row) {
            $id = (string) ($row->user_id ?? $row->user_identifier ?? $row->user_name ?? '');
            $detail = $details[$id] ?? null;

            if (! $detail) {
                continue;
            }

            if (($row->user_name ?? $row->user_identifier ?? '') === $id && $detail['name'] !== '') {
                $row->user_name = $detail['name'];
                $row->user_identifier = $detail['name'];
            }

            if (($row->user_email ?? '') === '' && $detail['email'] !== '') {
                $row->user_email = $detail['email'];
            }
        }
    }

    /**
     * @param  array<int, int|string>  $ids
     * @return array<string, array{name: string, email: string}>
     */
    private function userDetailsByIds(Project $project, array $ids): array
    {
        $ids = collect($ids)
            ->map(fn (int|string $id): string => (string) $id)
            ->filter(fn (string $id): bool => $id !== '' && $id !== 'Anonymous')
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        $details = [];

        $project->records()
            ->ofType('user')
            ->whereIn(DB::raw($this->jsonText('id')), $ids->all())
            ->latest()
            ->get(['payload'])
            ->each(function ($record) use (&$details): void {
                $payload = $record->payload;
                $id = (string) ($payload['id'] ?? '');

                if ($id === '' || isset($details[$id])) {
                    return;
                }

                $username = (string) ($payload['username'] ?? '');

                $details[$id] = [
                    'name' => (string) ($payload['name'] ?? ''),
                    'email' => filter_var($payload['email'] ?? $username, FILTER_VALIDATE_EMAIL) ? (string) ($payload['email'] ?? $username) : '',
                ];
            });

        return $details;
    }

    public function getUptimeStats(Project $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        if (! $project->hasUptimeMonitoring()) {
            return [
                'checks' => new LengthAwarePaginator([], 0, 50),
                'uptime_stats' => [
                    'uptime_percentage' => 0,
                    'avg_response_time' => 0,
                    'last_check' => null,
                    'total_checks' => 0,
                ],
            ];
        }

        $query = $project->uptimeChecks()
            ->orderBy('checked_at', 'desc');

        if ($period && $period !== 'all') {
            $minutes = match ($period) {
                '1h' => 60,
                '24h' => 1440,
                '7d' => 10080,
                '30d' => 43200,
                default => 1440
            };
            $query->where('checked_at', '>=', now()->subMinutes($minutes));
        }

        $checks = $query->paginate(50)->withQueryString();

        $totalChecks = $project->uptimeChecks()->count();
        $upChecks = $project->uptimeChecks()->where('status', 'up')->count();

        $stats = [
            'uptime_percentage' => $totalChecks > 0 ? round(($upChecks / $totalChecks) * 100, 2) : 100,
            'avg_response_time' => round($project->uptimeChecks()->avg('response_time') ?? 0, 2),
            'last_check' => $project->uptimeChecks()->latest('checked_at')->first(),
            'total_checks' => $totalChecks,
        ];

        return [
            'checks' => $checks,
            'uptime_stats' => $stats,
        ];
    }

    public function getSecurityHistoryByHash(Project $project, string $hash, ?string $period = '24h', ?string $from = null, ?string $to = null): array
    {
        $issue = $project->issues()
            ->where('hash', $hash)
            ->firstOrFail();

        $records = $project->records()
            ->where(function ($q) use ($hash, $issue) {
                $q->where('issue_id', $issue->id)
                    ->orWhere(function ($sq) use ($hash) {
                        $sq->where('type', 'request')
                            ->where(function ($ssq) use ($hash) {
                                $ssq->whereJsonContains('payload->_security_threats', [['hash' => $hash]])
                                    ->orWhereJsonContains('payload->_security_changes', [['hash' => $hash]]);
                            });
                    });
            })
            ->forPeriod($period, $from, $to)
            ->orderBy('created_at', 'desc')
            ->paginate(50)
            ->withQueryString();

        return [
            'hash' => $hash,
            'meta' => [
                'title' => $issue->title,
                'message' => $issue->message,
                'occurrences' => $issue->occurrences_count,
                'last_seen_at' => $issue->last_seen_at,
            ],
            'records' => $records,
            'period' => $period,
        ];
    }

    private function isPgsql(): bool
    {
        return DB::connection()->getDriverName() === 'pgsql';
    }

    private function jsonPathSegments(string $path): array
    {
        return explode('.', $path);
    }

    private function quoteLiteral(string $value): string
    {
        return "'".str_replace("'", "''", $value)."'";
    }

    private function jsonValue(string $path): string
    {
        if ($this->isPgsql()) {
            $segments = array_map([$this, 'quoteLiteral'], $this->jsonPathSegments($path));

            return 'payload #> ARRAY['.implode(', ', $segments).']';
        }

        return "JSON_EXTRACT(payload, '$.".$path."')";
    }

    private function jsonText(string $path): string
    {
        if ($this->isPgsql()) {
            $segments = array_map([$this, 'quoteLiteral'], $this->jsonPathSegments($path));

            return 'payload #>> ARRAY['.implode(', ', $segments).']';
        }

        return "JSON_UNQUOTE(JSON_EXTRACT(payload, '$.".$path."'))";
    }

    private function jsonNumeric(string $path): string
    {
        $text = $this->jsonText($path);

        if ($this->isPgsql()) {
            $trimmed = "NULLIF(BTRIM({$text}), '')";

            return "CASE WHEN {$trimmed} ~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN ({$trimmed})::numeric ELSE NULL END";
        }

        return "CAST(NULLIF({$text}, '') AS DECIMAL(20,6))";
    }

    private function jsonDistinct(string $path): string
    {
        if ($this->isPgsql()) {
            return '('.$this->jsonValue($path).')::text';
        }

        return 'CAST('.$this->jsonValue($path).' AS CHAR)';
    }

    /**
     * Quote an identifier for the active driver.
     */
    private function col(string $name): string
    {
        return DB::connection()->getQueryGrammar()->wrap($name);
    }

    /**
     * Paginate raw records without asking the database to count them.
     *
     * @param  Builder<Record>|HasMany<Record, Project>  $query
     */
    protected function paginateWithKnownTotal($query, int $total, int $perPage = 50): LengthAwarePaginator
    {
        $page = Paginator::resolveCurrentPage();

        $items = $total === 0
            ? collect()
            : $query->forPage($page, $perPage)->get();

        return new LengthAwarePaginator($items, $total, $perPage, $page, [
            'path' => Paginator::resolveCurrentPath(),
            'query' => request()->query(),
        ]);
    }

    /**
     * How many records of these types the rollups counted over the period.
     *
     * @param  string|list<string>  $types
     */
    protected function rollupCount(Project $project, string|array $types, ?string $period, ?string $from, ?string $to): int
    {
        return (int) RecordRollup::query()
            ->where('project_id', $project->id)
            ->whereIn('type', (array) $types)
            ->forPeriod($period, $from, $to)
            ->sum('count');
    }

    /**
     * Distinct groups of a type over the period, straight off the group rollups.
     */
    protected function distinctGroups(Project $project, string|array $types, ?string $period, ?string $from, ?string $to, string $column = 'group_key'): int
    {
        return RecordGroupRollup::query()
            ->where('project_id', $project->id)
            ->whereIn('type', (array) $types)
            ->forPeriod($period, $from, $to)
            ->distinct()
            ->count($column);
    }

    /**
     * Sum the pre-aggregated counters for the given record types over a period.
     *
     * @param  string|list<string>  $types
     */
    protected function rollupTotals(Project $project, string|array $types, ?string $period = null, ?string $from = null, ?string $to = null): object
    {
        return RecordRollup::query()
            ->where('project_id', $project->id)
            ->whereIn('type', (array) $types)
            ->forPeriod($period, $from, $to)
            ->select($this->rollupTotalColumns())
            ->first();
    }

    /**
     * The same counters for the window just before the period, as long as it,
     * so a figure can say how it moved.
     *
     * @param  string|list<string>  $types
     */
    protected function previousRollupTotals(Project $project, string|array $types, ?string $period = null, ?string $from = null, ?string $to = null): object
    {
        [$start, $end] = $this->periodWindow($period, $from, $to);
        $length = $start->diffInSeconds($end, true);

        return RecordRollup::query()
            ->where('project_id', $project->id)
            ->whereIn('type', (array) $types)
            ->where('bucket', '>=', $start->copy()->subSeconds((int) $length))
            ->where('bucket', '<', $start)
            ->select($this->rollupTotalColumns())
            ->first();
    }

    /**
     * The window a period covers, matching RecordRollup::scopeForPeriod().
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function periodWindow(?string $period, ?string $from = null, ?string $to = null): array
    {
        if ($period === 'custom' && $from && $to) {
            try {
                $start = Carbon::parse($from);
                $end = Carbon::parse($to);

                if ($start->lt($end)) {
                    return [$start, $end];
                }
            } catch (\Throwable) {
                // An unparseable range falls back to the default period.
            }
        }

        return [Carbon::instance(Record::periodStartsAt($period)->startOfMinute()), now()];
    }

    /**
     * @return list<Expression>
     */
    private function rollupTotalColumns(): array
    {
        $sum = fn (string $column, string $alias) => DB::raw('COALESCE(SUM('.$this->col($column).'), 0) as '.$alias);

        $columns = [
            $sum('count', 'total'),
            $sum('ok_count', 'ok'),
            $sum('client_error_count', 'client_error'),
            $sum('server_error_count', 'server_error'),
            $sum('neutral_count', 'neutral'),
            $sum('hits', 'hits'),
            $sum('misses', 'misses'),
            $sum('writes', 'writes'),
            $sum('authed_count', 'authed'),
            $sum('sum_duration', 'sum_duration'),
            $sum('count_duration', 'count_duration'),
            DB::raw('MAX('.$this->col('max_duration').') as max_duration'),
            DB::raw('MIN('.$this->col('min_duration').') as min_duration'),
        ];

        foreach (RollupWriter::latencyColumns() as $column) {
            $columns[] = $sum($column, $column);
        }

        return $columns;
    }

    /**
     * The mean duration. Averages are not additive, so they are recomputed from
     */
    protected function avgDuration(object $totals): float
    {
        $count = (int) ($totals->count_duration ?? 0);

        return $count > 0 ? ((float) $totals->sum_duration) / $count : 0.0;
    }

    /**
     * An approximate 95th percentile, read off the latency histogram.
     */
    protected function p95Duration(object $totals): float
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

    /**
     * A latency quantile estimated from the histogram: linear inside the
     * bucket the quantile falls in, as Prometheus' histogram_quantile does,
     * and kept within the fastest and slowest durations actually seen.
     * Unlike p95Duration(), which returns the bucket's upper bound, this
     * moves smoothly enough to draw as a line.
     */
    protected function latencyQuantile(object $totals, float $quantile): float
    {
        $samples = (int) ($totals->count_duration ?? 0);

        if ($samples === 0) {
            return 0.0;
        }

        $target = $quantile * $samples;
        $cumulative = 0;
        $lower = 0;
        $estimate = null;

        foreach (RollupWriter::LATENCY_BOUNDARIES as $boundary) {
            $inBucket = (int) ($totals->{'lat_le_'.$boundary} ?? 0);

            if ($inBucket > 0 && $cumulative + $inBucket >= $target) {
                $estimate = $lower + ($boundary - $lower) * (($target - $cumulative) / $inBucket);
                break;
            }

            $cumulative += $inBucket;
            $lower = $boundary;
        }

        $max = isset($totals->max_duration) ? (float) $totals->max_duration : null;
        $min = isset($totals->min_duration) ? (float) $totals->min_duration : null;
        $estimate ??= $max ?? (float) $lower;

        if ($max !== null && $max > 0) {
            $estimate = min($estimate, $max);
        }

        if ($min !== null) {
            $estimate = max($estimate, $min);
        }

        return $estimate;
    }

    /**
     * How many samples fell in each latency bucket, fastest first.
     *
     * @return list<array{le: int|null, count: int}>
     */
    protected function latencyHistogram(object $totals): array
    {
        $buckets = array_map(fn (int $boundary) => [
            'le' => $boundary,
            'count' => (int) ($totals->{'lat_le_'.$boundary} ?? 0),
        ], RollupWriter::LATENCY_BOUNDARIES);

        $buckets[] = ['le' => null, 'count' => (int) ($totals->lat_le_inf ?? 0)];

        return $buckets;
    }

    /**
     * The latency figures a chart header shows.
     *
     * @return array{avg: float, min: float, max: float, p50: float, p95: float, p99: float}
     */
    protected function latencySummary(object $totals): array
    {
        return [
            'avg' => round($this->avgDuration($totals), 2),
            'min' => round((float) ($totals->min_duration ?? 0), 2),
            'max' => round((float) ($totals->max_duration ?? 0), 2),
            'p50' => round($this->latencyQuantile($totals, 0.5), 2),
            'p95' => round($this->latencyQuantile($totals, 0.95), 2),
            'p99' => round($this->latencyQuantile($totals, 0.99), 2),
        ];
    }

    /**
     * The grouped list behind a type's top-N page, read from the group rollups.
     *
     * @param  string|list<string>  $types
     * @param  array<string, string>  $extraColumns  alias => SQL aggregate
     * @param  array<string, string>  $sortMap  request sort key => SQL alias
     */
    protected function groupList(
        Project $project,
        string|array $types,
        ?string $period,
        ?string $from,
        ?string $to,
        array $extraColumns = [],
        string $sort = 'total',
        string $direction = 'desc',
        array $sortMap = [],
    ): LengthAwarePaginator {
        $sum = fn (string $column, string $alias) => DB::raw('SUM('.$this->col($column).') as '.$alias);

        $columns = [
            DB::raw($this->col('group_key').' as hash'),
            DB::raw('MAX('.$this->col('label').') as label'),
            DB::raw('MAX('.$this->col('sublabel').') as sublabel'),
            $sum('count', 'total'),
            $sum('ok_count', 'ok_count'),
            $sum('client_error_count', 'client_error_count'),
            $sum('server_error_count', 'server_error_count'),
            $sum('neutral_count', 'neutral_count'),
            $sum('hits', 'hits'),
            $sum('misses', 'misses'),
            $sum('writes', 'writes'),
            $sum('deletes', 'deletes'),
            $sum('sum_duration', 'sum_duration'),
            $sum('count_duration', 'count_duration'),
            DB::raw('MAX('.$this->col('max_duration').') as max_duration'),
            DB::raw('MIN('.$this->col('min_duration').') as min_duration'),
            DB::raw('MAX('.$this->col('last_seen_at').') as last_seen'),
            DB::raw('SUM('.$this->col('sum_duration').') / NULLIF(SUM('.$this->col('count_duration').'), 0) as avg_duration'),
        ];

        foreach (RollupWriter::latencyColumns() as $column) {
            $columns[] = $sum($column, $column);
        }

        foreach ($extraColumns as $alias => $expression) {
            $columns[] = DB::raw($expression.' as '.$alias);
        }

        $orderBy = $sortMap[$sort] ?? $sort;

        $groups = RecordGroupRollup::query()
            ->where('project_id', $project->id)
            ->whereIn('type', (array) $types)
            ->forPeriod($period, $from, $to)
            ->select($columns)
            ->groupBy('group_key')
            ->orderBy($orderBy, $direction);

        return $this->paginateWithKnownTotal(
            $groups,
            $this->distinctGroups($project, $types, $period, $from, $to),
            perPage: 20,
        )
            ->through(function ($row) {
                $row->p95_duration = $this->p95Duration($row);
                $row->avg_duration = round((float) $row->avg_duration, 2);

                return $row;
            });
    }

    /**
     * The five users producing the most records of a type over a period.
     *
     * @return Collection<int, object>
     */
    protected function topUsers(Project $project, string $type, string $countAlias, ?string $period = null, ?string $from = null, ?string $to = null)
    {
        return RecordUserBucket::query()
            ->where('project_id', $project->id)
            ->where('type', $type)
            ->forPeriod($period, $from, $to)
            ->select([
                DB::raw($this->col('user_key').' as user_id'),
                DB::raw($this->col('user_key').' as user_identifier'),
                DB::raw("'' as user_email"),
                DB::raw('SUM('.$this->col('count').') as '.$countAlias),
                DB::raw('MAX('.$this->col('bucket').') as last_seen'),
            ])
            ->groupBy('user_key')
            ->orderByDesc($countAlias)
            ->limit(5)
            ->get();
    }

    /**
     * Distinct users seen for a type over a period.
     */
    protected function distinctUsers(Project $project, string|array|null $types = null, ?string $period = null, ?string $from = null, ?string $to = null): int
    {
        return RecordUserBucket::query()
            ->where('project_id', $project->id)
            ->when($types !== null, fn ($query) => $query->whereIn('type', (array) $types))
            ->forPeriod($period, $from, $to)
            ->distinct()
            ->count('user_key');
    }
}
