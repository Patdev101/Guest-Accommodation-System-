<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use App\Enums\BilledTo;
use App\Enums\PaymentType;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $stay_id
 * @property int|null $reservation_id
 * @property string $amount
 * @property PaymentType $payment_type
 * @property BilledTo $paid_by
 * @property string $method
 * @property string|null $receipt_number
 * @property int $received_by
 * @property CarbonImmutable $paid_at
 * @property-read User $receiver
 */
#[Fillable([
    'stay_id', 'reservation_id', 'amount', 'payment_type', 'paid_by', 'method',
    'receipt_number', 'received_by', 'paid_at',
])]
class Payment extends Model
{
    use CastsKeysToIntegers, LogsActivity;

    /**
     * How money can be received (and refunded) at the front desk. The Admin
     * manages the list in Options; old payments keep whatever method they had.
     *
     * @return list<string>
     */
    public static function methods(): array
    {
        $names = array_map('trim', explode(',', (string) Setting::get('payment_methods')));

        return array_values(array_unique(array_filter($names, fn (string $name) => $name !== '')));
    }

    public function activityLabel(): string
    {
        $for = $this->reservation_id !== null ? "reservation #{$this->reservation_id}" : "stay #{$this->stay_id}";

        return 'payment of ₱'.number_format((float) $this->amount, 2)." ({$this->method}) on {$for}";
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'payment_type' => PaymentType::class,
            'paid_by' => BilledTo::class,
            'paid_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Stay, $this> */
    public function stay(): BelongsTo
    {
        return $this->belongsTo(Stay::class);
    }

    /** @return BelongsTo<Reservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
