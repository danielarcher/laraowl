<?php

use App\Enums\TeamRole;
use App\Models\Project;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use App\Services\IngestService;
use App\Services\OverviewService;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A team owner and their team.
 *
 * @return array{User, Team}
 */
function overviewTeam(): array
{
    $team = Team::factory()->create(['name' => 'Acme']);
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    return [$user, $team];
}

function overviewIngest(Project $project, array $records): void
{
    app(IngestService::class)->ingest($project, $records);
}

test('the overview lists every app of the team grouped by server with its totals', function () {
    [$user, $team] = overviewTeam();
    $server = Server::factory()->create(['team_id' => $team->id, 'name' => 'web-1']);
    $shop = Project::factory()->create(['team_id' => $team->id, 'server_id' => $server->id, 'name' => 'Shop']);
    $blog = Project::factory()->create(['team_id' => $team->id, 'name' => 'Blog']);
    $foreign = Project::factory()->create(['name' => 'Someone else']);

    overviewIngest($shop, [
        ['t' => 'request', 'status_code' => 200, 'duration' => 20000],
        ['t' => 'request', 'status_code' => 200, 'duration' => 20000],
        ['t' => 'request', 'status_code' => 500, 'duration' => 900000],
        ['t' => 'request', 'status_code' => 404, 'duration' => 1000],
        ['t' => 'exception', 'class' => 'E', 'message' => 'm'],
        ['t' => 'job-attempt', 'name' => 'J', 'status' => 'failed'],
        ['t' => 'job-attempt', 'name' => 'J', 'status' => 'processed'],
    ]);
    overviewIngest($blog, [['t' => 'request', 'status_code' => 200, 'duration' => 5000]]);
    overviewIngest($foreign, [['t' => 'request', 'status_code' => 500]]);

    $this->actingAs($user)
        ->get(route('overview', ['current_team' => $team->slug, 'period' => '1h']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('overview/index', false)
            ->has('groups', 2)
            ->where('groups.0.server.name', 'web-1')
            ->has('groups.0.projects', 1)
            ->where('groups.0.projects.0.name', 'Shop')
            ->where('groups.0.projects.0.requests', 4)
            ->where('groups.0.projects.0.server_errors', 1)
            ->where('groups.0.projects.0.client_errors', 1)
            ->where('groups.0.projects.0.error_rate', 25)
            ->where('groups.0.projects.0.p95_ms', 1000)
            ->where('groups.0.projects.0.exceptions', 1)
            ->where('groups.0.projects.0.jobs', 2)
            ->where('groups.0.projects.0.failed_jobs', 1)
            ->where('groups.1.server', null)
            ->where('groups.1.projects.0.name', 'Blog')
            ->where('totals.apps', 2)
            ->where('totals.requests', 5)
            ->where('totals.server_errors', 1)
            ->where('totals.error_rate', 20)
            ->where('totals.exceptions', 1)
            ->where('totals.failed_jobs', 1)
            ->where('totals.p95_ms', 1000)
        );
});

test('each app carries a request trend that adds up to its total', function () {
    [$user, $team] = overviewTeam();
    $project = Project::factory()->create(['team_id' => $team->id]);

    $this->travelTo(now()->subMinutes(50));
    overviewIngest($project, [['t' => 'request', 'status_code' => 500], ['t' => 'request', 'status_code' => 200]]);
    $this->travelBack();
    overviewIngest($project, [['t' => 'request', 'status_code' => 200]]);

    $this->actingAs($user)
        ->get(route('overview', ['current_team' => $team->slug, 'period' => '1h']))
        ->assertOk()
        ->assertInertia(function (Assert $page) {
            $trend = collect($page->toArray()['props']['groups'][0]['projects'][0]['trend']);

            expect($page->toArray()['props']['slot_seconds'])->toBe(60)
                ->and($trend->count())->toBeBetween(60, 62)
                ->and($trend->sum('requests'))->toBe(3)
                ->and($trend->sum('errors'))->toBe(1)
                ->and($trend->last()['requests'])->toBe(1);
        });
});

test('each app carries its issue occurrences per type, and ignored issues do not count', function () {
    [$user, $team] = overviewTeam();
    $shop = Project::factory()->create(['team_id' => $team->id, 'name' => 'Shop']);
    $blog = Project::factory()->create(['team_id' => $team->id, 'name' => 'Blog']);

    $this->travelTo(now()->subMinutes(30));
    overviewIngest($shop, [['t' => 'exception', 'class' => 'E', 'message' => 'm']]);
    $this->travelBack();
    overviewIngest($shop, [
        ['t' => 'exception', 'class' => 'E', 'message' => 'm'],
        ['t' => 'request', 'method' => 'GET', 'url' => 'https://shop.test/../../etc/passwd', 'status_code' => 404, 'ip' => '203.0.113.7'],
    ]);
    overviewIngest($blog, [['t' => 'exception', 'class' => 'E', 'message' => 'm']]);
    $blog->issues()->update(['status' => 'ignored']);

    $this->actingAs($user)
        ->get(route('overview', ['current_team' => $team->slug, 'period' => '1h']))
        ->assertOk()
        ->assertInertia(function (Assert $page) {
            $apps = collect($page->toArray()['props']['groups'][0]['projects'])->keyBy('name');
            $trend = collect($apps['Shop']['trend']);

            expect($apps['Shop']['exception_issues'])->toBe(2)
                ->and($apps['Shop']['security_issues'])->toBe(1)
                ->and($trend->sum('exception_issues'))->toBe(2)
                ->and($trend->where('exception_issues', '>', 0)->count())->toBe(2)
                ->and($trend->last()['security_issues'])->toBe(1)
                ->and($apps['Blog']['exception_issues'])->toBe(0);
        });
});

test('the overview counts apps that are up, down or quiet', function () {
    [$user, $team] = overviewTeam();
    Project::factory()->create(['team_id' => $team->id, 'url' => 'https://up.test', 'uptime_monitoring_enabled' => true, 'last_uptime_status' => 'up']);
    Project::factory()->create(['team_id' => $team->id, 'url' => 'https://down.test', 'uptime_monitoring_enabled' => true, 'last_uptime_status' => 'down']);
    Project::factory()->create(['team_id' => $team->id, 'url' => null]);

    $this->actingAs($user)
        ->get(route('overview', ['current_team' => $team->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('totals.apps', 3)
            ->where('totals.apps_up', 1)
            ->where('totals.apps_down', 1)
            ->where('totals.apps_quiet', 3)
            ->where('totals.error_rate', null)
            ->where('totals.p95_ms', null)
        );
});

test('only team members can open the overview', function () {
    [, $team] = overviewTeam();

    $this->actingAs(User::factory()->create())
        ->get(route('overview', ['current_team' => $team->slug]))
        ->assertForbidden();
});

test('signing in lands on the overview once the team has an app', function () {
    $user = User::factory()->create();
    Project::factory()->create(['team_id' => $user->currentTeam->id]);

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertRedirect(route('overview', ['current_team' => $user->currentTeam->slug]));
});

test('trend points are round widths, so they start on whole hours', function () {
    $overview = app(OverviewService::class);

    expect($overview->slotSeconds(now()->subHour(), now()))->toBe(60)
        ->and($overview->slotSeconds(now()->subDay(), now()))->toBe(1800)
        ->and($overview->slotSeconds(now()->subDays(7), now()))->toBe(10800)
        ->and($overview->slotSeconds(now()->subDays(30), now()))->toBe(43200);
});
