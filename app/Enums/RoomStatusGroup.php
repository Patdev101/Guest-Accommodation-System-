<?php

namespace App\Enums;

/**
 * The four buckets the dashboard and room board summarise room statuses into.
 */
enum RoomStatusGroup: string
{
    case Available = 'available';
    case InUse = 'in_use';
    case Turnover = 'turnover';
    case Unavailable = 'unavailable';

    public function label(): string
    {
        return match ($this) {
            self::Available => 'Available',
            self::InUse => 'In use',
            self::Turnover => 'Turnover',
            self::Unavailable => 'Not bookable',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Available => 'Ready for a guest',
            self::InUse => 'Occupied or checking out',
            self::Turnover => 'Being inspected or cleaned',
            self::Unavailable => 'Under maintenance or out of service',
        };
    }

    /**
     * How many of the given statuses fall in each group, in display order.
     *
     * @param  iterable<RoomStatus>  $statuses
     * @return array<string, int>
     */
    public static function tally(iterable $statuses): array
    {
        $counts = array_fill_keys(array_map(fn (self $group) => $group->value, self::cases()), 0);

        foreach ($statuses as $status) {
            $counts[$status->group()->value]++;
        }

        return $counts;
    }

    /**
     * @return list<array{value: string, label: string, description: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $group) => [
            'value' => $group->value,
            'label' => $group->label(),
            'description' => $group->description(),
        ], self::cases());
    }
}
