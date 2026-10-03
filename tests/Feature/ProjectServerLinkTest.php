<?php

use App\Enums\TeamRole;
use App\Models\Project;
use App\Models\Record;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A team owner and their team.
 *
 * @return array{User, Team}
 */
function linkTeam(): array
{
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    return [$user, $team];
}

function recordFrom(Project $project, string $hostname): Record
{
    return Record::create(['project_id' => $project->id, 'type' => 'request', 'payload' => ['server' => $hostname], 'created_at' => now()]);
}

test('the link command points each project at the server its latest record came from', function () {
    [, $team] = linkTeam();
    $old = Server::factory()->create(['team_id' => $team->id, 'hostname' => 'old-box']);
    $new = Server::factory()->create(['team_id' => $team->id, 'hostname' => 'new-box']);
    $moved = Project::factory()->create(['team_id' => $team->id]);
    recordFrom($moved, 'old-box');
    recordFrom($moved, 'new-box');
    $stayed = Project::factory()->create(['team_id' => $team->id, 'server_id' => $old->id]);
    recordFrom($stayed, 'old-box');

    $this->artisan('laraowl:projects:link-servers')
        ->expectsOutput('Linked 1 project(s) to a new server.')
        ->assertSuccessful();

    expect($moved->fresh()->server_id)->toBe($new->id)
        ->and($stayed->fresh()->server_id)->toBe($old->id);
});

test('the link command keeps a hand-picked server when records name no known server', function () {
    [, $team] = linkTeam();
    $server = Server::factory()->create(['team_id' => $team->id, 'hostname' => 'web-1']);
    $uptimeOnly = Project::factory()->create(['team_id' => $team->id, 'server_id' => $server->id]);
    $elsewhere = Project::factory()->create(['team_id' => $team->id, 'server_id' => $server->id]);
    recordFrom($elsewhere, 'laptop');

    $this->artisan('laraowl:projects:link-servers')->assertSuccessful();

    expect($uptimeOnly->fresh()->server_id)->toBe($server->id)
        ->and($elsewhere->fresh()->server_id)->toBe($server->id);
});

test('the link command never links a project to another team\'s server', function () {
    [, $team] = linkTeam();
    Server::factory()->create(['team_id' => $team->id, 'hostname' => 'web-1']);
    $project = Project::factory()->create();
    recordFrom($project, 'web-1');

    $this->artisan('laraowl:projects:link-servers')->assertSuccessful();

    expect($project->fresh()->server_id)->toBeNull();
});

test('the server can be picked and cleared from the project settings', function () {
    [$user, $team] = linkTeam();
    $server = Server::factory()->create(['team_id' => $team->id]);
    $project = Project::factory()->create(['team_id' => $team->id]);
    $route = route('projects.update', ['current_team' => $team->slug, 'project' => $project->slug]);
    $fields = ['name' => $project->name, 'retention_days' => 7];

    $this->actingAs($user)->patch($route, [...$fields, 'server_id' => $server->id])->assertSessionHasNoErrors();
    expect($project->fresh()->server_id)->toBe($server->id);

    $this->actingAs($user)->patch($route, $fields)->assertSessionHasNoErrors();
    expect($project->fresh()->server_id)->toBe($server->id);

    $this->actingAs($user)->patch($route, [...$fields, 'server_id' => ''])->assertSessionHasNoErrors();
    expect($project->fresh()->server_id)->toBeNull();
});

test('the project settings reject another team\'s server', function () {
    [$user, $team] = linkTeam();
    $project = Project::factory()->create(['team_id' => $team->id]);
    $foreign = Server::factory()->create();

    $this->actingAs($user)
        ->patch(route('projects.update', ['current_team' => $team->slug, 'project' => $project->slug]), [
            'name' => $project->name,
            'server_id' => $foreign->id,
        ])
        ->assertSessionHasErrors('server_id');

    expect($project->fresh()->server_id)->toBeNull();
});

test('deleting a server unlinks its projects', function () {
    [, $team] = linkTeam();
    $server = Server::factory()->create(['team_id' => $team->id]);
    $project = Project::factory()->create(['team_id' => $team->id, 'server_id' => $server->id]);

    $server->delete();

    expect($project->fresh()->server_id)->toBeNull();
});

test('every page shares the servers of the user\'s teams for the switcher', function () {
    [$user, $team] = linkTeam();
    $server = Server::factory()->create(['team_id' => $team->id, 'name' => 'web-1']);
    Server::factory()->create(['name' => 'someone-else']);
    $project = Project::factory()->create(['team_id' => $team->id, 'server_id' => $server->id, 'name' => 'Shop']);

    $this->actingAs($user)
        ->get(route('project.settings', ['current_team' => $team->slug, 'project' => $project->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('availableServers', 1)
            ->where('availableServers.0.name', 'web-1')
            ->where('availableServers.0.team_id', $team->id)
            ->where('availableServers.0.is_online', true)
            ->missing('availableServers.0.api_token')
            ->where('projects.0.server_id', $server->id)
            ->where('project.server_id', $server->id)
        );
});
