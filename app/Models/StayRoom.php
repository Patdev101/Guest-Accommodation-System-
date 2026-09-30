<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A room a checked-in booking is using, how many guests are in it, and its
 * inspection after check-out.
 *
 * @property int $id
 * @property int $stay_id
 * @property int $room_id
 * @property int $pax
 * @property CarbonImmutable|null $inspected_at
 * @property int|null $inspected_by
 * @property-read Stay $stay
 * @property-read Room $room
 * @property-read User|null $inspector
 */
#[Fillable(['stay_id', 'room_id', 'pax', 'inspected_at', 'inspected_by'])]
class StayRoom extends Model
{
    use CastsKeysToIntegers;

    protected function casts(): array
    {
        return [
            'pax' => 'integer',
            'inspected_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Stay, $this> */
    public function stay(): BelongsTo
    {
        return $this->belongsTo(Stay::class);
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /** @return BelongsTo<User, $this> */
    public function inspector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'inspected_by');
    }
}
