<?php

use App\Models\Project;
use App\Models\RecordSourceRollup;
use App\Models\User;
use App\Services\IngestService;
use App\Services\RecordService;
use App\Support\TrafficSource;

function sourceRequest(string $userAgent, int $status = 200, int $duration = 10): array
{
    return [
        't' => 'request',
        'status_code' => $status,
        'duration' => $duration,
        'headers' => json_encode(['user-agent' => [$userAgent]]),
    ];
}

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
const CLAUDEBOT_UA = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)';

test('user agents are sorted into traffic sources', function (?string $userAgent, string $source) {
    expect(TrafficSource::classify($userAgent))->toBe($source);
})->with([
    'chrome' => [CHROME_UA, 'human'],
    'iphone safari' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', 'human'],
    'claudebot' => [CLAUDEBOT_UA, 'ai'],
    'gptbot' => ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot', 'ai'],
    'googlebot' => ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'search'],
    'bingbot' => ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'search'],
    'laraowl uptime' => ['Mozilla/5.0 (compatible; LaraOwlUptimeBot/1.0; uptime monitor)', 'monitor'],
    'uptimerobot' => ['Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)', 'monitor'],
    'facebook preview' => ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'bot'],
    'curl' => ['curl/8.6.0', 'bot'],
    'okhttp' => ['okhttp/5.3.0', 'bot'],
    'empty' => ['', 'bot'],
    'missing' => [null, 'bot'],
]);

test('the sources filter reads only known sources and treats all of them as no filter', function () {
    expect(TrafficSource::parse('human,ai'))->toBe(['human', 'ai'])
        ->and(TrafficSource::parse('human,nonsense'))->toBe(['human'])
        ->and(TrafficSource::parse('nonsense'))->toBeNull()
        ->and(TrafficSource::parse(''))->toBeNull()
        ->and(TrafficSource::parse(null))->toBeNull()
        ->and(TrafficSource::parse(implode(',', TrafficSource::ALL)))->toBeNull();
});

test('ingested requests are rolled up per source', function () {
    $project = Project::factory()->create();

    app(IngestService::class)->ingest($project, [
        sourceRequest(CHROME_UA),
        sourceRequest(CLAUDEBOT_UA),
        sourceRequest(CLAUDEBOT_UA, 500),
        ['t' => 'exception', 'class' => 'E', 'message' => 'm'],
    ]);

    $rows = RecordSourceRollup::where('project_id', $project->id)->get()->keyBy('source');

    expect($rows)->toHaveCount(2)
        ->and((int) $rows['human']->count)->toBe(1)
        ->and((int) $rows['ai']->count)->toBe(2)
        ->and((int) $rows['ai']->server_error_count)->toBe(1);
});

test('the dashboard can leave sources out of the request figures', function () {
    $project = Project::factory()->create();

    app(IngestService::class)->ingest($project, [
        sourceRequest(CHROME_UA, 200, 10),
        sourceRequest(CHROME_UA, 404, 30),
        sourceRequest(CLAUDEBOT_UA, 500, 900),
        sourceRequest(CLAUDEBOT_UA, 200, 900),
        sourceRequest('Mozilla/5.0 (compatible; LaraOwlUptimeBot/1.0; uptime monitor)'),
    ]);

    $all = app(RecordService::class)->getDashboardStats($project, '1h');
    $humans = app(RecordService::class)->getDashboardStats($project, '1h', sources: ['human']);

    expect($all['total_requests'])->toBe(5)
        ->and($all['sources'])->toBe(TrafficSource::ALL)
        ->and($all['source_totals'])->toBe(['human' => 2, 'search' => 0, 'ai' => 2, 'monitor' => 1, 'bot' => 0])
        ->and($humans['total_requests'])->toBe(2)
        ->and($humans['sources'])->toBe(['human'])
        ->and($humans['request_breakdown'])->toMatchArray(['ok' => 1, 'client_error' => 1, 'server_error' => 0])
        ->and($humans['duration_stats']['avg'])->toBe(20.0)
        ->and(array_sum(array_column($humans['timeSeries'], 'total')))->toBe(2)
        // The source counts stay whole, so a hidden source still shows its size.
        ->and($humans['source_totals'])->toBe($all['source_totals']);
});

test('the dashboard page takes the sources from the query string', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;
    $project = Project::factory()->create(['team_id' => $team->id]);

    app(IngestService::class)->ingest($project, [
        sourceRequest(CHROME_UA),
        sourceRequest(CLAUDEBOT_UA),
        sourceRequest(CLAUDEBOT_UA),
    ]);

    $this->actingAs($user)
        ->get(route('dashboard', ['current_team' => $team->slug, 'project' => $project->slug, 'sources' => 'human,search']))
        ->assertInertia(fn ($page) => $page
            ->component('dashboard/index')
            ->where('total_requests', 1)
            ->where('sources', ['human', 'search'])
            ->where('source_totals.ai', 2));
});

test('the source rollups can be rebuilt from raw requests', function () {
    $project = Project::factory()->create();

    app(IngestService::class)->ingest($project, [
        sourceRequest(CHROME_UA),
        sourceRequest(CLAUDEBOT_UA),
    ]);

    // Rows from before the feature existed: only the raw records remain.
    RecordSourceRollup::query()->delete();
    $project->records()->update(['created_at' => now()->subHour()]);

    $this->artisan('laraowl:sources:backfill', ['--project' => $project->id, '--days' => 1])->assertSuccessful();

    expect(RecordSourceRollup::where('project_id', $project->id)->pluck('count', 'source')->map(fn ($c) => (int) $c)->all())
        ->toEqualCanonicalizing(['human' => 1, 'ai' => 1]);

    // A second run replaces the range instead of adding to it.
    $this->artisan('laraowl:sources:backfill', ['--project' => $project->id, '--days' => 1])->assertSuccessful();

    expect((int) RecordSourceRollup::where('project_id', $project->id)->sum('count'))->toBe(2);
});
