<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $room_id
 * @property string $item
 * @property int $quantity
 */
#[Fillable(['room_id', 'item', 'quantity'])]
class RoomInclusion extends Model
{
    use CastsKeysToIntegers, LogsActivity;

    public function activityLabel(): string
    {
        return "inclusion \"{$this->item}\" on room ".Room::query()->whereKey($this->room_id)->value('name');
    }

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }
}
