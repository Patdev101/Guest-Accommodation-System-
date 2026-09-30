<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use Closure;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One entry in the admin activity log: who did what to which record, when.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $action
 * @property string $subject_type
 * @property int|null $subject_id
 * @property string $description
 * @property array<string, array{0: mixed, 1: mixed}>|null $changes
 * @property string|null $ip_address
 * @property Carbon $created_at
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'action', 'subject_type', 'subject_id', 'description', 'changes', 'ip_address', 'created_at'])]
class ActivityLog extends Model
{
    use CastsKeysToIntegers;

    public const UPDATED_AT = null;

    private static bool $enabled = true;

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    public static function record(string $action, Model $subject, string $description, array $changes = []): void
    {
        if (! self::$enabled) {
            return;
        }

        static::query()->create([
            'user_id' => auth()->id(),
            'action' => $action,
            'subject_type' => class_basename($subject),
            'subject_id' => is_numeric($subject->getKey()) ? (int) $subject->getKey() : null,
            'description' => mb_strimwidth($description, 0, 250, '…'),
            'changes' => $changes === [] ? null : $changes,
            'ip_address' => app()->bound('request') ? request()->ip() : null,
            'created_at' => now(),
        ]);
    }

    /**
     * Run without logging, e.g. while seeding sample data.
     *
     * @template T
     *
     * @param  Closure(): T  $callback
     * @return T
     */
    public static function withoutLogging(Closure $callback): mixed
    {
        $previous = self::$enabled;
        self::$enabled = false;

        try {
            return $callback();
        } finally {
            self::$enabled = $previous;
        }
    }
}
