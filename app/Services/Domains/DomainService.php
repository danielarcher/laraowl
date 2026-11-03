<?php

namespace App\Services\Domains;

use App\Enums\CostCategory;
use App\Models\Cost;
use App\Models\Domain;
use App\Models\Project;
use App\Models\Team;
use App\Services\CostService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * What the Domains page shows: every domain with its certificates, DNS,
 * mail posture, renewal, cost and 30 days of uptime, plus a 12-month radar.
 */
class DomainService
{
    public const UPTIME_DAYS = 30;

    /** A certificate this close to expiry no longer counts as auto-renewing. */
    public const CERT_WARN_DAYS = 14;

    public const DOMAIN_WARN_DAYS = 30;

    public function __construct(private CostService $costs) {}

    /**
     * @return array<string, mixed>
     */
    public function overview(Team $team): array
    {
        $today = CarbonImmutable::now()->startOfDay();
        $domains = Domain::where('team_id', $team->id)->orderBy('kind')->orderBy('name')->get();
        $projects = $team->projects()->get(['id', 'name', 'slug', 'url'])->keyBy('id');
        $servers = $team->servers()->get(['id', 'name'])->keyBy('id');
        $costs = $team->costs()->where('category', CostCategory::Domain)->get()->keyBy(fn (Cost $c) => strtolower($c->name));
        $uptime = $this->uptimeByProject($team, $projects->keys()->all(), $today);

        $rows = $domains->map(fn (Domain $domain) => $this->row($domain, $projects, $servers, $costs->get($domain->name), $uptime, $today))->values();

        return [
            'domains' => $rows,
            'summary' => $this->summary($rows),
            'radar' => $this->radar($rows, $today),
            'currency' => $this->costs->baseCurrency(),
            'scanned_at' => $domains->max('scanned_at')?->toIso8601String(),
        ];
    }

    /**
     * @param  Collection<int, Project>  $projects
     * @param  Collection<int, mixed>  $servers
     * @param  array<int, array<string, array{n: int, up: int, ms: float|null}>>  $uptime
     * @return array<string, mixed>
     */
    private function row(Domain $domain, Collection $projects, Collection $servers, ?Cost $cost, array $uptime, CarbonImmutable $today): array
    {
        $hosts = collect($domain->hosts ?? [])->map(function (array $host) use ($servers, $projects, $today) {
            $certificate = $host['certificate'] ?? null;

            if ($certificate) {
                $from = CarbonImmutable::parse($certificate['valid_from']);
                $to = CarbonImmutable::parse($certificate['expires_at']);
                $lifetime = max(1, $from->diffInDays($to));
                $certificate['days_left'] = (int) floor($today->diffInDays($to, false));
                $certificate['lifetime_days'] = (int) round($lifetime);
                $certificate['used'] = round(min(1, max(0, $from->diffInDays($today) / $lifetime)), 3);
            }

            return [
                'host' => $host['host'],
                'addresses' => $host['addresses'] ?? [],
                'proxied' => (bool) ($host['proxied'] ?? false),
                'server' => isset($host['server_id']) && $servers->has($host['server_id'])
                    ? ['id' => $host['server_id'], 'name' => $servers[$host['server_id']]->name]
                    : null,
                'certificate' => $certificate,
                'apps' => collect($host['project_ids'] ?? [])
                    ->map(fn ($id) => $projects->get($id))
                    ->filter()
                    ->map(fn (Project $p) => ['id' => $p->id, 'name' => $p->name, 'slug' => $p->slug])
                    ->values()
                    ->all(),
            ];
        })->values();

        $projectIds = $hosts->flatMap(fn ($h) => collect($h['apps'])->pluck('id'))->unique()->values()->all();
        $days = $this->dailyUptime($projectIds, $uptime, $today);
        $checks = array_sum(array_column($days, 'checks'));
        $upChecks = array_sum(array_map(fn ($d) => $d['ratio'] === null ? 0 : $d['ratio'] * $d['checks'], $days));

        [$expiresAt, $expirySource] = match (true) {
            $domain->expires_at !== null => [CarbonImmutable::parse($domain->expires_at), 'registry'],
            $cost?->renews_on !== null => [CarbonImmutable::parse($cost->renews_on), 'costs'],
            default => [null, null],
        };

        $certDays = $hosts->pluck('certificate.days_left')->filter(fn ($d) => $d !== null)->min();

        $row = [
            'id' => $domain->id,
            'name' => $domain->name,
            'kind' => $domain->kind,
            'hosts' => $hosts->all(),
            'dns_provider' => $domain->dns_provider,
            'nameservers' => $domain->nameservers ?? [],
            'email' => $domain->email,
            'http_status' => $domain->http_status,
            'redirects_to' => $domain->redirects_to,
            'registrar' => $domain->registrar,
            'registered_at' => $domain->registered_at?->toIso8601String(),
            'expires_at' => $expiresAt?->toIso8601String(),
            'expiry_source' => $expirySource,
            'days_to_expiry' => $expiresAt ? (int) floor($today->diffInDays($expiresAt, false)) : null,
            'rdap_status' => $domain->rdap_status,
            'cert_days' => $certDays,
            'cost' => $cost ? [
                'amount_cents' => $cost->amount_cents,
                'currency' => $cost->currency,
                'interval' => $cost->interval->value,
                'yearly_cents' => (int) round($this->costs->monthlyCents($cost) * 12),
            ] : null,
            'uptime' => $days,
            'availability' => $checks > 0 ? round($upChecks / $checks, 5) : null,
            'scanned_at' => $domain->scanned_at?->toIso8601String(),
        ];

        $row['findings'] = $this->findings($row);

        return $row;
    }

