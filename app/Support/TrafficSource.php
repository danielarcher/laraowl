<?php

namespace App\Support;

/**
 * Who sent a request, read from its user agent: a person's browser, a search
 * engine, an AI crawler, an uptime monitor, or some other automated client.
 */
class TrafficSource
{
    public const HUMAN = 'human';

    public const SEARCH = 'search';

    public const AI = 'ai';

    public const MONITOR = 'monitor';

    public const BOT = 'bot';

    /**
     * Every source, in the order the dashboard lists them.
     */
    public const ALL = [self::HUMAN, self::SEARCH, self::AI, self::MONITOR, self::BOT];

    /**
     * Crawlers that collect pages for AI models and assistants. Checked
     * first: several also say "bot" or "search".
     */
    private const AI_PATTERN = '/ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|GPTBot|ChatGPT-User|OAI-SearchBot|PerplexityBot|Perplexity-User|CCBot|Bytespider|Amazonbot|Applebot-Extended|Google-Extended|GoogleOther|meta-externalagent|meta-externalfetcher|FacebookBot|cohere-ai|Diffbot|YouBot|MistralAI-User|DuckAssistBot|AI2Bot|Timpibot|ImagesiftBot/i';

    private const SEARCH_PATTERN = '/Googlebot|Google-InspectionTool|Storebot-Google|AdsBot-Google|bingbot|BingPreview|msnbot|YandexBot|YandexImages|Baiduspider|DuckDuckBot|Applebot|Slurp|SeznamBot|Sogou|Exabot|Qwantbot|Qwant|MojeekBot|Naver|Yeti|PetalBot|ia_archiver|archive\.org_bot/i';

    private const MONITOR_PATTERN = '/monitor|uptime|Pingdom|StatusCake|Site24x7|Better ?Stack|Checkly|HetrixTools|Oh ?Dear|healthcheck|ELB-HealthChecker|kube-probe/i';

    /**
     * Anything else that announces itself as software rather than a browser:
     * crawlers, link previews, SEO tools, scripts and HTTP libraries.
     */
    private const BOT_PATTERN = '/bot\b|bot\/|crawl|spider|scrape|externalhit|preview|facebookcatalog|WhatsApp|Slack|Discord|Telegram|Embedly|Headless|PhantomJS|Puppeteer|Playwright|Lighthouse|curl|Wget|python|aiohttp|httpx|okhttp|Go-http-client|Java\/|Apache-HttpClient|axios|node-fetch|undici|Guzzle|libwww|lwp-|Ruby|PHP\/|Dart\/|reqwest|Postman|insomnia|HTTPie|Nmap|masscan|zgrab|Nuclei|sqlmap|Nikto|censys|expanse|Palo Alto|CensysInspect/i';

    public static function classify(?string $userAgent): string
    {
        $userAgent = trim((string) $userAgent);

        // A browser always sends a user agent; a bare or missing one is a script.
        if ($userAgent === '' || $userAgent === '-' || ! str_contains($userAgent, '/')) {
            return self::BOT;
        }

        return match (true) {
            preg_match(self::AI_PATTERN, $userAgent) === 1 => self::AI,
            preg_match(self::MONITOR_PATTERN, $userAgent) === 1 => self::MONITOR,
            preg_match(self::SEARCH_PATTERN, $userAgent) === 1 => self::SEARCH,
            preg_match(self::BOT_PATTERN, $userAgent) === 1 => self::BOT,
            default => self::HUMAN,
        };
    }

    /**
     * The user agent from a request record. Clients send the headers
     * JSON-encoded, each name holding a list of values.
     *
     * @param  array<string, mixed>  $payload
     */
    public static function userAgentFrom(array $payload): string
    {
        $headers = $payload['headers'] ?? null;
        $headers = is_string($headers) ? json_decode($headers, true) : $headers;
        $value = is_array($headers) ? (array_change_key_case($headers)['user-agent'] ?? '') : '';
        $value = is_array($value) ? reset($value) : $value;

        return is_string($value) ? $value : '';
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function forPayload(array $payload): string
    {
        return self::classify(self::userAgentFrom($payload));
    }

    /**
     * The sources a query string asks for, or null for all of them.
     *
     * @return list<string>|null
     */
    public static function parse(mixed $value): ?array
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        $sources = array_values(array_intersect(self::ALL, explode(',', $value)));

        return $sources === [] || count($sources) === count(self::ALL) ? null : $sources;
    }
}
