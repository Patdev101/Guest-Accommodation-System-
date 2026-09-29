<?php

namespace Database\Factories;

use App\Enums\RoomStatus;
use App\Models\Location;
use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Room>
 */
class RoomFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'location_id' => Location::factory(),
            'name' => 'Room '.fake()->unique()->numberBetween(1, 9999),
            'pax_capacity' => fake()->numberBetween(1, 8),
            'description' => fake()->sentence(),
            'status' => RoomStatus::Available,
        ];
    }

    public function status(RoomStatus $status): static
    {
        return $this->state(fn (array $attributes) => ['status' => $status]);
    }
}
