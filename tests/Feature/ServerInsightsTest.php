<?php

use App\Enums\TeamRole;
use App\Models\Server;
use App\Models\ServerMetric;
use App\Models\Team;
use App\Models\User;
use App\Services\ServerMetricService;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A team owner, their team and one server.
 *
 * @return array{User, Team, Server}
 */
function insightServer(): array
{
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    return [$user, $team, Server::factory()->create(['team_id' => $team->id, 'name' => 'web-1'])];
}

/**
 * One sample a given number of days (and hours) ago.
 */
function insightSample(Server $server, float $daysAgo, array $attributes = []): ServerMetric
{
    $recordedAt = now()->subMinutes((int) round($daysAgo * 1440));

    return ServerMetric::factory()->create([
        'server_id' => $server->id,
        'recorded_at' => $recordedAt,
        'recorded_ts' => $recordedAt->getTimestamp(),
        ...$attributes,
    ]);
}

test('a growing disk gets a forecast of when it fills', function () {
    [, $team, $server] = insightServer();
    $gigabyte = 1024 ** 3;

    // 1 GB a day on a 50 GB disk, 30 GB used today: 20 days left.
    foreach (range(9, 0) as $daysAgo) {
        insightSample($server, $daysAgo, ['disk_total' => 50 * $gigabyte, 'disk_used' => (30 - $daysAgo) * $gigabyte]);
    }

    $insight = app(ServerMetricService::class)->insights($team)[$server->id];

    expect($insight['disk_full_in_days'])->toBe(20)
        ->and($insight['flags'])->toContain(['key' => 'disk', 'label' => 'Disk full in ~20d', 'tone' => 'warn']);
});

test('a flat or shrinking disk has no forecast', function () {
    [, $team, $server] = insightServer();
    $gigabyte = 1024 ** 3;

    foreach (range(6, 0) as $daysAgo) {
        insightSample($server, $daysAgo, ['disk_used' => (20 + $daysAgo) * $gigabyte]);
    }

    expect(app(ServerMetricService::class)->insights($team)[$server->id]['disk_full_in_days'])->toBeNull();
});

test('two days of samples are too few for a forecast', function () {
    [, $team, $server] = insightServer();

    insightSample($server, 1, ['disk_used' => 10 * 1024 ** 3]);
    insightSample($server, 0, ['disk_used' => 20 * 1024 ** 3]);

    expect(app(ServerMetricService::class)->insights($team)[$server->id]['disk_full_in_days'])->toBeNull();
});

test('memory pressure, swapping and a busy CPU are flagged from the 7-day averages', function () {
    [, $team, $server] = insightServer();
    $gigabyte = 1024 ** 3;

    foreach ([3, 2, 1] as $daysAgo) {
        insightSample($server, $daysAgo, [
            'cpu_percent' => 80,
            'memory_total' => 2 * $gigabyte,
            'memory_used' => 1.8 * $gigabyte,
            'swap_total' => $gigabyte,
            'swap_used' => 0.6 * $gigabyte,
        ]);
    }

    $insight = app(ServerMetricService::class)->insights($team)[$server->id];

    expect($insight['cpu_avg'])->toEqual(80)
        ->and($insight['memory_avg'])->toEqual(90)
        ->and($insight['swap_avg'])->toEqual(60)
        ->and(array_column($insight['flags'], 'key'))->toBe(['memory', 'swap', 'cpu']);
});

test('a quiet server is flagged as underused, and samples older than a week do not count', function () {
    [, $team, $server] = insightServer();

    insightSample($server, 10, ['cpu_percent' => 95]);
    insightSample($server, 2, ['cpu_percent' => 2, 'memory_used' => 0.5 * 1024 ** 3]);
    insightSample($server, 1, ['cpu_percent' => 3, 'memory_used' => 0.5 * 1024 ** 3]);

    $insight = app(ServerMetricService::class)->insights($team)[$server->id];

    expect($insight['cpu_avg'])->toEqual(2.5)
        ->and($insight['flags'])->toBe([['key' => 'idle', 'label' => 'Underused', 'tone' => 'info']]);
});

test('a server without recent samples has no insights', function () {
    [, $team, $server] = insightServer();

    expect(app(ServerMetricService::class)->insights($team)[$server->id])->toBeNull();
});

test('the servers page carries every server sparkline and its insights', function () {
    [$user, $team, $web] = insightServer();
    $db = Server::factory()->create(['team_id' => $team->id, 'name' => 'db-1']);

    insightSample($web, 0.01, ['cpu_percent' => 40]);
    insightSample($web, 0.02, ['cpu_percent' => 20]);
    insightSample($db, 0.01, ['cpu_percent' => 10]);

    $this->actingAs($user)
        ->get(route('servers.index', ['current_team' => $team->slug]))
        ->assertOk()
        ->assertInertia(function (Assert $page) {
            $servers = collect($page->toArray()['props']['servers'])->keyBy('name');

            expect($servers['web-1']['sparkline'])->toHaveCount(2)
                ->and(collect($servers['web-1']['sparkline'])->pluck('cpu')->all())->toEqualCanonicalizing([40.0, 20.0])
                ->and($servers['db-1']['sparkline'])->toHaveCount(1)
                ->and($servers['db-1']['insights']['cpu_avg'])->toEqual(10)
                ->and($servers['web-1']['insights']['cpu_avg'])->toEqual(30);
        });
});
