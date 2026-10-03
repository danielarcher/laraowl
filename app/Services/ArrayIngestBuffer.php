<?php

namespace App\Services;

/**
 * The ingest buffer in memory, for tests and single-process runs: batches
 * live as long as the process.
 */
class ArrayIngestBuffer implements IngestBuffer
{
    /** @var list<string> */
    private array $waiting = [];

    /** @var list<string> */
    private array $failed = [];

    public function __construct(private int $maxFailed = 1000) {}

    public function push(string $batch): int
    {
        $this->waiting[] = $batch;

        return count($this->waiting);
    }

    public function pop(int $max): array
    {
        return array_splice($this->waiting, 0, $max);
    }

    public function unshift(array $batches): void
    {
        array_unshift($this->waiting, ...$batches);
    }

    public function peek(): ?string
    {
        return $this->waiting[0] ?? null;
    }

    public function size(): int
    {
        return count($this->waiting);
    }

    public function fail(string $batch): void
    {
        $this->failed[] = $batch;
        $this->failed = array_slice($this->failed, -$this->maxFailed);
    }

    public function takeFailed(int $max): array
    {
        return array_splice($this->failed, 0, $max);
    }

    public function failedCount(): int
    {
        return count($this->failed);
    }
}
