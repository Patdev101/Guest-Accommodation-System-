<?php

namespace App\Http\Controllers\Reception;

use App\Enums\BilledTo;
use App\Enums\ChargeType;
use App\Enums\IdCustodyStatus;
use App\Enums\RefundStatus;
use App\Enums\RoomStatus;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Room;
use App\Models\Stay;
use App\Models\StayRoom;
use App\Services\Availability;
use App\Services\FrontDeskAlerts;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Extras on a stay: the printable bill, moving guests to another room,
 * a late check-out fee, and giving back an overpayment.
 */
class StayToolsController extends Controller
{
    /** A plain page of the bill and payments, made for printing or "Save as PDF". */
    public function bill(Stay $stay): View
    {
        $stay->load(['guest', 'reservation', 'rooms.room.location:id,name', 'charges', 'checkedInBy:id,name', 'checkedOutBy:id,name']);
        $payments = $stay->allPayments()->orderBy('paid_at')->get();
        $refunded = $stay->refundedOverpayment();
        $charged = (float) $stay->charges->sum('amount');
        $paid = (float) $payments->sum('amount');

        return view('print.bill', [
            'stay' => $stay,
            'company' => $stay->reservation->company ?? $stay->guest->company,
            'charges' => $stay->charges->sortBy('id')->values(),
            'payments' => $payments,
            'charged' => $charged,
            'paid' => $paid,
            'refunded' => $refunded,
            'balance' => round($charged - $paid + $refunded, 2),
            'printedBy' => request()->user()->name,
            'embed' => request()->boolean('embed'),
        ]);
    }

    /**
     * Move the guests of one room to another room during the stay, e.g. when
     * the aircon breaks. The old room goes to cleaning or to repair.
     */
    public function moveRoom(Request $request, Stay $stay, StayRoom $stayRoom, Availability $availability, FrontDeskAlerts $alerts): RedirectResponse
    {
        abort_unless($stayRoom->stay()->is($stay), 404);

        $validated = $request->validate([
            'to_room_id' => ['required', 'integer', Rule::exists(Room::class, 'id')],
            'reason' => ['required', 'string', 'max:255'],
            'old_room' => ['required', Rule::in(['cleaning', 'maintenance'])],
        ], [], ['to_room_id' => 'new room', 'old_room' => 'old room']);

        if ($stay->isCheckedOut()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('These guests have already checked out.')]);

