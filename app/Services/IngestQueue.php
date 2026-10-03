<?php

namespace App\Services;

use App\Jobs\DrainIngestBuffer;
use App\Models\Project;
use Carbon\CarbonInterface;
use Illuminate\Database\DetectsLostConnections;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Throwable;

/**
 * Takes client batches in at the door and processes them behind it.
 *
 * The endpoint only appends the raw POST body to the buffer, so a request
 * costs the same however busy LaraOwl is and never waits on the database.
 * One queued drain job at a time works through the buffer, merging the
 * batches of a project into a single ingest so the rollups are written once
 * per drain rather than once per request. Each record keeps the moment its
 * batch arrived.
 */
class IngestQueue
{
    use DetectsLostConnections;

    /**
     * Set while a drain job is queued, so a burst of batches queues one.
     */
    private const DRAIN_QUEUED = 'laraowl:ingest:drain-queued';

    public function __construct(
        private IngestBuffer $buffer,
        private IngestService $ingest,
    ) {}

    /**
     * Accepts one POST body for a project. False when the buffer is full,
     * which tells the client to come back later rather than letting the
     * backlog outgrow memory.
     */
    public function accept(int $projectId, string $body, ?float $receivedAt = null): bool
    {
        if ($this->buffer->size() >= config('laraowl.ingest.max_waiting')) {
            return false;
        }

        $envelope = json_encode(['project' => $projectId, 'received_at' => $receivedAt ?? (float) now()->format('U.u')]);
        $this->buffer->push($envelope."\n".$body);
        $this->queueDrain();

        return true;
    }

    /**
     * Queues a drain job unless one is already waiting.
     */
    public function queueDrain(?int $delaySeconds = null): void
    {
        if (! Cache::add(self::DRAIN_QUEUED, true, 120)) {
            return;
        }

        $delaySeconds
            ? DrainIngestBuffer::dispatch()->delay($delaySeconds)
            : DrainIngestBuffer::dispatch();
    }

    /**
     * Queues a drain if batches are waiting. The scheduler calls this every
     * minute in case a drain job was lost (a worker killed mid-job).
     */
    public function queueDrainIfWaiting(): void
    {
        if ($this->buffer->size() > 0) {
            $this->queueDrain();
        }
    }

    /**
     * The age of the oldest waiting batch, in seconds.
     */
    public function oldestWaitingSeconds(): ?float
    {
        $oldest = $this->buffer->peek();
        $envelope = $oldest === null ? null : json_decode(strstr($oldest, "\n", true) ?: $oldest, true);

        return is_array($envelope) && isset($envelope['received_at'])
            ? max(0.0, (float) now()->format('U.u') - (float) $envelope['received_at'])
            : null;
    }

    /**
     * Processes waiting batches until none are left or the time budget is
     * spent, then queues the next drain if any remain. Returns the number of
     * batches taken.
     */
    public function drain(?float $seconds = null): int
    {
        // Batches arriving from here on queue the next drain themselves.
        Cache::forget(self::DRAIN_QUEUED);

        $deadline = microtime(true) + ($seconds ?? config('laraowl.ingest.drain_seconds'));
        $taken = 0;

        while (microtime(true) < $deadline) {
            $batches = $this->buffer->pop(config('laraowl.ingest.drain_batch'));

            if ($batches === []) {
                break;
            }

            $taken += count($batches);

            if (! $this->process($batches)) {
                // The database went away: the batches are back in the buffer.
                $this->queueDrain(15);

                return $taken;
            }
        }

        $this->queueDrainIfWaiting();

        return $taken;
    }

    /**
     * Ingests a slice of batches, one ingest per project. False when the
     * database connection was lost; everything not yet stored is then put
     * back, in order, to be tried again.
     *
     * @param  list<string>  $raw
     */
    private function process(array $raw): bool
    {
        $byProject = [];

        foreach ($raw as $item) {
            $batch = $this->decode($item);

            if ($batch === null) {
                $this->buffer->fail($item);

                continue;
            }

            $byProject[$batch['project']][] = [$item, $batch];
        }

        $projectIds = array_keys($byProject);

        foreach ($projectIds as $position => $projectId) {
            try {
                $this->ingestProject($projectId, $byProject[$projectId]);
            } catch (Throwable $e) {
                if ($this->databaseUnreachable($e)) {
                    report($e);
                    $unstored = array_merge(...array_map(
                        fn ($id) => array_column($byProject[$id], 0),
                        array_slice($projectIds, $position),
                    ));
                    $this->buffer->unshift($unstored);

                    return false;
                }

                $this->isolate($projectId, $byProject[$projectId]);
            }
        }

        return true;
    }

    /**
     * After a merged ingest failed, retries the project's batches one by
     * one, setting aside only the ones that fail on their own.
     *
     * @param  list<array{0: string, 1: array{project: int, received_at: float, records: list<array<string, mixed>>, app_url: ?string}}>  $batches
     */
    private function isolate(int $projectId, array $batches): void
    {
        foreach ($batches as $entry) {
            try {
                $this->ingestProject($projectId, [$entry]);
            } catch (Throwable $e) {
                report($e);
                $this->buffer->fail($entry[0]);
            }
        }
    }

    /**
     * @param  list<array{0: string, 1: array{project: int, received_at: float, records: list<array<string, mixed>>, app_url: ?string}}>  $batches
     */
    private function ingestProject(int $projectId, array $batches): void
    {
        $project = Project::find($projectId);

        // A project deleted while its batches waited: nothing to store.
        if (! $project) {
            return;
        }

        $records = [];
        $receivedAt = [];

        foreach ($batches as [, $batch]) {
            $at = $this->receivedAt($batch['received_at']);

            foreach ($batch['records'] as $record) {
                if (is_array($record)) {
                    $receivedAt[count($records)] = $at;
                    $records[] = $record;
                }
            }

            if ($batch['app_url'] && ! $project->url) {
                $project->update(['url' => $batch['app_url']]);
            }
        }

        if ($records !== []) {
            $this->ingest->ingest($project, $records, $receivedAt);
        }
    }

    /**
     * Splits a buffered item into its envelope and the client's body, in
     * the shapes the endpoint has always taken: {records: [...], app_url}
     * or bare records.
     *
     * @return array{project: int, received_at: float, records: list<mixed>, app_url: ?string}|null
     */
    private function decode(string $item): ?array
    {
        [$head, $body] = array_pad(explode("\n", $item, 2), 2, '');
        $envelope = json_decode($head, true);
        $payload = json_decode($body, true);

        if (! is_array($envelope) || ! isset($envelope['project'], $envelope['received_at']) || ! is_array($payload)) {
            return null;
        }

        $data = array_key_exists('records', $payload) ? $payload['records'] : $payload;

        return [
            'project' => (int) $envelope['project'],
            'received_at' => (float) $envelope['received_at'],
            'records' => is_array($data) ? (array_is_list($data) ? $data : [$data]) : [],
            'app_url' => is_string($payload['app_url'] ?? null) ? $payload['app_url'] : null,
        ];
    }

    /**
     * A lost or refused connection, or Postgres restarting (SQLSTATE class
     * 08, or 57P01-57P03), as opposed to a batch the database rejects.
     */
    private function databaseUnreachable(Throwable $e): bool
    {
        return $this->causedByLostConnection($e)
            || preg_match('/SQLSTATE\[(08\w{3}|57P0[123])\]/', $e->getMessage()) === 1;
    }

    private function receivedAt(float $timestamp): CarbonInterface
    {
        return Date::createFromTimestamp($timestamp, config('app.timezone'));
    }
}
