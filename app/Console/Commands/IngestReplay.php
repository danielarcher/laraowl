<?php

namespace App\Console\Commands;

use App\Services\IngestBuffer;
use App\Services\IngestQueue;
use Illuminate\Console\Command;

class IngestReplay extends Command
{
    protected $signature = 'laraowl:ingest:replay {--limit=1000 : How many set-aside batches to retry}';

    protected $description = 'Put ingest batches that failed to process back in line, oldest first';

    public function handle(IngestBuffer $buffer, IngestQueue $queue): int
    {
        $batches = $buffer->takeFailed(max(1, (int) $this->option('limit')));

        foreach ($batches as $batch) {
            $buffer->push($batch);
        }

        $queue->queueDrainIfWaiting();

        $this->info(count($batches).' batch(es) put back in line; '.$buffer->failedCount().' still set aside.');

        return self::SUCCESS;
    }
}
