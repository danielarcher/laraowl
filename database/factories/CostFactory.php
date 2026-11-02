<?php

namespace Database\Factories;

use App\Enums\CostCategory;
use App\Enums\CostInterval;
use App\Models\Cost;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Cost>
 */
class CostFactory extends Factory
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
            'server_id' => null,
            'name' => fake()->words(2, true),
            'category' => CostCategory::Service,
            'amount_cents' => fake()->numberBetween(100, 5000),
            'currency' => 'USD',
            'interval' => CostInterval::Monthly,
        ];
    }
}
