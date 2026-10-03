<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\IngestQueue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IngestController extends Controller
{
    /**
     * Accepts a batch from a monitored project for processing in the
     * background. The body is checked for well-formed JSON and buffered as
     * sent, so the request stays cheap whatever the batch holds.
     */
    public function __invoke(Request $request, IngestQueue $queue): JsonResponse
    {
        $body = $request->isJson() ? $request->getContent() : json_encode($request->all());

        if (! is_string($body) || ! json_validate($body) || ! in_array(ltrim($body)[0] ?? '', ['{', '['], true)) {
            return response()->json(['message' => 'Invalid payload structure.'], 422);
        }

        if (! $queue->accept($request->attributes->get('project_id'), $body)) {
            return response()->json(
                ['message' => 'LaraOwl is catching up on a backlog; try again shortly.'],
                503,
                ['Retry-After' => '30'],
            );
        }

        return response()->json(['message' => 'Accepted.'], 202);
    }
}
