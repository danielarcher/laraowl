<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Repository
    |--------------------------------------------------------------------------
    |
    | The GitHub repository new releases are checked against. Forks that cut
    | their own releases should point this at their own repository.
    |
    */

    'repository' => env('LARAOWL_REPOSITORY', 'laraowl/laraowl'),

    /*
    |--------------------------------------------------------------------------
    | Update Checks
    |--------------------------------------------------------------------------
    |
    | LaraOwl periodically asks the GitHub releases API whether a newer version
    | has been published, and shows a banner to team owners when there is one.
    | Disable this to stop the instance from making outbound requests.
    |
    */

    'update_check' => [
        'enabled' => env('LARAOWL_UPDATE_CHECK', true),
        'cache_ttl' => (int) env('LARAOWL_UPDATE_CHECK_TTL', 21600),
        'timeout' => (int) env('LARAOWL_UPDATE_CHECK_TIMEOUT', 10),
    ],

    /*
    |--------------------------------------------------------------------------
    | Update Binaries
    |--------------------------------------------------------------------------
    |
    | Executables the `laraowl:update` command shells out to. Override these
    | when they are not resolvable on the PATH of the user running the update,
    | for example "/usr/local/bin/composer".
    |
    */

    'binaries' => [
        'git' => env('LARAOWL_GIT_BINARY', 'git'),
        'composer' => env('LARAOWL_COMPOSER_BINARY', 'composer'),
        'npm' => env('LARAOWL_NPM_BINARY', 'npm'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Servers
    |--------------------------------------------------------------------------
    |
    | Machines report CPU, memory, disk and load through the agent script
    | (`/agent.sh`), normally once a minute from cron. Samples older than the
    | retention window are pruned daily, and a server that hasn't reported
    | within the offline threshold is shown as offline.
    |
    */

    'servers' => [
        'retention_days' => (int) env('LARAOWL_SERVER_RETENTION_DAYS', 30),
        'offline_after_seconds' => (int) env('LARAOWL_SERVER_OFFLINE_AFTER', 180),
    ],

    /*
    |--------------------------------------------------------------------------
    | Raw Detail
    |--------------------------------------------------------------------------
    |
    | Every record is counted in the rollups behind the charts and lists. The
    | raw rows of queries, cache events and outgoing calls are kept only for
    | requests and commands worth opening (slower than their threshold,
    | failed, or with an exception), for this share of the rest as examples,
    | and on their own when the query or call itself was slow. A sample rate
    | of 1 keeps every raw row.
    |
    */

    'raw_detail' => [
        'sample_rate' => (float) env('LARAOWL_DETAIL_SAMPLE_RATE', 0.05),
        'slow_request_ms' => (int) env('LARAOWL_DETAIL_SLOW_REQUEST_MS', 500),
        'slow_task_ms' => (int) env('LARAOWL_DETAIL_SLOW_TASK_MS', 10000),
        'slow_query_ms' => (int) env('LARAOWL_DETAIL_SLOW_QUERY_MS', 100),
        'slow_outgoing_ms' => (int) env('LARAOWL_DETAIL_SLOW_OUTGOING_MS', 1000),
    ],

    /*
    |--------------------------------------------------------------------------
    | Ingest
    |--------------------------------------------------------------------------
    |
    | The ingest endpoint buffers each batch as sent and answers 202 straight
    | away; a queued drain job processes the buffer, merging the batches of a
    | project. "redis" keeps the buffer across processes (production), "array"
    | only for the current process (tests). When the buffer holds max_waiting
    | batches the endpoint answers 503 until it drains. Batches that fail to
    | process are set aside, up to max_failed, for `laraowl:ingest:replay`.
    |
    */

    'ingest' => [
        'buffer' => env('LARAOWL_INGEST_BUFFER', 'redis'),
        'redis_connection' => env('LARAOWL_INGEST_REDIS_CONNECTION', 'default'),
        'max_waiting' => (int) env('LARAOWL_INGEST_MAX_WAITING', 20000),
        'max_failed' => (int) env('LARAOWL_INGEST_MAX_FAILED', 1000),
        'drain_batch' => (int) env('LARAOWL_INGEST_DRAIN_BATCH', 100),
        'drain_seconds' => (int) env('LARAOWL_INGEST_DRAIN_SECONDS', 20),
    ],

];
