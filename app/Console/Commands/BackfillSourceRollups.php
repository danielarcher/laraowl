<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Models\Record;
use App\Models\RecordGroupSourceRollup;
use App\Models\RecordSourceRollup;
use App\Services\RollupWriter;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

class BackfillSourceRollups extends Command
{
    protected $signature = 'laraowl:sources:backfill
                            {--project= : Restrict the rebuild to one project id or slug}
                            {--days=30 : How far back to rebuild}';

    protected $description = 'Rebuild the per-source request rollups from the raw request records';

    public function handle(RollupWriter $rollupWriter): int
    {
        $identifier = $this->option('project');
        $projects = $identifier
            ? Project::query()->where('id', $identifier)->orWhere('slug', $identifier)->get()
            : Project::all();

        if ($projects->isEmpty()) {
            $this->error('No matching projects.');

            return self::FAILURE;
        }

        $since = now()->subDays(max(1, (int) $this->option('days')))->startOfHour();
        // Ingest keeps writing the current hour (the route rows are hourly),
        // and records still in the buffer have not reached the table yet, so
        // the rebuild stops at the last full hour.
        $until = now()->subMinutes(2)->startOfHour();

        foreach ($projects as $project) {
            $this->rebuild($project, $rollupWriter, $since, $until);
        }

        $this->info('Source rollups rebuilt.');

        return self::SUCCESS;
    }

    /**
     * Clears the range, then reads it back an hour at a time, so each query
     * stays on the (project_id, created_at) index.
     */
    protected function rebuild(Project $project, RollupWriter $rollupWriter, CarbonInterface $since, CarbonInterface $until): void
    {
        foreach ([RecordSourceRollup::query(), RecordGroupSourceRollup::query()] as $query) {
            $query->where('project_id', $project->id)
                ->where('bucket', '>=', $since)
                ->where('bucket', '<', $until)
                ->delete();
        }

        $requests = 0;

        for ($hour = $since->toImmutable(); $hour->lt($until); $hour = $hour->addHour()) {
            Record::query()
                ->where('project_id', $project->id)
                ->where('created_at', '>=', $hour)
                ->where('created_at', '<', $hour->addHour())
                ->where('type', 'request')
                ->select(['id', 'type', 'payload', 'fingerprint', 'created_at'])
                ->chunkById(2000, function (Collection $chunk) use ($project, $rollupWriter, &$requests) {
                    $rollupWriter->recordSources($project, $chunk->map(fn (Record $record) => [
                        'type' => $record->type,
                        'payload' => $record->payload ?? [],
                        'fingerprint' => $record->fingerprint,
                        'created_at' => $record->created_at,
                    ])->all());

                    $requests += $chunk->count();
                });
        }

        $this->line("  {$project->slug}: {$requests} requests");
    }
}
