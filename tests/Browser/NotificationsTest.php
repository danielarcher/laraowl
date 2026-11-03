<?php

use App\Models\Project;
use App\Models\User;

// Needs the built front end: npm run build.

beforeEach(function () {
    config([
        'webpush.public_key' => 'BI59XgxWF4mFcuDV34qBsQoE5pQtcWwaYCKg0dKZAiM6OTt00M2nFhd527Jt-ixGyTGeo9nZw0n3uEkQjpqkOoQ',
        'webpush.private_key' => '0hXTT47anxvG2PEbvHY9tRt1ovh0s92SMjATf_bo868',
    ]);
});

function signedInWithApp(): array
{
    $user = User::factory()->create();
    $project = Project::factory()->create(['team_id' => $user->currentTeam->id, 'name' => 'Shop']);
    $project->alertRules()->create(['name' => 'Site down', 'event_type' => 'uptime_down', 'is_enabled' => true]);

    test()->actingAs($user);

    return [$user, $project];
}

it('switches an app\'s alerts to push from the notifications page', function () {
    [, $project] = signedInWithApp();

    $page = visit('/settings/notifications');

    $page->assertSee('Push alerts from')
        ->assertSee('1 alert rule')
        ->assertSee('0 of 1 apps')
        ->click('[aria-label="Push alerts from Shop"]')
        ->assertSee('1 of 1 apps')
        ->assertNoJavaScriptErrors();

    expect($project->integrations()->where('type', 'push')->sole()->is_enabled)->toBeTrue();

    // Reopen: the switch stays on.
    visit('/settings/notifications')
        ->assertSee('1 of 1 apps')
        ->assertScript('document.querySelector(\'[aria-label="Push alerts from Shop"]\').getAttribute("aria-checked")', 'true');
});

it('finds Notifications in the settings menu', function () {
    signedInWithApp();

    visit('/settings/profile')
        ->click('nav[aria-label="Settings"] >> text=Notifications')
        ->assertPathIs('/settings/notifications')
        ->assertSee('This device');
});

it('registers the service worker and links the manifest', function () {
    signedInWithApp();

    visit('/settings/notifications')
        ->assertScript('document.querySelector(\'link[rel="manifest"]\').getAttribute("href")', '/manifest.json')
        ->assertScript('navigator.serviceWorker.ready.then((r) => r.active.scriptURL.endsWith("/sw.js"))', true);
});

it('gives phones a tab bar instead of the sidebar', function () {
    [$user] = signedInWithApp();
    $team = $user->currentTeam->slug;

    visit("/{$team}/overview")->on()->mobile()
        ->assertVisible('nav[aria-label="Main"]')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->click('nav[aria-label="Main"] >> text=Servers')
        ->assertPathIs("/{$team}/servers")
        ->assertNoJavaScriptErrors();
});

it('keeps the tab bar off desktop screens', function () {
    [$user] = signedInWithApp();

    visit("/{$user->currentTeam->slug}/overview")
        ->assertMissing('nav[aria-label="Main"]');
});

it('fits the notifications page on a phone', function () {
    signedInWithApp();

    visit('/settings/notifications')->on()->mobile()
        ->assertSee('Push alerts from')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->assertNoJavaScriptErrors();
});
