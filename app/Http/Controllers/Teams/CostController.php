<?php

namespace App\Http\Controllers\Teams;

use App\Enums\CostCategory;
use App\Enums\CostInterval;
use App\Http\Controllers\Controller;
use App\Http\Requests\Teams\SaveCostRequest;
use App\Models\Cost;
use App\Models\Team;
use App\Services\CostService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class CostController extends Controller
{
    public function __construct(private CostService $costs)
    {
        //
    }

    /**
     * Everything the team pays for, with the monthly run-rate.
     */
    public function index(Team $team): Response
    {
        return Inertia::render('teams/costs', [
            'team' => ['id' => $team->id, 'name' => $team->name, 'slug' => $team->slug],
            'costs' => $team->costs()
                ->with('server:id,name')
                ->orderBy('name')
                ->get()
                ->sortBy(fn (Cost $cost) => array_search($cost->category, CostCategory::cases(), true))
                ->values()
                ->map(fn (Cost $cost) => [
                    'id' => $cost->id,
                    'name' => $cost->name,
                    'category' => $cost->category->value,
                    'server_id' => $cost->server_id,
                    'server_name' => $cost->server?->name,
                    'amount_cents' => $cost->amount_cents,
                    'currency' => $cost->currency,
                    'interval' => $cost->interval->value,
                    'monthly_cents' => (int) round($this->costs->monthlyCents($cost)),
                ]),
            'summary' => $this->costs->summary($team),
            'servers' => $team->servers()->orderBy('name')->get(['id', 'name']),
            'categories' => collect(CostCategory::cases())
                ->map(fn (CostCategory $category) => ['value' => $category->value, 'label' => $category->label()]),
            'intervals' => collect(CostInterval::cases())->pluck('value'),
            'currencies' => $this->costs->currencies(),
        ]);
    }

    public function store(SaveCostRequest $request, Team $team): RedirectResponse
    {
        $team->costs()->create($request->costAttributes());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Cost added.')]);

        return to_route('teams.costs.index', ['team' => $team->slug]);
    }

    public function update(SaveCostRequest $request, Team $team, Cost $cost): RedirectResponse
    {
        $cost->update($request->costAttributes());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Cost updated.')]);

        return to_route('teams.costs.index', ['team' => $team->slug]);
    }

    public function destroy(Team $team, Cost $cost): RedirectResponse
    {
        $cost->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Cost removed.')]);

        return to_route('teams.costs.index', ['team' => $team->slug]);
    }
}
