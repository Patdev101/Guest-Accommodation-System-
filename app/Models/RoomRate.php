<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $room_id
 * @property int $rate_unit_id
 * @property string $name
 * @property string $price
 * @property bool $is_extension_rate
 * @property-read RateUnit $unit
 */
#[Fillable(['room_id', 'rate_unit_id', 'name', 'price', 'is_extension_rate'])]
class RoomRate extends Model
{
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'is_extension_rate' => 'boolean',
        ];
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /** @return BelongsTo<RateUnit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(RateUnit::class, 'rate_unit_id');
    }
}
