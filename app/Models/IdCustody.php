<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use App\Enums\IdCustodyStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The valid ID reception holds for a booking until everything is settled (rule 24).
 *
 * @property int $id
 * @property int $stay_id
 * @property int $id_type_id
 * @property string $id_number
 * @property string|null $photo_path On the private "local" disk.
 * @property IdCustodyStatus $status
 * @property int $received_by
 * @property CarbonImmutable|null $returned_at
 * @property int|null $returned_by
 * @property-read IdType $idType
 * @property-read User $receiver
 * @property-read User|null $returner
 */
#[Fillable(['stay_id', 'id_type_id', 'id_number', 'photo_path', 'status', 'received_by', 'returned_at', 'returned_by'])]
class IdCustody extends Model
{
    use CastsKeysToIntegers, LogsActivity;

    /** Where ID photos are kept: the private disk, never the public one. */
    public const DISK = 'local';

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

    /** @return BelongsTo<IdType, $this> */
    public function idType(): BelongsTo
    {
        return $this->belongsTo(IdType::class);
    }

    /** @return BelongsTo<User, $this> */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    /** @return BelongsTo<User, $this> */
    public function returner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'returned_by');
    }

    public function activityLabel(): string
    {
        return 'ID '.IdType::query()->whereKey($this->id_type_id)->value('name')." {$this->id_number} of stay #{$this->stay_id}";
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    protected function activityUpdateDescription(array $changes): string
    {
        if (! array_key_exists('status', $changes)) {
            return 'Updated '.$this->activityLabel();
        }

        return $this->status === IdCustodyStatus::Returned
            ? 'Returned '.$this->activityLabel()
            : ucfirst($this->activityLabel()).' is now '.strtolower($this->status->label());
    }
}
