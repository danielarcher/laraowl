<?php

namespace App\Services\Domains;

/**
 * Everything the domain scan asks the outside world. One place, so tests
 * can answer instead of the network.
 */
interface DomainProbe
{
    /**
     * IPv4 addresses the host resolves to (empty when it doesn't).
     *
     * @return list<string>
     */
    public function addresses(string $host): array;

    /**
     * @return list<string>
     */
    public function nameservers(string $domain): array;

    /**
     * @return list<string>
     */
    public function txt(string $name): array;

    public function hasMx(string $domain): bool;

    /**
     * The certificate the host serves on 443.
     *
     * @return array{issuer: string|null, valid_from: string, expires_at: string, names: list<string>}|null
     */
    public function certificate(string $host): ?array;

    /**
     * The first answer to https://host/, without following redirects.
     *
     * @return array{status: int, location: string|null}|null
     */
    public function head(string $host): ?array;

    /**
     * Registration data, or null when the TLD has no RDAP service.
     *
     * @return array{registrar: string|null, registered_at: string|null, expires_at: string|null}|null
     */
    public function rdap(string $domain): ?array;
}
