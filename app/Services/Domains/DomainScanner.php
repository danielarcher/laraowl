<?php

namespace App\Services\Domains;

use App\Enums\CostCategory;
use App\Models\Domain;
use App\Models\Team;
use App\Support\RegistrableDomain;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Finds the team's domains (from its apps' URLs and its domain costs) and
 * checks each one: where it points, its certificates, mail records and
 * registration.
 */
class DomainScanner
{
    /** Cloudflare's published IPv4 ranges: a host here is proxied, not served directly. */
    private const CLOUDFLARE_RANGES = [
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
        '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
        '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
        '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    ];

    /** Nameserver suffix → who runs the DNS. */
    private const DNS_PROVIDERS = [
        'cloudflare.com' => 'Cloudflare',
        'registrar-servers.com' => 'Namecheap',
        'gandi.net' => 'Gandi',
        'awsdns' => 'AWS Route 53',
        'digitalocean.com' => 'DigitalOcean',
        'domaincontrol.com' => 'GoDaddy',
        'googledomains.com' => 'Google',
        'nsone.net' => 'NS1',
        'dns.br' => 'Registro.br',
        'hostinger' => 'Hostinger',
        'vercel-dns.com' => 'Vercel',
        'ns.maxer' => 'Maxer',
        'maxer.com' => 'Maxer',
        'register.it' => 'Register.it',
        'blacknight.com' => 'Blacknight',
        'linode.com' => 'Akamai Linode',
        'hetzner.com' => 'Hetzner',
        'spaceship.net' => 'Spaceship',
        'fastsecurehost.com' => 'Maxer',
        'wixdns.net' => 'Wix',
    ];

    /** RDAP data only changes on renewal: look it up about once a day. */
    private const RDAP_EVERY_HOURS = 20;

    public function __construct(private DomainProbe $probe) {}

    /**
     * Discover and scan every domain of the team.
     *
     * @return Collection<int, Domain>
     */
    public function scanTeam(Team $team, bool $forceRdap = false): Collection
    {
        $found = $this->discover($team);

        Domain::where('team_id', $team->id)->whereNotIn('name', $found->keys())->delete();

        $servers = $team->servers()->whereNotNull('ip_address')->pluck('id', 'ip_address');

        return $found->map(function (array $entry, string $name) use ($team, $servers, $forceRdap) {
            $domain = Domain::firstOrNew(['team_id' => $team->id, 'name' => $name]);
            $domain->kind = $entry['kind'];

            try {
                $this->scan($domain, $entry['hosts'], $servers, $forceRdap);
            } catch (Throwable $e) {
                Log::warning("Domain scan of {$name} failed: {$e->getMessage()}");
            }

            $domain->save();

            return $domain;
        })->values();
    }

    /**
     * The team's domains: name → kind and the app hosts on it.
     *
     * @return Collection<string, array{kind: string, hosts: array<string, list<int>>}>
     */
    public function discover(Team $team): Collection
    {
        $domains = collect();

        foreach ($team->projects()->get(['id', 'url']) as $project) {
            $host = RegistrableDomain::hostOf($project->url);
            $domain = RegistrableDomain::of($host);

            if (! $domain) {
                continue;
            }

            $entry = $domains->get($domain['name'], ['kind' => $domain['kind'], 'hosts' => []]);
            $entry['hosts'][$host] = array_values(array_unique([...($entry['hosts'][$host] ?? []), $project->id]));
            $domains->put($domain['name'], $entry);
        }

        $costNames = $team->costs()->where('category', CostCategory::Domain)->pluck('name');

        foreach ($costNames as $name) {
            $domain = RegistrableDomain::of($name);

            if ($domain && ! $domains->has($domain['name'])) {
                $domains->put($domain['name'], ['kind' => $domain['kind'], 'hosts' => []]);
            }
        }

        return $domains->sortKeys();
    }

    /**
     * @param  array<string, list<int>>  $appHosts
     * @param  Collection<string, int>  $servers  IP → server id.
     */
    public function scan(Domain $domain, array $appHosts, Collection $servers, bool $forceRdap = false): void
    {
        $name = $domain->name;
        $hostNames = array_values(array_unique([...($domain->isPlatform() ? [] : [$name]), ...array_keys($appHosts)]));

        $domain->hosts = collect($hostNames)->map(function (string $host) use ($appHosts, $servers) {
            $addresses = $this->probe->addresses($host);
            $serverId = collect($addresses)->map(fn ($ip) => $servers->get($ip))->filter()->first();

            return [
                'host' => $host,
                'addresses' => $addresses,
                'server_id' => $serverId,
                'proxied' => $addresses !== [] && collect($addresses)->every(fn ($ip) => $this->inCloudflare($ip)),
                'certificate' => $addresses === [] ? null : $this->probe->certificate($host),
                'project_ids' => $appHosts[$host] ?? [],
            ];
        })->values()->all();

        $head = $this->probe->head($domain->isPlatform() ? $hostNames[0] : $name);
        $domain->http_status = $head['status'] ?? null;
        $domain->redirects_to = $this->redirectTarget($name, $head['location'] ?? null);

        if (! $domain->isPlatform()) {
            $nameservers = $this->probe->nameservers($name);
            $domain->nameservers = $nameservers;
            $domain->dns_provider = $this->provider($nameservers);
            $domain->email = $this->email($name);

            if ($forceRdap || ! $domain->rdap_checked_at || $domain->rdap_checked_at->lt(now()->subHours(self::RDAP_EVERY_HOURS))) {
                $this->rdap($domain);
            }
        }

        $domain->scanned_at = now();
    }

    private function rdap(Domain $domain): void
    {
        try {
            $data = $this->probe->rdap($domain->name);
        } catch (Throwable $e) {
            Log::info("RDAP lookup of {$domain->name} failed: {$e->getMessage()}");
            $domain->rdap_status = 'failed';
            $domain->rdap_checked_at = now();

            return;
        }

        $domain->rdap_checked_at = now();

        if ($data === null) {
            $domain->rdap_status = 'unsupported';

            return;
        }

        $domain->rdap_status = 'ok';
        $domain->registrar = $data['registrar'];
        $domain->registered_at = $data['registered_at'] ? Carbon::parse($data['registered_at']) : null;
        $domain->expires_at = $data['expires_at'] ? Carbon::parse($data['expires_at']) : null;
    }

    /**
     * Mail posture from public DNS: who may send as the domain, and what
     * receivers should do with mail that fails the check.
     *
     * @return array{mx: bool, spf: string|null, spf_all: string|null, dmarc: string|null, grade: string}
     */
    public function email(string $domain): array
    {
        $spf = collect($this->probe->txt($domain))->first(fn ($txt) => str_starts_with(strtolower($txt), 'v=spf1'));
        $dmarcRecord = collect($this->probe->txt("_dmarc.{$domain}"))->first(fn ($txt) => str_starts_with(strtolower($txt), 'v=dmarc1'));
        $mx = $this->probe->hasMx($domain);

        preg_match('/([~?+-])all\b/i', (string) $spf, $all);
        preg_match('/\bp=(none|quarantine|reject)\b/i', (string) $dmarcRecord, $policy);

        $spfAll = $all[1] ?? null;
        $dmarc = isset($policy[1]) ? strtolower($policy[1]) : null;

        return [
            'mx' => $mx,
            'spf' => $spf,
            'spf_all' => $spfAll,
            'dmarc' => $dmarc,
            'grade' => self::emailGrade($mx, $spf !== null, $spfAll, $dmarc),
        ];
    }

    /**
     * A: nobody can spoof it (SPF + enforced DMARC). B: SPF and a DMARC that
     * only watches. C: SPF alone. F: nothing stops a forged sender.
     */
    public static function emailGrade(bool $mx, bool $hasSpf, ?string $spfAll, ?string $dmarc): string
    {
        $enforced = in_array($dmarc, ['quarantine', 'reject'], true);

        return match (true) {
            $hasSpf && $enforced && in_array($spfAll, ['-', '~'], true) => 'A',
            $hasSpf && $enforced => 'B',
            $hasSpf && $dmarc === 'none' => 'B',
            $hasSpf => 'C',
            default => 'F',
        };
    }

    /**
     * @param  list<string>  $nameservers
     */
    private function provider(array $nameservers): ?string
    {
        foreach ($nameservers as $nameserver) {
            foreach (self::DNS_PROVIDERS as $needle => $provider) {
                if (str_contains($nameserver, $needle)) {
                    return $provider;
                }
            }
        }

        return $nameservers === [] ? null : 'Other';
    }

    /**
     * The other site this domain sends visitors to (a parked or alias
     * domain), ignoring the usual www and path redirects of its own.
     */
    private function redirectTarget(string $domain, ?string $location): ?string
    {
        $host = RegistrableDomain::hostOf($location);

        if (! $host || $host === $domain || $host === "www.{$domain}" || str_ends_with($host, ".{$domain}")) {
            return null;
        }

        return $host;
    }

    private function inCloudflare(string $ip): bool
    {
        $address = ip2long($ip);

        if ($address === false) {
            return false;
        }

        foreach (self::CLOUDFLARE_RANGES as $range) {
            [$subnet, $bits] = explode('/', $range);
            $mask = -1 << (32 - (int) $bits);

            if (($address & $mask) === (ip2long($subnet) & $mask)) {
                return true;
            }
        }

        return false;
    }
}
