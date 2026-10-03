<?php

namespace App\Http\Middleware;

use App\Models\Project;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyLaraowlToken
{
    /**
     * Resolves the project behind the request's token. The lookup is
     * cached, so accepting a batch doesn't touch the database.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-Laraowl-Token') ?? $request->bearerToken();

        if (! $token) {
            abort(401, 'API Token is missing.');
        }

        $projectId = Project::idForToken($token);

        if (! $projectId) {
            abort(401, 'Invalid API Token.');
        }

        $request->attributes->set('project_id', $projectId);

        return $next($request);
    }
}
