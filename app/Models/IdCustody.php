<?php

namespace App\Models;

use App\Enums\IdCustodyStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['stay_id', 'id_type', 'id_number', 'status', 'received_by', 'returned_at', 'returned_by'])]
class IdCustody extends Model
{
    protected $table = 'id_custody';

    protected function casts(): array
    {
        return [
            'status' => IdCustodyStatus::class,
            'returned_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Stay, $this> */
    public function stay(): BelongsTo
    {
        return $this->belongsTo(Stay::class);
    }
}
