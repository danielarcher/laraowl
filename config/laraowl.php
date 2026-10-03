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

];
