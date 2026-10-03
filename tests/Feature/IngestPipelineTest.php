<?php

use App\Jobs\DrainIngestBuffer;
use App\Models\Project;
use App\Models\RecordRollup;
use App\Services\IngestBuffer;
use App\Services\IngestQueue;
use App\Services\IngestService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

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

function ingestPost(Project $project, array $body, ?string $token = null)
{
    return test()->withToken($token ?? $project->api_token)->postJson('/api/records', $body);
}

function requestRecord(string $path, array $extra = []): array
{
    return ['t' => 'request', 'method' => 'GET', 'url' => "https://app.test{$path}", 'status_code' => 200, 'duration' => 1_000, ...$extra];
}

test('the endpoint accepts a batch with 202 and the drain stores it, stamped with its arrival', function () {
    $project = Project::factory()->create(['url' => null]);
    $this->travelTo('2026-10-03 17:40:05');

    ingestPost($project, ['app_url' => 'https://app.test', 'records' => [requestRecord('/a'), requestRecord('/b')]])
        ->assertStatus(202);

    expect($project->records()->count())->toBe(2)
        ->and($project->records()->first()->created_at->format('H:i:s'))->toBe('17:40:05')
        ->and($project->fresh()->url)->toBe('https://app.test')
        ->and(app(IngestBuffer::class)->size())->toBe(0);
});

test('a bare record or a bare list is accepted as before', function (array $body, int $stored) {
    $project = Project::factory()->create();

    ingestPost($project, $body)->assertStatus(202);

    expect($project->records()->count())->toBe($stored);
})->with([
    'one record' => [requestRecord('/one'), 1],
    'a list' => [[requestRecord('/a'), requestRecord('/b'), requestRecord('/c')], 3],
]);

test('a request without a valid token is turned away, and nothing is buffered', function (?string $token) {
    $project = Project::factory()->create();

    $request = $token === null
        ? $this->postJson('/api/records', ['records' => [requestRecord('/a')]])
        : ingestPost($project, ['records' => [requestRecord('/a')]], $token);

    $request->assertStatus(401);

    expect(app(IngestBuffer::class)->size())->toBe(0);
})->with(['missing' => [null], 'unknown' => ['not-a-token']]);

test('a body that is not a JSON object or list is rejected', function () {
    $project = Project::factory()->create();

    $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => "Bearer {$project->api_token}"];

    $this->call('POST', '/api/records', server: $server, content: '"just a string"')->assertStatus(422);
    $this->call('POST', '/api/records', server: $server, content: '{"records": [')->assertStatus(422);

    expect(app(IngestBuffer::class)->size())->toBe(0);
});

test('the token lookup is cached, and a new token takes over at once', function () {
    $project = Project::factory()->create();
    ingestPost($project, ['records' => [requestRecord('/warm')]])->assertStatus(202);

    DB::enableQueryLog();
    Queue::fake();
    ingestPost($project, ['records' => [requestRecord('/cached')]])->assertStatus(202);
    $projectQueries = collect(DB::getQueryLog())->filter(fn ($query) => str_contains($query['query'], '"projects"'));
    DB::disableQueryLog();

    expect($projectQueries)->toBeEmpty();

    $old = $project->api_token;
    $project->update(['api_token' => 'rotated-token-0123456789abcdef']);

    ingestPost($project, ['records' => [requestRecord('/old')]], $old)->assertStatus(401);
    ingestPost($project, ['records' => [requestRecord('/new')]], 'rotated-token-0123456789abcdef')->assertStatus(202);
});

test('a full buffer answers 503 with Retry-After and keeps what it has', function () {
    Queue::fake();
    config(['laraowl.ingest.max_waiting' => 2]);
    $project = Project::factory()->create();

    ingestPost($project, ['records' => [requestRecord('/1')]])->assertStatus(202);
    ingestPost($project, ['records' => [requestRecord('/2')]])->assertStatus(202);
    ingestPost($project, ['records' => [requestRecord('/3')]])
        ->assertStatus(503)
        ->assertHeader('Retry-After', '30');

    expect(app(IngestBuffer::class)->size())->toBe(2);

    // One drain job for the burst, not one per batch.
    Queue::assertPushed(DrainIngestBuffer::class, 1);
});

test('a drain merges each project\'s batches into one ingest', function () {
    Queue::fake();
    $first = Project::factory()->create();
    $second = Project::factory()->create();
    $queue = app(IngestQueue::class);

    foreach (range(1, 5) as $n) {
        $queue->accept($first->id, json_encode(['records' => [requestRecord("/first/{$n}")]]));
        $queue->accept($second->id, json_encode(['records' => [requestRecord("/second/{$n}")]]));
    }

    $calls = [];
    $this->mock(IngestService::class, function ($mock) use (&$calls) {
        $mock->shouldReceive('ingest')->andReturnUsing(function (Project $project, array $records) use (&$calls) {
            $calls[] = [$project->id, count($records)];
        });
    });

    expect(app(IngestQueue::class)->drain())->toBe(10)
        ->and($calls)->toBe([[$first->id, 5], [$second->id, 5]])
        ->and(app(IngestBuffer::class)->size())->toBe(0);
});

