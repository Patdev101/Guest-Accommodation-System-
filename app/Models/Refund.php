<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use App\Enums\RefundStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $reservation_id
 * @property int|null $payment_id
 * @property string $amount
 * @property string $reason
 * @property RefundStatus $status
 * @property int $requested_by
 * @property CarbonImmutable $requested_at
 * @property int|null $processed_by
 * @property CarbonImmutable|null $processing_at
 * @property int|null $refunded_by
 * @property CarbonImmutable|null $refunded_at
 * @property-read Reservation|null $reservation
 * @property-read Payment|null $payment
 * @property-read User $requester
 * @property-read User|null $processor
 * @property-read User|null $refunder
 */
#[Fillable([
    'reservation_id', 'payment_id', 'amount', 'reason', 'status',
    'requested_by', 'requested_at', 'processed_by', 'processing_at', 'refunded_by', 'refunded_at',
])]
class Refund extends Model
{
    use CastsKeysToIntegers, LogsActivity;

    public function activityLabel(): string
    {
        return 'refund of ₱'.number_format((float) $this->amount, 2)." for reservation #{$this->reservation_id}";
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    protected function activityUpdateDescription(array $changes): string
    {
        return array_key_exists('status', $changes)
            ? ucfirst($this->activityLabel()).' is now '.$this->status->label()
            : 'Updated '.$this->activityLabel();
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'status' => RefundStatus::class,
            'requested_at' => 'datetime',
            'processing_at' => 'datetime',
            'refunded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Reservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /** @return BelongsTo<Payment, $this> */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /** @return BelongsTo<User, $this> */
    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    /** @return BelongsTo<User, $this> */
    public function refunder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'refunded_by');
    }
}
