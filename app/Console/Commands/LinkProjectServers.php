<?php

namespace App\Console\Commands;

use App\Models\Team;
use App\Services\ServerMetricService;
use Illuminate\Console\Command;

class LinkProjectServers extends Command
{
    protected $signature = 'laraowl:projects:link-servers';

    protected $description = 'Link each project to the server its latest record came from';

    public function handle(ServerMetricService $metrics): int
    {
        $changed = Team::query()
            ->whereHas('servers')
            ->get()
            ->sum(fn (Team $team) => $metrics->linkProjects($team));

        $this->info("Linked {$changed} project(s) to a new server.");

        return self::SUCCESS;
    }
}
