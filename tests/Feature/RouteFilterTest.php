<?php

use App\Models\Project;
use App\Models\User;
use App\Services\IngestService;
use App\Services\RecordService;
use App\Support\RoutePattern;

function filteredRoute(string $method, string $path, ?string $user = null, string $userAgent = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0'): array
{
    return [
        't' => 'request',
        'method' => $method,
        'route_path' => $path,
        'url' => 'https://app.test'.$path,
        'user' => $user,
        'status_code' => 200,
        'duration' => 10,
        'headers' => json_encode(['user-agent' => [$userAgent]]),
    ];
}

/**
 * The paths a filter keeps from the route list, sorted.
 *
 * @return list<string>
 */
function filteredPaths(array $stats): array
{
    return collect($stats['requests']->items())
        ->map(fn (object $row) => $row->method.' '.$row->path)
        ->sort()
        ->values()
        ->all();
}

beforeEach(function () {
    $this->project = Project::factory()->create();

    app(IngestService::class)->ingest($this->project, [
        filteredRoute('GET', '/api/client/ideas'),
        filteredRoute('POST', '/api/client/ideas'),
        filteredRoute('POST', '/admin/companion-ideas/review'),
        filteredRoute('GET', '/admin/companion-ideas'),
        filteredRoute('PUT', '/settings/password'),
        filteredRoute('GET', '/posts/{post}'),
        filteredRoute('GET', '/reports/100%_done'),
        filteredRoute('GET', '/reports/1000-done'),
    ]);
});

test('the route list keeps the routes a filter matches', function (string $filter, array $expected) {
    $stats = app(RecordService::class)->getRequestStats($this->project, '1h', filter: RoutePattern::parse($filter));

    expect(filteredPaths($stats))->toBe($expected)
        ->and($stats['requests']->total())->toBe(count($expected))
        ->and($stats['filter'])->toBe(trim($filter));
})->with([
    'text matches anywhere in the path' => ['ideas', ['GET /admin/companion-ideas', 'GET /api/client/ideas', 'POST /admin/companion-ideas/review', 'POST /api/client/ideas']],
    'case is ignored' => ['IDEAS/REVIEW', ['POST /admin/companion-ideas/review']],
    'a star anchors to the whole path' => ['/admin/*', ['GET /admin/companion-ideas', 'POST /admin/companion-ideas/review']],
    'a leading star matches the end' => ['*ideas', ['GET /admin/companion-ideas', 'GET /api/client/ideas', 'POST /api/client/ideas']],
    'stars in the middle' => ['/api/*/ideas', ['GET /api/client/ideas', 'POST /api/client/ideas']],
    'a method narrows the path' => ['post /api/*', ['POST /api/client/ideas']],
    'a method before any path' => ['PUT *', ['PUT /settings/password']],
    'a method alone also matches paths holding it' => ['post', ['GET /posts/{post}', 'POST /admin/companion-ideas/review', 'POST /api/client/ideas']],
    'percent and underscore are plain text' => ['100%_', ['GET /reports/100%_done']],
    'surrounding spaces are dropped' => ['  /settings/*  ', ['PUT /settings/password']],
    'nothing matches' => ['/nowhere/*', []],
]);

test('the filter narrows the list, not the figures', function () {
    $stats = app(RecordService::class)->getRequestStats($this->project, '1h', filter: RoutePattern::parse('/admin/*'));

    expect($stats['requests']->total())->toBe(2)
        ->and($stats['overview']['total'])->toBe(8)
        ->and(array_sum(array_column($stats['timeSeries'], 'total')))->toBe(8);
});

test('the filter works together with traffic sources', function () {
    app(IngestService::class)->ingest($this->project, [
        filteredRoute('GET', '/admin/secret', userAgent: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'),
    ]);

    $humans = app(RecordService::class)->getRequestStats($this->project, '1h', sources: ['human'], filter: RoutePattern::parse('/admin/*'));
    $crawlers = app(RecordService::class)->getRequestStats($this->project, '1h', sources: ['ai'], filter: RoutePattern::parse('/admin/*'));

    expect(filteredPaths($humans))->toBe(['GET /admin/companion-ideas', 'POST /admin/companion-ideas/review'])
        ->and(filteredPaths($crawlers))->toBe(['GET /admin/secret']);
});

test('the filter narrows a signed-in user\'s routes too', function () {
    app(IngestService::class)->ingest($this->project, [
        filteredRoute('GET', '/api/client/ideas', '7'),
        filteredRoute('POST', '/api/client/ideas', '7'),
        filteredRoute('PUT', '/settings/password', '7'),
    ]);

    $stats = app(RecordService::class)->getRequestStats($this->project, '1h', user: '7', filter: RoutePattern::parse('post /api/*'));

    expect(filteredPaths($stats))->toBe(['POST /api/client/ideas'])
        ->and($stats['requests']->total())->toBe(1)
        ->and($stats['overview']['total'])->toBe(3)
        ->and($stats['filter'])->toBe('post /api/*');
});

test('the requests page reads the filter from the query string', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;
    $this->project->update(['team_id' => $team->id]);

    $this->actingAs($user)
        ->get(route('requests', ['current_team' => $team->slug, 'project' => $this->project->slug, 'period' => '1h', 'filter' => '/settings/*']))
        ->assertInertia(fn ($page) => $page
            ->component('projects/requests/index')
            ->where('filter', '/settings/*')
            ->where('requests.total', 1)
            ->where('requests.data.0.path', '/settings/password'));

    $this->actingAs($user)
        ->get(route('requests', ['current_team' => $team->slug, 'project' => $this->project->slug, 'period' => '1h', 'filter' => '   ']))
        ->assertInertia(fn ($page) => $page
            ->where('filter', null)
            ->where('requests.total', 8));
});
