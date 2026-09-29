<?php

namespace App\Models;

use App\Enums\BilledTo;
use App\Enums\ChargeType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['stay_id', 'reservation_id', 'type', 'description', 'amount', 'billed_to', 'created_by'])]
class Charge extends Model
{
    protected function casts(): array
    {
        return [
            'type' => ChargeType::class,
            'billed_to' => BilledTo::class,
            'amount' => 'decimal:2',
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
}
