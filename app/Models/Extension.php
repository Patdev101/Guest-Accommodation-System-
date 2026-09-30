<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use App\Enums\ConsentStatus;
use App\Enums\ExtensionStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A request to stay longer (rules 20 and 21). When the rooms are reserved
 * next, each of Guest B's rooms that must move is an `ExtensionMove`.
 * (The single-move columns affected_reservation_id … consent_recorded_by
 * predate group bookings and are not used.)
 *
 * @property int $id
 * @property int $stay_id
 * @property CarbonImmutable $old_check_out_at
 * @property CarbonImmutable $new_check_out_at
 * @property string|null $price
 * @property ExtensionStatus $status
 * @property int $requested_by
 * @property int|null $decided_by
 * @property CarbonImmutable|null $decided_at
 * @property string|null $denial_reason
 * @property-read User $requester
 * @property-read Collection<int, ExtensionMove> $moves
 */
#[Fillable([
    'stay_id', 'old_check_out_at', 'new_check_out_at', 'price', 'status',
    'requested_by', 'decided_by', 'decided_at', 'denial_reason',
    'affected_reservation_id', 'moved_from_room_id', 'moved_to_room_id',
    'consent_status', 'consent_responded_at', 'consent_recorded_by',
])]
class Extension extends Model
{
    use CastsKeysToIntegers, LogsActivity;

    protected function casts(): array
    {
        return [
            'old_check_out_at' => 'datetime',
            'new_check_out_at' => 'datetime',
            'decided_at' => 'datetime',
            'consent_responded_at' => 'datetime',
            'price' => 'decimal:2',
            'status' => ExtensionStatus::class,
            'consent_status' => ConsentStatus::class,
        ];
    }

    public function activityLabel(): string
    {
        return "extension of stay #{$this->stay_id} to ".$this->new_check_out_at->format('j M Y g:i A');
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    protected function activityUpdateDescription(array $changes): string
    {
        return array_key_exists('status', $changes)
            ? ucfirst($this->activityLabel()).': '.strtolower($this->status->label())
            : 'Updated '.$this->activityLabel();
    }

    /** @return BelongsTo<Stay, $this> */
    public function stay(): BelongsTo
    {
        return $this->belongsTo(Stay::class);
    }

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /** @return HasMany<ExtensionMove, $this> */
    public function moves(): HasMany
    {
        return $this->hasMany(ExtensionMove::class);
    }
}
