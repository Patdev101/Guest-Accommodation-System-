<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Enums\ReminderResult;
use App\Enums\ReminderType;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A check-out reminder or call to the guest, and what they said (rules 18 and 21).
 *
 * @property int $id
 * @property int $stay_id
 * @property ReminderType $type
 * @property CarbonImmutable $sent_at
 * @property ReminderResult|null $result
 * @property string|null $notes
 * @property int|null $logged_by
 * @property-read User|null $logger
 */
#[Fillable(['stay_id', 'type', 'sent_at', 'result', 'notes', 'logged_by'])]
class ReminderLog extends Model
{
    use CastsKeysToIntegers;

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

    /** @return BelongsTo<User, $this> */
    public function logger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'logged_by');
    }
}
