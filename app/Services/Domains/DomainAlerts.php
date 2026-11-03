<?php

namespace App\Services\Domains;

use App\Models\Team;
use App\Services\Push\WebPushService;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

/**
 * Pushes a heads-up to the team's devices as a domain registration or a
 * certificate nears its end: once per step, so nobody gets nagged hourly.
 */
class DomainAlerts
{
    /** Days before a registration ends at which to warn. */
    public const REGISTRATION_STEPS = [30, 14, 7, 3, 1];

    /** Certificates renew themselves around 30 days out; these mean they didn't. */
    public const CERTIFICATE_STEPS = [14, 7, 3, 1];

    public function __construct(private WebPushService $push) {}

    /**
     * @param  list<array<string, mixed>>  $rows  DomainService rows.
     * @return int Alerts sent.
     */
    public function send(Team $team, array $rows, string $domainsUrl): int
    {
        $sent = 0;

        foreach ($rows as $row) {
            if ($row['days_to_expiry'] !== null && $row['kind'] === 'registered') {
                $sent += $this->maybe($team, 'registration', $row['name'], $row['expires_at'], $row['days_to_expiry'], self::REGISTRATION_STEPS,
                    "{$row['name']} expires in {$row['days_to_expiry']} days",
                    $row['registrar'] ? "Renew it at {$row['registrar']}." : 'Renew it before it lapses.',
                    $domainsUrl);
            }

            foreach ($row['hosts'] as $host) {
                $certificate = $host['certificate'];

                if ($certificate) {
                    $sent += $this->maybe($team, 'certificate', $host['host'], $certificate['expires_at'], $certificate['days_left'], self::CERTIFICATE_STEPS,
                        "Certificate of {$host['host']} expires in {$certificate['days_left']} days",
                        'It should have renewed by now: check the server.',
                        $domainsUrl);
                }
            }
        }

        return $sent;
    }

    /**
     * @param  list<int>  $steps
     */
    private function maybe(Team $team, string $kind, string $name, ?string $expiresAt, int $days, array $steps, string $title, string $body, string $url): int
    {
        $step = collect($steps)->sort()->first(fn ($s) => $days <= $s);

        if ($step === null || $days < 0) {
            return 0;
        }

        // One alert per step of this expiry date; a renewal moves the date and starts over.
        $key = "domains:alert:{$team->id}:{$kind}:{$name}:".substr((string) $expiresAt, 0, 10).":{$step}";

        if (! Cache::add($key, true, now()->addDays(400))) {
            return 0;
        }

        try {
            $this->push->sendToTeam($team, $title, $body, ['Project' => 'Domains'], $url);
        } catch (RuntimeException) {
            return 0;
        }

        return 1;
    }
}
