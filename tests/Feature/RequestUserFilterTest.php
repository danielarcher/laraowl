<?php

use App\Models\Project;
use App\Models\User;
use App\Services\IngestService;
use App\Services\RecordService;

function userRequest(?string $user, string $path, int $status = 200, int $duration = 10): array
{
    return [
        't' => 'request',
        'user' => $user,
        'method' => 'GET',
        'route_path' => $path,
        'url' => 'https://app.test'.$path,
        'status_code' => $status,
        'duration' => $duration,
        'headers' => json_encode(['user-agent' => ['Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0']]),
    ];
}

test('the requests page lists the signed-in users by name', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;
    $project = Project::factory()->create(['team_id' => $team->id]);

    app(IngestService::class)->ingest($project, [
        userRequest('7', '/inicio/index'),
        userRequest('7', '/fornecedores/listar'),
        userRequest('9', '/inicio/index'),
        userRequest(null, '/login'),
        ['t' => 'user', 'id' => '7', 'name' => 'Ana Souza', 'username' => 'ana@example.com'],
    ]);

    $this->actingAs($user)
        ->get(route('requests', ['current_team' => $team->slug, 'project' => $project->slug, 'period' => '1h']))
        ->assertInertia(fn ($page) => $page
            ->component('projects/requests/index')
            ->where('user', null)
            ->has('users', 2)
            ->where('users.0.key', '7')
            ->where('users.0.name', 'Ana Souza')
            ->where('users.0.email', 'ana@example.com')
            ->where('users.0.requests', 2)
            ->where('users.1.key', '9'));
});

test('filtering by a user narrows the figures, routes and activity to their requests', function () {
    $project = Project::factory()->create();

    app(IngestService::class)->ingest($project, [
        userRequest('7', '/inicio/index', 200, 10),
        userRequest('7', '/fornecedores/listar', 500, 30),
        userRequest('7', '/fornecedores/listar', 200, 50),
        userRequest('9', '/inicio/index', 404, 900),
        userRequest(null, '/login'),
        ['t' => 'user', 'id' => '7', 'name' => 'Ana Souza', 'username' => 'ana@example.com'],
    ]);

    $stats = app(RecordService::class)->getRequestStats($project, '1h', user: '7');
    $routes = collect($stats['requests']->items())->keyBy('path');

    expect($stats['user'])->toMatchArray(['key' => '7', 'hash' => md5('7'), 'name' => 'Ana Souza', 'email' => 'ana@example.com', 'truncated' => false])
        ->and($stats['overview']['total'])->toBe(3)
        ->and($stats['overview']['server_error'])->toBe(1)
        ->and($stats['overview']['avg_duration'])->toBe(30.0)
        ->and(array_sum(array_column($stats['timeSeries'], 'total')))->toBe(3)
        ->and($stats['requests']->total())->toBe(2)
        ->and($routes['/fornecedores/listar']->total)->toBe(2)
        ->and($routes['/fornecedores/listar']->server_error_count)->toBe(1)
        ->and($routes['/inicio/index']->total)->toBe(1)
        ->and($stats['activity'])->toHaveCount(3)
        ->and(collect($stats['activity'])->pluck('status')->sort()->values()->all())->toBe([200, 200, 500])
        ->and($stats['activity'][0])->toHaveKeys(['id', 'at', 'method', 'path', 'url', 'status', 'duration']);

    // A picked route narrows the charts and activity but keeps the list whole.
    $listar = $routes['/fornecedores/listar']->hash;
    $picked = app(RecordService::class)->getRequestStats($project, '1h', routes: [$listar], user: '7');

    expect($picked['overview']['total'])->toBe(2)
        ->and($picked['activity'])->toHaveCount(2)
        ->and($picked['requests']->total())->toBe(2);

    // Bots are not this user's traffic.
    expect(app(RecordService::class)->getRequestStats($project, '1h', sources: ['ai'], user: '7')['overview']['total'])->toBe(0);
});

test('the requests page reads the user from the query string', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;
    $project = Project::factory()->create(['team_id' => $team->id]);

    app(IngestService::class)->ingest($project, [
        userRequest('7', '/inicio/index'),
        userRequest('9', '/inicio/index'),
    ]);

    $this->actingAs($user)
        ->get(route('requests', ['current_team' => $team->slug, 'project' => $project->slug, 'period' => '1h', 'user' => '9']))
        ->assertInertia(fn ($page) => $page
            ->where('user.key', '9')
            ->where('user.name', '9')
            ->where('overview.total', 1)
            ->has('activity', 1)
            ->has('requests.data', 1));
});

test('a user from another project shows nothing', function () {
    $project = Project::factory()->create();
    $other = Project::factory()->create();

    app(IngestService::class)->ingest($other, [userRequest('7', '/secret')]);

    $stats = app(RecordService::class)->getRequestStats($project, '1h', user: '7');

    expect($stats['overview']['total'])->toBe(0)
        ->and($stats['activity'])->toBe([])
        ->and($stats['requests']->total())->toBe(0);
});
