<?php

namespace App\Models;

use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property int $location_id
 * @property string $name
 * @property int $pax_capacity
 * @property string|null $description
 * @property RoomStatus $status
 * @property-read Location $location
 */
#[Fillable(['location_id', 'name', 'pax_capacity', 'description', 'status'])]
class Room extends Model
{
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
