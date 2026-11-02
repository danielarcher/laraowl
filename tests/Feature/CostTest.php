<?php

use App\Enums\CostCategory;
use App\Enums\CostInterval;
use App\Enums\TeamRole;
use App\Models\Cost;
use App\Models\Project;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use App\Services\IngestService;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A team and a user with the given role in it.
 *
 * @return array{User, Team}
 */
function costTeam(TeamRole $role = TeamRole::Owner): array
{
    $team = Team::factory()->create(['name' => 'Acme']);
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => $role->value]);

    return [$user, $team];
}

function costRequests(Project $project, int $count): void
{
    app(IngestService::class)->ingest($project, array_fill(0, $count, ['t' => 'request', 'status_code' => 200, 'duration' => 1000]));
}

test('the costs page lists the team costs with the monthly run-rate', function () {
    [$user, $team] = costTeam();
    $server = Server::factory()->create(['team_id' => $team->id, 'name' => 'web-1']);
    Cost::factory()->create(['team_id' => $team->id, 'server_id' => $server->id, 'name' => 'web-1', 'category' => CostCategory::Server, 'amount_cents' => 1710]);
    Cost::factory()->create(['team_id' => $team->id, 'name' => 'example.com', 'category' => CostCategory::Domain, 'amount_cents' => 2400, 'interval' => CostInterval::Yearly]);
    Cost::factory()->create(['name' => 'Someone else']);

    $this->actingAs($user)
        ->get(route('teams.costs.index', ['team' => $team->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/costs', false)
            ->has('costs', 2)
            ->where('costs.0.name', 'web-1')
            ->where('costs.0.server_name', 'web-1')
            ->where('costs.1.name', 'example.com')
            ->where('costs.1.monthly_cents', 200)
            ->where('summary.monthly_cents', 1910)
            ->where('summary.yearly_cents', 22920)
            ->where('summary.approximate', false)
            ->has('servers', 1)
        );
});

test('an owner adds, updates and removes a cost', function () {
    [$user, $team] = costTeam();
    $server = Server::factory()->create(['team_id' => $team->id]);

    $this->actingAs($user)
        ->post(route('teams.costs.store', ['team' => $team->slug]), [
            'name' => 'web-1',
            'category' => 'server',
            'server_id' => $server->id,
            'amount' => '17.10',
            'currency' => 'USD',
            'interval' => 'monthly',
        ])
        ->assertRedirect(route('teams.costs.index', ['team' => $team->slug]));

    $cost = $team->costs()->sole();
    expect($cost->amount_cents)->toBe(1710)
        ->and($cost->server_id)->toBe($server->id)
        ->and($cost->category)->toBe(CostCategory::Server);

    $this->actingAs($user)
        ->patch(route('teams.costs.update', ['team' => $team->slug, 'cost' => $cost->id]), [
            'name' => 'keepitfive.ie',
            'category' => 'domain',
            'server_id' => null,
            'amount' => '61.5',
            'currency' => 'EUR',
            'interval' => 'yearly',
        ])
        ->assertRedirect();

    expect($cost->fresh())
        ->name->toBe('keepitfive.ie')
        ->amount_cents->toBe(6150)
        ->currency->toBe('EUR')
        ->interval->toBe(CostInterval::Yearly)
        ->server_id->toBeNull();

    $this->actingAs($user)
        ->delete(route('teams.costs.destroy', ['team' => $team->slug, 'cost' => $cost->id]))
        ->assertRedirect();

    expect($team->costs()->count())->toBe(0);
});

test('a cost needs a known currency, a positive amount and a server of the team', function () {
    [$user, $team] = costTeam();
    $foreignServer = Server::factory()->create();

    $this->actingAs($user)
        ->post(route('teams.costs.store', ['team' => $team->slug]), [
            'name' => '',
            'category' => 'gadgets',
            'server_id' => $foreignServer->id,
            'amount' => '0',
            'currency' => 'JPY',
            'interval' => 'weekly',
        ])
        ->assertSessionHasErrors(['name', 'category', 'server_id', 'amount', 'currency', 'interval']);

    expect(Cost::count())->toBe(0);
});

test('an admin manages costs but a member cannot see them', function () {
    [$admin, $team] = costTeam(TeamRole::Admin);
    $member = User::factory()->create();
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);
    $cost = Cost::factory()->create(['team_id' => $team->id]);

    $this->actingAs($admin)->get(route('teams.costs.index', ['team' => $team->slug]))->assertOk();

    $this->actingAs($member)->get(route('teams.costs.index', ['team' => $team->slug]))->assertForbidden();
    $this->actingAs($member)
        ->post(route('teams.costs.store', ['team' => $team->slug]), ['name' => 'x', 'category' => 'plan', 'amount' => 1, 'currency' => 'USD', 'interval' => 'monthly'])
        ->assertForbidden();
    $this->actingAs($member)
        ->delete(route('teams.costs.destroy', ['team' => $team->slug, 'cost' => $cost->id]))
        ->assertForbidden();

    expect($cost->fresh())->not->toBeNull();
});

test('a cost of another team cannot be changed', function () {
    [$user, $team] = costTeam();
    $foreign = Cost::factory()->create();

    $this->actingAs($user)
        ->delete(route('teams.costs.destroy', ['team' => $team->slug, 'cost' => $foreign->id]))
        ->assertNotFound();

    expect($foreign->fresh())->not->toBeNull();
});

test('the overview shows the monthly spend by category, converting other currencies', function () {
    [$user, $team] = costTeam();
    config(['laraowl.costs.rates.EUR' => 1.2]);
    $server = Server::factory()->create(['team_id' => $team->id]);
    Project::factory()->create(['team_id' => $team->id, 'server_id' => $server->id]);
    Cost::factory()->create(['team_id' => $team->id, 'server_id' => $server->id, 'category' => CostCategory::Server, 'amount_cents' => 1800]);
    Cost::factory()->create(['team_id' => $team->id, 'category' => CostCategory::Plan, 'amount_cents' => 1900]);
    Cost::factory()->create(['team_id' => $team->id, 'category' => CostCategory::Service, 'amount_cents' => 500, 'currency' => 'EUR']);
    Cost::factory()->create(['team_id' => $team->id, 'category' => CostCategory::Domain, 'amount_cents' => 1200, 'interval' => CostInterval::Yearly]);

    $this->actingAs($user)
        ->get(route('overview', ['current_team' => $team->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('spending.monthly_cents', 4400)
            ->where('spending.yearly_cents', 52800)
            ->where('spending.approximate', true)
            ->where('spending.categories', [
                ['category' => 'server', 'label' => 'Servers', 'monthly_cents' => 1800],
                ['category' => 'plan', 'label' => 'Plans', 'monthly_cents' => 1900],
                ['category' => 'service', 'label' => 'Services', 'monthly_cents' => 600],
                ['category' => 'domain', 'label' => 'Domains', 'monthly_cents' => 100],
            ])
            ->has('spending.apps', 1)
        );
});

test('members see the overview without spending', function () {
    [$member, $team] = costTeam(TeamRole::Member);
    Project::factory()->create(['team_id' => $team->id]);
    Cost::factory()->create(['team_id' => $team->id]);

    $this->actingAs($member)
        ->get(route('overview', ['current_team' => $team->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('spending', null));
});

test('a server price is shared by its apps evenly and by their requests', function () {
    [$user, $team] = costTeam();
    $web = Server::factory()->create(['team_id' => $team->id, 'name' => 'web-1']);
    $monitor = Server::factory()->create(['team_id' => $team->id, 'name' => 'monitor']);
    $shop = Project::factory()->create(['team_id' => $team->id, 'server_id' => $web->id, 'name' => 'Shop']);
    $blog = Project::factory()->create(['team_id' => $team->id, 'server_id' => $web->id, 'name' => 'Blog']);
    Cost::factory()->create(['team_id' => $team->id, 'server_id' => $web->id, 'category' => CostCategory::Server, 'amount_cents' => 1800]);
    Cost::factory()->create(['team_id' => $team->id, 'server_id' => $monitor->id, 'category' => CostCategory::Server, 'amount_cents' => 1200]);

    costRequests($shop, 3);
    costRequests($blog, 1);

    $this->actingAs($user)
        ->get(route('servers.index', ['current_team' => $team->slug]))
        ->assertOk()
        ->assertInertia(function (Assert $page) use ($web, $monitor) {
            $costs = $page->toArray()['props']['costs'];
            $apps = collect($costs[$web->id]['apps'])->keyBy('name');

            expect($costs[$web->id]['monthly_cents'])->toBe(1800)
                ->and($apps['Shop']['equal_cents'])->toBe(900)
                ->and($apps['Blog']['equal_cents'])->toBe(900)
                ->and($apps['Shop']['traffic_cents'])->toBe(1350)
                ->and($apps['Blog']['traffic_cents'])->toBe(450)
                ->and($apps['Shop']['traffic_share'])->toEqual(75)
                ->and($apps['Shop']['requests'])->toBe(3)
                ->and($costs[$monitor->id]['monthly_cents'])->toBe(1200)
                ->and($costs[$monitor->id]['apps'])->toBe([]);
        });
});

test('without requests the traffic split falls back to the even split', function () {
    [$user, $team] = costTeam();
    $server = Server::factory()->create(['team_id' => $team->id]);
    Project::factory()->count(3)->create(['team_id' => $team->id, 'server_id' => $server->id]);
    Cost::factory()->create(['team_id' => $team->id, 'server_id' => $server->id, 'category' => CostCategory::Server, 'amount_cents' => 900]);

    $this->actingAs($user)
        ->get(route('servers.show', ['current_team' => $team->slug, 'server' => $server->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('cost.monthly_cents', 900)
            ->has('cost.apps', 3)
            ->where('cost.apps.0.equal_cents', 300)
            ->where('cost.apps.0.traffic_cents', 300)
            ->where('cost.apps.0.traffic_share', null)
        );
});

test('members see servers without prices', function () {
    [$member, $team] = costTeam(TeamRole::Member);
    $server = Server::factory()->create(['team_id' => $team->id]);
    Cost::factory()->create(['team_id' => $team->id, 'server_id' => $server->id, 'category' => CostCategory::Server]);

    $this->actingAs($member)
        ->get(route('servers.index', ['current_team' => $team->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('costs', null));

    $this->actingAs($member)
        ->get(route('servers.show', ['current_team' => $team->slug, 'server' => $server->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('cost', null));
});

test('removing a server keeps its cost, unlinked', function () {
    [, $team] = costTeam();
    $server = Server::factory()->create(['team_id' => $team->id]);
    $cost = Cost::factory()->create(['team_id' => $team->id, 'server_id' => $server->id, 'category' => CostCategory::Server]);

    $server->delete();

    expect($cost->fresh()->server_id)->toBeNull();
});
