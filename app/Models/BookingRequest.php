<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Enums\BookingRequestStatus;
use App\Enums\GuestType;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A booking a guest asked for online. Reception approves it (it becomes a
 * reservation) or declines it; the rooms are held while it waits.
 *
 * @property int $id
 * @property int $user_id
 * @property string $contact_name
 * @property string $contact_number
 * @property string|null $email
 * @property string|null $company
 * @property string|null $purpose
 * @property GuestType $guest_type
 * @property int $guests
 * @property CarbonImmutable $starts_at
 * @property CarbonImmutable $ends_at
 * @property string $total
 * @property string|null $message
 * @property BookingRequestStatus $status
 * @property CarbonImmutable|null $hold_expires_at
 * @property int|null $decided_by
 * @property CarbonImmutable|null $decided_at
 * @property string|null $decline_reason
 * @property int|null $reservation_id
 * @property CarbonImmutable $created_at
 * @property-read User $user
 * @property-read User|null $decider
 * @property-read Reservation|null $reservation
 * @property-read Collection<int, BookingRequestRoom> $rooms
 */
#[Fillable([
    'user_id', 'contact_name', 'contact_number', 'email', 'company', 'purpose', 'guest_type', 'guests',
    'starts_at', 'ends_at', 'total', 'message', 'status', 'hold_expires_at', 'decided_by', 'decided_at',
    'decline_reason', 'reservation_id',
])]
class BookingRequest extends Model
{
    use CastsKeysToIntegers;

    protected function casts(): array
    {
        return [
            'guests' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'hold_expires_at' => 'datetime',
            'decided_at' => 'datetime',
            'total' => 'decimal:2',
            'status' => BookingRequestStatus::class,
            'guest_type' => GuestType::class,
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    /** @return BelongsTo<Reservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /** @return HasMany<BookingRequestRoom, $this> */
    public function rooms(): HasMany
    {
        return $this->hasMany(BookingRequestRoom::class);
    }

    /**
     * Requests still waiting whose hold has not run out: these keep their rooms.
     *
     * @param  Builder<BookingRequest>  $query
     */
    public function scopeHolding(Builder $query): void
    {
        $query->where('status', BookingRequestStatus::Pending)
            ->where(fn (Builder $query) => $query->whereNull('hold_expires_at')->orWhere('hold_expires_at', '>', now()));
    }

    public function isPending(): bool
    {
        return $this->status === BookingRequestStatus::Pending;
    }
}
