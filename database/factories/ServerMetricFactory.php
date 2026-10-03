<?php

namespace Database\Factories;

use App\Models\Server;
use App\Models\ServerMetric;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ServerMetric>
 */
class ServerMetricFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $recordedAt = now()->startOfMinute();
        $gigabyte = 1024 ** 3;

        return [
            'server_id' => Server::factory(),
            'recorded_at' => $recordedAt,
            'recorded_ts' => $recordedAt->getTimestamp(),
            'cpu_percent' => $this->faker->randomFloat(2, 0, 100),
            'load_1' => $this->faker->randomFloat(2, 0, 4),
            'load_5' => $this->faker->randomFloat(2, 0, 4),
            'load_15' => $this->faker->randomFloat(2, 0, 4),
            'memory_total' => 2 * $gigabyte,
            'memory_used' => $gigabyte,
            'swap_total' => $gigabyte,
            'swap_used' => 0,
            'disk_total' => 50 * $gigabyte,
            'disk_used' => 20 * $gigabyte,
            'disks' => [['mount' => '/', 'total' => 50 * $gigabyte, 'used' => 20 * $gigabyte]],
            'uptime_seconds' => 3600,
        ];
    }

    /**
     * A sample taken the given number of minutes ago.
     */
    public function minutesAgo(int $minutes): static
    {
        return $this->state(function () use ($minutes) {
            $recordedAt = now()->startOfMinute()->subMinutes($minutes);

            return [
                'recorded_at' => $recordedAt,
                'recorded_ts' => $recordedAt->getTimestamp(),
            ];
        });
    }
}
