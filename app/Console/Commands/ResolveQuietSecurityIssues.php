<?php

namespace App\Console\Commands;

use App\Services\SecurityService;
use Illuminate\Console\Command;

class ResolveQuietSecurityIssues extends Command
{
    protected $signature = 'laraowl:security:resolve-quiet {--hours=24 : How long an address must have been quiet}';

    protected $description = 'Resolve the threat issues of addresses that have sent nothing suspicious for a while';

    public function handle(SecurityService $security): int
    {
        $resolved = $security->resolveQuietThreats(now()->subHours(max(1, (int) $this->option('hours'))));

        $this->info("{$resolved} quiet threat issue(s) resolved.");

        return self::SUCCESS;
    }
}
