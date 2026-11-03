<?php

namespace App\Console\Commands;

use App\Models\Team;
use App\Services\Domains\DomainAlerts;
use App\Services\Domains\DomainScanner;
use App\Services\Domains\DomainService;
use Illuminate\Console\Command;

class ScanDomains extends Command
{
    protected $signature = 'laraowl:domains:scan {--team= : Only this team (id or slug)} {--rdap : Refresh registration data now}';

    protected $description = 'Check every domain: DNS, certificates, mail records and registration, then warn before anything expires';

    public function handle(DomainScanner $scanner, DomainService $domains, DomainAlerts $alerts): int
    {
        $teams = Team::query()
            ->when($this->option('team'), fn ($q, $team) => $q->where(fn ($q) => $q->where('id', $team)->orWhere('slug', $team)))
            ->where(fn ($q) => $q->whereHas('projects')->orWhereHas('domains')->orWhereHas('costs', fn ($q) => $q->where('category', 'domain')))
            ->get();

        foreach ($teams as $team) {
            $found = $scanner->scanTeam($team, (bool) $this->option('rdap'));
            $rows = $domains->overview($team)['domains']->all();
            $sent = $alerts->send($team, $rows, route('domains.index', ['current_team' => $team->slug]));

            $this->info("{$team->name}: {$found->count()} domains scanned, {$sent} alerts sent.");
        }

        return self::SUCCESS;
    }
}
