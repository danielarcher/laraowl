<?php

use App\Models\Project;
use App\Services\IngestService;
use App\Services\RecordService;

function chartIngest(Project $project, array $records): void
{
    app(IngestService::class)->ingest($project, $records);
}

function chartStats(Project $project, string $period): array
{
    return app(RecordService::class)->getDashboardStats($project, $period);
}

test('each period draws about 150 points or fewer, oldest first, ending now', function (string $period, int $points, int $slot) {
    $project = Project::factory()->create();

    chartIngest($project, [['t' => 'request', 'status_code' => 200, 'duration' => 10_000]]);

    $series = chartStats($project, $period)['timeSeries'];

    expect($series)->toHaveCount($points)
        ->and($series[1]['t'] - $series[0]['t'])->toBe($slot)
        ->and(intdiv(now()->getTimestamp(), $slot) * $slot)->toBe(end($series)['t'])
        ->and(end($series)['total'])->toBe(1)
        ->and(collect($series)->sum('total'))->toBe(1);
})->with([
    '1h' => ['1h', 60, 60],
    '24h' => ['24h', 144, 600],
    '7d' => ['7d', 168, 3600],
    '14d' => ['14d', 168, 7200],
    '30d' => ['30d', 180, 14400],
]);

test('points within a day are labelled by clock time, longer ones by date', function () {
    $project = Project::factory()->create();

    expect(chartStats($project, '24h')['timeSeries'][0]['minute'])->toMatch('/^\d{2}:\d{2}$/')
        ->and(chartStats($project, '7d')['timeSeries'][0]['minute'])->toMatch('/^\d{2}\/\d{2} \d{2}:\d{2}$/');
});

test('a custom range spreads about 150 points across the range', function () {
    $project = Project::factory()->create();

    $series = app(RecordService::class)->getDashboardStats(
        $project, 'custom', now()->subDays(2)->toDateTimeString(), now()->toDateTimeString(),
    )['timeSeries'];

    expect(count($series))->toBeGreaterThan(140)->toBeLessThan(160)
        ->and($series[1]['t'] - $series[0]['t'])->toBe(1140); // 48h / 150, in whole minutes
});

test('latency quantiles are interpolated inside the histogram bucket', function () {
    $project = Project::factory()->create();

    // Durations are microseconds: 95 requests at 10ms, 5 stragglers at 5s.
    $batch = array_merge(
        array_fill(0, 95, ['t' => 'request', 'status_code' => 200, 'duration' => 10_000]),
        array_fill(0, 5, ['t' => 'request', 'status_code' => 200, 'duration' => 5_000_000]),
    );
    chartIngest($project, $batch);

    $stats = chartStats($project, '1h');
    $latency = $stats['duration_stats'];

    // p95 lands on the last of the 10ms samples; p99 sits 4/5 of the way
    // through the 2.5s–5s bucket, below the 5s maximum.
    expect($latency['p95'])->toBe(10_000.0)
        ->and($latency['p99'])->toBe(4_500_000.0)
        ->and($latency['max'])->toBe(5_000_000.0)
        ->and($latency['p50'])->toBeLessThanOrEqual(10_000.0);

    $point = collect($stats['timeSeries'])->firstWhere('total', 100);

    expect($point['p95_duration'])->toBe(10_000.0)
        ->and($point['max_duration'])->toBe(5_000_000.0);
});

test('the latency histogram counts every timed request once', function () {
    $project = Project::factory()->create();

    chartIngest($project, [
        ['t' => 'request', 'status_code' => 200, 'duration' => 800],
        ['t' => 'request', 'status_code' => 200, 'duration' => 40_000],
        ['t' => 'request', 'status_code' => 500, 'duration' => 40_000],
        ['t' => 'request', 'status_code' => 200, 'duration' => 20_000_000],
    ]);

    $histogram = collect(chartStats($project, '1h')['latency_histogram']);

    expect($histogram)->toHaveCount(13)
        ->and($histogram->sum('count'))->toBe(4)
        ->and($histogram->firstWhere('le', 1000)['count'])->toBe(1)
        ->and($histogram->firstWhere('le', 50000)['count'])->toBe(2)
        ->and($histogram->last())->toBe(['le' => null, 'count' => 1]);
});

test('the dashboard compares the period with the window before it', function () {
    $project = Project::factory()->create();

    $this->travel(-90)->minutes();
    chartIngest($project, [
        ['t' => 'request', 'status_code' => 200, 'duration' => 10_000],
        ['t' => 'request', 'status_code' => 500, 'duration' => 10_000],
        ['t' => 'exception', 'class' => 'E', 'message' => 'm'],
    ]);
    $this->travelBack();

    // Older than both windows, so neither counts it.
    $this->travel(-3)->hours();
    chartIngest($project, [['t' => 'request', 'status_code' => 200]]);
    $this->travelBack();

    chartIngest($project, [['t' => 'request', 'status_code' => 200, 'duration' => 10_000]]);

    $stats = chartStats($project, '1h');

    expect($stats['total_requests'])->toBe(1)
        ->and($stats['previous']['requests'])->toBe(2)
        ->and($stats['previous']['server_error'])->toBe(1)
        ->and($stats['previous']['exceptions'])->toBe(1);
});
