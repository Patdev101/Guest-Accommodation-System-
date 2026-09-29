<?php

namespace App\Models;

use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use Database\Factories\RoomFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
 */
#[Fillable(['location_id', 'name', 'pax_capacity', 'description', 'status'])]
class Room extends Model
{
    /** @use HasFactory<RoomFactory> */
    use HasFactory;

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

    /** @return HasMany<Reservation, $this> */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    /** @return HasMany<Stay, $this> */
    public function stays(): HasMany
    {
        return $this->hasMany(Stay::class);
    }

    /** @return HasOne<Stay, $this> */
    public function activeStay(): HasOne
    {
        return $this->hasOne(Stay::class)->whereNull('checked_out_at');
    }

    /**
     * The fields every room list and board shows.
     *
     * @return array{id: int, name: string, location_id: int, location: string|null, pax_capacity: int, status: string, status_label: string, group: string}
     */
    public function summary(): array
    {
        return [
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

    /**
     * The next active reservation, which the room board shows as "Reserved".
     *
     * @return HasOne<Reservation, $this>
     */
    public function nextReservation(): HasOne
    {
        return $this->hasOne(Reservation::class)
            ->where('status', ReservationStatus::Active)
            ->orderBy('starts_at');
    }
}
