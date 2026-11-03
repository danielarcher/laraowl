<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\PushSubscription;
use App\Services\Push\WebPushService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class NotificationController extends Controller
{
    /**
     * Push notifications: this device, the user's other devices, and which apps alert them.
     */
    public function edit(Request $request, WebPushService $push): Response
    {
        $user = $request->user();

        $projects = Project::query()
            ->whereIn('team_id', $user->teams()->select('teams.id'))
            ->with('team:id,name,slug')
            ->withCount(['alertRules as rules_count' => fn ($q) => $q->where('is_enabled', true)])
            ->with(['integrations' => fn ($q) => $q->where('type', 'push')])
            ->orderBy('name')
            ->get();

        return Inertia::render('settings/notifications', [
            'vapidPublicKey' => $push->configured() ? config('webpush.public_key') : null,
            'devices' => $user->pushSubscriptions()
                ->latest()
                ->get()
                ->map(fn (PushSubscription $s) => [
                    'id' => $s->id,
                    'device' => $s->device,
                    'endpoint_hash' => $s->endpoint_hash,
                    'last_used_at' => $s->last_used_at?->toIso8601String(),
                    'created_at' => $s->created_at->toIso8601String(),
                ]),
            'apps' => $projects->map(fn (Project $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'team' => $p->team->name,
                'settings_url' => route('project.settings', ['current_team' => $p->team->slug, 'project' => $p->slug]),
                'rules_count' => $p->rules_count,
                'push_enabled' => (bool) $p->integrations->first()?->is_enabled,
            ]),
        ]);
    }

    /**
     * Remember the subscription the browser just handed out.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'endpoint' => ['required', 'url:https', 'max:2000'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'content_encoding' => ['nullable', 'in:aes128gcm,aesgcm'],
            'device' => ['required', 'string', 'max:100'],
        ]);

        PushSubscription::updateOrCreate(
            ['endpoint_hash' => PushSubscription::hashEndpoint($validated['endpoint'])],
            [
                'user_id' => $request->user()->id,
                'endpoint' => $validated['endpoint'],
                'public_key' => $validated['keys']['p256dh'],
                'auth_token' => $validated['keys']['auth'],
                'content_encoding' => $validated['content_encoding'] ?? 'aes128gcm',
                'device' => $validated['device'],
            ],
        );

        return back()->with('success', 'Push is on for this device.');
    }

    public function destroy(Request $request, PushSubscription $subscription): RedirectResponse
    {
        abort_unless($subscription->user_id === $request->user()->id, 404);

        $subscription->delete();

        return back()->with('success', 'Device removed.');
    }

    /**
     * Send a sample alert to every device of the signed-in user.
     */
    public function test(Request $request, WebPushService $push): RedirectResponse
    {
        try {
            $count = $push->sendToUser(
                $request->user(),
                'Test alert',
                'Push works. Alerts from your apps will land here.',
                ['Project' => 'LaraOwl'],
                route('notifications.edit'),
            );
        } catch (RuntimeException $e) {
            return back()->withErrors(['push' => $e->getMessage()]);
        }

        return back()->with('success', $count === 1 ? 'Test sent to 1 device.' : "Test sent to {$count} devices.");
    }

    /**
     * Route an app's alert rules to the team's devices, or stop doing so.
     */
    public function updateApp(Request $request, Project $project): RedirectResponse
    {
        abort_unless($request->user()->belongsToTeam($project->team), 404);

        $enabled = $request->validate(['enabled' => ['required', 'boolean']])['enabled'];

        $integration = $project->integrations()->firstOrCreate(
            ['type' => 'push'],
            ['name' => 'LaraOwl app', 'data' => [], 'is_enabled' => $enabled],
        );

        $integration->update(['is_enabled' => $enabled]);

        if ($enabled) {
            foreach ($project->alertRules()->get() as $rule) {
                $rule->integrations()->syncWithoutDetaching([$integration->id]);
            }
        }

        return back()->with('success', $enabled
            ? "{$project->name} now pushes its alerts."
            : "{$project->name} no longer pushes alerts.");
    }
}
