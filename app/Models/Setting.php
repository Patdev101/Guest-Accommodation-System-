<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Admin-editable business settings, stored as key/value rows.
 */
#[Fillable(['key', 'value'])]
class Setting extends Model
{
    /** Defaults used until the Admin changes them (requirements section 10). */
    public const DEFAULTS = [
        'cleaning_buffer_minutes' => '0',
        'no_show_grace_minutes' => '60',
        'checkout_reminder_minutes' => '60',
        'no_show_refund' => 'full',
        'no_show_refund_percent' => '100',
    ];

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    public static function get(string $key): ?string
    {
        return static::query()->find($key)->value ?? self::DEFAULTS[$key] ?? null;
    }

    public static function set(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /**
     * Every business setting, with defaults filled in for keys never saved.
     *
     * @return array<string, string|null>
     */
    public static function values(): array
    {
        $stored = static::query()
            ->whereIn('key', array_keys(self::DEFAULTS))
            ->pluck('value', 'key')
            ->all();

        return array_merge(self::DEFAULTS, $stored);
    }
}
