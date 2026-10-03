<?php

use App\Http\Controllers\Api\IngestController;
use App\Http\Controllers\Api\ServerMetricController;
use Illuminate\Support\Facades\Route;

Route::post('/ingest', IngestController::class)
    ->middleware('laraowl.token');

Route::post('/records', IngestController::class)
    ->middleware('laraowl.token');

Route::post('/servers/metrics', ServerMetricController::class)
    ->middleware('laraowl.server-token');
