<?php

namespace App\Models;

use App\Enums\BookingChannel;
use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $guest_id
 * @property int $room_id
 * @property int|null $room_rate_id
 * @property int $pax
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property string $total
 * @property ReservationStatus $status
 * @property BookingChannel $booked_via
 * @property int $booked_by
 * @property Carbon|null $cancelled_at
 * @property int|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property-read Guest $guest
 * @property-read Room $room
 */
#[Fillable([
    'guest_id', 'room_id', 'room_rate_id', 'pax', 'starts_at', 'ends_at', 'total', 'status',
    'booked_via', 'booked_by', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
])]
class Reservation extends Model
{
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'total' => 'decimal:2',
            'pax' => 'integer',
            'status' => ReservationStatus::class,
            'booked_via' => BookingChannel::class,
        ];
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

    /** @return BelongsTo<RoomRate, $this> */
    public function rate(): BelongsTo
    {
        return $this->belongsTo(RoomRate::class, 'room_rate_id');
    }

    /** @return BelongsTo<User, $this> */
    public function booker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'booked_by');
    }

    /** @return HasOne<Stay, $this> */
    public function stay(): HasOne
    {
        return $this->hasOne(Stay::class);
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** @return HasMany<Refund, $this> */
    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function amountPaid(): float
    {
        return (float) $this->payments()->sum('amount');
    }

    public function balance(): float
    {
        return max(0, (float) $this->total - $this->amountPaid());
    }

    public function paymentStatus(): PaymentStatus
    {
        return PaymentStatus::for((float) $this->total, $this->amountPaid());
    }
}
