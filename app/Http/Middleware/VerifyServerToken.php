<?php

namespace App\Http\Middleware;

use App\Models\Server;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyServerToken
{
    /**
     * Resolve the reporting server from its agent token.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-Laraowl-Token') ?? $request->bearerToken();

        if (! $token) {
            abort(401, 'API Token is missing.');
        }

        $server = Server::where('api_token', $token)->first();

        if (! $server) {
            abort(401, 'Invalid API Token.');
        }

        $request->attributes->set('server', $server);

        return $next($request);
    }
}
