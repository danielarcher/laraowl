<?php

namespace App\Http\Controllers\Servers;

use App\Http\Controllers\Controller;
use App\Models\Record;
use App\Models\Server;
use App\Models\Team;
use App\Services\ServerMetricService;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ServerController extends Controller
{
    public function __construct(private ServerMetricService $metrics)
    {
        //
    }

    /**
     * Every server of the team with its current load.
     */
    public function index(Team $current_team): Response
    {
        return Inertia::render('servers/index', [
            'servers' => $this->metrics->overview($current_team),
            'agentUrl' => url('/agent.sh'),
            'offlineAfterSeconds' => (int) config('laraowl.servers.offline_after_seconds'),
        ]);
    }

    /**
     * One server's current load and history for the selected period.
     */
    public function show(Request $request, Team $current_team, Server $server): Response
    {
        [$from, $to] = $this->window($request);

        return Inertia::render('servers/show', [
            ...$this->metrics->detail($server, $from, $to),
            'period' => $request->query('period', '1h'),
        ]);
    }

    /**
     * The chart window: a preset period, or a valid custom from/to range.
     *
     * @return array{CarbonInterface, CarbonInterface}
     */
    private function window(Request $request): array
    {
        $period = $request->query('period', '1h');

        if ($period === 'custom' && $request->filled(['from', 'to'])) {
            try {
                $from = Carbon::parse((string) $request->query('from'));
                $to = Carbon::parse((string) $request->query('to'));

                if ($from->lt($to)) {
                    return [$from, $to];
                }
            } catch (Throwable) {
                // An unparseable range falls back to the default period.
            }
        }

        return [Record::periodStartsAt(is_string($period) ? $period : null), now()];
    }
}
