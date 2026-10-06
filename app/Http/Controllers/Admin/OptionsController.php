<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\IdCustody;
use App\Models\Payment;
use App\Models\Setting;
use App\Services\Housekeeping;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

/**
 * Admin options that are not business rules: payment methods, emailed alerts,
 * how long ID photos are kept, and backups.
 */
class OptionsController extends Controller
{
    public function edit(Housekeeping $housekeeping): Response
    {
        return Inertia::render('admin/options', [
            'paymentMethods' => Payment::methods(),
            'alertEmails' => Setting::get('alert_emails') === '1',
            'retentionDays' => (int) Setting::get('id_photo_retention_days'),
            'photos' => [
                'kept' => IdCustody::query()->whereNotNull('photo_path')->count(),
                'returned' => $housekeeping->photosDue(0)->count(),
                'due' => (int) Setting::get('id_photo_retention_days') > 0 ? $housekeeping->photosDue()->count() : 0,
            ],
            'backupsToKeep' => (int) Setting::get('backups_to_keep'),
            'backups' => $housekeeping->backups(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'payment_methods' => ['required', 'string', 'max:600'],
            'alert_emails' => ['required', 'boolean'],
            'id_photo_retention_days' => ['required', 'integer', 'min:0', 'max:3650'],
            'backups_to_keep' => ['required', 'integer', 'min:1', 'max:60'],
        ], [], [
            'payment_methods' => 'payment methods',
            'id_photo_retention_days' => 'days',
            'backups_to_keep' => 'backups to keep',
        ]);

        // One method per line (commas work too).
        $methods = collect(preg_split('/[\r\n,]+/', $validated['payment_methods']) ?: [])
            ->map(fn (string $name) => Str::squish($name))
            ->filter()
            ->unique(fn (string $name) => strtolower($name))
            ->values();

        if ($methods->isEmpty() || $methods->count() > 12 || $methods->contains(fn (string $name) => strlen($name) > 30)) {
            throw ValidationException::withMessages([
                'payment_methods' => __('List 1 to 12 payment methods, one per line, each up to 30 characters.'),
            ]);
        }

        Setting::set('payment_methods', $methods->implode(', '));
        Setting::set('alert_emails', $validated['alert_emails'] ? '1' : '0');
        Setting::set('id_photo_retention_days', (string) $validated['id_photo_retention_days']);
        Setting::set('backups_to_keep', (string) $validated['backups_to_keep']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Options saved.')]);

        return to_route('admin.options.edit');
    }

    /** Delete the photos of IDs that were already returned (all of them, or only those past the period). */
    public function deletePhotos(Request $request, Housekeeping $housekeeping): RedirectResponse
    {
        $all = $request->boolean('all');
        $deleted = $housekeeping->deletePhotos($all ? 0 : null);

        if ($deleted > 0) {
            ActivityLog::record('deleted', $request->user(), trans_choice('{1} Deleted 1 ID photo of a returned ID|[2,*] Deleted :count ID photos of returned IDs', $deleted));
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $deleted === 0
            ? __('No ID photos to delete.')
            : trans_choice('{1} 1 ID photo deleted.|[2,*] :count ID photos deleted.', $deleted)]);

        return to_route('admin.options.edit');
    }

    public function backup(Request $request, Housekeeping $housekeeping): RedirectResponse
    {
        try {
            $name = $housekeeping->backup();
        } catch (Throwable $exception) {
            report($exception);

            Inertia::flash('toast', ['type' => 'error', 'message' => __('The backup failed: :reason', ['reason' => Str::limit($exception->getMessage(), 140)])]);

            return to_route('admin.options.edit');
        }

        ActivityLog::record('created', $request->user(), "Made backup {$name}");
        Inertia::flash('toast', ['type' => 'success', 'message' => __('Backup made: :name. Download it and keep a copy off this computer.', ['name' => $name])]);

        return to_route('admin.options.edit');
    }

    public function download(Request $request, string $backup, Housekeeping $housekeeping): BinaryFileResponse
    {
        $path = $housekeeping->backupPath($backup);
        abort_if($path === null, 404);

        ActivityLog::record('updated', $request->user(), "Downloaded backup {$backup}");

        return response()->download($path, $backup);
    }

    public function destroyBackup(string $backup, Housekeeping $housekeeping): RedirectResponse
    {
        abort_unless($housekeeping->deleteBackup($backup), 404);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Backup deleted.')]);

        return to_route('admin.options.edit');
    }
}
