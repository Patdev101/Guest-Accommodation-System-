<?php

namespace App\Models;

use App\Enums\ReminderResult;
use App\Enums\ReminderType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['stay_id', 'type', 'sent_at', 'result', 'notes', 'logged_by'])]
class ReminderLog extends Model
{
    protected function casts(): array
    {
        return [
            'type' => ReminderType::class,
            'result' => ReminderResult::class,
            'sent_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Stay, $this> */
    public function stay(): BelongsTo
    {
        return $this->belongsTo(Stay::class);
    }
}
