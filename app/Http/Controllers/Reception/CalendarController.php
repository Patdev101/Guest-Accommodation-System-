<?php

namespace App\Http\Controllers\Reception;

use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\ReservationRoom;
use App\Models\Stay;
use App\Models\StayRoom;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A month at a glance (owner, 7 Oct 2026): on each day, who arrives and who is
 * expected to check out, with their rooms, time and status. Reception can also
 * ask for any range of dates ("from … to").
 *
 * @phpstan-type Event array{type: string, label: string, guest: string, company: string|null, rooms: string, at: string, status: string, href: string}
 */
class CalendarController extends Controller
{
    /** The longest "from … to" range the page shows, in days. */
    public const MAX_DAYS = 93;

    public function __invoke(Request $request): Response
    {
        $query = Validator::make($request->query(), [
            'month' => ['date_format:Y-m'],
            'from' => ['date_format:Y-m-d'],
            'to' => ['date_format:Y-m-d', 'after_or_equal:from'],
        ])->valid();

        // A chosen range of dates, or else one whole month.
        $ranged = isset($query['from'], $query['to']);
        $month = isset($query['month']) ? CarbonImmutable::createFromFormat('!Y-m', $query['month']) : null;
        $month = $month instanceof CarbonImmutable ? $month : CarbonImmutable::today()->startOfMonth();
        $first = $ranged ? CarbonImmutable::createFromFormat('!Y-m-d', $query['from']) : $month;
        $first = $first instanceof CarbonImmutable ? $first : $month;
        $last = $ranged ? CarbonImmutable::createFromFormat('!Y-m-d', $query['to']) : null;
        $last = $last instanceof CarbonImmutable ? $last->min($first->addDays(self::MAX_DAYS - 1))->endOfDay() : $first->endOfMonth();
        $anchor = $first->startOfMonth();

        $events = collect([...$this->reservations($first, $last), ...$this->walkIns($first, $last)])
            ->filter(fn (array $event) => $first->lte($event['at']) && $last->gte($event['at']))
            ->sortBy('at')
            ->values();

        return Inertia::render('reception/calendar', [
            'ranged' => $ranged,
            'from' => $first->toDateString(),
            'to' => $last->toDateString(),
            'title' => $ranged
                ? $first->format('M j').' to '.$last->format('M j, Y')
                : $first->format('F Y'),
            // Previous and Next always move by whole months.
            'previous' => $anchor->subMonth()->format('Y-m'),
            'next' => $anchor->addMonth()->format('Y-m'),
            'today' => CarbonImmutable::today()->toDateString(),
            'events' => $events
                ->groupBy(fn (array $event) => CarbonImmutable::parse($event['at'])->toDateString())
                ->map(fn ($day) => $day->values()),
            'arrivals' => $events->where('type', 'arrival')->count(),
            'departures' => $events->where('type', 'departure')->count(),
        ]);
    }

    /**
     * An arrival and a check-out for every booking that touches the month.
     *
     * @return list<Event>
     */
    private function reservations(CarbonImmutable $first, CarbonImmutable $last): array
    {
        $events = [];

        $reservations = Reservation::query()
            ->whereNotIn('status', [ReservationStatus::Cancelled, ReservationStatus::NoShow])
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $query) => $query->where('starts_at', '<=', $last)->where('ends_at', '>=', $first))
                ->orWhereHas('stay', fn (Builder $stay) => $this->touching($stay, $first, $last)))
            ->with(['guest:id,name', 'rooms.room:id,name', 'stay'])
            ->get();

        foreach ($reservations as $reservation) {
            $stay = $reservation->stay;
            $about = [
                'guest' => $reservation->guest->name,
                'company' => $reservation->company,
                'rooms' => $reservation->rooms->map(fn (ReservationRoom $line) => $line->room->name)->implode(', '),
                'status' => $this->status($stay),
                'href' => $stay ? route('reception.stays.show', $stay) : route('reception.reservations.show', $reservation),
            ];

            $events[] = [
                'type' => 'arrival',
                'label' => $stay ? 'Arrival' : 'Reservation',
                'at' => ($stay->checked_in_at ?? $reservation->starts_at)->toIso8601String(),
                ...$about,
            ];
            $events[] = [
                'type' => 'departure',
                'label' => $stay?->checked_out_at ? 'Checked out' : 'Expected check-out',
                'at' => ($stay ? ($stay->checked_out_at ?? $stay->expected_check_out_at) : $reservation->ends_at)->toIso8601String(),
                ...$about,
            ];
        }

        return $events;
    }

    /**
     * Stays that were never a reservation.
     *
     * @return list<Event>
     */
    private function walkIns(CarbonImmutable $first, CarbonImmutable $last): array
    {
        $events = [];

        $stays = $this->touching(Stay::query()->whereNull('reservation_id'), $first, $last)
            ->with(['guest:id,name,company', 'rooms.room:id,name'])
            ->get();

        foreach ($stays as $stay) {
            $about = [
                'guest' => $stay->guest->name,
                'company' => $stay->guest->company,
                'rooms' => $stay->rooms->map(fn (StayRoom $line) => $line->room->name)->implode(', '),
                'status' => $this->status($stay),
                'href' => route('reception.stays.show', $stay),
            ];

            $events[] = ['type' => 'arrival', 'label' => 'Arrival', 'at' => $stay->checked_in_at->toIso8601String(), ...$about];
            $events[] = [
                'type' => 'departure',
                'label' => $stay->checked_out_at ? 'Checked out' : 'Expected check-out',
                'at' => ($stay->checked_out_at ?? $stay->expected_check_out_at)->toIso8601String(),
                ...$about,
            ];
        }

        return $events;
    }

    /**
     * Stays whose arrival or check-out may fall in the month.
     *
     * @param  Builder<Stay>  $query
     * @return Builder<Stay>
     */
    private function touching(Builder $query, CarbonImmutable $first, CarbonImmutable $last): Builder
    {
        return $query->where('checked_in_at', '<=', $last)
            ->where(fn (Builder $query) => $query
                ->where('checked_out_at', '>=', $first)
                ->orWhere(fn (Builder $query) => $query->whereNull('checked_out_at')->where('expected_check_out_at', '>=', $first))
                ->orWhere('checked_in_at', '>=', $first));
    }

    private function status(?Stay $stay): string
    {
        return match (true) {
            $stay === null => 'Reserved',
            $stay->checked_out_at !== null => 'Checked out',
            $stay->expected_check_out_at->isPast() => 'In house, past check-out time',
            default => 'In house',
        };
    }
}
