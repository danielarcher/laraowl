<?php

use App\Models\Project;
use App\Models\User;

it('keeps the up count neutral and colours only what is down', function () {
    $user = User::factory()->create();
    $team = $user->currentTeam;
    Project::factory()->create(['team_id' => $team->id, 'name' => 'Up', 'url' => 'https://up.test', 'uptime_monitoring_enabled' => true, 'last_uptime_status' => 'up']);
    Project::factory()->create(['team_id' => $team->id, 'name' => 'Broken', 'url' => 'https://broken.test', 'uptime_monitoring_enabled' => true, 'last_uptime_status' => 'down', 'last_uptime_error' => 'HTTP error status: 502']);
    Project::factory()->create(['team_id' => $team->id, 'name' => 'Moved', 'url' => 'https://moved.test', 'uptime_monitoring_enabled' => true, 'last_uptime_status' => 'down', 'last_uptime_error' => 'cURL error 6: Could not resolve host: moved.test']);

    $this->actingAs($user);

    visit("/{$team->slug}/overview")
        ->assertSee('1 up')
        ->assertSee('1 down')
        ->assertSee('1 host not found')
        ->assertScript('[...document.querySelectorAll("div")].find((el) => el.textContent === "1 up" && el.children.length === 0).className.includes("text-red")', false)
        ->assertScript('[...document.querySelectorAll("span")].find((el) => el.textContent === "1 down").className.includes("text-red-500")', true)
        ->assertNoJavaScriptErrors();
});
