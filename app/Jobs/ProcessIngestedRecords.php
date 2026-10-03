<?php

namespace App\Jobs;

use App\Models\Project;
use App\Services\IngestService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * The per-request ingest job used before the ingest buffer. Kept so jobs
 * queued before an upgrade still run; nothing dispatches it any more.
 */
class ProcessIngestedRecords implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    protected $project;

    protected $records;

    /**
     * Create a new job instance.
     */
    public function __construct(Project $project, array $records)
    {
        $this->project = $project;
        $this->records = $records;
    }

    /**
     * Execute the job.
     */
    public function handle(IngestService $ingestService): void
    {
        $ingestService->ingest($this->project, $this->records);
    }
}
