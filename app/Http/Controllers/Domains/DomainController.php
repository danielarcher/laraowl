<?php

namespace App\Http\Controllers\Domains;

use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Services\Domains\DomainScanner;
use App\Services\Domains\DomainService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DomainController extends Controller
{
    /**
     * Every domain the team's apps live on.
     */
    public function index(Team $current_team, DomainService $domains): Response
    {
        return Inertia::render('domains/index', $domains->overview($current_team));
    }

    /**
     * Scan again now (DNS, certificates and mail; registration once a day).
     */
    public function scan(Team $current_team, DomainScanner $scanner): RedirectResponse
    {
        $count = $scanner->scanTeam($current_team)->count();

        return back()->with('success', $count === 1 ? 'Scanned 1 domain.' : "Scanned {$count} domains.");
    }
}
