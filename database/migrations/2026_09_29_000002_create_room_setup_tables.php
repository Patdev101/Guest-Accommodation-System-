<?php

use App\Enums\RoomStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 100)->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained();
            $table->string('name');
            $table->unsignedSmallInteger('pax_capacity');
            $table->text('description')->nullable();
            $table->string('status', 30)->default(RoomStatus::Available->value)->index();
            $table->timestamps();

            $table->unique(['location_id', 'name']);
        });

        Schema::create('room_inclusions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->string('item');
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->timestamps();
        });

        // Per hour, Overnight, Day tour, plus any unit the Admin adds.
        Schema::create('rate_units', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        // Prices are entered manually by the Admin, including extension prices.
        Schema::create('room_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('rate_unit_id')->constrained();
            $table->string('name');
            $table->decimal('price', 12, 2);
            $table->boolean('is_extension_rate')->default(false);
            $table->timestamps();
        });

        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->date('performed_on');
            $table->text('issue');
            $table->text('action_taken')->nullable();
            $table->string('done_by')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_records');
        Schema::dropIfExists('room_rates');
        Schema::dropIfExists('rate_units');
        Schema::dropIfExists('room_inclusions');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('settings');
    }
};
