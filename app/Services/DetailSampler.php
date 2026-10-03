<?php

namespace App\Services;

/**
 * Decides which of a batch's detail records (queries, cache events, outgoing
 * calls) are stored as raw rows.
 *
 * The rollups count every record whatever is decided here, so the charts,
 * totals and per-query lists stay exact. Raw detail rows only serve the trace
 * view and a query's example list, and they are most of what an app sends.
 * They are kept for the requests and commands worth opening (slow, failed or
 * with an exception), for a fixed sample of the rest, and on their own when
 * the query or call itself was slow.
 *
 * The client sends a request's records together, tagged with one trace id,
 * so a batch can be judged trace by trace.
 */
class DetailSampler
{
    public const DETAIL_TYPES = ['query', 'cache-event', 'outgoing-request'];

    /**
     * Records whose outcome decides whether their trace's detail is kept.
     */
    private const PARENT_TYPES = ['request', 'command', 'scheduled-task', 'job-attempt', 'queued-job'];

    /**
     * A trace sending this much detail in one batch is worth keeping however
     * fast it was: that is what an N+1 looks like. Large traces also arrive
     * split across batches, without their request to judge them by.
     */
    private const HEAVY_TRACE = 200;

    /**
     * Raw detail rows kept per trace and batch, slow ones always included.
     */
    private const MAX_PER_TRACE = 250;

    public function __construct(private RollupWriter $rollups) {}

    /**
     * @param  array<int, array<string, mixed>>  $records
     * @return array{keep: array<int, bool>, dropped: array<string, array<string, int>>}
     */
    public function plan(array $records): array
    {
        $keep = array_fill_keys(array_keys($records), true);
        $dropped = [];
        $rate = (float) config('laraowl.raw_detail.sample_rate', 1.0);

        if ($rate >= 1.0) {
            return ['keep' => $keep, 'dropped' => $dropped];
        }

        $traces = [];

        foreach ($records as $index => $data) {
            $type = $data['t'] ?? null;
            $key = $this->rollups->traceIdFor($data) ?? '';
            $traces[$key] ??= ['interesting' => false, 'detail' => []];

            if (in_array($type, self::DETAIL_TYPES, true)) {
                $traces[$key]['detail'][] = $index;
            } elseif ($type === 'exception' || (in_array($type, self::PARENT_TYPES, true) && $this->worthOpening($type, $data))) {
                $traces[$key]['interesting'] = true;
            }
        }

        foreach ($traces as $key => $trace) {
            $whole = $trace['interesting']
                || count($trace['detail']) >= self::HEAVY_TRACE
                || $this->sampled((string) $key, $rate);
            $kept = 0;

            foreach ($trace['detail'] as $index) {
                $data = $records[$index];

                if ($this->slowOnItsOwn($data['t'], $data) || ($whole && $kept < self::MAX_PER_TRACE)) {
                    $kept++;

                    continue;
                }

                $keep[$index] = false;
                $dropped[$key][$data['t']] = ($dropped[$key][$data['t']] ?? 0) + 1;
            }
        }

        return ['keep' => $keep, 'dropped' => $dropped];
    }

    /**
     * Whether a request, command or job is one someone would open: it failed
     * or took longer than its threshold.
     *
     * @param  array<string, mixed>  $data
     */
    private function worthOpening(string $type, array $data): bool
    {
        if (($this->rollups->deltasFor($type, $data)['server_error_count'] ?? 0) > 0) {
            return true;
        }

        $slowMs = $type === 'request'
            ? config('laraowl.raw_detail.slow_request_ms', 500)
            : config('laraowl.raw_detail.slow_task_ms', 10_000);

        return $this->durationUs($data) >= $slowMs * 1000;
    }

    /**
     * A slow query or a slow or failed outgoing call is kept regardless of
     * the request around it.
     *
     * @param  array<string, mixed>  $data
     */
    private function slowOnItsOwn(string $type, array $data): bool
    {
        return match ($type) {
            'query' => $this->durationUs($data) >= config('laraowl.raw_detail.slow_query_ms', 100) * 1000,
            'outgoing-request' => $this->durationUs($data) >= config('laraowl.raw_detail.slow_outgoing_ms', 1000) * 1000
                || ($this->rollups->deltasFor($type, $data)['server_error_count'] ?? 0) > 0,
            default => false,
        };
    }

    /**
     * The same trace is always in or always out, so a retried batch and the
     * split parts of a large trace agree.
     */
    private function sampled(string $traceId, float $rate): bool
    {
        if ($rate <= 0.0) {
            return false;
        }

        if ($traceId === '') {
            return mt_rand() / mt_getrandmax() < $rate;
        }

        return crc32($traceId) / 0xFFFFFFFF < $rate;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function durationUs(array $data): float
    {
        return is_numeric($data['duration'] ?? null) ? (float) $data['duration'] : 0.0;
    }
}