    /**
     * Things worth a look, worst first.
     *
     * @param  array<string, mixed>  $row
     * @return list<array{level: 'critical'|'warning'|'info', text: string}>
     */
    public function findings(array $row): array
    {
        $findings = [];

        if ($row['days_to_expiry'] !== null && $row['days_to_expiry'] <= self::DOMAIN_WARN_DAYS) {
            $findings[] = [
                'level' => $row['days_to_expiry'] <= 7 ? 'critical' : 'warning',
                'text' => $row['days_to_expiry'] < 0
                    ? 'The registration has expired.'
                    : "The registration runs out in {$row['days_to_expiry']} days.",
            ];
        }

        foreach ($row['hosts'] as $host) {
            $certificate = $host['certificate'];

            if ($host['addresses'] === []) {
                $findings[] = ['level' => $host['apps'] === [] ? 'info' : 'critical', 'text' => "{$host['host']} doesn't resolve."];

                continue;
            }

            if (! $certificate) {
                $findings[] = ['level' => $host['apps'] === [] ? 'info' : 'critical', 'text' => "{$host['host']} serves no certificate on 443."];
            } elseif ($certificate['days_left'] <= self::CERT_WARN_DAYS) {
                $findings[] = [
                    'level' => $certificate['days_left'] <= 5 ? 'critical' : 'warning',
                    'text' => $certificate['days_left'] < 0
                        ? "The certificate of {$host['host']} has expired."
                        : "The certificate of {$host['host']} expires in {$certificate['days_left']} days and hasn't renewed.",
                ];
            } elseif (! in_array($host['host'], $certificate['names'] ?? [], true) && ! collect($certificate['names'] ?? [])->contains(fn ($n) => str_starts_with($n, '*.') && str_ends_with($host['host'], substr($n, 1)))) {
                $findings[] = ['level' => 'critical', 'text' => "The certificate on {$host['host']} is for another name."];
            }

            if (! $host['server'] && ! $host['proxied'] && $host['apps'] !== []) {
                $findings[] = ['level' => 'warning', 'text' => "{$host['host']} points at ".implode(', ', $host['addresses']).', which is none of your servers.'];
            }
        }

        $email = $row['email'];

        if ($email && $row['kind'] === 'registered' && $email['grade'] === 'F') {
            $findings[] = [
                'level' => $email['mx'] ? 'warning' : 'info',
                'text' => 'No SPF record: anyone can send mail as @'.$row['name'].'.',
            ];
        }

        if ($row['kind'] === 'registered' && $row['expiry_source'] === null) {
            $findings[] = ['level' => 'info', 'text' => 'No renewal date: its registry has no RDAP. Add the domain in Costs to track it.'];
        }

        $order = ['critical' => 0, 'warning' => 1, 'info' => 2];
        usort($findings, fn ($a, $b) => $order[$a['level']] <=> $order[$b['level']]);

        return $findings;
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<string, mixed>
     */
    private function summary(Collection $rows): array
    {
        $registered = $rows->where('kind', 'registered');
        $nextRenewal = $registered->filter(fn ($r) => $r['days_to_expiry'] !== null && $r['days_to_expiry'] >= 0)->sortBy('days_to_expiry')->first();
        $soonestCert = $rows->flatMap(fn ($r) => collect($r['hosts'])->filter(fn ($h) => $h['certificate'])->map(fn ($h) => ['host' => $h['host'], 'days' => $h['certificate']['days_left'], 'issuer' => $h['certificate']['issuer']]))
            ->sortBy('days')->first();
        $findings = $rows->flatMap(fn ($r) => $r['findings']);
        $hosts = $rows->flatMap(fn ($r) => $r['hosts']);

        return [
            'domains' => $rows->count(),
            'registered' => $registered->count(),
            'platform' => $rows->where('kind', 'platform')->count(),
            'hosts' => $hosts->count(),
            'yearly_cents' => (int) $rows->sum(fn ($r) => $r['cost']['yearly_cents'] ?? 0),
            'next_renewal' => $nextRenewal ? ['name' => $nextRenewal['name'], 'days' => $nextRenewal['days_to_expiry'], 'date' => $nextRenewal['expires_at']] : null,
            'soonest_certificate' => $soonestCert,
            'critical' => $findings->where('level', 'critical')->count(),
            'warnings' => $findings->where('level', 'warning')->count(),
            'providers' => $registered->countBy(fn ($r) => $r['dns_provider'] ?? 'Unknown')->sortDesc()->all(),
            'issuers' => $hosts->filter(fn ($h) => $h['certificate'])->countBy(fn ($h) => $h['certificate']['issuer'] ?? 'Unknown')->sortDesc()->all(),
            'proxied' => $hosts->where('proxied', true)->count(),
            'email_grades' => $registered->filter(fn ($r) => $r['email'])->countBy(fn ($r) => $r['email']['grade'])->sortKeys()->all(),
        ];
    }

    /**
     * The next twelve months: what renews when, and what it costs.
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return list<array{month: string, cents: int, events: list<array<string, mixed>>}>
     */
    private function radar(Collection $rows, CarbonImmutable $today): array
    {
        $months = collect(range(0, 11))->mapWithKeys(fn ($i) => [
            $today->startOfMonth()->addMonths($i)->format('Y-m') => ['month' => $today->startOfMonth()->addMonths($i)->format('Y-m'), 'cents' => 0, 'events' => []],
        ])->all();

        $end = $today->startOfMonth()->addMonths(12);

        foreach ($rows as $row) {
            if ($row['expires_at']) {
                $date = CarbonImmutable::parse($row['expires_at']);

                // Registrations renew a year at a time: walk forward into the window.
                while ($date->lt($today)) {
                    $date = $date->addYear();
                }

                if ($date->lt($end)) {
                    $key = $date->format('Y-m');
                    $cents = $row['cost'] ? (int) $row['cost']['yearly_cents'] : 0;
                    $months[$key]['cents'] += $cents;
                    $months[$key]['events'][] = ['type' => 'renewal', 'name' => $row['name'], 'date' => $date->toDateString(), 'cents' => $cents];
                }
            }

            foreach ($row['hosts'] as $host) {
                $expires = $host['certificate']['expires_at'] ?? null;

                if ($expires && CarbonImmutable::parse($expires)->between($today, $end)) {
                    $months[CarbonImmutable::parse($expires)->format('Y-m')]['events'][] = [
                        'type' => 'certificate',
                        'name' => $host['host'],
                        'date' => CarbonImmutable::parse($expires)->toDateString(),
                        'cents' => 0,
                    ];
                }
            }
        }

        return array_values(array_map(function ($month) {
            usort($month['events'], fn ($a, $b) => $a['date'] <=> $b['date']);

            return $month;
        }, $months));
    }

    /**
     * Uptime checks per app and day, for the last 30 days. Cached briefly:
     * it reads the whole window of checks.
     *
     * @param  list<int>  $projectIds
     * @return array<int, array<string, array{n: int, up: int, ms: float|null}>>
     */
    private function uptimeByProject(Team $team, array $projectIds, CarbonImmutable $today): array
    {
        if ($projectIds === []) {
            return [];
        }

        return Cache::remember("domains:uptime:{$team->id}:{$today->toDateString()}:".md5(implode(',', $projectIds)), 600, function () use ($projectIds, $today) {
            $rows = DB::table('uptime_checks')
                ->selectRaw("project_id, date(checked_at) as day, count(*) as n, sum(case when status = 'up' then 1 else 0 end) as up, avg(response_time) as ms")
                ->whereIn('project_id', $projectIds)
                ->where('checked_at', '>=', $today->subDays(self::UPTIME_DAYS - 1))
                ->groupBy('project_id', DB::raw('date(checked_at)'))
                ->get();

            $byProject = [];

            foreach ($rows as $row) {
                $byProject[(int) $row->project_id][substr((string) $row->day, 0, 10)] = [
                    'n' => (int) $row->n,
                    'up' => (int) $row->up,
                    'ms' => $row->ms === null ? null : (float) $row->ms,
                ];
            }

            return $byProject;
        });
    }

    /**
     * @param  list<int>  $projectIds
     * @param  array<int, array<string, array{n: int, up: int, ms: float|null}>>  $uptime
     * @return list<array{date: string, ratio: float|null, ms: int|null, checks: int}>
     */
    private function dailyUptime(array $projectIds, array $uptime, CarbonImmutable $today): array
    {
        $days = [];

        for ($i = self::UPTIME_DAYS - 1; $i >= 0; $i--) {
            $date = $today->subDays($i)->toDateString();
            $n = $up = 0;
            $msWeighted = 0.0;

            foreach ($projectIds as $id) {
                $cell = $uptime[$id][$date] ?? null;

                if ($cell) {
                    $n += $cell['n'];
                    $up += $cell['up'];
                    $msWeighted += ($cell['ms'] ?? 0) * $cell['n'];
                }
            }

            $days[] = [
                'date' => $date,
                'ratio' => $n > 0 ? round($up / $n, 5) : null,
                'ms' => $n > 0 ? (int) round($msWeighted / $n) : null,
                'checks' => $n,
            ];
        }

        return $days;
    }
}
