<?php

namespace App\Http\Controllers;

use App\Enums\RefundStatus;
use App\Enums\ReservationStatus;
use App\Enums\Role;
use App\Enums\RoomStatus;
use App\Enums\RoomStatusGroup;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Reception\ReservationController;
use App\Http\Controllers\Reception\StayController;
use App\Models\Location;
use App\Models\MaintenanceRecord;
use App\Models\Refund;
use App\Models\Reservation;
use App\Models\ReservationRoom;
use App\Models\Room;
use App\Models\Setting;
use App\Models\Stay;
use App\Models\StayRoom;
use App\Models\User;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        return match ($user->role) {
            Role::Admin => Inertia::render('admin/dashboard', $this->forAdmin()),
            Role::Reception => Inertia::render('reception/dashboard', $this->forReception()),
            Role::Guest => Inertia::render('dashboard', $this->forGuest($user)),
        };
    }

    /** @return array<string, mixed> */
    private function forAdmin(): array
    {
        $rooms = Room::query()
            ->with(['location:id,name', 'rates:id,room_id,is_extension_rate'])
            ->get()
            ->sortBy(fn (Room $room) => $room->location->name."\0".$room->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $groupCounts = RoomStatusGroup::tally($rooms->map(fn (Room $room) => $room->status));
        $withoutRates = $rooms->filter(fn (Room $room) => ! $room->rates->contains('is_extension_rate', false));

        return [
            'stats' => [
                'rooms' => $rooms->count(),
                'capacity' => (int) $rooms->sum('pax_capacity'),
                'locations' => Location::count(),
            ],
            'groups' => array_map(fn (array $group) => [
                ...$group,
                'count' => $groupCounts[$group['value']],
            ], RoomStatusGroup::options()),
            'breakdown' => array_map(fn (RoomStatus $status) => [
                'value' => $status->value,
                'label' => $status->label(),
                'group' => $status->group()->value,
                'count' => $rooms->filter(fn (Room $room) => $room->status === $status)->count(),
            ], RoomStatus::cases()),
            'board' => $this->board($rooms),
            'checklist' => [
                'locations' => Location::count(),
                'rooms' => $rooms->count(),
                'roomsWithoutRates' => $withoutRates->take(5)->values()->map(fn (Room $room) => $room->summary()),
                'roomsWithoutRatesCount' => $withoutRates->count(),
                'roomsWithoutExtensionRate' => $rooms
                    ->filter(fn (Room $room) => ! $room->rates->contains('is_extension_rate', true))
                    ->count(),
                'settingsReviewed' => Setting::query()->whereKey(SettingsController::REVIEWED_KEY)->exists(),
            ],
            'recentMaintenance' => MaintenanceRecord::query()
                ->with('room.location')
                ->orderByDesc('performed_on')
                ->orderByDesc('id')
                ->limit(5)
                ->get()
                ->map(fn (MaintenanceRecord $record) => [
                    'id' => $record->id,
                    'room_id' => $record->room_id,
                    'room' => $record->room->name,
                    'location' => $record->room->location->name,
                    'performed_on' => $record->performed_on->toDateString(),
                    'issue' => $record->issue,
                    'resolved' => $record->action_taken !== null,
                ]),
        ];
    }

    /**
     * The front desk's day: who arrives, who is due out, what needs attention.
     *
     * @return array<string, mixed>
     */
    private function forReception(): array
    {
        $settings = Setting::values();
        $grace = (int) $settings['no_show_grace_minutes'];
        $lists = ['guest:id,name,contact_number', 'rooms.room:id,name,location_id', 'rooms.room.location:id,name'];

        $arrivals = Reservation::query()
            ->with($lists)
            ->withSum('payments', 'amount')
            ->where('status', ReservationStatus::Active)
            ->whereBetween('starts_at', [today(), today()->endOfDay()])
            ->orderBy('starts_at')
            ->get();

        $overdue = Reservation::query()
            ->with($lists)
            ->withSum('payments', 'amount')
            ->where('status', ReservationStatus::Active)
            ->where('starts_at', '<=', now()->subMinutes($grace))
            ->orderBy('starts_at')
            ->limit(10)
            ->get();

        $rooms = Room::query()->with('location:id,name')->get();
        $upcoming = ReservationRoom::query()
            ->whereHas('reservation', fn ($query) => $query
                ->where('status', ReservationStatus::Active)
                ->where('ends_at', '>=', now()))
            ->selectRaw('room_id, count(*) as total')
            ->groupBy('room_id')
            ->pluck('total', 'room_id');

        // Rule 18: from the reminder time before check-out, reception calls the guest.
        $dueSoon = Stay::query()
            ->with(['guest:id,name,contact_number,company', 'reservation:id,company', 'rooms.room:id,name', 'idCustody', 'reminderLogs'])
            ->whereNull('checked_out_at')
            ->where('expected_check_out_at', '<=', now()->addMinutes((int) $settings['checkout_reminder_minutes']))
            ->orderBy('expected_check_out_at')
            ->limit(10)
            ->get();

        $toInspect = StayRoom::query()
            ->whereNull('inspected_at')
            ->whereHas('stay', fn ($query) => $query->whereNotNull('checked_out_at'))
            ->with(['room:id,name', 'stay.guest:id,name'])
            ->orderBy('id')
            ->limit(20)
            ->get();

        $inHouse = StayRoom::query()
            ->whereHas('stay', fn ($query) => $query->whereNull('checked_out_at'))
            ->get(['room_id', 'pax']);

        return [
            'dueSoon' => $dueSoon->map(function (Stay $stay) {
                $lastCall = $stay->reminderLogs->sortByDesc('sent_at')->first();

                return [
                    ...StayController::row($stay),
                    'not_extending' => $stay->not_extending_confirmed_at !== null,
                    'last_call' => $lastCall === null ? null : [
                        'result' => $lastCall->result?->label(),
                        'sent_at' => $lastCall->sent_at->toIso8601String(),
                    ],
                ];
            }),
            'toInspect' => $toInspect->map(fn (StayRoom $line) => [
                'stay_id' => $line->stay_id,
                'room' => $line->room->name,
                'guest' => $line->stay->guest->name,
                'checked_out_at' => $line->stay->checked_out_at?->toIso8601String(),
            ]),
            'stats' => [
                'rooms' => $rooms->count(),
                'capacity' => (int) $rooms->sum('pax_capacity'),
                'occupied' => $inHouse->unique('room_id')->count(),
                'available' => $rooms->filter(fn (Room $room) => $room->status === RoomStatus::Available)->count(),
                'arrivalsToday' => $arrivals->count(),
                'checkedInToday' => Stay::query()->whereBetween('checked_in_at', [today(), today()->endOfDay()])->count(),
                'inHouse' => (int) $inHouse->sum('pax'),
                'checkoutsToday' => Stay::query()
                    ->whereNull('checked_out_at')
                    ->whereBetween('expected_check_out_at', [today(), today()->endOfDay()])
                    ->count(),
                'openRefunds' => Refund::query()->whereIn('status', [RefundStatus::Requested, RefundStatus::Processing])->count(),
            ],
            'arrivals' => $arrivals->map(fn (Reservation $reservation) => ReservationController::row($reservation)),
            'overdue' => $overdue->map(fn (Reservation $reservation) => ReservationController::row($reservation)),
            'groups' => array_map(fn (array $group) => [
                ...$group,
                'count' => RoomStatusGroup::tally($rooms->map(fn (Room $room) => $room->status))[$group['value']],
            ], RoomStatusGroup::options()),
            // Reception changes room status from the board (e.g. cleaning done → available).
            'board' => $this->board($rooms, fn (Room $room) => [
                'transitions' => array_map(fn (RoomStatus $status) => [
                    'value' => $status->value,
                    'label' => $status->label(),
                    'description' => $status->description(),
                    'group' => $status->group()->value,
                ], $room->status->manualTransitions()),
                'upcoming_reservations' => (int) ($upcoming[$room->id] ?? 0),
            ]),
            // The house rules reception works by, shown under the board.
            'rules' => [
                'checkIn' => $settings['standard_check_in_time'],
                'checkOut' => $settings['standard_check_out_time'],
                'cleaningBuffer' => (int) $settings['cleaning_buffer_minutes'],
                'grace' => $grace,
                'reminder' => (int) $settings['checkout_reminder_minutes'],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function forGuest(User $user): array
    {
        $reservations = Reservation::query()
            ->whereHas('guest', fn ($query) => $query->where('user_id', $user->id))
            ->where('status', ReservationStatus::Active)
            ->with('rooms.room.location')
            ->orderBy('starts_at')
            ->get()
            ->map(fn (Reservation $reservation) => [
                'id' => $reservation->id,
                'room' => $reservation->rooms->map(fn (ReservationRoom $line) => $line->room->name)->implode(', '),
                'location' => $reservation->rooms->map(fn (ReservationRoom $line) => $line->room->location->name)->unique()->implode(', '),
                'starts_at' => $reservation->starts_at->toIso8601String(),
                'ends_at' => $reservation->ends_at->toIso8601String(),
                'pax' => (int) $reservation->rooms->sum('pax'),
                'payment_status' => $reservation->paymentStatus()->value,
            ]);

        return ['reservations' => $reservations];
    }

    /**
     * Every room, grouped by location, for the room boards.
     *
     * @param  Collection<int, Room>  $rooms  With their location loaded.
     * @param  (Closure(Room): array<string, mixed>)|null  $extra  More fields per room.
     * @return list<array{id: int, name: string, rooms: list<array<string, mixed>>}>
     */
    private function board(Collection $rooms, ?Closure $extra = null): array
    {
        $sorted = $rooms
            ->sortBy(fn (Room $room) => $room->location->name."\0".$room->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
        $occupancy = $this->occupancy();

        return array_values(Location::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Location $location) => [
                'id' => $location->id,
                'name' => $location->name,
                'rooms' => array_values($sorted
                    ->where('location_id', $location->id)
                    ->map(fn (Room $room) => [
                        ...$room->summary(),
                        'stay' => $occupancy[$room->id]['stay'] ?? null,
                        'arrival' => $occupancy[$room->id]['arrival'] ?? null,
                        ...($extra ? $extra($room) : []),
                    ])
                    ->all()),
            ])
            ->all());
    }

    /**
     * Who is in each room now, and the next booking that should have arrived
     * by the end of today (a late one included).
     *
     * @return array<int, array{stay?: array<string, mixed>, arrival?: array<string, mixed>}>
     */
    private function occupancy(): array
    {
        $now = CarbonImmutable::now();
        $lateFrom = $now->subMinutes((int) Setting::get('no_show_grace_minutes'));
        $rooms = [];

        $stays = StayRoom::query()
            ->whereHas('stay', fn ($query) => $query->whereNull('checked_out_at'))
            ->with('stay.guest:id,name')
            ->get();

        foreach ($stays as $line) {
            $rooms[$line->room_id]['stay'] = [
                'id' => $line->stay_id,
                'guest' => $line->stay->guest->name,
                'pax' => $line->pax,
                'due_out_at' => $line->stay->expected_check_out_at->toIso8601String(),
                'overdue' => $line->stay->expected_check_out_at->lt($now),
                'not_extending' => $line->stay->not_extending_confirmed_at !== null,
            ];
        }

        $arrivals = ReservationRoom::query()
            ->whereHas('reservation', fn ($query) => $query
                ->where('status', ReservationStatus::Active)
                ->where('starts_at', '<=', $now->endOfDay()))
            ->with('reservation.guest:id,name')
            ->get()
            ->sortBy(fn (ReservationRoom $line) => $line->reservation->starts_at->getTimestamp());

        foreach ($arrivals as $line) {
            $rooms[$line->room_id]['arrival'] ??= [
                'reservation_id' => $line->reservation_id,
                'guest' => $line->reservation->guest->name,
                'pax' => $line->pax,
                'starts_at' => $line->reservation->starts_at->toIso8601String(),
                'late' => $line->reservation->starts_at->lte($lateFrom),
            ];
        }

        return $rooms;
    }
}
