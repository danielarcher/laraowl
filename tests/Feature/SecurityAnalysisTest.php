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
