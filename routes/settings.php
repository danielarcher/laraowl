<?php

use App\Http\Controllers\Settings\McpTokenController;
use App\Http\Controllers\Settings\NotificationController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Teams\CostController;
use App\Http\Controllers\Teams\TeamController;
use App\Http\Controllers\Teams\TeamInvitationController;
use App\Http\Controllers\Teams\TeamMemberController;
use App\Http\Middleware\EnsureTeamMembership;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/security', [SecurityController::class, 'edit'])->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');

    Route::get('settings/mcp-tokens', [McpTokenController::class, 'index'])->name('mcp-tokens.index');
    Route::post('settings/mcp-tokens', [McpTokenController::class, 'store'])->name('mcp-tokens.store');
    Route::delete('settings/mcp-tokens/{token}', [McpTokenController::class, 'destroy'])->name('mcp-tokens.destroy');

    Route::get('settings/notifications', [NotificationController::class, 'edit'])->name('notifications.edit');
    Route::post('settings/notifications/devices', [NotificationController::class, 'store'])
        ->middleware('throttle:20,1')
        ->name('notifications.devices.store');
    Route::delete('settings/notifications/devices/{subscription}', [NotificationController::class, 'destroy'])->name('notifications.devices.destroy');
    Route::post('settings/notifications/test', [NotificationController::class, 'test'])
        ->middleware('throttle:6,1')
        ->name('notifications.test');
    Route::put('settings/notifications/apps/{project:id}', [NotificationController::class, 'updateApp'])->name('notifications.apps.update');

    Route::middleware(EnsureTeamMembership::class)->group(function () {
        Route::get('settings/teams/{team}', [TeamController::class, 'edit'])->name('teams.edit');
        Route::patch('settings/teams/{team}', [TeamController::class, 'update'])->name('teams.update');
        Route::delete('settings/teams/{team}', [TeamController::class, 'destroy'])->name('teams.destroy');
        Route::post('settings/teams/{team}/switch', [TeamController::class, 'switch'])->name('teams.switch');

        Route::patch('settings/teams/{team}/members/{user}', [TeamMemberController::class, 'update'])->name('teams.members.update');
        Route::delete('settings/teams/{team}/members/{user}', [TeamMemberController::class, 'destroy'])->name('teams.members.destroy');

        Route::post('settings/teams/{team}/invitations', [TeamInvitationController::class, 'store'])->name('teams.invitations.store');
        Route::delete('settings/teams/{team}/invitations/{invitation}', [TeamInvitationController::class, 'destroy'])->name('teams.invitations.destroy');
    });

    // What the team pays: owners and admins only.
    Route::middleware(EnsureTeamMembership::class.':admin')->scopeBindings()->group(function () {
        Route::get('settings/teams/{team}/costs', [CostController::class, 'index'])->name('teams.costs.index');
        Route::post('settings/teams/{team}/costs', [CostController::class, 'store'])->name('teams.costs.store');
        Route::patch('settings/teams/{team}/costs/{cost}', [CostController::class, 'update'])->name('teams.costs.update');
        Route::delete('settings/teams/{team}/costs/{cost}', [CostController::class, 'destroy'])->name('teams.costs.destroy');
    });
});
