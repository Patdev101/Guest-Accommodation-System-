<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $reservation_id
 * @property int $guest_id
 * @property int $room_id
 * @property int $verification_attempt_id
 * @property int $pax
 * @property Carbon $checked_in_at
 * @property Carbon $expected_check_out_at
 * @property Carbon|null $not_extending_confirmed_at
 * @property Carbon|null $checked_out_at
 * @property int $checked_in_by
 * @property int|null $checked_out_by
 */
#[Fillable([
    'reservation_id', 'guest_id', 'room_id', 'verification_attempt_id', 'pax',
    'checked_in_at', 'expected_check_out_at', 'not_extending_confirmed_at', 'checked_out_at',
    'checked_in_by', 'checked_out_by',
])]
class Stay extends Model
{
    protected function casts(): array
    {
        return [
            'pax' => 'integer',
            'checked_in_at' => 'datetime',
            'expected_check_out_at' => 'datetime',
            'not_extending_confirmed_at' => 'datetime',
            'checked_out_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Reservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /** @return BelongsTo<Guest, $this> */
    public function guest(): BelongsTo
    {
        return $this->belongsTo(Guest::class);
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /** @return BelongsTo<VerificationAttempt, $this> */
    public function verificationAttempt(): BelongsTo
    {
        return $this->belongsTo(VerificationAttempt::class);
    }

    /** @return HasOne<IdCustody, $this> */
    public function idCustody(): HasOne
    {
        return $this->hasOne(IdCustody::class);
    }

    /** @return HasMany<Charge, $this> */
    public function charges(): HasMany
    {
        return $this->hasMany(Charge::class);
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** @return HasMany<Extension, $this> */
    public function extensions(): HasMany
    {
        return $this->hasMany(Extension::class);
    }

    /** @return HasMany<ReminderLog, $this> */
    public function reminderLogs(): HasMany
    {
        return $this->hasMany(ReminderLog::class);
    }

    /**
     * Final bill = room charges + extensions + damages and extras − payments already made,
     * including payments made on the reservation before check-in.
     */
    public function balance(): float
    {
        $charged = (float) $this->charges()->sum('amount');
        $paid = (float) $this->payments()->sum('amount');

        if ($this->reservation_id !== null) {
            $paid += (float) Payment::query()
                ->where('reservation_id', $this->reservation_id)
                ->whereNull('stay_id')
                ->sum('amount');
        }

        return round($charged - $paid, 2);
    }

    /** The room after this stay opens for booking only once the guest confirms they are not extending. */
    public function releasesRoomForBooking(): bool
    {
        return $this->not_extending_confirmed_at !== null || $this->checked_out_at !== null;
    }
}
