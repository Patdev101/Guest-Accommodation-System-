<?php

namespace App\Http\Controllers\Reception;

use App\Enums\ReminderResult;
use App\Enums\ReminderType;
use App\Http\Controllers\Controller;
use App\Models\Stay;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * The call before check-out (rules 18, 19 and 21): reception calls the
 * contact number and records what the guest said.
 */
class ReminderController extends Controller
{
    public function store(Request $request, Stay $stay): RedirectResponse
    {
        $validated = $request->validate([
            'result' => ['required', Rule::enum(ReminderResult::class)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($stay->isCheckedOut()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('These guests have already checked out.')]);

            return back();
        }

        $result = ReminderResult::from($validated['result']);

        $stay->reminderLogs()->create([
            'type' => ReminderType::Call,
            'sent_at' => now(),
            'result' => $result,
            'notes' => $validated['notes'] ?? null,
            'logged_by' => $request->user()->id,
        ]);

        // Rule 19: not extending → the rooms can be booked from the expected check-out.
        if ($result === ReminderResult::CheckOut && $stay->not_extending_confirmed_at === null) {
            $stay->update(['not_extending_confirmed_at' => now()]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => match ($result) {
            ReminderResult::CheckOut => __('Call logged. The guests are not extending, so their rooms can be booked after check-out.'),
            ReminderResult::Extend => __('Call logged. Open the stay and use Extend stay to set the new check-out.'),
            ReminderResult::NoAnswer => __('Call logged: no answer. Try again later.'),
        }]);

        return back();
    }
}
