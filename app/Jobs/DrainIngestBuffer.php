<?php

namespace App\Jobs;

use App\Services\IngestQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Works through the ingest buffer for a while, then hands over to the next
 * drain if batches remain.
 */
class DrainIngestBuffer implements ShouldQueue
{
    use Queueable;

    /**
     * Batches are taken off the buffer before they are processed, so a
     * retried job would find different ones; the next drain carries on.
     */
    public int $tries = 1;

    /**
     * Well above the drain's time budget, below the queue's retry_after.
     */
    public int $timeout = 75;

    public function handle(IngestQueue $queue): void
    {
        $queue->drain();
    }
}
