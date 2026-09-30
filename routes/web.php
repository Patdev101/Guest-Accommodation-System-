<?php

use App\Http\Controllers\Admin\ActivityLogController;
use App\Http\Controllers\Admin\IdTypeController;
use App\Http\Controllers\Admin\LocationController;
use App\Http\Controllers\Admin\MaintenanceRecordController;
use App\Http\Controllers\Admin\RateUnitController;
use App\Http\Controllers\Admin\RoomController;
use App\Http\Controllers\Admin\RoomCopyController;
use App\Http\Controllers\Admin\RoomInclusionController;
use App\Http\Controllers\Admin\RoomPhotoController;
use App\Http\Controllers\Admin\RoomRateController;
use App\Http\Controllers\Admin\RoomStatusController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Reception\AlertController;
use App\Http\Controllers\Reception\CalendarController;
use App\Http\Controllers\Reception\ChargeController;
use App\Http\Controllers\Reception\CheckInController;
use App\Http\Controllers\Reception\ExtensionController;
use App\Http\Controllers\Reception\IdPhotoController;
use App\Http\Controllers\Reception\InspectionController;
use App\Http\Controllers\Reception\RefundController;
use App\Http\Controllers\Reception\ReminderController;
use App\Http\Controllers\Reception\ReservationController;
use App\Http\Controllers\Reception\ReservationPaymentController;
use App\Http\Controllers\Reception\RoomStatusController as ReceptionRoomStatusController;
use App\Http\Controllers\Reception\StayController;
use App\Http\Controllers\Reception\StayPaymentController;
use Illuminate\Support\Facades\Route;

// Admin-only phase: the home address goes straight to the dashboard (or the
// login page). It becomes the public, Airbnb-style room browsing page later.
Route::get('/', fn () => auth()->check() ? to_route('dashboard') : to_route('login'))->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    // Front desk: Reception, and the Admin, who can do everything Reception can.
    Route::middleware('role:reception,admin')->prefix('reception')->name('reception.')->group(function () {
        Route::resource('reservations', ReservationController::class)->only(['index', 'create', 'store', 'show']);
        Route::patch('reservations/{reservation}/cancel', [ReservationController::class, 'cancel'])->name('reservations.cancel');
        Route::patch('reservations/{reservation}/no-show', [ReservationController::class, 'markNoShow'])->name('reservations.no-show');
        Route::post('reservations/{reservation}/payments', [ReservationPaymentController::class, 'store'])->name('reservations.payments.store');
        Route::get('reservations/{reservation}/check-in', [CheckInController::class, 'create'])->name('reservations.check-in.create');
        Route::post('reservations/{reservation}/check-in', [CheckInController::class, 'store'])->name('reservations.check-in.store');
        Route::get('id-photos/{idCustody}', IdPhotoController::class)->name('id-photos.show');

        Route::get('calendar', CalendarController::class)->name('calendar');

        Route::get('alerts', [AlertController::class, 'index'])->name('alerts.index');
        Route::post('alerts/read-all', [AlertController::class, 'readAll'])->name('alerts.read-all');
        Route::post('alerts/{alert}/read', [AlertController::class, 'read'])->name('alerts.read');

        Route::get('stays', [StayController::class, 'index'])->name('stays.index');
        Route::get('stays/{stay}', [StayController::class, 'show'])->name('stays.show');
        Route::post('stays/{stay}/check-out', [StayController::class, 'checkOut'])->name('stays.check-out');
        Route::post('stays/{stay}/return-id', [StayController::class, 'returnId'])->name('stays.return-id');
        Route::post('stays/{stay}/rooms/{stayRoom}/inspection', [InspectionController::class, 'store'])->name('stays.inspections.store');
        Route::post('stays/{stay}/charges', [ChargeController::class, 'store'])->name('stays.charges.store');
        Route::patch('charges/{charge}', [ChargeController::class, 'update'])->name('charges.update');
        Route::delete('charges/{charge}', [ChargeController::class, 'destroy'])->name('charges.destroy');
        Route::post('stays/{stay}/payments', [StayPaymentController::class, 'store'])->name('stays.payments.store');
        Route::patch('stays/{stay}/not-extending', [StayController::class, 'notExtending'])->name('stays.not-extending');
        Route::post('stays/{stay}/extensions', [ExtensionController::class, 'store'])->name('stays.extensions.store');
        Route::patch('extensions/{extension}/decide', [ExtensionController::class, 'decide'])->name('extensions.decide');
        Route::post('stays/{stay}/reminders', [ReminderController::class, 'store'])->name('stays.reminders.store');
        Route::patch('rooms/{room}/status', ReceptionRoomStatusController::class)->name('rooms.status.update');

        Route::get('refunds', [RefundController::class, 'index'])->name('refunds.index');
        Route::patch('refunds/{refund}/advance', [RefundController::class, 'advance'])->name('refunds.advance');
    });

    Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
        Route::resource('locations', LocationController::class)->only(['index', 'store', 'update', 'destroy']);

        Route::resource('rooms', RoomController::class)->except(['create', 'edit']);
        Route::patch('rooms/{room}/status', RoomStatusController::class)->name('rooms.status.update');
        Route::post('rooms/{room}/copies', RoomCopyController::class)->name('rooms.copies.store');

        Route::scopeBindings()->group(function () {
            Route::resource('rooms.inclusions', RoomInclusionController::class)->only(['store', 'update', 'destroy']);
            Route::put('rooms/{room}/photos/order', [RoomPhotoController::class, 'reorder'])->name('rooms.photos.reorder');
            Route::resource('rooms.photos', RoomPhotoController::class)->only(['store', 'update', 'destroy']);
            Route::resource('rooms.rates', RoomRateController::class)->only(['store', 'update', 'destroy']);
            Route::resource('rooms.maintenance', MaintenanceRecordController::class)
                ->only(['store', 'update', 'destroy'])
                ->parameters(['maintenance' => 'maintenanceRecord']);
        });

        Route::get('settings', [SettingsController::class, 'edit'])->name('settings.edit');
        Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
        Route::post('settings/test-email', [SettingsController::class, 'testEmail'])
            ->middleware('throttle:5,1')
            ->name('settings.test-email');
        Route::resource('rate-units', RateUnitController::class)
            ->only(['store', 'update', 'destroy'])
            ->parameters(['rate-units' => 'rateUnit']);
        Route::resource('id-types', IdTypeController::class)
            ->only(['store', 'update', 'destroy'])
            ->parameters(['id-types' => 'idType']);

        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::patch('users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::put('users/{user}/password', [UserController::class, 'password'])->name('users.password');
        Route::post('users/{user}/password-reset-link', [UserController::class, 'sendResetLink'])
            ->middleware('throttle:6,1')
            ->name('users.reset-link');
        Route::patch('users/{user}/deactivate', [UserController::class, 'deactivate'])->name('users.deactivate');
        Route::patch('users/{user}/activate', [UserController::class, 'activate'])->name('users.activate');

        Route::get('activity', [ActivityLogController::class, 'index'])->name('activity.index');
    });
});

require __DIR__.'/settings.php';
