<?php

use App\Models\Integration;
use App\Models\Project;
use App\Models\PushSubscription;
use App\Models\Team;
use App\Models\User;
use App\Services\AlertService;
use App\Services\Push\PushGateway;
use App\Services\Push\PushOutcome;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Fakes\FakePushGateway;

uses(RefreshDatabase::class);

beforeEach(function () {
    config([
        'webpush.public_key' => 'BI59XgxWF4mFcuDV34qBsQoE5pQtcWwaYCKg0dKZAiM6OTt00M2nFhd527Jt-ixGyTGeo9nZw0n3uEkQjpqkOoQ',
        'webpush.private_key' => '0hXTT47anxvG2PEbvHY9tRt1ovh0s92SMjATf_bo868',
    ]);

    $this->gateway = new FakePushGateway;
    $this->instance(PushGateway::class, $this->gateway);
});

/**
 * A user on a team with one app that has an uptime rule.
 *
 * @return array{0: User, 1: Project}
 */
function memberWithApp(string $appName = 'Shop'): array
{
    $user = User::factory()->create();
    $project = Project::factory()->create(['team_id' => $user->currentTeam->id, 'name' => $appName]);
    $project->alertRules()->create(['name' => 'Site down', 'event_type' => 'uptime_down', 'is_enabled' => true]);

    return [$user, $project];
}

function browserSubscription(string $endpoint = 'https://fcm.example.test/send/abc'): array
{
    return [
        'endpoint' => $endpoint,
        'keys' => [
            'p256dh' => 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
            'auth' => 'tBHItJI5svbpez7KI4CCXg',
        ],
        'content_encoding' => 'aes128gcm',
        'device' => 'Chrome on Android · app',
    ];
}

it('shows the notifications page with the apps and the push key', function () {
    [$user] = memberWithApp('Shop');

    $this->actingAs($user)
        ->get('/settings/notifications')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/notifications')
            ->where('vapidPublicKey', config('webpush.public_key'))
            ->has('devices', 0)
            ->has('apps', 1)
            ->where('apps.0.name', 'Shop')
            ->where('apps.0.rules_count', 1)
            ->where('apps.0.push_enabled', false));
});

it('hides the push key when the server has none', function () {
    config(['webpush.private_key' => null]);
    [$user] = memberWithApp();

    $this->actingAs($user)
        ->get('/settings/notifications')
        ->assertInertia(fn (Assert $page) => $page->where('vapidPublicKey', null));
});

it('turns push on for a device and lists it', function () {
    [$user] = memberWithApp();

    $this->actingAs($user)
        ->post('/settings/notifications/devices', browserSubscription())
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $this->actingAs($user)
        ->get('/settings/notifications')
        ->assertInertia(fn (Assert $page) => $page
            ->has('devices', 1)
            ->where('devices.0.device', 'Chrome on Android · app')
            ->where('devices.0.endpoint_hash', hash('sha256', 'https://fcm.example.test/send/abc'))
            ->missing('devices.0.endpoint')
            ->missing('devices.0.auth_token'));
});

it('keeps one row when the same browser subscribes again, even as another user', function () {
    [$first] = memberWithApp();
    $second = User::factory()->create();

    $this->actingAs($first)->post('/settings/notifications/devices', browserSubscription());
    $this->actingAs($second)->post('/settings/notifications/devices', browserSubscription());

    expect(PushSubscription::count())->toBe(1)
        ->and(PushSubscription::first()->user_id)->toBe($second->id);
});

it('refuses a subscription that is not https', function () {
    [$user] = memberWithApp();

    $this->actingAs($user)
        ->post('/settings/notifications/devices', browserSubscription('http://insecure.test/x'))
        ->assertSessionHasErrors('endpoint');

    expect(PushSubscription::count())->toBe(0);
});

it('removes your own device but not someone else\'s', function () {
    [$user] = memberWithApp();
    $mine = PushSubscription::factory()->for($user)->create();
    $theirs = PushSubscription::factory()->create();

    $this->actingAs($user)->delete("/settings/notifications/devices/{$theirs->id}")->assertNotFound();
    $this->actingAs($user)->delete("/settings/notifications/devices/{$mine->id}")->assertRedirect();

    expect(PushSubscription::pluck('id')->all())->toBe([$theirs->id]);
});

it('switches an app\'s alerts to push and back off', function () {
    [$user, $project] = memberWithApp('Shop');

    $this->actingAs($user)
        ->put("/settings/notifications/apps/{$project->id}", ['enabled' => true])
        ->assertRedirect();

    $integration = $project->integrations()->where('type', 'push')->sole();
    expect($integration->is_enabled)->toBeTrue()
        ->and($project->alertRules()->first()->integrations->pluck('id')->all())->toBe([$integration->id]);

    $this->actingAs($user)
        ->get('/settings/notifications')
        ->assertInertia(fn (Assert $page) => $page->where('apps.0.push_enabled', true));

    $this->actingAs($user)->put("/settings/notifications/apps/{$project->id}", ['enabled' => false]);

    $this->actingAs($user)
        ->get('/settings/notifications')
        ->assertInertia(fn (Assert $page) => $page->where('apps.0.push_enabled', false));

    expect($project->integrations()->where('type', 'push')->count())->toBe(1);
});

