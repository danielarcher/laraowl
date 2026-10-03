<?php

namespace App\Services;

use App\Events\ProjectDataIngested;
use App\Models\Issue;
use App\Models\Project;
use App\Models\Record;
use App\Models\RecordRollup;
use App\Models\Threshold;
use Illuminate\Database\Eloquent\Casts\Json;
use Illuminate\Database\Eloquent\JsonEncodingException;
use Illuminate\Support\Facades\DB;

class IngestService
{
    protected AlertService $alertService;

    protected SecurityService $securityService;

    protected RollupWriter $rollupWriter;

    /**
     * Cached for the lifetime of one ingest call.
     *
     * @var array<string, Threshold>|null
     */
    protected ?array $thresholds = null;

    protected DetailSampler $detailSampler;

    /**
     * Types whose record is handed on after it is stored (issue grouping,
     * security analysis), so they need a model rather than a bulk insert.
     */
    private const FOLLOWED_UP_TYPES = ['exception', 'request', 'security-audit'];

    public function __construct(AlertService $alertService, SecurityService $securityService, RollupWriter $rollupWriter, ?DetailSampler $detailSampler = null)
    {
        $this->alertService = $alertService;
        $this->securityService = $securityService;
        $this->rollupWriter = $rollupWriter;
        $this->detailSampler = $detailSampler ?? new DetailSampler($rollupWriter);
    }

    /**
     * Process incoming records and handle issue grouping.
     */
    public function ingest(Project $project, array $records): void
    {
        $this->thresholds = null;
        $plan = $this->detailSampler->plan($records);

        DB::transaction(function () use ($project, $records, $plan) {
            if (DB::connection()->getDriverName() === 'pgsql') {
                // A crash may lose the last moment of monitoring data, never
                // corrupt it. Not waiting for the WAL flush on every batch
                // frees the small disk for everything else.
                DB::statement('SET LOCAL synchronous_commit TO OFF');
            }

            $batch = [];
            $rows = [];
            $exceptions = 0;
            $createdAt = now();

            foreach ($records as $index => $data) {
                $type = $data['t'] ?? null;
                if (! $type) {
                    continue;
                }

                $fingerprint = $this->calculateFingerprint($type, $data);
                $traceId = $this->rollupWriter->traceIdFor($data);

                // Every record is counted, whether or not its raw row is kept.
                $batch[] = [
                    'type' => $type,
                    'payload' => $data,
                    'fingerprint' => $fingerprint,
                    'created_at' => $createdAt,
                ];

                $threshold = $this->thresholdFor($project, $type, $data);

                if (! $plan['keep'][$index] && ! $threshold) {
                    continue;
                }

                // A parent whose detail was thinned says how much, so its
                // trace view can tell a fast request from a query-free one.
                if ($dropped = $plan['dropped'][$traceId ?? ''] ?? null) {
                    if (in_array($type, ['request', 'command', 'scheduled-task', 'job-attempt'], true)) {
                        $data['_detail_dropped'] = $dropped;
                    }
                }

                $columns = [
                    'project_id' => $project->id,
                    'type' => $type,
                    'payload' => $data,
                    'fingerprint' => $fingerprint,
                    'user_key' => $this->rollupWriter->rawUserKeyFor($data),
                    'ip' => $this->rollupWriter->ipFor($data),
                    'trace_id' => $traceId,
                    'message' => $this->rollupWriter->messageFor($type, $data),
                    'created_at' => $createdAt,
                ];

                if ($type === 'heartbeat') {
                    $this->touchHeartbeat($project, $data);
                }

                // Most rows are never looked at again during ingest, so they
                // go in one multi-row insert instead of a model each.
                if (! $threshold && ! in_array($type, self::FOLLOWED_UP_TYPES, true)) {
                    $rows[] = $this->rawRow($columns);

                    continue;
                }

                // Rows queued so far go in first, so ids keep arrival order.
                $this->insertRows($rows);
                $record = $project->records()->create($columns);

                if ($type === 'exception') {
                    $exceptions++;
                    $this->handleException($project, $record);
                }

                if ($type === 'request') {
                    $this->securityService->analyze($project, $record);
                }

                if ($type === 'security-audit') {
                    $this->securityService->audit($project, $record);
                }

                if ($threshold) {
                    $this->handleSlowPerformance($project, $record, $threshold);
                }
            }

            $this->insertRows($rows);
            $this->rollupWriter->record($project, $batch);

            // After the rollups, so the batch that just arrived is counted,
            // and once for the batch rather than once per exception in it.
            if ($exceptions > 0) {
                $this->detectErrorSpike($project);
            }
        });

        ProjectDataIngested::dispatch($project);
    }

