<?php

namespace App\Models;

use App\Enums\ConsentStatus;
use App\Enums\ExtensionStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'stay_id', 'old_check_out_at', 'new_check_out_at', 'price', 'status',
    'requested_by', 'decided_by', 'decided_at', 'denial_reason',
    'affected_reservation_id', 'moved_from_room_id', 'moved_to_room_id',
    'consent_status', 'consent_responded_at', 'consent_recorded_by',
])]
class Extension extends Model
{
    protected function casts(): array
    {
        return [
            'old_check_out_at' => 'datetime',
            'new_check_out_at' => 'datetime',
            'decided_at' => 'datetime',
            'consent_responded_at' => 'datetime',
            'price' => 'decimal:2',
            'status' => ExtensionStatus::class,
            'consent_status' => ConsentStatus::class,
        ];
    }

    /** @return BelongsTo<Stay, $this> */
    public function stay(): BelongsTo
    {
        return $this->belongsTo(Stay::class);
    }

    /**
     * Guest B's reservation, when the room was reserved next.
     *
     * @return BelongsTo<Reservation, $this>
     */
    public function affectedReservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class, 'affected_reservation_id');
    }

    /** @return BelongsTo<Room, $this> */
    public function movedToRoom(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'moved_to_room_id');
    }
}
