<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An ID the front desk accepts from guests, e.g. Passport.
 *
 * @property int $id
 * @property string $name
 * @property bool $is_active
 * @property int|null $custody_records_count
 */
#[Fillable(['name', 'is_active'])]
class IdType extends Model
{
    use LogsActivity;

    /** IDs the system starts with; the Admin can add, rename or turn them off. */
    public const DEFAULTS = ['Driver’s License', 'Passport', 'UMID', 'Company ID', 'PhilSys ID', 'Other Government ID'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function activityLabel(): string
    {
        return "ID type \"{$this->name}\"";
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    protected function activityUpdateDescription(array $changes): string
    {
        return array_keys($changes) === ['is_active']
            ? ($this->is_active ? 'Started accepting ' : 'Stopped accepting ').$this->activityLabel()
            : 'Updated '.$this->activityLabel();
    }

    /** @return HasMany<IdCustody, $this> */
    public function custodyRecords(): HasMany
    {
        return $this->hasMany(IdCustody::class);
    }

    /**
     * Types reception may choose from.
     *
     * @param  Builder<self>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }
}
