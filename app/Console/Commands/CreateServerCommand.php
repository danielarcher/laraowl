<?php

namespace App\Console\Commands;

use App\Concerns\ResolvesConsoleIdentifiers;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CreateServerCommand extends Command
{
    use ResolvesConsoleIdentifiers;

    protected $signature = 'laraowl:servers:create
                            {team : Team ID or slug}
                            {name : The server name shown in the dashboard}';

    protected $description = 'Register a server for resource monitoring and print the agent setup';

    public function handle(): int
    {
        $team = $this->findTeamByIdOrSlug((string) $this->argument('team'));

        if (! $team) {
            $this->error("Team [{$this->argument('team')}] not found.");

            return self::FAILURE;
        }

        $validator = Validator::make(
            ['name' => $this->argument('name')],
            ['name' => ['required', 'string', 'max:255']],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $server = $team->servers()->create([
            'name' => $validator->validated()['name'],
            'api_token' => Str::random(64),
        ]);

        $this->info("Server [{$server->name}] created (id: {$server->id}) in team [{$team->slug}].");
        $this->newLine();
        $this->line('Install the agent on that machine (as the user cron will run it as):');
        $this->newLine();
        $this->line('  mkdir -p ~/.laraowl && chmod 700 ~/.laraowl');
        $this->line('  curl -fsSL '.url('/agent.sh').' -o ~/.laraowl/agent.sh');
        $this->line('  printf \'LARAOWL_URL=%s\nLARAOWL_SERVER_TOKEN=%s\n\' \''.rtrim(url('/'), '/').'\' \''.$server->api_token.'\' > ~/.laraowl/agent.env');
        $this->line('  chmod 600 ~/.laraowl/agent.env');
        $this->newLine();
        $this->line('Then run it every minute (cron or a Forge scheduled job):');
        $this->newLine();
        $this->line('  bash ~/.laraowl/agent.sh');

        return self::SUCCESS;
    }
}