test('a batch that fails on its own is set aside and the rest are stored', function () {
    Queue::fake();
    $project = Project::factory()->create();
    $queue = app(IngestQueue::class);
    $queue->accept($project->id, json_encode(['records' => [requestRecord('/ok-1')]]));
    $queue->accept($project->id, json_encode(['records' => [requestRecord('/poison')]]));
    $queue->accept($project->id, json_encode(['records' => [requestRecord('/ok-2')]]));
    $queue->accept($project->id, 'not json at all');

    $stored = [];
    $this->mock(IngestService::class, function ($mock) use (&$stored) {
        $mock->shouldReceive('ingest')->andReturnUsing(function (Project $project, array $records) use (&$stored) {
            if (collect($records)->contains(fn ($record) => str_ends_with($record['url'], '/poison'))) {
                throw new RuntimeException('Cannot store this batch');
            }

            array_push($stored, ...array_column($records, 'url'));
        });
    });

    app(IngestQueue::class)->drain();

    expect($stored)->toBe(['https://app.test/ok-1', 'https://app.test/ok-2'])
        ->and(app(IngestBuffer::class)->failedCount())->toBe(2)
        ->and(app(IngestBuffer::class)->size())->toBe(0);
});

test('when the database is unreachable the batches go back in line, in order, and a retry is queued', function (string $error) {
    Queue::fake();
    $project = Project::factory()->create();
    $queue = app(IngestQueue::class);
    $queue->accept($project->id, json_encode(['records' => [requestRecord('/a')]]));
    $queue->accept($project->id, json_encode(['records' => [requestRecord('/b')]]));
    $before = [app(IngestBuffer::class)->peek()];
    Cache::forget('laraowl:ingest:drain-queued');
    Queue::fake();

    $this->mock(IngestService::class, function ($mock) use ($error) {
        $mock->shouldReceive('ingest')->andThrow(new PDOException($error));
    });

    app(IngestQueue::class)->drain();

    expect(app(IngestBuffer::class)->size())->toBe(2)
        ->and(app(IngestBuffer::class)->peek())->toBe($before[0])
        ->and(app(IngestBuffer::class)->failedCount())->toBe(0);

    Queue::assertPushed(DrainIngestBuffer::class, fn ($job) => $job->delay === 15);
})->with([
    'refused' => ['SQLSTATE[08006] [7] connection to server at "127.0.0.1", port 5432 failed: Connection refused'],
    'restarting' => ['SQLSTATE[57P03]: Cannot connect now: 7 FATAL:  the database system is starting up'],
    'shut down mid-transaction' => ['SQLSTATE[57P01]: Admin shutdown: 7 FATAL:  terminating connection due to administrator command'],
]);

test('batches of a deleted project are dropped quietly', function () {
    Queue::fake();
    $project = Project::factory()->create();
    app(IngestQueue::class)->accept($project->id, json_encode(['records' => [requestRecord('/a')]]));
    $project->delete();

    expect(app(IngestQueue::class)->drain())->toBe(1)
        ->and(app(IngestBuffer::class)->failedCount())->toBe(0);
});

test('a drain stops at its time budget and queues the next one', function () {
    Queue::fake();
    config(['laraowl.ingest.drain_batch' => 1]);
    $project = Project::factory()->create();
    $queue = app(IngestQueue::class);

    foreach (range(1, 3) as $n) {
        $queue->accept($project->id, json_encode(['records' => [requestRecord("/{$n}")]]));
    }
    Cache::forget('laraowl:ingest:drain-queued');

    expect($queue->drain(0.0))->toBe(0)
        ->and(app(IngestBuffer::class)->size())->toBe(3);

    Queue::assertPushed(DrainIngestBuffer::class, 2);
});

test('the scheduler picks up a buffer whose drain job was lost', function () {
    Queue::fake();
    $project = Project::factory()->create();
    app(IngestBuffer::class)->push(json_encode(['project' => $project->id, 'received_at' => now()->getTimestamp()])."\n".json_encode([requestRecord('/a')]));

    app(IngestQueue::class)->queueDrainIfWaiting();

    Queue::assertPushed(DrainIngestBuffer::class, 1);
});

test('replay puts set-aside batches back in line and status reports the buffer', function () {
    Queue::fake();
    $this->travelTo('2026-10-03 18:00:00');
    $project = Project::factory()->create();
    $buffer = app(IngestBuffer::class);
    $buffer->fail(json_encode(['project' => $project->id, 'received_at' => now()->getTimestamp() - 30])."\n".json_encode([requestRecord('/a')]));

    $this->artisan('laraowl:ingest:replay')
        ->expectsOutputToContain('1 batch(es) put back in line; 0 still set aside.')
        ->assertSuccessful();

    expect($buffer->size())->toBe(1)->and($buffer->failedCount())->toBe(0);

    $this->artisan('laraowl:ingest:status')
        ->expectsTable(['Waiting', 'Oldest', 'Set aside'], [[1, '30.0s', 0]])
        ->assertSuccessful();
});
