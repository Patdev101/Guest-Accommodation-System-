<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Owner decisions 30 Sep 2026: a check-in covers the booking's rooms, with a
 * guest list (name, address, contact, room) and one ID per booking, whose
 * photo is kept privately.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stay_rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stay_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_id')->constrained();
            $table->unsignedSmallInteger('pax');
            $table->timestamps();

            $table->unique(['stay_id', 'room_id']);
            $table->index('room_id');
        });

        Schema::create('stay_guests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stay_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_id')->constrained();
            $table->string('name');
            $table->string('address')->nullable();
            $table->string('contact_number', 30)->nullable();
            $table->timestamps();
        });

        Schema::table('id_custody', function (Blueprint $table) {
            // Private "local" disk. Null only on records made before photos were required.
            $table->string('photo_path')->nullable();
        });

        foreach (DB::table('stays')->get(['id', 'room_id', 'pax', 'guest_id']) as $stay) {
            DB::table('stay_rooms')->insert([
                'stay_id' => $stay->id,
                'room_id' => $stay->room_id,
                'pax' => $stay->pax,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('stay_guests')->insert([
                'stay_id' => $stay->id,
                'room_id' => $stay->room_id,
                'name' => DB::table('guests')->where('id', $stay->guest_id)->value('name'),
                'contact_number' => DB::table('guests')->where('id', $stay->guest_id)->value('contact_number'),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('stays', function (Blueprint $table) {
            $table->dropIndex(['room_id', 'checked_out_at']);
            $table->dropForeign(['room_id']);
        });

        Schema::table('stays', function (Blueprint $table) {
            $table->dropColumn(['room_id', 'pax']);
            $table->index('checked_out_at');
        });
    }

    public function down(): void
    {
        Schema::table('stays', function (Blueprint $table) {
            $table->dropIndex(['checked_out_at']);
            $table->foreignId('room_id')->nullable()->constrained();
            $table->unsignedSmallInteger('pax')->default(1);
        });

        foreach (DB::table('stay_rooms')->orderBy('id')->get() as $line) {
            DB::table('stays')->where('id', $line->stay_id)->whereNull('room_id')->update([
                'room_id' => $line->room_id,
                'pax' => $line->pax,
            ]);
        }

        Schema::table('id_custody', function (Blueprint $table) {
            $table->dropColumn('photo_path');
        });

        Schema::dropIfExists('stay_guests');
        Schema::dropIfExists('stay_rooms');
    }
};
