<?php

namespace App\Http\Controllers\Reception;

use App\Enums\ConsentStatus;
use App\Enums\ExtensionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reception\StoreReservationRequest;
use App\Models\Extension;
use App\Models\ExtensionMove;
use App\Models\Room;
use App\Models\Stay;
use App\Services\FrontDeskAlerts;
use App\Services\StayExtension;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Stay longer (rules 20 and 21), including Guest B's answer when their room
 * is needed, recorded by reception after calling them.
 */
class ExtensionController extends Controller
{
    public function store(Request $request, Stay $stay, StayExtension $extensions, FrontDeskAlerts $alerts): RedirectResponse
    {
        $validated = $request->validate([
            'new_check_out_at' => ['required', 'date_format:'.StoreReservationRequest::DATE_FORMAT, 'after:'.$stay->expected_check_out_at->format('Y-m-d H:i')],
            'price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'moves' => ['nullable', 'array'],
            'moves.*.reservation_room_id' => ['required', 'integer'],
            'moves.*.to_room_id' => ['nullable', 'integer', Rule::exists(Room::class, 'id')],
            'moves.*.consent' => ['required', Rule::enum(ConsentStatus::class)],
        ], [
            'new_check_out_at.after' => __('Choose a time after the current check-out.'),
        ], ['new_check_out_at' => 'new check-out']);

        if ($stay->isCheckedOut()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('These guests have already checked out.')]);

            return to_route('reception.stays.show', $stay);
        }

        $newCheckOut = CarbonImmutable::createFromFormat(StoreReservationRequest::DATE_FORMAT, $validated['new_check_out_at'])->startOfMinute();
        $answers = $request->collect('moves')->keyBy('reservation_room_id');

        $extension = DB::transaction(function () use ($request, $stay, $extensions, $validated, $newCheckOut, $answers) {
            $extension = $stay->extensions()->create([
                'old_check_out_at' => $stay->expected_check_out_at,
                'new_check_out_at' => $newCheckOut,
                'price' => round((float) $validated['price'], 2),
                'status' => ExtensionStatus::PendingConsent,
                'requested_by' => $request->user()->id,
            ]);

            foreach ($extensions->conflicts($stay, $newCheckOut) as $line) {
                $answer = $answers->get($line->id);
                $toRoomId = $answer['to_room_id'] ?? null;
                $consent = $toRoomId === null ? ConsentStatus::Pending : ConsentStatus::from($answer['consent']);

                if ($toRoomId !== null && ! $extensions->alternatives($line, $stay)->contains('id', (int) $toRoomId)) {
                    $toRoomId = null;
                }

                $extension->moves()->create([
                    'reservation_room_id' => $line->id,
                    'from_room_id' => $line->room_id,
                    'to_room_id' => $toRoomId,
                    'consent_status' => $consent,
                    'consent_responded_at' => $consent === ConsentStatus::Pending ? null : now(),
                    'consent_recorded_by' => $consent === ConsentStatus::Pending ? null : $request->user()->id,
                ]);
            }

            $extensions->settle($extension, $stay, $request->user());

            return $extension;
        });
        $status = $extension->status;

        $this->announce($stay, $extension, $request, $alerts);

        Inertia::flash('toast', match ($status) {
            ExtensionStatus::Approved => ['type' => 'success', 'message' => __('Stay extended to :time.', ['time' => $newCheckOut->format('j M g:i A')])],
            ExtensionStatus::PendingConsent => ['type' => 'success', 'message' => __('Saved. Record the next guest’s answer to finish the extension.')],
            ExtensionStatus::Denied => ['type' => 'error', 'message' => __('Extension denied: :reason', ['reason' => (string) $extension->denial_reason])],
        });

        return to_route('reception.stays.show', $stay);
    }

    /** Record Guest B's answers for an extension that is waiting on them. */
    public function decide(Request $request, Extension $extension, StayExtension $extensions, FrontDeskAlerts $alerts): RedirectResponse
    {
        $validated = $request->validate([
            'answers' => ['required', 'array'],
            'answers.*' => ['required', Rule::in([ConsentStatus::Agreed->value, ConsentStatus::Declined->value])],
        ]);
        $stay = $extension->stay()->firstOrFail();

        if ($extension->status !== ExtensionStatus::PendingConsent || $stay->isCheckedOut()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('This extension is already decided.')]);

            return to_route('reception.stays.show', $stay);
        }

        $status = DB::transaction(function () use ($request, $extension, $extensions, $stay, $validated) {
            foreach ($extension->moves()->get() as $move) {
                /** @var ExtensionMove $move */
                $answer = $validated['answers'][$move->id] ?? null;

                if ($answer !== null && $move->consent_status === ConsentStatus::Pending) {
                    $move->update([
                        'consent_status' => $answer,
                        'consent_responded_at' => now(),
                        'consent_recorded_by' => $request->user()->id,
                    ]);
                }
            }

            return $extensions->settle($extension, $stay, $request->user());
        });

        $this->announce($stay, $extension->refresh(), $request, $alerts);

        Inertia::flash('toast', $status === ExtensionStatus::Approved
            ? ['type' => 'success', 'message' => __('The next guest agreed. Stay extended to :time.', ['time' => $extension->new_check_out_at->format('j M g:i A')])]
            : ['type' => $status === ExtensionStatus::Denied ? 'error' : 'success', 'message' => $status === ExtensionStatus::Denied
                ? __('Extension denied: :reason', ['reason' => (string) $extension->refresh()->denial_reason])
                : __('Answer saved. Still waiting for the rest.')]);

        return to_route('reception.stays.show', $stay);
    }

    /** Rule 27: tell the front desk an extension is decided, or is waiting on the next guest. */
    private function announce(Stay $stay, Extension $extension, Request $request, FrontDeskAlerts $alerts): void
    {
        if ($extension->status === ExtensionStatus::PendingConsent) {
            $alerts->extensionWaiting($stay->refresh(), $extension, $request->user());

            return;
        }

        $alerts->extensionDecided(
            $stay->refresh(),
            $extension->status === ExtensionStatus::Approved,
            $extension->denial_reason,
            $request->user(),
        );
    }
}
