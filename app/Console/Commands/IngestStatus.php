<?php

namespace App\Console\Commands;

use App\Services\IngestBuffer;
use App\Services\IngestQueue;
use Illuminate\Console\Command;

class IngestStatus extends Command
{
    protected $signature = 'laraowl:ingest:status';

    protected $description = 'Show how many ingest batches are waiting, how long the oldest has waited, and how many were set aside';

    public function handle(IngestBuffer $buffer, IngestQueue $queue): int
    {
        $oldest = $queue->oldestWaitingSeconds();

        $this->table(['Waiting', 'Oldest', 'Set aside'], [[
            $buffer->size(),
            $oldest === null ? '—' : number_format($oldest, 1).'s',
            $buffer->failedCount(),
        ]]);

        return self::SUCCESS;
    }
}
