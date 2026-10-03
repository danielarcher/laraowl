<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * The grid a chart draws on: how many seconds one point covers and which
 * points a period holds. Points are numbered by unix time divided by the
 * slot width, so SQL can group rows straight onto them.
 */
final class TimeSlots
{
    /**
     * Seconds per point and points per preset period: a minute grid for the
     * last hour, then about 150 points however long the window is.
     */
    private const PRESETS = [
        '1h' => [60, 60],
        '24h' => [600, 144],
        '7d' => [3600, 168],
        '14d' => [7200, 168],
        '30d' => [14400, 180],
    ];

    private const CUSTOM_POINTS = 150;

    private function __construct(
        public readonly int $slot,
        public readonly int $first,
        public readonly int $last,
    ) {}

    public static function for(?string $period, ?string $from = null, ?string $to = null): self
    {
        if ($period === 'custom' && $from && $to) {
            try {
                $start = Carbon::parse($from);
                $end = Carbon::parse($to);

                if ($start->lt($end)) {
                    $span = (int) $start->diffInSeconds($end, true);
                    $slot = (int) max(60, round($span / self::CUSTOM_POINTS / 60) * 60);

                    return new self($slot, intdiv($start->getTimestamp(), $slot), intdiv($end->getTimestamp(), $slot));
                }
            } catch (Throwable) {
                // An unparseable range falls back to the default grid.
            }
        }

        [$slot, $points] = self::PRESETS[$period] ?? self::PRESETS['24h'];
        $last = intdiv(now()->getTimestamp(), $slot);

        return new self($slot, $last - $points + 1, $last);
    }

    /**
     * Point indexes from oldest to newest.
     *
     * @return list<int>
     */
    public function indexes(): array
    {
        return range($this->first, $this->last);
    }

    /**
     * Whether the window fits in a day, so a clock time is enough of a label.
     */
    public function withinADay(): bool
    {
        return ($this->last - $this->first + 1) * $this->slot <= 86_400;
    }

    /**
     * SQL that maps a timestamp column onto its point index.
     */
    public static function sql(int $slot, string $column): string
    {
        return match (DB::connection()->getDriverName()) {
            'pgsql' => "FLOOR(EXTRACT(EPOCH FROM {$column}) / {$slot})",
            'sqlite' => "(CAST(strftime('%s', {$column}) AS INTEGER) / {$slot})",
            default => "FLOOR(UNIX_TIMESTAMP({$column}) / {$slot})",
        };
    }
}
