<?php

namespace App\Services;

use Illuminate\Redis\Connections\Connection;

/**
 * The ingest buffer as two Redis lists: waiting batches, oldest at the
 * head, and the ones set aside after failing.
 */
class RedisIngestBuffer implements IngestBuffer
{
    private const WAITING = 'laraowl:ingest:waiting';

    private const FAILED = 'laraowl:ingest:failed';

    public function __construct(
        private Connection $redis,
        private int $maxFailed = 1000,
    ) {}

    public function push(string $batch): int
    {
        return (int) $this->redis->rpush(self::WAITING, $batch);
    }

    public function pop(int $max): array
    {
        return $this->take(self::WAITING, $max);
    }

    public function unshift(array $batches): void
    {
        if ($batches !== []) {
            $this->redis->lpush(self::WAITING, ...array_reverse($batches));
        }
    }

    public function peek(): ?string
    {
        $batch = $this->redis->lindex(self::WAITING, 0);

        return is_string($batch) ? $batch : null;
    }

    public function size(): int
    {
        return (int) $this->redis->llen(self::WAITING);
    }

    public function fail(string $batch): void
    {
        $this->redis->rpush(self::FAILED, $batch);
        $this->redis->ltrim(self::FAILED, -$this->maxFailed, -1);
    }

    public function takeFailed(int $max): array
    {
        return $this->take(self::FAILED, $max);
    }

    public function failedCount(): int
    {
        return (int) $this->redis->llen(self::FAILED);
    }

    /**
     * LPOP with a count takes the whole slice in one atomic step.
     *
     * @return list<string>
     */
    private function take(string $key, int $max): array
    {
        $batches = $this->redis->lpop($key, $max);

        return is_array($batches) ? array_values($batches) : [];
    }
}
