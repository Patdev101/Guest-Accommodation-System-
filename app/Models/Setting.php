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
        // What "Overnight" and a standard stay mean (24-hour HH:MM).
        'standard_check_in_time' => '14:00',
        'standard_check_out_time' => '12:00',
    ];

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    public static function get(string $key): ?string
    {
        return static::query()->find($key)->value ?? self::DEFAULTS[$key] ?? null;
    }

    /** Readable names for the activity log. */
    public const LABELS = [
        'cleaning_buffer_minutes' => 'Cleaning buffer (minutes)',
        'no_show_grace_minutes' => 'No-show grace period (minutes)',
        'checkout_reminder_minutes' => 'Check-out reminder (minutes before)',
        'no_show_refund' => 'No-show refund',
        'no_show_refund_percent' => 'No-show refund percentage',
        'standard_check_in_time' => 'Standard check-in time',
        'standard_check_out_time' => 'Standard check-out time',
    ];

    public static function set(string $key, ?string $value): void
    {
        $old = static::query()->whereKey($key)->value('value') ?? self::DEFAULTS[$key] ?? null;
        $setting = static::query()->updateOrCreate(['key' => $key], ['value' => $value]);

        // Only real business settings are logged, and only when they change.
        if (isset(self::LABELS[$key]) && $old !== $value) {
            ActivityLog::record('updated', $setting, 'Changed setting: '.self::LABELS[$key], [$key => [$old, $value]]);
        }
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
