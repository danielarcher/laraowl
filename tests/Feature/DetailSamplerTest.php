<?php

use App\Models\Project;
use App\Models\RecordRollup;
use App\Models\Threshold;
use App\Services\IngestService;

beforeEach(function () {
    // Only what is worth opening; no random sample.
    config(['laraowl.raw_detail.sample_rate' => 0.0]);
});

function sampledIngest(Project $project, array $records): void
{
    app(IngestService::class)->ingest($project, $records);
}

/**
 * A request and its detail, all on one trace.
 */
function traceOf(string $traceId, array $request, int $queries = 3): array
{
    $records = [['t' => 'request', 'method' => 'GET', 'route_path' => '/', 'status_code' => 200, 'duration' => 80_000, 'trace_id' => $traceId, ...$request]];

    for ($i = 0; $i < $queries; $i++) {
        $records[] = ['t' => 'query', 'sql' => 'select * from users where id = ?', 'duration' => 900, 'trace_id' => $traceId];
    }

    $records[] = ['t' => 'cache-event', 'type' => 'hit', 'key' => 'settings', 'trace_id' => $traceId];
    $records[] = ['t' => 'outgoing-request', 'method' => 'GET', 'url' => 'https://api.example.com', 'status_code' => 200, 'duration' => 40_000, 'trace_id' => $traceId];

    return $records;
}

function rawCount(Project $project, string $type): int
{
    return $project->records()->where('type', $type)->count();
}

function rolledUp(Project $project, string $type): int
{
    return (int) RecordRollup::query()->where('project_id', $project->id)->where('type', $type)->sum('count');
}

test('a fast, successful request keeps no raw detail, but every record is counted', function () {
    $project = Project::factory()->create();

    sampledIngest($project, traceOf('fast', []));

    expect(rawCount($project, 'request'))->toBe(1)
        ->and(rawCount($project, 'query'))->toBe(0)
        ->and(rawCount($project, 'cache-event'))->toBe(0)
        ->and(rawCount($project, 'outgoing-request'))->toBe(0)
        ->and(rolledUp($project, 'query'))->toBe(3)
        ->and(rolledUp($project, 'cache-event'))->toBe(1)
        ->and(rolledUp($project, 'outgoing-request'))->toBe(1);

    // The request says what was left out, so its trace view can explain.
    expect($project->records()->where('type', 'request')->first()->payload['_detail_dropped'])
        ->toBe(['query' => 3, 'cache-event' => 1, 'outgoing-request' => 1]);
});

test('slow, failed and throwing requests keep all their detail', function (array $request, array $extra) {
    $project = Project::factory()->create();

    sampledIngest($project, [...traceOf('worth-opening', $request), ...$extra]);

    expect(rawCount($project, 'query'))->toBe(3)
        ->and(rawCount($project, 'cache-event'))->toBe(1)
        ->and(rawCount($project, 'outgoing-request'))->toBe(1)
        ->and($project->records()->where('type', 'request')->first()->payload)->not->toHaveKey('_detail_dropped');
})->with([
    'slow' => [['duration' => 650_000], []],
    'server error' => [['status_code' => 500], []],
    'exception' => [[], [['t' => 'exception', 'class' => 'E', 'message' => 'm', 'trace_id' => 'worth-opening']]],
]);

test('a slow query or a failed call is kept on its own inside a fast request', function () {
    $project = Project::factory()->create();

    sampledIngest($project, [
        ...traceOf('fast', []),
        ['t' => 'query', 'sql' => 'select * from big', 'duration' => 150_000, 'trace_id' => 'fast'],
        ['t' => 'outgoing-request', 'url' => 'https://down.example.com', 'status_code' => 503, 'duration' => 20_000, 'trace_id' => 'fast'],
    ]);

    expect($project->records()->where('type', 'query')->pluck('payload')->pluck('sql')->all())->toBe(['select * from big'])
        ->and(rawCount($project, 'outgoing-request'))->toBe(1)
        ->and(rolledUp($project, 'query'))->toBe(4);
});

test('a command keeps its detail only when it failed or ran long', function () {
    $project = Project::factory()->create();
    $command = fn (string $trace, array $extra) => [
        ['t' => 'command', 'command' => 'sync', 'exit_code' => 0, 'duration' => 300_000, 'trace_id' => $trace, ...$extra],
        ['t' => 'query', 'sql' => 'select 1', 'duration' => 500, 'trace_id' => $trace],
        ['t' => 'cache-event', 'type' => 'write', 'key' => 'k', 'trace_id' => $trace],
    ];

    sampledIngest($project, [...$command('ok', []), ...$command('failed', ['exit_code' => 1]), ...$command('long', ['duration' => 12_000_000])]);

    expect($project->records()->where('type', 'query')->pluck('trace_id')->sort()->values()->all())->toBe(['failed', 'long'])
        ->and(rawCount($project, 'command'))->toBe(3);
});

test('a query that breaks its threshold is kept and raises the issue', function () {
    $project = Project::factory()->create();
    Threshold::create(['project_id' => $project->id, 'type' => 'query', 'key' => 'select * from orders', 'value' => 20, 'is_enabled' => true]);

    // 30ms: under the 100ms slow-query cut, over this query's own threshold.
    sampledIngest($project, [
        ...traceOf('fast', [], queries: 1),
        ['t' => 'query', 'sql' => 'select * from orders', 'duration' => 30_000, 'trace_id' => 'fast'],
    ]);

    expect($project->records()->where('type', 'query')->pluck('payload')->pluck('sql')->all())->toBe(['select * from orders'])
        ->and($project->issues()->where('title', 'like', 'Slow Query%')->count())->toBe(1);
});

test('a heavy trace is kept even without its request in the batch', function () {
    $project = Project::factory()->create();
    $queries = array_fill(0, 300, ['t' => 'query', 'sql' => 'select * from skills where id = ?', 'duration' => 400, 'trace_id' => 'n-plus-one']);

    sampledIngest($project, $queries);

    // Capped per trace and batch; the rollups still count all of them.
    expect(rawCount($project, 'query'))->toBe(250)
        ->and(rolledUp($project, 'query'))->toBe(300);
});

test('the sample keeps or drops a whole trace, the same way every time', function () {
    config(['laraowl.raw_detail.sample_rate' => 0.5]);
    $project = Project::factory()->create();

    $in = collect(range(1, 50))->map(fn ($n) => "trace-{$n}")->first(fn ($id) => crc32($id) / 0xFFFFFFFF < 0.5);
    $out = collect(range(1, 50))->map(fn ($n) => "trace-{$n}")->first(fn ($id) => crc32($id) / 0xFFFFFFFF >= 0.5);

    sampledIngest($project, [...traceOf($in, []), ...traceOf($out, [])]);
    sampledIngest($project, traceOf($in, []));

    expect($project->records()->where('type', 'query')->distinct()->pluck('trace_id')->all())->toBe([$in])
        ->and(rawCount($project, 'query'))->toBe(6);
});

test('a sample rate of one keeps every raw row', function () {
    config(['laraowl.raw_detail.sample_rate' => 1.0]);
    $project = Project::factory()->create();

    sampledIngest($project, traceOf('fast', []));

    expect(rawCount($project, 'query'))->toBe(3)
        ->and($project->records()->where('type', 'request')->first()->payload)->not->toHaveKey('_detail_dropped');
});
