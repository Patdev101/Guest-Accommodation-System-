<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use App\Concerns\LogsActivity;
use App\Enums\RoomStatus;
use Database\Factories\RoomFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $location_id
 * @property string $name
 * @property int $pax_capacity
 * @property string|null $description
 * @property RoomStatus $status
 * @property Carbon|null $created_at
 * @property int|null $inclusions_count
 * @property-read Location $location
 * @property-read RoomPhoto|null $coverPhoto
 */
#[Fillable(['location_id', 'name', 'pax_capacity', 'description', 'status'])]
class Room extends Model
{
    use CastsKeysToIntegers;

    /** @use HasFactory<RoomFactory> */
    use HasFactory, LogsActivity;

    public function activityLabel(): string
    {
        $location = Location::query()->whereKey($this->location_id)->value('name');

        return "room {$this->name}".($location ? " ({$location})" : '');
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    protected function activityUpdateDescription(array $changes): string
    {
        if (array_keys($changes) === ['status']) {
            return "Changed {$this->activityLabel()} to {$this->status->label()}";
        }

        return 'Updated '.$this->activityLabel();
    }

    protected function casts(): array
    {
        return [
            'status' => RoomStatus::class,
            'pax_capacity' => 'integer',
        ];
    }

    /** @return BelongsTo<Location, $this> */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /** @return HasMany<RoomInclusion, $this> */
    public function inclusions(): HasMany
    {
        return $this->hasMany(RoomInclusion::class);
    }

    /** @return HasMany<RoomRate, $this> */
    public function rates(): HasMany
    {
        return $this->hasMany(RoomRate::class);
    }

    /** @return HasMany<MaintenanceRecord, $this> */
    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }

    /** @return BelongsToMany<Reservation, $this> */
    public function reservations(): BelongsToMany
    {
        return $this->belongsToMany(Reservation::class, 'reservation_rooms')->withPivot(['pax', 'price', 'room_rate_id']);
    }

    /** @return BelongsToMany<Stay, $this> */
    public function stays(): BelongsToMany
    {
        return $this->belongsToMany(Stay::class, 'stay_rooms')->withPivot('pax');
    }

    /** @return HasMany<RoomPhoto, $this> */
    public function photos(): HasMany
    {
        return $this->hasMany(RoomPhoto::class)->orderBy('sort_order')->orderBy('id');
    }

    /** @return HasOne<RoomPhoto, $this> */
    public function coverPhoto(): HasOne
    {
        return $this->hasOne(RoomPhoto::class)->where('is_cover', true);
    }

    /**
     * The fields every room list and board shows.
     *
     * @return array{id: int, name: string, location_id: int, location: string|null, pax_capacity: int, status: string, status_label: string, group: string, cover_url: string|null}
     */
    public function summary(): array
    {
        return [
            'cover_url' => $this->relationLoaded('coverPhoto') ? $this->coverPhoto?->url() : null,
            'id' => $this->id,
            'name' => $this->name,
            'location_id' => $this->location_id,
            'location' => $this->relationLoaded('location') ? $this->location->name : null,
            'pax_capacity' => $this->pax_capacity,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'group' => $this->status->group()->value,
        ];
    }
}
