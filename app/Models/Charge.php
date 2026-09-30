<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use App\Enums\BilledTo;
use App\Enums\ChargeType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line on a bill: a room, an extension, a damage or an extra (rule 25).
 *
 * @property int $id
 * @property int|null $stay_id
 * @property int|null $reservation_id
 * @property ChargeType $type
 * @property string $description
 * @property string $amount
 * @property BilledTo $billed_to
 * @property int $created_by
 */
#[Fillable(['stay_id', 'reservation_id', 'type', 'description', 'amount', 'billed_to', 'created_by'])]
class Charge extends Model
{
    use CastsKeysToIntegers, LogsActivity;

    protected function casts(): array
    {
        return [
            'type' => ChargeType::class,
            'billed_to' => BilledTo::class,
            'amount' => 'decimal:2',
        ];
    }

    public function activityLabel(): string
    {
        return strtolower($this->type->label())." charge \"{$this->description}\" of ₱".number_format((float) $this->amount, 2)." on stay #{$this->stay_id}";
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    protected function activityUpdateDescription(array $changes): string
    {
        return array_keys($changes) === ['billed_to']
            ? 'Billed '.$this->activityLabel().' to the '.strtolower($this->billed_to->label())
            : 'Updated '.$this->activityLabel();
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
}
