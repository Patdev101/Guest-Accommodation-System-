<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use App\Enums\BookingChannel;
use App\Enums\PaymentStatus;
use App\Enums\RefundStatus;
use App\Enums\ReservationStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A booking: one contact person (the guest), one or more rooms, one set of dates.
 *
 * @property int $id
 * @property int $guest_id
 * @property string|null $company
 * @property string|null $purpose
 * @property CarbonImmutable $starts_at
 * @property CarbonImmutable $ends_at
 * @property string $total
 * @property ReservationStatus $status
 * @property BookingChannel $booked_via
 * @property int $booked_by
 * @property CarbonImmutable|null $cancelled_at
 * @property int|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property CarbonImmutable $created_at
 * @property string|null $payments_sum_amount
 * @property int|null $rooms_sum_pax
 * @property-read Guest $guest
 * @property-read Collection<int, ReservationRoom> $rooms
 * @property-read User $booker
 * @property-read User|null $canceller
 */
#[Fillable([
    'guest_id', 'company', 'purpose', 'starts_at', 'ends_at', 'total', 'status',
    'booked_via', 'booked_by', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
])]
class Reservation extends Model
{
    use CastsKeysToIntegers, LogsActivity;

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'total' => 'decimal:2',
            'status' => ReservationStatus::class,
            'booked_via' => BookingChannel::class,
        ];
    }

    public function activityLabel(): string
    {
        return "reservation #{$this->id} (".Guest::query()->whereKey($this->guest_id)->value('name').')';
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    protected function activityUpdateDescription(array $changes): string
    {
        if (! array_key_exists('status', $changes)) {
            return 'Updated '.$this->activityLabel();
        }

        return match ($this->status) {
            ReservationStatus::Cancelled => 'Cancelled '.$this->activityLabel(),
            ReservationStatus::NoShow => 'Marked '.$this->activityLabel().' as a no-show',
            ReservationStatus::CheckedIn => 'Checked in '.$this->activityLabel(),
            ReservationStatus::CheckedOut => 'Checked out '.$this->activityLabel(),
            ReservationStatus::Active => 'Reopened '.$this->activityLabel(),
        };
    }

    /** @return BelongsTo<Guest, $this> */
    public function guest(): BelongsTo
    {
        return $this->belongsTo(Guest::class);
    }

    /** @return HasMany<ReservationRoom, $this> */
    public function rooms(): HasMany
    {
        return $this->hasMany(ReservationRoom::class);
    }

    /** @return BelongsTo<User, $this> */
    public function booker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'booked_by');
    }

    /** @return BelongsTo<User, $this> */
    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
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

    public function isActive(): bool
    {
        return $this->status === ReservationStatus::Active;
    }

    /**
     * A note for the guest about how the booking ended: who cancelled it,
     * when and why. Null while the booking is fine.
     */
    public function noteForGuest(): ?string
    {
        if ($this->status === ReservationStatus::NoShow) {
            return __('Marked as a no-show: nobody arrived for this booking.');
        }

        if ($this->status !== ReservationStatus::Cancelled) {
            return null;
        }

        $who = $this->canceller?->isStaff() === false ? __('Cancelled by you') : __('Cancelled by the front desk');
        $when = $this->cancelled_at ? ' '.__('on :date', ['date' => $this->cancelled_at->format('j M Y')]) : '';
        $why = filled($this->cancellation_reason) ? ' '.__('Reason: :reason', ['reason' => $this->cancellation_reason]) : '';

        return $who.$when.'.'.$why;
    }

    /** Reception may mark a no-show once the grace period after the reserved time has passed (rule 17). */
    public function noShowAllowedFrom(): CarbonImmutable
    {
        return $this->starts_at->copy()->addMinutes((int) Setting::get('no_show_grace_minutes'));
    }

    /**
     * Ask for money back on every payment made: $percent of each (rules 16 and 17).
     *
     * @return int How many refunds were requested.
     */
    public function requestRefunds(int $percent, string $reason, User $by): int
    {
        $count = 0;

        foreach ($this->payments()->get() as $payment) {
            $amount = round((float) $payment->amount * $percent / 100, 2);

            if ($amount <= 0) {
                continue;
            }

            $this->refunds()->create([
                'payment_id' => $payment->id,
                'amount' => $amount,
                'reason' => $reason,
                'status' => RefundStatus::Requested,
                'requested_by' => $by->id,
                'requested_at' => now(),
            ]);
            $count++;
        }

        return $count;
    }
}
