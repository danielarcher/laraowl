<?php

use App\Services\IngestQueue;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

use Illuminate\Support\Facades\Schedule;

Schedule::command('projects:check-health')
    ->everyThirtySeconds()
    ->withoutOverlapping(5)
    ->runInBackground();
Schedule::command('model:prune')->daily();
Schedule::command('laraowl:update --check')->daily();
Schedule::command('laraowl:projects:link-servers')->everyTenMinutes()->withoutOverlapping(10);
Schedule::command('laraowl:security:resolve-quiet')->hourly();

// Picks the ingest buffer back up if a drain job was lost (a worker killed
// mid-job); normally every accepted batch queues one.
Schedule::call(fn (IngestQueue $queue) => $queue->queueDrainIfWaiting())
    ->everyMinute()
    ->name('laraowl:ingest:drain');
