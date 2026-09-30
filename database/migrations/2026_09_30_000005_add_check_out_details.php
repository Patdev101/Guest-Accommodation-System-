<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Check-out (rules 22 to 25): each room is inspected after the guests leave,
 * and an extension may move Guest B's rooms (rule 20), one row per moved room.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stay_rooms', function (Blueprint $table) {
            $table->dateTime('inspected_at')->nullable();
            $table->foreignId('inspected_by')->nullable()->constrained('users');
        });

        Schema::create('extension_moves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('extension_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reservation_room_id')->constrained();
            $table->foreignId('from_room_id')->constrained('rooms');
            $table->foreignId('to_room_id')->nullable()->constrained('rooms');
            $table->string('consent_status', 20);
            $table->dateTime('consent_responded_at')->nullable();
            // Reception, when Guest B answers by phone.
            $table->foreignId('consent_recorded_by')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('extension_moves');

        Schema::table('stay_rooms', function (Blueprint $table) {
            $table->dropForeign(['inspected_by']);
            $table->dropColumn(['inspected_at', 'inspected_by']);
        });
    }
};
