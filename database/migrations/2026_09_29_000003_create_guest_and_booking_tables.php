<?php

use App\Enums\GuestType;
use App\Enums\ReservationStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained();
            $table->string('name');
            $table->string('type', 20)->default(GuestType::Visitor->value);
            $table->string('company')->nullable();
            $table->string('contact_number', 30);
            $table->timestamps();
        });

        // "Reserved" is derived from this table, not stored on the room.
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('guest_id')->constrained();
            $table->foreignId('room_id')->constrained();
            $table->foreignId('room_rate_id')->nullable()->constrained();
            $table->unsignedSmallInteger('pax');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->decimal('total', 12, 2)->default(0);
            $table->string('status', 20)->default(ReservationStatus::Active->value);
            $table->string('booked_via', 20);
            $table->foreignId('booked_by')->constrained('users');
            $table->dateTime('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->text('cancellation_reason')->nullable();
            $table->timestamps();

            $table->index(['room_id', 'status', 'starts_at']);
        });

        // Every verification is recorded, including failures that never become a stay.
        Schema::create('verification_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('guest_id')->constrained();
            $table->string('result', 20);
            $table->text('notes')->nullable();
            $table->foreignId('verified_by')->constrained('users');
            $table->dateTime('attempted_at');
            $table->timestamps();
        });

        Schema::create('stays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->nullable()->constrained();
            $table->foreignId('guest_id')->constrained();
            $table->foreignId('room_id')->constrained();
            $table->foreignId('verification_attempt_id')->constrained();
            $table->unsignedSmallInteger('pax');
            $table->dateTime('checked_in_at');
            $table->dateTime('expected_check_out_at');
            // The slot after this stay opens for booking only once this is set.
            $table->dateTime('not_extending_confirmed_at')->nullable();
            $table->dateTime('checked_out_at')->nullable();
            $table->foreignId('checked_in_by')->constrained('users');
            $table->foreignId('checked_out_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index(['room_id', 'checked_out_at']);
        });

        Schema::create('id_custody', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stay_id')->constrained();
            $table->string('id_type');
            $table->string('id_number');
            $table->string('status', 30);
            $table->foreignId('received_by')->constrained('users');
            $table->dateTime('returned_at')->nullable();
            $table->foreignId('returned_by')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('id_custody');
        Schema::dropIfExists('stays');
        Schema::dropIfExists('verification_attempts');
        Schema::dropIfExists('reservations');
        Schema::dropIfExists('guests');
    }
};
