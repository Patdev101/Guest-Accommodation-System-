<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Guest side (owner decision 6 Oct 2026): a booking made online is a request
 * that Reception approves or declines. An approved request becomes a normal
 * reservation; until then it is kept here, apart from real reservations.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_requests', function (Blueprint $table) {
            $table->id();
            // The guest account that sent it (no cascade: SQL Server rule).
            $table->foreignId('user_id')->constrained();

            $table->string('contact_name');
            $table->string('contact_number', 30);
            $table->string('email')->nullable();
            $table->string('company')->nullable();
            $table->string('purpose')->nullable();
            $table->string('guest_type', 20);
            $table->unsignedSmallInteger('guests');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->decimal('total', 12, 2)->default(0);
            // What the guest wrote to Reception.
            $table->string('message', 1000)->nullable();

            // pending, approved, declined, cancelled (by the guest) or expired (no answer in time).
            $table->string('status', 20)->default('pending');
            // While pending, the rooms are held for the guest until this time.
            $table->dateTime('hold_expires_at')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users');
            $table->dateTime('decided_at')->nullable();
            $table->string('decline_reason')->nullable();
            // The reservation made when Reception approved it.
            $table->foreignId('reservation_id')->nullable()->constrained();
            $table->timestamps();

            $table->index(['status', 'starts_at']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('booking_request_rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_id')->constrained();
            $table->foreignId('room_rate_id')->nullable()->constrained();
            $table->unsignedSmallInteger('pax');
            $table->decimal('price', 12, 2)->default(0);
            $table->timestamps();

            $table->unique(['booking_request_id', 'room_id']);
            $table->index('room_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_request_rooms');
        Schema::dropIfExists('booking_requests');
    }
};
