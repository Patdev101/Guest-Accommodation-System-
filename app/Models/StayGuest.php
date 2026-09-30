<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One person on a check-in's guest list, and the room they are in.
 *
 * @property int $id
 * @property int $stay_id
 * @property int $room_id
 * @property string $name
 * @property string|null $address
 * @property string|null $contact_number
 * @property-read Room $room
 */
#[Fillable(['stay_id', 'room_id', 'name', 'address', 'contact_number'])]
class StayGuest extends Model
{
    use CastsKeysToIntegers;

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
}
