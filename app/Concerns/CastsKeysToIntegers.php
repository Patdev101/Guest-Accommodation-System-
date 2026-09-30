<?php

namespace App\Concerns;

use Illuminate\Database\Eloquent\Model;

/**
 * SQL Server returns bigint columns (every foreign key) as strings, so
 * `$stayRoom->stay_id === $stay->id` would compare "3" with 3 and fail, and
 * pages would receive ids as text. This casts every fillable `*_id` and
 * `*_by` column to an integer, unless the model already casts it (e.g. the
 * `paid_by` enum on payments). A text column with such a name must declare
 * its own cast, as `maintenance_records.done_by` does (`'done_by' => 'string'`).
 *
 * @mixin Model
 */
trait CastsKeysToIntegers
{
    /** @var array<class-string, array<string, string>> */
    private static array $keyCasts = [];

    /**
     * @return array<string, string>
     */
    public function getCasts()
    {
        $casts = parent::getCasts();

        self::$keyCasts[static::class] ??= array_fill_keys(
            array_values(array_filter($this->getFillable(), fn (string $attribute) => preg_match('/_(id|by)$/', $attribute) === 1)),
            'integer',
        );

        return $casts + self::$keyCasts[static::class];
    }
}
