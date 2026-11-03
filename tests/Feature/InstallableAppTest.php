<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('ships a manifest that browsers accept as an installable app', function () {
    $manifest = json_decode(file_get_contents(public_path('manifest.json')), true, flags: JSON_THROW_ON_ERROR);

    expect($manifest)
        ->name->toBe('LaraOwl')
        ->display->toBe('standalone')
        ->start_url->toStartWith('/dashboard');

    $sizes = collect($manifest['icons'])->pluck('sizes')->all();
    expect($sizes)->toContain('192x192', '512x512');
    expect(collect($manifest['icons'])->pluck('purpose'))->toContain('maskable');

    foreach ($manifest['icons'] as $icon) {
        [$width, $height] = getimagesize(public_path(ltrim($icon['src'], '/')));
        expect("{$width}x{$height}")->toBe($icon['sizes']);
    }
});

it('links the manifest and the iPhone icon from every page', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/settings/profile')
        ->assertOk()
        ->assertSee('<link rel="manifest" href="/manifest.json">', false)
        ->assertSee('/icons/apple-touch-icon.png', false)
        ->assertSee('viewport-fit=cover', false);
});

it('has a service worker that never caches pages or data', function () {
    $worker = file_get_contents(public_path('sw.js'));

    expect($worker)
        ->toContain("addEventListener('push'")
        ->toContain("addEventListener('notificationclick'")
        ->toContain("'/build/assets/'")
        ->not->toContain('/api/');

    expect(file_get_contents(public_path('offline.html')))->toContain("You're offline");
});
