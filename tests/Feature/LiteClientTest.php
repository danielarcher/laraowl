<?php

use App\Enums\TeamRole;
use App\Models\Project;
use App\Models\RecordGroupRollup;
use App\Models\RecordRollup;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Plain PHP sites report through danielarcher/laraowl-lite. Its batches use
 * the Laravel client's record format with fewer fields; the fixture is a real
 * batch built by that package: a ticket page that logged a failed email and a
 * warning, then reported the mailer's exception.
 */

/**
 * @return array{User, Team, Project}
 */
function liteProject(): array
{
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    return [$user, $team, Project::factory()->create(['team_id' => $team->id])];
}

function liteBatch(): array
{
    return json_decode(file_get_contents(base_path('tests/Fixtures/laraowl-lite-batch.json')), true, flags: JSON_THROW_ON_ERROR);
}

test('a Lite batch is accepted and stored as requests, logs and exceptions', function () {
    [, , $project] = liteProject();

    $this->withToken($project->api_token)->postJson('/api/records', liteBatch())->assertStatus(202);

    expect($project->records()->orderBy('id')->pluck('type')->all())->toBe(['request', 'log', 'log', 'exception'])
        ->and($project->records()->where('type', 'request')->first()->payload['url'])->toBe('https://balfolkdublin.ie/ticket/[redacted]?lang=en');

    $route = RecordGroupRollup::query()->where('project_id', $project->id)->where('type', 'request')->sole();

    expect((int) RecordRollup::query()->where('project_id', $project->id)->where('type', 'request')->sum('count'))->toBe(1)
        ->and($route->sublabel ?? $route->label)->toContain('/ticket/{code}')
        ->and((int) $route->server_error_count)->toBe(1);
});

test("a Lite exception opens as an issue with the site's code", function () {
    [$user, $team, $project] = liteProject();
    $this->withToken($project->api_token)->postJson('/api/records', liteBatch())->assertStatus(202);

    $issue = $project->issues()->firstOrFail();

    $this->actingAs($user)
        ->get(route('issues.show', ['current_team' => $team->slug, 'project' => $project->slug, 'issue' => $issue->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('projects/issues/show')
            ->where('issue.records.0.payload.class', 'RuntimeException')
            ->where('issue.records.0.payload.stack.0.file', 'src/mailer.php')
            ->where('issue.records.0.payload.stack.0.line', 53)
            ->where('issue.records.0.payload.stack.1.function', 'send_ticket_email')
            ->where('issue.records.0.payload.php_version', fn ($version) => is_string($version) && $version !== '')
        );
});

test('Lite records show on the requests, request detail and logs pages', function () {
    [$user, $team, $project] = liteProject();
    $this->withToken($project->api_token)->postJson('/api/records', liteBatch())->assertStatus(202);
    $request = $project->records()->where('type', 'request')->firstOrFail();
    $params = ['current_team' => $team->slug, 'project' => $project->slug];

    $this->actingAs($user)->get(route('requests', $params))->assertOk();
    $this->actingAs($user)->get(route('records.show', [...$params, 'record' => $request->id]))->assertOk();
    $this->actingAs($user)->get(route('logs', $params))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('projects/logs/index')
            ->where('records.data.0.payload.level', fn ($level) => in_array($level, ['error', 'warning'], true))
            ->has('records.data', 2)
        );
});

test('a Lite site is linked to the server it runs on', function () {
    [, $team, $project] = liteProject();
    $server = Server::factory()->create(['team_id' => $team->id, 'hostname' => 'silent-temple']);

    $this->withToken($project->api_token)->postJson('/api/records', liteBatch())->assertStatus(202);
    $this->artisan('laraowl:projects:link-servers')->assertSuccessful();

    expect($project->fresh()->server_id)->toBe($server->id);
});
