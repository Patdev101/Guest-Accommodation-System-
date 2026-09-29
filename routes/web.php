<?php

use App\Http\Controllers\Admin\LocationController;
use App\Http\Controllers\Admin\MaintenanceRecordController;
use App\Http\Controllers\Admin\RateUnitController;
use App\Http\Controllers\Admin\RoomController;
use App\Http\Controllers\Admin\RoomInclusionController;
use App\Http\Controllers\Admin\RoomRateController;
use App\Http\Controllers\Admin\RoomStatusController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
        Route::resource('locations', LocationController::class)->only(['index', 'store', 'update', 'destroy']);

        Route::resource('rooms', RoomController::class)->except(['create', 'edit']);
        Route::patch('rooms/{room}/status', RoomStatusController::class)->name('rooms.status.update');

        Route::scopeBindings()->group(function () {
            Route::resource('rooms.inclusions', RoomInclusionController::class)->only(['store', 'update', 'destroy']);
            Route::resource('rooms.rates', RoomRateController::class)->only(['store', 'update', 'destroy']);
            Route::resource('rooms.maintenance', MaintenanceRecordController::class)
                ->only(['store', 'update', 'destroy'])
                ->parameters(['maintenance' => 'maintenanceRecord']);
        });

        Route::get('settings', [SettingsController::class, 'edit'])->name('settings.edit');
        Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
        Route::resource('rate-units', RateUnitController::class)
            ->only(['store', 'update', 'destroy'])
            ->parameters(['rate-units' => 'rateUnit']);

        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::patch('users/{user}', [UserController::class, 'update'])->name('users.update');
    });
});

require __DIR__.'/settings.php';
