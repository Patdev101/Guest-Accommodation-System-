<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $room_id
 * @property string $path
 * @property string|null $caption
 * @property int $sort_order
 * @property bool $is_cover
 */
#[Fillable(['room_id', 'path', 'caption', 'sort_order', 'is_cover'])]
class RoomPhoto extends Model
{
    use CastsKeysToIntegers, LogsActivity;

    public function activityLabel(): string
    {
        return 'photo on room '.Room::query()->whereKey($this->room_id)->value('name');
    }

    /** Most photos a room can have. */
    public const MAX_PER_ROOM = 10;

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_cover' => 'boolean',
        ];
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function url(): string
    {
        return Storage::disk('public')->url($this->path);
    }

    /**
     * @return array{id: int, url: string, caption: string|null, is_cover: bool}
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url(),
            'caption' => $this->caption,
            'is_cover' => $this->is_cover,
        ];
    }
}
