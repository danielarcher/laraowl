<?php

use App\Models\Project;
use App\Models\RecordRollup;
use App\Services\IngestService;
use Illuminate\Support\Carbon;

test('records keep the minute they arrived in, however late they are processed', function () {
    $project = Project::factory()->create();
    $this->travelTo('2026-10-03 17:30:00');

    app(IngestService::class)->ingest($project, [
        ['t' => 'request', 'method' => 'GET', 'url' => 'https://app.test/a', 'status_code' => 200, 'duration' => 1_000],
        ['t' => 'request', 'method' => 'GET', 'url' => 'https://app.test/b', 'status_code' => 200, 'duration' => 1_000],
        ['t' => 'request', 'method' => 'GET', 'url' => 'https://app.test/c', 'status_code' => 200, 'duration' => 1_000],
    ], [
        0 => Carbon::parse('2026-10-03 17:21:10'),
        1 => Carbon::parse('2026-10-03 17:22:40'),
    ]);

    expect($project->records()->orderBy('id')->pluck('created_at')->map->format('H:i:s')->all())
        ->toBe(['17:21:10', '17:22:40', '17:30:00']);

    expect(RecordRollup::query()->where('project_id', $project->id)->where('type', 'request')
        ->orderBy('bucket')->get()->map(fn ($row) => Carbon::parse($row->bucket)->format('H:i').'='.$row->count)->all())
        ->toBe(['17:21=1', '17:22=1', '17:30=1']);
});
