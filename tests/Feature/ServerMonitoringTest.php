<?php

use App\Enums\TeamRole;
use App\Models\Project;
use App\Models\Record;
use App\Models\Server;
use App\Models\ServerMetric;
use App\Models\Team;
use App\Models\User;
use App\Services\ServerMetricService;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A team owner and their team.
 *
 * @return array{User, Team}
 */
function serverTeam(): array
{
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    return [$user, $team];
}

/**
 * A valid agent sample. Sizes are bytes.
 *
 * @return array<string, mixed>
 */
function agentSample(array $overrides = []): array
{
    $gigabyte = 1024 ** 3;

    return array_replace_recursive([
        'hostname' => 'web-1',
        'os' => 'Ubuntu 24.04.1 LTS',
        'cpu_count' => 2,
        'cpu_percent' => 37.5,
        'load' => [0.52, 0.41, 0.3],
        'memory' => ['total' => 2 * $gigabyte, 'available' => $gigabyte / 2],
        'swap' => ['total' => $gigabyte, 'free' => $gigabyte / 4 * 3],
        'disks' => [
            ['mount' => '/boot', 'total' => $gigabyte, 'used' => $gigabyte / 4],
            ['mount' => '/', 'total' => 50 * $gigabyte, 'used' => 10 * $gigabyte],
        ],
        'uptime' => 86400.42,
    ], $overrides);
}

test('the agent stores a sample and refreshes the server identity', function () {
    $server = Server::factory()->neverSeen()->create();
    $gigabyte = 1024 ** 3;

    $this->withToken($server->api_token)
        ->postJson('/api/servers/metrics', agentSample())
        ->assertOk();

    $metric = $server->metrics()->sole();

    expect($metric->cpu_percent)->toBe(37.5)
        ->and([$metric->load_1, $metric->load_5, $metric->load_15])->toBe([0.52, 0.41, 0.3])
        ->and($metric->memory_used)->toBe((int) ($gigabyte * 1.5))
        ->and($metric->swap_used)->toBe($gigabyte / 4)
        ->and($metric->disk_total)->toBe(50 * $gigabyte)
        ->and($metric->disk_used)->toBe(10 * $gigabyte)
        ->and($metric->disks)->toHaveCount(2)
        ->and($metric->uptime_seconds)->toBe(86400)
        ->and($metric->recorded_ts)->toBe(now()->startOfMinute()->getTimestamp());

    $server->refresh();

    expect($server->hostname)->toBe('web-1')
        ->and($server->os)->toBe('Ubuntu 24.04.1 LTS')
        ->and($server->cpu_count)->toBe(2)
        ->and($server->last_seen_at)->not->toBeNull()
        ->and($server->is_online)->toBeTrue();
});

test('a second sample in the same minute replaces the first', function () {
    $server = Server::factory()->create();

    $this->withToken($server->api_token)->postJson('/api/servers/metrics', agentSample(['cpu_percent' => 10]))->assertOk();
    $this->withToken($server->api_token)->postJson('/api/servers/metrics', agentSample(['cpu_percent' => 20]))->assertOk();

    expect($server->metrics()->count())->toBe(1)
        ->and($server->metrics()->sole()->cpu_percent)->toBe(20.0);
});

test('the largest disk stands in when the root mount is missing', function () {
    $server = Server::factory()->create();
    $gigabyte = 1024 ** 3;

    $this->withToken($server->api_token)
        ->postJson('/api/servers/metrics', [
            ...agentSample(),
            'disks' => [
                ['mount' => '/data', 'total' => 100 * $gigabyte, 'used' => 40 * $gigabyte],
                ['mount' => '/boot', 'total' => $gigabyte, 'used' => 0],
            ],
        ])
        ->assertOk();

    expect($server->metrics()->sole()->disk_total)->toBe(100 * $gigabyte);
});

test('the agent needs a valid server token', function () {
    $this->postJson('/api/servers/metrics', agentSample())->assertUnauthorized();
    $this->withToken('not-a-token')->postJson('/api/servers/metrics', agentSample())->assertUnauthorized();

    $project = Project::factory()->create();
    $this->withToken($project->api_token)->postJson('/api/servers/metrics', agentSample())->assertUnauthorized();

    expect(ServerMetric::count())->toBe(0);
});

