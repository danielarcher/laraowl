<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

/**
 * A text filter for the route list. `*` stands for any run of characters
 * and anchors the pattern to the whole path (`/api/*`, `*ideas`); text
 * without `*` matches anywhere in the path. Matching ignores case. A
 * leading HTTP method narrows by method too (`POST /api/*`), and a method
 * on its own matches routes of that method as well as paths holding it.
 */
final class RoutePattern
{
    public const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'ANY'];

    private const MAX_LENGTH = 200;

    /** The escape character for LIKE: one SQLite, Postgres and MySQL all accept. */
    private const ESCAPE = '!';

    private function __construct(
        public readonly string $text,
        private readonly ?string $method,
        private readonly string $path,
        private readonly bool $methodOrPath,
    ) {}

    public static function parse(mixed $value): ?self
    {
        if (! is_string($value)) {
            return null;
        }

        $text = trim(mb_substr($value, 0, self::MAX_LENGTH));

        if ($text === '') {
            return null;
        }

        if (preg_match('/^(\S+)\s+(.*)$/su', $text, $parts) === 1 && in_array(strtoupper($parts[1]), self::METHODS, true)) {
            return new self($text, strtoupper($parts[1]), trim($parts[2]), false);
        }

        if (in_array(strtoupper($text), self::METHODS, true)) {
            return new self($text, strtoupper($text), $text, true);
        }

        return new self($text, null, $text, false);
    }

    /**
     * Keeps the rows whose method and path columns match.
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public function scope(Builder $query, string $methodColumn, string $pathColumn): Builder
    {
        $grammar = $query->getQuery()->getGrammar();
        $method = $grammar->wrap($methodColumn);
        $path = 'LOWER('.$grammar->wrap($pathColumn).') LIKE ? ESCAPE \''.self::ESCAPE.'\'';
        $like = $this->likePattern();

        if ($this->methodOrPath) {
            return $query->where(fn (Builder $either) => $either
                ->whereRaw('UPPER('.$method.') = ?', [$this->method])
                ->orWhereRaw($path, [$like]));
        }

        return $query
            ->when($this->method !== null, fn (Builder $narrowed) => $narrowed->whereRaw('UPPER('.$method.') = ?', [$this->method]))
            ->when($this->path !== '', fn (Builder $narrowed) => $narrowed->whereRaw($path, [$like]));
    }

    /**
     * The same test in PHP, for route lists built from raw records.
     */
    public function matches(?string $method, ?string $path): bool
    {
        $methodMatches = $this->method !== null && strtoupper((string) $method) === $this->method;
        $pathMatches = $this->path === '' || preg_match($this->regex(), (string) $path) === 1;

        if ($this->methodOrPath) {
            return $methodMatches || $pathMatches;
        }

        return ($this->method === null || $methodMatches) && $pathMatches;
    }

    private function anchored(): bool
    {
        return str_contains($this->path, '*');
    }

    private function likePattern(): string
    {
        $escaped = strtr(mb_strtolower($this->path), [
            self::ESCAPE => self::ESCAPE.self::ESCAPE,
            '%' => self::ESCAPE.'%',
            '_' => self::ESCAPE.'_',
        ]);
        $pattern = str_replace('*', '%', $escaped);

        return $this->anchored() ? $pattern : '%'.$pattern.'%';
    }

    private function regex(): string
    {
        $body = implode('.*', array_map(
            fn (string $part) => preg_quote($part, '/'),
            explode('*', $this->path),
        ));

        return $this->anchored() ? '/^'.$body.'$/iu' : '/'.$body.'/iu';
    }
}
