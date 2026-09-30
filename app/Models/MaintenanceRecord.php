<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $room_id
 * @property Carbon $performed_on
 * @property string $issue
 * @property string|null $action_taken
 * @property string|null $done_by
 * @property int|null $recorded_by
 * @property-read Room $room
 * @property-read User|null $recorder
 */
#[Fillable(['room_id', 'performed_on', 'issue', 'action_taken', 'done_by', 'recorded_by'])]
class MaintenanceRecord extends Model
{
    use CastsKeysToIntegers, LogsActivity;

    public function activityLabel(): string
    {
        return 'maintenance record "'.mb_strimwidth($this->issue, 0, 60, '…').'" on room '
            .Room::query()->whereKey($this->room_id)->value('name');
    }

    protected function casts(): array
    {
        return [
            'performed_on' => 'date',
            // A name typed in, not a user id (see CastsKeysToIntegers).
            'done_by' => 'string',
        ];
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /** @return BelongsTo<User, $this> */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