test('an incomplete sample is rejected', function () {
    $server = Server::factory()->create();

    $this->withToken($server->api_token)
        ->postJson('/api/servers/metrics', ['cpu_percent' => 150, 'load' => [1], 'disks' => []])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['cpu_percent', 'load', 'memory.total', 'disks']);
});

test('the servers page lists the team servers with their apps', function () {
    [$user, $team] = serverTeam();
    $server = Server::factory()->create(['team_id' => $team->id, 'name' => 'web-1', 'hostname' => 'web-1']);
    ServerMetric::factory()->for($server)->minutesAgo(1)->create(['cpu_percent' => 42]);
    Server::factory()->create(['name' => 'someone-else']);

    $project = Project::factory()->create(['team_id' => $team->id, 'name' => 'Shop']);
    Record::create(['project_id' => $project->id, 'type' => 'request', 'payload' => ['server' => 'web-1'], 'created_at' => now()]);

    $this->actingAs($user)
        ->get(route('servers.index', ['current_team' => $team->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('servers/index', false)
            ->has('servers', 1)
            ->where('servers.0.name', 'web-1')
            ->where('servers.0.latest.cpu', 42)
            ->where('servers.0.is_online', true)
            ->where('servers.0.projects.0.name', 'Shop')
            ->has('servers.0.sparkline', 1)
        );
});

test('a server detail page charts the selected period', function () {
    [$user, $team] = serverTeam();
    $server = Server::factory()->create(['team_id' => $team->id]);
    ServerMetric::factory()->for($server)->minutesAgo(2)->create(['cpu_percent' => 20]);
    ServerMetric::factory()->for($server)->minutesAgo(1)->create(['cpu_percent' => 40]);
    ServerMetric::factory()->for($server)->minutesAgo(120)->create(['cpu_percent' => 90]);

    $this->actingAs($user)
        ->get(route('servers.show', ['current_team' => $team->slug, 'server' => $server->id, 'period' => '1h']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('servers/show', false)
            ->where('server.id', $server->id)
            ->where('bucket_seconds', 60)
            ->has('history', 2)
            ->where('latest.cpu', 40)
        );
});

test('another team cannot see a server', function () {
    [$user, $team] = serverTeam();
    $otherServer = Server::factory()->create();

    $this->actingAs($user)
        ->get(route('servers.show', ['current_team' => $team->slug, 'server' => $otherServer->id]))
        ->assertNotFound();

    $this->actingAs($user)
        ->get(route('servers.index', ['current_team' => $otherServer->team->slug]))
        ->assertForbidden();
});

test('a server without fresh samples shows as offline', function () {
    $server = Server::factory()->create(['last_seen_at' => now()->subMinutes(10)]);

    expect($server->is_online)->toBeFalse()
        ->and(Server::factory()->neverSeen()->create()->is_online)->toBeFalse();
});

test('history buckets grow with the window', function () {
    $service = app(ServerMetricService::class);

    expect($service->bucketFor(now()->subHour(), now()))->toBe(60)
        ->and($service->bucketFor(now()->subDay(), now()))->toBe(300)
        ->and($service->bucketFor(now()->subDays(7), now()))->toBe(3600)
        ->and($service->bucketFor(now()->subDays(30), now()))->toBe(14400);
});

test('samples older than the retention window are pruned', function () {
    config(['laraowl.servers.retention_days' => 30]);
    $server = Server::factory()->create();
    $kept = ServerMetric::factory()->for($server)->minutesAgo(60 * 24 * 29)->create();
    ServerMetric::factory()->for($server)->minutesAgo(60 * 24 * 31)->create();

    $this->artisan('model:prune', ['--model' => [ServerMetric::class]])->assertSuccessful();

    expect(ServerMetric::pluck('id')->all())->toBe([$kept->id]);
});

test('the create command registers a server and prints its agent setup', function () {
    [, $team] = serverTeam();

    $this->artisan('laraowl:servers:create', ['team' => $team->slug, 'name' => 'db-1'])
        ->expectsOutputToContain('Server [db-1] created')
        ->expectsOutputToContain('/agent.sh')
        ->assertSuccessful();

    expect($team->servers()->sole()->api_token)->toHaveLength(64);
});

test('the agent script is served as plain text', function () {
    $this->get('/agent.sh')
        ->assertOk()
        ->assertHeader('Content-Type', 'text/plain; charset=UTF-8')
        ->assertSee('/api/servers/metrics', false);
});
