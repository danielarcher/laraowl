<?php

namespace App\Services;

/**
 * Where accepted batches wait between the ingest endpoint and the worker
 * that processes them. A batch is one POST from a client, kept as an opaque
 * string; the oldest is taken first.
 */
interface IngestBuffer
{
    /**
     * Appends a batch and returns how many are now waiting.
     */
    public function push(string $batch): int;

    /**
     * Takes up to $max of the oldest batches, oldest first.
     *
     * @return list<string>
     */
    public function pop(int $max): array;

    /**
     * Puts batches back at the front, in the order given, to be taken first.
     *
     * @param  list<string>  $batches
     */
    public function unshift(array $batches): void;

    /**
     * The oldest waiting batch, left in place.
     */
    public function peek(): ?string;

    public function size(): int;

    /**
     * Sets aside a batch that could not be processed, keeping the most
     * recent ones up to the configured limit.
     */
    public function fail(string $batch): void;

    /**
     * Takes up to $max of the set-aside batches, oldest first.
     *
     * @return list<string>
     */
    public function takeFailed(int $max): array;

    public function failedCount(): int;
}
