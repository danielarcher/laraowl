<?php

use App\Enums\TeamRole;
use App\Http\Middleware\CheckOnboarding;
use App\Models\Project;
use App\Models\Team;
use App\Models\TeamInvitation;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

test('team invitations can be created', function () {
    Notification::fake();

    $owner = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    $response = $this
        ->actingAs($owner)
        ->post(route('teams.invitations.store', $team), [
            'email' => 'invited@example.com',
            'role' => TeamRole::Member->value,
        ]);

    $response->assertRedirect(route('teams.edit', $team));

    $this->assertDatabaseHas('team_invitations', [
        'team_id' => $team->id,
        'email' => 'invited@example.com',
        'role' => TeamRole::Member->value,
    ]);
});

test('team invitations can be created by admins', function () {
    Notification::fake();

    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($admin, ['role' => TeamRole::Admin->value]);

    $response = $this
        ->actingAs($admin)
        ->post(route('teams.invitations.store', $team), [
            'email' => 'invited@example.com',
            'role' => TeamRole::Member->value,
        ]);

    $response->assertRedirect(route('teams.edit', $team));
});

test('existing team members cannot be invited', function () {
    Notification::fake();

    $owner = User::factory()->create();
    $member = User::factory()->create(['email' => 'member@example.com']);
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);

    $response = $this
        ->actingAs($owner)
        ->post(route('teams.invitations.store', $team), [
            'email' => 'member@example.com',
            'role' => TeamRole::Member->value,
        ]);

    $response->assertSessionHasErrors('email');
});

test('duplicate invitations cannot be created', function () {
    Notification::fake();

    $owner = User::factory()->create();
    $team = Team::factory()->create();
    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    TeamInvitation::factory()->create([
        'team_id' => $team->id,
        'email' => 'invited@example.com',
        'invited_by' => $owner->id,
    ]);

    $response = $this
        ->actingAs($owner)
        ->post(route('teams.invitations.store', $team), [
            'email' => 'invited@example.com',
            'role' => TeamRole::Member->value,
        ]);

    $response->assertSessionHasErrors('email');
});

test('team invitations cannot be created by members', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);
    $team->members()->attach($member, ['role' => TeamRole::Member->value]);

    $response = $this
        ->actingAs($member)
        ->post(route('teams.invitations.store', $team), [
            'email' => 'invited@example.com',
            'role' => TeamRole::Member->value,
        ]);

    $response->assertForbidden();
});

test('team invitations can be cancelled by owners', function () {
    $owner = User::factory()->create();
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    $invitation = TeamInvitation::factory()->create([
        'team_id' => $team->id,
        'invited_by' => $owner->id,
    ]);

    $response = $this
        ->actingAs($owner)
        ->delete(route('teams.invitations.destroy', [$team, $invitation]));

    $response->assertRedirect(route('teams.edit', $team));

    $this->assertDatabaseMissing('team_invitations', [
        'id' => $invitation->id,
    ]);
});

test('team invitations can be accepted', function () {
    $owner = User::factory()->create();
    $invitedUser = User::factory()->create(['email' => 'invited@example.com']);
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    $invitation = TeamInvitation::factory()->create([
        'team_id' => $team->id,
        'email' => 'invited@example.com',
        'role' => TeamRole::Member,
        'invited_by' => $owner->id,
    ]);

    $response = $this
        ->actingAs($invitedUser)
        ->get(route('invitations.accept', $invitation));

    $response->assertRedirect('/dashboard');

    expect($invitedUser->fresh()->belongsToTeam($team))->toBeTrue();
    expect($invitation->fresh()->accepted_at)->not->toBeNull();
});

