<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Enums\BilledTo;
use App\Enums\ChargeType;
use App\Enums\IdCustodyStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A checked-in booking: its rooms, guest list and held ID (owner's check-in form).
 *
 * @property int $id
 * @property int|null $reservation_id
 * @property int $guest_id
 * @property int $verification_attempt_id
 * @property CarbonImmutable $checked_in_at
 * @property CarbonImmutable $expected_check_out_at
 * @property CarbonImmutable|null $not_extending_confirmed_at
 * @property CarbonImmutable|null $checked_out_at
 * @property int $checked_in_by
 * @property int|null $checked_out_by
 * @property-read Guest $guest
 * @property-read Reservation|null $reservation
 * @property-read Collection<int, StayRoom> $rooms
 * @property-read Collection<int, StayGuest> $guests
 * @property-read IdCustody|null $idCustody
 * @property-read User $checkedInBy
 * @property-read User|null $checkedOutBy
 * @property-read Collection<int, Charge> $charges
 */
#[Fillable([
    'reservation_id', 'guest_id', 'verification_attempt_id',
    'checked_in_at', 'expected_check_out_at', 'not_extending_confirmed_at', 'checked_out_at',
    'checked_in_by', 'checked_out_by',
])]
class Stay extends Model
{
    use CastsKeysToIntegers;

    protected function casts(): array
    {
        return [
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

    /** @return HasMany<StayRoom, $this> */
    public function rooms(): HasMany
    {
        return $this->hasMany(StayRoom::class);
    }

    /** @return HasMany<StayGuest, $this> */
    public function guests(): HasMany
    {
        return $this->hasMany(StayGuest::class);
    }

    /** @return BelongsTo<User, $this> */
    public function checkedInBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_in_by');
    }

    /** @return BelongsTo<User, $this> */
    public function checkedOutBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_out_by');
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

        return round($charged - (float) $this->allPayments()->sum('amount') + $this->refundedOverpayment(), 2);
    }

    /** @return HasMany<Refund, $this> */
    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    /** Money given back (or on its way back) because the stay was paid more than its bill. */
    public function refundedOverpayment(): float
    {
        return (float) $this->refunds()->sum('amount');
    }

    /** Paid more than the final bill, and not yet refunded: 0 when nothing is owed back. */
    public function overpaid(): float
    {
        return max(0, -$this->balance());
    }

    /**
     * Payments made on this stay and, before check-in, on its reservation.
     *
     * @return Builder<Payment>
     */
    public function allPayments(): Builder
    {
        return Payment::query()
            ->where(fn (Builder $query) => $query
                ->where('stay_id', $this->id)
                ->when($this->reservation_id, fn (Builder $query) => $query->orWhere(fn (Builder $query) => $query
                    ->where('reservation_id', $this->reservation_id)
                    ->whereNull('stay_id'))));
    }

    public function isCheckedOut(): bool
    {
        return $this->checked_out_at !== null;
    }

    /** Charges go to the company by default (rule 23); a booking without a company is billed to the guest. */
    public function defaultBilledTo(): BilledTo
    {
        $company = $this->reservation_id === null
            ? Guest::query()->whereKey($this->guest_id)->value('company')
            : Reservation::query()->whereKey($this->reservation_id)->value('company');

        return filled($company) ? BilledTo::Company : BilledTo::Guest;
    }

    /**
     * Bill each checked-in room at the price agreed on the reservation, once.
     */
    public function addRoomCharges(User $by): void
    {
        if ($this->reservation_id === null || $this->charges()->where('type', ChargeType::Room)->exists()) {
            return;
        }

        $roomIds = $this->rooms()->pluck('room_id')->all();
        $billedTo = $this->defaultBilledTo();

        $lines = ReservationRoom::query()
            ->where('reservation_id', $this->reservation_id)
            ->whereIn('room_id', $roomIds)
            ->with(['room:id,name', 'rate:id,name'])
            ->get();

        foreach ($lines as $line) {
            $this->charges()->create([
                'reservation_id' => $this->reservation_id,
                'type' => ChargeType::Room,
                'description' => "Room {$line->room->name}".($line->rate ? " ({$line->rate->name})" : ''),
                'amount' => $line->price,
                'billed_to' => $billedTo,
                'created_by' => $by->id,
            ]);
        }
    }

    public function allRoomsInspected(): bool
    {
        return $this->rooms()->whereNull('inspected_at')->doesntExist();
    }

    /**
     * Keep the held ID's status in step with the bill: "Held – pending payment"
     * while money is owed after check-out (rule 24).
     */
    public function refreshIdCustody(): void
    {
        $custody = $this->idCustody()->first();

        if ($custody === null || $custody->status === IdCustodyStatus::Returned) {
            return;
        }

        $status = $this->isCheckedOut() && $this->balance() > 0
            ? IdCustodyStatus::HeldPendingPayment
            : IdCustodyStatus::Held;

        if ($custody->status !== $status) {
            $custody->update(['status' => $status]);
        }
    }

    /** Why the ID cannot be handed back yet, or null when it can (rule 24). */
    public function idReturnBlocker(): ?string
    {
        if (! $this->isCheckedOut()) {
            return __('Check the guests out first.');
        }

        if (! $this->allRoomsInspected()) {
            return __('Inspect every room first; damages may still be added.');
        }

        if ($this->balance() > 0) {
            return __('₱:amount is still unpaid.', ['amount' => number_format($this->balance(), 2)]);
        }

        return null;
    }

    /** The room after this stay opens for booking only once the guest confirms they are not extending. */
    public function releasesRoomForBooking(): bool
    {
        return $this->not_extending_confirmed_at !== null || $this->checked_out_at !== null;
    }
}
