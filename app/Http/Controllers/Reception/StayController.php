<?php

namespace App\Http\Controllers\Reception;

use App\Enums\BilledTo;
use App\Enums\ChargeType;
use App\Enums\ExtensionStatus;
use App\Enums\IdCustodyStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoomStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reception\StoreReservationRequest;
use App\Models\Charge;
use App\Models\Extension;
use App\Models\ExtensionMove;
use App\Models\Payment;
use App\Models\ReminderLog;
use App\Models\ReservationRoom;
use App\Models\Room;
use App\Models\Stay;
use App\Models\StayGuest;
use App\Models\StayRoom;
use App\Services\Availability;
use App\Services\StayExtension;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Checked-in bookings: who is in house, check-out, the bill and the ID
 * (rules 22 to 25).
 */
class StayController extends Controller
{
    public const FILTERS = [
        'in_house' => 'In house',
        'to_settle' => 'Checked out, to settle',
        'settled' => 'Settled',
        'all' => 'All',
    ];

    public function index(Request $request): Response
    {
        $show = $request->validate([
            'show' => ['nullable', Rule::in(array_keys(self::FILTERS))],
        ])['show'] ?? 'in_house';

        $query = Stay::query()->with(['guest:id,name,contact_number', 'reservation:id,company', 'rooms.room:id,name', 'idCustody']);

        $query = match ($show) {
            'in_house' => $query->whereNull('checked_out_at')->orderBy('expected_check_out_at'),
            'to_settle' => self::toSettle($query)->orderBy('checked_out_at'),
            'settled' => $query->whereNotNull('checked_out_at')
                ->whereDoesntHave('rooms', fn (Builder $rooms) => $rooms->whereNull('inspected_at'))
                ->whereDoesntHave('idCustody', fn (Builder $custody) => $custody->where('status', '!=', IdCustodyStatus::Returned))
                ->orderByDesc('checked_out_at'),
            default => $query->orderByDesc('checked_in_at'),
        };

        return Inertia::render('reception/stays/index', [
            'stays' => $query->orderByDesc('id')->paginate(25)->withQueryString()->through(fn (Stay $stay) => self::row($stay)),
            'show' => $show,
            'filterOptions' => collect(self::FILTERS)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
        ]);
    }

