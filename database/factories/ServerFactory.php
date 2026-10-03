<?php

namespace Database\Factories;

use App\Models\Server;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Server>
 */
class ServerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'name' => $this->faker->unique()->domainWord(),
            'api_token' => Str::random(64),
            'hostname' => $this->faker->domainWord(),
            'ip_address' => $this->faker->ipv4(),
            'os' => 'Ubuntu 24.04 LTS',
            'cpu_count' => 2,
            'last_seen_at' => now(),
        ];
    }

    /**
     * A server whose agent has never reported.
     */
    public function neverSeen(): static
    {
        return $this->state(fn () => [
            'hostname' => null,
            'ip_address' => null,
            'os' => null,
            'cpu_count' => null,
            'last_seen_at' => null,
        ]);
    }
}
