<?php

use App\Models\Cost;
use App\Models\Domain;
use App\Models\Project;
use App\Models\PushSubscription;
use App\Models\Server;
use App\Models\User;
use App\Services\Domains\DomainProbe;
use App\Services\Domains\DomainScanner;
use App\Services\Push\PushGateway;
use App\Support\RegistrableDomain;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Fakes\FakeDomainProbe;
use Tests\Fakes\FakePushGateway;

beforeEach(function () {
    $this->probe = new FakeDomainProbe;
    $this->instance(DomainProbe::class, $this->probe);

    $this->user = User::factory()->create();
    $this->team = $this->user->currentTeam;
});

/**
 * @return array<string, mixed>
 */
function domainsPage(): array
{
    $props = [];

    test()->actingAs(test()->user)
        ->get('/'.test()->team->slug.'/domains')
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$props) {
            $page->component('domains/index');
            $props = $page->toArray()['props'];
        });

    return $props;
}

function domainRow(array $props, string $name): array
{
    return collect($props['domains'])->firstWhere('name', $name) ?? throw new RuntimeException("No row for {$name}");
}

it('splits hosts into the domains people register', function (?string $host, ?array $expected) {
    expect(RegistrableDomain::of($host))->toBe($expected);
})->with([
    'apex' => ['shop.example.com', ['name' => 'example.com', 'kind' => 'registered']],
    'deep subdomain' => ['a.b.example.io', ['name' => 'example.io', 'kind' => 'registered']],
    'two-part suffix' => ['www.loja.com.br', ['name' => 'loja.com.br', 'kind' => 'registered']],
    'platform host' => ['myapp.on-forge.com', ['name' => 'myapp.on-forge.com', 'kind' => 'platform']],
    'ip address' => ['127.0.0.1', null],
    'nothing' => [null, null],
]);

it('finds domains from the apps and the domain costs, and scans them', function () {
    $server = Server::factory()->create(['team_id' => $this->team->id, 'name' => 'web-1', 'ip_address' => '10.0.0.5']);
    Project::factory()->create(['team_id' => $this->team->id, 'name' => 'Shop', 'url' => 'https://shop.example.com']);
    Project::factory()->create(['team_id' => $this->team->id, 'name' => 'Staging', 'url' => 'https://staging.on-forge.com']);
    Cost::factory()->create(['team_id' => $this->team->id, 'category' => 'domain', 'name' => 'example.com', 'amount_cents' => 1200, 'currency' => 'USD', 'interval' => 'yearly', 'renews_on' => now()->addMonths(5)->toDateString()]);
    Cost::factory()->create(['team_id' => $this->team->id, 'category' => 'domain', 'name' => 'old-brand.com', 'amount_cents' => 1000, 'currency' => 'USD', 'interval' => 'yearly']);

    $this->probe->addresses = ['example.com' => ['10.0.0.5'], 'shop.example.com' => ['104.16.1.1'], 'staging.on-forge.com' => ['10.0.0.5'], 'old-brand.com' => ['10.0.0.5']];
    $this->probe->certificates = [
        'example.com' => FakeDomainProbe::cert('example.com'),
        'shop.example.com' => FakeDomainProbe::cert('shop.example.com', 9),
        'staging.on-forge.com' => FakeDomainProbe::cert('staging.on-forge.com'),
        'old-brand.com' => FakeDomainProbe::cert('old-brand.com'),
    ];
    $this->probe->nameservers = ['example.com' => ['ns1.cloudflare.com', 'ns2.cloudflare.com'], 'old-brand.com' => ['dns1.registrar-servers.com']];
    $this->probe->txt = ['example.com' => ['v=spf1 include:_spf.mail.test -all'], '_dmarc.example.com' => ['v=DMARC1; p=reject']];
    $this->probe->mx = ['example.com' => true];
    $this->probe->heads = ['old-brand.com' => ['status' => 301, 'location' => 'https://example.com/']];
    $this->probe->rdap = [
        'example.com' => ['registrar' => 'Namecheap', 'registered_at' => '2015-04-01T00:00:00Z', 'expires_at' => now()->addDays(20)->toIso8601String()],
        'old-brand.com' => null,
    ];

    $this->artisan('laraowl:domains:scan')->assertSuccessful();

    expect(Domain::where('team_id', $this->team->id)->orderBy('name')->pluck('kind', 'name')->all())->toBe([
        'example.com' => 'registered',
        'old-brand.com' => 'registered',
        'staging.on-forge.com' => 'platform',
    ]);

    $props = domainsPage();
    $example = domainRow($props, 'example.com');
    $shop = collect($example['hosts'])->firstWhere('host', 'shop.example.com');
    $apex = collect($example['hosts'])->firstWhere('host', 'example.com');

    expect($example['dns_provider'])->toBe('Cloudflare')
        ->and($example['registrar'])->toBe('Namecheap')
        ->and($example['expiry_source'])->toBe('registry')
        ->and($example['days_to_expiry'])->toBe(20)
        ->and($example['email']['grade'])->toBe('A')
        ->and($example['cost']['yearly_cents'])->toBe(1200)
        ->and($apex['server'])->toBe(['id' => $server->id, 'name' => 'web-1'])
        ->and($shop['proxied'])->toBeTrue()
        ->and($shop['apps'][0]['name'])->toBe('Shop')
        ->and($shop['certificate']['days_left'])->toBe(9)
        ->and(collect($example['findings'])->pluck('text')->all())->toContain(
            'The registration runs out in 20 days.',
            "The certificate of shop.example.com expires in 9 days and hasn't renewed.",
        );

    $old = domainRow($props, 'old-brand.com');
    expect($old['redirects_to'])->toBe('example.com')
        ->and($old['rdap_status'])->toBe('unsupported')
        ->and($old['dns_provider'])->toBe('Namecheap')
        ->and($old['email']['grade'])->toBe('F');

    expect(domainRow($props, 'staging.on-forge.com'))
        ->kind->toBe('platform')
        ->nameservers->toBe([])
        ->email->toBeNull();

    expect($props['summary'])
        ->domains->toBe(3)
        ->platform->toBe(1)
        ->proxied->toBe(1);
    expect($props['summary']['next_renewal']['name'])->toBe('example.com');
});