    public function show(Request $request, Stay $stay, StayExtension $extensions): Response
    {
        $extendTo = $request->query('extend_to');
        $stay->load([
            'guest', 'reservation', 'checkedInBy:id,name', 'checkedOutBy:id,name',
            'rooms.room.location:id,name', 'rooms.room.rates.unit:id,name', 'rooms.inspector:id,name', 'guests.room:id,name',
            'idCustody.idType:id,name', 'idCustody.receiver:id,name', 'idCustody.returner:id,name',
            'charges', 'extensions.requester:id,name', 'extensions.moves.fromRoom:id,name', 'extensions.moves.toRoom:id,name',
            'extensions.moves.reservationRoom.reservation.guest:id,name,contact_number', 'reminderLogs.logger:id,name',
        ]);

        $payments = $stay->allPayments()->with('receiver:id,name')->orderBy('paid_at')->get();
        $custody = $stay->idCustody;
        $settled = $stay->isCheckedOut() && ($custody?->status === IdCustodyStatus::Returned || ($custody === null && $stay->idReturnBlocker() === null));

        return Inertia::render('reception/stays/show', [
            'stay' => [
                ...self::row($stay),
                'purpose' => $stay->reservation?->purpose,
                'email' => $stay->guest->email,
                'checked_in_by' => $stay->checkedInBy->name,
                'checked_out_by' => $stay->checkedOutBy?->name,
                'not_extending_confirmed_at' => $stay->not_extending_confirmed_at?->toIso8601String(),
                'default_billed_to' => $stay->defaultBilledTo()->value,
            ],
            'rooms' => $stay->rooms->map(fn (StayRoom $line) => [
                'id' => $line->id,
                'room_id' => $line->room_id,
                'name' => $line->room->name,
                'location' => $line->room->location->name,
                'pax' => $line->pax,
                'status_label' => $line->room->status->label(),
                'group' => $line->room->status->group()->value,
                'inspected_at' => $line->inspected_at?->toIso8601String(),
                'inspected_by' => $line->inspector?->name,
                'extension_rate' => $this->extensionRate($line),
            ]),
            'guests' => $stay->guests->map(fn (StayGuest $guest) => [
                'id' => $guest->id,
                'name' => $guest->name,
                'address' => $guest->address,
                'contact_number' => $guest->contact_number,
                'room' => $guest->room->name,
            ]),
            'id' => $custody === null ? null : [
                'type' => $custody->idType->name,
                'number' => $custody->id_number,
                'status' => $custody->status->value,
                'status_label' => $custody->status->label(),
                'received_by' => $custody->receiver->name,
                'returned_at' => $custody->returned_at?->toIso8601String(),
                'returned_by' => $custody->returner?->name,
                'photo_url' => $custody->photo_path ? route('reception.id-photos.show', $custody) : null,
            ],
            'charges' => $stay->charges->sortBy('id')->values()->map(fn (Charge $charge) => [
                'id' => $charge->id,
                'type' => $charge->type->value,
                'type_label' => $charge->type->label(),
                'description' => $charge->description,
                'amount' => $charge->amount,
                'billed_to' => $charge->billed_to->value,
            ]),
            'payments' => $payments->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'amount' => $payment->amount,
                'type' => $payment->payment_type->label(),
                'paid_by' => $payment->paid_by->value,
                'method' => $payment->method,
                'receipt_number' => $payment->receipt_number,
                'received_by' => $payment->receiver->name,
                'paid_at' => $payment->paid_at->toIso8601String(),
                'before_check_in' => $payment->stay_id === null,
            ]),
            'bill' => $this->bill($stay, $payments),
            'extensions' => $stay->extensions->sortByDesc('id')->values()->map(fn (Extension $extension) => [
                'id' => $extension->id,
                'old_check_out_at' => $extension->old_check_out_at->toIso8601String(),
                'new_check_out_at' => $extension->new_check_out_at->toIso8601String(),
                'price' => $extension->price,
                'status' => $extension->status->value,
                'status_label' => $extension->status->label(),
                'denial_reason' => $extension->denial_reason,
                'requested_by' => $extension->requester->name,
                'moves' => $extension->moves->map(fn (ExtensionMove $move) => [
                    'id' => $move->id,
                    'consent_status' => $move->consent_status->value,
                    'contact_number' => $move->reservationRoom->reservation->guest->contact_number,
                    'guest' => $move->reservationRoom->reservation->guest->name,
                    'from' => $move->fromRoom->name,
                    'to' => $move->toRoom?->name,
                    'consent' => $move->consent_status->label(),
                ])->values(),
            ]),
            'reminders' => $stay->reminderLogs->sortByDesc('sent_at')->values()->map(fn (ReminderLog $log) => [
                'id' => $log->id,
                'sent_at' => $log->sent_at->toIso8601String(),
                'result' => $log->result?->label(),
                'notes' => $log->notes,
                'logged_by' => $log->logger?->name,
            ]),
            'can' => [
                'check_out' => ! $stay->isCheckedOut(),
                'extend' => ! $stay->isCheckedOut(),
                'confirm_not_extending' => ! $stay->isCheckedOut() && $stay->not_extending_confirmed_at === null,
                'change_bill' => ! $settled,
                'return_id' => $custody !== null && $custody->status !== IdCustodyStatus::Returned,
                'return_id_blocker' => $stay->idReturnBlocker(),
            ],
            'paymentMethods' => Payment::methods(),
            // Late fee, overpayment and room change (StayToolsController).
            'tools' => [
                'overpaid' => number_format($stay->overpaid(), 2, '.', ''),
                'can_refund_overpayment' => $stay->isCheckedOut() && $stay->allRoomsInspected() && $stay->overpaid() > 0,
                'minutes_late' => StayToolsController::minutesLate($stay),
                'late_text' => StayToolsController::duration(max(1, StayToolsController::minutesLate($stay))),
                'late_fee' => number_format(StayToolsController::suggestedLateFee($stay, $stay->rooms), 2, '.', ''),
                'move_rooms' => $stay->isCheckedOut() ? [] : $this->roomsToMoveTo($stay),
            ],
            // Filled when the Extend dialog asks: who is in the way, and where they could go.
            'extensionCheck' => fn () => is_string($extendTo) ? $this->extensionCheck($stay, $extendTo, $extensions) : null,
        ]);
    }

    /** Rule 19: the guest will not extend, so the rooms can be booked from the expected check-out. */
    public function notExtending(Stay $stay): RedirectResponse
    {
        if (! $stay->isCheckedOut() && $stay->not_extending_confirmed_at === null) {
            $stay->update(['not_extending_confirmed_at' => now()]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Noted: not extending. The rooms can be booked from :time.', [
            'time' => $stay->expected_check_out_at->format('j M g:i A'),
        ])]);

        return to_route('reception.stays.show', $stay);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function extensionCheck(Stay $stay, string $extendTo, StayExtension $extensions): ?array
    {
        $newCheckOut = CarbonImmutable::createFromFormat(StoreReservationRequest::DATE_FORMAT, $extendTo);

        if (! $newCheckOut instanceof CarbonImmutable || $newCheckOut->lte($stay->expected_check_out_at)) {
            return null;
        }

        return [
            'new_check_out_at' => $newCheckOut->format(StoreReservationRequest::DATE_FORMAT),
            'conflicts' => $extensions->conflicts($stay, $newCheckOut)->map(fn (ReservationRoom $line) => [
                'reservation_room_id' => $line->id,
                'reservation_id' => $line->reservation_id,
                'guest' => $line->reservation->guest->name,
                'contact_number' => $line->reservation->guest->contact_number,
                'room' => $line->room->name,
                'pax' => $line->pax,
                'starts_at' => $line->reservation->starts_at->toIso8601String(),
                'ends_at' => $line->reservation->ends_at->toIso8601String(),
                'alternatives' => $extensions->alternatives($line, $stay)->map(fn (Room $room) => [
                    'id' => $room->id,
                    'name' => $room->name,
                    'location' => $room->location->name,
                    'pax_capacity' => $room->pax_capacity,
                ])->values(),
            ])->values(),
        ];
    }

    /** Rule 22: record the check-out first, so the guests may leave; the rooms go to inspection. */
    public function checkOut(Request $request, Stay $stay): RedirectResponse
    {
        if ($stay->isCheckedOut()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('These guests have already checked out.')]);

            return to_route('reception.stays.show', $stay);
        }

        DB::transaction(function () use ($request, $stay) {
            $stay->addRoomCharges($request->user());
            $stay->update(['checked_out_at' => now(), 'checked_out_by' => $request->user()->id]);

            foreach ($stay->rooms()->with('room')->get() as $line) {
                if (in_array($line->room->status, [RoomStatus::Occupied, RoomStatus::CheckOut], true)) {
                    $line->room->update(['status' => RoomStatus::Inspection]);
                }
            }

            $stay->reservation?->update(['status' => ReservationStatus::CheckedOut]);
            $stay->refreshIdCustody();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Checked out. Inspect the rooms, then settle the bill and return the ID.')]);

        return to_route('reception.stays.show', $stay);
    }

    /** Rule 24: the ID goes back only when every room is inspected and nothing is owed. */
    public function returnId(Request $request, Stay $stay): RedirectResponse
    {
        $custody = $stay->idCustody()->first();
        $blocker = $stay->idReturnBlocker();

        if ($custody === null || $custody->status === IdCustodyStatus::Returned || $blocker !== null) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $blocker ?? __('There is no ID to return.')]);

            return to_route('reception.stays.show', $stay);
        }

        $custody->update([
            'status' => IdCustodyStatus::Returned,
            'returned_at' => now(),
            'returned_by' => $request->user()->id,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('ID returned to :name. This stay is settled.', ['name' => $stay->guest->name])]);

        return to_route('reception.stays.show', $stay);
    }

    /**
     * Checked out, but a room is not inspected yet or the ID is still held.
     *
     * @param  Builder<Stay>  $query
     * @return Builder<Stay>
     */
    public static function toSettle(Builder $query): Builder
    {
        return $query->whereNotNull('checked_out_at')->where(fn (Builder $query) => $query
            ->whereHas('rooms', fn (Builder $rooms) => $rooms->whereNull('inspected_at'))
            ->orWhereHas('idCustody', fn (Builder $custody) => $custody->where('status', '!=', IdCustodyStatus::Returned)));
    }

    /**
     * The fields every stay list shows.
     *
     * @return array<string, mixed>
     */
    public static function row(Stay $stay): array
    {
        $custody = $stay->idCustody;
        $balance = $stay->balance();
        $inspected = $stay->rooms->every(fn (StayRoom $line) => $line->inspected_at !== null);

        return [
            'id' => $stay->id,
            'reservation_id' => $stay->reservation_id,
            'contact_name' => $stay->guest->name,
            'contact_number' => $stay->guest->contact_number,
            'company' => $stay->reservation->company ?? $stay->guest->company,
            'rooms' => $stay->rooms->map(fn (StayRoom $line) => $line->room->name)->values(),
            'pax' => (int) $stay->rooms->sum('pax'),
            'checked_in_at' => $stay->checked_in_at->toIso8601String(),
            'expected_check_out_at' => $stay->expected_check_out_at->toIso8601String(),
            'checked_out_at' => $stay->checked_out_at?->toIso8601String(),
            'balance' => number_format($balance, 2, '.', ''),
            'id_status' => $custody?->status->label(),
            'state' => match (true) {
                ! $stay->isCheckedOut() => 'in_house',
                ! $inspected || ($custody !== null && $custody->status !== IdCustodyStatus::Returned) => 'to_settle',
                default => 'settled',
            },
            'overdue' => ! $stay->isCheckedOut() && $stay->expected_check_out_at->isPast(),
        ];
    }

    /**
     * What was charged and paid, by who pays (company or guest).
     *
     * @param  Collection<int, Payment>  $payments
     * @return array<string, string>
     */
    private function bill(Stay $stay, $payments): array
    {
        $refunded = $stay->refundedOverpayment();
        $charged = fn (?BilledTo $to) => (float) $stay->charges->when($to, fn ($charges) => $charges->where('billed_to', $to))->sum('amount');
        $paid = fn (?BilledTo $to) => (float) $payments->when($to, fn ($list) => $list->where('paid_by', $to))->sum('amount');
        $money = fn (float $value) => number_format($value, 2, '.', '');

        return [
            'charged' => $money($charged(null)),
            'paid' => $money($paid(null)),
            // An overpayment that is being given back no longer counts as paid.
            'balance' => $money($charged(null) - $paid(null) + $refunded),
            'refunded' => $money($refunded),
            'company_charged' => $money($charged(BilledTo::Company)),
            'company_paid' => $money($paid(BilledTo::Company)),
            'guest_charged' => $money($charged(BilledTo::Guest)),
            'guest_paid' => $money($paid(BilledTo::Guest)),
            'extensions' => $money((float) $stay->charges->where('type', ChargeType::Extension)->sum('amount')),
            'pending_extensions' => (string) $stay->extensions->where('status', ExtensionStatus::PendingConsent)->count(),
        ];
    }

    /**
     * Available rooms the guests could move to now, free until the expected check-out.
     *
     * @return list<array{id: int, name: string, location: string, pax_capacity: int}>
     */
    private function roomsToMoveTo(Stay $stay): array
    {
        $availability = app(Availability::class);
        $now = CarbonImmutable::now();
        $until = $stay->expected_check_out_at->max($now->addMinute());

        return array_values(Room::query()
            ->with('location:id,name')
            ->where('status', RoomStatus::Available)
            ->get()
            ->filter(fn (Room $room) => $availability->blockedReason($room, $now, $until) === null)
            ->sortBy(fn (Room $room) => $room->location->name."\0".$room->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->map(fn (Room $room) => [
                'id' => $room->id,
                'name' => $room->name,
                'location' => $room->location->name,
                'pax_capacity' => $room->pax_capacity,
            ])
            ->all());
    }

    /**
     * The room's extension rate, used to price extra time (rule 21).
     *
     * @return array{name: string, price: string, unit: string}|null
     */
    private function extensionRate(StayRoom $line): ?array
    {
        $rate = $line->room->rates->firstWhere('is_extension_rate', true);

        return $rate === null ? null : ['name' => $rate->name, 'price' => $rate->price, 'unit' => $rate->unit->name];
    }
}
