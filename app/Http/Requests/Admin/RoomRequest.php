<?php

namespace App\Http\Requests\Admin;

use App\Models\Location;
use App\Models\Room;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RoomRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Room|null $room */
        $room = $this->route('room');

        return [
            'location_id' => ['required', 'integer', Rule::exists(Location::class, 'id')],
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique(Room::class)
                    ->where('location_id', $this->integer('location_id'))
                    ->ignore($room),
            ],
            'pax_capacity' => ['required', 'integer', 'min:1', 'max:100'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'location_id' => 'location',
            'pax_capacity' => 'pax capacity',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'This location already has a room with this name.',
        ];
    }
}
