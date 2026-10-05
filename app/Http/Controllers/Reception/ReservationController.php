<?php

namespace App\Http\Controllers\Reception;

use App\Enums\BilledTo;
use App\Enums\BookingChannel;
use App\Enums\GuestType;
use App\Enums\NoShowRefund;
use App\Enums\PaymentStatus;
use App\Enums\PaymentType;
use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reception\StoreReservationRequest;
use App\Models\ExtensionMove;
use App\Models\Guest;
use App\Models\Location;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Reservation;
use App\Models\ReservationRoom;
use App\Models\Room;
use App\Models\RoomRate;
use App\Models\Setting;
use App\Models\StayGuest;
use App\Models\StayRoom;
use App\Services\Availability;
use App\Services\FrontDeskAlerts;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Bookings handled at the front desk (Phase 3): list, book, view, cancel and
 * mark no-shows. The guest list and ID are taken at check-in (Phase 4).
 */
class ReservationController extends Controller
{
    /** List filters, in the order the page shows them. */
    public const FILTERS = [
        'upcoming' => 'Upcoming',
        'today' => 'Arriving today',
        'overdue' => 'Past grace period',
        'checked_in' => 'Checked in',
        'cancelled' => 'Cancelled',
        'no_show' => 'No-shows',
        'all' => 'All',
    ];

    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'show' => ['nullable', Rule::in(array_keys(self::FILTERS))],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $show = $validated['show'] ?? 'upcoming';
        $search = trim($validated['search'] ?? '');

