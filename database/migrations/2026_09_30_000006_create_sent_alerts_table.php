<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Remembers which timed front-desk alerts were sent (rules 17, 18 and 27),
 * so the every-minute check sends each one once.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sent_alerts', function (Blueprint $table) {
            $table->id();
            // e.g. "checkout:12:1790000000" (stay 12, due-out time).
            $table->string('key', 150)->unique();
            $table->dateTime('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sent_alerts');
    }
};
