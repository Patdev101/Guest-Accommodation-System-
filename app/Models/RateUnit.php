<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property int|null $rates_count
 */
#[Fillable(['name'])]
class RateUnit extends Model
{
    /** Units the system starts with; the Admin can add more. */
    public const DEFAULTS = ['Per hour', 'Overnight', 'Day tour'];

    /** @return HasMany<RoomRate, $this> */
    public function rates(): HasMany
    {
        return $this->hasMany(RoomRate::class);
    }
}