        $query = Reservation::query()
            ->with(['guest:id,name,contact_number', 'rooms.room:id,name,location_id', 'rooms.room.location:id,name'])
            ->withSum('payments', 'amount')
            ->withSum('rooms', 'pax')
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->where('company', 'like', "%{$search}%")
                ->orWhereHas('guest', fn (Builder $guest) => $guest
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('contact_number', 'like', "%{$search}%"))
                ->orWhereHas('rooms.room', fn (Builder $room) => $room->where('name', 'like', "%{$search}%"))));

        $query = match ($show) {
            'upcoming' => $query->where('status', ReservationStatus::Active)->orderBy('starts_at'),
            'today' => $query->where('status', ReservationStatus::Active)
                ->whereBetween('starts_at', [today(), today()->endOfDay()])
                ->orderBy('starts_at'),
            'overdue' => $query->where('status', ReservationStatus::Active)
                ->where('starts_at', '<=', now()->subMinutes((int) Setting::get('no_show_grace_minutes')))
                ->orderBy('starts_at'),
            'checked_in' => $query->where('status', ReservationStatus::CheckedIn)->orderByDesc('starts_at'),
            'cancelled' => $query->where('status', ReservationStatus::Cancelled)->orderByDesc('cancelled_at'),
            'no_show' => $query->where('status', ReservationStatus::NoShow)->orderByDesc('starts_at'),
            default => $query->orderByDesc('starts_at'),
        };

        return Inertia::render('reception/reservations/index', [
            'reservations' => $query->orderByDesc('id')
                ->paginate(25)
                ->withQueryString()
                ->through(fn (Reservation $reservation) => self::row($reservation)),
            'filters' => ['show' => $show, 'search' => $search],
            'filterOptions' => collect(self::FILTERS)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
        ]);
    }

    public function create(Request $request, Availability $availability): Response
    {
        return $this->bookingPage($request, $availability);
    }

    /** The booking page again, filled in, to change an active reservation. */
    public function edit(Request $request, Reservation $reservation, Availability $availability): Response|RedirectResponse
    {
        if (! $reservation->isActive()) {
            return $this->notActive($reservation);
        }

        return $this->bookingPage($request, $availability, $reservation->load(['guest', 'rooms']));
    }

    /** The booking page: new, or editing a reservation (its own rooms then count as free). */
    private function bookingPage(Request $request, Availability $availability, ?Reservation $editing = null): Response
    {
        $query = Validator::make($request->query(), [
            'starts_at' => ['date_format:'.StoreReservationRequest::DATE_FORMAT],
            'ends_at' => ['date_format:'.StoreReservationRequest::DATE_FORMAT],
            'pax' => ['integer', 'min:1', 'max:1000'],
            'location' => ['integer'],
            'walk_in' => ['boolean'],
        ])->valid();
        $walkIn = (bool) ($query['walk_in'] ?? false);

        $checkIn = (string) Setting::get('standard_check_in_time');
        $checkOut = (string) Setting::get('standard_check_out_time');

        // A walk-in arrives now (rounded up to the quarter hour); a booking uses the standard check-in time.
        $soon = CarbonImmutable::now()->addMinutes(14);
        $start = self::parseTime($query['starts_at'] ?? null) ?? $editing->starts_at ?? ($walkIn
            ? $soon->setTime($soon->hour, intdiv($soon->minute, 15) * 15)
            : CarbonImmutable::today()->setTimeFromTimeString($checkIn));
        $end = self::parseTime($query['ends_at'] ?? null) ?? $editing->ends_at ?? $start->copy()->addDay()->setTimeFromTimeString($checkOut);
        $pax = (int) ($query['pax'] ?? ($editing ? $editing->rooms->sum('pax') : 1));
        $locationId = isset($query['location']) ? (int) $query['location'] : null;
        $validWindow = $end->gt($start);

        // Every room, so the page can filter by location without asking again.
        $rooms = Room::query()
            ->with(['location:id,name', 'coverPhoto', 'rates' => fn ($rates) => $rates->where('is_extension_rate', false)->with('unit:id,name')->orderBy('price')])
            ->get()
            ->sortBy(fn (Room $room) => $room->location->name."\0".$room->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $periods = $validWindow ? $availability->busyPeriods(Availability::ids($rooms), $editing?->id) : [];

        $roomOptions = $rooms->map(function (Room $room) use ($availability, $start, $end, $periods, $validWindow) {
            $blocked = match (true) {
                ! $validWindow => __('Choose a departure after the arrival.'),
                $room->rates->isEmpty() => __('No price set yet. Ask the Admin to add a rate.'),
                default => $availability->blockedReason($room, $start, $end, $periods[$room->id]),
            };

            return [
                ...$room->summary(),
                'blocked_reason' => $blocked,
                'rates' => $room->rates->map(fn (RoomRate $rate) => [
                    'id' => $rate->id,
                    'name' => $rate->name,
                    'price' => $rate->price,
                    'unit' => $rate->unit->name,
                ])->values(),
            ];
        });

        $freeCapacity = $roomOptions
            ->filter(fn (array $option) => $option['blocked_reason'] === null
                && ($locationId === null || $option['location_id'] === $locationId))
            ->sum('pax_capacity');
        $earliest = $validWindow && $freeCapacity < $pax
            ? $availability->earliestSlot($pax, (int) $start->diffInMinutes($end), $locationId, $start->isFuture() ? $start->copy() : CarbonImmutable::now())
            : null;

        return Inertia::render('reception/reservations/create', [
            'window' => [
                'starts_at' => $start->format(StoreReservationRequest::DATE_FORMAT),
                'ends_at' => $end->format(StoreReservationRequest::DATE_FORMAT),
                'pax' => $pax,
                'location' => $locationId,
            ],
            'rooms' => $roomOptions,
            'freeCapacity' => (int) $freeCapacity,
            'earliest' => $earliest === null ? null : [
                'starts_at' => $earliest['starts_at']->format(StoreReservationRequest::DATE_FORMAT),
                'ends_at' => $earliest['starts_at']->copy()->addMinutes((int) $start->diffInMinutes($end))->format(StoreReservationRequest::DATE_FORMAT),
                'rooms' => $earliest['rooms'],
                'capacity' => $earliest['capacity'],
            ],
            'locations' => Location::query()->orderBy('name')->get(['id', 'name']),
            'guestTypes' => array_map(fn (GuestType $type) => ['value' => $type->value, 'label' => $type->label()], GuestType::cases()),
            'paymentMethods' => Payment::METHODS,
            'standardTimes' => ['check_in' => $checkIn, 'check_out' => $checkOut],
            'walkIn' => $walkIn,
            // Filled when an existing reservation is being changed.
            'editing' => $editing === null ? null : [
                'id' => $editing->id,
                'contact_name' => $editing->guest->name,
                'contact_number' => $editing->guest->contact_number,
                'email' => $editing->guest->email,
                'company' => $editing->company,
                'purpose' => $editing->purpose,
                'guest_type' => $editing->guest->type->value,
                'paid' => number_format($editing->amountPaid(), 2, '.', ''),
                'rooms' => $editing->rooms->map(fn (ReservationRoom $line) => [
                    'room_id' => $line->room_id,
                    'room_rate_id' => $line->room_rate_id,
                    'pax' => $line->pax,
                    'price' => (string) (float) $line->price,
                ])->values(),
            ],
        ]);
    }

    public function store(StoreReservationRequest $request, Availability $availability, FrontDeskAlerts $alerts): RedirectResponse
    {
        $start = $request->startsAt();
        $end = $request->endsAt();
        $lines = $request->roomLines();

        $reservation = DB::transaction(function () use ($request, $availability, $start, $end, $lines) {
            // Lock the rooms so two desks cannot book the same room at once.
            $rooms = Room::query()->whereKey(array_column($lines, 'room_id'))->lockForUpdate()->get()->keyBy('id');
            $periods = $availability->busyPeriods(Availability::ids($rooms));

            foreach ($lines as $index => $line) {
                $room = $rooms[$line['room_id']];
                $reason = $availability->blockedReason($room, $start, $end, $periods[$room->id]);

                if ($reason !== null) {
                    throw ValidationException::withMessages([
                        "rooms.{$index}.room_id" => __(':room is not free for these dates: :reason', ['room' => $room->name, 'reason' => $reason]),
                    ]);
                }
            }

            $guest = $this->contactPerson($request);

            $reservation = Reservation::create([
                'guest_id' => $guest->id,
                'company' => $request->validated('company'),
                'purpose' => $request->validated('purpose'),
                'starts_at' => $start,
                'ends_at' => $end,
                'total' => $request->total(),
                'status' => ReservationStatus::Active,
                'booked_via' => BookingChannel::Reception,
                'booked_by' => $request->user()->id,
            ]);

            $reservation->rooms()->createMany($lines);

            if ($request->paymentAmount() > 0) {
                $reservation->payments()->create([
                    'amount' => $request->paymentAmount(),
                    'payment_type' => PaymentType::forBooking($request->total(), 0, $request->paymentAmount()),
                    'paid_by' => $request->validated('paid_by') ?? BilledTo::Guest->value,
                    'method' => $request->validated('payment_method'),
                    'receipt_number' => $request->validated('receipt_number'),
                    'received_by' => $request->user()->id,
                    'paid_at' => now(),
                ]);
            }

            return $reservation;
        });

        $alerts->booked($reservation, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => trans_choice(
            '{1} Reservation saved: 1 room for :name.|[2,*] Reservation saved: :count rooms for :name.',
            count($lines),
            ['name' => $reservation->guest->name],
        )]);

        // Walk-in: go straight on to the check-in form.
        return $request->boolean('check_in_now')
            ? to_route('reception.reservations.check-in.create', $reservation)
            : to_route('reception.reservations.show', $reservation);
    }

    /** Change an active reservation: dates, rooms, guests per room, prices and contact details. */
    public function update(StoreReservationRequest $request, Reservation $reservation, Availability $availability, FrontDeskAlerts $alerts): RedirectResponse
    {
        if (! $reservation->isActive()) {
            return $this->notActive($reservation);
        }

        $start = $request->startsAt();
        $end = $request->endsAt();
        $lines = $request->roomLines();
        $paid = $reservation->amountPaid();

        if ($request->total() < $paid) {
            throw ValidationException::withMessages([
                'rooms' => __('₱:paid was already paid, so the total cannot be less than that. Raise the prices, or cancel the booking to refund it.', ['paid' => number_format($paid, 2)]),
            ]);
        }

        DB::transaction(function () use ($request, $reservation, $availability, $start, $end, $lines) {
            // Lock the rooms so two desks cannot book the same room at once.
            $rooms = Room::query()->whereKey(array_column($lines, 'room_id'))->lockForUpdate()->get()->keyBy('id');
            // This reservation's own rooms and dates do not block it.
            $periods = $availability->busyPeriods(Availability::ids($rooms), $reservation->id);

            foreach ($lines as $index => $line) {
                $room = $rooms[$line['room_id']];
                $reason = $availability->blockedReason($room, $start, $end, $periods[$room->id]);

                if ($reason !== null) {
                    throw ValidationException::withMessages([
                        "rooms.{$index}.room_id" => __(':room is not free for these dates: :reason', ['room' => $room->name, 'reason' => $reason]),
                    ]);
                }
            }

            // A room that another guest's extension is waiting on cannot be dropped here.
            $removed = $reservation->rooms()->whereNotIn('room_id', array_column($lines, 'room_id'))->get();

            if (ExtensionMove::query()->whereIn('reservation_room_id', $removed->modelKeys())->exists()) {
                throw ValidationException::withMessages([
                    'rooms' => __('A room in this booking is part of another guest’s extension request. Answer that request first.'),
                ]);
            }

            $reservation->update([
                'guest_id' => $this->contactPerson($request)->id,
                'company' => $request->validated('company'),
                'purpose' => $request->validated('purpose'),
                'starts_at' => $start,
                'ends_at' => $end,
                'total' => $request->total(),
            ]);

            $reservation->rooms()->whereKey($removed->modelKeys())->delete();

            foreach ($lines as $line) {
                $reservation->rooms()->updateOrCreate(['room_id' => $line['room_id']], $line);
            }
        });

        $alerts->changed($reservation, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Reservation updated.')]);

        return to_route('reception.reservations.show', $reservation);
    }

    public function show(Reservation $reservation): Response
    {
        $reservation->load([
            'guest', 'booker:id,name', 'canceller:id,name',
            'rooms.room.location:id,name', 'rooms.rate.unit:id,name',
            'payments.receiver:id,name', 'refunds',
            'stay.checkedInBy:id,name', 'stay.rooms.room:id,name', 'stay.guests.room:id,name',
            'stay.idCustody.idType:id,name', 'stay.idCustody.receiver:id,name',
        ]);
        $stay = $reservation->stay;
        $custody = $stay?->idCustody;
        $paid = (float) $reservation->payments->sum('amount');
        $balance = max(0, (float) $reservation->total - $paid);
        $noShowFrom = $reservation->noShowAllowedFrom();

        return Inertia::render('reception/reservations/show', [
            'reservation' => [
                ...self::row($reservation),
                'email' => $reservation->guest->email,
                'guest_type' => $reservation->guest->type->label(),
                'purpose' => $reservation->purpose,
                'booked_via' => $reservation->booked_via->label(),
                'booked_by' => $reservation->booker->name,
                'booked_at' => $reservation->created_at->toIso8601String(),
                'cancelled_at' => $reservation->cancelled_at?->toIso8601String(),
                'cancelled_by' => $reservation->canceller?->name,
                'cancellation_reason' => $reservation->cancellation_reason,
                'balance' => number_format($balance, 2, '.', ''),
                'no_show_from' => $noShowFrom->toIso8601String(),
            ],
            'rooms' => $reservation->rooms->map(fn (ReservationRoom $line) => [
                'id' => $line->id,
                'room' => $line->room->name,
                'location' => $line->room->location->name,
                'pax' => $line->pax,
                'pax_capacity' => $line->room->pax_capacity,
                'rate' => $line->rate ? "{$line->rate->name} ({$line->rate->unit->name})" : null,
                'price' => $line->price,
            ]),
            'payments' => $reservation->payments->sortBy('paid_at')->values()->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'amount' => $payment->amount,
                'type' => $payment->payment_type->label(),
                'paid_by' => $payment->paid_by->label(),
                'method' => $payment->method,
                'receipt_number' => $payment->receipt_number,
                'received_by' => $payment->receiver->name,
                'paid_at' => $payment->paid_at->toIso8601String(),
            ]),
            'refunds' => $reservation->refunds->sortBy('id')->values()->map(fn (Refund $refund) => [
                'id' => $refund->id,
                'amount' => $refund->amount,
                'reason' => $refund->reason,
                'status' => $refund->status->value,
                'status_label' => $refund->status->label(),
            ]),
            'stay' => $stay === null ? null : [
                'stay_id' => $stay->id,
                'checked_in_at' => $stay->checked_in_at->toIso8601String(),
                'checked_in_by' => $stay->checkedInBy->name,
                'expected_check_out_at' => $stay->expected_check_out_at->toIso8601String(),
                'checked_out_at' => $stay->checked_out_at?->toIso8601String(),
                'rooms' => $stay->rooms->map(fn (StayRoom $line) => ['room' => $line->room->name, 'pax' => $line->pax])->values(),
                'guests' => $stay->guests->map(fn (StayGuest $guest) => [
                    'id' => $guest->id,
                    'name' => $guest->name,
                    'address' => $guest->address,
                    'contact_number' => $guest->contact_number,
                    'room' => $guest->room->name,
                ])->values(),
                'id' => $custody === null ? null : [
                    'type' => $custody->idType->name,
                    'number' => $custody->id_number,
                    'status' => $custody->status->label(),
                    'received_by' => $custody->receiver->name,
                    'photo_url' => $custody->photo_path ? route('reception.id-photos.show', $custody) : null,
                ],
            ],
            'can' => [
                'check_in' => $reservation->isActive(),
                'edit' => $reservation->isActive(),
                'pay' => $reservation->isActive() && $balance > 0,
                'cancel' => $reservation->isActive(),
                'no_show' => $reservation->isActive() && now()->gte($noShowFrom),
            ],
            'paymentMethods' => Payment::METHODS,
            'noShowRefund' => $this->noShowRefundPercent(),
        ]);
    }

    public function cancel(Request $request, Reservation $reservation, FrontDeskAlerts $alerts): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ], [], ['reason' => 'reason']);

        if (! $reservation->isActive()) {
            return $this->notActive($reservation);
        }

        $refunds = DB::transaction(function () use ($request, $reservation, $validated) {
            $reservation->update([
                'status' => ReservationStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $request->user()->id,
                'cancellation_reason' => $validated['reason'],
            ]);

            return $reservation->requestRefunds(100, __('Cancelled: :reason', ['reason' => $validated['reason']]), $request->user());
        });

        $alerts->cancelled($reservation, false, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => $refunds > 0
            ? trans_choice('{1} Reservation cancelled. 1 refund was requested.|[2,*] Reservation cancelled. :count refunds were requested.', $refunds)
            : __('Reservation cancelled.')]);

        return to_route('reception.reservations.show', $reservation);
    }

    public function markNoShow(Request $request, Reservation $reservation, FrontDeskAlerts $alerts): RedirectResponse
    {
        if (! $reservation->isActive()) {
            return $this->notActive($reservation);
        }

        if (now()->lt($reservation->noShowAllowedFrom())) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('The room is held until :time (grace period).', ['time' => $reservation->noShowAllowedFrom()->format('j M g:i A')])]);

            return to_route('reception.reservations.show', $reservation);
        }

        $refunds = DB::transaction(function () use ($request, $reservation) {
            $reservation->update(['status' => ReservationStatus::NoShow]);

            return $reservation->requestRefunds($this->noShowRefundPercent(), __('No-show'), $request->user());
        });

        $alerts->cancelled($reservation, true, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => $refunds > 0
            ? trans_choice('{1} Marked as a no-show. The rooms are free again and 1 refund was requested.|[2,*] Marked as a no-show. The rooms are free again and :count refunds were requested.', $refunds)
            : __('Marked as a no-show. The rooms are free again.')]);

        return to_route('reception.reservations.show', $reservation);
    }

    /**
     * The fields every reservation list shows.
     *
     * @return array<string, mixed>
     */
    public static function row(Reservation $reservation): array
    {
        $paid = $reservation->payments_sum_amount !== null
            ? (float) $reservation->payments_sum_amount
            : (float) $reservation->payments()->sum('amount');

        return [
            'id' => $reservation->id,
            'contact_name' => $reservation->guest->name,
            'contact_number' => $reservation->guest->contact_number,
            'company' => $reservation->company,
            'rooms' => $reservation->rooms->map(fn (ReservationRoom $line) => $line->room->name)->values(),
            'location' => $reservation->rooms->map(fn (ReservationRoom $line) => $line->room->location->name)->unique()->implode(', '),
            'pax' => (int) $reservation->rooms->sum('pax'),
            'starts_at' => $reservation->starts_at->toIso8601String(),
            'ends_at' => $reservation->ends_at->toIso8601String(),
            'total' => $reservation->total,
            'paid' => number_format($paid, 2, '.', ''),
            'payment_status' => PaymentStatus::for((float) $reservation->total, $paid)->value,
            'status' => $reservation->status->value,
            'status_label' => $reservation->status->label(),
            'overdue' => $reservation->isActive() && now()->gte($reservation->noShowAllowedFrom()),
        ];
    }

    /** A "2026-10-01T14:00" query value, or null when missing or malformed. */
    private static function parseTime(?string $value): ?CarbonImmutable
    {
        $time = $value === null ? null : CarbonImmutable::createFromFormat(StoreReservationRequest::DATE_FORMAT, $value);

        return $time instanceof CarbonImmutable ? $time : null;
    }

    /** The share of payments refunded on a no-show, from System settings (rule 17). */
    private function noShowRefundPercent(): int
    {
        return match (NoShowRefund::tryFrom((string) Setting::get('no_show_refund'))) {
            NoShowRefund::Partial => (int) Setting::get('no_show_refund_percent'),
            NoShowRefund::None => 0,
            default => 100,
        };
    }

    /** Reuse the contact person's record when the same name and number booked before. */
    private function contactPerson(StoreReservationRequest $request): Guest
    {
        $details = [
            'type' => $request->validated('guest_type'),
            'company' => $request->validated('company'),
            'email' => $request->validated('email'),
        ];

        $guest = Guest::query()
            ->where('contact_number', $request->validated('contact_number'))
            ->where('name', $request->validated('contact_name'))
            ->first();

        if ($guest === null) {
            return Guest::create([
                'name' => $request->validated('contact_name'),
                'contact_number' => $request->validated('contact_number'),
                ...$details,
            ]);
        }

        $guest->update(array_filter($details, fn ($value) => $value !== null));

        return $guest;
    }

    private function notActive(Reservation $reservation): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'error', 'message' => __('This reservation is already :status.', ['status' => strtolower($reservation->status->label())])]);

        return to_route('reception.reservations.show', $reservation);
    }
}