            return to_route('reception.stays.show', $stay);
        }

        [$from, $to] = DB::transaction(function () use ($request, $stay, $stayRoom, $availability, $validated) {
            $from = Room::query()->whereKey($stayRoom->room_id)->lockForUpdate()->firstOrFail();
            $to = Room::query()->whereKey($validated['to_room_id'])->lockForUpdate()->firstOrFail();

            $problem = match (true) {
                $to->is($from) => __('Choose a different room.'),
                $to->status !== RoomStatus::Available => __(':room is :status, so guests cannot move in.', ['room' => $to->name, 'status' => strtolower($to->status->label())]),
                $stayRoom->pax > $to->pax_capacity => __(':room takes at most :count guests.', ['room' => $to->name, 'count' => $to->pax_capacity]),
                default => $availability->blockedReason($to, CarbonImmutable::now(), $stay->expected_check_out_at->max(CarbonImmutable::now()->addMinute())),
            };

            if ($problem !== null) {
                throw ValidationException::withMessages(['to_room_id' => $problem]);
            }

            $stayRoom->update(['room_id' => $to->id]);
            $stay->guests()->where('room_id', $from->id)->update(['room_id' => $to->id]);
            $to->update(['status' => RoomStatus::Occupied]);

            if ($validated['old_room'] === 'maintenance') {
                $from->maintenanceRecords()->create([
                    'performed_on' => today(),
                    'issue' => $validated['reason'],
                    'recorded_by' => $request->user()->id,
                ]);
                $from->update(['status' => RoomStatus::UnderMaintenance]);
            } else {
                $from->update(['status' => RoomStatus::Cleaning]);
            }

            ActivityLog::record('updated', $stay->reservation ?? $from, __('Moved :guest from :from to :to: :reason', [
                'guest' => $stay->guest->name, 'from' => $from->name, 'to' => $to->name, 'reason' => $validated['reason'],
            ]));

            return [$from, $to];
        });

        if ($validated['old_room'] === 'maintenance') {
            $alerts->roomOutOfUse($from, RoomStatus::UnderMaintenance, $validated['reason'], $request->user());
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Moved from :from to :to. :from is now :status.', [
            'from' => $from->name, 'to' => $to->name, 'status' => strtolower($from->status->label()),
        ])]);

        return to_route('reception.stays.show', $stay);
    }

    /** A fee for leaving late, without extending the stay. */
    public function lateFee(Request $request, Stay $stay): RedirectResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:9999999999.99'],
            'billed_to' => ['required', Rule::enum(BilledTo::class)],
        ]);

        $late = self::minutesLate($stay);

        if ($late <= 0) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('These guests are not past their check-out time.')]);

            return to_route('reception.stays.show', $stay);
        }

        if ($stay->idCustody()->where('status', IdCustodyStatus::Returned)->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('This stay is settled; its bill can no longer be changed.')]);

            return to_route('reception.stays.show', $stay);
        }

        $stay->charges()->create([
            'reservation_id' => $stay->reservation_id,
            'type' => ChargeType::Extra,
            'description' => __('Late check-out fee (:time late)', ['time' => self::duration($late)]),
            'amount' => round((float) $validated['amount'], 2),
            'billed_to' => $validated['billed_to'],
            'created_by' => $request->user()->id,
        ]);
        $stay->refreshIdCustody();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Late check-out fee added to the bill.')]);

        return to_route('reception.stays.show', $stay);
    }

    /** The stay was paid more than its final bill: ask for the difference to be given back. */
    public function refundOverpayment(Request $request, Stay $stay): RedirectResponse
    {
        $amount = $stay->overpaid();

        if (! $stay->isCheckedOut() || ! $stay->allRoomsInspected() || $amount <= 0) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $amount <= 0
                ? __('Nothing was overpaid on this stay.')
                : __('Check out and inspect every room first; charges may still be added.')]);

            return to_route('reception.stays.show', $stay);
        }

        $stay->refunds()->create([
            'reservation_id' => $stay->reservation_id,
            'amount' => $amount,
            'reason' => __('Overpayment on the final bill'),
            'status' => RefundStatus::Requested,
            'requested_by' => $request->user()->id,
            'requested_at' => now(),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Refund of ₱:amount requested. Finish it on the Refunds page.', ['amount' => number_format($amount, 2)])]);

        return to_route('reception.stays.show', $stay);
    }

    /** Minutes past the expected check-out: up to now, or up to the actual check-out. */
    public static function minutesLate(Stay $stay): int
    {
        $until = $stay->checked_out_at ?? CarbonImmutable::now();

        return max(0, (int) $stay->expected_check_out_at->diffInMinutes($until, false));
    }

    /**
     * A suggested late fee: each room's hourly extension rate for every started hour.
     * Rooms without an hourly extension rate add nothing; reception types the amount.
     *
     * @param  Collection<int, StayRoom>  $rooms  With room.rates.unit loaded.
     */
    public static function suggestedLateFee(Stay $stay, Collection $rooms): float
    {
        $hours = (int) ceil(self::minutesLate($stay) / 60);

        return round($rooms->sum(function (StayRoom $line) use ($hours) {
            $rate = $line->room->rates->firstWhere('is_extension_rate', true);

            return $rate !== null && str_contains(strtolower($rate->unit->name), 'hour') ? (float) $rate->price * $hours : 0;
        }), 2);
    }

    /** "45 minutes", "2 hours", "1 h 30 min". */
    public static function duration(int $minutes): string
    {
        $hours = intdiv($minutes, 60);
        $rest = $minutes % 60;

        return match (true) {
            $hours === 0 => trans_choice('{1} 1 minute|[2,*] :count minutes', max(1, $rest)),
            $rest === 0 => trans_choice('{1} 1 hour|[2,*] :count hours', $hours),
            default => "{$hours} h {$rest} min",
        };
    }
}