it('falls back to the renewal date in Costs when the registry has no RDAP', function () {
    Cost::factory()->create(['team_id' => $this->team->id, 'category' => 'domain', 'name' => 'keep.ie', 'amount_cents' => 6150, 'currency' => 'EUR', 'interval' => 'yearly', 'renews_on' => now()->addDays(100)->toDateString()]);

    $this->artisan('laraowl:domains:scan')->assertSuccessful();

    expect(domainRow(domainsPage(), 'keep.ie'))
        ->expiry_source->toBe('costs')
        ->days_to_expiry->toBe(100);
});

it('flags a host that points away from every server', function () {
    Project::factory()->create(['team_id' => $this->team->id, 'name' => 'Shop', 'url' => 'https://shop.example.com']);
    $this->probe->addresses = ['example.com' => ['1.2.3.4'], 'shop.example.com' => ['1.2.3.4']];
    $this->probe->certificates = ['example.com' => FakeDomainProbe::cert('example.com'), 'shop.example.com' => FakeDomainProbe::cert('shop.example.com')];

    $this->artisan('laraowl:domains:scan')->assertSuccessful();

    expect(collect(domainRow(domainsPage(), 'example.com')['findings'])->pluck('text'))
        ->toContain('shop.example.com points at 1.2.3.4, which is none of your servers.');
});

it('looks up registration about once a day, unless asked', function () {
    Cost::factory()->create(['team_id' => $this->team->id, 'category' => 'domain', 'name' => 'example.com']);
    $this->probe->rdap = ['example.com' => 'fail'];

    $this->artisan('laraowl:domains:scan')->assertSuccessful();
    $this->artisan('laraowl:domains:scan')->assertSuccessful();
    expect($this->probe->rdapCalls)->toBe(1)
        ->and(Domain::sole()->rdap_status)->toBe('failed');

    $this->artisan('laraowl:domains:scan --rdap')->assertSuccessful();
    expect($this->probe->rdapCalls)->toBe(2);
});

it('forgets domains nothing refers to any more', function () {
    $cost = Cost::factory()->create(['team_id' => $this->team->id, 'category' => 'domain', 'name' => 'gone.com']);
    $this->artisan('laraowl:domains:scan');
    expect(Domain::count())->toBe(1);

    $cost->delete();
    $this->artisan('laraowl:domains:scan');
    expect(Domain::count())->toBe(0);
});

it('scans from the page with the button', function () {
    Cost::factory()->create(['team_id' => $this->team->id, 'category' => 'domain', 'name' => 'example.com']);

    $this->actingAs($this->user)
        ->post("/{$this->team->slug}/domains/scan")
        ->assertRedirect()
        ->assertSessionHas('success', 'Scanned 1 domain.');

    expect(domainsPage()['domains'])->toHaveCount(1);
});

it('keeps another team out', function () {
    $this->actingAs(User::factory()->create())
        ->get("/{$this->team->slug}/domains")
        ->assertForbidden();
});

it('pushes one warning per step as a registration nears its end', function () {
    config(['webpush.public_key' => 'BI59XgxWF4mFcuDV34qBsQoE5pQtcWwaYCKg0dKZAiM6OTt00M2nFhd527Jt-ixGyTGeo9nZw0n3uEkQjpqkOoQ', 'webpush.private_key' => '0hXTT47anxvG2PEbvHY9tRt1ovh0s92SMjATf_bo868']);
    $gateway = new FakePushGateway;
    $this->instance(PushGateway::class, $gateway);
    PushSubscription::factory()->for($this->user)->create();

    Cost::factory()->create(['team_id' => $this->team->id, 'category' => 'domain', 'name' => 'example.com']);
    $this->probe->rdap = ['example.com' => ['registrar' => 'Gandi', 'registered_at' => null, 'expires_at' => now()->addDays(6)->toIso8601String()]];

    $this->artisan('laraowl:domains:scan')->assertSuccessful();
    $this->artisan('laraowl:domains:scan')->assertSuccessful();

    expect($gateway->sent)->toHaveCount(1)
        ->and($gateway->sent[0]['payload']['title'])->toBe('example.com expires in 6 days')
        ->and($gateway->sent[0]['payload']['body'])->toBe('Domains · Renew it at Gandi.')
        ->and($gateway->sent[0]['payload']['url'])->toEndWith("/{$this->team->slug}/domains");
});

it('grades mail spoofing protection', function (bool $mx, bool $spf, ?string $all, ?string $dmarc, string $grade) {
    expect(DomainScanner::emailGrade($mx, $spf, $all, $dmarc))->toBe($grade);
})->with([
    'enforced' => [true, true, '-', 'reject', 'A'],
    'quarantine, open spf' => [true, true, '?', 'quarantine', 'B'],
    'dmarc watching' => [true, true, '~', 'none', 'B'],
    'spf only' => [true, true, '~', null, 'C'],
    'nothing' => [true, false, null, null, 'F'],
]);