    /**
     * Writes the queued raw rows in multi-row inserts and empties the queue.
     *
     * @param  list<array<string, mixed>>  $rows
     */
    protected function insertRows(array &$rows): void
    {
        foreach (array_chunk($rows, 500) as $chunk) {
            Record::query()->insert($chunk);
        }

        $rows = [];
    }

    /**
     * A record's columns as a raw insert needs them: the payload encoded the
     * way the model's array cast would.
     *
     * @param  array<string, mixed>  $columns
     * @return array<string, mixed>
     */
    protected function rawRow(array $columns): array
    {
        $payload = Json::encode($columns['payload']);

        if ($payload === false) {
            throw JsonEncodingException::forAttribute(new Record, 'payload', json_last_error_msg());
        }

        return ['payload' => $payload, 'issue_id' => null] + $columns;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function touchHeartbeat(Project $project, array $data): void
    {
        $slug = $data['slug'] ?? 'default';
        $heartbeat = $project->heartbeats()->firstOrCreate(
            ['slug' => $slug],
            [
                'name' => $data['name'] ?? ucfirst($slug),
                'interval_minutes' => $data['interval'] ?? 15,
                'status' => 'active',
            ]
        );

        $heartbeat->update([
            'last_seen_at' => now(),
            'status' => 'active',
        ]);
    }

    /**
     * The enabled threshold this record's duration breaks, if any.
     *
     * @param  array<string, mixed>  $payload
     */
    protected function thresholdFor(Project $project, string $type, array $payload): ?Threshold
    {
        $duration = $payload['duration'] ?? null;

        if ($duration === null) {
            return null;
        }

        $thresholdType = match ($type) {
            'request' => 'route',
            'job-attempt', 'queued-job' => 'job',
            'command' => 'command',
            'scheduled-task' => 'scheduled-task',
            'query' => 'query',
            default => null,
        };

        if (! $thresholdType) {
            return null;
        }

        $key = match ($thresholdType) {
            'route' => $payload['route_path'] ?? $payload['path'] ?? '/',
            'job' => $payload['name'] ?? $payload['job'] ?? 'Unknown',
            'command', 'scheduled-task' => $payload['command'] ?? 'Unknown',
            'query' => $payload['sql'] ?? 'Unknown',
            default => null,
        };

        if (! $key) {
            return null;
        }

        $threshold = $this->enabledThresholds($project)[$thresholdType.'|'.$key] ?? null;

        // Durations arrive in microseconds; thresholds are authored in
        // milliseconds (the UI shows "{value}ms"). Without the conversion a
        // 500ms threshold fired at 500µs — a thousand times too eagerly.
        return $threshold && $duration > $threshold->value * 1000 ? $threshold : null;
    }

    protected function enabledThresholds(Project $project): array
    {
        return $this->thresholds ??= $project->thresholds()
            ->where('is_enabled', true)
            ->get()
            ->keyBy(fn ($threshold) => $threshold->type.'|'.$threshold->key)
            ->all();
    }

    /**
     * Handle performance threshold violations by creating issues and notifying.
     */
    protected function handleSlowPerformance(Project $project, Record $record, $threshold): void
    {
        $hash = md5('slow_performance_'.$threshold->type.'_'.$threshold->key);
        $title = 'Slow '.ucfirst($threshold->type).': '.$threshold->key;
        $durationMs = round($record->payload['duration'] / 1000, 2);
        $message = 'Duration: '.$durationMs.'ms (Threshold: '.$threshold->value.'ms)';

        $issue = $project->issues()->firstOrCreate(
            ['hash' => $hash],
            [
                'title' => $title,
                'message' => $message,
                'status' => 'open',
                'first_seen_at' => now(),
                'last_seen_at' => now(),
            ]
        );

        $issue->increment('occurrences_count');
        $issue->update([
            'last_seen_at' => now(),
            'message' => $message, // Update with latest duration
        ]);

        $record->update(['issue_id' => $issue->id]);

        $this->alertService->notifySlowPerformance($issue);
    }

    /**
     * Group exceptions into unique issues based on hash.
     */
    protected function handleException(Project $project, Record $record): void
    {
        $payload = $record->payload;
        $hash = $payload['_group'] ?? md5($payload['class'].$payload['message'].($payload['file'] ?? '').($payload['line'] ?? ''));

        $issue = $project->issues()->firstOrCreate(
            ['hash' => $hash],
            [
                'title' => $payload['class'],
                'message' => $payload['message'],
                'status' => 'open',
                'first_seen_at' => now(),
                'last_seen_at' => now(),
            ]
        );

        $issue->increment('occurrences_count');
        $issue->update(['last_seen_at' => now()]);

        $record->update(['issue_id' => $issue->id]);

        $this->alertService->notifyNewIssue($issue);
    }

    /**
     * Detect sudden surge in errors.
     *
     * Counted off the rollups, which already hold one row per minute per
     * type: the window is a handful of small rows on the
     * `(project_id, type, bucket)` index instead of a `COUNT(*)` over every
     * exception the project recorded in it. That matters most exactly when
     * this fires — during a storm, where counting the raw rows grows more
     * expensive with each error it is trying to detect.
     *
     * Because the rollups are bucketed per minute, the window starts at the
     * top of its first minute and so can reach up to a minute further back
     * than the raw count did. For "N errors in the last few minutes" that is
     * the same question.
     */
    protected function detectErrorSpike(Project $project): void
    {
        $windowMinutes = $project->settings['spike_window'] ?? 5;
        $threshold = $project->settings['spike_threshold'] ?? 50;

        $count = (int) RecordRollup::query()
            ->where('project_id', $project->id)
            ->where('type', 'exception')
            ->where('bucket', '>=', now()->subMinutes($windowMinutes)->startOfMinute())
            ->sum('count');

        if ($count >= $threshold) {
            // Avoid spamming - only alert once every window
            $lastAlert = $project->settings['last_spike_alert_at'] ?? null;
            if (! $lastAlert || now()->diffInMinutes($lastAlert) >= $windowMinutes) {
                $this->alertService->notifyErrorSpike($project, $count, $windowMinutes);

                // Update last alert time
                $settings = $project->settings ?? [];
                $settings['last_spike_alert_at'] = now();
                $project->update(['settings' => $settings]);
            }
        }
    }

    /**
     * Calculate a unique fingerprint for grouping and fast lookup.
     */
    protected function calculateFingerprint(string $type, array $payload): ?string
    {
        if (isset($payload['_group'])) {
            return $payload['_group'];
        }

        $id = match ($type) {
            'request' => ($payload['method'] ?? 'GET').($payload['route_path'] ?? $payload['path'] ?? '/'),
            'exception' => ($payload['class'] ?? '').($payload['message'] ?? ''),
            'query' => $payload['sql'] ?? '',
            'job', 'job-attempt', 'queued-job' => $payload['job'] ?? $payload['name'] ?? $payload['job_class'] ?? '',
            'scheduled-task' => $payload['command'] ?? '',
            'mail' => $payload['mailable'] ?? '',
            'notification' => ($payload['notification'] ?? '').($payload['channel'] ?? ''),
            default => null,
        };

        return $id ? md5($id) : null;
    }
}