test('onboarding does not intercept invitation acceptance', function () {
    $owner = User::factory()->create();
    $invitedUser = User::factory()->create(['email' => 'invited@example.com']);
    $team = Team::factory()->create();
    $project = Project::factory()->create(['team_id' => $team->id]);

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    $invitation = TeamInvitation::factory()->create([
        'team_id' => $team->id,
        'email' => $invitedUser->email,
        'invited_by' => $owner->id,
    ]);

    $this->withMiddleware(CheckOnboarding::class)
        ->actingAs($invitedUser)
        ->get(route('invitations.accept', $invitation))
        ->assertRedirect('/dashboard');

    expect($invitedUser->fresh()->belongsToTeam($team))->toBeTrue()
        ->and($invitedUser->fresh()->current_team_id)->toBe($team->id);

    $this->get('/dashboard')->assertRedirect(route('overview', [
        'current_team' => $team->slug,
    ]));
});

test('a teamless user returns to the invitation after logging in', function () {
    $owner = User::factory()->create();
    $team = Team::factory()->create();
    $project = Project::factory()->create(['team_id' => $team->id]);
    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    $invitedUser = User::create([
        'name' => 'Invited User',
        'email' => 'invited@example.com',
        'password' => 'password',
    ]);

    $invitation = TeamInvitation::factory()->create([
        'team_id' => $team->id,
        'email' => $invitedUser->email,
        'invited_by' => $owner->id,
    ]);

    $acceptUrl = route('invitations.accept', $invitation);

    $this->withMiddleware(CheckOnboarding::class)
        ->get($acceptUrl)
        ->assertRedirect(route('login'));

    $this->post(route('login.store'), [
        'email' => $invitedUser->email,
        'password' => 'password',
    ])->assertRedirect($acceptUrl);

    $this->get($acceptUrl)->assertRedirect('/dashboard');

    expect($invitedUser->fresh()->belongsToTeam($team))->toBeTrue()
        ->and($invitedUser->fresh()->current_team_id)->toBe($team->id)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();

    $this->get('/dashboard')->assertRedirect(route('overview', [
        'current_team' => $team->slug,
    ]));
});

test('a new user joins the inviting team after registering', function () {
    $owner = User::factory()->create();
    $team = Team::factory()->create();
    $project = Project::factory()->create(['team_id' => $team->id]);
    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    $invitation = TeamInvitation::factory()->create([
        'team_id' => $team->id,
        'email' => 'new-user@example.com',
        'invited_by' => $owner->id,
    ]);

    $acceptUrl = route('invitations.accept', $invitation);

    $this->withMiddleware(CheckOnboarding::class)
        ->get($acceptUrl)
        ->assertRedirect(route('login'));

    $this->post(route('register.store'), [
        'name' => 'New User',
        'email' => $invitation->email,
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect($acceptUrl);

    $this->get($acceptUrl)->assertRedirect('/dashboard');

    $user = User::where('email', $invitation->email)->firstOrFail();

    expect($user->belongsToTeam($team))->toBeTrue()
        ->and($user->current_team_id)->toBe($team->id)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();

    $this->get('/dashboard')->assertRedirect(route('overview', [
        'current_team' => $team->slug,
    ]));
});

test('team invitations cannot be accepted by uninvited user', function () {
    $owner = User::factory()->create();
    $uninvitedUser = User::factory()->create(['email' => 'uninvited@example.com']);
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    $invitation = TeamInvitation::factory()->create([
        'team_id' => $team->id,
        'email' => 'invited@example.com',
        'invited_by' => $owner->id,
    ]);

    $response = $this
        ->actingAs($uninvitedUser)
        ->get(route('invitations.accept', $invitation));

    $response->assertSessionHasErrors('invitation');

    expect($uninvitedUser->fresh()->belongsToTeam($team))->toBeFalse();
});

test('expired invitations cannot be accepted', function () {
    $owner = User::factory()->create();
    $invitedUser = User::factory()->create(['email' => 'invited@example.com']);
    $team = Team::factory()->create();

    $team->members()->attach($owner, ['role' => TeamRole::Owner->value]);

    $invitation = TeamInvitation::factory()->expired()->create([
        'team_id' => $team->id,
        'email' => 'invited@example.com',
        'invited_by' => $owner->id,
    ]);

    $response = $this
        ->actingAs($invitedUser)
        ->get(route('invitations.accept', $invitation));

    $response->assertSessionHasErrors('invitation');

    expect($invitedUser->fresh()->belongsToTeam($team))->toBeFalse();
});
