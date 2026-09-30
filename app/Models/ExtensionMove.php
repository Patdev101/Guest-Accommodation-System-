<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Enums\ConsentStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Guest B's room that an extension needs (rule 20): the other room offered,
 * and Guest B's answer, recorded by reception after a call.
 *
 * @property int $id
 * @property int $extension_id
 * @property int $reservation_room_id
 * @property int $from_room_id
 * @property int|null $to_room_id
 * @property ConsentStatus $consent_status
 * @property CarbonImmutable|null $consent_responded_at
 * @property int|null $consent_recorded_by
 * @property-read ReservationRoom $reservationRoom
 * @property-read Room $fromRoom
 * @property-read Room|null $toRoom
 */
#[Fillable(['extension_id', 'reservation_room_id', 'from_room_id', 'to_room_id', 'consent_status', 'consent_responded_at', 'consent_recorded_by'])]
class ExtensionMove extends Model
{
    use CastsKeysToIntegers;

    protected function casts(): array
    {
        return [
            'consent_status' => ConsentStatus::class,
            'consent_responded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Extension, $this> */
    public function extension(): BelongsTo
    {
        return $this->belongsTo(Extension::class);
    }

    /** @return BelongsTo<ReservationRoom, $this> */
    public function reservationRoom(): BelongsTo
    {
        return $this->belongsTo(ReservationRoom::class);
    }

    /** @return BelongsTo<Room, $this> */
    public function fromRoom(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'from_room_id');
    }

    /** @return BelongsTo<Room, $this> */
    public function toRoom(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'to_room_id');
    }
}
