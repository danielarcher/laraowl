<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Servers\StoreServerMetricRequest;
use App\Models\Server;
use Illuminate\Http\JsonResponse;

class ServerMetricController extends Controller
{
    /**
     * Store one agent sample and refresh the server's identity.
     *
     * Samples are written inline: one small row per server per minute doesn't
     * need the queue, and keeping it synchronous means a sample is never lost
     * to a stalled worker.
     */
    public function __invoke(StoreServerMetricRequest $request): JsonResponse
    {
        /** @var Server $server */
        $server = $request->attributes->get('server');

        $sample = $request->validated();
        $disks = $this->normalizeDisks($sample['disks']);
        $rootDisk = $this->rootDisk($disks);
        $now = now()->startOfMinute();

        $memoryTotal = (int) $sample['memory']['total'];
        $swapTotal = (int) ($sample['swap']['total'] ?? 0);

        $server->metrics()->updateOrCreate(
            ['recorded_ts' => $now->getTimestamp()],
            [
                'recorded_at' => $now,
                'cpu_percent' => round((float) $sample['cpu_percent'], 2),
                'load_1' => (float) $sample['load'][0],
                'load_5' => (float) $sample['load'][1],
                'load_15' => (float) $sample['load'][2],
                'memory_total' => $memoryTotal,
                'memory_used' => max(0, $memoryTotal - (int) $sample['memory']['available']),
                'swap_total' => $swapTotal,
                'swap_used' => max(0, $swapTotal - (int) ($sample['swap']['free'] ?? $swapTotal)),
                'disk_total' => $rootDisk['total'],
                'disk_used' => $rootDisk['used'],
                'disks' => $disks,
                'uptime_seconds' => isset($sample['uptime']) ? (int) $sample['uptime'] : null,
            ],
        );

        $server->forceFill([
            'hostname' => $sample['hostname'] ?? $server->hostname,
            'os' => $sample['os'] ?? $server->os,
            'cpu_count' => $sample['cpu_count'] ?? $server->cpu_count,
            'ip_address' => $request->ip(),
            'last_seen_at' => now(),
        ])->save();

        return response()->json(['message' => 'Sample stored.'], 200);
    }

    /**
     * @param  array<int, array{mount: string, total: int|string, used: int|string}>  $disks
     * @return list<array{mount: string, total: int, used: int}>
     */
    private function normalizeDisks(array $disks): array
    {
        return array_values(array_map(fn (array $disk) => [
            'mount' => (string) $disk['mount'],
            'total' => (int) $disk['total'],
            'used' => (int) $disk['used'],
        ], $disks));
    }

    /**
     * The root filesystem, or the largest one when `/` wasn't reported.
     *
     * @param  list<array{mount: string, total: int, used: int}>  $disks
     * @return array{mount: string, total: int, used: int}
     */
    private function rootDisk(array $disks): array
    {
        foreach ($disks as $disk) {
            if ($disk['mount'] === '/') {
                return $disk;
            }
        }

        usort($disks, fn (array $a, array $b) => $b['total'] <=> $a['total']);

        return $disks[0];
    }
}
