<?php

use App\Models\Project;
use App\Models\User;
use App\Services\IngestService;

it('filters the route list as you type, with * standing for anything', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;
    $project = Project::factory()->create(['team_id' => $team->id]);

    $request = fn (string $method, string $path) => [
        't' => 'request',
        'method' => $method,
        'route_path' => $path,
        'status_code' => 200,
        'duration' => 10,
        'headers' => json_encode(['user-agent' => ['Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0']]),
    ];

    app(IngestService::class)->ingest($project, [
        $request('POST', '/admin/companion-ideas/review'),
        $request('GET', '/admin/companion-ideas'),
        $request('POST', '/api/client/ideas'),
        $request('PUT', '/settings/password'),
    ]);

    $this->actingAs($user);

    visit("/{$team->slug}/{$project->slug}/requests?period=1h")
        ->assertSee('4 Routes')
        ->type('[aria-label="Filter routes"]', '/admin/*')
        ->assertSee('2 Routes')
        ->assertSee('/admin/companion-ideas/review')
        ->assertDontSee('/settings/password')
        ->assertQueryStringHas('filter', '/admin/*')
        ->clear('[aria-label="Filter routes"]')
        ->type('[aria-label="Filter routes"]', 'post /api/*')
        ->assertSee('1 Route')
        ->assertSee('/api/client/ideas')
        ->assertDontSee('/admin/companion-ideas/review')
        ->clear('[aria-label="Filter routes"]')
        ->type('[aria-label="Filter routes"]', '/nowhere/*')
        ->assertSee('No routes match')
        ->click('Clear the filter')
        ->assertSee('4 Routes')
        ->assertNoJavaScriptErrors();
});
