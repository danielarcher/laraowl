<?php

namespace App\Support;

/**
 * Splits a host into the domain someone registered and pays for.
 *
 * A short list of public suffixes covers the TLDs in use; hosts on a hosting
 * platform's domain (laraowl.on-forge.com) are their own "platform" domain,
 * since nobody on the team registered on-forge.com.
 */
final class RegistrableDomain
{
    /** Second-level suffixes sold as if they were TLDs. */
    private const MULTI_PART_SUFFIXES = [
        'com.br', 'net.br', 'org.br', 'co.uk', 'org.uk', 'me.uk', 'com.au', 'net.au',
        'co.nz', 'co.za', 'com.mx', 'com.ar', 'co.jp', 'com.pt', 'co.in', 'com.tr',
    ];

    /** Platforms that hand out subdomains. */
    private const PLATFORM_SUFFIXES = [
        'on-forge.com', 'laravel.cloud', 'vercel.app', 'netlify.app', 'herokuapp.com',
        'pages.dev', 'workers.dev', 'github.io', 'fly.dev', 'onrender.com', 'ondigitalocean.app',
    ];

    /**
     * @return array{name: string, kind: 'registered'|'platform'}|null
     */
    public static function of(?string $host): ?array
    {
        $host = strtolower(trim((string) $host, ". \t\n"));

        if ($host === '' || filter_var($host, FILTER_VALIDATE_IP) || ! str_contains($host, '.')) {
            return null;
        }

        foreach (self::PLATFORM_SUFFIXES as $suffix) {
            if ($host === $suffix) {
                return null;
            }

            if (str_ends_with($host, '.'.$suffix)) {
                return ['name' => $host, 'kind' => 'platform'];
            }
        }

        $labels = explode('.', $host);
        $take = in_array(implode('.', array_slice($labels, -2)), self::MULTI_PART_SUFFIXES, true) ? 3 : 2;

        return ['name' => implode('.', array_slice($labels, -$take)), 'kind' => 'registered'];
    }

    public static function hostOf(?string $url): ?string
    {
        $host = parse_url((string) $url, PHP_URL_HOST);

        return is_string($host) && $host !== '' ? strtolower($host) : null;
    }
}
