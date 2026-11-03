<?php

namespace Tests\Fakes;

use App\Services\Domains\DomainProbe;
use RuntimeException;

/**
 * Answers the domain scan from arrays instead of DNS, TLS and RDAP.
 */
class FakeDomainProbe implements DomainProbe
{
    /** @var array<string, list<string>> */
    public array $addresses = [];

    /** @var array<string, list<string>> */
    public array $nameservers = [];

    /** @var array<string, list<string>> */
    public array $txt = [];

    /** @var array<string, bool> */
    public array $mx = [];

    /** @var array<string, array<string, mixed>|null> */
    public array $certificates = [];

    /** @var array<string, array{status: int, location: string|null}> */
    public array $heads = [];

    /** @var array<string, array<string, mixed>|null|'fail'> */
    public array $rdap = [];

    public int $rdapCalls = 0;

    public function addresses(string $host): array
    {
        return $this->addresses[$host] ?? [];
    }

    public function nameservers(string $domain): array
    {
        return $this->nameservers[$domain] ?? [];
    }

    public function txt(string $name): array
    {
        return $this->txt[$name] ?? [];
    }

    public function hasMx(string $domain): bool
    {
        return $this->mx[$domain] ?? false;
    }

    public function certificate(string $host): ?array
    {
        return $this->certificates[$host] ?? null;
    }

    public function head(string $host): ?array
    {
        return $this->heads[$host] ?? ['status' => 200, 'location' => null];
    }

    public function rdap(string $domain): ?array
    {
        $this->rdapCalls++;
        $answer = $this->rdap[$domain] ?? null;

        if ($answer === 'fail') {
            throw new RuntimeException('RDAP down');
        }

        return $answer;
    }

    /**
     * A healthy Let's Encrypt certificate for the host, $days from expiry.
     */
    public static function cert(string $host, int $days = 60): array
    {
        return [
            'issuer' => "Let's Encrypt",
            'valid_from' => now()->addDays($days - 90)->toIso8601String(),
            'expires_at' => now()->addDays($days)->toIso8601String(),
            'names' => [$host],
        ];
    }
}
