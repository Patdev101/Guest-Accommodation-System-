<?php

namespace Database\Factories;

use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Location>
 */
class LocationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->randomElement(['Guest Villa', 'Barracks', 'Staff House', 'Lodge']).' '.fake()->unique()->numberBetween(1, 99999),
            'description' => fake()->sentence(),
        ];
    }
}
