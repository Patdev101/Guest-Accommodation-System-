<?php

use App\Enums\BilledTo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A charge or payment belongs to a stay, or to a reservation before check-in.
        Schema::create('charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stay_id')->nullable()->constrained();
            $table->foreignId('reservation_id')->nullable()->constrained();
            $table->string('type', 20);
            $table->string('description');
            $table->decimal('amount', 12, 2);
            $table->string('billed_to', 20)->default(BilledTo::Company->value);
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stay_id')->nullable()->constrained();
            $table->foreignId('reservation_id')->nullable()->constrained();
            $table->decimal('amount', 12, 2);
            $table->string('payment_type', 20);
            $table->string('paid_by', 20);
            $table->string('method', 50);
            $table->string('receipt_number', 100)->nullable();
            $table->foreignId('received_by')->constrained('users');
            $table->dateTime('paid_at');
            $table->timestamps();
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->nullable()->constrained();
            $table->foreignId('payment_id')->nullable()->constrained();
            $table->decimal('amount', 12, 2);
            $table->string('reason');
            $table->string('status', 20);
            $table->foreignId('requested_by')->constrained('users');
            $table->dateTime('requested_at');
            $table->foreignId('processed_by')->nullable()->constrained('users');
            $table->dateTime('processing_at')->nullable();
            $table->foreignId('refunded_by')->nullable()->constrained('users');
            $table->dateTime('refunded_at')->nullable();
            $table->timestamps();
        });

        Schema::create('extensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stay_id')->constrained();
            $table->dateTime('old_check_out_at');
            $table->dateTime('new_check_out_at');
            $table->decimal('price', 12, 2)->nullable();
            $table->string('status', 20);
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('decided_by')->nullable()->constrained('users');
            $table->dateTime('decided_at')->nullable();
            $table->string('denial_reason')->nullable();

            // Set when the room is reserved next and Guest B must agree to move.
            $table->foreignId('affected_reservation_id')->nullable()->constrained('reservations');
            $table->foreignId('moved_from_room_id')->nullable()->constrained('rooms');
            $table->foreignId('moved_to_room_id')->nullable()->constrained('rooms');
            $table->string('consent_status', 20)->nullable();
            $table->dateTime('consent_responded_at')->nullable();
            // Reception, when Guest B answers by phone; null when Guest B answered in the app.
            $table->foreignId('consent_recorded_by')->nullable()->constrained('users');
            $table->timestamps();
        });

        // Every reminder and call: type, time, result.
        Schema::create('reminder_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stay_id')->constrained();
            $table->string('type', 20);
            $table->dateTime('sent_at');
            $table->string('result', 20)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('logged_by')->nullable()->constrained('users');
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('reminder_logs');
        Schema::dropIfExists('extensions');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('charges');
    }
};
