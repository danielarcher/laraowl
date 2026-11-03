<?php

namespace App\Services\Domains;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Throwable;

class LiveDomainProbe implements DomainProbe
{
    private const USER_AGENT = 'Mozilla/5.0 (compatible; LaraOwlUptimeBot/1.0; domain monitor)';

    public function addresses(string $host): array
    {
        $records = @dns_get_record($host, DNS_A) ?: [];

        return array_values(array_unique(array_filter(array_column($records, 'ip'))));
    }

    public function nameservers(string $domain): array
    {
        $records = @dns_get_record($domain, DNS_NS) ?: [];
        $names = array_map('strtolower', array_filter(array_column($records, 'target')));
        sort($names);

        return array_values(array_unique($names));
    }

    public function txt(string $name): array
    {
        $records = @dns_get_record($name, DNS_TXT) ?: [];

        return array_values(array_map(
            fn (array $record) => isset($record['entries']) ? implode('', $record['entries']) : (string) ($record['txt'] ?? ''),
            $records,
        ));
    }

    public function hasMx(string $domain): bool
    {
        return (@dns_get_record($domain, DNS_MX) ?: []) !== [];
    }

    public function certificate(string $host): ?array
    {
        $context = stream_context_create(['ssl' => [
            'capture_peer_cert' => true,
            'verify_peer' => false,
            'verify_peer_name' => false,
            'SNI_enabled' => true,
            'peer_name' => $host,
        ]]);

        $client = @stream_socket_client("ssl://{$host}:443", $errno, $error, 6, STREAM_CLIENT_CONNECT, $context);

        if ($client === false) {
            return null;
        }

        $certificate = stream_context_get_params($client)['options']['ssl']['peer_certificate'] ?? null;
        fclose($client);

        $parsed = $certificate ? openssl_x509_parse($certificate) : false;

        if (! $parsed) {
            return null;
        }

        $names = collect(explode(',', (string) ($parsed['extensions']['subjectAltName'] ?? '')))
            ->map(fn ($name) => trim(str_replace('DNS:', '', $name)))
            ->filter()
            ->values()
            ->all();

        return [
            'issuer' => $parsed['issuer']['O'] ?? $parsed['issuer']['CN'] ?? null,
            'valid_from' => Carbon::createFromTimestampUTC($parsed['validFrom_time_t'])->toIso8601String(),
            'expires_at' => Carbon::createFromTimestampUTC($parsed['validTo_time_t'])->toIso8601String(),
            'names' => $names,
        ];
    }

    public function head(string $host): ?array
    {
        try {
            $response = Http::withUserAgent(self::USER_AGENT)
                ->withoutRedirecting()
                ->timeout(8)
                ->get("https://{$host}/");
        } catch (Throwable) {
            return null;
        }

        return ['status' => $response->status(), 'location' => $response->header('Location') ?: null];
    }

    public function rdap(string $domain): ?array
    {
        // Network errors and 5xx bubble up: the scanner marks the lookup failed.
        $response = Http::withUserAgent(self::USER_AGENT)
            ->accept('application/rdap+json')
            ->timeout(12)
            ->get("https://rdap.org/domain/{$domain}");

        if ($response->notFound()) {
            return null;
        }

        $response->throw();
        $events = collect($response->json('events', []))->pluck('eventDate', 'eventAction');

        $registrar = collect($response->json('entities', []))
            ->first(fn ($entity) => in_array('registrar', $entity['roles'] ?? [], true));
        $name = collect($registrar['vcardArray'][1] ?? [])->first(fn ($field) => ($field[0] ?? null) === 'fn')[3] ?? null;

        return [
            'registrar' => $name,
            'registered_at' => $events['registration'] ?? null,
            'expires_at' => $events['expiration'] ?? null,
        ];
    }
}
