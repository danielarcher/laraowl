<?php

use App\Services\RedisIngestBuffer;
use Illuminate\Support\Facades\Redis;

/*
 * Runs against a real Redis when one is reachable (REDIS_HOST/REDIS_PORT),
 * since production keeps the ingest buffer there; skipped otherwise.
 */
beforeEach(function () {
    if (! extension_loaded('redis')) {
        $this->markTestSkipped('The phpredis extension is not loaded.');
    }

    config(['database.redis.options.prefix' => 'laraowl-test:']);

    try {
        $this->redis = Redis::connection('default');
        $this->redis->ping();
    } catch (Throwable) {
        $this->markTestSkipped('No Redis server reachable.');
    }

    $this->redis->del('laraowl:ingest:waiting', 'laraowl:ingest:failed');
    $this->buffer = new RedisIngestBuffer($this->redis, maxFailed: 3);
});

afterEach(function () {
    if (isset($this->buffer)) {
        $this->redis->del('laraowl:ingest:waiting', 'laraowl:ingest:failed');
    }
});

test('batches come out oldest first, a slice at a time', function () {
    foreach (['a', 'b', 'c', 'd', 'e'] as $batch) {
        $this->buffer->push($batch);
    }

    expect($this->buffer->size())->toBe(5)
        ->and($this->buffer->peek())->toBe('a')
        ->and($this->buffer->pop(2))->toBe(['a', 'b'])
        ->and($this->buffer->pop(10))->toBe(['c', 'd', 'e'])
        ->and($this->buffer->pop(10))->toBe([])
        ->and($this->buffer->peek())->toBeNull();
});

test('batches put back go to the front in their order', function () {
    $this->buffer->push('c');
    $this->buffer->unshift(['a', 'b']);

    expect($this->buffer->pop(3))->toBe(['a', 'b', 'c']);
});

test('set-aside batches are capped, keeping the newest', function () {
    foreach (['1', '2', '3', '4', '5'] as $batch) {
        $this->buffer->fail($batch);
    }

    expect($this->buffer->failedCount())->toBe(3)
        ->and($this->buffer->takeFailed(10))->toBe(['3', '4', '5']);
});

test('a batch keeps its bytes exactly, newlines and all', function () {
    $batch = "{\"project\":1}\n{\"records\":[{\"t\":\"log\",\"message\":\"line one\\nline two ✓\"}]}";
    $this->buffer->push($batch);

    expect($this->buffer->pop(1))->toBe([$batch]);
});
