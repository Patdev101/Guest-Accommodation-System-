<?php

namespace App\Http\Controllers\Reception;

use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\ReservationRoom;
use App\Models\Room;
use App\Models\Setting;
use App\Models\StayRoom;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A week of every room (rules 8 and 11): reservations and stays as bars, so
 * reception can see free time at a glance and book it.
 *
 * @phpstan-type Booking array{room_id: int, kind: string, label: string, company: string|null, pax: int, starts_at: string, ends_at: string, open_ended: bool, href: string}
 */
class CalendarController extends Controller
{
    public const DAYS = 7;

    public function __invoke(Request $request): Response
    {
        $start = $request->validate(['start' => ['nullable', 'date_format:Y-m-d']])['start'] ?? null;
        $from = $start ? CarbonImmutable::createFromFormat('!Y-m-d', $start) : CarbonImmutable::today();
        $from = $from instanceof CarbonImmutable ? $from : CarbonImmutable::today();
        $until = $from->addDays(self::DAYS);

        $rooms = Room::query()->with('location:id,name')->get()
            ->sortBy(fn (Room $room) => $room->location->name."\0".$room->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $bookings = [];

        foreach ([...$this->reservations($from, $until), ...$this->stays($from, $until)] as $booking) {
            $bookings[$booking['room_id']][] = $booking;
        }

        return Inertia::render('reception/calendar', [
            'now' => CarbonImmutable::now()->toIso8601String(),
            'start' => $from->toDateString(),
            'from' => $from->toIso8601String(),
            'until' => $until->toIso8601String(),
            'days' => collect(range(0, self::DAYS - 1))->map(fn (int $day) => $from->addDays($day)->toDateString()),
            'today' => CarbonImmutable::today()->toDateString(),
            'standardTimes' => [
                'check_in' => (string) Setting::get('standard_check_in_time'),
                'check_out' => (string) Setting::get('standard_check_out_time'),
            ],
            'locations' => Location::query()->orderBy('name')->get(['id', 'name'])->map(fn (Location $location) => [
                'id' => $location->id,
                'name' => $location->name,
                'rooms' => $rooms->where('location_id', $location->id)->values()->map(fn (Room $room) => [
                    ...$room->summary(),
                    'bookings' => array_map(fn (array $booking) => array_diff_key($booking, ['room_id' => true]), $bookings[$room->id] ?? []),
                ]),
            ]),
        ]);
    }

    /**
     * Active reservations in the week ("not_arrived" once past the grace period).
     *
     * @return list<Booking>
     */
    private function reservations(CarbonImmutable $from, CarbonImmutable $until): array
    {
        // Past the grace period and still not checked in (rule 17).
        $lateFrom = CarbonImmutable::now()->subMinutes((int) Setting::get('no_show_grace_minutes'));

        return array_values(ReservationRoom::query()
            ->whereHas('reservation', fn ($query) => $query
                ->where('status', ReservationStatus::Active)
                ->where('starts_at', '<', $until)
                ->where('ends_at', '>', $from))
            ->with('reservation.guest:id,name')
            ->get()
            ->map(fn (ReservationRoom $line) => [
                'room_id' => $line->room_id,
                'kind' => $line->reservation->starts_at->lte($lateFrom) ? 'not_arrived' : 'reserved',
                'label' => $line->reservation->guest->name,
                'company' => $line->reservation->company,
                'pax' => $line->pax,
                'starts_at' => $line->reservation->starts_at->toIso8601String(),
                'ends_at' => $line->reservation->ends_at->toIso8601String(),
                'open_ended' => false,
                'href' => route('reception.reservations.show', $line->reservation_id),
            ])
            ->all());
    }

    /**
     * Stays in the week: in house now, or already checked out.
     *
     * @return list<Booking>
     */
    private function stays(CarbonImmutable $from, CarbonImmutable $until): array
    {
        return array_values(StayRoom::query()
            ->whereHas('stay', fn ($query) => $query
                ->where('checked_in_at', '<', $until)
                ->where(fn ($query) => $query
                    ->whereNull('checked_out_at')
                    ->orWhere('checked_out_at', '>', $from)))
            ->with('stay.guest:id,name', 'stay.reservation:id,company')
            ->get()
            ->map(function (StayRoom $line) {
                $stay = $line->stay;

                return [
                    'room_id' => $line->room_id,
                    'kind' => $stay->checked_out_at ? 'checked_out' : 'in_house',
                    'label' => $stay->guest->name,
                    'company' => $stay->reservation?->company,
                    'pax' => $line->pax,
                    'starts_at' => $stay->checked_in_at->toIso8601String(),
                    // A guest past their check-out time is still in the room until checked out.
                    'ends_at' => ($stay->checked_out_at ?? $stay->expected_check_out_at->max(CarbonImmutable::now()))->toIso8601String(),
                    // Rule 13: may still extend, so the time after is not bookable yet.
                    'open_ended' => $stay->checked_out_at === null && $stay->not_extending_confirmed_at === null,
                    'href' => route('reception.stays.show', $stay->id),
                ];
            })
            ->all());
    }
}
