<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Owner decision 30 Sep 2026: one booking can take several rooms (e.g. a company
 * crew), under one contact person. The rooms move to their own table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservation_rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_id')->constrained();
            $table->foreignId('room_rate_id')->nullable()->constrained();
            $table->unsignedSmallInteger('pax');
            $table->decimal('price', 12, 2)->default(0);
            $table->timestamps();

            $table->unique(['reservation_id', 'room_id']);
            $table->index('room_id');
        });

        Schema::table('reservations', function (Blueprint $table) {
            $table->string('company')->nullable();
            $table->string('purpose')->nullable();
        });

        Schema::table('guests', function (Blueprint $table) {
            $table->string('email')->nullable();
        });

        foreach (DB::table('reservations')->get(['id', 'room_id', 'room_rate_id', 'pax', 'total']) as $reservation) {
            DB::table('reservation_rooms')->insert([
                'reservation_id' => $reservation->id,
                'room_id' => $reservation->room_id,
                'room_rate_id' => $reservation->room_rate_id,
                'pax' => $reservation->pax,
                'price' => $reservation->total,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('reservations', function (Blueprint $table) {
            $table->dropIndex(['room_id', 'status', 'starts_at']);
            $table->dropForeign(['room_id']);
            $table->dropForeign(['room_rate_id']);
        });

        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn(['room_id', 'room_rate_id', 'pax']);
            $table->index(['status', 'starts_at']);
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropIndex(['status', 'starts_at']);
            $table->foreignId('room_id')->nullable()->constrained();
            $table->foreignId('room_rate_id')->nullable()->constrained();
            $table->unsignedSmallInteger('pax')->default(1);
            $table->dropColumn(['company', 'purpose']);
        });

        foreach (DB::table('reservation_rooms')->orderBy('id')->get() as $line) {
            DB::table('reservations')->where('id', $line->reservation_id)->whereNull('room_id')->update([
                'room_id' => $line->room_id,
                'room_rate_id' => $line->room_rate_id,
                'pax' => $line->pax,
            ]);
        }

        Schema::table('guests', function (Blueprint $table) {
            $table->dropColumn('email');
        });

        Schema::dropIfExists('reservation_rooms');
    }
};
