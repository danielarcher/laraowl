<?php

use App\Models\Cost;
use App\Models\Project;
use App\Models\User;
use App\Services\Domains\DomainProbe;
use Tests\Fakes\FakeDomainProbe;

beforeEach(function () {
    $probe = new FakeDomainProbe;
    $probe->addresses = ['example.com' => ['10.0.0.5'], 'shop.example.com' => ['10.0.0.5'], 'old-brand.com' => ['10.0.0.5']];
    $probe->certificates = [
        'example.com' => FakeDomainProbe::cert('example.com'),
        'shop.example.com' => FakeDomainProbe::cert('shop.example.com'),
        'old-brand.com' => FakeDomainProbe::cert('old-brand.com'),
    ];
    $probe->nameservers = ['example.com' => ['ns1.gandi.net']];
    $probe->txt = ['example.com' => ['v=spf1 include:_spf.mail.test -all'], '_dmarc.example.com' => ['v=DMARC1; p=quarantine']];
    $probe->heads = ['old-brand.com' => ['status' => 301, 'location' => 'https://example.com/']];
    $probe->rdap = ['example.com' => ['registrar' => 'Gandi SAS', 'registered_at' => '2018-02-01T00:00:00Z', 'expires_at' => now()->addMonths(4)->toIso8601String()]];
    $this->instance(DomainProbe::class, $probe);

    $this->user = User::factory()->create();
    $this->team = $this->user->currentTeam;
    Project::factory()->create(['team_id' => $this->team->id, 'name' => 'Shop', 'url' => 'https://shop.example.com']);
    Cost::factory()->create(['team_id' => $this->team->id, 'category' => 'domain', 'name' => 'old-brand.com', 'amount_cents' => 1000, 'currency' => 'USD', 'interval' => 'yearly']);

    $this->artisan('laraowl:domains:scan');
    $this->actingAs($this->user);
});

it('shows every domain and opens one for its records', function () {
    visit("/{$this->team->slug}/domains")
        ->assertSee('Renewal radar')
        ->assertSee('Spoofing protection')
        ->assertSee('example.com')
        ->assertSee('old-brand.com')
        ->click('[aria-label="example.com details"]')
        ->assertSee('Gandi SAS')
        ->assertSee('p=quarantine')
        ->assertSee('v=spf1 include:_spf.mail.test -all')
        ->assertNoJavaScriptErrors();
});

it('filters to parked domains', function () {
    visit("/{$this->team->slug}/domains")
        ->click('[aria-label="Filter domains"] >> text=Parked')
        ->assertSee('old-brand.com')
        ->assertMissing('[aria-label="example.com details"]');
});

it('filters by DNS provider', function () {
    visit("/{$this->team->slug}/domains")
        ->click('[aria-label="Filter by DNS provider"] >> text=Gandi')
        ->assertPresent('[aria-label="example.com details"]')
        ->assertMissing('[aria-label="old-brand.com details"]')
        ->click('[aria-label="Filter by DNS provider"] >> text=All')
        ->assertPresent('[aria-label="old-brand.com details"]')
        ->assertNoJavaScriptErrors();
});

it('scans again from the button', function () {
    visit("/{$this->team->slug}/domains")
        ->click('Scan now')
        ->assertSee('Domains scanned.');
});

it('groups the sidebar into all applications and this application', function () {
    $page = visit("/{$this->team->slug}/overview");

    $page->assertSee('ALL APPLICATIONS')
        ->assertSee('THIS APPLICATION')
        ->assertSeeIn('[data-test="sidebar-current-app"]', 'Shop')
        ->click('[data-sidebar="sidebar"] >> text=Domains')
        ->assertPathIs("/{$this->team->slug}/domains")
        ->assertNoJavaScriptErrors();
});

it('fits a phone', function () {
    visit("/{$this->team->slug}/domains")->on()->mobile()
        ->click('[aria-label="example.com details"]')
        ->assertSee('Gandi SAS')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);
});
