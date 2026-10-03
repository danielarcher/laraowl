<?php

namespace App\Http\Controllers\Teams;

use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Services\OverviewService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OverviewController extends Controller
{
    public function __construct(private OverviewService $overview)
    {
        //
    }

    /**
     * Every app of the team at a glance: traffic, errors, latency and uptime,
     * grouped by the server each one runs on.
     */
    public function index(Request $request, Team $current_team): Response
    {
        $period = $request->query('period', '1h');
        $period = is_string($period) ? $period : '1h';
        $from = $request->query('from');
        $to = $request->query('to');

        return Inertia::render('overview/index', [
            ...$this->overview->forTeam(
                $current_team,
                $period,
                is_string($from) ? $from : null,
                is_string($to) ? $to : null,
            ),
            'period' => $period,
        ]);
    }
}
