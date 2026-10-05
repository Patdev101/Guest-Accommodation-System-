<?php

namespace App\Concerns;

use App\Models\ActivityLog;
use BackedEnum;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * Writes an activity log entry whenever the model is created, changed or
 * deleted. Models describe themselves with activityLabel(), e.g. "room A-104".
 *
 * @mixin Model
 */
trait LogsActivity
{
    /**
     * Attributes never shown in the log.
     *
     * @var list<string>
     */
    protected static array $activityHidden = ['password', 'password_set_at', 'remember_token', 'created_at', 'updated_at'];

    public static function bootLogsActivity(): void
    {
        static::created(function (Model $model) {
            /** @var Model&self $model */
            ActivityLog::record('created', $model, 'Added '.$model->activityLabel());
        });

        static::updated(function (Model $model) {
            /** @var Model&self $model */
            $changes = $model->activityChanges();

            if ($changes !== []) {
                ActivityLog::record('updated', $model, $model->activityUpdateDescription($changes), $changes);
            }
        });

        static::deleted(function (Model $model) {
            /** @var Model&self $model */
            ActivityLog::record('deleted', $model, 'Deleted '.$model->activityLabel());
        });
    }

    /** How the record is named in the log, e.g. "room A-104 (Barracks)". */
    abstract public function activityLabel(): string;

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    protected function activityUpdateDescription(array $changes): string
    {
        return 'Updated '.$this->activityLabel();
    }

    /**
     * The changed attributes as [field => [old, new]], values made readable.
     *
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    protected function activityChanges(): array
    {
        $changes = [];

        foreach (array_keys($this->getChanges()) as $field) {
            if (in_array($field, static::$activityHidden, true)) {
                if ($field === 'password') {
                    $changes['password'] = ['(hidden)', '(changed)'];
                }

                continue;
            }

            $old = $this->activityValue($this->getOriginal($field));
            $new = $this->activityValue($this->getAttribute($field));

            if ($old !== $new) {
                $changes[$field] = [$old, $new];
            }
        }

        return $changes;
    }

    private function activityValue(mixed $value): mixed
    {
        return match (true) {
            $value instanceof BackedEnum => $value->value,
            $value instanceof DateTimeInterface => $value->format('Y-m-d H:i'),
            is_bool($value), is_int($value), is_float($value), $value === null => $value,
            default => (string) $value,
        };
    }
}