it('does not let you switch push on for another team\'s app', function () {
    [$user] = memberWithApp();
    $stranger = Project::factory()->create(['team_id' => Team::factory()->create()->id]);

    $this->actingAs($user)
        ->put("/settings/notifications/apps/{$stranger->id}", ['enabled' => true])
        ->assertNotFound();

    expect(Integration::count())->toBe(0);
});

it('pushes an uptime alert to every device of the team, and nobody else', function () {
    [$user, $project] = memberWithApp('Shop');
    $teammate = User::factory()->create();
    $project->team->members()->attach($teammate, ['role' => 'member']);
    $outsider = User::factory()->create();

    PushSubscription::factory()->for($user)->create(['endpoint' => 'https://push.test/phone', 'endpoint_hash' => hash('sha256', 'https://push.test/phone')]);
    PushSubscription::factory()->for($teammate)->create(['endpoint' => 'https://push.test/laptop', 'endpoint_hash' => hash('sha256', 'https://push.test/laptop')]);
    PushSubscription::factory()->for($outsider)->create(['endpoint' => 'https://push.test/outsider', 'endpoint_hash' => hash('sha256', 'https://push.test/outsider')]);

    $this->actingAs($user)->put("/settings/notifications/apps/{$project->id}", ['enabled' => true]);

    app(AlertService::class)->notifyUptimeDown($project->fresh(), 503);

    expect(collect($this->gateway->sent)->pluck('endpoint')->sort()->values()->all())
        ->toBe(['https://push.test/laptop', 'https://push.test/phone']);

    $payload = $this->gateway->sent[0]['payload'];
    expect($payload['title'])->toBe('Uptime Alert: Site is DOWN!')
        ->and($payload['body'])->toBe('Shop · The site returned a 503 status code.')
        ->and($payload['url'])->toBe($project->dashboardUrl())
        ->and($payload['tag'])->toBe($this->gateway->sent[0]['topic']);

    expect(PushSubscription::whereNotNull('last_used_at')->count())->toBe(2);
});

it('forgets devices the browser dropped and marks the integration failing when none is left', function () {
    [$user, $project] = memberWithApp();
    $device = PushSubscription::factory()->for($user)->create();
    $this->gateway->outcomes[$device->endpoint] = PushOutcome::Expired;

    $this->actingAs($user)->put("/settings/notifications/apps/{$project->id}", ['enabled' => true]);
    app(AlertService::class)->notifyUptimeDown($project->fresh(), 500);

    $integration = $project->integrations()->where('type', 'push')->sole();
    expect(PushSubscription::count())->toBe(0)
        ->and($integration->status)->toBe('failing')
        ->and($integration->last_error)->toContain('removed');
});

it('sends a test alert to your devices', function () {
    [$user] = memberWithApp();
    PushSubscription::factory()->for($user)->count(2)->create();

    $this->actingAs($user)
        ->post('/settings/notifications/test')
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($this->gateway->sent)->toHaveCount(2)
        ->and($this->gateway->sent[0]['payload']['title'])->toBe('Test alert');
});

it('explains why a test cannot go out', function (?string $privateKey, bool $hasDevice, string $error) {
    config(['webpush.private_key' => $privateKey]);
    [$user] = memberWithApp();

    if ($hasDevice) {
        PushSubscription::factory()->for($user)->create();
    }

    $this->actingAs($user)
        ->post('/settings/notifications/test')
        ->assertSessionHasErrors(['push' => $error]);
})->with([
    'no VAPID keys' => [null, true, 'Push is not set up on this LaraOwl: VAPID keys are missing.'],
    'no devices' => ['0hXTT47anxvG2PEbvHY9tRt1ovh0s92SMjATf_bo868', false, 'No device has push switched on yet.'],
]);

it('adds push from the app\'s integration settings, with no fields to fill', function () {
    [$user, $project] = memberWithApp();

    $this->actingAs($user)
        ->post("/{$project->team->slug}/{$project->slug}/integrations", [
            'name' => 'Push (LaraOwl app)',
            'type' => 'push',
            'data' => [],
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($project->integrations()->where('type', 'push')->sole()->alertRules)->toHaveCount(1);
});

it('keeps notifications private to signed-in users', function () {
    $this->get('/settings/notifications')->assertRedirect('/login');
    $this->post('/settings/notifications/devices', browserSubscription())->assertRedirect('/login');
});

it('generates a VAPID key pair', function () {
    $this->artisan('laraowl:push:vapid')
        ->expectsOutputToContain('VAPID_PUBLIC_KEY=')
        ->expectsOutputToContain('VAPID_PRIVATE_KEY=')
        ->assertSuccessful();
});
